# Phase 1 Non-Production Deployment & Validation Runbook

**Purpose:** Exact, sequential procedure for applying migrations `001`–`007` to the non-production Supabase project, and validating the result, before any application code is connected.
**Status:** Not yet executed. No migration has been applied as of this document's creation.
**Scope:** Deployment and validation only. No new schema features. Migrations are amended only if this deployment exposes a confirmed defect — if that happens, stop, fix in a new commit, and restart this runbook from the top.
**Prerequisite:** `docs/PHASE_1_DATABASE_REVIEW.md` (both review passes) is approved. This runbook does not re-litigate that review — it executes what it approved.
**First milestone (not "connect the whole app"):** a disposable authenticated user can create one organisation via `bootstrap_organisation()` and access only that organisation's records. Everything in this runbook builds toward proving exactly that, cleanly, before anything else.

---

## Deployment target

| Property | Value |
|---|---|
| Project name | BIK Solutions Beta |
| Project ref / ID | `hpcqncghvdrlvufxfdnd` |
| Region | `ap-southeast-2` (Sydney) |
| Database | PostgreSQL 17 |

**No service-role key, database password, JWT secret, or access token appears anywhere in this document, and none should ever be pasted into this file, any other repository file, or any commit.** Where a step requires one (the SQL Editor's own connection already runs as a privileged role, so this is rarer than it sounds — see "A note on `service_role`" below), the instruction is to *obtain it from the Supabase Dashboard at the time of testing and use it only in that session*, never to record it anywhere durable.

### A note on `service_role` in this runbook

The Supabase SQL Editor connects to the database as a privileged role (typically `postgres`), not as the `authenticated`/`anon` roles PostgREST uses, and not literally as `service_role` either — but it has the same practical effect for this runbook's purposes: it bypasses RLS. Wherever a validation step below says "as `service_role`" or "administrative," it means: **run the SQL directly in the SQL Editor, with no `set local role authenticated` override.** Wherever a step says "as an authenticated user," it means the `set local role authenticated; set local request.jwt.claims = ...` pattern described in Stage 3 below. No actual API key is needed for either — this runbook never requires you to obtain or paste the project's `anon` or `service_role` key, except optionally in Stage 2, where testing genuinely as the `anon` *API role* (not just a SQL Editor session) requires the publishable `anon` key from Project Settings → API. That key is public by Supabase's own design (it's shipped in client-side code) and is not the kind of secret this runbook is warning against — the database password, JWT signing secret, and `service_role` key are.

---

## Before deployment

Complete every item below before running any migration. If any item fails, stop and resolve it first.

- [ ] **Correct project and region confirmed.** In the Supabase Dashboard, open the target project and confirm, on Project Settings → General: project ref `hpcqncghvdrlvufxfdnd`, region `ap-southeast-2`. Do not proceed against any other project.
- [ ] **No production data exists.** In the SQL Editor:
  ```sql
  select table_name from information_schema.tables
  where table_schema = 'public'
  order by table_name;
  ```
  Expected: zero rows (empty `public` schema). If any table exists, stop — this is not the clean state this runbook assumes, and applying `001`–`007` on top of unknown existing objects is out of scope for this procedure.
- [ ] **Migration files are committed and clean.** In the repository:
  ```bash
  git status --short
  git log -1 --oneline
  ```
  Expected: no uncommitted changes. Record the commit hash shown — it goes in the Results Record below.
- [ ] **Migration order is correct.** Confirm exactly these seven files exist in `supabase/migrations/`, no gaps, no duplicates, no extras:
  ```bash
  ls supabase/migrations/
  ```
  Expected, in this exact order: `001_create_organisations.sql`, `002_create_profiles.sql`, `003_create_customers.sql`, `004_create_projects.sql`, `005_phase1_rls.sql`, `006_create_organisation_bootstrap.sql`, `007_protect_last_owner.sql`.
- [ ] **No secrets are present in the repository.** From the repository root:
  ```bash
  grep -rEn "service_role.{0,3}key|sb_secret|sk_live|eyJhbGciOi|SUPABASE_SERVICE|postgres://.*:.*@|DATABASE_URL" --include="*.sql" --include="*.md" --include="*.json" --include="*.env*" .
  ```
  Expected: no output. (Run and confirmed clean immediately before this runbook was written.)
