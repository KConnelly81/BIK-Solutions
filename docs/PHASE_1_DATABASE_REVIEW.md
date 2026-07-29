# Phase 1 Database Review

**Purpose:** Full review of the Phase 1 Supabase schema (`001`–`007`) before any migration is applied to the live project (`hpcqncghvdrlvufxfdnd`).
**Status:** Findings only. No migration has been created or modified as part of this review.
**Scope:** `supabase/migrations/001`–`007`, `docs/decisions/README.md` (ADR-001–012), `docs/phase1-rls-test-plan.md`, and the current live JavaScript data models (`js/toolkit/project-store.js`, `js/toolkit/calculator.js`, tool `config.js` files).
**Date:** 2026-07-29

---

## 1. Executive Assessment

## **READY WITH ACCEPTED LIMITATIONS** (database schema) — revised 2026-07-29, second complete review pass

**This is a change from the first correction pass's NOT READY verdict**, on the basis of a full second review of `001`–`007` as one complete release, per this pass's explicit scope. The basis for the upgrade:

- Both findings that were genuinely blocking are now corrected and re-verified by re-reading the corrected files in full: **C1** (missing `internal` schema `USAGE` grant — would have broken every authenticated request) and the access-enforcement half of **H1** (suspension had no effect — closed by ADR-013). Both are structural, code-level fixes, not documentation.
- **H2** (last-owner protection's `REPEATABLE READ` limitation) remains open **by deliberate design**, not oversight — it is unreachable through the current API surface (PostgREST only ever runs at `READ COMMITTED`), fully documented in three places (`007`, ADR-009, this document), and comes with a concrete recommendation (route future ownership-management work through a controlled RPC) for whoever eventually needs to lift the limitation. This is exactly what "ACCEPTED LIMITATIONS" — as distinct from "READY" outright — exists to capture: a known, bounded, documented gap, not an unknown one.
- **M5** and **M6** — the two items that remained genuinely open after the first correction pass — have both been resolved by rigorous analysis in this second pass (§14, and the `GET STACKED DIAGNOSTICS` analysis in the M5 finding below), not deferred further.
- **M1**'s rerun-language has been made precise rather than a blanket claim (per this pass's explicit instruction), and **L1** (trigger-function execute grants) is now corrected, closing every item that was open after the first pass except the two narrow, explicitly-scoped test-coverage gaps noted in §9 (which remain low-priority and out of scope by design, not overlooked).
- A full function-execution-privilege audit (§13) was performed as new work in this pass and found and corrected one class of defect (L1) consistently across every trigger function in the schema.

**Why not unconditional READY:** H2 is a real, permanent-for-now limitation, not a temporary gap being tracked to zero — "ACCEPTED LIMITATIONS" is the accurate label, not "READY" unqualified. Nothing in `001`–`007` has been empirically executed against a live database at any point in this process (every review, including this one, has been static analysis and code reading) — the pre-deployment procedure in §17 is not a formality, it is the first time any of this is actually run.

**Database vs application — read §15 before treating this verdict as "ship the product."** This assessment covers the **database schema only**. The live application is not close to cutover-ready — see §15 for the explicit, separate list of what blocks connecting real users to this schema, none of which is a database concern.

---

## 2. Critical Findings

### C1 — Missing `GRANT USAGE ON SCHEMA internal TO authenticated` breaks every RLS policy for every authenticated request

**Status: CORRECTED** (2026-07-29). `005_phase1_rls.sql` now explicitly sets the full privilege posture for `internal` — `revoke all on schema internal from public;`, `revoke all on schema internal from anon;`, `grant usage on schema internal to authenticated;` — immediately after the schema is created, rather than relying on (correct, but previously unstated) PostgreSQL defaults. `authenticated` receives `USAGE` only, never `CREATE`, so it cannot create objects inside `internal`. Test #59 added to confirm this empirically once applied. **Not yet empirically verified against a live database** (nothing has been applied) — remains the first item on the pre-deployment checklist.

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

**Status: CORRECTED, and expanded beyond the original finding.** Problem 1 (self-reversal) is fixed exactly as specified: `prevent_unauthorised_profile_role_change()` (`005`) now also guards `status`, alongside `role`/`organisation_id`. Problem 2 (suspension has no access consequence) was originally scoped as a "larger design item" for a follow-up — it has instead been resolved directly in this same correction pass, as **ADR-013**: `internal.current_organisation_id()`/`current_role()` now require both the caller's profile and their organisation to be `status = 'active'`, and every tenant-isolation policy inherits this automatically. See the new "Suspension access enforcement" section of `docs/phase1-rls-test-plan.md` (tests #66–72) and ADR-013 for the full consequence analysis, including the accepted trade-off that a suspended organisation's owner cannot reactivate it through the ordinary API.

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

**Status: ACCEPTED LIMITATION — documented, not redesigned, per explicit instruction.** `007_protect_last_owner.sql` now carries an explicit header comment stating the `READ COMMITTED` requirement, the `REPEATABLE READ` failure mode (a transaction may retain a stale snapshot after obtaining the advisory lock), and the `SERIALIZABLE` fallback behaviour, verbatim as analysed below. The same limitation is recorded in ADR-009. **No runtime guard was added to `007`** — this remains a documentation-only correction, deliberately, since redesigning `007` was explicitly out of scope for this pass. Recommendation carried forward unchanged: route any future ownership-management capability through a single controlled RPC known to run at `READ COMMITTED` (or `SERIALIZABLE` with retry handling) before exposing it more broadly. Test #76 added to `docs/phase1-rls-test-plan.md`, explicitly recorded as documenting the unsupported configuration rather than asserting correct behaviour.

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

**Status: CORRECTED** (2026-07-29). Every `CREATE POLICY` in `005` is now preceded by a matching `DROP POLICY IF EXISTS`. With this fix, every object `005` creates or modifies (schema + grants, four helper functions, ten policies, the self-escalation trigger and its function) is genuinely rerunnable — `005`'s header comment now states this explicitly, using "rerunnable in the intended clean development workflow" rather than an unqualified "idempotent" claim, per instruction. Tests #73–74 added to `docs/phase1-rls-test-plan.md` to confirm this empirically once applied.

**Category:** Confirmed defect (deviates from the original stated requirement that every migration be idempotent where practical).

