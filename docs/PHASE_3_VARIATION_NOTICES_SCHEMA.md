# Phase 3 — `variation_notices` Table Design Note

**Purpose:** Design overview for `public.variation_notices`, the schema backing the Variation Notices pilot migration — the first tool moved from `localStorage` onto the authenticated project model.
**Status:** Both migrations **applied and fully verified live** against `hpcqncghvdrlvufxfdnd` on 2026-07-31. `010_create_variation_notices.sql` (commit `3211d3b`) — see "Live deployment verification" below. `011_variation_notice_number_generator.sql` (the concurrency-safe number generator, the transactional `create_variation_notice()` RPC, and the canonical `"VAR-NNN"` format with manual-entry normalisation) — applied as commit `d6ac0ed`, see "Live deployment verification (011)" below. The frontend is still **not wired up** — that remains a separate, explicitly gated step (Sprint 3), pending review of this report.
**Owner:** BIK Solutions Pty Ltd

---

## Why this exists

Variation Generator currently persists nothing to a database — drafts live in `localStorage` via `js/toolkit/engine.js`'s autosave. Moving it onto the authenticated project model means a real place for generated Variation Notices to live, scoped to an organisation and a project, governed by the same RLS boundary as everything else.

## The decision this note reflects

**A dedicated `variation_notices` table, not a shared generic `documents` table.** An earlier draft of this work proposed the opposite — one `documents` table with a `type` discriminator and a `fields` jsonb payload, to avoid ~20 near-duplicate migrations as more tools are added. That was corrected: see **ADR-016** (`docs/decisions/README.md`) for the full record. In short, inspecting the actual field list below showed that almost every field has real business meaning (it drives a calculation, a filter, a report, or the document's own content) and belongs as a typed column regardless of which table shape is chosen — the maintenance savings a shared table offered turned out to cost this codebase's standing practice of constraining meaningful data at the database layer, for a benefit that was smaller than it first appeared. `variation_notices` follows the exact same pattern as `organisations`/`profiles`/`customers`/`projects`.

Attendance and Site Diary remain out of scope — not form-engine documents, will get their own schema when their turn comes.

## Field inventory

Derived directly from `js/tools/variation-notice/config.js`'s `SCHEMA`.

| DB column | Source form field | Type | Required | Affects totals/status/reporting/output | Why (typed vs jsonb) |
|---|---|---|---|---|---|
| *(none — via `organisation_id`)* | `builderName`, `builderABN`, `builderPhone`, `builderEmail`, `builderAddress` | — | — | Output only | Not persisted here — already fully covered by `organisations.name/abn/phone/email/address` (001). These are `profile: true` fields; sourcing them from the join means the document reflects the org's current details. |
| *(none — via `project_id`)* | `projectName` | — | — | Output only | Not persisted — `projects.name` is authoritative once a real project is selected via `app-dashboard.html`. |
| `variation_number` | `variationNumber` | `text not null` | Required | Reporting, output; **unique per project**, not per organisation | Typed — short, looked up and filtered by, uniqueness enforced. Scoped `(organisation_id, project_id, variation_number)`: builders legitimately reuse the same number (e.g. VAR-001) across different projects — corrected from an earlier org-wide scoping. |
| `date_issued` | `dateIssued` | `date not null default current_date` | Required | Reporting, output | Typed |
| `client_name` | `clientName` | `text not null` | Required | Reporting, output | Typed — this is the client-details snapshot: a plain copy on the row, decoupled from any live `customers` record |
| `client_email` | `clientEmail` | `text` (email format check) | Optional | Output | Typed, same snapshot reasoning |
| `site_address` | `siteAddress` | `text` | Optional | Output | Typed — a variation can specify a different work address than the project's own `site_address`; still a plain fact |
| `contract_reference` | `contractRef` | `text` | Optional | Output | Typed |
| `requested_by` | `requestedBy` | `text` | Optional | Reporting | Typed |
| `reason_for_variation` | `reasonForVariation` | `text not null` | Required | Output (core content) | Typed — fixed, always-present field of this document type; long-form is not the same as variable-shaped |
| `description_of_work` | `descriptionOfWork` | `text not null` | Required | Output (core content) | Typed, same reasoning |
| `exclusions_assumptions` | `exclusionsAssumptions` | `text` | Optional | Output | Typed |
| `materials_required` | `materialsRequired` | `text` | Optional | Output | Typed |
| `labour_required` | `labourRequired` | `text` | Optional | Output | Typed |
| `cost_excl_gst_cents` | `additionalCost` | `bigint not null` (≥0) | Required | **Totals, calculation, reporting** | Typed — integer cents, matching `projects.estimated_contract_value_cents`'s existing platform-wide money convention (avoids float rounding) |
| `gst_applicable` | `gstApplicable` | `boolean not null default true` | Required | **Calculation** | Typed — normalised from the form's `'yes'/'no'` string to a real boolean |
| `gst_cents` | *(derived)* | `bigint generated always as (...) stored` | — | **Totals, reporting** | Generated column — always exactly consistent with its inputs, never independently writable or driftable |
| `total_cents` | *(derived)* | `bigint generated always as (...) stored` | — | **Totals, reporting, output** | Generated column, same reasoning |
| `cost_type` | `costType` | `text not null default 'fixed'` (CHECK) | Required | Output, reporting | Typed — 3-value enum, same convention as `projects.status`/`profiles.role` |
| `extension_of_time_days` | `extensionOfTime` | `integer not null default 0` (≥0) | Has default | Output | Typed |
| `revised_completion_date` | `revisedCompletionDate` | `date` (≥ `date_issued` if present) | Optional | Output | Typed |
| `payment_terms` | `paymentTerms` | `text default '14days-approval'` (CHECK) | Has default | Output, reporting | Typed — 6-value enum |
| `builder_notes` | `builderNotes` | `text` | Optional | Output | Typed |
| `builder_approval_name` | `builderApprovalName` | `text` | Optional | **Status/approval, output** | Typed — the printed signatory name, distinct from `status_changed_by` (the authenticated app user) |
| `client_approval_name` | `clientApprovalName` | `text` | Optional | **Status/approval, output** | Typed |
| `status`, `status_changed_at`, `status_changed_by` | *(new)* | as before | — | **Status, workflow** | Typed |
| `issued_snapshot` | *(new)* | `jsonb` | — | Audit | **The one genuinely jsonb-appropriate field** — a frozen serialized copy of the typed columns at the moment of issue, so an edited draft can never silently rewrite what was actually sent. Derived/secondary data about the row, not the row's primary content. **DB-enforced**, not an application-layer promise: `capture_variation_notice_issued_snapshot()` populates it only on the write that transitions `status` to `issued`, and forces it back to its prior value on every other write — a client cannot set or alter it directly. |

**Net result:** every field with any bearing on calculation, filtering, reporting, status, or integration is a real typed column. `jsonb` appears exactly once, for exactly the case it's meant for.

## Confirmations from this review round

1. **`issued_snapshot` is generated only on transition to `issued`, never on ordinary draft edits.** DB-enforced by `capture_variation_notice_issued_snapshot()` (a `BEFORE INSERT OR UPDATE` trigger), not left as an application-layer promise. On the write that moves `status` to `'issued'` (from any other status, or set directly on insert), it's populated with a fresh serialized copy of the typed columns. On every other write — including a draft edit while `status` stays `'draft'`, and including an edit made after the notice has already been issued — the trigger forces `issued_snapshot` back to its prior value regardless of what the client's statement supplied, so it cannot be set or altered by any other path. If a notice is later reset to `'draft'` and re-issued, the snapshot refreshes to that new issue event, consistent with `status_changed_at`/`status_changed_by` tracking only the most recent transition.
2. **The `client_email` format check is sufficiently permissive.** It's the identical pattern already used for `organisations.email`/`profiles.email`/`customers.email` — `^[^@\s]+@[^@\s]+\.[^@\s]+$`. Reviewed specifically for false rejections: it allows `+`-tags, consecutive/multiple dots, and non-ASCII characters in either part (the character class excludes only `@` and whitespace). The one realistic gap is a quoted local part containing a literal space — valid per RFC 5322 but essentially unseen for a construction-industry client contact field, accepted as a known limitation rather than a reason to complicate the pattern. It errs toward accepting a slightly malformed address over rejecting a legitimate one, which is the safer direction for a plain contact-detail field — this check was never meant to guarantee deliverability, only catch the obviously-wrong case (no `@`, no domain). Kept as a simple regex rather than removed in favour of purely application-layer validation, for consistency with the three other tables that already use it.
3. **`status_changed_by`, `created_by`, and `updated_by` behave safely if an `auth.users` row is later deleted.** All three reference `auth.users(id) on delete set null` — identical to every other audit column in this schema (001-004). Deleting an auth user simply nulls these columns; the `variation_notices` row itself is never deleted or blocked by the FK. An audit trail must not disappear because the acting user's account was later removed (the same GDPR/Privacy Act erasure reasoning as ADR-010/ADR-012).
4. **`site_address` and the client snapshot fields (`client_name`, `client_email`) are populated from the selected project at creation, but remain independently stored afterward.** Confirmed by construction: this migration defines no trigger, view, or other mechanism that re-derives these columns from the linked project or customer after insert — they are ordinary, independently mutable columns, so a historical notice cannot change just because the project is edited later. The one-time copy from the project's/customer's current values at creation time is an **application-layer** responsibility (part of the not-yet-built frontend wiring, see "Next steps" below) — this migration guarantees the decoupling, it does not and should not perform the initial copy itself.

## Security

- RLS reuses `internal.current_organisation_id()` (005) directly — same read/create/update-within-own-org shape as `customers`/`projects`, no new helper function.
- **Cross-tenant integrity check, unchanged from the earlier draft:** a `project_id` foreign key alone doesn't guarantee the referenced project belongs to the same organisation the row claims. `enforce_variation_notice_project_same_organisation()` (a `BEFORE INSERT OR UPDATE` trigger) closes that explicitly.
- **`issued_snapshot` integrity**, new this round: `capture_variation_notice_issued_snapshot()` (also `BEFORE INSERT OR UPDATE`) guarantees it can only be set by the transition-to-issued write itself — see Confirmation 1 above.
- Explicit `GRANT SELECT, INSERT, UPDATE ... TO authenticated` in the same migration — learned from C2/ADR-014: nothing is inherited by default for a new table.
- No `DELETE` policy or grant — soft delete via `status = 'archived'`, per ADR-010.

## Deliberately not built here

- A full multi-transition audit/status-history table (`status_changed_at`/`by` captures only the latest transition).
- Database-enforced immutability of the *other* typed columns (e.g. `reason_for_variation`, `cost_excl_gst_cents`) once a document is issued — left to the tool's own UI for now. `issued_snapshot` itself is the exception, now DB-enforced (Confirmation 1 above), precisely so a later edit to those still-mutable columns can never rewrite the historical record of what was actually sent.
- A modelled multi-party approval workflow (`approved`/`rejected` are plain status values).
- Snapshotting builder/business details onto this table — already fully covered by `organisation_id -> organisations`, no product requirement yet to decouple them from the live record.
- The same table-per-type pattern for the next tool (Progress Claims, Quotes, etc.) — each gets its own dedicated table and migration when its turn comes, per ADR-016.

## Live deployment verification (2026-07-31)

Applied to `hpcqncghvdrlvufxfdnd` via `apply_migration`, exact content of commit `3211d3b`. All checks below were run live against the real project, not inferred from the local Postgres dry run in earlier review rounds (that earlier local check remains valid as a pre-application sanity pass; this is the actual live confirmation).

**Catalog/schema checks — all passed:**
- `public.variation_notices` exists.
- RLS enabled (`pg_class.relrowsecurity = true`).
- `authenticated` holds exactly `SELECT`, `INSERT`, `UPDATE` — no `DELETE`, nothing else.
- `anon` holds nothing on this table (no rows at all in `role_table_grants` for `anon`).
- All three RLS policies present and correctly scoped — `variation_notices_select_same_org`/`_insert_same_org`/`_update_same_org`, each `organisation_id = (SELECT internal.current_organisation_id())` in `USING`/`WITH CHECK` as designed.
- All three triggers present, correctly mapped to their functions — `variation_notices_set_updated_at` → `set_updated_at`, `variation_notices_enforce_project_same_organisation` → `enforce_variation_notice_project_same_organisation`, `variation_notices_capture_issued_snapshot` → `capture_variation_notice_issued_snapshot`.
- `created_by`, `updated_by`, `status_changed_by` all confirmed `ON DELETE SET NULL` via `information_schema.referential_constraints`.
- Unique index confirmed as exactly `(organisation_id, project_id, variation_number)`.

**Functional checks, using disposable data (two organisations, three projects, two disposable `auth.users` rows as owners — required because `007`'s last-owner invariant fires on any organisation left without an active owner at commit) — all passed:**
- GST/total computed correctly: $1000 ex-GST with GST on → `gst_cents=10000`, `total_cents=110000`. GST-off case: `gst_cents=0`, `total_cents` unchanged from cost.
- Same `variation_number` (`VAR-001`) in two different projects of the *same* organisation succeeded (per-project scope confirmed) — a duplicate within the *same* project correctly failed on `variation_notices_org_project_number_unique_idx`.
- A `project_id` from one organisation with `organisation_id` claiming another was correctly rejected by `enforce_variation_notice_project_same_organisation()`.
- `issued_snapshot` full lifecycle: null on a fresh draft; a draft edit — including a client attempting to smuggle a value into `issued_snapshot` in the same statement — left it null; transitioning to `issued` populated it correctly (captured the live values at that moment); editing a field *after* issue left the snapshot frozen while the live column diverged; resetting to `draft` and re-issuing refreshed the snapshot to the new issue event.

**Discrepancies between local and live behaviour: none.** Every result matched the local Postgres 16 dry-run exactly — same numbers, same error messages, same pass/fail outcomes on every case.

**Test data cleanup:** confirmed complete. All disposable `variation_notices`/`projects`/`profiles`/`organisations`/`auth.users` rows removed; re-queried at zero afterward. The one pre-existing real organisation/profile/project (from the user's own live signup testing) was never touched — confirmed unchanged (still exactly 1 row each) before and after this verification.

**Recommendation: Go for beginning frontend integration**, once explicitly authorised — the schema itself is fully verified live, with no discrepancy from review. Two things remain before wiring, both already tracked above, not new: `variation_number` generation needs a concurrency-safe server-side solution (the existing tool's `localStorage` counter cannot be carried over), and the frontend must supply the one-time client/project snapshot at creation (Confirmation 4) since the schema deliberately does not do this itself.

## Variation number generation (011, applied and fully verified live)

**The problem this closes:** the existing tool generates the next variation number in the browser (`js/tools/variation-notice/config.js`'s `nextVariationNumber()`, a per-browser `localStorage` counter). Two people in the same organisation creating a variation at the same time would both read the same "next" value, both attempt to save it, and one would fail on `variation_notices_org_project_number_unique_idx` (010) with a raw constraint-violation error — confusing, and entirely avoidable by not computing the number in JavaScript at all.

**Design, as it stands after this round:**
- `internal.variation_number_counters` — one row per project, `next_number integer`. Lives in `internal` (same reasoning as `internal.current_organisation_id()`, 005): not part of the API surface, unreachable via the Data API regardless, RLS-enabled with zero policies and zero grants to `anon`/`authenticated` as belt-and-braces on top of that. `ON DELETE CASCADE` from `projects` so a privileged project hard-delete (test-data cleanup, ADR-010's carve-out) never leaves an orphaned counter row.
- `internal.prevent_variation_number_counter_decrease()` — a `BEFORE UPDATE` trigger on the counters table rejecting any write that would lower `next_number`. New this round, closing one of the two required checks directly.
- `assign_variation_notice_number()` — a `BEFORE INSERT` trigger on `variation_notices`, `SECURITY DEFINER`, fixed `search_path = ''`. If the client leaves `variation_number` blank, it atomically assigns the next number for that project (`INSERT ... ON CONFLICT (project_id) DO UPDATE ... RETURNING`), then runs a bounded (max 1000 iterations) proactive check — does a `variation_notices` row for this project already hold that candidate string? — advancing and retrying until it finds one that's free, before accepting it. If the client supplies a non-blank value, it's respected as-is (manual override), no loop involved.
- `create_variation_notice(...)` — new this round. A transactional RPC that validates the caller (`internal.current_organisation_id()`), validates the target project belongs to that organisation, validates the required fields, then performs the insert (which allocates the number via the trigger above) and returns the created row — the number is never handed to the client separately from creating the row. `SECURITY INVOKER`, deliberately: every read/write it performs is something the calling `authenticated` user already has direct RLS-permitted access to, so there is no privilege to escalate to (unlike the trigger, which genuinely needs `SECURITY DEFINER` because `authenticated` has zero grant on the counters table). `search_path = ''` is still set, as a correctness measure rather than a privilege-escalation defence. Wraps the insert in a bounded (max 5 attempts) retry loop that catches `unique_violation` specifically on `variation_notices_org_project_number_unique_idx`: a manual-override collision raises a clean, single error and does not retry; an auto-assign collision retries (the trigger computes a fresh candidate each attempt) as defence-in-depth for the one race the proactive loop can't fully close (see below). `REVOKE ALL FROM public, anon; GRANT EXECUTE TO authenticated` only.

### Two workflow risks closed this round

**1. Allocation must not be separable from draft creation.** Re-examined the original design: the number was already assigned inside the `BEFORE INSERT` trigger itself, not returned by a separate callable ahead of a later insert — so there was never actually a window where a browser could hold a "burned" number without a corresponding row. What was missing was a clean, validated, single-round-trip entry point instead of a bare `INSERT`. `create_variation_notice()` is that entry point: one call validates, allocates, inserts, and returns the row as a single transaction. The trigger remains in place underneath it as a backstop for any other insert path, not only this RPC.

**2. Manual-override collisions must not later break auto-assignment.** Demonstrated the user's literal scenario directly: counter at `003`, manually saved `VAR-010` (prefixed — a different string from anything the generator itself produces), then continued auto-assigning `004` through `010`. The bare `"010"` the generator eventually produced did **not** collide with `"VAR-010"` — confirmed they are different strings, and the sequence completed cleanly with no error at any point. The narrower, real risk is a manual override in the *same bare format* the generator uses (someone manually types `"010"` with no prefix) — closed with two layers: the proactive collision-avoidance loop in the trigger (handles the realistic case, including a project's very first auto-assignment when manual bare numbers already exist and no counter row has been created yet — no need to parse or understand non-standard manual formats, since those can never collide with a bare-format candidate in the first place), and the RPC's bounded retry-on-conflict as a backstop for the one race the proactive check can't close on its own: a concurrent manual insert for the exact candidate landing in an as-yet-uncommitted transaction at the moment the check runs. That narrow case is still caught — it just surfaces as a real `unique_violation` on the actual insert regardless, and the RPC's retry loop turns that into a clean retry (or a clean error, if the collision was itself a manual override) instead of a raw constraint-violation message reaching the user.

### Round three: a canonical format, not string inequality

Round two's own fix was itself flagged as a product-consistency problem: `"VAR-010"` and bare `"010"` not colliding is technically correct but not what a user means by those two entries — they read as the same variation number. The fix is a real canonical format:

- **Auto-generated references are always `"VAR-" || <padded number>`** — `"VAR-001"`, `"VAR-002"`, ..., `"VAR-999"`, `"VAR-1000"`. Never a bare number.
- **A manually-entered *standard-equivalent* reference is normalised to that same canonical form before it is stored.** "Standard-equivalent" means bare digits (`"010"`), or `"VAR"`/`"var"` (case-insensitive) followed by an optional hyphen or space then digits (`"var-010"`, `"VAR 010"`, `"VAR-010"`). All four of those inputs normalise to the one string `"VAR-010"`.
- **A manually-entered reference that doesn't match that shape is genuinely custom and is stored exactly as typed**, e.g. `"CLIENT-VO-10"`.

Two new pure functions carry this: `internal.format_variation_number(bigint)` (the round-two 1000-safe padding, factored out) and `internal.normalize_variation_number(text)` (recognises standard-equivalent input and reduces it to canonical form, or passes a custom reference through unchanged). Both the auto-assign path and the manual-entry path inside `assign_variation_notice_number()` route through them, so there is exactly one definition of "canonical" — the two paths cannot drift apart. `create_variation_notice()` (`SECURITY INVOKER`) also calls `normalize_variation_number()` directly, to report a collision error against the canonical value that was actually about to be stored rather than the raw text the caller typed — the one function in this migration where `authenticated` is granted `EXECUTE` on an `internal.*` helper, safe because it's a pure text transformation that touches no table and has nothing to escalate to.

**"Two semantically equivalent standard references must not coexist in the same project" falls out of the existing per-project unique index (010) for free**, once normalisation happens before the row is written — there is no separate rule to maintain, because equivalent inputs are now, literally, the same string by the time anything checks uniqueness. The same collapse is what makes the counter safely skip a manually entered higher canonical number: a manually saved `"VAR-010"` is now exactly the string the auto-generator would itself produce on reaching 10, so the *existing* collision-avoidance loop from round two skips past it correctly with no changes needed to that loop at all.

**Demonstrated directly, matching the reviewer's request:** counter at `"003"`, manually saved `"VAR-010"`, then seven more auto-assigns (`"VAR-004"` through what would be `"VAR-010"`) — the 7th auto-assign correctly detected the collision with the manually-saved `"VAR-010"` and skipped to `"VAR-011"` instead, with no error surfaced to the caller at any point.

**Also verified: the bounded retry in `create_variation_notice()` only catches the variation-number uniqueness conflict, never conceals an unrelated one.** Added a throwaway unique constraint on an unrelated column pair (`project_id, client_name`) purely for this check, then violated it: the RPC's `exception when unique_violation` handler correctly compared `constraint_name` against `'variation_notices_org_project_number_unique_idx'`, found no match, and re-raised the original Postgres error (`duplicate key value violates unique constraint "variation_notices_test_unrelated_unique"`) immediately and unmodified — no retry attempt, no reworded "already exists" message, and the counter's own increment for that failed attempt was rolled back with it (confirmed via the counter's `next_number`, which advanced by exactly one committed success, not two). The throwaway constraint was dropped immediately after, restoring the real schema.

**Why no advisory lock is needed for the base allocation, unlike `bootstrap_organisation()` (006):** `bootstrap_organisation()` genuinely needs one because its race is a separate check-then-insert (two statements, a real window between them). The base allocation here does the entire read-and-increment as one atomic statement — Postgres itself serialises two concurrent upserts targeting the same primary key; there is no separate read for two callers to race on. Adding a lock on top of that would be redundant. The collision-avoidance loop layered on top does not change this: it is a plain existence check backed by the table's own unique index as the actual, unconditional guarantee — not a second locking mechanism.

### A real bug found and fixed by this round's testing

The original draft formatted every auto-assigned number with `lpad(v_next::text, 3, '0')`, on the documented assumption that `lpad()` simply passes a value through unpadded once it's already at least as wide as the target — i.e. that a project's 1000th variation would cleanly become `"1000"`. **Testing beyond 999 (a check the user's list explicitly required) showed this assumption was wrong.** Postgres's `lpad()` *truncates* rather than passing through: `lpad('1000', 3, '0')` returns `"100"`, keeping only the rightmost 3 characters — silently corrupting the number and colliding with the real, already-issued `"100"`. Confirmed directly (`select lpad(1000::text, 3, '0');` → `100`) rather than trusted from the code reading correct. Fixed with an explicit width check: numbers below 1000 are still zero-padded to 3 digits as before; at or above 1000 the value passes through unpadded (`"1000"`, `"1001"`, ...). Re-tested after the fix: primed a project's counter to `999`, the next auto-assign correctly produced `"1000"` (4 characters, not truncated). This is exactly why "numbering works beyond 999" was tested as an explicit, isolated case rather than assumed from the surrounding logic being otherwise correct.

### Full local test suite, round two

All tests run against a rebuilt local Postgres 16 sandbox (migrations 001–008, 010, 011 applied in full order; 009 skipped — it uses the `MAINTAIN` privilege, Postgres 17+ only, already applied and verified live in Phase 1, irrelevant to 010/011), using disposable fixtures (two organisations, two `auth.users` owners, seven projects covering each scenario below) and a real `authenticated`-role JWT claim throughout (not the Postgres superuser, which would trivially bypass every grant being tested):

| # | Test | Result |
|---|---|---|
| 1 | Basic sequential auto-assign via `create_variation_notice()`, including GST on/off and a validation error (missing client name) | Pass — `"001"`, `"002"`, correct GST math, clean validation error |
| 2 | Same-format manual-override collision avoidance: auto-assign 3, manually insert bare `"004"`–`"010"` directly, auto-assign again | Pass — correctly skipped all seven, landed on `"011"` |
| 3 | Diff-format manual override, the literal user scenario: auto-assign to `"003"`, manually save `"VAR-010"`, continue auto-assigning through `"010"` | Pass **at the time, under round-two's bare-number design** — no collision; `"VAR-010"` and `"010"` coexisted as distinct rows. **Superseded by round three**: this behaviour was itself flagged as a product-consistency problem and no longer applies — see below, where the same scenario now correctly *does* collide, because both inputs normalise to the same canonical string. |
| 4 | Pre-existing manual numbers before a project's first-ever auto-assignment (no counter row yet) | Pass — manually inserted `"001"`, `"002"`; first auto-assign correctly produced `"003"` |
| 5 | Numbering beyond 999 | **Failed on first run — caught the `lpad` truncation bug above.** Passed after the fix: counter primed to `999`, next auto-assign produced `"1000"` |
| 6 | Counter cannot be decreased directly (privileged direct `UPDATE` lowering `next_number`) | Pass — rejected by `prevent_variation_number_counter_decrease()` |
| 7 | Project deletion cleans up its counter row | Pass — ordinary delete correctly blocked by `variation_notices` `RESTRICT` while rows exist; privileged cleanup (delete `variation_notices` rows, then the project) left zero counter rows behind, confirming the `ON DELETE CASCADE` |
| 8 | Cross-organisation project rejection via `create_variation_notice()` specifically | Pass — `"Project not found in your organisation."` |
| 9 | Catalog checks: fixed `search_path` on both functions; `PUBLIC`/`anon` cannot execute either; only `authenticated` can execute `create_variation_notice()`; zero grants of any kind on the counters table for any client role | Pass on every check |
| 10 | Genuine concurrency re-test against the revised trigger (with the collision-avoidance loop now in the critical path) | Pass — using the same overlap-then-poll methodology as the first round (background transaction A confirmed via a log marker before foreground transaction B starts, closing the false-negative risk of two sequential tool calls each carrying their own round-trip latency, which produced a spurious instant "pass" on the first attempt at this retest before being redone correctly within a single shell invocation): B blocked for **4.953s** against A's 5-second hold, then received the correct next number with no collision |

### Full local test suite, round three (canonical format)

Rebuilt local sandbox, same migration chain and fixture approach as round two, extended with more projects to cover each new scenario. All 10 items from the reviewer's checklist, in the order requested:

| # | Test | Result |
|---|---|---|
| 1 | Automatic creation returns `"VAR-001"` | Pass |
| 2 | Numbering passes correctly from `"VAR-999"` to `"VAR-1000"` | Pass — counter primed to `999`, next auto-assign produced `"VAR-1000"` |
| 3 | Manual `"010"` normalises to `"VAR-010"` | Pass |
| 4 | Manual `"var-010"` normalises to `"VAR-010"` | Pass (also separately confirmed the space-separator form, `"VAR 001"`, normalises correctly — exercised as part of test 5) |
| 5 | A second equivalent standard reference is rejected | Pass — `"001"` accepted as `"VAR-001"`; a second, differently-typed `"VAR 001"` on the same project correctly rejected: `"A variation numbered \"VAR-001\" already exists for this project."` |
| 6 | A genuinely custom value such as `"CLIENT-VO-10"` remains valid | Pass — stored exactly as typed, no normalisation applied |
| 7 | The counter safely skips a manually entered higher canonical number | Pass — counter at `"VAR-003"`, manually saved `"VAR-010"`, seven further auto-assigns correctly produced `"VAR-004"` through `"VAR-009"` then skipped straight to `"VAR-011"` (no error, no collision) |
| — | Bounded retry catches only the variation-number uniqueness conflict, never conceals an unrelated one | Pass — see "Round three" above for the throwaway-constraint methodology; the real Postgres constraint-violation error surfaced immediately and unmodified, with no retry |
| — | Genuine concurrency re-test against the final trigger logic | Pass — same overlap-then-poll methodology as prior rounds: B blocked **4.951s** against A's 5-second hold, then received the correct next canonical number (`"VAR-003"`) with no collision |
| — | Catalog checks re-run for the two new functions alongside the existing two | Pass — `search_path = ''` fixed on all four (`assign_variation_notice_number`, `create_variation_notice`, `internal.format_variation_number`, `internal.normalize_variation_number`); `anon` cannot execute any of them; `authenticated` can execute exactly `create_variation_notice()` and `internal.normalize_variation_number()` (the latter granted specifically so the RPC can report canonical-form collision errors), and nothing else; zero grants of any kind on the counters table for any client role |

Full regression of every round-two item (project deletion cascade, counter non-decrease, cross-organisation rejection) was also re-run against the final schema and passed unchanged.

**Not built:** reassignment or re-normalisation on `UPDATE` (the trigger is `INSERT`-only; clearing an existing row's number back to blank, or editing it directly, does not trigger a fresh auto-assignment or normalisation pass — a direct `UPDATE` bypasses both, the same way it bypasses auto-assignment); reclaiming/compacting numbers from abandoned drafts (gaps are expected and accepted — the guarantee is no collision, ever, not no gaps, same as invoice numbering in any accounting system); resetting a project's counter (no product requirement yet); any attempt to recognise or reformat a genuinely custom reference (`"CLIENT-VO-10"` and similar are intentionally left exactly as typed, forever).

## Live deployment verification (011, 2026-07-31)

Applied to `hpcqncghvdrlvufxfdnd` via `apply_migration`, exact content of commit `d6ac0ed` on `feature/phase-3-documents-schema`. All checks below were run live against the real project.

**Catalog checks — all passed:**
- `internal.variation_number_counters`, `internal.format_variation_number()`, `internal.normalize_variation_number()`, `public.assign_variation_notice_number()`, `public.create_variation_notice()`, `internal.prevent_variation_number_counter_decrease()` — all exist.
- RLS enabled on `internal.variation_number_counters` (`relrowsecurity = true`), zero policies — same secure-by-default posture as the local sandbox.
- Both triggers present and enabled (`tgenabled = 'O'`): `variation_notices_assign_number` on `variation_notices`, `variation_number_counters_prevent_decrease` on `internal.variation_number_counters`.
- `search_path = ''` fixed on all four functions (`assign_variation_notice_number`, `create_variation_notice`, `internal.format_variation_number`, `internal.normalize_variation_number`); `assign_variation_notice_number` confirmed `SECURITY DEFINER`, the other three confirmed `SECURITY INVOKER`.
- Grants confirmed via `has_function_privilege`: `anon` can execute none of `create_variation_notice`, `normalize_variation_number`, `format_variation_number`, or the trigger function; `authenticated` can execute exactly `create_variation_notice()` and `internal.normalize_variation_number()` (the latter deliberately, so the RPC can report canonical-form collision errors), and nothing else.
- `internal.variation_number_counters` holds zero grants of any kind for `anon`/`authenticated`/`public` — only the table owner.

**Functional checks, using disposable data (two organisations, two disposable `auth.users` owners, five projects) — all passed:**
- Automatic creation via `create_variation_notice()` returned `"VAR-001"`.
- Counter primed to `999` directly; next auto-assign correctly produced `"VAR-1000"`.
- Manual `"010"` normalised to `"VAR-010"`; manual `"var-010"` (different project) also normalised to `"VAR-010"`.
- A second, differently-typed equivalent reference (`"VAR 010"`, space separator) on the same project as an existing `"VAR-010"` was correctly rejected: `"A variation numbered \"VAR-010\" already exists for this project. Choose a different number."` — the failed attempt rolled back cleanly with no residue.
- A genuinely custom reference (`"CLIENT-VO-10"`) was stored exactly as typed.
- Counter-skip demonstrated directly: two auto-assigns (`"VAR-001"`, `"VAR-002"`), a manual `"VAR-005"`, then three more auto-assigns correctly produced `"VAR-003"`, `"VAR-004"`, and skipped straight to `"VAR-006"` — no collision, no error.
- Cross-organisation project rejection via `create_variation_notice()` confirmed: `"Project not found in your organisation."`.
- Counter non-decrease confirmed: a direct privileged `UPDATE` lowering `next_number` was rejected by `prevent_variation_number_counter_decrease()`.
- Zero duplicate `(project_id, variation_number)` pairs across all disposable data at the end of testing — confirmed by direct query, not inferred.
- Project-deletion cascade confirmed as a side effect of cleanup itself: after deleting all disposable `variation_notices` rows and projects, `internal.variation_number_counters` for those projects dropped to zero rows, matching the `ON DELETE CASCADE` design.

**Concurrency behaviour — verified where practical, not re-proven live.** The MCP tool interface used for live verification executes one statement group per call against a fresh connection; it cannot hold a transaction open across separate tool calls the way a local `psql` session can, so the genuine overlapping-transaction methodology used in local testing (background transaction holds a row lock for a measured duration, foreground transaction is only started after confirming the lock is held, block time is measured) is not reproducible against the live project through this interface. What was practical and was done: every functional test above ran through the identical, byte-for-byte migration content that was already proven race-free locally (4.951s block, correct sequential numbering, no collision — see "Round three" above), and the atomic `INSERT ... ON CONFLICT (project_id) DO UPDATE ... RETURNING` primitive the guarantee rests on is a single Postgres statement, not application-level logic that could behave differently between environments. No live discrepancy from the local result is expected or was observed in any of the sequential functional tests run above (all of which exercised the same code path).

**Discrepancies between local and live behaviour: none.** Every catalog and functional result matched the local Postgres 16 sandbox exactly.

**Test data cleanup:** confirmed complete. All disposable `variation_notices`/`projects`/`profiles`/`organisations`/`auth.users` rows removed; re-queried at zero afterward, including the counters table (cascade-cleaned live, as noted above). The one pre-existing real organisation/profile/project/auth-users pair (from the user's own live signup testing) was confirmed unchanged — identical counts (1/1/1/2) before and after this verification.

**Recommendation: Go for Sprint 3 frontend integration**, once explicitly authorised — both `010` and `011` are now fully verified live with no discrepancy from review, on `feature/phase-3-documents-schema`, not merged to `main`.

## Next steps

1. ~~Review this note, ADR-016, and `supabase/migrations/010_create_variation_notices.sql` together.~~ Done.
2. ~~Apply `010` to `hpcqncghvdrlvufxfdnd` and verify.~~ Done — see "Live deployment verification" above.
3. ~~Solve `variation_number` generation server-side.~~ Done — `011` applied to `hpcqncghvdrlvufxfdnd` and fully verified live on 2026-07-31, see "Live deployment verification (011)" above.
4. Wire Variation Generator to it (Sprint 3): gate `variation-generator.html` with the same `requireSession()`/no-flash pattern as `app-dashboard.html`, reuse `project-store.js`'s marked `PROJECT_STORAGE_POINT` extension point for the actual read/write calls, launch the tool from `app-dashboard.html` (pick or create a project first) rather than from `dashboard.html`. Drop the now-redundant `builderName`/`builderABN`/etc. and `projectName` fields from the form itself, sourcing them from the join instead. **Not started — explicitly held pending review of this live deployment report, per standing instruction.**
5. Manual test checklist, same rigor as `docs/PHASE_2_FRONTEND_TEST_CHECKLIST.md` — create, list, refresh, issue, and the cross-tenant isolation check (a second organisation must not see the first's variation notices).
6. Write up the resulting pattern as a short playbook so Batch 1 (quote-builder, progress-claim, payment-reminder, subcontractor-agreement, contract-termination) becomes close to mechanical.
7. **Small maintenance follow-up, confirmed:** add `search_path = ''` to `internal.prevent_variation_number_counter_decrease()` (011) for consistency with every other function in this migration — not exploitable today (it references nothing unqualified), but worth closing so the convention holds across every security-relevant function without exception. Timing: the first commit after Sprint 3 merges, or a tiny standalone maintenance migration/PR before Sprint 4 if that's cleaner. See `docs/RELEASE_v0.2.0_SPRINT2.md` ("Known limitations") for the original finding.
