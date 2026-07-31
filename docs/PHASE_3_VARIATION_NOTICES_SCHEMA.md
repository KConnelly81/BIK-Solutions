# Phase 3 — `variation_notices` Table Design Note

**Purpose:** Design overview for `public.variation_notices`, the schema backing the Variation Notices pilot migration — the first tool moved from `localStorage` onto the authenticated project model.
**Status:** Migration `010_create_variation_notices.sql` (commit `3211d3b`) **applied and fully verified** against `hpcqncghvdrlvufxfdnd` on 2026-07-31 — see "Live deployment verification" below for the complete results. The frontend is still **not wired up** — that remains a separate, explicitly gated step.
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

- Concurrency-safe per-organisation `variation_number` generation. The tool's current numbering is a per-browser `localStorage` counter (`bik-variation-counter`) — not safe to carry over unchanged into a shared, multi-user organisation (two users could generate the same next number concurrently). This needs an application-layer (or dedicated sequence/RPC) solution as part of wiring the frontend, not solved by this migration.
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

## Next steps

1. ~~Review this note, ADR-016, and `supabase/migrations/010_create_variation_notices.sql` together.~~ Done.
2. ~~Apply `010` to `hpcqncghvdrlvufxfdnd` and verify.~~ Done — see "Live deployment verification" above.
3. Solve `variation_number` generation server-side (see "Deliberately not built here" above) before or alongside wiring the frontend.
4. Wire Variation Generator to it: gate `variation-generator.html` with the same `requireSession()`/no-flash pattern as `app-dashboard.html`, reuse `project-store.js`'s marked `PROJECT_STORAGE_POINT` extension point for the actual read/write calls, launch the tool from `app-dashboard.html` (pick or create a project first) rather than from `dashboard.html`. Drop the now-redundant `builderName`/`builderABN`/etc. and `projectName` fields from the form itself, sourcing them from the join instead. **Not started — explicitly held pending separate review/authorisation of this report, per standing instruction.**
5. Manual test checklist, same rigor as `docs/PHASE_2_FRONTEND_TEST_CHECKLIST.md` — create, list, refresh, issue, and the cross-tenant isolation check (a second organisation must not see the first's variation notices).
6. Write up the resulting pattern as a short playbook so Batch 1 (quote-builder, progress-claim, payment-reminder, subcontractor-agreement, contract-termination) becomes close to mechanical.
