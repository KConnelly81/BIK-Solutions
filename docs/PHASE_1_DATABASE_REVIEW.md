# Phase 1 Database Review

**Purpose:** Full review of the Phase 1 Supabase schema (`001`–`007`) before any migration is applied to the live project (`hpcqncghvdrlvufxfdnd`).
**Status:** Findings only. No migration has been created or modified as part of this review.
**Scope:** `supabase/migrations/001`–`007`, `docs/decisions/README.md` (ADR-001–012), `docs/phase1-rls-test-plan.md`, and the current live JavaScript data models (`js/toolkit/project-store.js`, `js/toolkit/calculator.js`, tool `config.js` files).
**Date:** 2026-07-29

---

## 1. Executive Assessment

## **NOT READY**

One confirmed defect in `005_phase1_rls.sql` will make every RLS-protected query fail for every authenticated user the moment these migrations are applied — not a subtle security gap, an outright functional break. Two further confirmed defects (a permissions gap in the suspension mechanism, and a non-idempotent migration) and one important but currently unreachable design gap round out the items that should be fixed before deployment. None of these require a redesign — all four are small, mechanical, well-understood corrections to migrations already written. Once corrected and re-reviewed, this schema is well-isolated, its tenant boundary is sound, and its most complex piece (last-owner protection) is correctly engineered for the isolation level Supabase actually uses in production.

This assessment is deliberately not softened by the amount of good work already in this schema — a NOT READY verdict on a critical, deployment-blocking finding is the accurate one, independent of how much else passed review.

---

## 2. Critical Findings

### C1 — Missing `GRANT USAGE ON SCHEMA internal TO authenticated` breaks every RLS policy for every authenticated request

**Category:** Confirmed defect (deployment-blocking).

**Where:** `005_phase1_rls.sql` creates `internal.current_organisation_id()`, `internal.current_role()`, `internal.is_owner()`, `internal.is_admin()`, grants `EXECUTE` on each to `authenticated`, but never grants `USAGE` on the `internal` schema itself.

**Why this breaks everything:** In PostgreSQL, resolving *any* schema-qualified object reference — including a fully-qualified function call like `internal.current_organisation_id()` inside an RLS policy — requires the calling role to hold `USAGE` on that schema, independently of whatever object-level privilege (`EXECUTE`) it also holds. `CREATE SCHEMA internal;` grants privileges only to the creating role (the migration/`postgres` role) by default — `PUBLIC` (and therefore `authenticated`, which is an ordinary role, not exempt from `PUBLIC` grants) receives nothing. Every single policy in `005` — on `organisations`, `profiles`, `customers`, and `projects` — calls one of these `internal.*` functions in its `USING` or `WITH CHECK` clause. The result: the instant these migrations are applied and a real `authenticated` user issues any query against any RLS-protected table, Postgres will raise a permission-denied error resolving the schema reference, before the policy logic itself is ever evaluated.

**Why this wasn't caught earlier in this process:** every review and every reasoning pass so far (including the RLS audit in this same review) tested the *logic* of the policies — who they should allow and block — and that logic is correct. This is a privilege-model gap sitting underneath correct logic, the kind of thing that only surfaces when actually run as the `authenticated` role rather than as the schema-owning migration role (which implicitly has `USAGE` on every schema it creates, and would never hit this).

**Blast radius:** total, for `authenticated`. `service_role` is unaffected (bypasses RLS entirely, never evaluates these functions). `anon` is unaffected (no policy matches `anon` regardless). The bootstrap RPC (`006`) is unaffected — it doesn't call any `internal.*` function. `007`'s trigger functions are unaffected — they call `internal.assert_organisation_has_active_owner()` while running as `SECURITY DEFINER` under the *owning* role, which already has `USAGE` on `internal` by virtue of having created it.

**Confidence:** High, based on documented PostgreSQL schema-privilege semantics (`GRANT` reference: "USAGE ... is the privilege that is needed to be able to reference existing objects in a schema"). Not yet empirically verified against a live Supabase project, since nothing has been applied per your standing instruction — this should be the *first* thing confirmed once `005` is corrected and applied to a test project, and it is called out explicitly in the pre-deployment checklist (§10) for that reason.

**Exact correction:** add, immediately after `create schema if not exists internal;` in `005` (and see §9 for the full diff):
```sql
grant usage on schema internal to authenticated;
```

---

## 3. High-Priority Findings

### H1 — `profiles.status` can be freely self-reversed; suspension has no enforced effect on data access

**Category:** Confirmed defect + design gap.

**Two separate but related problems:**

1. **The self-escalation trigger doesn't cover `status`.** `public.prevent_unauthorised_profile_role_change()` (`005`) blocks a non-owner from changing `role` or `organisation_id` on any row, including their own. It does **not** check `status`. Combined with `profiles_update_self_or_owner`'s `USING (id = auth.uid() OR ...)` clause — which allows *any* user, any role, any current status, to update their own row — this means a member an owner has suspended (`status = 'suspended'`) can simply run `UPDATE profiles SET status = 'active' WHERE id = auth.uid()` and reverse it themselves. Nothing in RLS or the trigger stops this.