- [ ] **Rollback/recovery notes are open and accessible.** Have `docs/PHASE_1_DATABASE_REVIEW.md` (§11 "Rollback and Recovery", §17, §18) and `docs/decisions/README.md` (ADR-012's administrative sequence for deleting a sole owner's account) open in a browser tab or editor for the duration of this session — not something to go find after something has already gone wrong.

---

## Migration execution

Apply strictly in order. **Run and verify one migration at a time — do not paste multiple files into one SQL Editor execution.** After each migration's verification query returns the expected result, move to the next. If it does not, stop per the "when to stop" note for that migration and do not proceed.

For each migration: open the file, copy its full contents into a fresh SQL Editor query, run it, then run the verification query in a separate execution.

### 1. `001_create_organisations.sql`

**Creates:** `public.set_updated_at()` (shared trigger function), `public.organisations` (tenant root table), its two indexes, its `updated_at` trigger, RLS enabled with zero policies.

**Expected successful result:** the SQL Editor reports success with no errors (several `CREATE`/`COMMENT`/`ALTER` statements, no rows returned).

**Verification query:**
```sql
select
  (select count(*) from information_schema.tables where table_schema='public' and table_name='organisations') as table_exists,
  (select relrowsecurity from pg_class where relname='organisations') as rls_enabled,
  (select count(*) from pg_indexes where tablename='organisations') as index_count,
  (select count(*) from pg_trigger where tgrelid='public.organisations'::regclass and not tgisinternal) as trigger_count,
  (select count(*) from pg_policies where tablename='organisations') as policy_count;
```
**Expected:** `table_exists=1`, `rls_enabled=true`, `index_count=3` (primary key + `organisations_abn_unique_idx` + `organisations_status_idx`), `trigger_count=1`, `policy_count=0` (correct — no policies until `005`; the table is intentionally fully locked at this point).

**Stop if:** any error is raised, `table_exists ≠ 1`, `rls_enabled ≠ true`, or `policy_count ≠ 0` (a non-zero policy count here means something unexpected already exists — do not continue).

### 2. `002_create_profiles.sql`

**Creates:** `public.profiles`, its three indexes, its `updated_at` trigger, RLS enabled with zero policies.

**Expected successful result:** success, no errors.

**Verification query:**
```sql
select
  (select count(*) from information_schema.tables where table_schema='public' and table_name='profiles') as table_exists,
  (select relrowsecurity from pg_class where relname='profiles') as rls_enabled,
  (select count(*) from pg_indexes where tablename='profiles') as index_count,
  (select count(*) from pg_policies where tablename='profiles') as policy_count,
  (select confrelid::regclass::text from pg_constraint where conname='profiles_organisation_id_fkey') as fk_target;
```
**Expected:** `table_exists=1`, `rls_enabled=true`, `index_count=4` (primary key + 3 named indexes), `policy_count=0`, `fk_target='organisations'`.

**Stop if:** any error, or any value above doesn't match — in particular, a missing or wrong `fk_target` means `001` didn't apply as expected and must be resolved before continuing.

### 3. `003_create_customers.sql`

**Creates:** `public.customers`, its four indexes, its `updated_at` trigger, RLS enabled with zero policies.

**Expected successful result:** success, no errors.

**Verification query:**
```sql
select
  (select count(*) from information_schema.tables where table_schema='public' and table_name='customers') as table_exists,
  (select relrowsecurity from pg_class where relname='customers') as rls_enabled,
  (select count(*) from pg_indexes where tablename='customers') as index_count,
  (select count(*) from pg_policies where tablename='customers') as policy_count;
```
**Expected:** `table_exists=1`, `rls_enabled=true`, `index_count=5` (primary key + 4 named indexes), `policy_count=0`.

**Stop if:** any error, or any mismatch above.

### 4. `004_create_projects.sql`

**Creates:** `public.projects`, its six indexes, its `updated_at` trigger, RLS enabled with zero policies.

**Expected successful result:** success, no errors.

