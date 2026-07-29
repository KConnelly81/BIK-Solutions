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
| 17 | Member cannot hard-delete a project | Org A member | `delete from projects where id = <own org's project>` | Rejected — no DELETE policy exists on `projects` for any role (ADR-010) |
| 18 | Admin cannot hard-delete a project | Org A admin | `delete from projects where id = <own org's project>` | Rejected — same reason; there is no `is_admin()`-gated DELETE policy any more |
| 19 | Owner cannot hard-delete a project either | Org A owner | `delete from projects where id = <own org's project>` | Rejected — no role, including owner, has a client-facing DELETE path on `projects` |
| 20 | Owner can archive a project | Org A owner | `update projects set status = 'archived' where id = <own org's project>` | Succeeds — via `projects_update_same_org`, the correct routine-removal path per ADR-010 |
| 21 | Member cannot hard-delete a customer | Org A member | `delete from customers where id = <own org's customer>` | Rejected — no DELETE policy exists on `customers` for any role (ADR-010) |
| 22 | Admin cannot hard-delete a customer | Org A admin | `delete from customers where id = <own org's customer>` | Rejected — same reason |
| 23 | Owner cannot hard-delete a customer either | Org A owner | `delete from customers where id = <own org's customer>` | Rejected — no role, including owner, has a client-facing DELETE path on `customers` |
| 24 | Admin can archive a customer | Org A admin | `update customers set status = 'archived' where id = <own org's customer>` | Succeeds — via `customers_update_same_org`, the correct routine-removal path per ADR-010 |
| 25 | Member cannot promote themselves to owner | Org A member | `update profiles set role = 'owner' where id = auth.uid()` | Rejected by `profiles_prevent_unauthorised_role_change` trigger, even though the RLS UPDATE policy itself would have allowed the row-level update |
| 26 | Member cannot move themselves to another organisation | Org A member | `update profiles set organisation_id = <Org B id> where id = auth.uid()` | Rejected by the same trigger |
| 27 | Owner can promote a member to admin | Org A owner | `update profiles set role = 'admin' where id = <Org A member>` | Succeeds |
| 28 | Admin cannot promote a member to admin | Org A admin | `update profiles set role = 'admin' where id = <Org A member>` | Rejected — `profiles_update_self_or_owner` only allows owner to update someone else's row |

## Referential integrity under deletion

| # | Test | Actor | Action | Expected Result |
|---|---|---|---|---|
| 29 | Hard-deleted customer leaves project intact | `service_role` (the only path capable of a hard delete at all, per ADR-010 — this test exercises the FK behaviour, not RLS) | Delete a customer linked to a project, then read the project | Project row still exists; `projects.customer_id` is now `null` (ON DELETE SET NULL) |
| 30 | Cannot delete an organisation with any profile remaining | `service_role` (bypasses RLS, tests the FK constraint itself, not RLS) | `delete from organisations where id = <org with any profile>` | Rejected — FK `RESTRICT` on `profiles.organisation_id` |
| 31 | Cannot delete an organisation with any project remaining | `service_role` | `delete from organisations where id = <org with any project>` | Rejected — FK `RESTRICT` on `projects.organisation_id` |
| 32 | Cannot delete an organisation with any customer remaining | `service_role` | `delete from organisations where id = <org with any customer>` | Rejected — FK `RESTRICT` on `customers.organisation_id` |

## Known gaps (expected to fail today — tracked, not bugs)

| # | Test | Actor | Action | Expected Result |
|---|---|---|---|---|
| 33 | New signup cannot create their own organisation yet | Freshly authenticated user, no profile | `insert into organisations (...)` | Rejected — no INSERT policy exists; this is the ADR-008 bootstrap RPC gap, not a defect in 005 |
| 34 | Owner can currently demote the organisation's only remaining owner | Org A owner (sole owner) | `update profiles set role = 'member' where id = auth.uid()` | **Currently succeeds** — this is the ADR-009 gap. Re-run this test once last-owner protection ships and update the expected result to "Rejected." |

---

## Bootstrap RPC (`006_create_organisation_bootstrap.sql`)

