-- ============================================================================
-- Migration: 009_revoke_dangerous_table_privileges.sql
-- Purpose:   Revokes MAINTAIN, REFERENCES, TRIGGER, and TRUNCATE from
--            `anon` and `authenticated` on all four Phase 1 tables
--            (organisations/profiles/customers/projects), and corrects the
--            default privileges so future tables created by the `postgres`
--            role in `public` do not automatically inherit the same set.
--
-- Root cause: NOT introduced by any BIK migration (001-008 never issue
--            ALTER DEFAULT PRIVILEGES or grant/revoke anything on these
--            four privilege types). Confirmed via pg_default_acl: this
--            project's `public` schema carries a pre-existing default ACL
--            for role `postgres` --
--              anon=Dxtm/postgres, authenticated=Dxtm/postgres,
--              service_role=Dxtm/postgres
--            (D=TRUNCATE, x=REFERENCES, t=TRIGGER, m=MAINTAIN) -- set at
--            project provisioning, before any Phase 1 migration ran.
--            Every table `postgres` creates in `public` (i.e. every BIK
--            table to date, all four created via this exact role) picks
--            this up automatically at CREATE TABLE time. `anon`/
--            `authenticated` never had SELECT/INSERT/UPDATE/DELETE by
--            default (arwd) -- only 008's explicit grants supplied those,
--            scoped exactly to what 005's RLS policies assume.
--
--            TRUNCATE is the one with a real, confirmed exploit path:
--            PostgreSQL's row-level security does not apply to TRUNCATE at
--            all -- no per-row filtering of any kind, gated solely by the
--            table-level TRUNCATE privilege. A role holding it can empty
--            an entire table in one statement regardless of any RLS
--            policy. Confirmed live and rolled back, no data lost:
--              begin;
--              set local role anon;
--              truncate public.projects;   -- succeeded, no permission error
--              rollback;
--            (`organisations`/`customers` could not be isolated the same
--            way in a single statement -- Postgres blocked it with
--            "cannot truncate a table referenced in a foreign key
--            constraint", not a privilege error -- confirming the grant
--            itself, not FK ordering, is what stands between `anon` and
--            wiping every Phase 1 table via `TRUNCATE ... CASCADE` or by
--            truncating all four together.)
--
--            REFERENCES/TRIGGER/MAINTAIN are not reachable through
--            Supabase's standard PostgREST Data API today (it never issues
--            DDL as `anon`/`authenticated`, and no BIK frontend code exists
--            yet -- confirmed by repository search, only a Phase 2 comment
--            placeholder in js/integrations/core/auth-manager.js, no
--            Supabase client wiring). Revoked anyway: this schema's stated
--            model (001/005/006/007) is deny-by-default with only named
--            grants added back, and neither client role has any
--            legitimate use for creating triggers, referencing FKs, or
--            running maintenance commands (VACUUM/ANALYZE/CLUSTER/REINDEX/
--            REFRESH MATERIALIZED VIEW -- MAINTAIN's scope) against these
--            tables. Left in place, any one of the three becomes a silent
--            widening of the trust boundary the day a future code path
--            makes DDL/maintenance commands reachable under these roles.
--
--            `PUBLIC` itself: confirmed via pg_class.relacl / aclexplode
--            that no ACL entry is granted directly to the PUBLIC
--            pseudo-role on any of the four tables today. The explicit
--            `revoke all ... from public` statements below are therefore
--            currently no-ops -- included anyway, matching the
--            revoke-then-grant pattern already used throughout 001-007,
--            so a future reader auditing grants sees the boundary stated
--            explicitly rather than assumed.
--
--            `service_role` is deliberately NOT touched by this migration
--            (see "Deliberately not in this migration" below) -- it
--            currently holds the identical Dxtm/postgres default (MAINTAIN/
--            REFERENCES/TRIGGER/TRUNCATE, no SELECT/INSERT/UPDATE/DELETE),
--            which is a separate, related gap: any future service-role
--            code (an Edge Function, a scheduled job) would hit the same
--            "permission denied" symptom as C2 did for `authenticated`,
--            despite service_role's BYPASSRLS attribute -- BYPASSRLS only
--            skips RLS policy evaluation, it does not substitute for the
--            underlying table-level GRANT check. Flagged for a separate,
--            deliberate decision (what service_role should be granted, if
--            anything, once a concrete use exists) rather than folded into
--            this correction silently.
--
-- Phase:     1 (Foundation) -- deployment-defect correction, not a schema
--            redesign. Discovered during the deployment runbook's Stage 1
--            static inspection (re-run after 008), against
--            hpcqncghvdrlvufxfdnd, before Stage 5 onward or any frontend
--            work began. See docs/PHASE_1_DATABASE_REVIEW.md finding C3
--            and ADR-015 for the full analysis, privilege matrix, and
--            rationale.
-- Depends on: 001_create_organisations.sql, 002_create_profiles.sql,
--             003_create_customers.sql, 004_create_projects.sql,
--             008_grant_authenticated_table_privileges.sql (this migration
--             leaves 008's SELECT/INSERT/UPDATE grants untouched)
-- Applied to hpcqncghvdrlvufxfdnd 2026-07-29, approved and verified --
-- see docs/PHASE_1_DATABASE_REVIEW.md finding C3 and ADR-015 for the
-- verification results.
-- ============================================================================

-- Explicit statement of the PUBLIC boundary (currently a no-op -- see note
-- above -- kept for auditability alongside the anon/authenticated revokes).
revoke all on public.organisations from public;
revoke all on public.profiles     from public;
revoke all on public.customers    from public;
revoke all on public.projects     from public;

-- anon: bring to zero privileges on all four tables. Prior to this,
-- anon held exactly MAINTAIN, REFERENCES, TRIGGER, TRUNCATE (no
-- SELECT/INSERT/UPDATE/DELETE, and never has) -- revoking these four
-- privilege types leaves anon with nothing on any Phase 1 table.
revoke maintain, references, trigger, truncate on public.organisations from anon;
revoke maintain, references, trigger, truncate on public.profiles     from anon;
revoke maintain, references, trigger, truncate on public.customers    from anon;
revoke maintain, references, trigger, truncate on public.projects     from anon;

-- authenticated: remove MAINTAIN/REFERENCES/TRIGGER/TRUNCATE, leaving
-- exactly 008's SELECT/INSERT/UPDATE grants untouched (verified below).
revoke maintain, references, trigger, truncate on public.organisations from authenticated;
revoke maintain, references, trigger, truncate on public.profiles     from authenticated;
revoke maintain, references, trigger, truncate on public.customers    from authenticated;
revoke maintain, references, trigger, truncate on public.projects     from authenticated;

-- Default privileges: without this, any *future* table created by the
-- `postgres` role in `public` (i.e. any future BIK migration, applied the
-- same way 001-008 were) would silently re-acquire the exact privilege
-- set this migration just removed. This closes that recurrence path for
-- every future CREATE TABLE under this role/schema combination.
alter default privileges for role postgres in schema public
  revoke maintain, references, trigger, truncate on tables from anon;
alter default privileges for role postgres in schema public
  revoke maintain, references, trigger, truncate on tables from authenticated;

-- ----------------------------------------------------------------------------
-- Deliberately not in this migration:
--   - Any change to SELECT/INSERT/UPDATE granted by 008 -- unaffected,
--     this migration touches only MAINTAIN/REFERENCES/TRIGGER/TRUNCATE.
--   - service_role -- see root-cause note above. Bypasses RLS via
--     BYPASSRLS, but currently has no table-level SELECT/INSERT/UPDATE/
--     DELETE grant either (same Dxtm/postgres default as anon/
--     authenticated) -- a separate, currently-inert gap (no service-role
--     code exists yet) tracked for its own decision, not addressed here.
--   - The `supabase_admin`-owned default ACL entry for `public`
--     (`postgres=arwdDxtm/supabase_admin, anon=arwdDxtm/supabase_admin,
--     authenticated=arwdDxtm/supabase_admin, service_role=arwdDxtm/
--     supabase_admin` -- i.e. FULL privileges, including SELECT/INSERT/
--     UPDATE/DELETE, to anon/authenticated/service_role automatically)
--     is a *different* default ACL, scoped to tables created BY
--     `supabase_admin`, not `postgres`. `postgres` is not a member of
--     `supabase_admin` and is not superuser, and cannot alter another
--     role's default privileges -- this migration cannot touch that
--     entry. It does not currently apply to any BIK table (all four are
--     owned by `postgres`, confirmed via pg_class), but it means any
--     future table created via the Supabase Studio Table Editor UI
--     (which creates objects as `supabase_admin`, not `postgres`) would
--     inherit full, unrestricted privileges for anon/authenticated
--     automatically -- see ADR-015 for the process safeguard this
--     implies (all future BIK tables via SQL migration only, never the
--     Table Editor, unless/until that separate default ACL is corrected
--     with Supabase support or a superuser session).
--   - Any change to 001-008 -- this migration is purely subtractive
--     (REVOKE / ALTER DEFAULT PRIVILEGES REVOKE only) and does not alter
--     any table, function, trigger, or policy created by an earlier
--     migration.
-- ----------------------------------------------------------------------------