**Verification query:**
```sql
select
  (select count(*) from information_schema.tables where table_schema='public' and table_name='projects') as table_exists,
  (select relrowsecurity from pg_class where relname='projects') as rls_enabled,
  (select count(*) from pg_indexes where tablename='projects') as index_count,
  (select count(*) from pg_policies where tablename='projects') as policy_count,
  (select confrelid::regclass::text from pg_constraint where conname='projects_customer_id_fkey') as customer_fk_target;
```
**Expected:** `table_exists=1`, `rls_enabled=true`, `index_count=7` (primary key + 6 named indexes), `policy_count=0`, `customer_fk_target='customers'`.

**Stop if:** any error, or any mismatch above. **This is the last migration before any table becomes accessible at all** — `001`–`004` collectively leave every table fully RLS-locked with zero policies, which is the correct, expected state to this point.

### 5. `005_phase1_rls.sql`

**Creates:** the `internal` schema and its privilege grants; four RLS helper functions (`internal.current_organisation_id()`, `internal.current_role()`, `internal.is_owner()`, `internal.is_admin()`); ten RLS policies across all four tables; the self-escalation/suspension-reversal trigger (`prevent_unauthorised_profile_role_change`) and its trigger function. **This is the migration that actually opens any access at all.**

**Expected successful result:** success, no errors.

**Verification query:**
```sql
select
  (select count(*) from pg_policies where schemaname='public') as total_policies,
  (select has_schema_privilege('authenticated', 'internal', 'usage')) as authenticated_has_usage,
  (select has_schema_privilege('anon', 'internal', 'usage')) as anon_has_usage,
  (select has_schema_privilege('public', 'internal', 'usage')) as public_has_usage,
  (select has_function_privilege('authenticated', 'internal.current_organisation_id()', 'execute')) as authenticated_can_call_helper,
  (select count(*) from pg_trigger where tgname='profiles_prevent_unauthorised_role_change') as escalation_trigger_count;
```
**Expected:** `total_policies=10`, `authenticated_has_usage=true`, `anon_has_usage=false`, `public_has_usage=false`, `authenticated_can_call_helper=true`, `escalation_trigger_count=1`.

**Stop if:** any error, or **especially** if `authenticated_has_usage` is not `true` — this is the exact defect (C1) the Phase 1 database review found and corrected; if it recurs here, do not proceed to `006`/`007`, and do not attempt any authenticated-role testing until this is resolved, since every subsequent authenticated test will fail with a schema permission error as a direct consequence.

### 6. `006_create_organisation_bootstrap.sql`

**Creates:** `public.bootstrap_organisation()` — the sole path for a newly authenticated user to create their first organisation and profile.

**Expected successful result:** success, no errors.

**Verification query:**
```sql
select
  (select count(*) from pg_proc where proname='bootstrap_organisation') as function_exists,
  (select has_function_privilege('authenticated', 'public.bootstrap_organisation(text,text,text,text,text)', 'execute')) as authenticated_can_call,
  (select has_function_privilege('anon', 'public.bootstrap_organisation(text,text,text,text,text)', 'execute')) as anon_can_call;
```
**Expected:** `function_exists=1`, `authenticated_can_call=true`, `anon_can_call=false`.

**Stop if:** any error, or `anon_can_call=true` (would mean unauthenticated signup-bypass is possible — do not proceed).

### 7. `007_protect_last_owner.sql`

**Creates:** `internal.assert_organisation_has_active_owner()`, the two deferred constraint trigger functions (`enforce_last_owner_on_profiles`, `enforce_last_owner_on_organisations`) and their triggers.

**Expected successful result:** success, no errors.

**Verification query:**
```sql
select tgname, tgdeferrable, tginitdeferred
from pg_trigger
where tgname in ('profiles_last_owner_guard', 'organisations_last_owner_guard')
order by tgname;
```
**Expected:** exactly two rows, both with `tgdeferrable=true` and `tginitdeferred=true`.

**Stop if:** any error, fewer than two rows returned, or either row shows `tgdeferrable=false`/`tginitdeferred=false` — an immediate (non-deferred) version of either trigger would incorrectly reject `bootstrap_organisation()` in Stage 3 below, so this must be confirmed before proceeding.

