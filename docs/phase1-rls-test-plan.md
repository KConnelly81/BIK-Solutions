# Phase 1 RLS Security Test Plan

**Purpose:** Verify the multi-tenant isolation and role policies in `supabase/migrations/005_phase1_rls.sql` behave exactly as designed before any real user or tester data touches the project.
**Status:** Not yet executed — migrations 001-005 have not been applied to Supabase.
**Owner:** BIK Solutions Pty Ltd

---

## How to run this

Once 001-005 are applied to a test/staging Supabase project (never run this against data you care about — several tests attempt destructive or cross-tenant writes that are *supposed* to fail):

1. Create two organisations (Org A, Org B) and at least one `owner`, one `admin`, and one `member` profile in each, via direct SQL as the `postgres`/`service_role` (bypasses RLS — this is how test fixtures get seeded, since the bootstrap RPC doesn't exist yet).
2. For each test below, run the action **as the specified authenticated user** (via the Supabase client SDK with that user's session, or `set local role authenticated; set local request.jwt.claims = '...'` in the SQL editor) — not as `service_role`. Testing as `service_role` proves nothing; it bypasses RLS entirely.
3. Expected Result is either a specific row set, an empty result, or a policy-violation error. "Blocked" means zero rows returned (SELECT) or a permission/policy error (INSERT/UPDATE/DELETE) — not a 500 or a crash.

---

## Organisation isolation

| # | Test | Actor | Action | Expected Result |
|---|---|---|---|---|
| 1 | Owner from Org A cannot read Org B | Org A owner | `select * from organisations where id = <Org B id>` | 0 rows |
| 2 | Owner from Org A cannot read Org B's projects | Org A owner | `select * from projects where organisation_id = <Org B id>` | 0 rows |
| 3 | Owner from Org A cannot read Org B's customers | Org A owner | `select * from customers where organisation_id = <Org B id>` | 0 rows |
| 4 | Owner from Org A cannot read Org B's profiles | Org A owner | `select * from profiles where organisation_id = <Org B id>` | 0 rows |
| 5 | Member cannot insert a project into another organisation | Org A member | `insert into projects (organisation_id, name) values (<Org B id>, 'Test')` | Rejected — `with check` fails regardless of the organisation_id value submitted |
| 6 | Member cannot update a project to move it to another organisation | Org A member | `update projects set organisation_id = <Org B id> where id = <own project>` | Rejected |

## Anonymous access

| # | Test | Actor | Action | Expected Result |
|---|---|---|---|---|
| 7 | Anonymous user cannot read projects | Unauthenticated (`anon`) | `select * from projects` | 0 rows (no policy matches the `anon` role at all — every policy is scoped `to authenticated`) |
| 8 | Anonymous user cannot read organisations | Unauthenticated (`anon`) | `select * from organisations` | 0 rows |
| 9 | Anonymous user cannot read customers | Unauthenticated (`anon`) | `select * from customers` | 0 rows |
| 10 | Anonymous user cannot insert a customer | Unauthenticated (`anon`) | `insert into customers (...) values (...)` | Rejected |

## Role behaviour (owner / admin / member)

| # | Test | Actor | Action | Expected Result |
|---|---|---|---|---|
| 11 | Member cannot update organisation settings | Org A member | `update organisations set name = 'Changed' where id = <own org>` | Rejected — `organisations_update_owner_only` requires `is_owner()` |
| 12 | Admin cannot update organisation settings | Org A admin | `update organisations set name = 'Changed' where id = <own org>` | Rejected — same policy; admin is not owner |
| 13 | Owner can update organisation settings | Org A owner | `update organisations set name = 'Changed' where id = <own org>` | Succeeds |
| 14 | Member cannot delete organisation | Org A member | `delete from organisations where id = <own org>` | Rejected — no DELETE policy exists for any role |
| 15 | Owner cannot delete organisation either | Org A owner | `delete from organisations where id = <own org>` | Rejected — deliberately no DELETE policy in Phase 1, even for owner |
| 16 | Member can create and update a project | Org A member | `insert into projects (...)`, then `update projects set notes = '...' where id = <that project>` | Both succeed |
| 17 | Member cannot delete a project | Org A member | `delete from projects where id = <own org's project>` | Rejected — `projects_delete_admin_or_owner` requires `is_admin()` |
| 18 | Admin can delete a project | Org A admin | `delete from projects where id = <own org's project>` | Succeeds |
| 19 | Member cannot delete a customer | Org A member | `delete from customers where id = <own org's customer>` | Rejected |
| 20 | Admin can delete a customer | Org A admin | `delete from customers where id = <own org's customer>` | Succeeds |
| 21 | Member cannot promote themselves to owner | Org A member | `update profiles set role = 'owner' where id = auth.uid()` | Rejected by `profiles_prevent_unauthorised_role_change` trigger, even though the RLS UPDATE policy itself would have allowed the row-level update |
| 22 | Member cannot move themselves to another organisation | Org A member | `update profiles set organisation_id = <Org B id> where id = auth.uid()` | Rejected by the same trigger |
| 23 | Owner can promote a member to admin | Org A owner | `update profiles set role = 'admin' where id = <Org A member>` | Succeeds |
| 24 | Admin cannot promote a member to admin | Org A admin | `update profiles set role = 'admin' where id = <Org A member>` | Rejected — `profiles_update_self_or_owner` only allows owner to update someone else's row |

## Referential integrity under deletion

| # | Test | Actor | Action | Expected Result |
|---|---|---|---|---|
| 25 | Deleted customer leaves project intact | Org A admin | Delete a customer linked to a project, then read the project | Project row still exists; `projects.customer_id` is now `null` (ON DELETE SET NULL) |
| 26 | Cannot delete an organisation with any profile remaining | `service_role` (bypasses RLS, tests the FK constraint itself, not RLS) | `delete from organisations where id = <org with any profile>` | Rejected — FK `RESTRICT` on `profiles.organisation_id` |
| 27 | Cannot delete an organisation with any project remaining | `service_role` | `delete from organisations where id = <org with any project>` | Rejected — FK `RESTRICT` on `projects.organisation_id` |
| 28 | Cannot delete an organisation with any customer remaining | `service_role` | `delete from organisations where id = <org with any customer>` | Rejected — FK `RESTRICT` on `customers.organisation_id` |

## Known gaps (expected to fail today — tracked, not bugs)

| # | Test | Actor | Action | Expected Result |
|---|---|---|---|---|
| 29 | New signup cannot create their own organisation yet | Freshly authenticated user, no profile | `insert into organisations (...)` | Rejected — no INSERT policy exists; this is the ADR-008 bootstrap RPC gap, not a defect in 005 |
| 30 | Owner can currently demote the organisation's only remaining owner | Org A owner (sole owner) | `update profiles set role = 'member' where id = auth.uid()` | **Currently succeeds** — this is the ADR-009 gap. Re-run this test once last-owner protection ships and update the expected result to "Rejected." |

---

## Related documents

- `supabase/migrations/005_phase1_rls.sql` — the policies under test
- `docs/decisions/README.md` — ADR-008 (bootstrap RPC), ADR-009 (last-owner protection)
