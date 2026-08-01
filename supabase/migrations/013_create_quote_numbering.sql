-- ============================================================================
-- Migration: 013_create_quote_numbering.sql
-- Purpose:   Server-side, concurrency-safe generation of quotes.quote_number,
--            plus create_quote(), the recommended transactional entry point
--            for creating a draft. Layer 2 of 3 for Quotes — depends on
--            012_create_quotes.sql (the quotes table and its pre-existing
--            organisation-scoped uniqueness index, quotes_org_number_
--            unique_idx). Does not touch issue workflow (014).
--
--            DRAFT — NOT APPLIED to hpcqncghvdrlvufxfdnd.
--
--            Mirrors 011_variation_notice_number_generator.sql's
--            already-proven mechanism exactly, adapted to quotes'
--            organisation scope (not project scope) — canonical "QT-0001"
--            format, atomic counter upsert, proactive collision-avoidance
--            loop, manual-entry normalisation, bounded RPC retry. See
--            011's own header comment for the full concurrency analysis;
--            not repeated here beyond what differs (prefix, width, scope).
--
--            Before this migration, quote_number was a plain, manually-
--            supplied column (012). After it, a blank quote_number is
--            auto-assigned; a supplied one is normalised. Nothing in 012
--            needs to change for this to apply cleanly on top of it — same
--            "011 layers cleanly onto 010" relationship this restructure
--            is deliberately reproducing.
-- Phase:     5a (Tool migration — Quotes, numbering layer)
-- Depends on: 012_create_quotes.sql (quotes table, quotes_org_number_unique_idx),
--             005_phase1_rls.sql (internal.current_organisation_id())
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: internal.quote_counters
-- One row per organisation. RLS enabled, zero policies, zero grants —
-- reachable only via the SECURITY DEFINER trigger below, same posture as
-- internal.variation_number_counters (011).
-- ----------------------------------------------------------------------------
create table if not exists internal.quote_counters (
  organisation_id  uuid primary key references public.organisations(id) on delete cascade,
  next_number      integer not null default 1,
  updated_at       timestamptz not null default now()
);

comment on table internal.quote_counters is
  'One row per organisation, tracking the next quotes.quote_number to assign. Internal bookkeeping only — never read or written directly by any client role.';

alter table internal.quote_counters enable row level security;
revoke all on internal.quote_counters from public, anon, authenticated;

create or replace function internal.prevent_quote_counter_decrease()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.next_number < old.next_number then
    raise exception 'quote_counters.next_number cannot be decreased (was %, attempted %).', old.next_number, new.next_number
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace trigger quote_counters_prevent_decrease
  before update on internal.quote_counters
  for each row
  execute function internal.prevent_quote_counter_decrease();

revoke all on function internal.prevent_quote_counter_decrease() from public, anon, authenticated;