**All seven migrations applied and verified is the end of "Migration execution." Proceed to Stage 1 only once every verification query above has returned its expected result.**

---

## Validation

### Stage 1: Static database inspection

Consolidates and extends the per-migration checks above into one pass. Run each block; every result should match.

```sql
-- Tables
select table_name from information_schema.tables
where table_schema='public' and table_name in ('organisations','profiles','customers','projects')
order by table_name;
-- Expected: all four, in this order.

-- Schemas
select schema_name from information_schema.schemata where schema_name='internal';
-- Expected: one row.

-- Functions (all 10 across the schema)
select n.nspname as schema, p.proname as function
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','internal')
  and p.proname in (
    'set_updated_at','current_organisation_id','current_role','is_owner','is_admin',
    'prevent_unauthorised_profile_role_change','bootstrap_organisation',
    'assert_organisation_has_active_owner','enforce_last_owner_on_profiles',
    'enforce_last_owner_on_organisations'
  )
order by schema, function;
-- Expected: all 10, matching docs/PHASE_1_DATABASE_REVIEW.md §13's table.

-- Triggers
select tgname from pg_trigger where not tgisinternal and tgrelid::regclass::text in
  ('organisations','profiles','customers','projects')
order by tgname;
-- Expected: organisations_last_owner_guard, organisations_set_updated_at,
--           profiles_last_owner_guard, profiles_prevent_unauthorised_role_change,
--           profiles_set_updated_at, customers_set_updated_at, projects_set_updated_at (7 total).

-- RLS enabled on all four tables
select relname, relrowsecurity from pg_class
where relname in ('organisations','profiles','customers','projects');
-- Expected: relrowsecurity = true for all four.

-- Policies (10 total, all scoped to authenticated)
select tablename, policyname, cmd, roles from pg_policies where schemaname='public' order by tablename, policyname;
-- Expected: 10 rows total, every `roles` value showing only {authenticated}.

-- Expected grants (per §13's table)
select routine_schema, routine_name, grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema in ('public','internal')
order by routine_schema, routine_name, grantee;
-- Expected: internal.current_organisation_id/current_role/is_owner/is_admin -> authenticated, EXECUTE, only.
--           public.bootstrap_organisation -> authenticated, EXECUTE, only.
--           No other function (the six trigger functions, internal.assert_organisation_has_active_owner)
--           should appear at all — confirms unintended PUBLIC execution is absent.

-- Explicit confirmation that unintended PUBLIC execution is absent
select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','internal')
  and p.proname in ('set_updated_at','prevent_unauthorised_profile_role_change',
                     'enforce_last_owner_on_profiles','enforce_last_owner_on_organisations',
                     'assert_organisation_has_active_owner')
  and has_function_privilege('authenticated', p.oid, 'execute');
-- Expected: zero rows. If any of these five functions appears, EXECUTE is still reachable
-- by authenticated and the L1 correction did not apply as expected — stop.
```

**Stop if:** any block's result doesn't match its expectation.

### Stage 2: Anonymous access

Run each of the following **without** the `set local role authenticated` override (i.e. as the SQL Editor's own default connection acts here only as a stand-in check — for a true `anon`-role test, use the client SDK or a REST call with the project's publishable `anon` key, obtained from Project Settings → API and used only in that session, never recorded). At minimum, confirm via direct SQL role assumption:

```sql
set local role anon;
select * from organisations;
select * from profiles;
select * from customers;
select * from projects;
select * from public.bootstrap_organisation('Should Not Work', 'Nobody');
reset role;
```
**Expected:** all four `select`s return zero rows (not an error — RLS with no matching policy for `anon` yields an empty result, not a permission error, for `SELECT`). The `bootstrap_organisation` call is expected to **error** with a permission-denied message (no `EXECUTE` grant for `anon`), not run.

**Stop if:** any `select` returns any row, or `bootstrap_organisation` executes successfully as `anon`.

### Stage 3: Authenticated bootstrap