Unlike the tables above, these tests call `public.bootstrap_organisation(...)` directly via `select * from public.bootstrap_organisation(...)` or the client SDK's `.rpc()` call, as the specified actor. A "fresh" user below means an `auth.users` row with no corresponding `profiles` row yet.

| # | Test | Actor | Action | Expected Result |
|---|---|---|---|---|
| 35 | Fresh user can bootstrap successfully | Fresh authenticated user | `select * from public.bootstrap_organisation('Acme Builders', 'Jane Smith')` | Succeeds — returns one `(organisation_id, profile_id)` row; `profile_id` equals the caller's own `auth.uid()` |
| 36 | Bootstrap creates the profile with role owner | Fresh authenticated user | After test 35, `select role from profiles where id = auth.uid()` | `owner` |
| 37 | Bootstrap sets created_by/updated_by from the caller, not any input | Fresh authenticated user | After test 35, inspect `organisations.created_by` and `profiles.created_by` | Both equal the caller's own `auth.uid()` — the function signature has no parameter that could set these to anything else |
| 38 | Anonymous user cannot call bootstrap at all | Unauthenticated (`anon`) | `select * from public.bootstrap_organisation('Acme', 'Jane')` | Rejected — no `EXECUTE` grant exists for `anon` |
| 39 | Second bootstrap call by an already-provisioned user is rejected | User from test 35 (now has a profile) | `select * from public.bootstrap_organisation('Another Co', 'Jane Smith')` | Rejected — "A profile already exists for this account." No second organisation or profile is created |
| 40 | Blank organisation name is rejected | Fresh authenticated user | `select * from public.bootstrap_organisation('   ', 'Jane Smith')` | Rejected — "Organisation name is required." No rows created |
| 41 | Blank full name is rejected | Fresh authenticated user | `select * from public.bootstrap_organisation('Acme Builders', '')` | Rejected — "Full name is required." No rows created (organisation insert, if attempted first, is rolled back with the rest of the transaction) |
| 42 | Invalid ABN format is rejected | Fresh authenticated user | `select * from public.bootstrap_organisation('Acme Builders', 'Jane Smith', '123')` | Rejected — "Organisation ABN must be 11 digits." No rows created |
| 43 | Duplicate ABN across two different users is rejected cleanly | Second fresh authenticated user, using an ABN already registered by another organisation | `select * from public.bootstrap_organisation('Copycat Co', 'Bob Jones', '<existing 11-digit ABN>')` | Rejected — "An organisation with this ABN is already registered." No orphan organisation row remains (both inserts are in the same transaction) |
| 44 | Concurrent double bootstrap by the same user creates exactly one organisation and one profile | Fresh authenticated user, two near-simultaneous sessions/calls | Fire `bootstrap_organisation(...)` twice at once for the same `auth.uid()` (e.g. two open tabs, or two concurrent `psql` sessions holding the same JWT) | Exactly one succeeds; the other is rejected with "A profile already exists for this account." (or blocks briefly on the advisory lock, then sees the now-committed profile and is rejected). `select count(*) from organisations where created_by = <user>` and `select count(*) from profiles where id = <user>` both return exactly 1 |
| 45 | Function signature accepts no role, status, or id parameters | Code review, not a runtime call | Inspect `public.bootstrap_organisation`'s parameter list | Confirmed: only `p_organisation_name`, `p_full_name`, `p_organisation_abn`, `p_phone`, `p_job_title` — no way to submit a role, organisation_id, profile id, or status value even by a malicious/malformed request |

---

## Last-owner protection (`007_protect_last_owner.sql`)

Unless noted, "Actor" performs the action directly via SQL as that role — several of these specifically exercise `service_role`/direct SQL, since the point of `007` is that RLS bypass must not also bypass this invariant.

