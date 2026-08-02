-- ============================================================================
-- Migration: 016_create_progress_claim_numbering.sql
-- Purpose:   Server-side, concurrency-safe generation of
--            progress_claims.claim_number, plus create_progress_claim(),
--            the recommended transactional entry point for creating a
--            draft. Layer 2 of 3 for Progress Claims — depends on
--            015_create_progress_claims.sql (the table and its
--            pre-existing project-scoped uniqueness index,
--            progress_claims_org_project_number_unique_idx). Does not
--            touch issue workflow (017, BLOCKED).
--
--            DRAFT — NOT APPLIED to hpcqncghvdrlvufxfdnd.
--
--            Mirrors 013_create_quote_numbering.sql exactly, adapted to
--            claims' per-project scope (not per-organisation) — canonical
--            "PC-001" format. Unlike the pre-restructure combined draft,
--            this migration does NOT also derive previously_claimed_cents
--            — that moved to 015 (derive_progress_claim_previously_claimed())
--            since it is a calculation-ownership concern, not a numbering
--            one, and does not need the SECURITY DEFINER this migration's
--            own trigger genuinely requires (see 015's header comment,
--            decision 2, for the full reasoning).
-- Phase:     5a (Tool migration — Progress Claims, numbering layer)
-- Depends on: 015_create_progress_claims.sql,
--             005_phase1_rls.sql (internal.current_organisation_id())
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: internal.progress_claim_counters
-- One row per project. RLS enabled, zero policies, zero grants — reachable
-- only via the SECURITY DEFINER trigger below.
-- ----------------------------------------------------------------------------
create table if not exists internal.progress_claim_counters (
  project_id       uuid primary key references public.projects(id) on delete cascade,
  organisation_id  uuid not null references public.organisations(id) on delete restrict,
  next_number      integer not null default 1,
  updated_at       timestamptz not null default now()
);

comment on table internal.progress_claim_counters is
  'One row per project, tracking the next progress_claims.claim_number to assign. Internal bookkeeping only.';

alter table internal.progress_claim_counters enable row level security;
revoke all on internal.progress_claim_counters from public, anon, authenticated;

create or replace function internal.prevent_progress_claim_counter_decrease()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.next_number < old.next_number then
    raise exception 'progress_claim_counters.next_number cannot be decreased (was %, attempted %).', old.next_number, new.next_number
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace trigger progress_claim_counters_prevent_decrease
  before update on internal.progress_claim_counters
  for each row
  execute function internal.prevent_progress_claim_counter_decrease();

revoke all on function internal.prevent_progress_claim_counter_decrease() from public, anon, authenticated;

create or replace function internal.format_progress_claim_number(p_number bigint)
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

revoke all on function internal.format_progress_claim_number(bigint) from public, anon, authenticated;

create or replace function internal.normalize_progress_claim_number(p_input text)
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
  elsif v_upper ~ '^PC[- ]?[0-9]+$' then
    v_digits := regexp_replace(v_upper, '^PC[- ]?', '');
  else
    return v_trimmed;
  end if;

  return 'PC-' || internal.format_progress_claim_number(v_digits::bigint);
end;
$$;