1. Create one disposable test user (Dashboard → Authentication → Users → Add user, or invite by email). Record its UUID from the `auth.users` row — call it `<user_a>`.
2. In a fresh SQL Editor query, run as one execution:
   ```sql
   begin;
   set local role authenticated;
   set local request.jwt.claims = '{"sub":"<user_a>","role":"authenticated"}';
   select auth.uid(); -- confirm this returns <user_a> before proceeding
   select * from public.bootstrap_organisation('Disposable Test Org A', 'Disposable Owner A');
   commit;
   ```
   Record the returned `organisation_id`.
3. Verify, back as the default (privileged) role:
   ```sql
   select count(*) from organisations where created_by = '<user_a>';
   select count(*) from profiles where id = '<user_a>' and role = 'owner' and created_by = '<user_a>' and updated_by = '<user_a>';
   ```
   **Expected:** both return `1`.
4. Confirm a second bootstrap call by the same user is rejected cleanly:
   ```sql
   begin;
   set local role authenticated;
   set local request.jwt.claims = '{"sub":"<user_a>","role":"authenticated"}';
   select * from public.bootstrap_organisation('Should Fail', 'Should Fail');
   rollback;
   ```
   **Expected:** an error containing "A profile already exists for this account." No second organisation or profile row is created (confirm counts from step 3 are still exactly `1` each afterwards).

**Stop if:** bootstrap creates more than one organisation or profile, the profile's role is not exactly `owner`, `created_by`/`updated_by` do not equal `<user_a>`, or the second call succeeds instead of being rejected.

### Stage 4: Tenant isolation

