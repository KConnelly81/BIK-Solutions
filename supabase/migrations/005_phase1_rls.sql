-- ============================================================================
-- Migration: 005_phase1_rls.sql
-- Purpose:   Row Level Security policies for organisations, profiles,
--            customers, and projects. This is the migration that actually
--            enforces multi-tenant isolation — 001-004 enabled RLS with no
--            policies (fully locked). This migration is the only thing that
--            opens any access at all.
--
--            Core assumption: every API request is potentially malicious.
--            Organisation membership is never taken from a value the client
--            supplies (a header, a query param, a JWT claim we don't
--            control) — it is always derived server-side, per request, by
--            looking up the authenticated user's own profiles row.
--
--            Suspension semantics: a user has usable organisation context
--            — and therefore any access at all under these policies — only
--            when BOTH their own profile and their organisation are
--            status = 'active'. This is enforced once, inside
--            internal.current_organisation_id()/current_role(), and every
--            policy below inherits it automatically by using those
--            functions rather than checking status per-policy. See those
--            functions' comments for the full consequence analysis.
--
--            Rerunnability: every object created or modified in this
--            migration (the internal schema and its grants, all four
--            helper functions, all ten policies, the self-escalation
--            trigger and its function) uses CREATE OR REPLACE, DROP ... IF
--            EXISTS, or otherwise idempotent GRANT/REVOKE statements, so
--            this migration is safely rerunnable in the intended clean
--            development workflow. This is stated because it was not true
--            of an earlier version of this file (the ten CREATE POLICY
--            statements had no DROP POLICY IF EXISTS guard) — see
--            docs/PHASE_1_DATABASE_REVIEW.md finding M1.
-- Phase:     1 (Foundation)
-- Depends on: 001_create_organisations.sql, 002_create_profiles.sql,
--             003_create_customers.sql, 004_create_projects.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Schema: internal
-- Helper functions live outside `public` so they are never exposed as
-- callable RPC endpoints by Supabase's auto-generated Data API (which only
-- exposes `public`, or schemas explicitly opted in). They are policy
-- plumbing, not part of the application's API surface.
-- ----------------------------------------------------------------------------
create schema if not exists internal;

-- ----------------------------------------------------------------------------
-- Schema privileges for `internal`.
--
-- Explicitly reviewed and set rather than left to PostgreSQL's defaults.
-- USAGE on a schema is required to resolve ANY reference into it —
-- including a fully-qualified call like `internal.current_organisation_id()`
-- inside an RLS policy — independently of EXECUTE on the function itself.
-- CREATE SCHEMA grants nothing to PUBLIC for a non-`public`-named schema by
-- default, but this migration does not rely on that default holding true:
-- the posture below is stated outright.
--
--   - `authenticated` gets USAGE only (never CREATE) — enough to resolve
--     the specific functions granted EXECUTE below, nothing more. It
--     cannot create objects inside `internal`.
--   - `anon` gets nothing. No policy in this migration is reachable by
--     `anon` regardless (every policy is scoped `to authenticated`), so
--     `anon` has no legitimate reason to resolve anything in this schema.
--   - PUBLIC retains nothing. The explicit REVOKE below removes any
--     doubt about relying on the (correct, but unstated-until-now)
--     default.
-- ----------------------------------------------------------------------------
revoke all on schema internal from public;
revoke all on schema internal from anon;
grant usage on schema internal to authenticated;

-- ----------------------------------------------------------------------------
-- internal.current_organisation_id()
-- Returns the calling user's organisation_id, derived from their own
-- profiles row — never from anything the client asserts.
--
-- Enforces Phase 1 suspension semantics: a user has usable organisation
-- context only when BOTH their own profile AND their organisation are
-- `status = 'active'`. If either is suspended, this returns NULL, and
-- every tenant-isolation policy that keys off it (which is all of them)
-- then fails closed — a suspended profile, or any member of a suspended
-- organisation (including its owner), loses all access through the
-- ordinary API, not just write access. See the migration's accompanying
-- explanation ("Suspension semantics") for the full consequence analysis,
-- including that an owner cannot reactivate their own suspended
-- organisation through this same path — that is intentional, not an
-- oversight, and recovery is documented as a separate, controlled action.
--
-- SECURITY DEFINER: runs with the function owner's privileges, bypassing
-- RLS on profiles/organisations for this one lookup. This is required,
-- not just convenient — without it, every policy that calls this function
-- would itself trigger a profiles RLS check, and while today's profiles
-- SELECT policy (self-row via id = auth.uid()) happens not to recurse,
-- that is a fragile guarantee to depend on as policies evolve. DEFINER
-- removes the ambiguity entirely.
-- SET search_path = '': prevents search_path hijacking — every identifier
-- below is schema-qualified, so this function cannot be tricked into
-- resolving `profiles`/`organisations` to an attacker-created object in
-- another schema.
-- STABLE: same result for the same session within one statement, so
-- Postgres can evaluate it once per statement rather than once per row
-- (see the `(select internal.current_organisation_id())` wrapping used in
-- every policy below — this is the documented Supabase RLS performance
-- pattern that turns the call into a cached InitPlan).
-- ----------------------------------------------------------------------------
create or replace function internal.current_organisation_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select p.organisation_id
  from public.profiles p
  join public.organisations o on o.id = p.organisation_id
  where p.id = auth.uid()
    and p.status = 'active'
    and o.status = 'active';