2. **`status = 'suspended'` has no enforced effect anywhere else in the schema.** `internal.current_organisation_id()` and `internal.current_role()` look up a caller's row by `id = auth.uid()` alone — neither checks `status`. Every tenant-isolation policy (`customers_*`, `projects_*`) is scoped only by `organisation_id = current_organisation_id()`. A suspended member's session continues to have full ordinary read/write access to their organisation's customers and projects; suspension is currently a label with no access consequence.

Put together: the entire "offboard a team member" workflow this column exists for (per its own `002` comment — "e.g. offboarded staff") does not actually work. A suspended member is not suspended in any way an attacker or a genuinely offboarded staff member would experience.

**Exact correction:** extend `prevent_unauthorised_profile_role_change()`'s condition to include `status`:
```sql
if (new.role is distinct from old.role
    or new.organisation_id is distinct from old.organisation_id
    or new.status is distinct from old.status)
   and not internal.is_owner() then
  raise exception 'Only an organisation owner may change a member''s role, status, or organisation.';
end if;
```
This closes problem 1. Problem 2 (suspension has no access consequence) is a larger design item — recommend explicitly scoping it for a follow-up migration (adding `and status = 'active'` to `current_organisation_id()`/`current_role()`'s lookups, or to the tenant-isolation policies directly) rather than folding it into this correction silently; it changes behaviour for every table, not just `profiles`, and deserves its own review pass.

### H2 — Last-owner protection's correctness depends on `READ COMMITTED`; silently unsafe under `REPEATABLE READ`

**Category:** Design trade-off / documentation gap (not currently reachable via the client-facing API — see confidence note).

`internal.assert_organisation_has_active_owner()` (`007`) acquires a per-organisation advisory lock, then re-queries `profiles` for the current active-owner count. Under `READ COMMITTED` (Postgres's default, and what every `authenticated`/`service_role` request through PostgREST actually runs at), each statement takes a fresh snapshot — so once a transaction is unblocked from the advisory lock, its count query correctly sees whatever the previous transaction just committed. This is what makes the concurrent-demotion protection (test plan #52–53) work.

Under `REPEATABLE READ`, a transaction's snapshot is fixed at transaction start, not per-statement. Waiting on the advisory lock changes *when* a blocked transaction proceeds, but not *what it can see* — its count query would still use its original, pre-lock snapshot, potentially missing another transaction's already-committed demotion of a different owner in the same organisation, and incorrectly permitting a demotion that leaves zero owners. `SERIALIZABLE` is not vulnerable to this — Postgres's predicate-lock-based conflict detection would abort one of the two transactions with a generic `40001 serialization_failure`, just not with this migration's friendly business-logic message.

**Practical reachability:** PostgREST (and therefore every ordinary Supabase client request — `authenticated` or `service_role` via the standard API) always executes at `READ COMMITTED`; isolation level is not client-configurable per request. This gap can currently only be triggered by custom server-side code that explicitly opens a `REPEATABLE READ` transaction before touching `profiles.role`/`status`/`organisation_id` or `organisations.status` — nothing in the current Phase 1 codebase does this. It is a real constraint on *future* code (an Edge Function, a scheduled job, a future admin tool), not an exploitable gap in what exists today.

**Recommendation:** document this constraint prominently (it currently is not documented anywhere), and consider a defensive guard inside `assert_organisation_has_active_owner()`:
```sql
if current_setting('transaction_isolation') = 'repeatable read' then
  raise exception 'Ownership-changing operations are not supported at REPEATABLE READ isolation.'
    using errcode = '25001'; -- active_sql_transaction / invalid_transaction_state family
end if;
```
This turns a silent correctness gap into a loud, immediate error for any future code that violates the assumption, rather than a rare, hard-to-reproduce race.

---

## 4. Medium-Priority Findings

### M1 — `005_phase1_rls.sql`'s ten `CREATE POLICY` statements are not idempotent

**Category:** Confirmed defect (deviates from the original stated requirement that every migration be idempotent where practical).

Every other migration in this set is safely re-runnable (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `CREATE OR REPLACE TRIGGER`, and — in `007` — `DROP TRIGGER IF EXISTS` before each `CREATE CONSTRAINT TRIGGER`, since constraint triggers have no `OR REPLACE` form). `005` does not follow this pattern for any of its ten policies (`organisations_select_own`, `organisations_update_owner_only`, `profiles_select_same_org`, `profiles_update_self_or_owner`, `customers_select_same_org`, `customers_insert_same_org`, `customers_update_same_org`, `projects_select_same_org`, `projects_insert_same_org`, `projects_update_same_org`) — Postgres has no `CREATE POLICY IF NOT EXISTS` or `CREATE OR REPLACE POLICY`, so re-running `005` against a database where it has already succeeded will fail with `policy "..." for table "..." already exists` on the first policy it reaches.

**Exact correction:** add `drop policy if exists <name> on <table>;` immediately before each `create policy` statement (see §9 for the full list).

### M2 — Money storage mismatch between the SQL schema and the live client

**Category:** Application-compatibility gap requiring a decision (not a schema defect).

`projects.estimated_contract_value_cents` (`004`) stores money as integer cents, per the convention documented in `technical-architecture.md`'s **Integration Layer** section ("All amounts stored as integer cents"). But that convention belongs to `js/integrations/` — an explicitly stub-only, not-yet-live subsystem. The actual **live** money-handling code, `js/toolkit/calculator.js` (used today by Quote Builder, Progress Claim, and every tool built on the Document Intelligence Engine), works entirely in **decimal-dollar floats**: `calcGST()`, `calcTotal()`, and `round2()` all operate on plain JavaScript numbers like `125.50`, and `formatAUD()` formats a dollar float directly. `quote-builder/config.js`'s line items (`it.unitPrice`) are dollar floats too.

This is not a bug in either place individually — cents-as-storage is the right database choice (avoids float drift), and the live calculator's dollar-float approach works fine client-side today. But nothing currently defines the conversion boundary: whoever wires `projects` (or, later, quotes/invoices) up to this schema needs to decide, explicitly, whether the boundary conversion (dollars × 100 → cents on write, ÷ 100 → dollars on read) happens in a thin API layer, or whether the client calculator itself becomes cents-native. **This decision is required before any live money field is connected to this schema**, and is not yet made anywhere in the documentation.

### M3 — Project status values: `complete` (live app) vs `completed` (schema), and no existing `draft` state

**Category:** Confirmed mismatch, requires a data-migration decision.

`js/toolkit/project-store.js`'s `PROJECT_STATUSES` uses `active` / `on-hold` / `complete` / `archived`. `projects_status_check` (`004`, per your explicit instruction to keep `on-hold`) uses `draft` / `active` / `on-hold` / `completed` / `archived`. Two concrete differences:
- **`complete` vs `completed`** — a straightforward spelling mismatch. Any migration or dual-write path must translate `complete → completed`, not copy the value verbatim; a naive copy would violate `projects_status_check` and reject every completed project.
- **`draft` has no equivalent in the live app.** Every existing localStorage project is created with `status: data.status || 'active'` — there is no "draft" project in current data. This is fine (new projects can use `draft` going forward), but a bulk migration of *existing* localStorage projects should map them all to something other than `draft` (most naturally `active`, `on-hold`, `completed`, or `archived`, per their current value) rather than defaulting them to `draft`, which would misrepresent already-underway work as not-yet-started.

### M4 — No existing `customers` data model to migrate from; extraction requires a dedup design, not a copy

**Category:** Application-compatibility gap requiring a design decision.

There is no `CustomerStore` or equivalent anywhere in `js/toolkit/` or `js/tools/` today (confirmed by search — no matches for `customer`/`Customer` in `js/toolkit`). Client data currently exists only as inline `clientName`/`clientEmail`/`clientPhone` fields duplicated across each `project-store.js` `Project` record and separately within every tool's own form state (`variation-notice`, `quote-builder`, etc., each with their own `clientName` field, unconnected to any shared identity). Populating `customers` from existing data is therefore not a straightforward table copy — it requires an explicit deduplication strategy (e.g., group by name + email within an organisation, decide a matching threshold, decide what happens to genuinely ambiguous cases) before `projects.customer_id` can be backfilled for any pre-existing project.

### M5 — `GET STACKED DIAGNOSTICS ... CONSTRAINT_NAME` behaviour for a partial unique *index* violation is unverified

**Category:** Unverified assumption, low risk.

`006`'s exception handler checks `v_constraint_name = 'organisations_abn_unique_idx'` to distinguish a duplicate-ABN conflict from any other uniqueness violation. `organisations_abn_unique_idx` is a `CREATE UNIQUE INDEX ... WHERE abn IS NOT NULL`, not a named table constraint added via `ALTER TABLE ... ADD CONSTRAINT`. PostgreSQL's internal unique-violation reporting (`errtableconstraint()`) is understood to populate the constraint-name diagnostic with the *index* name in both cases, which is why this was written this way — but this has not been empirically exercised against a live database in this review (nothing has been applied). Recommend this be the first thing explicitly tested once `006` is applied to a test project (duplicate-ABN test, plan #43), specifically checking that the friendly message — not the generic fallback — is what's returned.

### M6 — Deleting a sole owner's `auth.users` row will be silently rolled back, with a raw Postgres error

**Category:** Undocumented operational consequence (beneficial side effect, but needs a runbook note).

`profiles.id references auth.users(id) on delete cascade` means deleting an `auth.users` row cascades into deleting the corresponding `profiles` row — and cascade-triggered deletes fire ordinary triggers on the target table, including `007`'s deferred `profiles_last_owner_guard`. So: an admin action that deletes the `auth.users` row of an organisation's sole active owner (e.g. via Supabase's Auth admin panel or API) will, at commit, be rejected by the last-owner invariant — the whole delete fails with `"Organisation ... must retain at least one active owner."`, not a graceful message, and the auth account is **not** deleted. This is a genuinely beneficial consequence (it prevents exactly the ADR-012 violation it was designed to prevent), but nobody building a future admin console or GDPR-erasure tool would expect a `profiles` invariant to be *the* mechanism blocking an `auth.users` deletion unless this is documented. Recommend a short note in ADR-012 or a future admin-tooling spec: reassign or suspend ownership *before* deleting a sole owner's auth account, not after.

---

## 5. Low-Priority / Documentation Findings

### L1 — Trigger functions retain the default `PUBLIC EXECUTE` grant

`public.set_updated_at()` (`001`), `public.prevent_unauthorised_profile_role_change()` (`005`), and `public.enforce_last_owner_on_profiles()` / `public.enforce_last_owner_on_organisations()` (`007`, both `SECURITY DEFINER`) never have their default Postgres `PUBLIC EXECUTE` grant revoked, unlike every other function in this schema. **Not practically exploitable** — PostgreSQL refuses to invoke a `trigger`-returning function outside of trigger context regardless of privileges, so this cannot be called directly via RPC or a raw connection. Recommend revoking anyway, for consistency with this schema's own stated least-privilege posture and to avoid a future reader assuming an inconsistency means something is missed.

### L2 — `007`'s stated migration dependencies are broader than what it actually requires

`007`'s header lists `005` and `006` as dependencies. At the SQL level, `007` only references objects from `001` (`organisations`) and `002` (`profiles`) — it creates its own `internal` schema idempotently and never calls anything `005` or `006` created. The stated dependency is a *logical* one (007 only makes sense once RLS and bootstrap exist), not a hard execution-order requirement. Minor documentation-accuracy note; does not affect correctness of the numerical run order.

### L3 — `enforce_last_owner_on_organisations` fires on every `UPDATE`, not just `status` changes

Harmless at Phase 1 scale (organisation update volume is tiny), and not recommended as a change now — flagged only per the review's instruction not to leave premature-optimisation opportunities undocumented. If organisation-settings updates ever become frequent, scoping this to `AFTER UPDATE OF status` would avoid a redundant owner-count check on every unrelated field edit.

---

## 6. Migration-by-Migration Review

| Migration | Verdict | Notes |
|---|---|---|
| `001_create_organisations.sql` | Pass | Clean tenant root. Audit fields correctly anchor to `auth.users` to avoid the circular dependency with `profiles`. RLS enabled with zero policies (correct posture for this stage). |
| `002_create_profiles.sql` | Pass | 1:1 extension of `auth.users`, correct `ON DELETE CASCADE`, correct `ON DELETE RESTRICT` on `organisation_id`. Indexes match stated query patterns. |
| `003_create_customers.sql` | Pass | `customer_type` correctly non-exclusive (per your review). No cross-org uniqueness, as intended. |
| `004_create_projects.sql` | Pass | `on-hold` correctly restored (per your review). `customer_id` correctly nullable with `ON DELETE SET NULL`. See M2/M3 for compatibility items — not schema defects. |
| `005_phase1_rls.sql` | **Fail** | Contains C1 (missing schema `USAGE` grant — deployment-blocking) and M1 (non-idempotent policies). Policy *logic* itself is correct — see §7. |
| `006_create_organisation_bootstrap.sql` | Pass, with M5 as an open verification item | Privilege model, parameter validation, and concurrency handling are all sound. Unaffected by C1 (doesn't call any `internal.*` function). |
| `007_protect_last_owner.sql` | Pass, with H2 as a documented constraint | Deferred constraint-trigger design is correct for `READ COMMITTED`. Unaffected by C1 (its `internal` function is only called from `SECURITY DEFINER` triggers owned by the schema-owning role, not from client-facing policy evaluation). |

---

## 7. Security Assessment

### Tenant isolation, proven policy by policy

- **Anonymous users have no access:** every policy across all four tables is scoped `to authenticated` explicitly. This means `anon` doesn't fail a condition — it has zero matching policies for any operation on any of these tables. Confirmed by construction, not merely by a runtime check.
- **Users cannot read another organisation's records:** every `SELECT`/`UPDATE`/`INSERT` policy's `USING`/`WITH CHECK` includes `organisation_id = (select internal.current_organisation_id())` (or `id = ...` for `organisations` itself), and that function derives the value from the caller's own `profiles` row — never from client input. Subject to C1 being fixed (currently this evaluates to a permission error, not an information leak — fails closed, not open).
- **Users cannot forge `organisation_id`:** every `INSERT`/`UPDATE` policy's `WITH CHECK` re-validates `organisation_id` against the server-derived value, independent of whatever the client submits in the row body.
- **Members cannot alter protected profile fields:** `role` and `organisation_id` are blocked for non-owners by `prevent_unauthorised_profile_role_change`. **Except `status`, per H1** — this is the one confirmed gap in an otherwise correctly-designed protection.
- **Organisation administration remains owner-only:** `organisations_update_owner_only` requires `internal.is_owner()`; no `INSERT` or `DELETE` policy exists on `organisations` for any role.
- **No authenticated user has hard-delete access:** confirmed across all four tables — `organisations` and `profiles` never had a `DELETE` policy; `customers`/`projects` had theirs removed per ADR-010 and never re-added.

### Helper functions

| Function | `SECURITY DEFINER` necessary? | `search_path` | Recursive RLS risk | Data exposure |
|---|---|---|---|---|
| `internal.current_organisation_id()` | Yes — must bypass `profiles` RLS for this lookup to avoid depending on `profiles`' own SELECT policy remaining non-recursive as it evolves | `set search_path = ''`, fully qualified | None — `SECURITY DEFINER` means this query is never itself subject to RLS | Returns only the caller's own `organisation_id`; not directly callable by clients (lives in `internal`, `USAGE` gap notwithstanding) |
| `internal.current_role()` | Same as above | Same | None | Same |
| `internal.is_owner()` / `internal.is_admin()` | No — `SECURITY INVOKER` (default) is correct; they touch no table directly, only call the two `DEFINER` functions above | N/A (no table access) | None | None |
| `public.bootstrap_organisation()` | Yes — the entire point is to bypass RLS for exactly two inserts, safely, because identity is derived from `auth.uid()`, never a parameter | `set search_path = ''`, fully qualified | N/A (not a policy-evaluation function) | Returns only the newly created `organisation_id`/`profile_id` |
| `internal.assert_organisation_has_active_owner()` | Yes — must see true state regardless of caller's RLS visibility | `set search_path = ''`, fully qualified | N/A | No return value (`void`); raises or is silent |

**Function-owner safety:** all `SECURITY DEFINER` functions in this schema are created by the migration-running role (`postgres` in a standard Supabase deployment), which is the schema owner of every object they touch — none rely on an unexpectedly-privileged or externally-controlled owner. This should be explicitly confirmed for the actual deployment process (see §10) rather than assumed, since ownership is a deployment-process property, not something the SQL itself can guarantee (see §10, "Confirm function ownership").

### Bootstrap security audit (`006`)

RPC permissions (`EXECUTE` revoked from `PUBLIC`, granted to `authenticated` only), parameter validation (blank/whitespace-only rejected, ABN format pre-validated), identity derivation (`auth.uid()` only, never a parameter), JWT email handling (`auth.jwt() ->> 'email'`, no `auth.users` query), duplicate-call behaviour (advisory lock + explicit check, PK as backstop), duplicate-ABN handling (translated to a clean message via `GET STACKED DIAGNOSTICS`, subject to M5's open verification), transaction atomicity (both inserts in one function invocation), advisory-lock key construction (`hashtextextended`, per-user scoped, no cross-user contention), exception handling (custom, non-leaking messages for every anticipated failure), information leakage (none identified — no internal identifiers, table names, or constraint names are exposed to the caller) — all reviewed in detail during this migration's original design and re-confirmed here against the current file content; no new issues found beyond M5.

### Last-owner invariant audit (`007`)

Trigger event coverage (`INSERT`/`UPDATE`/`DELETE` on `profiles`, `INSERT`/`UPDATE` on `organisations`), deferred execution (`DEFERRABLE INITIALLY DEFERRED`, required for bootstrap and multi-row correctness — see §5's migration-by-migration notes), multi-row updates (correctly evaluated against final statement state, not partial progress), multi-statement transactions (correctly evaluated against final transaction state — enables a legitimate two-statement ownership transfer), profile deletion (covered via the `TG_OP = 'DELETE'` branch), organisation suspension/reactivation (covered via the organisations-side trigger; reactivation without an owner is rejected), concurrent demotions (covered via the per-organisation advisory lock under `READ COMMITTED`), advisory-lock collision risk (`hashtextextended`, 64-bit, per-organisation-scoped — collision risk is negligible and, even if it occurred, would only cause transient extra contention between two unrelated organisations, never an incorrect result), transaction isolation assumptions (**this is H2** — correct and complete under `READ COMMITTED`, safe-with-different-semantics under `SERIALIZABLE`, silently insufficient under `REPEATABLE READ`, though not reachable via the current API surface).

### Privilege and grant audit

- **Schema privileges:** `internal` schema — **C1: missing `USAGE` grant to `authenticated`.** No other custom schemas exist.
- **Table grants:** RLS is the access-control mechanism for all four Phase 1 tables; no direct table-level `GRANT`/`REVOKE` statements exist or are needed beyond what Supabase configures by default for `authenticated`/`anon` against `public` schema tables (standard Supabase project setup grants baseline `SELECT`/`INSERT`/`UPDATE`/`DELETE` at the table level to these roles, with RLS as the actual gate — this is Supabase's standard model and is not something this migration set needs to, or does, override).
- **Sequence grants:** none — every primary key is `uuid default gen_random_uuid()`; no `SERIAL`/`IDENTITY` columns exist anywhere in this schema. N/A, confirmed.
- **Function execute grants:** `internal.*` (4 functions, `005`) and `public.bootstrap_organisation()` (`006`) correctly revoke-then-grant to `authenticated` only. `internal.assert_organisation_has_active_owner()` (`007`) correctly has no client grant at all (by design — only called from `SECURITY DEFINER` triggers). Four trigger functions retain the default `PUBLIC` grant — **L1**, not exploitable, hygiene only.
- **Default `PUBLIC` privileges:** this review does not assume RLS alone prevents invocation of an unintentionally executable function — per the above, only the trigger functions (L1) have this exposure, and they are independently protected by Postgres's refusal to invoke `trigger`-returning functions outside trigger context, not by RLS.

---

## 8. Application Compatibility Assessment

| Area | Live JS model | SQL schema | Status |
|---|---|---|---|
| Project status values | `active`, `on-hold`, `complete`, `archived` (`project-store.js`) | `draft`, `active`, `on-hold`, `completed`, `archived` (`004`) | **Mismatch — M3.** `complete`→`completed` translation required; no existing project is ever `draft`. |
| Customer fields | No dedicated model — inline `clientName`/`clientEmail`/`clientPhone` per project/per tool | `customers` table, normalised, typed, org-scoped (`003`) | **No direct mapping — M4.** Requires a dedup/extraction design, not a copy. |
| Project fields | `id`, `name`, `status`, `clientName/Email/Phone`, `projectName`, `siteAddress`, `contractRef`, `contractValue`, `notes`, `createdAt`, `updatedAt` | `id`, `organisation_id`, `customer_id`, `project_number`, `external_reference`, `name`, `description`, `status`, `site_address`, `start_date`, `completion_date`, `estimated_contract_value_cents`, `notes`, audit fields | Broadly compatible. `name`/`projectName` duplication in JS collapses to one `name` column (a simplification, not a data-loss risk — the two are near-always identical today). `contractRef` has no direct SQL equivalent — maps most naturally to `external_reference` or `project_number` depending on what it's actually used for; needs an explicit decision, not assumed. |
| Date formats | ISO 8601 `YYYY-MM-DD` (`todayISO()`, `addDays()`); full ISO timestamps for `createdAt`/`updatedAt` | Postgres `date` / `timestamptz` | **Compatible.** Postgres accepts/emits ISO 8601 natively; no conversion logic needed beyond type casting. |
| Money values | Decimal-dollar floats throughout the live calculator/tools (`calculator.js`, `quote-builder`) | Integer cents (`estimated_contract_value_cents`) | **Mismatch requiring a decision — M2.** Not yet resolved anywhere in the documentation. |
| Nullable vs required | `name` always has an app-supplied fallback; `contractValue` explicitly nullable; most fields default to `''` | `name text not null`; most other fields nullable | Compatible — JS's own fallback behaviour already guarantees what the schema requires. |

**Summary of required decisions before replacing `localStorage`:** M2 (money boundary), M3 (status value mapping + bulk-migration default), M4 (customer dedup strategy), and a decision on `contractRef`'s SQL mapping. None of these are schema defects — they are product/engineering decisions this schema correctly leaves open rather than guessing at.

---

## 9. Test Coverage Matrix

Every policy, function, trigger, and named architectural invariant, mapped to its existing test ID(s) in `docs/phase1-rls-test-plan.md`, or flagged as missing.

| Object | Test ID(s) | Coverage |
|---|---|---|
| `organisations_select_own` | 1, 8 | Covered |
| `organisations_update_owner_only` | 11–13 | Covered |
| No `organisations` INSERT/DELETE policy | 14, 15, 33 | Covered |
| `profiles_select_same_org` | 4 | Covered |
| `profiles_update_self_or_owner` | 27, 28 | Covered |
| `prevent_unauthorised_profile_role_change` (role/org) | 25, 26 | Covered |
| `prevent_unauthorised_profile_role_change` (status) | — | **Missing — see below** |
| No `profiles` INSERT/DELETE policy | — | **Partially missing — no test confirms ordinary INSERT/DELETE is rejected pre-bootstrap** |
| `customers_select/insert/update_same_org` | 3, 9, 10 (select/insert), 16 (pattern reused for projects, not customers directly) | **Partially missing — no explicit customer INSERT/UPDATE cross-org test analogous to #5/#6 for projects** |
| No `customers`/`projects` DELETE policy | 17–24 | Covered |
| `internal.current_organisation_id/role/is_owner/is_admin` `USAGE` grant | — | **Missing — see C1** |
| `bootstrap_organisation()` — all aspects | 35–45 | Covered |
| `007` triggers — all named scenarios | 46–58 | Covered |
| `READ COMMITTED` correctness | 52, 53 (implicitly, since ordinary client sessions run at `READ COMMITTED`) | Covered implicitly |
| `REPEATABLE READ` / `SERIALIZABLE` behaviour | — | **Missing — see H2** |
| Migration idempotency (re-run each file twice) | — | **Missing — see M1** |

### Missing tests to add

1. **Foundational schema-usage smoke test** — "as an ordinary `authenticated` user with a valid profile, run `select 1` filtered through any RLS policy that calls an `internal.*` function (e.g. `select * from projects`)." This single test would have caught C1 immediately; it does not currently exist as an explicit, first test in the plan — the plan's tests assume this works and build on it.
2. **`profiles.status` self-reversal test** — "a suspended member updates their own `status` back to `active`" (currently succeeds — should be rejected once H1 is fixed).
3. **Suspended-member access test** — "a suspended member can still `select`/`insert`/`update` `customers`/`projects` in their organisation" (currently succeeds — documents the second half of H1 until the broader access-scoping decision is made).
4. **Idempotency test** — re-apply each of `001`–`007` a second time against a database where they've already succeeded; confirm no errors. Would have caught M1.
5. **Isolation-level test** (lower priority, given H2's limited practical reachability) — attempt an ownership-changing operation inside an explicit `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ` block and confirm the outcome matches whatever H2's eventual resolution specifies (either a documented "not supported" error, or explicit acceptance of the risk).

### Tests requiring two users or two organisations

1–6, 43 (duplicate ABN, second user), 52, 53 (concurrent demotion).

### Tests requiring simultaneous database sessions

44 (concurrent double bootstrap), 52, 53 (concurrent demotion/suspension) — none of these can be expressed as a single sequential script; each needs two genuinely overlapping sessions (two `psql` connections, or two client SDK sessions timed to race).

### Tests requiring `service_role`

29–32, 48, 49, 51, 54–56, 58 — anywhere the test description specifies `service_role`, by design, since these exercise behaviour that must hold even when RLS is bypassed.

### Tests that cannot be safely performed through the normal client SDK

- All `service_role`-actor tests above — the standard client SDK (anon/authenticated key) cannot assume the `service_role` identity; these require either the Supabase service-role key used directly, or a `psql`/SQL-editor connection with an explicitly set role.
- Concurrency tests (44, 52, 53) — the client SDK's typical request/response pattern doesn't naturally express "hold a transaction open while another session acts" without either two raw `psql` sessions or careful manual coordination; not something a simple integration-test script using only the JS client library can express without additional tooling (e.g. two separate `pg` connections with manual `BEGIN`/lock/commit sequencing).
- The proposed isolation-level test above — PostgREST does not expose a way to set transaction isolation level per request; this can only be tested via a direct database connection issuing raw `SET TRANSACTION ISOLATION LEVEL ...`.

---

## 10. Exact Corrections Recommended

Presented as the precise change each finding requires. **None of these have been applied — this is a specification for the next step, pending your approval.**

**C1 — add to `005_phase1_rls.sql`**, immediately after `create schema if not exists internal;`:
```sql
grant usage on schema internal to authenticated;
```

**H1 — replace the condition in `public.prevent_unauthorised_profile_role_change()` (`005`):**
```sql
if (new.role is distinct from old.role
    or new.organisation_id is distinct from old.organisation_id
    or new.status is distinct from old.status)
   and not internal.is_owner() then
  raise exception 'Only an organisation owner may change a member''s role, status, or organisation.';
end if;
```
(The broader "suspension has no access consequence" half of H1 is a separate, larger decision — recommend scoping as its own follow-up, not silently bundled into this fix.)

**H2 — add to `internal.assert_organisation_has_active_owner()` (`007`), as the first statement in the function body:**
```sql
if current_setting('transaction_isolation') = 'repeatable read' then
  raise exception 'Ownership-changing operations are not supported at REPEATABLE READ isolation.'
    using errcode = '25001';
end if;
```
(Pending your confirmation this guard is wanted — the alternative is documentation-only, accepting the current-zero-practical-reachability assessment.)

**M1 — add before each of the ten `CREATE POLICY` statements in `005`**, e.g.:
```sql
drop policy if exists organisations_select_own on public.organisations;
create policy organisations_select_own ...
```
(repeated for all ten: `organisations_select_own`, `organisations_update_owner_only`, `profiles_select_same_org`, `profiles_update_self_or_owner`, `customers_select_same_org`, `customers_insert_same_org`, `customers_update_same_org`, `projects_select_same_org`, `projects_insert_same_org`, `projects_update_same_org`).

**L1 — add for each trigger function**, e.g.:
```sql
revoke all on function public.set_updated_at() from public;
revoke all on function public.prevent_unauthorised_profile_role_change() from public;
revoke all on function public.enforce_last_owner_on_profiles() from public;
revoke all on function public.enforce_last_owner_on_organisations() from public;
```

**M2, M3, M4 — not SQL corrections.** These require product/engineering decisions (documented in §8) before any corresponding SQL or migration script is written. Recommend resolving them as explicit, separate decisions — not guessed at while fixing the items above.

---

## 11. Rollback and Recovery

Documented approach only, per your instruction — no destructive scripts created.

**If migration execution fails halfway through applying `001`–`007`:** every table-creation statement uses `IF NOT EXISTS` and every function uses `CREATE OR REPLACE`, so re-running the same migration file after fixing whatever caused the failure is safe for `001`–`004` and `006`–`007` (with `007`'s `DROP TRIGGER IF EXISTS` guards). `005` is the one exception (M1) — until that's corrected, a failed partial application of `005` must be manually inspected (`\d+` on each table, or `select * from pg_policies where schemaname='public'`) to determine which policies already exist before re-running, or the missing `DROP POLICY IF EXISTS` guards should be added first regardless of whether M1 is being fixed for its own sake.

**If an RLS policy locks out all users:** this is precisely what C1 currently does. Recovery does not require disabling RLS (which would remove tenant isolation entirely, a worse outcome) — it requires connecting as a role that already has `USAGE` on the affected schema (the `postgres`/migration role, or any role explicitly granted it) and applying the missing grant. `service_role` remains available as an emergency read/write path throughout, since it bypasses RLS entirely — it does not bypass the schema-usage requirement for `internal.*` calls made *from a policy evaluated for `authenticated`*, but `service_role` doesn't evaluate those policies at all, so it is unaffected and can be used to diagnose and fix the issue without ever being locked out itself.

**If bootstrap creates unexpected data:** `bootstrap_organisation()` only ever creates one `organisations` row and one `profiles` row per call, both traceable via `created_by = <the calling user's auth.uid()>`. Recovery is a manual, `service_role`-executed `DELETE` of the specific rows (the `organisations` row can only be deleted once its `profiles` row is gone first, per the `RESTRICT` FK — delete `profiles` first, then `organisations`). This is a manual support action, not something to script generically, since "unexpected" data by definition needs human judgement about what's actually wrong before removing anything.

**If the ownership trigger (`007`) blocks legitimate administration** (e.g. a genuine need to remove an organisation's sole owner without an immediate replacement — the ADR-010/ADR-012 suspended-org scenario): the documented path is to first set `organisations.status = 'suspended'` (which the trigger's own scope, per H2's confirmation that the invariant only applies to `status = 'active'`, correctly permits with zero owners), perform the necessary profile changes, then either reactivate with a valid owner in place or leave the organisation suspended. There is deliberately no bypass mechanism for the trigger itself while an organisation remains `active` — that would defeat the invariant's purpose. If a genuine emergency requires overriding it on an active organisation, the only correct path is a privileged, logged, one-off `SET session_replication_role = replica;` (superuser only, disables all ordinary triggers for the session) immediately followed by manual restoration of the invariant and `SET session_replication_role = default;` — this should never be routine, and should be treated as an incident requiring its own record, not a documented "normal" recovery step.

---

## 12. Final Pre-Deployment Checklist

- [ ] Apply C1's correction to `005` (schema `USAGE` grant) — **blocking**.
- [ ] Apply H1's correction to `005` (extend the self-escalation trigger to cover `status`) — recommended before deployment.
- [ ] Decide on H2's defensive guard (add it, or accept documentation-only given current zero API-reachability) — recommended before deployment, not strictly blocking.
- [ ] Apply M1's correction to `005` (idempotent policies) — recommended before deployment.
- [ ] Apply L1's correction (revoke default grants on trigger functions) — optional, hygiene.
- [ ] Apply all corrected migrations to a **test/staging** Supabase project first — never the live project as the first application.
- [ ] Re-run every migration file a second time against the now-migrated test project, confirming full idempotency (this specifically re-validates M1's fix and the general idempotency claim made throughout this migration set).
- [ ] Execute the full `docs/phase1-rls-test-plan.md` (tests 1–58) against the test project, as the specified roles — not as `service_role` for any test that doesn't call for it.
- [ ] Execute the four newly identified missing tests from §9 (schema-usage smoke test, `profiles.status` self-reversal, suspended-member access, idempotency re-run).
- [ ] Explicitly verify M5 (the `organisations_abn_unique_idx` diagnostic-name behaviour) via test #43.
- [ ] Confirm the actual deployment process: which role runs these migrations against the real project (`hpcqncghvdrlvufxfdnd`), and confirm that role owns every `SECURITY DEFINER` function it creates — this is a property of the deployment process, not of the SQL, and this review cannot confirm it without knowing how migrations will actually be applied (Supabase Dashboard SQL editor, CLI, or the MCP `apply_migration` tool all use the connected role, which should be confirmed to be the intended one).
- [ ] Resolve M2 (money boundary decision), M3 (status mapping + bulk-migration default), and M4 (customer dedup strategy) before connecting any live UI to this schema — not blocking for applying the schema itself, but blocking for the localStorage replacement work that motivated it.
- [ ] Decide `contractRef`'s mapping (`external_reference` vs `project_number` vs a new column) before any project data migration script is written.
- [ ] Only after all of the above: apply to the live project (`hpcqncghvdrlvufxfdnd`), with `docs/phase1-rls-test-plan.md` re-run against it as a final confirmation.

---

## Related documents

- `supabase/migrations/001`–`007` — the migrations under review
- `docs/decisions/README.md` — ADR-001–012
- `docs/phase1-rls-test-plan.md` — the test plan referenced throughout §9
- `js/toolkit/project-store.js`, `js/toolkit/calculator.js` — the live data models compared in §8
