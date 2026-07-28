-- ============================================================================
-- Migration: 006_create_organisation_bootstrap.sql
-- Purpose:   Creates public.bootstrap_organisation() — the only path by
--            which a newly authenticated Supabase user can create their
--            first organisation and profile. 001-005 deliberately left no
--            INSERT policy on organisations or profiles for the
--            authenticated role (ADR-008); this function is that
--            controlled path, called once via RPC immediately after
--            signup:
--
--              Sign Up -> Supabase Auth -> bootstrap_organisation()
--                -> creates Organisation
--                -> creates Profile (role = owner)
--                -> returns { organisation_id, profile_id }
--
-- Phase:     1 (Foundation)
-- Depends on: 001_create_organisations.sql, 002_create_profiles.sql
-- ============================================================================

create or replace function public.bootstrap_organisation(
  p_organisation_name    text,
  p_full_name            text,
  p_organisation_abn     text default null,
  p_phone                text default null,
  p_job_title            text default null
)
returns table (organisation_id uuid, profile_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id         uuid;
  v_org_id          uuid;
  v_org_name        text;
  v_full_name       text;
  v_org_abn         text;
  v_phone           text;
  v_job_title       text;
  v_email           text;
  v_constraint_name text;
begin
  -- ---------------------------------------------------------------------
  -- 1. Caller must be an authenticated Supabase user. auth.uid() is read
  --    from the request's verified JWT — it is never a function
  --    parameter, so it cannot be supplied or spoofed by the caller.
  -- ---------------------------------------------------------------------
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.'
      using errcode = '28000'; -- invalid_authorization_specification
  end if;

  -- ---------------------------------------------------------------------
  -- 2. Normalise and validate required input. Rejects null AND
  --    whitespace-only values — a client sending "   " as a name should
  --    not produce a technically-not-null but practically-blank row.
  -- ---------------------------------------------------------------------
  v_org_name  := btrim(p_organisation_name);
  v_full_name := btrim(p_full_name);
  v_org_abn   := nullif(btrim(p_organisation_abn), '');
  v_phone     := nullif(btrim(p_phone), '');
  v_job_title := nullif(btrim(p_job_title), '');

  if v_org_name is null or v_org_name = '' then
    raise exception 'Organisation name is required.'
      using errcode = '22023'; -- invalid_parameter_value
  end if;

  if v_full_name is null or v_full_name = '' then
    raise exception 'Full name is required.'
      using errcode = '22023';
  end if;

  -- Pre-validate ABN format ourselves (same rule as
  -- organisations_abn_format_check in 001) so a bad value produces our
  -- own clean error instead of a raw table constraint-violation message
  -- that would name the constraint/table to the caller.
  if v_org_abn is not null and v_org_abn !~ '^[0-9]{11}$' then
    raise exception 'Organisation ABN must be 11 digits.'
      using errcode = '22023';
  end if;

  -- Email is taken from the caller's own verified JWT claim, never from a
  -- function parameter. auth.jwt() reads claims already embedded in the
  -- current request's token, so this does not require querying
  -- auth.users directly. Kept explicitly non-authoritative in profiles
  -- (see 002's column comment) — this is a display copy only.
  v_email := nullif(btrim(auth.jwt() ->> 'email'), '');

  -- ---------------------------------------------------------------------
  -- 3. Concurrency guard. See "Concurrency and duplicate calls" in the
  --    accompanying explanation for the full reasoning — in short: an
  --    advisory lock scoped to this specific user serialises any
  --    near-simultaneous bootstrap calls from the same account (e.g. a
  --    double-click, two open tabs) so the "does a profile already
  --    exist" check below is atomic with respect to that user, without
  --    taking a platform-wide lock that would serialise unrelated
  --    signups against each other. The lock is transaction-scoped and
  --    releases automatically on commit or rollback.
  -- ---------------------------------------------------------------------
  perform pg_advisory_xact_lock(hashtextextended('bik.bootstrap_organisation:' || v_user_id::text, 0));

  if exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'A profile already exists for this account.'
      using errcode = '23505'; -- unique_violation
  end if;

  -- ---------------------------------------------------------------------
  -- 4. Create the organisation and the caller's profile. Both inserts
  --    run inside this function's single transaction — if either fails,
  --    the whole call rolls back and neither row remains. Every audit
  --    field uses v_user_id (= auth.uid()); none are accepted as input.
  --    Role is hard-coded to 'owner' — it is not, and cannot be, a
  --    parameter.
  -- ---------------------------------------------------------------------
  begin
    insert into public.organisations (name, abn, created_by, updated_by)
    values (v_org_name, v_org_abn, v_user_id, v_user_id)
    returning id into v_org_id;

    insert into public.profiles (id, organisation_id, full_name, email, phone, job_title, role, created_by, updated_by)
    values (v_user_id, v_org_id, v_full_name, v_email, v_phone, v_job_title, 'owner', v_user_id, v_user_id);
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;
      if v_constraint_name = 'organisations_abn_unique_idx' then
        raise exception 'An organisation with this ABN is already registered.'
          using errcode = '23505';
      end if;
      -- Any other uniqueness conflict here (e.g. a profiles primary-key
      -- race the advisory lock above should already have excluded) is
      -- surfaced generically rather than naming the constraint/table.
      raise exception 'Unable to complete signup. Please try again.'
        using errcode = '23505';
  end;

  return query select v_org_id, v_user_id;
end;
$$;

comment on function public.bootstrap_organisation(text, text, text, text, text) is
  'The only path by which a newly authenticated user creates their first organisation and profile (role=owner). SECURITY DEFINER, callable only by authenticated. Accepts no id, role, or status values from the caller — every identity and privilege field is derived server-side from auth.uid()/auth.jwt().';

-- ----------------------------------------------------------------------------
-- Privilege model: revoke the default PUBLIC execute grant Postgres adds
-- to every new function, then grant execute to authenticated only.
-- Deliberately not granted to anon: an unauthenticated caller would fail
-- the auth.uid() check anyway, but least-privilege means it should not be
-- callable at all, not merely fail once called.
-- ----------------------------------------------------------------------------
revoke all on function public.bootstrap_organisation(text, text, text, text, text) from public;
grant execute on function public.bootstrap_organisation(text, text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberately deferred, tracked elsewhere):
--   - Last-owner demotion/deletion protection (ADR-009) — not required for
--     bootstrap itself (a brand-new organisation has exactly one owner by
--     construction) and kept as its own reviewed migration, 007.
--   - "Invite a teammate" flow — a second profile in an existing
--     organisation is a different, not-yet-designed operation; this
--     function only ever creates a brand-new organisation plus its first
--     (owner) profile.
--   - Re-syncing profiles.email if the user changes their email in
--     Supabase Auth after signup — out of scope for a one-time bootstrap.
-- ----------------------------------------------------------------------------
