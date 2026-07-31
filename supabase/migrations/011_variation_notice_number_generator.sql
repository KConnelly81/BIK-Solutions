-- ============================================================================
-- Migration: 011_variation_notice_number_generator.sql
-- Purpose:   Concurrency-safe, server-side generation of
--            variation_notices.variation_number, plus a transactional entry
--            point that allocates a number and creates the draft row as one
--            atomic unit. 010 deliberately left this unsolved (see that
--            migration's "NOT built" section) — the existing tool's
--            numbering is a per-browser localStorage counter (js/tools/
--            variation-notice/config.js's nextVariationNumber()), which is
--            unsafe the moment two people in the same organisation can
--            create a variation at the same time.
--
--            DRAFT — not yet applied to hpcqncghvdrlvufxfdnd. Same
--            draft-then-review-then-apply sequence as every migration in
--            this repo; 010's live application does not extend to this one.
--
--            Second review round. Two workflow risks closed since the first
--            draft, both found in review before this was ever applied
--            anywhere:
--
--            1. Allocation and draft creation were already atomic at the
--               database level — the number is assigned inside a BEFORE
--               INSERT trigger, not returned to the client by a separate
--               callable function ahead of a later insert, so there was
--               never a window where a number could be consumed without a
--               corresponding row. What was missing was a clean, validated,
--               single-round-trip client entry point instead of a bare
--               INSERT. Added: public.create_variation_notice(), a
--               transactional RPC that validates the caller and project,
--               allocates, inserts, and returns the created row. The
--               trigger stays in place underneath it as a defence-in-depth
--               backstop for any insert path, not only this RPC.
--
--            2. The auto-generator (bare zero-padded numbers, e.g. "010")
--               cannot collide with a differently-formatted manual override
--               like "VAR-010" — those are different strings. It *can*
--               collide with a manual override in the exact same bare
--               format the generator itself produces (someone manually
--               types "010"). Closed with two layers: a proactive,
--               bounded collision-avoidance loop inside the trigger (skips
--               forward past any already-taken candidate before accepting
--               one — handles the realistic case, including a project's
--               very first auto-assignment when manual numbers already
--               exist and no counter row has been created yet), and a
--               bounded retry-on-conflict loop in the RPC as a genuine
--               defence-in-depth backstop for the narrow theoretical race
--               the proactive check alone can't close (a concurrent manual
--               insert landing between the check and the write). See
--               "Canonical format and normalisation" below (this section
--               was renamed in round three, see below) for the full
--               analysis and the tests that back it.
--
--            Third review round. The second round's own fix above was
--            itself flagged as a product-consistency problem: "VAR-010"
--            and bare "010" not colliding is technically correct but not
--            what a user means by those two entries — they read as the
--            same variation number and should be treated as one.
--            Resolved by introducing an actual canonical format instead of
--            relying on string inequality:
--
--            3. The auto-generator now produces "VAR-001", "VAR-002", ...,
--               "VAR-999", "VAR-1000", not a bare number — internal.
--               format_variation_number() (new) does the 1000-safe padding
--               from round two, internal.normalize_variation_number() (new)
--               applies the "VAR-" prefix on the auto-assign path and, on
--               the manual-entry path, recognises standard-equivalent input
--               regardless of how it's typed — bare "010", "var-010",
--               "VAR 010", "VAR-010" all normalise to the one canonical
--               string "VAR-010" — while leaving a genuinely custom
--               reference like "CLIENT-VO-10" untouched. Because manual
--               entries are normalised to the same canonical form the
--               generator itself produces, two semantically equivalent
--               standard references can no longer coexist: they collapse
--               to one literal string before the existing per-project
--               unique index (010) ever has to decide, which is also what
--               makes the counter safely skip a manually entered higher
--               canonical number (e.g. "VAR-010") the same way it already
--               skipped bare "010" in round two — same collision-avoidance
--               loop, now operating on canonical strings throughout. See
--               "Canonical format and normalisation" below for the full
--               analysis and the tests that back it.
-- Phase:     3 (Tool migration — Variation Notices pilot)
-- Depends on: 010_create_variation_notices.sql (variation_notices table),
--             005_phase1_rls.sql (internal schema, internal.
--             current_organisation_id())
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: internal.variation_number_counters
-- One row per project, tracking the next number to assign. Lives in
-- `internal`, not `public` — same reasoning as internal.
-- current_organisation_id() (005): this is policy/numbering plumbing, not
-- part of the application's API surface, and Supabase's Data API only ever
-- exposes `public` regardless, so there is no scenario where a client role
-- needs to see this table directly.
--
-- RLS enabled with zero policies (same secure-by-default posture 001-004
-- started with, before their own policies existed) and no GRANTs to
-- anon/authenticated at all — belt-and-braces on top of `internal` already
-- being unreachable via the Data API and ungranted at the schema level
-- (005). The only path to this table is the SECURITY DEFINER trigger
-- function below.
--
-- ON DELETE CASCADE from projects: in ordinary product operation this is
-- unreachable, not dead code — a project can only be deleted once it has
-- zero variation_notices (that FK is ON DELETE RESTRICT, 010), and a
-- counter row is only ever created atomically alongside a project's first
-- variation_notices row, so a project with a counter row always has at
-- least one variation_notices row blocking its deletion via the ordinary
-- authenticated path. It matters for the privileged/service_role path
-- (test-data cleanup, ADR-010's GDPR/maintenance carve-out): hard-delete a
-- project's variation_notices rows, then delete the project — the orphaned
-- counter row must not be left behind, which is exactly what this CASCADE
-- provides. Verified below.
-- ----------------------------------------------------------------------------
create table if not exists internal.variation_number_counters (
  project_id       uuid primary key references public.projects(id) on delete cascade,

  -- Denormalised from projects.organisation_id, not independently trusted:
  -- see assign_variation_notice_number() below for why this column exists
  -- and how it's kept correct despite that.
  organisation_id  uuid not null references public.organisations(id) on delete restrict,

  next_number      integer not null default 1,
  updated_at       timestamptz not null default now()
);

comment on table internal.variation_number_counters is
  'One row per project, tracking the next variation_notices.variation_number to assign. Internal bookkeeping only — never read or written directly by any client role, only via assign_variation_notice_number()''s atomic upsert.';

alter table internal.variation_number_counters enable row level security;

revoke all on internal.variation_number_counters from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: prevent_variation_number_counter_decrease
-- Defence-in-depth against an accidental manual correction (a support/ops
-- UPDATE run directly against this table) ever moving a counter backwards,
-- which would reopen exactly the collision risk this whole migration exists
-- to close — checked even though no client role can reach this table at
-- all today, on the same "even privileged paths get real invariants"
-- reasoning as 007's last-owner protection. Applies to UPDATE only —
-- next_number's own NOT NULL/default handles INSERT, and the ordinary
-- increment path (the upsert below) only ever increases it, so this never
-- fires in normal operation.
-- ----------------------------------------------------------------------------
create or replace function internal.prevent_variation_number_counter_decrease()
returns trigger
language plpgsql
as $$
begin
  if new.next_number < old.next_number then
    raise exception 'variation_number_counters.next_number cannot be decreased (was %, attempted %).', old.next_number, new.next_number
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace trigger variation_number_counters_prevent_decrease
  before update on internal.variation_number_counters
  for each row
  execute function internal.prevent_variation_number_counter_decrease();

revoke all on function internal.prevent_variation_number_counter_decrease() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Canonical format and normalisation
--
-- Round two made "VAR-010" and bare "010" not collide, by having the
-- generator produce bare numbers only. That was flagged, correctly, as a
-- product-consistency problem rather than a database one: those two
-- strings are not a collision, but a user reads them as the same
-- variation number, and a system that can hold both under different
-- spellings is confusing regardless of whether the unique index is happy
-- about it. The fix is a real canonical format, not string inequality:
--
--   - Auto-generated references are always "VAR-" followed by the padded
--     sequence number: "VAR-001", "VAR-002", ..., "VAR-999", "VAR-1000".
--     Never a bare number.
--   - A manually-entered reference that is *standard-equivalent* — bare
--     digits ("010"), or "VAR"/"var" (case-insensitive) followed by an
--     optional hyphen or space then digits ("var-010", "VAR 010",
--     "VAR-010") — is normalised to that same canonical form before it is
--     stored. "010", "var-010", "VAR 010" and "VAR-010" all become the one
--     string "VAR-010".
--   - A manually-entered reference that does not match that shape (e.g.
--     "CLIENT-VO-10") is a genuinely custom reference and is stored
--     exactly as typed, untouched.
--
-- internal.format_variation_number() (below) is the single place that
-- turns a sequence number into its padded text form (the round-two
-- 1000-safe padding), and internal.normalize_variation_number() is the
-- single place that recognises a standard-equivalent manual entry and
-- reduces it to canonical form. Both the auto-assign path and the
-- manual-entry path route through them, so there is exactly one
-- definition of "canonical" and the two paths cannot drift apart.
--
-- Because normalisation happens before the row is ever written, "two
-- semantically equivalent standard references must not coexist in the
-- same project" falls out of the *existing* per-project unique index
-- (010) for free — there is no separate rule to write or maintain, since
-- equivalent inputs are now, literally, the same string by the time
-- anything checks uniqueness. The same is true for the collision-
-- avoidance loop below: a manually entered "VAR-010" is now exactly the
-- string the auto-generator would itself produce on reaching 10, so the
-- existing loop skips past it correctly with no special-casing for
-- "this candidate came from a manual entry, not another auto-assign" —
-- there is no such distinction left to make.
--
-- What normalisation deliberately does not attempt: understanding or
-- reformatting genuinely custom references. "CLIENT-VO-10" is a real,
-- distinct value some builders may want to keep (e.g. matching an
-- external system's own numbering) — normalisation only recognises the
-- shapes that are unambiguously "this is our own standard format, just
-- typed inconsistently", and leaves everything else alone.
--
-- The residual concurrent-insert race is unchanged from round two and
-- still closed the same way: a manual insert for the exact canonical
-- candidate landing in a not-yet-committed concurrent transaction is
-- invisible to the proactive check under READ COMMITTED, so both could
-- proceed believing the value is free — but the table's unique index
-- (010) is the actual, unconditional backstop regardless, and
-- create_variation_notice()'s retry loop, below, is what turns that rare
-- failure into a clean retry instead of a raw constraint-violation error.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Function: internal.format_variation_number
-- Pure formatting, no side effects: zero-pads a sequence number to 3
-- digits below 1000; passes it through unpadded at/above 1000. lpad()
-- truncates rather than passing through once the input is already wider
-- than the target width (lpad('1000', 3, '0') = '100', not '1000' —
-- confirmed against live Postgres behaviour, not assumed; this is the
-- round-two bug fix, unchanged). The one place this logic lives, so the
-- auto-assign candidate and manual-entry normalisation can never disagree
-- on what a given sequence number looks like as text.
-- SET search_path = '': not SECURITY DEFINER and references nothing
-- unqualified, so there is nothing a hijacked search_path could actually
-- change here — set anyway, for the same reason create_variation_notice()
-- sets it despite also being SECURITY INVOKER: consistency with this
-- schema's convention, not because this specific function is exploitable.
-- ----------------------------------------------------------------------------
create or replace function internal.format_variation_number(p_number bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_number < 1000 then lpad(p_number::text, 3, '0')
    else p_number::text
  end;
$$;

revoke all on function internal.format_variation_number(bigint) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Function: internal.normalize_variation_number
-- Given a non-blank manually-entered variation_number, returns its
-- canonical "VAR-NNN" form if it is standard-equivalent (bare digits, or
-- "VAR"/"var" with an optional hyphen/space separator then digits — all
-- case-insensitive), or returns the trimmed input unchanged if it doesn't
-- match that shape (a genuinely custom reference). Pure text
-- transformation only — does not touch any table, does not need
-- SECURITY DEFINER, and is safe to call from either the DEFINER trigger
-- below or, in principle, from ordinary application code.
-- ----------------------------------------------------------------------------
create or replace function internal.normalize_variation_number(p_input text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_trimmed  text;
  v_upper    text;
  v_digits   text;
begin
  v_trimmed := btrim(p_input);
  if v_trimmed = '' then
    return v_trimmed;
  end if;

  v_upper := upper(v_trimmed);

  if v_upper ~ '^[0-9]+$' then
    v_digits := v_upper;
  elsif v_upper ~ '^VAR[- ]?[0-9]+$' then
    v_digits := regexp_replace(v_upper, '^VAR[- ]?', '');
  else
    -- Genuinely custom reference, e.g. "CLIENT-VO-10" -- left untouched.
    return v_trimmed;
  end if;

  return 'VAR-' || internal.format_variation_number(v_digits::bigint);
end;
$$;

revoke all on function internal.normalize_variation_number(text) from public, anon, authenticated;
-- authenticated is granted EXECUTE (unlike every other internal.* function
-- in this migration): create_variation_notice() below is SECURITY INVOKER
-- and calls this directly, to report a collision error against the
-- canonical value that was actually about to be stored, not the raw text
-- the caller typed. Safe to expose this specific grant — pure text
-- transformation, touches no table, nothing to escalate to.
grant execute on function internal.normalize_variation_number(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: assign_variation_notice_number
--
-- Behaviour, precisely:
--   - If the client supplies a non-blank variation_number, it is passed
--     through internal.normalize_variation_number(): a standard-equivalent
--     entry (bare digits, or "VAR"/"var" plus an optional hyphen/space
--     then digits) is rewritten to its canonical "VAR-NNN" form; a
--     genuinely custom reference is stored exactly as typed. Either way
--     this is still a manual override — the existing tool's own UI hint
--     says "Auto-incremented. Edit if needed." — and no collision-
--     avoidance loop runs for it directly: a normalised value that
--     collides with an existing row is a real, reportable error (see
--     create_variation_notice() below), not something to silently work
--     around by picking a different number the user didn't ask for.
--   - If the client leaves variation_number null or blank, the next free
--     number for that project is assigned atomically and formatted as
--     "VAR-" || internal.format_variation_number(next_number) — "VAR-001",
--     ..., "VAR-999", "VAR-1000" — using the exact same formatting
--     function a normalised manual entry goes through, so the two paths
--     can never disagree on what "VAR-010" looks like.
--
-- Why the base allocation is race-free without an advisory lock (unlike
-- bootstrap_organisation, 006, which genuinely needs one): bootstrap's race
-- is a separate SELECT-then-INSERT — checking "does a profile exist" and
-- then inserting are two statements with a window between them, which is
-- exactly what an advisory lock closes. This function instead does the
-- read-and-increment as a single statement:
-- `INSERT ... ON CONFLICT (project_id) DO UPDATE ... RETURNING`. Postgres
-- itself serialises two concurrent upserts targeting the same primary key —
-- the second transaction's conflicting insert blocks on that row until the
-- first commits or rolls back, then proceeds against the now-current value.
-- Adding an advisory lock on top would be redundant complexity with no
-- correctness benefit for that part — same reviewed reasoning, opposite
-- conclusion, as 006's own use of one. See "Manual-override collision
-- handling" above for what the surrounding loop adds on top of this base
-- guarantee, and why.
--
-- SECURITY DEFINER: authenticated has no grant at all on
-- internal.variation_number_counters (by design, above); this function is
-- the only path to it, so it must run as its owner to succeed.
-- SET search_path = '': fixed and verified below — prevents search_path
-- hijacking, same as every other DEFINER function in this schema.
--
-- Explicit project/organisation consistency check, not relied upon via
-- trigger firing order: this table already has
-- enforce_variation_notice_project_same_organisation() (010) checking that
-- NEW.project_id belongs to NEW.organisation_id, and Postgres fires
-- same-event BEFORE triggers alphabetically by name — "assign_..." sorts
-- before "enforce_...", so on an insert with a genuinely mismatched
-- project/organisation pair, this function would run first. Rather than
-- depend on that ordering for correctness, this function re-checks the
-- same invariant itself before touching the counters table at all: if the
-- check fails, it leaves variation_number untouched and returns
-- immediately, letting enforce_variation_notice_project_same_organisation()
-- raise the actual, single, consistent error message shortly after — the
-- counters table is never written to on a doomed insert, regardless of
-- which trigger happens to run first. Verified below.
-- ----------------------------------------------------------------------------
create or replace function public.assign_variation_notice_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next          integer;
  v_candidate     text;
  v_attempts      integer := 0;
  v_max_attempts  constant integer := 1000;
begin
  if new.variation_number is not null and btrim(new.variation_number) <> '' then
    new.variation_number := internal.normalize_variation_number(new.variation_number);
    return new;
  end if;

  if not exists (
    select 1 from public.projects
    where id = new.project_id
      and organisation_id = new.organisation_id
  ) then
    return new;
  end if;

  loop
    insert into internal.variation_number_counters (project_id, organisation_id, next_number)
    values (new.project_id, new.organisation_id, 1)
    on conflict (project_id) do update
      set next_number = internal.variation_number_counters.next_number + 1,
          updated_at = now()
    returning next_number into v_next;

    v_candidate := 'VAR-' || internal.format_variation_number(v_next);

    exit when not exists (
      select 1 from public.variation_notices
      where project_id = new.project_id
        and variation_number = v_candidate
    );

    v_attempts := v_attempts + 1;
    if v_attempts >= v_max_attempts then
      raise exception 'Could not find a free variation number for this project after % attempts.', v_max_attempts
        using errcode = '40001';
    end if;
  end loop;

  new.variation_number := v_candidate;
  return new;
end;
$$;

comment on function public.assign_variation_notice_number() is
  'Atomically assigns the next free per-project variation_number in canonical "VAR-NNN" form when the client leaves it blank, skipping past any value already taken; normalises a standard-equivalent manual entry (bare digits, "var-010", "VAR 010", ...) to the same canonical form, or stores a genuinely custom reference unchanged. See this function''s header comment and "Canonical format and normalisation" above.';

create or replace trigger variation_notices_assign_number
  before insert on public.variation_notices
  for each row
  execute function public.assign_variation_notice_number();

-- Trigger function, not called directly by any client role — same reasoning
-- as every other trigger function in this schema.
revoke all on function public.assign_variation_notice_number() from public;
revoke all on function public.assign_variation_notice_number() from anon;
revoke all on function public.assign_variation_notice_number() from authenticated;

-- ----------------------------------------------------------------------------
-- Function: create_variation_notice
-- Transactional entry point: validates the caller and the project, then
-- allocates a number and creates the draft row as one atomic unit, and
-- returns the created row. This is the recommended client path — a plain
-- authenticated INSERT against variation_notices still works (RLS- and
-- trigger-enforced correctness does not depend on going through this
-- function), but this gives the frontend one clean call with proper
-- validation errors instead of raw constraint-violation text, and closes
-- the narrow residual collision race described above.
--
-- SECURITY INVOKER (the default — no `security definer` here), unlike
-- assign_variation_notice_number(): deliberately least-privilege. Every
-- operation this function performs — reading the caller's own
-- organisation's projects, inserting into variation_notices within that
-- organisation — is something the calling authenticated user already has
-- direct RLS-permitted access to. There is nothing to escalate to; running
-- as definer here would be a wider privilege grant than the function
-- actually needs, which is exactly the kind of unnecessary elevation this
-- codebase's other privilege decisions (e.g. 014/015's grant corrections)
-- have consistently avoided. Elevated privilege is reserved for
-- assign_variation_notice_number(), which genuinely cannot succeed without
-- it (authenticated has zero grant on the counters table).
-- SET search_path = '' is still set below despite SECURITY INVOKER — here
-- it is a correctness measure (unambiguous resolution of public.projects/
-- public.variation_notices regardless of the caller's own search_path
-- setting), not a privilege-escalation defence, since an invoker function
-- has no elevated privilege for a hijacked search_path to leak.
-- ----------------------------------------------------------------------------
create or replace function public.create_variation_notice(
  p_project_id              uuid,
  p_client_name             text,
  p_reason_for_variation    text,
  p_description_of_work     text,
  p_cost_excl_gst_cents     bigint,
  p_client_email            text default null,
  p_site_address            text default null,
  p_contract_reference      text default null,
  p_requested_by            text default null,
  p_exclusions_assumptions  text default null,
  p_materials_required      text default null,
  p_labour_required         text default null,
  p_gst_applicable          boolean default true,
  p_cost_type               text default 'fixed',
  p_extension_of_time_days  integer default 0,
  p_revised_completion_date date default null,
  p_payment_terms           text default '14days-approval',
  p_builder_notes           text default null,
  p_builder_approval_name   text default null,
  p_client_approval_name    text default null,
  p_variation_number        text default null
)
returns public.variation_notices
language plpgsql
set search_path = ''
as $$
declare
  v_org_id        uuid;
  v_row           public.variation_notices;
  v_attempts      integer := 0;
  v_max_attempts  constant integer := 5;
  v_constraint    text;
  v_manual        boolean;
begin
  v_org_id := internal.current_organisation_id();
  if v_org_id is null then
    raise exception 'Authentication required, or your account has no active organisation.'
      using errcode = '28000';
  end if;

  if p_project_id is null or not exists (
    select 1 from public.projects
    where id = p_project_id and organisation_id = v_org_id
  ) then
    raise exception 'Project not found in your organisation.'
      using errcode = '42501';
  end if;

  if btrim(coalesce(p_client_name, '')) = '' then
    raise exception 'Client name is required.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_reason_for_variation, '')) = '' then
    raise exception 'Reason for variation is required.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_description_of_work, '')) = '' then
    raise exception 'Description of work is required.' using errcode = '22023';
  end if;
  if p_cost_excl_gst_cents is null or p_cost_excl_gst_cents < 0 then
    raise exception 'A valid cost (0 or greater) is required.' using errcode = '22023';
  end if;

  v_manual := p_variation_number is not null and btrim(p_variation_number) <> '';

  loop
    begin
      insert into public.variation_notices (
        organisation_id, project_id, variation_number, client_name, client_email,
        site_address, contract_reference, requested_by,
        reason_for_variation, description_of_work, exclusions_assumptions,
        materials_required, labour_required,
        cost_excl_gst_cents, gst_applicable, cost_type,
        extension_of_time_days, revised_completion_date, payment_terms,
        builder_notes, builder_approval_name, client_approval_name,
        created_by, updated_by
      ) values (
        v_org_id, p_project_id, p_variation_number, btrim(p_client_name),
        nullif(btrim(coalesce(p_client_email, '')), ''),
        p_site_address, p_contract_reference, p_requested_by,
        p_reason_for_variation, p_description_of_work, p_exclusions_assumptions,
        p_materials_required, p_labour_required,
        p_cost_excl_gst_cents, p_gst_applicable, p_cost_type,
        p_extension_of_time_days, p_revised_completion_date, p_payment_terms,
        p_builder_notes, p_builder_approval_name, p_client_approval_name,
        auth.uid(), auth.uid()
      )
      returning * into v_row;

      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint <> 'variation_notices_org_project_number_unique_idx' then
        raise;
      end if;

      if v_manual then
        -- A manual override colliding with an existing number is a real,
        -- reportable error — never silently retried with a different
        -- number the user didn't ask for. Report the canonical value that
        -- was actually about to be stored (a normalised "010" collides as
        -- "VAR-010"), not necessarily the literal text the caller typed,
        -- so the message matches what the uniqueness check is really about.
        raise exception 'A variation numbered "%" already exists for this project. Choose a different number.', internal.normalize_variation_number(p_variation_number)
          using errcode = '23505';
      end if;

      -- Auto-assign path: the proactive check inside
      -- assign_variation_notice_number() already handles the realistic
      -- case, so reaching this branch means the narrow concurrent-race
      -- window described in "Canonical format and normalisation" above.
      -- Retry — the trigger computes a fresh candidate on each attempt.
      v_attempts := v_attempts + 1;
      if v_attempts >= v_max_attempts then
        raise exception 'Could not allocate a variation number after % attempts — please try again.', v_max_attempts
          using errcode = '40001';
      end if;
    end;
  end loop;

  return v_row;
end;
$$;

comment on function public.create_variation_notice is
  'Recommended client entry point for creating a Variation Notice draft: validates the caller and project, atomically allocates a canonical "VAR-NNN" number (or normalises/accepts a supplied manual override), inserts the row, and returns it. SECURITY INVOKER — needs no privilege the caller does not already have via RLS. A plain authenticated INSERT against variation_notices remains valid and equally correct (the trigger normalises regardless of entry path); this exists for clean validation errors and one round-trip, not because direct inserts are unsafe.';

revoke all on function public.create_variation_notice(
  uuid, text, text, text, bigint, text, text, text, text, text, text, text,
  boolean, text, integer, date, text, text, text, text, text
) from public;
revoke all on function public.create_variation_notice(
  uuid, text, text, text, bigint, text, text, text, text, text, text, text,
  boolean, text, integer, date, text, text, text, text, text
) from anon;
grant execute on function public.create_variation_notice(
  uuid, text, text, text, bigint, text, text, text, text, text, text, text,
  boolean, text, integer, date, text, text, text, text, text
) to authenticated;

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberately deferred, tracked here):
--   - Reassignment/backfill of variation_number on UPDATE — the trigger is
--     INSERT-only. Clearing an existing row's variation_number back to null
--     and expecting a fresh auto-assignment on UPDATE is not supported; a
--     manual correction is a direct UPDATE to an explicit value instead,
--     same as any other typed column on this table. Normalisation is the
--     same scope: it only runs on INSERT (via this trigger), not on a
--     later UPDATE to variation_number — a direct UPDATE bypasses it, the
--     same way it bypasses auto-assignment.
--   - Reclaiming/compacting numbers from abandoned drafts — gaps in the
--     sequence (e.g. a draft created, assigned "004", then never issued and
--     effectively abandoned, or a number skipped by the collision-avoidance
--     loop) are expected and accepted, same as invoice numbering in any
--     accounting system. The guarantee this migration provides is no
--     collision, ever, not no gaps.
--   - Resetting a project's counter — once created, a project's next_number
--     only ever increases (and cannot be decreased directly, enforced
--     above). No product requirement yet to renumber.
-- ----------------------------------------------------------------------------