Every other migration in this set is safely re-runnable (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `CREATE OR REPLACE TRIGGER`, and — in `007` — `DROP TRIGGER IF EXISTS` before each `CREATE CONSTRAINT TRIGGER`, since constraint triggers have no `OR REPLACE` form). `005` does not follow this pattern for any of its ten policies (`organisations_select_own`, `organisations_update_owner_only`, `profiles_select_same_org`, `profiles_update_self_or_owner`, `customers_select_same_org`, `customers_insert_same_org`, `customers_update_same_org`, `projects_select_same_org`, `projects_insert_same_org`, `projects_update_same_org`) — Postgres has no `CREATE POLICY IF NOT EXISTS` or `CREATE OR REPLACE POLICY`, so re-running `005` against a database where it has already succeeded will fail with `policy "..." for table "..." already exists` on the first policy it reaches.

**Exact correction:** add `drop policy if exists <name> on <table>;` immediately before each `create policy` statement (see §9 for the full list).

### M2 — Money storage mismatch between the SQL schema and the live client

**Status: DEFERRED REQUIREMENT — decision now formally recorded in §8a, schema deliberately unchanged.** Per instruction, the database is not being altered to mirror the live client's decimal-dollar convention. The conversion-boundary decision itself has been made and documented (§8a): SQL keeps integer cents; the application layer converts at the boundary. The actual conversion code is not yet written — that remains deferred until a live field is connected to this schema.

**Category:** Application-compatibility gap requiring a decision (not a schema defect).

`projects.estimated_contract_value_cents` (`004`) stores money as integer cents, per the convention documented in `technical-architecture.md`'s **Integration Layer** section ("All amounts stored as integer cents"). But that convention belongs to `js/integrations/` — an explicitly stub-only, not-yet-live subsystem. The actual **live** money-handling code, `js/toolkit/calculator.js` (used today by Quote Builder, Progress Claim, and every tool built on the Document Intelligence Engine), works entirely in **decimal-dollar floats**: `calcGST()`, `calcTotal()`, and `round2()` all operate on plain JavaScript numbers like `125.50`, and `formatAUD()` formats a dollar float directly. `quote-builder/config.js`'s line items (`it.unitPrice`) are dollar floats too.

This is not a bug in either place individually — cents-as-storage is the right database choice (avoids float drift), and the live calculator's dollar-float approach works fine client-side today. But nothing currently defines the conversion boundary: whoever wires `projects` (or, later, quotes/invoices) up to this schema needs to decide, explicitly, whether the boundary conversion (dollars × 100 → cents on write, ÷ 100 → dollars on read) happens in a thin API layer, or whether the client calculator itself becomes cents-native. **This decision is required before any live money field is connected to this schema**, and is not yet made anywhere in the documentation.

### M3 — Project status values: `complete` (live app) vs `completed` (schema), and no existing `draft` state