| # | Test | Actor | Action | Expected Result |
|---|---|---|---|---|
| 46 | Sole owner cannot demote themselves | Org A sole owner | `update profiles set role = 'member' where id = auth.uid()` | Rejected at commit — "Organisation ... must retain at least one active owner." |
| 47 | Sole owner cannot suspend themselves | Org A sole owner | `update profiles set status = 'suspended' where id = auth.uid()` | Rejected at commit, same reason |
| 48 | Sole owner cannot be transferred to another organisation | `service_role` (RLS already blocks this for ordinary callers via 005's `WITH CHECK`; this exercises the non-RLS backstop) | `update profiles set organisation_id = <Org B id> where id = <Org A's sole owner>` | Rejected at commit — the trigger checks the organisation being left (Org A), which would have zero active owners |
| 49 | Sole owner's profile cannot be deleted | `service_role` | `delete from profiles where id = <Org A's sole owner>` | Rejected at commit |
| 50 | Non-sole owner can demote themselves | Org A owner (organisation has 2 active owners) | `update profiles set role = 'member' where id = auth.uid()` | Succeeds — the other owner still satisfies the invariant |
| 51 | Demoting every owner in one multi-row statement is rejected | `service_role`, Org A has exactly 2 owners | `update profiles set role = 'member' where organisation_id = <Org A> and role = 'owner'` | Rejected — the whole statement (both rows) rolls back. The deferred trigger fires once per affected row, but not until the entire statement (and transaction) has already applied both changes, so the first row-firing already observes zero remaining owners |
| 52 | Two owners demoting themselves concurrently | Org A, exactly 2 active owners, owner X and owner Y in two separate concurrent sessions | Session 1: `update profiles set role='member' where id=X`, commit. Session 2 (started at nearly the same time): `update profiles set role='member' where id=Y`, commit | Exactly one commits successfully; the other is rejected with "must retain at least one active owner." The per-organisation advisory lock in `internal.assert_organisation_has_active_owner` serialises the two commits so the second transaction's check correctly observes the first transaction's already-applied change |
| 53 | One owner suspended while another is demoted, concurrently | Same setup as #52, but Session 1 suspends X (`status='suspended'`) while Session 2 demotes Y (`role='member'`) | Same outcome as #52 — exactly one of the two commits |
| 54 | Sequential ownership transfer within one transaction succeeds | `service_role`, Org A has one owner (X) and one member (Y) intended to become the new owner | In one transaction: `update profiles set role='member' where id=X;` then `update profiles set role='owner' where id=Y;` then commit | Succeeds — both statements complete before the deferred trigger runs at commit, by which point Org A has exactly one active owner (Y). This would fail if the trigger were IMMEDIATE rather than deferred, since the first statement alone leaves Org A owner-less mid-transaction |
| 55 | Reactivating a suspended, owner-less organisation is rejected | `service_role`, Org A is `status='suspended'` with zero active owners | `update organisations set status = 'active' where id = <Org A>` | Rejected at commit — the organisations-side trigger checks for an active owner at the moment status becomes 'active' |
| 56 | Suspending an organisation with zero active owners is allowed | `service_role`, Org A already has zero active owners (e.g. sole owner was suspended while Org A itself was already suspended) | `update organisations set status = 'suspended' where id = <Org A>` (no-op status-wise, or transitioning further) | Succeeds — the invariant does not apply to non-active organisations |
| 57 | Bootstrap still succeeds end-to-end | Fresh authenticated user | `select * from public.bootstrap_organisation('Acme Builders', 'Jane Smith')` | Succeeds — both the `organisations` insert and the `profiles` insert (role=owner) complete within one transaction before either deferred trigger fires at commit |
| 58 | Direct SQL org creation without an accompanying owner is rejected | `service_role` | In one transaction: `insert into organisations (name) values ('Ghost Co');` alone, no profiles insert, then commit | Rejected at commit — the organisations-side trigger finds the new (active-status) organisation has zero active owners |

---

## Related documents

- `supabase/migrations/005_phase1_rls.sql` — the policies under test
- `supabase/migrations/006_create_organisation_bootstrap.sql` — the bootstrap RPC under test
- `supabase/migrations/007_protect_last_owner.sql` — the last-owner protection under test
- `docs/decisions/README.md` — ADR-008 (bootstrap RPC), ADR-009 (last-owner protection, implemented in 007), ADR-010 (soft delete strategy), ADR-011 (single organisation membership), ADR-012 (profile lifecycle bound to auth.users)
