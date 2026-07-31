# Phase 3 — `variation_notices` Table Design Note

**Purpose:** Design overview for `public.variation_notices`, the schema backing the Variation Notices pilot migration — the first tool moved from `localStorage` onto the authenticated project model.
**Status:** Draft. Migration file exists (`supabase/migrations/010_create_variation_notices.sql`) but has **not been applied** to `hpcqncghvdrlvufxfdnd`, and the frontend is **not wired up**. This note, the migration, and ADR-016 are for review together before either happens.
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
| `variation_number` | `variationNumber` | `text not null` | Required | Reporting, output; unique per org | Typed — short, looked up and filtered by, uniqueness enforced |
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
| `issued_snapshot` | *(new)* | `jsonb` | — | Audit | **The one genuinely jsonb-appropriate field** — a frozen serialized copy of the typed columns at the moment of issue, so an edited draft can never silently rewrite what was actually sent. Derived/secondary data about the row, not the row's primary content. |

**Net result:** every field with any bearing on calculation, filtering, reporting, status, or integration is a real typed column. `jsonb` appears exactly once, for exactly the case it's meant for.

## Security

- RLS reuses `internal.current_organisation_id()` (005) directly — same read/create/update-within-own-org shape as `customers`/`projects`, no new helper function.
- **Cross-tenant integrity check, unchanged from the earlier draft:** a `project_id` foreign key alone doesn't guarantee the referenced project belongs to the same organisation the row claims. `enforce_variation_notice_project_same_organisation()` (a `BEFORE INSERT OR UPDATE` trigger) closes that explicitly.
- Explicit `GRANT SELECT, INSERT, UPDATE ... TO authenticated` in the same migration — learned from C2/ADR-014: nothing is inherited by default for a new table.
- No `DELETE` policy or grant — soft delete via `status = 'archived'`, per ADR-010.

## Deliberately not built here

- Concurrency-safe per-organisation `variation_number` generation. The tool's current numbering is a per-browser `localStorage` counter (`bik-variation-counter`) — not safe to carry over unchanged into a shared, multi-user organisation (two users could generate the same next number concurrently). This needs an application-layer (or dedicated sequence/RPC) solution as part of wiring the frontend, not solved by this migration.
- A full multi-transition audit/status-history table (`status_changed_at`/`by` captures only the latest transition).
- Database-enforced immutability of typed columns/`issued_snapshot` once a document is issued (left to the tool's own UI for now).
- A modelled multi-party approval workflow (`approved`/`rejected` are plain status values).
- Snapshotting builder/business details onto this table — already fully covered by `organisation_id -> organisations`, no product requirement yet to decouple them from the live record.
- The same table-per-type pattern for the next tool (Progress Claims, Quotes, etc.) — each gets its own dedicated table and migration when its turn comes, per ADR-016.

## Next steps

1. Review this note, ADR-016, and `supabase/migrations/010_create_variation_notices.sql` together.
2. Once approved, apply `010` to `hpcqncghvdrlvufxfdnd` and verify (table exists, RLS enabled, policies match, grants match, both triggers present and firing, generated columns compute correctly) — same verification discipline as `docs/PHASE_1_DEPLOYMENT_RUNBOOK.md`.
3. Solve `variation_number` generation server-side (see "Deliberately not built here" above) before or alongside wiring the frontend.
4. Wire Variation Generator to it: gate `variation-generator.html` with the same `requireSession()`/no-flash pattern as `app-dashboard.html`, reuse `project-store.js`'s marked `PROJECT_STORAGE_POINT` extension point for the actual read/write calls, launch the tool from `app-dashboard.html` (pick or create a project first) rather than from `dashboard.html`. Drop the now-redundant `builderName`/`builderABN`/etc. and `projectName` fields from the form itself, sourcing them from the join instead.
5. Manual test checklist, same rigor as `docs/PHASE_2_FRONTEND_TEST_CHECKLIST.md` — create, list, refresh, issue, and the cross-tenant isolation check (a second organisation must not see the first's variation notices).
6. Write up the resulting pattern as a short playbook so Batch 1 (quote-builder, progress-claim, payment-reminder, subcontractor-agreement, contract-termination) becomes close to mechanical.
