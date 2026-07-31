-- ============================================================================
-- Migration: 011_variation_notice_number_generator.sql
-- Purpose:   Concurrency-safe, server-side generation of
--            variation_notices.variation_number. 010 deliberately left this
--            unsolved (see that migration's "NOT built" section) — the
--            existing tool's numbering is a per-browser localStorage
--            counter (js/tools/variation-notice/config.js's
--            nextVariationNumber()), which is unsafe the moment two people
--            in the same organisation can create a variation at the same
--            time: both read the same "next" value, both write it, one
--            insert wins on variation_notices_org_project_number_unique_idx,
--            the other fails with a raw constraint-violation error the user
--            has no way to make sense of. Numbering must be computed inside
--            the database, atomically, not read-then-written from the
--            client.
--
--            DRAFT — not yet applied to hpcqncghvdrlvufxfdnd. Same
--            draft-then-review-then-apply sequence as every migration in
--            this repo; 010's live application does not extend to this one.
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
-- Trigger: assign_variation_notice_number
--
-- Behaviour, precisely:
--   - If the client supplies a non-blank variation_number, it is respected
--     as-is (manual override — the existing tool's own UI hint says "Auto-
--     incremented. Edit if needed.", and this preserves that). The table's
--     existing unique index (010) still rejects a collision within the
--     project regardless of whether the number was auto-assigned or typed
--     in manually.
--   - If the client leaves variation_number null or blank, the next number
--     for that project is assigned atomically, formatted to match the
--     existing tool's convention exactly (zero-padded to 3 digits, e.g.
--     "001" — display-level prefixing like "VN-001" remains a frontend
--     concern, unchanged from today; lpad does not truncate, so a project
--     with 1000+ variations simply gets wider numbers, not a silent
--     failure).
--
-- Why this is race-free without an advisory lock (unlike
-- bootstrap_organisation, 006, which genuinely needs one): bootstrap's race
-- is a separate SELECT-then-INSERT — checking "does a profile exist" and
-- then inserting are two statements with a window between them, which is
-- exactly what an advisory lock closes. This function instead does the
-- entire read-and-increment as a single statement:
-- `INSERT ... ON CONFLICT (project_id) DO UPDATE ... RETURNING`. Postgres
-- itself serialises two concurrent upserts targeting the same primary key —
-- the second transaction's conflicting insert blocks on that row until the
-- first commits or rolls back, then proceeds against the now-current value.
-- There is no window for two callers to read the same "next" value, because
-- there is no separate read: the increment and the return happen in the
-- same atomic operation. Adding an advisory lock on top would be redundant
-- complexity with no correctness benefit, so it is deliberately not added
-- here — same reviewed reasoning, opposite conclusion, as 006's own use of
-- one.
--
-- SECURITY DEFINER: authenticated has no grant at all on
-- internal.variation_number_counters (by design, above); this function is
-- the only path to it, so it must run as its owner to succeed.
-- SET search_path = '': same hijacking protection as every other DEFINER
-- function in this schema.
--
-- Explicit project/organisation consistency check, not relied upon via
-- trigger firing order: this table already has
-- enforce_variation_notice_project_same_organisation() (010) checking that
-- NEW.project_id belongs to NEW.organisation_id, and Postgres fires
-- same-event BEFORE triggers alphabetically by name — "assign_..." sorts
-- before "enforce_...", so on an insert with a genuinely mismatched
-- project/organisation pair, this function would run first. Rather than
-- depend on that ordering for correctness (fragile if either trigger is
-- ever renamed), this function re-checks the same invariant itself before
-- touching the counters table at all: if the check fails, it leaves
-- variation_number untouched and returns immediately, letting
-- enforce_variation_notice_project_same_organisation() raise the actual,
-- single, consistent error message shortly after — the counters table is
-- never written to on a doomed insert, regardless of which trigger
-- happens to run first.
-- ----------------------------------------------------------------------------
create or replace function public.assign_variation_notice_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
begin
  if new.variation_number is not null and btrim(new.variation_number) <> '' then
    return new;
  end if;

  if not exists (
    select 1 from public.projects
    where id = new.project_id
      and organisation_id = new.organisation_id
  ) then
    return new;
  end if;

  insert into internal.variation_number_counters (project_id, organisation_id, next_number)
  values (new.project_id, new.organisation_id, 1)
  on conflict (project_id) do update
    set next_number = internal.variation_number_counters.next_number + 1,
        updated_at = now()
  returning next_number into v_next;

  new.variation_number := lpad(v_next::text, 3, '0');
  return new;
end;
$$;

comment on function public.assign_variation_notice_number() is
  'Atomically assigns the next per-project variation_number when the client leaves it blank; respects a client-supplied value unchanged otherwise. See this function''s header comment for why no advisory lock is needed here (contrast bootstrap_organisation, 006, which does need one).';

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
-- NOT built in this migration (deliberately deferred, tracked here):
--   - Reassignment/backfill of variation_number on UPDATE — this trigger is
--     INSERT-only. Clearing an existing row's variation_number back to null
--     and expecting a fresh auto-assignment on UPDATE is not supported; a
--     manual correction is a direct UPDATE to an explicit value instead,
--     same as any other typed column on this table.
--   - Reclaiming/compacting numbers from abandoned drafts — gaps in the
--     sequence (e.g. a draft created, assigned "004", then never issued and
--     effectively abandoned) are expected and accepted, same as invoice
--     numbering in any accounting system. The guarantee this migration
--     provides is no collision, ever, not no gaps.
--   - Resetting a project's counter — once created, a project's next_number
--     only ever increases. No product requirement yet to renumber.
-- ----------------------------------------------------------------------------
