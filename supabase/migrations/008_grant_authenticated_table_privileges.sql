-- ============================================================================
-- Migration: 008_grant_authenticated_table_privileges.sql
-- Purpose:   Grants the baseline PostgreSQL table-level privileges that
--            005_phase1_rls.sql's policies assume already exist, and that
--            001-004's design comments assumed Supabase's standard project
--            provisioning would supply automatically. Live validation
--            (Phase 1 deployment runbook, Stage 2) against
--            hpcqncghvdrlvufxfdnd found that assumption does not hold on
--            this project: information_schema.role_table_grants shows
--            `authenticated` holding only REFERENCES/TRIGGER/TRUNCATE on
--            organisations/profiles/customers/projects -- no SELECT,
--            INSERT, or UPDATE. PostgreSQL checks table-level GRANTs
--            before RLS is ever evaluated, so every ordinary authenticated
--            request against these four tables currently fails with
--            "permission denied for table ...", not the RLS-filtered
--            result the policies in 005 were designed to produce.
--
--            This migration closes that gap, and only that gap. It grants
--            no privilege that isn't already gated by an existing RLS
--            policy from 005 -- it makes the policies reachable, it does
--            not change what they allow. DELETE is deliberately never
--            granted to authenticated (ADR-010: archive/soft-delete, no
--            authenticated-facing hard delete on any Phase 1 table).
--            `anon` is untouched -- it correctly has zero legitimate
--            access to any of these tables (every 005 policy is scoped
--            `to authenticated` only), and already has no DML grants
--            today; this migration does not change that.
--
-- Phase:     1 (Foundation) -- deployment-defect correction, not a schema
--            redesign. Discovered during Stage 2 of
--            docs/PHASE_1_DEPLOYMENT_RUNBOOK.md's live validation against
--            hpcqncghvdrlvufxfdnd, before any application/frontend work
--            began. See docs/PHASE_1_DATABASE_REVIEW.md finding C2 and
--            ADR-014 for the full analysis and rationale.
-- Depends on: 001_create_organisations.sql, 002_create_profiles.sql,
--             003_create_customers.sql, 004_create_projects.sql,
--             005_phase1_rls.sql (the RLS policies this migration makes
--             reachable -- unchanged by this migration)
-- ============================================================================

-- organisations: read own org; owner-only UPDATE is enforced by
-- organisations_update_owner_only (005), not by this grant -- this grant
-- only gets an authenticated UPDATE statement as far as RLS evaluation.
-- No INSERT: organisations are created only via bootstrap_organisation()
-- (006, SECURITY DEFINER), never by an ordinary authenticated INSERT --
-- there is no INSERT policy in 005 for authenticated to reach, so granting
-- table-level INSERT here would be a no-op at best and a confusing
-- inconsistency at worst. Not granted.
grant select, update on public.organisations to authenticated;

-- profiles: read all profiles in own org; UPDATE gated by
-- profiles_update_self_or_owner (005) plus the
-- prevent_unauthorised_profile_role_change trigger. No INSERT, same
-- reasoning as organisations -- profiles are created only by
-- bootstrap_organisation() (006); no INSERT policy exists for
-- authenticated to reach.
grant select, update on public.profiles to authenticated;

-- customers: full operational CRUD (minus hard delete) within own org,
-- exactly matching customers_select_same_org / customers_insert_same_org /
-- customers_update_same_org (005).
grant select, insert, update on public.customers to authenticated;

-- projects: same shape as customers, matching projects_select_same_org /
-- projects_insert_same_org / projects_update_same_org (005).
grant select, insert, update on public.projects to authenticated;

-- ----------------------------------------------------------------------------
-- Deliberately not in this migration:
--   - DELETE on any table, for authenticated -- ADR-010 (soft delete via
--     status = 'archived'); no DELETE policy exists in 005 for any of
--     these tables regardless, so granting table-level DELETE would do
--     nothing except leave a wider grant than the RLS layer supports.
--   - Anything for `anon` -- no policy in 005 is reachable by anon; anon's
--     current lack of table grants is correct and is left unchanged.
--   - Sequence privileges -- confirmed via pg_class (relkind = 'S') that
--     no sequences exist anywhere in the public schema. Every primary key
--     across 001-004 is `uuid default gen_random_uuid()`, not a
--     SERIAL/IDENTITY column, so there is nothing to grant USAGE on.
--   - Any change to 001-007 -- this migration is purely additive (GRANT
--     statements only) and does not alter any table, function, trigger,
--     or policy created by an earlier migration.
-- ----------------------------------------------------------------------------