revoke all on function internal.normalize_progress_claim_number(text) from public, anon, authenticated;
grant execute on function internal.normalize_progress_claim_number(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: assign_progress_claim_number
-- SECURITY DEFINER — required: authenticated has zero grant on
-- internal.progress_claim_counters. Independently re-validates project/
-- organisation consistency before touching the counters table — same
-- defensive posture as assign_quote_number() (013), not dependent on
-- trigger firing order or on enforce_progress_claim_project_same_
-- organisation() (015) having already run.
-- ----------------------------------------------------------------------------
create or replace function public.assign_progress_claim_number()
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
    return new;
  end if;

  if new.claim_number is not null and btrim(new.claim_number) <> '' then
    new.claim_number := internal.normalize_progress_claim_number(new.claim_number);
    return new;
  end if;

  loop
    insert into internal.progress_claim_counters (project_id, organisation_id, next_number)
    values (new.project_id, new.organisation_id, 1)
    on conflict (project_id) do update
      set next_number = internal.progress_claim_counters.next_number + 1,
          updated_at = now()
    returning next_number into v_next;

    v_candidate := 'PC-' || internal.format_progress_claim_number(v_next);

    exit when not exists (
      select 1 from public.progress_claims
      where project_id = new.project_id
        and claim_number = v_candidate
    );

    v_attempts := v_attempts + 1;
    if v_attempts >= v_max_attempts then
      raise exception 'Could not find a free claim number for this project after % attempts.', v_max_attempts
        using errcode = '40001';
    end if;
  end loop;

  new.claim_number := v_candidate;
  return new;
end;
$$;

comment on function public.assign_progress_claim_number() is
  'Atomically assigns the next free per-project claim_number in canonical "PC-NNN" form when the client leaves it blank; normalises a standard-equivalent manual entry. SECURITY DEFINER; independently re-validates project/organisation consistency. Does NOT derive previously_claimed_cents — see 015''s derive_progress_claim_previously_claimed(), a separate, non-DEFINER trigger.';

create or replace trigger progress_claims_assign_number
  before insert on public.progress_claims
  for each row
  execute function public.assign_progress_claim_number();

revoke all on function public.assign_progress_claim_number() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Function: create_progress_claim
-- Same shape and reasoning as create_quote() (013). Retry loop only ever
-- catches progress_claims_org_project_number_unique_idx specifically; any
-- other unique_violation is re-raised, never swallowed.
-- ----------------------------------------------------------------------------
create or replace function public.create_progress_claim(
  p_project_id      uuid,
  p_client_name     text default null,
  p_client_email    text default null,
  p_contract_ref    text default null,
  p_claim_number    text default null
)
returns public.progress_claims
language plpgsql
set search_path = ''
as $$
declare
  v_org_id        uuid;
  v_row           public.progress_claims;
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

  v_manual := p_claim_number is not null and btrim(p_claim_number) <> '';

  loop
    begin
      insert into public.progress_claims (
        organisation_id, project_id, claim_number,
        client_name, client_email, contract_ref,
        created_by, updated_by
      ) values (
        v_org_id, p_project_id, p_claim_number,
        nullif(btrim(coalesce(p_client_name, '')), ''),
        nullif(btrim(coalesce(p_client_email, '')), ''),
        p_contract_ref,
        auth.uid(), auth.uid()
      )
      returning * into v_row;

      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint <> 'progress_claims_org_project_number_unique_idx' then
        raise; -- unrelated constraint violation — never swallowed
      end if;

      if v_manual then
        raise exception 'A progress claim numbered "%" already exists for this project. Choose a different number.', internal.normalize_progress_claim_number(p_claim_number)
          using errcode = '23505';
      end if;

      v_attempts := v_attempts + 1;
      if v_attempts >= v_max_attempts then
        raise exception 'Could not allocate a claim number after % attempts — please try again.', v_max_attempts
          using errcode = '40001';
      end if;
    end;
  end loop;

  return v_row;
end;
$$;

comment on function public.create_progress_claim is
  'Recommended client entry point for creating a Progress Claim draft (header only — add schedule items separately against progress_claim_line_items).';

revoke all on function public.create_progress_claim(uuid, text, text, text, text) from public, anon;
grant execute on function public.create_progress_claim(uuid, text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberately deferred):
--   - Issue workflow — 017 (BLOCKED for real issuing).
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Local functional test plan (this migration ON TOP OF 015, before 017
-- exists):
--   1. create_progress_claim() with p_claim_number omitted — confirm
--      "PC-001" on a fresh project, "PC-002" on a second call on the same
--      project.
--   2. Manual entry normalisation ("3", "pc-3", "PC 3" → "PC-003");
--      duplicate manual entry raises the friendly error; a genuinely
--      custom reference stored unchanged.
--   3. Confirm previously_claimed_cents is still correctly derived as 0 by
--      015's trigger (unaffected by this migration existing or not).
--   4. Cross-tenant project mismatch and cross-organisation checks,
--      identical in shape to 013's tests.
--   5. search_path / grant catalog checks.
-- ============================================================================
