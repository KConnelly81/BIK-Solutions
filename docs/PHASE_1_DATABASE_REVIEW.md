# Phase 1 Database Review

**Purpose:** Full review of the Phase 1 Supabase schema (`001`–`007`) before any migration is applied to the live project (`hpcqncghvdrlvufxfdnd`).
**Status:** Findings only. No migration has been created or modified as part of this review.
**Scope:** `supabase/migrations/001`–`007`, `docs/decisions/README.md` (ADR-001–012), `docs/phase1-rls-test-plan.md`, and the current live JavaScript data models (`js/toolkit/project-store.js`, `js/toolkit/calculator.js`, tool `config.js` files).
**Date:** 2026-07-29

---

## 1. Executive Assessment

## **NOT READY** — correction pass applied 2026-07-29; unchanged from READY per explicit instruction pending a full fresh re-review

**Update (2026-07-29 correction pass):** C1 (the deployment-blocking missing schema grant), the `status`-reversal half of H1, and M1 (non-idempotent policies) have been corrected directly in their original migration files. Suspension has additionally been given real enforcement (see ADR-013) — a strictly larger fix than H1 originally called for, since the review's own finding noted suspension had *no* enforced access effect at all, not just a self-reversal gap. H2 (the `REPEATABLE READ` limitation) has been **documented, not redesigned**, per explicit instruction — it remains an accepted, currently-unreachable limitation, not a corrected defect. Per instruction, the executive assessment is **not** being upgraded to READY: a HIGH finding (H2) remains open by design, and this correction pass — while thorough — is not the same thing as the "reviewed again as a complete set" pass that would justify that upgrade. Practically, the severity of what remains open has dropped substantially: the one finding that would have broken the application outright is fixed, and everything remaining is either an accepted, documented, currently-unreachable limitation, or a lower-severity item not yet actioned. See §12 for the itemised status of every finding.

Original assessment, for context: one confirmed defect in `005_phase1_rls.sql` would have made every RLS-protected query fail for every authenticated user the moment these migrations were applied — not a subtle security gap, an outright functional break. That defect (C1) is now corrected. This assessment was, and remains, deliberately not softened by the amount of good work already in this schema.

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

**Status: OPEN, unchanged.** Not addressed in this correction pass — remains an empirical verification item for first deployment (test #43).

**Category:** Unverified assumption, low risk.

`006`'s exception handler checks `v_constraint_name = 'organisations_abn_unique_idx'` to distinguish a duplicate-ABN conflict from any other uniqueness violation. `organisations_abn_unique_idx` is a `CREATE UNIQUE INDEX ... WHERE abn IS NOT NULL`, not a named table constraint added via `ALTER TABLE ... ADD CONSTRAINT`. PostgreSQL's internal unique-violation reporting (`errtableconstraint()`) is understood to populate the constraint-name diagnostic with the *index* name in both cases, which is why this was written this way — but this has not been empirically exercised against a live database in this review (nothing has been applied). Recommend this be the first thing explicitly tested once `006` is applied to a test project (duplicate-ABN test, plan #43), specifically checking that the friendly message — not the generic fallback — is what's returned.

### M6 — Deleting a sole owner's `auth.users` row will be silently rolled back, with a raw Postgres error

**Status: OPEN, unchanged.** Not addressed in this correction pass. Now additionally relevant to ADR-013's recovery-RPC recommendation — whoever designs that RPC should read this finding alongside it, since the two interact (a recovery RPC touching a suspended organisation's ownership should account for this cascade behaviour too).

**Category:** Undocumented operational consequence (beneficial side effect, but needs a runbook note).

`profiles.id references auth.users(id) on delete cascade` means deleting an `auth.users` row cascades into deleting the corresponding `profiles` row — and cascade-triggered deletes fire ordinary triggers on the target table, including `007`'s deferred `profiles_last_owner_guard`. So: an admin action that deletes the `auth.users` row of an organisation's sole active owner (e.g. via Supabase's Auth admin panel or API) will, at commit, be rejected by the last-owner invariant — the whole delete fails with `"Organisation ... must retain at least one active owner."`, not a graceful message, and the auth account is **not** deleted. This is a genuinely beneficial consequence (it prevents exactly the ADR-012 violation it was designed to prevent), but nobody building a future admin console or GDPR-erasure tool would expect a `profiles` invariant to be *the* mechanism blocking an `auth.users` deletion unless this is documented. Recommend a short note in ADR-012 or a future admin-tooling spec: reassign or suspend ownership *before* deleting a sole owner's auth account, not after.

---

## 5. Low-Priority / Documentation Findings

### L1 — Trigger functions retain the default `PUBLIC EXECUTE` grant

**Status: OPEN, unchanged.** Not in scope for this correction pass (not listed in the corrections requested). Still recommended, still not exploitable.


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

## Related documents

- `supabase/migrations/001`–`007` — the migrations under review
- `docs/decisions/README.md` — ADR-001–012
- `docs/phase1-rls-test-plan.md` — the test plan referenced throughout §9
- `js/toolkit/project-store.js`, `js/toolkit/calculator.js` — the live data models compared in §8