$$;

comment on function internal.current_organisation_id() is
  'Returns the authenticated caller''s organisation_id, but only when both the caller''s profile and their organisation are status=active; NULL otherwise (this is what enforces suspension across every tenant-isolation policy). SECURITY DEFINER to bypass RLS for this lookup only. Used by every tenant-isolation policy.';

-- ----------------------------------------------------------------------------
-- internal.current_role()
-- Same reasoning and same active-profile/active-organisation filter as
-- current_organisation_id() above. Returns the caller's Phase 1 role
-- (owner/admin/member), or NULL if they have no profiles row yet, or if
-- either their profile or their organisation is suspended.
-- ----------------------------------------------------------------------------
create or replace function internal.current_role()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select p.role
  from public.profiles p
  join public.organisations o on o.id = p.organisation_id
  where p.id = auth.uid()
    and p.status = 'active'
    and o.status = 'active';
$$;

comment on function internal.current_role() is
  'Returns the authenticated caller''s role (owner/admin/member), but only when both the caller''s profile and their organisation are status=active; NULL otherwise. SECURITY DEFINER to bypass RLS for this lookup only.';

-- ----------------------------------------------------------------------------
-- internal.is_owner() / internal.is_admin()
-- Thin wrappers, kept as SECURITY INVOKER (the default) because they only
-- call the DEFINER functions above and compare text — they touch no table
-- directly, so there is nothing to bypass.
--
-- is_admin() intentionally returns true for BOTH 'admin' and 'owner': the
-- Phase 1 role model treats owner as a superset of admin ("full access"
-- includes everything admin can do), so any policy gated on "can manage
-- operational data" should admit owners too, not just admins.
-- ----------------------------------------------------------------------------
create or replace function internal.is_owner()
returns boolean
language sql
stable
as $$
  select internal.current_role() = 'owner';
$$;

create or replace function internal.is_admin()
returns boolean
language sql
stable
as $$
  select internal.current_role() in ('owner', 'admin');
$$;

comment on function internal.is_owner() is
  'True only for role = owner, and only when the caller''s profile and organisation are both active (inherited from current_role()). Gates organisation-administration actions.';
comment on function internal.is_admin() is
  'True for role = admin OR owner (owner is a superset of admin), and only when the caller''s profile and organisation are both active (inherited from current_role()). Not currently referenced by any Phase 1 policy (ADR-010 removed the customers/projects DELETE policies that used it) — kept as reusable infrastructure for future admin-gated operational actions.';

-- Least-privilege execute grants: only the authenticated role may call
-- these, and only via policy evaluation — anon gets nothing, and no role
-- can call them through the Data API since they live outside `public`.
revoke all on function internal.current_organisation_id() from public;
revoke all on function internal.current_role()            from public;
revoke all on function internal.is_owner()                 from public;
revoke all on function internal.is_admin()                 from public;
grant execute on function internal.current_organisation_id() to authenticated;
grant execute on function internal.current_role()            to authenticated;
grant execute on function internal.is_owner()                 to authenticated;
grant execute on function internal.is_admin()                 to authenticated;

-- ============================================================================
-- organisations
-- ============================================================================

-- SELECT: a member may read their own organisation's row only.
-- Allows: any authenticated member of that org (any role).
-- Blocks: every other organisation's members; anonymous requests (no
--         "to authenticated" match for the anon role at all).
drop policy if exists organisations_select_own on public.organisations;
create policy organisations_select_own
  on public.organisations
  for select
  to authenticated
  using (id = (select internal.current_organisation_id()));

-- UPDATE: only an owner may change their organisation's settings (name,
-- ABN, licence number, status, etc.).
-- Allows: owner, own organisation only.
-- Blocks: admin and member (organisation settings are administration, not
--         operational data); every other organisation.
drop policy if exists organisations_update_owner_only on public.organisations;
create policy organisations_update_owner_only
  on public.organisations
  for update
  to authenticated
  using (id = (select internal.current_organisation_id()) and (select internal.is_owner()))
  with check (id = (select internal.current_organisation_id()) and (select internal.is_owner()));

