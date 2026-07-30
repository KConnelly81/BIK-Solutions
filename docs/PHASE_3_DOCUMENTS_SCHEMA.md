# Phase 3 — `documents` Table Design Note

**Purpose:** Design overview for `public.documents`, the schema addition backing the Variation Notices pilot migration (and every form-engine tool migrated after it).
**Status:** Draft. Migration file exists (`supabase/migrations/010_create_documents.sql`) but has **not been applied** to `hpcqncghvdrlvufxfdnd`. This note, the migration, and ADR-016 are for review together before it's run — same draft-then-review-then-apply sequence every Phase 1 migration went through.
**Owner:** BIK Solutions Pty Ltd

---

## Why this exists

Variation Generator (and every tool like it) currently persists nothing to a database — drafts live in `localStorage` via `js/toolkit/engine.js`'s autosave. `js/toolkit/project-store.js` only ever held project metadata (client, address, contract ref), never the generated documents themselves. Moving Variation Generator onto the authenticated project model means a real place for those documents to live, scoped to an organisation and a project, governed by the same RLS boundary as everything else.

## The one real decision this note captures

**One shared `documents` table with a `type` discriminator, not a table per document type.** Full rationale in **ADR-016** (`docs/decisions/README.md`) — short version: `organisations`/`profiles`/`customers`/`projects` each got their own table because there were four of them. There are roughly twenty document-generating tools ahead. A table per type means twenty near-duplicate migrations and RLS policy sets for what's structurally the same shape every time. One table now, extended by a one-line `ALTER TABLE` per future tool, keeps that surface flat — and gets a cross-tool "all documents for this project" view for free.

Attendance and Site Diary are **not** covered by this table — they're not form-engine documents (see the plan discussed in-conversation) and get their own schema when their turn comes.

## Schema, at a glance

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `organisation_id` | Tenancy — RESTRICT on delete, same as every other table |
| `project_id` | **Not null** (unlike `projects.customer_id`) — every document belongs to exactly one project |
| `type` | Which tool produced this row (`'variation_notice'` today; CHECK-constrained, extended per future tool) |
| `document_number` | Free-text (e.g. "VN-0042"), unique per org+type when present |
| `status` | `draft` / `issued` / `approved` / `rejected` / `archived` |
| `fields` | jsonb — the actual form data; shape owned by each tool's own `config.js`, not this schema |
| `issued_snapshot` | jsonb, frozen copy of `fields` at the moment `status` first became `issued` |
| `external_reference`, `notes` | Same free-text convention as `projects` |
| `status_changed_at` / `status_changed_by` | Most recent transition only, not a full history |
| `created_at`/`updated_at`/`created_by`/`updated_by` | Standard audit fields |

## Security

- RLS reuses `internal.current_organisation_id()` (005) directly — same read/create/update-within-own-org shape as `customers`/`projects`, no new helper function.
- **New integrity check this shape needs:** a `project_id` on its own doesn't guarantee it belongs to the same organisation the document claims — a plain foreign key only confirms the project exists *somewhere*. `enforce_document_project_same_organisation()` (a `BEFORE INSERT OR UPDATE` trigger) closes that explicitly rather than assuming it away.
- Explicit `GRANT SELECT, INSERT, UPDATE ... TO authenticated` in the same migration — learned directly from C2/ADR-014: nothing is inherited by default for a new table, so this migration grants what it needs itself instead of risking rediscovering the same missing-grant defect during deployment validation.
- No `DELETE` policy or grant — soft delete via `status = 'archived'`, per ADR-010, same as `customers`/`projects`.

## Deliberately not built here

- Per-field validation of `fields` at the database layer (the core trade-off of a shared table — see ADR-016).
- A full multi-transition audit/status-history table (`status_changed_at`/`by` captures only the latest transition).
- Database-enforced immutability of `fields`/`issued_snapshot` once a document is issued (left to each tool's own UI for now).
- A modelled multi-party approval workflow (`approved`/`rejected` are plain status values).
- A direct `customer_id` on documents (reached transitively via `project.customer_id` today).

Each of these is a legitimate future addition, not an oversight — call them out again if any becomes a real requirement before then.

## Next steps

1. Review this note, ADR-016, and `supabase/migrations/010_create_documents.sql` together.
2. Once approved, apply `010` to `hpcqncghvdrlvufxfdnd` and verify (table exists, RLS enabled, policies match, grants match, trigger present and firing) — same verification discipline as `docs/PHASE_1_DEPLOYMENT_RUNBOOK.md`.
3. Wire Variation Generator to it: gate `variation-generator.html` with the same `requireSession()`/no-flash pattern as `app-dashboard.html`, reuse `project-store.js`'s marked `PROJECT_STORAGE_POINT` extension point for the actual read/write calls, launch the tool from `app-dashboard.html` (pick or create a project first) rather than from `dashboard.html`.
4. Manual test checklist, same rigor as `docs/PHASE_2_FRONTEND_TEST_CHECKLIST.md` — create, list, refresh, issue, and the cross-tenant isolation check (a second organisation must not see the first's documents).
5. Write up the resulting pattern as a short playbook so Batch 1 (quote-builder, progress-claim, payment-reminder, subcontractor-agreement, contract-termination) becomes close to mechanical.