**Status: DEFERRED REQUIREMENT — decision now formally recorded in §8a, schema deliberately unchanged.** The schema keeps `completed` (not changed to match the live app's `complete`) — per instruction, the database is the standard, and the legacy JS value is what gets mapped during migration, not the other way around. Recorded formally in §8a. The actual mapping/migration script is not yet written.

**Category:** Confirmed mismatch, requires a data-migration decision.

`js/toolkit/project-store.js`'s `PROJECT_STATUSES` uses `active` / `on-hold` / `complete` / `archived`. `projects_status_check` (`004`, per your explicit instruction to keep `on-hold`) uses `draft` / `active` / `on-hold` / `completed` / `archived`. Two concrete differences:
- **`complete` vs `completed`** — a straightforward spelling mismatch. Any migration or dual-write path must translate `complete → completed`, not copy the value verbatim; a naive copy would violate `projects_status_check` and reject every completed project.
- **`draft` has no equivalent in the live app.** Every existing localStorage project is created with `status: data.status || 'active'` — there is no "draft" project in current data. This is fine (new projects can use `draft` going forward), but a bulk migration of *existing* localStorage projects should map them all to something other than `draft` (most naturally `active`, `on-hold`, `completed`, or `archived`, per their current value) rather than defaulting them to `draft`, which would misrepresent already-underway work as not-yet-started.

### M4 — No existing `customers` data model to migrate from; extraction requires a dedup design, not a copy

**Status: DEFERRED REQUIREMENT — decision now formally recorded in §8a.** `customers` (`003`) is confirmed as a newly introduced, persistent model with no legacy equivalent — it is the source of truth going forward, not one of two parallel models. The one-time extraction/backfill from scattered project-level fields remains a separate, deferred piece of work (its dedup strategy is not designed as part of this correction pass — recording the decision is not the same as designing the ETL).

**Category:** Application-compatibility gap requiring a design decision.

There is no `CustomerStore` or equivalent anywhere in `js/toolkit/` or `js/tools/` today (confirmed by search — no matches for `customer`/`Customer` in `js/toolkit`). Client data currently exists only as inline `clientName`/`clientEmail`/`clientPhone` fields duplicated across each `project-store.js` `Project` record and separately within every tool's own form state (`variation-notice`, `quote-builder`, etc., each with their own `clientName` field, unconnected to any shared identity). Populating `customers` from existing data is therefore not a straightforward table copy — it requires an explicit deduplication strategy (e.g., group by name + email within an organisation, decide a matching threshold, decide what happens to genuinely ambiguous cases) before `projects.customer_id` can be backfilled for any pre-existing project.

### M5 — `GET STACKED DIAGNOSTICS ... CONSTRAINT_NAME` behaviour for a partial unique *index* violation is unverified

**Status: RESOLVED by analysis (2026-07-29, second review pass). No code change required.** PostgreSQL's internal unique-violation reporting path (`errtableconstraint()`, invoked from the btree unique-check code) populates the constraint-name diagnostic field using the *index relation's name*, for both a plain `CREATE UNIQUE INDEX` and a named table constraint added via `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE` — the diagnostic field does not distinguish between the two creation paths, because both are enforced through the same underlying unique-index mechanism. `organisations_abn_unique_idx` is therefore correctly identified by `006`'s `GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;` regardless of being a partial index rather than a `pg_constraint` row. This is documented, primary PostgreSQL behaviour (the same mechanism `ON CONFLICT` and most ORMs rely on to catch a specific unique violation by name), not an assumption. Test #43 (existing) and #86 (new, added this pass) remain as empirical confirmation at first deployment — standard due diligence, not because the conclusion is in doubt.

**Category:** Unverified assumption, low risk.

`006`'s exception handler checks `v_constraint_name = 'organisations_abn_unique_idx'` to distinguish a duplicate-ABN conflict from any other uniqueness violation. `organisations_abn_unique_idx` is a `CREATE UNIQUE INDEX ... WHERE abn IS NOT NULL`, not a named table constraint added via `ALTER TABLE ... ADD CONSTRAINT`. PostgreSQL's internal unique-violation reporting (`errtableconstraint()`) is understood to populate the constraint-name diagnostic with the *index* name in both cases, which is why this was written this way — but this has not been empirically exercised against a live database in this review (nothing has been applied). Recommend this be the first thing explicitly tested once `006` is applied to a test project (duplicate-ABN test, plan #43), specifically checking that the friendly message — not the generic fallback — is what's returned.

### M6 — Deleting a sole owner's `auth.users` row will be silently rolled back, with a raw Postgres error

**Status: RESOLVED — confirmed by analysis and formally documented (2026-07-29, second review pass). No code change; this was never a code defect.** Promoted to its own full analysis in §14 below, per the second review's explicit instruction that this be treated as "the most important remaining issue," not an edge-case footnote. Confirmed: cascaded deletes fire ordinary triggers (standard, documented PostgreSQL behaviour), so `007`'s deferred `profiles_last_owner_guard` correctly rejects deletion of a sole active owner's `auth.users` row, rolling back the entire transaction — the account is not deleted. **The required administrative sequence (assign a second owner first, or suspend the organisation first) is now documented in ADR-012**, not left implicit. Tests #87–89 added to confirm empirically.

**Category:** Undocumented operational consequence (beneficial side effect, but needs a runbook note).

`profiles.id references auth.users(id) on delete cascade` means deleting an `auth.users` row cascades into deleting the corresponding `profiles` row — and cascade-triggered deletes fire ordinary triggers on the target table, including `007`'s deferred `profiles_last_owner_guard`. So: an admin action that deletes the `auth.users` row of an organisation's sole active owner (e.g. via Supabase's Auth admin panel or API) will, at commit, be rejected by the last-owner invariant — the whole delete fails with `"Organisation ... must retain at least one active owner."`, not a graceful message, and the auth account is **not** deleted. This is a genuinely beneficial consequence (it prevents exactly the ADR-012 violation it was designed to prevent), but nobody building a future admin console or GDPR-erasure tool would expect a `profiles` invariant to be *the* mechanism blocking an `auth.users` deletion unless this is documented. Recommend a short note in ADR-012 or a future admin-tooling spec: reassign or suspend ownership *before* deleting a sole owner's auth account, not after.

---

## 5. Low-Priority / Documentation Findings

### L1 — Trigger functions retain the default `PUBLIC EXECUTE` grant

**Status: CORRECTED (2026-07-29, second review pass).** `public.set_updated_at()` (`001`), `public.prevent_unauthorised_profile_role_change()` (`005`), and `public.enforce_last_owner_on_profiles()`/`public.enforce_last_owner_on_organisations()` (`007`) now each have the default `PUBLIC` execute grant explicitly revoked, from `public`, `anon`, and `authenticated`. Reclassified from "hygiene" to a corrected item per this pass's explicit instruction to treat unintended function execution as a defect rather than documentation-only — the practical exploitability assessment is unchanged (Postgres refuses to invoke a `trigger`-returning function outside trigger context regardless of grants), but the privilege state itself is now explicit rather than inherited-and-unreviewed.


`public.set_updated_at()` (`001`), `public.prevent_unauthorised_profile_role_change()` (`005`), and `public.enforce_last_owner_on_profiles()` / `public.enforce_last_owner_on_organisations()` (`007`, both `SECURITY DEFINER`) never have their default Postgres `PUBLIC EXECUTE` grant revoked, unlike every other function in this schema. **Not practically exploitable** — PostgreSQL refuses to invoke a `trigger`-returning function outside of trigger context regardless of privileges, so this cannot be called directly via RPC or a raw connection. Recommend revoking anyway, for consistency with this schema's own stated least-privilege posture and to avoid a future reader assuming an inconsistency means something is missed.

### L2 — `007`'s stated migration dependencies are broader than what it actually requires

**Status: OPEN, unchanged.** Not in scope for this correction pass.


`007`'s header lists `005` and `006` as dependencies. At the SQL level, `007` only references objects from `001` (`organisations`) and `002` (`profiles`) — it creates its own `internal` schema idempotently and never calls anything `005` or `006` created. The stated dependency is a *logical* one (007 only makes sense once RLS and bootstrap exist), not a hard execution-order requirement. Minor documentation-accuracy note; does not affect correctness of the numerical run order.

### L3 — `enforce_last_owner_on_organisations` fires on every `UPDATE`, not just `status` changes

**Status: OPEN, unchanged — and still not recommended to act on now**, consistent with the original finding's own instruction not to apply speculative optimisation.


Harmless at Phase 1 scale (organisation update volume is tiny), and not recommended as a change now — flagged only per the review's instruction not to leave premature-optimisation opportunities undocumented. If organisation-settings updates ever become frequent, scoping this to `AFTER UPDATE OF status` would avoid a redundant owner-count check on every unrelated field edit.

---

## 6. Migration-by-Migration Review

| Migration | Verdict | Notes |
|---|---|---|
| `001_create_organisations.sql` | Pass | Clean tenant root. Audit fields correctly anchor to `auth.users` to avoid the circular dependency with `profiles`. RLS enabled with zero policies (correct posture for this stage). |
| `002_create_profiles.sql` | Pass | 1:1 extension of `auth.users`, correct `ON DELETE CASCADE`, correct `ON DELETE RESTRICT` on `organisation_id`. Indexes match stated query patterns. |
| `003_create_customers.sql` | Pass | `customer_type` correctly non-exclusive (per your review). No cross-org uniqueness, as intended. |
| `004_create_projects.sql` | Pass | `on-hold` correctly restored (per your review). `customer_id` correctly nullable with `ON DELETE SET NULL`. See M2/M3 for compatibility items — not schema defects. |
| `005_phase1_rls.sql` | **Corrected (2026-07-29)** — was Fail | C1 and M1 both corrected directly in this file; H1 corrected and expanded into ADR-013's suspension enforcement. Policy *logic* itself was, and remains, correct — see §7. Not yet empirically verified against a live database. |
| `006_create_organisation_bootstrap.sql` | Pass, with M5 as an open verification item | Unchanged in this correction pass. Privilege model, parameter validation, and concurrency handling are all sound. Unaffected by C1 (doesn't call any `internal.*` function) and unaffected by ADR-013 (doesn't call `internal.current_organisation_id()`/`current_role()` either — it derives identity from `auth.uid()` directly). |
| `007_protect_last_owner.sql` | Pass, with H2 as a documented (not redesigned) constraint | Isolation-level limitation now explicitly documented in-file, per instruction not to redesign. Confirmed unaffected by ADR-013's suspension filtering — `internal.assert_organisation_has_active_owner()` queries by direct parameter, not through the now-filtered session helpers (documented in-file as part of this pass). Unaffected by C1 for the same reason as before. |

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

### 8a. Application Migration Decisions (Recorded, 2026-07-29)

The database schema is **not** being changed to mirror the live JavaScript app's inconsistencies (per explicit instruction). Instead, the following are recorded here as the formal, binding decisions for whoever connects live code to this schema — a dedicated checklist, not a re-statement of M2–M4's problem descriptions above.

1. **Money is stored as integer cents in SQL; the application's decimal-dollar values must be converted at the boundary.** `projects.estimated_contract_value_cents` (and any future money column) remains cents-native. The live calculator (`js/toolkit/calculator.js`) is not required to become cents-native in Phase 1 — the conversion (`dollars * 100` on write, `cents / 100` on read) happens at whatever layer connects the client to this schema (a thin API/service function, not scattered across call sites). This decision does not yet have an implementation; it exists so the implementation, when written, has one specified boundary rather than an improvised one.
2. **Project status is standardised on `completed`, not `complete`.** The SQL schema's spelling is authoritative. Any data-migration path that reads an existing localStorage project must map `complete → completed` explicitly — copying the value verbatim will violate `projects_status_check` and reject the row. Existing projects must **not** default to the new `draft` status during migration (no existing project is a draft); each should map to its current value (translated per the above) or, at minimum, default to `active` if its current status is otherwise ambiguous.
3. **Customer data migration starts from `customers` as a newly introduced, persistent model** — there is no existing customer store to reconcile against or keep in parallel. `customers` is the single source of truth going forward. The one-time extraction of customer identity from today's scattered per-project `clientName`/`clientEmail`/`clientPhone` fields (and the deduplication strategy that requires) is separate, deferred work — recording this decision is not the same as designing that extraction, which is explicitly out of scope here.

None of the above required, or resulted in, any change to `001`–`007`.

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
| `prevent_unauthorised_profile_role_change` (status) | 60, 61, 62, 63, 64, 65 | **Covered — added in the 2026-07-29 correction pass** |
| No `profiles` INSERT/DELETE policy | — | **Still partially missing — no test confirms ordinary INSERT/DELETE is rejected pre-bootstrap.** Not addressed in this correction pass (not in scope). |
| `customers_select/insert/update_same_org` | 3, 9, 10 (select/insert), 16 (pattern reused for projects, not customers directly) | **Still partially missing — no explicit customer INSERT/UPDATE cross-org test analogous to #5/#6 for projects.** Not addressed in this correction pass (not in scope). |
| No `customers`/`projects` DELETE policy | 17–24 | Covered |
| `internal.current_organisation_id/role/is_owner/is_admin` `USAGE` grant | 59 | **Covered — added in the 2026-07-29 correction pass (closes C1)** |
| `internal.current_organisation_id/role` active-profile/active-organisation filtering (ADR-013) | 66–72 | **Covered — added in the 2026-07-29 correction pass** |
| `bootstrap_organisation()` — all aspects | 35–45 | Covered |
| `007` triggers — all named scenarios | 46–58 | Covered |
| `READ COMMITTED` correctness | 52, 53, and now explicitly cross-referenced as test 75 | Covered |
| `REPEATABLE READ` / `SERIALIZABLE` behaviour | 76 | **Documented as an unsupported configuration (H2, accepted limitation) — not asserted as correct, recorded so it is never assumed to be covered by 75** |
| Migration idempotency (re-run each file twice) | 73, 74 | **Covered — added in the 2026-07-29 correction pass (closes M1)** |

### Tests added in the 2026-07-29 correction pass

Tests 59 (schema-usage smoke test), 60–65 (profile status protection), 66–72 (suspension access enforcement), 73–74 (migration rerun behaviour), and 75–76 (transaction isolation) were all added directly to `docs/phase1-rls-test-plan.md` as part of this correction pass — see that document for full detail. This closes every item from the original "Missing tests to add" list except the two still-open, not-in-scope items noted above (`profiles` INSERT/DELETE pre-bootstrap rejection; explicit `customers` cross-org INSERT/UPDATE tests analogous to the existing `projects` ones).

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

**Status update (2026-07-29): C1, H1, and M1 have been applied exactly as specified below, directly in their original migration files. H2 was documented, not applied as a runtime guard, per explicit instruction. M2/M3/M4 were resolved as recorded decisions (§8a), not SQL changes. L1 remains open, not in scope for this pass.**

**C1 — applied to `005_phase1_rls.sql`**, immediately after `create schema if not exists internal;`:
```sql
revoke all on schema internal from public;
revoke all on schema internal from anon;
grant usage on schema internal to authenticated;
```
(Expanded slightly beyond the original one-line specification to also explicitly revoke from `public`/`anon`, per the correction instructions' requirement to "explicitly review and set schema privileges rather than relying on PostgreSQL defaults.")

**H1 — applied, the condition in `public.prevent_unauthorised_profile_role_change()` (`005`) now reads:**
```sql
if (new.role is distinct from old.role
    or new.organisation_id is distinct from old.organisation_id
    or new.status is distinct from old.status)
   and not internal.is_owner() then
  raise exception 'Only an organisation owner may change a member''s role, status, or organisation.';
end if;
```
The broader "suspension has no access consequence" half of H1 was **also resolved** in this pass, via ADR-013 (see the updated H1 finding in §3 and the exact function changes in `005`), not left as a separate follow-up as originally suggested.

**H2 — documentation only, applied to `007_protect_last_owner.sql`, ADR-009, and this document.** The runtime guard (`current_setting('transaction_isolation') = 'repeatable read'`) proposed as an option in the original review was **not** applied — explicit instruction was to document, not redesign, `007`.

**M1 — applied**, every one of the ten `CREATE POLICY` statements in `005` is now preceded by a matching `DROP POLICY IF EXISTS`.

**L1 — not applied, still open.** Not requested in the correction instructions for this pass.

**M2, M3, M4 — not SQL corrections, as originally noted.** Resolved as recorded decisions in §8a. No schema change made or recommended.

---

## 11. Rollback and Recovery

Documented approach only, per your instruction — no destructive scripts created.

**If migration execution fails halfway through applying `001`–`007`:** every table-creation statement uses `IF NOT EXISTS` and every function uses `CREATE OR REPLACE`, so re-running the same migration file after fixing whatever caused the failure is safe for `001`–`004` and `006`–`007` (with `007`'s `DROP TRIGGER IF EXISTS` guards). `005` is the one exception (M1) — until that's corrected, a failed partial application of `005` must be manually inspected (`\d+` on each table, or `select * from pg_policies where schemaname='public'`) to determine which policies already exist before re-running, or the missing `DROP POLICY IF EXISTS` guards should be added first regardless of whether M1 is being fixed for its own sake.

**If an RLS policy locks out all users:** this is precisely what C1 currently does. Recovery does not require disabling RLS (which would remove tenant isolation entirely, a worse outcome) — it requires connecting as a role that already has `USAGE` on the affected schema (the `postgres`/migration role, or any role explicitly granted it) and applying the missing grant. `service_role` remains available as an emergency read/write path throughout, since it bypasses RLS entirely — it does not bypass the schema-usage requirement for `internal.*` calls made *from a policy evaluated for `authenticated`*, but `service_role` doesn't evaluate those policies at all, so it is unaffected and can be used to diagnose and fix the issue without ever being locked out itself.

**If bootstrap creates unexpected data:** `bootstrap_organisation()` only ever creates one `organisations` row and one `profiles` row per call, both traceable via `created_by = <the calling user's auth.uid()>`. Recovery is a manual, `service_role`-executed `DELETE` of the specific rows (the `organisations` row can only be deleted once its `profiles` row is gone first, per the `RESTRICT` FK — delete `profiles` first, then `organisations`). This is a manual support action, not something to script generically, since "unexpected" data by definition needs human judgement about what's actually wrong before removing anything.

**If a suspended organisation needs to be reactivated (new, per ADR-013):** this is now an expected, documented state, not a failure. Once `internal.current_organisation_id()`/`current_role()` require both profile and organisation to be `active` (§3, H1/ADR-013), a suspended organisation's owner has no path back to `active` through the ordinary client API — `organisations_update_owner_only` depends on the same now-`NULL` function. Recovery requires either `service_role` administration (`update organisations set status = 'active' where id = ...`, executed directly, bypassing RLS) or — not yet built — a dedicated, reviewed `SECURITY DEFINER` recovery RPC (ADR-013 explicitly recommends this be designed separately, with its own authorisation model, rather than improvised here). Until that RPC exists, reactivation is a manual `service_role` action, and should be treated with the same care as any other privileged, RLS-bypassing operation — logged, and performed by someone who has verified the organisation's suspension reason has genuinely been resolved.

**If the ownership trigger (`007`) blocks legitimate administration** (e.g. a genuine need to remove an organisation's sole owner without an immediate replacement — the ADR-010/ADR-012 suspended-org scenario): the documented path is to first set `organisations.status = 'suspended'` (which the trigger's own scope, per H2's confirmation that the invariant only applies to `status = 'active'`, correctly permits with zero owners), perform the necessary profile changes, then either reactivate with a valid owner in place or leave the organisation suspended. There is deliberately no bypass mechanism for the trigger itself while an organisation remains `active` — that would defeat the invariant's purpose. If a genuine emergency requires overriding it on an active organisation, the only correct path is a privileged, logged, one-off `SET session_replication_role = replica;` (superuser only, disables all ordinary triggers for the session) immediately followed by manual restoration of the invariant and `SET session_replication_role = default;` — this should never be routine, and should be treated as an incident requiring its own record, not a documented "normal" recovery step.

---

## 12. Final Pre-Deployment Checklist

- [x] Apply C1's correction to `005` (schema `USAGE` grant) — **blocking**. **Done 2026-07-29**, not yet empirically verified (see test #59).
- [x] Apply H1's correction to `005` (extend the self-escalation trigger to cover `status`, and enforce suspension at the tenant-helper layer per ADR-013). **Done 2026-07-29**, not yet empirically verified (see tests #60–72).
- [x] Decide on H2's defensive guard — **decided: documentation-only**, per explicit instruction not to redesign `007`. Recorded in `007`, ADR-009, and this document.
- [x] Apply M1's correction to `005` (idempotent policies). **Done 2026-07-29**, not yet empirically verified (see tests #73–74).
- [ ] Apply L1's correction (revoke default grants on trigger functions) — optional, hygiene, still open, not in scope for this pass.
- [ ] Apply all corrected migrations to a **test/staging** Supabase project first — never the live project as the first application. **Still required — nothing has been applied.**
- [ ] Re-run every migration file a second time against the now-migrated test project, confirming full idempotency (tests #73–74 — this specifically re-validates M1's fix and the general rerunnability claim made throughout this migration set).
- [ ] Execute the full `docs/phase1-rls-test-plan.md` (tests 1–76, including the 18 tests added in this correction pass) against the test project, as the specified roles — not as `service_role` for any test that doesn't call for it.
- [ ] Execute test #59 **first**, before any other authenticated test — this is the empirical confirmation of C1's fix, and every other authenticated test implicitly depends on it passing.
- [ ] Execute tests #60–72 to empirically confirm ADR-013's suspension enforcement and H1's `status`-protection fix.
- [ ] Explicitly verify M5 (the `organisations_abn_unique_idx` diagnostic-name behaviour) via test #43.
- [ ] Confirm the actual deployment process: which role runs these migrations against the real project (`hpcqncghvdrlvufxfdnd`), and confirm that role owns every `SECURITY DEFINER` function it creates — this is a property of the deployment process, not of the SQL, and this review cannot confirm it without knowing how migrations will actually be applied (Supabase Dashboard SQL editor, CLI, or the MCP `apply_migration` tool all use the connected role, which should be confirmed to be the intended one).
- [ ] Before connecting any live UI to this schema: implement the money-boundary conversion (§8a decision 1), the status-value mapping (§8a decision 2), and the customer-extraction/dedup design (§8a decision 3) — the decisions are now recorded; the implementations are not yet written.
- [ ] Decide `contractRef`'s mapping (`external_reference` vs `project_number` vs a new column) before any project data migration script is written — still open, not addressed in this correction pass.
- [ ] Design the suspended-organisation recovery RPC recommended in ADR-013 before suspension is used operationally beyond `service_role`-administered cases — still open, deliberately not built in this pass.
- [ ] Only after all of the above, **and a full fresh re-review of the complete corrected migration set** (not just this targeted correction pass): consider upgrading the executive assessment from NOT READY, per the standing instruction not to do so prematurely.
- [ ] Only after that: apply to the live project (`hpcqncghvdrlvufxfdnd`), with `docs/phase1-rls-test-plan.md` re-run against it as a final confirmation.

---

---

## 13. Function Execution Privilege Audit (second review pass)

Every function across `001`–`007`, its intended caller, and its final privilege state after this pass's corrections.

| Function | Migration | Type | Intended caller | Final privilege state | Justification |
|---|---|---|---|---|---|
| `public.set_updated_at()` | `001` | Trigger function | None (executor-invoked only) | Default `PUBLIC` grant revoked from `public`/`anon`/`authenticated`; no grants held by any client role | Triggers do not require the DML-issuing role to hold `EXECUTE` on the trigger function — trigger firing is authorised by the invoking role's table-level (RLS-governed) privilege, not a direct function call. **Corrected this pass (L1).** |
| `public.prevent_unauthorised_profile_role_change()` | `005` | Trigger function | None | Same as above | Same reasoning. **Corrected this pass.** |
| `public.enforce_last_owner_on_profiles()` | `007` | Trigger function (`SECURITY DEFINER`) | None | Same as above | Same reasoning — `SECURITY DEFINER` governs what the function's *body* can see once invoked, not who may invoke it; it still does not need a client-role grant. **Corrected this pass.** |
| `public.enforce_last_owner_on_organisations()` | `007` | Trigger function (`SECURITY DEFINER`) | None | Same as above | Same reasoning. **Corrected this pass.** |
| `internal.current_organisation_id()` | `005` | RLS helper (`SECURITY DEFINER`) | `authenticated`, evaluated as part of policy expressions | `EXECUTE` granted to `authenticated` only; revoked from `public`/`anon` | Genuinely different from a trigger function: RLS policy expressions are evaluated *as the querying role* (here, `authenticated`, since PostgREST executes as that role) — a function referenced inside a policy's `USING`/`WITH CHECK` clause is an ordinary function call from the privilege-checking system's perspective, requiring the querying role to hold `EXECUTE`, independent of the function's own `SECURITY DEFINER` status (which governs the *body's* privileges once entered, not who may enter it). This is the minimum grant required for every policy in `005` to function at all. |
| `internal.current_role()` | `005` | RLS helper (`SECURITY DEFINER`) | `authenticated` | Same as above | Same reasoning. |
| `internal.is_owner()` | `005` | RLS helper (`SECURITY INVOKER`, default) | `authenticated` | Same as above | Called directly inside policy expressions (`organisations_update_owner_only`, the self-escalation trigger's condition); same requirement. |
| `internal.is_admin()` | `005` | RLS helper (`SECURITY INVOKER`, default) | `authenticated` | Same as above | Not currently referenced by any policy (ADR-010 removed the policies that used it) — granted for consistency with its siblings and as ready infrastructure; holding an unused grant on an already-minimal, side-effect-free boolean function is not a privilege-hygiene concern the way an unrevoked default grant on a writing/definer trigger function would be. |
| `internal.assert_organisation_has_active_owner()` | `007` | Internal helper (`SECURITY DEFINER`) | Only the two `SECURITY DEFINER` trigger functions above, which run as the schema-owning role and therefore have implicit `EXECUTE` on functions that role owns | No grant to any client role; default `PUBLIC` grant revoked | Never called from a policy expression or directly by a client — confirmed already-minimal before this pass, re-verified here. |
| `public.bootstrap_organisation()` | `006` | Client-callable RPC (`SECURITY DEFINER`) | `authenticated`, via `supabase.rpc(...)` | `EXECUTE` granted to `authenticated` only; revoked from `public`/`anon` | The one function in this schema genuinely meant to be called directly by a client. Confirmed unchanged and correct — kept callable only by `authenticated`, per this pass's explicit instruction. |

**Summary:** four trigger functions corrected (default grant revoked); four RLS-helper functions confirmed as correctly requiring `authenticated` `EXECUTE` (not a hygiene issue — a functional requirement, justified above); one internal helper confirmed already-minimal; one RPC confirmed unchanged and correctly scoped. No function in this schema grants more privilege than its role requires, after this pass.

---

## 14. `auth.users` Deletion Interaction — Confirmed Analysis

Per this pass's explicit framing as the most important remaining issue.

**Mechanism, traced precisely:**
1. `profiles.id references auth.users(id) on delete cascade` (`002`). Deleting an `auth.users` row causes PostgreSQL to delete the corresponding `profiles` row as part of enforcing the foreign key, within the same transaction as the `auth.users` `DELETE`.
2. Cascaded deletes fire ordinary row-level triggers on the referencing table exactly as an explicit `DELETE` would — this is standard, documented PostgreSQL behaviour, not something specific to or dependent on this schema's design.
3. `profiles_last_owner_guard` (`007`) is one such trigger. Being `DEFERRABLE INITIALLY DEFERRED`, it does not fire immediately — it fires at transaction commit, by which point the cascaded `profiles` deletion has already been applied within the (still uncommitted) transaction.
4. `internal.assert_organisation_has_active_owner()` — invoked by that deferred trigger — queries the current state of `organisations`/`profiles` for the affected organisation. If the deleted profile was that organisation's sole active owner and the organisation is `status = 'active'`, the count is zero, and the function raises.
5. A deferred constraint trigger raising an exception at commit time aborts the **entire transaction** — not just the cascaded `profiles` deletion, the originating `auth.users` `DELETE` too.

**Conclusion, stated directly:** deleting the sole active owner's `auth.users` row is rejected outright. The transaction rolls back. The account is not deleted. This holds for any ordinary role performing the deletion — including Supabase's Auth admin API, which performs a genuine SQL `DELETE` against `auth.users` — because the FK cascade and trigger firing are enforced at the database level, independent of which client or service issued the statement. The only theoretical bypass is a role with trigger-suppression capability (`SET session_replication_role = replica`, superuser-only), which is the same class of last-resort, must-be-logged action already documented in §11's rollback/recovery guidance — not a routine administrative path, and not weakened or newly enabled by anything in this review.

**This was already correct database behaviour before this review pass — no SQL was changed as a result of this analysis.** What was missing was the explicit, documented administrative procedure for the two situations where a sole owner's account genuinely does need to be deleted (a real GDPR erasure request, an offboarding). That procedure is now recorded in **ADR-012**:

1. **Assign a second active owner first**, then delete the original owner's account — after the cascade, one active owner remains.
2. **Suspend the organisation first** (`service_role`, per ADR-013), then delete the sole owner's account — `007`'s invariant does not apply to a non-active organisation, so the deletion succeeds; the organisation remains suspended (and inaccessible via the ordinary API, per ADR-013) until a separate recovery action reactivates it with a valid owner in place.

Neither requires a schema change. Both are already correctly supported by the existing `007` trigger. Tests #87–89 (`docs/phase1-rls-test-plan.md`) confirm this empirically once applied to a test project. **The last-owner invariant was not weakened anywhere in this analysis or this review pass** — the two-step procedure above is the safer alternative to weakening it, exactly as instructed.

---

## 15. Database Deployment Readiness vs Application Cutover Readiness

Deliberately separated, per this pass's explicit instruction. These are two different questions with two different answers.

### Database deployment readiness: READY WITH ACCEPTED LIMITATIONS

Nothing about the **schema itself** — its tables, constraints, indexes, RLS policies, helper functions, the bootstrap RPC, or the last-owner protection — blocks applying `001`–`007` to a Supabase project, subject to completing §17's pre-deployment procedure and §18's post-deployment validation first. The one accepted limitation (H2) does not block this: it constrains what *future* server-side code must avoid (opening a `REPEATABLE READ` transaction around ownership changes), not anything about deploying the schema as written.

### Application cutover readiness: NOT READY, and not close

Connecting the live BIK Solutions application to this schema requires all of the following, **none of which are database concerns**, and none of which have been started:

1. **Supabase client/service integration.** There is currently no `@supabase-js` (or equivalent) integration anywhere in `js/`. The entire live app runs against `localStorage`. This is a substantial, net-new engineering effort — auth flow (sign-up calling `bootstrap_organisation()`, sign-in, session handling), a data-access layer for `customers`/`projects` replacing `project-store.js`, error handling for RLS rejections, etc.
2. **Dollar-to-cents conversion** at whatever boundary is chosen (§8a, decision 1) — not yet implemented.
3. **`complete` → `completed` status mapping** (§8a, decision 2) — not yet implemented, and blocks any migration of existing localStorage project data.
4. **Customer extraction/deduplication** (§8a, decision 3) — the one-time backfill from scattered per-project client fields into `customers` has not been designed, let alone built.
5. **`contractRef` mapping decision** — still open (§8, §12), blocks any project data migration script.
6. **A localStorage migration or reset strategy** — for existing users/beta testers, a decision is needed on whether existing `localStorage` data is migrated into the new schema, or whether Phase 2 launches as a clean slate with existing local data left in place/exported. Not addressed by this review; a product decision, not a database one.
7. **A suspended-organisation recovery workflow**, if suspension is to be used operationally before the future recovery RPC (§6, §17) exists — `service_role` administration is sufficient for Phase 1's actual needs (§6's conclusion), but whoever operates the platform needs to know this is a manual step today.

**None of items 1–7 block deploying the database schema itself.** They block the separate, much larger effort of switching the production application over to use it.

---

## 16. Test Execution Plan

Every test in `docs/phase1-rls-test-plan.md` (89 total after this pass), categorised by how it must be run, with a safe execution order for a freshly-migrated non-production Supabase project.

### Categories

| Category | What it means | Test IDs |
|---|---|---|
| Static migration inspection | Code review, not a runtime call | 45, 72, 81 |
| Supabase client test as `anon` | Unauthenticated client, no session | 7, 8, 9, 10, 38 |
| Supabase client test as `authenticated` | A specific, real authenticated session with a known profile/role | 1–6, 11–13, 16, 17–28, 35–37, 39–43, 46–47, 50, 60–68, 70, 77–80, 82–85 |
| SQL Editor / direct connection test (`service_role` or explicit role assumption) | Requires `service_role` privileges, or setting `role`/`request.jwt.claims` directly in a SQL session — not reachable via the ordinary client SDK | 14, 15, 18–24, 29–34, 48, 49, 51, 54–58, 63–65 (owner-actor tests reachable via client SDK using an owner session; included here only where the test explicitly specifies `service_role`), 69, 71, 73, 74, 86–89 |
| Concurrent two-session test | Requires two genuinely overlapping sessions/connections, not expressible as a single sequential script | 44, 52, 53 |
| Documented-limitation test (not asserting correctness) | Records an accepted limitation rather than proving correct behaviour | 76 |

(Several tests specify an "owner" or "admin" actor without requiring `service_role` — these are reachable via the ordinary client SDK using that user's own session, and are listed under `authenticated`. Tests explicitly written against `service_role` in the test plan are listed under the SQL Editor category regardless of which table they touch.)

### Safe execution order

1. **Static migration inspection** (45, 72, 81) — no database required; can be done before or independent of any deployment.
2. **Test 59 first, before any other runtime test.** This is the empirical confirmation of C1's fix. Every other authenticated test assumes it passes.
3. **Anonymous access tests** (7–10, 38) — cheap, no fixture data required, confirm the baseline deny-by-default posture before testing anything more specific.
4. **Bootstrap tests** (35–45, excluding 44) — these create the first real organisations/profiles the rest of the plan depends on. Run in a fresh project with no pre-seeded fixture data, since several assert exact counts.
5. **Concurrent bootstrap test** (44) — run once ordinary bootstrap is confirmed working, before building further fixture data on top of a possibly-inconsistent state.
6. **Seed remaining fixtures** (Org A, Org B, multiple roles per org, as `docs/phase1-rls-test-plan.md`'s "How to run this" section describes) via `service_role`.
7. **Organisation isolation, role behaviour, and referential-integrity tests** (1–6, 11–34, 46–58, 60–72, 77–85, 87–89) — the bulk of the plan, safe to run in any order once fixtures exist, except:
8. **Concurrent demotion/suspension tests** (52, 53) — run these deliberately, in isolation, immediately before or after step 7 rather than interleaved with it, since they depend on precise fixture state (exactly two active owners) that other tests in step 7 might otherwise mutate.
9. **Migration rerun tests** (73, 74) — run **last**, since they re-apply migration files against a database that already has fixture data in it; confirm this succeeds without disturbing existing rows (idempotent `CREATE POLICY`/`CREATE OR REPLACE FUNCTION` do not touch table data).
10. **Documented-limitation test** (76) — optional, run only if specifically validating the `REPEATABLE READ` analysis; not part of the pass/fail gate for deployment readiness, since it is expected to demonstrate the limitation, not prove correctness.

---

## 17. Exact Pre-Deployment Procedure

1. Confirm the deployment role: identify which Postgres role will execute `001`–`007` against the target project, and confirm that role owns every object it creates (standard for a fresh Supabase project connecting via the Dashboard SQL editor, CLI, or the `apply_migration` MCP tool — but confirm, don't assume, per §7's original note on this).
2. Create or select a **non-production** Supabase project for first application. Never apply first to `hpcqncghvdrlvufxfdnd` (or any project with real user data) directly.
3. Apply `001` through `007`, strictly in numerical order, as one migration run.
4. Run §16, steps 1–2 (static inspection, test 59) immediately after application, before creating any further test data.
5. If test 59 fails: stop. Do not proceed to further tests or to any other project. Re-verify the `grant usage on schema internal to authenticated;` statement in `005` was actually applied (`select has_schema_privilege('authenticated', 'internal', 'usage');` as a direct diagnostic query).
6. If test 59 passes: proceed through §16's remaining steps in order.
7. Do not proceed to production application until every test in §16 has been run and every result matches its documented expectation (including the two explicitly-expected-to-be-limited tests, 34 and 76, which should show their documented limitation, not an unexpected error).

---

## 18. Exact Post-Deployment Validation Procedure

Distinct from §17: this is what to check *after* the schema is live on the target project (test or production), before declaring that specific deployment done.

1. **Privilege re-verification**, direct SQL: `select grantee, privilege_type from information_schema.role_usage_grants where object_schema = 'internal';` — confirm exactly one row (`authenticated`, `USAGE`), nothing for `anon` or `PUBLIC`.
2. **Function grant re-verification**: `select routine_name, grantee, privilege_type from information_schema.role_routine_grants where routine_schema in ('public','internal');` — confirm the exact grant set matches §13's table (four `internal.*` functions + `bootstrap_organisation()` granted to `authenticated` only; every trigger function granted to nobody).
3. **Policy inventory check**: `select schemaname, tablename, policyname, cmd, roles from pg_policies where schemaname = 'public';` — confirm exactly ten policies, matching `005`'s definitions, all scoped `{authenticated}`.
4. **Trigger inventory check**: confirm `organisations_set_updated_at`, `profiles_set_updated_at`, `customers_set_updated_at`, `projects_set_updated_at`, `profiles_prevent_unauthorised_role_change`, `profiles_last_owner_guard`, `organisations_last_owner_guard` all exist, and that the two `_last_owner_guard` triggers show `tgdeferrable` and `tginitdeferred` as true (`select tgname, tgdeferrable, tginitdeferred from pg_trigger where tgname like '%last_owner_guard';`).
5. **Run the full test suite** (§16) if not already done as part of §17.
6. **Confirm zero unexpected rows**: `select count(*) from organisations; select count(*) from profiles; select count(*) from customers; select count(*) from projects;` — should reflect only the test fixtures created during validation, nothing unexpected left over from a failed or partial earlier attempt.
7. **Sign off** by recording the date, the project this was validated against, and the result of every §16 test in a deployment log (not specified further here — a product/ops decision on where that log lives, not a database concern).

---

## 19. Disposition of Every Finding (Second Review Pass Summary)

| Finding | Original severity | Status after this pass |
|---|---|---|
| C1 — missing `internal` schema `USAGE` grant | Critical | **Corrected.** Re-verified by re-reading `005` in full this pass. |
| H1 — `profiles.status` self-reversal + no access enforcement | High | **Corrected.** Trigger extended; suspension enforcement added (ADR-13). Re-verified this pass. |
| H2 — last-owner protection unsafe under `REPEATABLE READ` | High | **Accepted limitation.** Documented in three places; not reachable via current API; recommendation recorded for future ownership-management work. |
| M1 — non-idempotent `CREATE POLICY` statements | Medium | **Corrected**, and rerun language made precise this pass (item 7). |
| M2 — money storage mismatch (cents vs dollar-float) | Medium | **Deferred requirement**, decision recorded (§8a); implementation not yet built; blocks application cutover only (§15). |
| M3 — project status value mismatch (`complete`/`completed`) | Medium | **Deferred requirement**, decision recorded (§8a); implementation not yet built; blocks application cutover only. |
| M4 — no existing customer data model | Medium | **Deferred requirement**, decision recorded (§8a); extraction/dedup design not yet built; blocks application cutover only. |
| M5 — unverified bootstrap diagnostic behaviour | Medium | **Resolved by analysis** this pass. No code change. Tests 43/86 remain as empirical confirmation. |
| M6 — `auth.users` deletion / last-owner interaction | Medium | **Resolved by analysis and formally documented** this pass (§14, ADR-012). No code change — behaviour was already correct; the procedure was the gap, now closed. |
| L1 — trigger functions retain default `PUBLIC` execute | Low | **Corrected** this pass (§13). |
| L2 — `007`'s stated dependencies broader than required | Low | **Still open.** Not in scope for this pass. Cosmetic only. |
| L3 — `enforce_last_owner_on_organisations` fires on every `UPDATE` | Low | **Still open, and still not recommended to act on** — no query pattern justifies the optimisation yet. |
| New (this pass) — `profiles` INSERT/DELETE untested | Test-coverage gap | **Closed.** Tests 77–81 added. |
| New (this pass) — `customers` cross-org INSERT/UPDATE untested | Test-coverage gap | **Closed.** Tests 82–85 added. |

**Remaining blockers to unconditional READY:** none that are code defects. H2 remains open by design (an accepted limitation, not a blocker to deployment). L2/L3 are cosmetic and explicitly not worth acting on yet.

**Accepted limitations, stated together:** (1) last-owner protection is not safe under an explicit `REPEATABLE READ` transaction — mitigated by the fact that no current code path opens one, and by the documented recommendation to route future ownership-management work through a controlled RPC; (2) a suspended organisation cannot be reactivated through the ordinary tenant-scoped API — `service_role` administration is required until a future, narrowly-scoped recovery RPC is designed (§6: confirmed not to make Phase 1 unusable, since suspension itself is not yet triggered by any automated process).

---

## Related documents

- `supabase/migrations/001`–`007` — the migrations under review
- `docs/decisions/README.md` — ADR-001–013
- `docs/phase1-rls-test-plan.md` — the test plan referenced throughout §9 and §16 (89 tests after this pass)
- `js/toolkit/project-store.js`, `js/toolkit/calculator.js` — the live data models compared in §8