-- No INSERT policy: organisations are created only via the future
-- bootstrap RPC (a SECURITY DEFINER function, generated separately per
-- ADR-008), which bypasses RLS as the function owner. Ordinary
-- authenticated users cannot self-insert an organisation through the
-- client API — this is deliberate, not an oversight.
--
-- No DELETE policy: organisation deletion is not exposed to any client
-- role in Phase 1, including owner. It is a high-blast-radius operation
-- (every RESTRICT foreign key in 002-004 already blocks it while any
-- profile/customer/project exists) best handled through a controlled,
-- support-level process later, not ordinary RLS.

-- ============================================================================
-- profiles
-- ============================================================================

-- SELECT: any member of an organisation may see every profile in that same
-- organisation (needed for a team/member list).
-- Allows: owner, admin, member — any role, own organisation's profiles.
-- Blocks: profiles belonging to any other organisation.
drop policy if exists profiles_select_same_org on public.profiles;
create policy profiles_select_same_org
  on public.profiles
  for select
  to authenticated
  using (organisation_id = (select internal.current_organisation_id()));

-- UPDATE: a user may always update their own row (name, phone, job title).
-- An owner may additionally update any profile within their own
-- organisation (e.g. changing another member's role or status).
-- Allows: self-update (any role, own row); owner (any row in own org).
-- Blocks: admin/member updating someone else's row; any cross-organisation
--         update.
--
-- Security note: this policy alone would let a member overwrite their own
-- `role` or `organisation_id` column in the same statement that updates
-- their name. That is closed by the
-- profiles_prevent_unauthorised_role_change trigger below, not by RLS —
-- RLS decides *which rows* a statement may touch, not *which columns*
-- within an allowed row, so the column-level restriction is enforced
-- separately and cannot be bypassed by any client that has UPDATE access
-- at all.
drop policy if exists profiles_update_self_or_owner on public.profiles;
create policy profiles_update_self_or_owner
  on public.profiles
  for update
  to authenticated
  using (
    id = auth.uid()
    or (organisation_id = (select internal.current_organisation_id()) and (select internal.is_owner()))
  )
  with check (
    organisation_id = (select internal.current_organisation_id())
  );

-- No INSERT policy: profiles are created only via the future bootstrap RPC
-- (new signup) or a future "invite teammate" flow — neither exists yet.
-- Ordinary authenticated users cannot self-insert a profiles row.
--
-- No DELETE policy: removing a member is handled by setting
-- profiles.status = 'suspended' (covered by the UPDATE policy above, owner
-- only), not by deleting the row. The row is only ever removed if the
-- underlying auth.users row is deleted (cascades — an Auth-admin action,
-- outside RLS entirely).

-- ----------------------------------------------------------------------------
-- Trigger: prevent unauthorised role/status/organisation changes on profiles
-- Defence-in-depth alongside profiles_update_self_or_owner above: even
-- though that policy allows a member to update their own row, this trigger
-- independently blocks any change to `role`, `status`, or `organisation_id`
-- unless the acting user is an owner. This closes two self-service paths at
-- the database layer, not just via application-level form validation:
--   - self-escalation ("member edits their own row and sets role = 'owner'")
--   - self-reversal of a suspension ("a member an owner suspended sets
--     their own status back to 'active'", or conversely "a member
--     suspends themselves to manipulate lifecycle/last-owner behaviour")
-- `status` was added to this trigger's condition after the Phase 1
-- database review identified that suspension had no protection: the
-- original version of this trigger covered only role/organisation_id, so
-- any user — including one an owner had just suspended — could reverse
-- their own status unilaterally. See docs/PHASE_1_DATABASE_REVIEW.md
-- (finding H1) and the "Suspension semantics" section of the migration's
-- accompanying explanation for the full analysis.
--
-- This is a related but distinct guard from ADR-009 (preventing the LAST
-- owner of an organisation from being demoted or deleted). This trigger
-- stops unauthorised escalation and unauthorised suspension changes; it
-- does not stop an owner from legitimately demoting or suspending the
-- organisation's only remaining owner — that invariant is enforced
-- separately, at the database layer, by 007_protect_last_owner.sql. An
-- owner performing a status/role change this trigger allows can still be
-- rejected by that separate protection.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_unauthorised_profile_role_change()
returns trigger
language plpgsql
as $$
begin
  if (new.role is distinct from old.role
      or new.organisation_id is distinct from old.organisation_id
      or new.status is distinct from old.status)
     and not internal.is_owner() then
    raise exception 'Only an organisation owner may change a member''s role, status, or organisation.';
  end if;
  return new;
end;
$$;

comment on function public.prevent_unauthorised_profile_role_change() is
  'Blocks any change to profiles.role, profiles.status, or profiles.organisation_id unless the acting user is an owner. Defence-in-depth against self-escalation and self-reversal of suspension, independent of RLS. Does not implement last-owner protection (ADR-009/007) — that is a separate, additional guard.';

create or replace trigger profiles_prevent_unauthorised_role_change
  before update on public.profiles
  for each row
  execute function public.prevent_unauthorised_profile_role_change();

-- ============================================================================
-- customers
-- Operational data: any org member (owner/admin/member) may read, create,
-- and update, within their own organisation.
--
-- No DELETE policy exists for any role, including owner — per ADR-010
-- (platform-wide soft delete strategy), customers are normally archived,
-- not deleted. Routine "removal" is the existing customers_update_same_org
-- policy setting status = 'archived', already available to any org member.
-- Physical row deletion is reserved for GDPR/Privacy Act erasure, test-data
-- cleanup, and administrator maintenance, performed via service_role
-- (which bypasses RLS entirely) — never through a policy granted to
-- authenticated.
-- ============================================================================

-- Allows: any role, own organisation's customers. Blocks: any other
-- organisation's customers.
drop policy if exists customers_select_same_org on public.customers;
create policy customers_select_same_org
  on public.customers
  for select
  to authenticated
  using (organisation_id = (select internal.current_organisation_id()));

-- Allows: any role, may only create customers inside their own
-- organisation (the WITH CHECK — not the client-supplied organisation_id
-- alone — is what actually enforces this; a forged organisation_id in the
-- request body is rejected here regardless of what the client sends).
drop policy if exists customers_insert_same_org on public.customers;
create policy customers_insert_same_org
  on public.customers
  for insert
  to authenticated
  with check (organisation_id = (select internal.current_organisation_id()));

-- Allows: any role, may update customers within their own organisation.
-- Blocks: moving a customer to a different organisation (WITH CHECK
-- re-validates the same-org condition on the row as written).
drop policy if exists customers_update_same_org on public.customers;
create policy customers_update_same_org
  on public.customers
  for update
  to authenticated
  using (organisation_id = (select internal.current_organisation_id()))
  with check (organisation_id = (select internal.current_organisation_id()));

-- ============================================================================
-- projects
-- Same shape as customers: full read/create/update for any org member,
-- within their own organisation. Projects being the primary business
-- object (004) makes this isolation the highest-stakes of the four
-- tables — every future module inherits this same organisation_id
-- boundary via its own project_id foreign key.
--
-- No DELETE policy exists for any role, including owner — per ADR-010,
-- projects are never physically deleted through any client-facing path.
-- Routine "removal" is the existing projects_update_same_org policy
-- setting status = 'archived', already available to any org member.
-- Physical row deletion follows the same service_role-only path as
-- customers above.
-- ============================================================================

drop policy if exists projects_select_same_org on public.projects;
create policy projects_select_same_org
  on public.projects
  for select
  to authenticated
  using (organisation_id = (select internal.current_organisation_id()));

drop policy if exists projects_insert_same_org on public.projects;
create policy projects_insert_same_org
  on public.projects
  for insert
  to authenticated
  with check (organisation_id = (select internal.current_organisation_id()));

drop policy if exists projects_update_same_org on public.projects;
create policy projects_update_same_org
  on public.projects
  for update
  to authenticated
  using (organisation_id = (select internal.current_organisation_id()))
  with check (organisation_id = (select internal.current_organisation_id()));

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberately deferred, tracked elsewhere):
--   - Bootstrap RPC for new signups (ADR-008) — organisations and profiles
--     currently have no INSERT path for ordinary authenticated users at
--     all, by design, until that RPC exists.
--   - Last-owner demotion/deletion protection (ADR-009) — the
--     self-escalation trigger above is a related but separate guard.
--   - "Invite a teammate" flow — profiles has no INSERT policy for this
--     yet; adding a member currently requires the (not-yet-built)
--     bootstrap-style RPC pattern.
--   - Hard-delete path for customers/projects (ADR-010) — no policy in
--     this migration grants DELETE to authenticated for either table, on
--     any role. Physical row removal is a service_role/admin-tooling
--     concern, not part of the client-facing API.
--   - Suspended-organisation reactivation RPC. Once an organisation is
--     suspended, internal.current_organisation_id()/current_role() return
--     NULL for every one of its members, including its owner — so
--     organisations_update_owner_only cannot be used to reactivate it
--     (its USING clause depends on the same now-NULL function). This is
--     intentional: a suspended organisation should not be reactivatable
--     through the ordinary tenant-scoped client API. Recovery is
--     documented as a required future capability — either a dedicated,
--     carefully reviewed SECURITY DEFINER recovery RPC, or service_role
--     administration — but is deliberately not built here. See
--     docs/PHASE_1_DATABASE_REVIEW.md and ADR-013 for the full rationale.
-- ----------------------------------------------------------------------------