-- Pure formatting: zero-pads to 4 digits below 10000; passes through
-- unpadded at/above it. lpad() truncates rather than passing through once
-- the input is already wider than the target width — the width check is
-- required, not decorative (same caution as 011's own bug fix).
create or replace function internal.format_quote_number(p_number bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_number < 10000 then lpad(p_number::text, 4, '0')
    else p_number::text
  end;
$$;

revoke all on function internal.format_quote_number(bigint) from public, anon, authenticated;

-- Recognises a standard-equivalent manual entry (bare digits, or "QT"/"qt"
-- with an optional hyphen/space then digits) and reduces it to canonical
-- "QT-NNNN" form; leaves a genuinely custom reference untouched. Identical
-- shape to internal.normalize_variation_number() (011).
create or replace function internal.normalize_quote_number(p_input text)
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
  elsif v_upper ~ '^QT[- ]?[0-9]+$' then
    v_digits := regexp_replace(v_upper, '^QT[- ]?', '');
  else
    return v_trimmed;
  end if;

  return 'QT-' || internal.format_quote_number(v_digits::bigint);
end;
$$;

revoke all on function internal.normalize_quote_number(text) from public, anon, authenticated;
grant execute on function internal.normalize_quote_number(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: assign_quote_number
-- SECURITY DEFINER — required: authenticated has zero grant on
-- internal.quote_counters. Independently re-validates project/organisation
-- consistency before touching the counters table (does not rely on
-- enforce_quote_project_same_organisation() (012) having already run, even
-- though trigger name ordering happens to put this one first alphabetically
-- among BEFORE INSERT triggers on quotes — same defensive posture 011's
-- assign_variation_notice_number() already established, for the same
-- reason: correctness must not depend on trigger firing order).
-- ----------------------------------------------------------------------------
create or replace function public.assign_quote_number()
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
  if not exists (
    select 1 from public.projects
    where id = new.project_id
      and organisation_id = new.organisation_id
  ) then
    -- Leave quote_number untouched; enforce_quote_project_same_organisation()
    -- (012) will raise the real, single, consistent error shortly after,
    -- regardless of which BEFORE trigger happens to run first.
    return new;
  end if;

  if new.quote_number is not null and btrim(new.quote_number) <> '' then
    new.quote_number := internal.normalize_quote_number(new.quote_number);
    return new;
  end if;

  loop
    insert into internal.quote_counters (organisation_id, next_number)
    values (new.organisation_id, 1)
    on conflict (organisation_id) do update
      set next_number = internal.quote_counters.next_number + 1,
          updated_at = now()
    returning next_number into v_next;

    v_candidate := 'QT-' || internal.format_quote_number(v_next);

    exit when not exists (
      select 1 from public.quotes
      where organisation_id = new.organisation_id
        and quote_number = v_candidate
    );

    v_attempts := v_attempts + 1;
    if v_attempts >= v_max_attempts then
      raise exception 'Could not find a free quote number for this organisation after % attempts.', v_max_attempts
        using errcode = '40001';
    end if;
  end loop;

  new.quote_number := v_candidate;
  return new;
end;
$$;

comment on function public.assign_quote_number() is
  'Atomically assigns the next free per-organisation quote_number in canonical "QT-NNNN" form when the client leaves it blank; normalises a standard-equivalent manual entry. SECURITY DEFINER; independently re-validates project/organisation consistency rather than relying on trigger firing order or any other trigger having already run.';

create or replace trigger quotes_assign_number
  before insert on public.quotes
  for each row
  execute function public.assign_quote_number();

revoke all on function public.assign_quote_number() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Function: create_quote
-- Recommended client entry point: validates the caller and project,
-- creates a draft row (header only), returns it. A plain authenticated
-- INSERT remains equally valid — this exists for clean validation errors
-- and one round-trip, not because direct inserts are unsafe.
--
-- SECURITY INVOKER (default) — least-privilege: every operation here is
-- something the caller already has direct RLS-permitted access to.
-- Retry loop only ever catches quotes_org_number_unique_idx specifically
-- (checked via constraint_name) — any other unique_violation is
-- re-raised, never swallowed.
-- ----------------------------------------------------------------------------
create or replace function public.create_quote(
  p_project_id      uuid,
  p_client_name     text default null,
  p_client_email    text default null,
  p_client_phone    text default null,
  p_client_address  text default null,
  p_quote_number    text default null
)
returns public.quotes
language plpgsql
set search_path = ''
as $$
declare
  v_org_id  uuid;
  v_row     public.quotes;
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
    raise exception 'Project not found in your organisation.' using errcode = '42501';
  end if;

  v_manual := p_quote_number is not null and btrim(p_quote_number) <> '';

  loop
    begin
      insert into public.quotes (
        organisation_id, project_id, quote_number,
        client_name, client_email, client_phone, client_address,
        created_by, updated_by
      ) values (
        v_org_id, p_project_id, p_quote_number,
        nullif(btrim(coalesce(p_client_name, '')), ''),
        nullif(btrim(coalesce(p_client_email, '')), ''),
        p_client_phone, p_client_address,
        auth.uid(), auth.uid()
      )
      returning * into v_row;

      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint <> 'quotes_org_number_unique_idx' then
        raise; -- unrelated constraint violation — never swallowed
      end if;

      if v_manual then
        raise exception 'A quote numbered "%" already exists for your organisation. Choose a different number.', internal.normalize_quote_number(p_quote_number)
          using errcode = '23505';
      end if;

      v_attempts := v_attempts + 1;
      if v_attempts >= v_max_attempts then
        raise exception 'Could not allocate a quote number after % attempts — please try again.', v_max_attempts
          using errcode = '40001';
      end if;
    end;
  end loop;

  return v_row;
end;
$$;

comment on function public.create_quote is
  'Recommended client entry point for creating a Quote draft (header only — add line items separately against quote_line_items). Validates the caller and project, atomically allocates a canonical "QT-0001" number (or normalises/accepts a supplied manual override), inserts the row, and returns it.';

revoke all on function public.create_quote(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.create_quote(uuid, text, text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberately deferred):
--   - Issue workflow — 014.
--   - Reassignment/backfill of quote_number on UPDATE — INSERT-only, same
--     limitation as 011.
--   - Reclaiming/compacting numbers from abandoned drafts — gaps expected
--     and accepted, same as 011.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Local functional test plan (this migration ON TOP OF 012, before 014
-- exists):
--   1. create_quote() with p_quote_number omitted — confirm "QT-0001" on a
--      fresh organisation, sequential "QT-0002" on a second call.
--   2. Manual entry: "50", "qt-50", "QT 50" on separate drafts in a fresh
--      organisation — confirm all normalise to "QT-0050"; second/third
--      attempts raise the friendly duplicate error naming "QT-0050", not a
--      raw constraint violation. A genuinely custom reference (e.g.
--      "CLIENT-Q-9") stored unchanged.
--   3. Confirm a plain authenticated INSERT with quote_number left null
--      also gets auto-assigned (not just via create_quote()) — the trigger
--      protects both entry paths identically.
--   4. Concurrency: create quotes with a blank quote_number across
--      overlapping transactions in the same organisation — confirm no
--      collision, sequential assignment.
--   5. Cross-tenant project mismatch on create_quote() — confirm rejection,
--      and confirm no counter row was created/incremented for the doomed
--      attempt (assign_quote_number() returns early before touching the
--      counters table when the project/organisation check fails).
--   6. Cross-organisation: Org B's create_quote() call against an Org A
--      project id — confirm "Project not found in your organisation."
--   7. search_path / grant catalog checks: internal.quote_counters and
--      internal.format_quote_number have zero grants to any client role;
--      internal.normalize_quote_number has EXECUTE granted to authenticated
--      only (needed for create_quote()'s duplicate-error message) and nowhere
--      else.
-- ============================================================================
