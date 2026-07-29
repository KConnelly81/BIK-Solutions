-- ============================================================================
-- Migration: 007_protect_last_owner.sql
-- Purpose:   Enforces one database invariant: every organisation whose
--            status is 'active' must have at least one profile that is
--            both role = 'owner' and status = 'active'. Implements the
--            protection deferred by ADR-009 when 005_phase1_rls.sql was
--            written (RLS authorises actors; it cannot express a stateful
--            "unless this is the last one" rule).
--
--            This must hold regardless of the caller: the ordinary
--            authenticated API, a future SECURITY DEFINER function,
--            service_role admin tooling, or direct SQL. RLS is not the
--            mechanism here — RLS can be bypassed by design (service_role,
--            function owners), and this invariant must not be bypassable
--            the same way. The mechanism is deferred CONSTRAINT TRIGGERs,
--            which fire regardless of RLS/BYPASSRLS status.
-- Phase:     1 (Foundation)
-- Depends on: 001_create_organisations.sql, 002_create_profiles.sql,
--             005_phase1_rls.sql (creates the `internal` schema, reused
--             here), 006_create_organisation_bootstrap.sql (must remain
--             compatible — see the bootstrap-compatibility notes below)
-- ============================================================================

create schema if not exists internal;

-- ----------------------------------------------------------------------------
-- internal.assert_organisation_has_active_owner(uuid)
-- The single source of truth for the invariant. Called from both trigger
-- functions below so there is exactly one place that defines "does this
-- organisation currently have an active owner."
--
-- Concurrency: acquires a per-organisation transaction-scoped advisory
-- lock BEFORE counting owners. See "Concurrency behaviour" in the
-- migration's accompanying explanation for why this is required — in
-- short, without it, two concurrent transactions each demoting a
-- different owner of the same two-owner organisation can each correctly
-- observe "the other owner is still active" (because neither transaction
-- can see the other's uncommitted work) and both commit, leaving zero
-- owners. The lock forces the second transaction to wait for the first to
-- fully commit, at which point its own re-check correctly sees the
-- updated state.
--
-- SECURITY DEFINER + search_path='': same reasoning as 005/006 — this
-- must see the true state of organisations/profiles regardless of the
-- calling role's RLS visibility, and must not be vulnerable to
-- search_path hijacking.
-- ----------------------------------------------------------------------------
create or replace function internal.assert_organisation_has_active_owner(p_organisation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_status  text;
  v_owner_count int;
begin
  -- Per-organisation lock. Reentrant within the same transaction (the two
  -- triggers below, or multiple row-firings of the same trigger, may
  -- acquire it more than once in one transaction without deadlocking
  -- themselves) and released automatically at transaction end.
  perform pg_advisory_xact_lock(hashtextextended('bik.last_owner_guard:' || p_organisation_id::text, 0));

  select status into v_org_status
  from public.organisations
  where id = p_organisation_id;

  -- Organisation no longer exists (e.g. deleted earlier in the same
  -- transaction, after its profiles were already removed — RESTRICT
  -- checks are satisfied at that point since no profiles rows remain) or
  -- is not 'active': the invariant does not apply. See "Organisation
  -- lifecycle scope" in the accompanying explanation for the full
  -- assessment of why this is scoped to 'active' only.
  if v_org_status is null or v_org_status <> 'active' then
    return;
  end if;

  select count(*) into v_owner_count
  from public.profiles
  where organisation_id = p_organisation_id
    and role = 'owner'
    and status = 'active';

  if v_owner_count = 0 then
    raise exception 'Organisation % must retain at least one active owner.', p_organisation_id
      using errcode = '23514'; -- check_violation
  end if;
end;
$$;

comment on function internal.assert_organisation_has_active_owner(uuid) is
  'Raises if the given organisation is active and has zero profiles with role=owner and status=active. Acquires a per-organisation advisory lock first to correctly serialise concurrent callers. Called only from the constraint triggers in this migration.';

revoke all on function internal.assert_organisation_has_active_owner(uuid) from public;
-- Deliberately no grant to authenticated: this is only ever invoked from
-- within the SECURITY DEFINER trigger functions below, which run as the
-- owning (migration) role and therefore already have implicit execute
-- rights on functions that same role owns. It is not, and should not be,
-- callable directly by any client role.

-- ----------------------------------------------------------------------------
-- Trigger function: profiles side
-- Covers: role change, status change (suspension), organisation transfer,
-- and deletion of a profile — i.e. every way a profiles row can stop
-- counting as "an active owner" of its organisation. Also runs on INSERT
-- as a defence-in-depth check (an insert can never by itself remove an
-- existing owner, but this keeps the invariant genuinely continuous
-- rather than "checked only on the operations we anticipated").
-- ----------------------------------------------------------------------------
create or replace function public.enforce_last_owner_on_profiles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform internal.assert_organisation_has_active_owner(old.organisation_id);
    return old;
  end if;

  -- INSERT or UPDATE: check the organisation this row now belongs to.
  perform internal.assert_organisation_has_active_owner(new.organisation_id);

  -- UPDATE that changed organisation_id (a "transfer"): also check the
  -- organisation the row is leaving, since that organisation may now be
  -- short an owner. In the ordinary authenticated API this path is
  -- already blocked by profiles_update_self_or_owner's WITH CHECK in 005
  -- (organisation_id cannot be changed to a different value via that
  -- policy at all) — this branch is the backstop for callers that bypass
  -- RLS entirely (service_role, direct SQL). It does not evaluate
  -- whether the destination organisation should accept this role; that
  -- is a separate, not-yet-designed concern (see ADR-011).
  if tg_op = 'UPDATE' and old.organisation_id is distinct from new.organisation_id then
    perform internal.assert_organisation_has_active_owner(old.organisation_id);
  end if;

  return new;
end;
$$;

comment on function public.enforce_last_owner_on_profiles() is
  'Constraint trigger function for profiles. Delegates to internal.assert_organisation_has_active_owner() for every INSERT/UPDATE/DELETE so no profiles mutation can leave an active organisation without an active owner.';

drop trigger if exists profiles_last_owner_guard on public.profiles;
create constraint trigger profiles_last_owner_guard
  after insert or update or delete on public.profiles
  deferrable initially deferred
  for each row
  execute function public.enforce_last_owner_on_profiles();

comment on trigger profiles_last_owner_guard on public.profiles is
  'DEFERRABLE INITIALLY DEFERRED: fires once per affected row, but only at transaction commit (or explicit SET CONSTRAINTS ... IMMEDIATE), after every statement in the transaction has already been applied. This is what makes multi-row updates and multi-statement transactions evaluate correctly against final state instead of partial, order-dependent progress — see the migration''s accompanying explanation.';

-- ----------------------------------------------------------------------------
-- Trigger function: organisations side
-- Covers the direction profiles-side triggers cannot see: an organisation
-- being created directly, or an organisation transitioning (back) to
-- 'active' status, without any profiles operation occurring in the same
-- transaction. Without this, a direct-SQL admin action that reactivates a
-- suspended, owner-less organisation would slip past the profiles-side
-- checks entirely, since no profiles row would be touched.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_last_owner_on_organisations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform internal.assert_organisation_has_active_owner(new.id);
  return new;
end;
$$;

comment on function public.enforce_last_owner_on_organisations() is
  'Constraint trigger function for organisations. Catches organisation creation or reactivation to active status that is not accompanied, in the same transaction, by an active owner profile.';

drop trigger if exists organisations_last_owner_guard on public.organisations;
create constraint trigger organisations_last_owner_guard
  after insert or update on public.organisations
  deferrable initially deferred
  for each row
  execute function public.enforce_last_owner_on_organisations();

comment on trigger organisations_last_owner_guard on public.organisations is
  'DEFERRABLE INITIALLY DEFERRED. Critical for bootstrap compatibility: an IMMEDIATE trigger here would check for an owner right after the organisations INSERT in 006, before that same transaction has inserted the owner profile, and would incorrectly reject every signup. Deferring to commit time means both inserts have completed before this check runs.';

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberately deferred, tracked elsewhere):
--   - Invitations, multi-organisation membership, role-management RPCs,
--     or any profile-deletion API — out of scope per ADR-011 and this
--     migration's brief. This migration only protects an invariant; it
--     does not add new ways to trigger the actions it protects against.
--   - Enforcing organisations.status elsewhere in RLS (e.g. blocking
--     ordinary member activity while an organisation is suspended) — see
--     "Organisation lifecycle scope" in the accompanying explanation.
--     Today, status = 'suspended' has no other enforced effect anywhere
--     in this schema; that is a Phase 2+ concern, not this migration's.
-- ----------------------------------------------------------------------------