1. Create a second disposable test user (`<user_b>`) and, following Stage 3's pattern, have them call `bootstrap_organisation('Disposable Test Org B', 'Disposable Owner B')`. Record their `organisation_id` as `<org_b>`.
2. As `<user_a>` (Org A's owner), confirm no access to Org B:
   ```sql
   begin;
   set local role authenticated;
   set local request.jwt.claims = '{"sub":"<user_a>","role":"authenticated"}';
   select * from organisations where id = '<org_b>';
   select * from profiles where organisation_id = '<org_b>';
   select * from customers where organisation_id = '<org_b>';
   select * from projects where organisation_id = '<org_b>';
   insert into customers (organisation_id, first_name) values ('<org_b>', 'Should Fail');
   insert into projects (organisation_id, name) values ('<org_b>', 'Should Fail');
   rollback;
   ```
   **Expected:** every `select` returns zero rows; both `insert`s error (`WITH CHECK` violation).
3. Repeat symmetrically as `<user_b>` against `<org_a>` (Org A's id from Stage 3).

**Stop if:** any `select` returns a row belonging to the other organisation, or either `insert` succeeds.

### Stage 5: Role and suspension behaviour

Phase 1 has no invite flow (§8/ADR-011) — a `member` profile can only be created by seeding one directly, bypassing RLS, as a test fixture (this is a deliberate test-setup step, not something the application can do).

1. Seed a member profile in Org A, using a **third** disposable auth user (`<user_c>`):
   ```sql
   insert into profiles (id, organisation_id, full_name, role, status)
   values ('<user_c>', '<org_a>', 'Disposable Member C', 'member', 'active');
   ```
2. As `<user_c>` (member): confirm protected-field restrictions and permitted updates:
   ```sql
   begin;
   set local role authenticated;
   set local request.jwt.claims = '{"sub":"<user_c>","role":"authenticated"}';
   update profiles set role = 'owner' where id = '<user_c>';       -- expect: error
   update profiles set organisation_id = '<org_b>' where id = '<user_c>'; -- expect: error
   update profiles set status = 'suspended' where id = '<user_c>'; -- expect: error (self-suspend)
   update profiles set full_name = 'Updated Name', phone = '0400000000' where id = '<user_c>'; -- expect: succeeds
   rollback; -- rollback the whole block so the permitted update doesn't persist past this test
   ```
3. As `<user_a>` (owner): suspend, then reactivate, member C:
   ```sql
   begin;
   set local role authenticated;
   set local request.jwt.claims = '{"sub":"<user_a>","role":"authenticated"}';
   update profiles set status = 'suspended' where id = '<user_c>'; -- expect: succeeds
   commit;
   ```
4. As `<user_c>` (now suspended): confirm loss of operational access:
   ```sql
   begin;
   set local role authenticated;
   set local request.jwt.claims = '{"sub":"<user_c>","role":"authenticated"}';
   select * from customers; -- expect: zero rows
   select * from projects;  -- expect: zero rows
   rollback;
   ```
5. As `<user_a>`, reactivate member C (`update profiles set status = 'active' where id = '<user_c>';`), then confirm access is restored with a repeat of step 4's selects (now expecting Org A's rows to be visible).
6. Suspend the whole organisation and confirm **both** the owner and the member lose access even though their own `profiles.status` is `active`:
   ```sql
   update organisations set status = 'suspended' where id = '<org_a>';
   ```
   Then, as `<user_a>`: `select * from organisations where id = '<org_a>';` and `select * from projects;` — **expect zero rows for both**, including the owner's own organisation row. Reactivate afterwards (`update organisations set status = 'active' where id = '<org_a>';`) before continuing to later stages, since Stage 6/7 need Org A active again — but see Stage 7's note that reactivation requires an active owner already in place, which is still true at this point (member C's suspension in step 3 was already reversed in step 5, and the owner was never suspended, so this reactivation should succeed).

**Stop if:** any protected-field change by a non-owner succeeds, the permitted personal-field update fails, a suspended profile retains any read/write access, or a suspended organisation's members retain access.

### Stage 6: Archive and deletion behaviour

1. As `<user_a>`, create a customer and a project in Org A (if not already present from earlier stages), then archive both:
   ```sql
   update customers set status = 'archived' where organisation_id = '<org_a>' and id = '<some_customer_id>';
   update projects set status = 'archived' where organisation_id = '<org_a>' and id = '<some_project_id>';
   ```
   **Expected:** both succeed.
2. As `<user_a>`, attempt a hard delete of each:
   ```sql
   delete from customers where id = '<some_customer_id>';
   delete from projects where id = '<some_project_id>';
   ```
   **Expected:** both error — no `DELETE` policy exists for `authenticated` on either table.
3. As the privileged SQL Editor connection (no role override — i.e. administrative), hard-delete a customer that is linked to a project via `projects.customer_id`, and confirm the project survives with the link cleared:
   ```sql
   select id, customer_id from projects where customer_id = '<some_customer_id_linked_to_a_project>';
   delete from customers where id = '<some_customer_id_linked_to_a_project>';
   select id, customer_id from projects where id = '<the_same_project_id>';
   ```
   **Expected:** the project row still exists after the delete; `customer_id` is now `null`.

**Stop if:** any authenticated hard-delete attempt succeeds, or deleting a linked customer removes or blocks removal of the project instead of setting `customer_id` to `null`.

### Stage 7: Last-owner invariant

1. As `<user_a>` (Org A's sole active owner — confirm member C, if still present from Stage 5, has been demoted back to member or removed as a fixture so Org A genuinely has exactly one owner before this stage):
   ```sql
   begin;
   set local role authenticated;
   set local request.jwt.claims = '{"sub":"<user_a>","role":"authenticated"}';
   update profiles set role = 'member' where id = '<user_a>';      -- expect: error at commit
   commit;
   ```
   Repeat the same pattern for: `update profiles set status = 'suspended' where id = '<user_a>';` and, via the privileged connection (not authenticated — RLS already blocks a self-transfer, this specifically tests the non-RLS backstop), `update profiles set organisation_id = '<org_b>' where id = '<user_a>';` and `delete from profiles where id = '<user_a>';`. **All four expected to fail.**
2. Ownership transfer in one transaction (seed a member first if needed, e.g. `<user_c>` back in Org A as `member`):
   ```sql
   begin;
   update profiles set role = 'member' where id = '<user_a>';
   update profiles set role = 'owner' where id = '<user_c>';
   commit;
   ```
   **Expected:** succeeds — both statements complete before the deferred trigger checks the final state.
3. **Concurrent demotion test — requires two separate SQL Editor tabs, or two direct `psql` connections.** With Org A now having two active owners (promote `<user_a>` back to `owner` first, so both `<user_a>` and `<user_c>` are owners), open two tabs:
   - Tab 1: `begin; update profiles set role = 'member' where id = '<user_a>';` — do **not** commit yet.
   - Tab 2 (started while Tab 1 is still open): `begin; update profiles set role = 'member' where id = '<user_c>';` — this should appear to hang (waiting on Tab 1's advisory lock).
   - Commit Tab 1: `commit;` — should succeed.
   - Tab 2 then proceeds and should **fail** with "must retain at least one active owner."
   **Expected:** exactly one of the two succeeds. Restore a second owner afterwards before continuing, if further testing is planned.
4. `auth.users` deletion interaction, on an organisation with exactly one active owner:
   - Attempt to delete `<user_a>`'s `auth.users` row (Dashboard → Authentication → Users → Delete, or `delete from auth.users where id = '<user_a>';` via the privileged SQL Editor connection) while Org A is `status = 'active'` and `<user_a>` is its sole active owner.
   - **Expected:** the deletion fails/rolls back with "must retain at least one active owner." Confirm `<user_a>` still exists in `auth.users` afterwards.
   - Then perform one of the two documented sequences (ADR-012): either promote another member to `owner` first, or set `organisations.status = 'suspended'` first — then retry the `auth.users` deletion. **Expected:** succeeds this time.

**Stop if:** a sole owner can be demoted, suspended, transferred, or deleted while their organisation is active; the concurrent test allows both demotions to succeed; or the `auth.users` deletion succeeds against a sole active owner without one of the two documented sequences having been performed first.

---

## Test data cleanup

Disposable test data must be removed in an order that respects the schema's own protections — several of the steps below will *fail* if done out of order, which is expected and correct, not a bug to work around.

1. **Reduce each disposable organisation to zero customers/projects**, or leave them (they're harmless — `ON DELETE RESTRICT` on `organisation_id` means the organisation can't be deleted while any remain, so if the goal is to delete the organisation, they must go first): `delete from projects where organisation_id in ('<org_a>','<org_b>'); delete from customers where organisation_id in ('<org_a>','<org_b>');` — run as the privileged connection.
2. **Delete the disposable `auth.users` rows**, not the `profiles` rows directly — `profiles.id references auth.users(id) on delete cascade` means deleting the auth user is the correct way to remove a profile, and doing it in this direction (rather than deleting `profiles` first) respects ADR-012's "profile lifecycle follows auth lifecycle" rule even for test cleanup. **Before deleting the last owner of any organisation this way, apply Stage 7's ADR-012 sequence** (assign another owner first, or suspend the organisation first) — the last-owner trigger will correctly block a direct delete otherwise, exactly as designed. For a fully disposable organisation with no owner worth preserving, suspending it first is simplest: `update organisations set status = 'suspended' where id = '<org_a>';` then delete every remaining `auth.users` row for that organisation's members.
3. **Delete the now-empty organisations**: `delete from organisations where id in ('<org_a>','<org_b>');` — will succeed only once every `profiles` row referencing them is gone (step 2), per the `RESTRICT` foreign key. This is expected friction, not a defect — if this delete fails, a `profiles` row still references the organisation; find it (`select * from profiles where organisation_id = '<org_a>';`) and resolve it via step 2 first.
4. **Delete any remaining disposable `auth.users` rows** not already removed in step 2 (e.g. a user who never successfully completed bootstrap, and so has no `profiles` row to worry about).

**Prefer deleting the entire disposable Supabase project outright, rather than working through the above, if this runbook's testing reveals a significant structural problem** (anything that would trigger a "Stop if" condition above and isn't a quick, understood fix). A partially-cleaned-up project with an unresolved structural issue is a worse starting point for a retry than a fresh one.

---

## Stop conditions (summary)

Stop immediately, do not proceed to the next migration or validation stage, and record the failure in the Results Record below, if any of the following occurs at any point:

- A migration raises any error.
- An expected object (table, function, trigger, policy, index) is missing after its migration.
- An authenticated request returns a schema/permission error resolving `internal.*` (the exact C1 symptom — if this recurs, re-check Stage 1's `authenticated_has_usage` result first).
- Anonymous access unexpectedly succeeds (reads a row, or successfully calls `bootstrap_organisation`).
- Cross-organisation access succeeds in any form (read, insert, update).
- Bootstrap creates more than one organisation or more than one profile for a single call, or for two calls by the same user.
- A sole active owner can be demoted, suspended, transferred, or removed (via `profiles` update/delete or via `auth.users` deletion) while their organisation remains active.

---

## Results record

| Item | Status | Date | Tester | Notes |
|---|---|---|---|---|
| Before-deployment checklist | Passed | 2026-07-29 | Claude (BIK Phase 2) | Clean public schema confirmed pre-deployment; one pre-existing, non-BIK object noted (`public.rls_auto_enable()`, Supabase platform scaffolding, harmless — see deployment summary) |
| `001_create_organisations.sql` | Passed | 2026-07-29 | Claude (BIK Phase 2) | Verification exact match: table_exists=1, rls_enabled=true, index_count=3, trigger_count=1, policy_count=0 |
| `002_create_profiles.sql` | Passed | 2026-07-29 | Claude (BIK Phase 2) | Verification exact match: table_exists=1, rls_enabled=true, index_count=4, policy_count=0, fk_target=organisations |
| `003_create_customers.sql` | Passed | 2026-07-29 | Claude (BIK Phase 2) | Verification exact match: table_exists=1, rls_enabled=true, index_count=5, policy_count=0 |
| `004_create_projects.sql` | Passed | 2026-07-29 | Claude (BIK Phase 2) | Verification exact match: table_exists=1, rls_enabled=true, index_count=7, policy_count=0, customer_fk_target=customers |
| `005_phase1_rls.sql` | Passed | 2026-07-29 | Claude (BIK Phase 2) | Verification exact match: total_policies=10, authenticated_has_usage=true (empirically confirms C1's fix), anon_has_usage=false, public_has_usage=false, authenticated_can_call_helper=true, escalation_trigger_count=1 |
| `006_create_organisation_bootstrap.sql` | Passed | 2026-07-29 | Claude (BIK Phase 2) | Verification exact match: function_exists=1, authenticated_can_call=true, anon_can_call=false |
| `007_protect_last_owner.sql` | Passed | 2026-07-29 | Claude (BIK Phase 2) | Verification exact match: both triggers present, tgdeferrable=true, tginitdeferred=true |
| Stage 1 — Static inspection | Not started | | | |
| Stage 2 — Anonymous access | Not started | | | |
| Stage 3 — Authenticated bootstrap | Not started | | | |
| Stage 4 — Tenant isolation | Not started | | | |
| Stage 5 — Role and suspension behaviour | Not started | | | |
| Stage 6 — Archive and deletion behaviour | Not started | | | |
| Stage 7 — Last-owner invariant | Not started | | | |
| Test data cleanup | Not started | | | |

**Status values:** `Not started` / `Passed` / `Failed` / `Blocked` (blocked = could not attempt because an earlier item failed).

**Deployment session details:**

- Date: 2026-07-29
- Tester: Claude (BIK Phase 2 Supabase deployment session)
- Supabase project ID: `hpcqncghvdrlvufxfdnd`
- Repository commit hash tested: `60d7a4b`
- Error details (if any failure occurred): None — all seven migrations and their verification queries passed on the first attempt, no deviation from expected results.
- Remediation commit (if a confirmed defect required a migration fix): None required.

**Note:** Migrations `001`–`007` are applied and structurally verified (Stage 1-equivalent per-migration checks). Stages 1–7's full validation pass (anonymous access, authenticated bootstrap, tenant isolation, role/suspension behaviour, archive/deletion behaviour, last-owner invariant) and test data cleanup have **not** been executed yet and remain the next step before any frontend integration begins.

---

## After this runbook passes

Per the standing plan: the correct next milestone is not "connect the whole BIK application." It is exactly what Stage 3/Stage 4 above prove — a disposable authenticated user can create one organisation and access only that organisation's records. Once every stage above shows `Passed`, the next development phase is frontend Supabase integration, starting with authentication and the `bootstrap_organisation()` call, not a wholesale migration of every tool at once.
