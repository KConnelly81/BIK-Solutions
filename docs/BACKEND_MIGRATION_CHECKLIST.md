# Backend Migration Checklist — New Document-Backed Tool

**Purpose:** A mechanical checklist for adding a new dedicated table for a document-generation tool (the ADR-016 pattern — a dedicated, strongly typed table per document type, not a generic `documents` table), derived from `010_create_variation_notices.sql` and `011_variation_notice_number_generator.sql`, both applied live and fully verified. Following this checklist doesn't skip review — it means the review starts from a known-good shape instead of from scratch, the way Variation Notice's own three review rounds had to.
**Status:** Active
**Owner:** BIK Solutions Pty Ltd

---

## Before writing SQL

1. **Field inventory first, always.** For every field the tool's existing `SCHEMA` collects: proposed column name, type, required/optional, whether it affects totals/status/reporting/output, and whether it's a plain typed column or genuinely variable secondary data (`jsonb` — should be rare; see ADR-016). Do not start the migration until this table exists and has been reviewed.
2. **Decide if the record needs `project_id` to be `NOT NULL`.** Variation Notice does — a variation always belongs to a project. Some future tools may not (e.g. a quote could plausibly exist before a project is confirmed). This is a real design decision, not a default to copy blindly.
3. **Decide if it needs atomic, collision-free numbering at all.** Most tools don't. Variation Notice did specifically because builders expect sequential, non-colliding reference numbers and the old client-side counter proved unsafe under concurrent use. If the tool doesn't have that requirement, skip straight to a plain typed `reference` column (or no reference column at all) — do not add the counter-table-plus-trigger machinery on spec.

## Table shape (every dedicated document table)

- `id uuid primary key default gen_random_uuid()`
- `organisation_id uuid not null references public.organisations(id) on delete restrict`
- `project_id uuid [not null] references public.projects(id) on delete restrict` — see point 2 above for nullability
- Typed columns for every field from the inventory that affects totals, status, reporting, or output. `jsonb` only for the rare genuinely-variable field.
- Money as integer cents (`_cents` suffix), matching the platform-wide convention — never floats.
- `status text not null default 'draft'` with a `check` constraint enumerating the tool's real statuses, plus `status_changed_at`/`status_changed_by` if the tool needs to know when/who changed it.
- Audit columns: `created_at`/`updated_at timestamptz not null default now()`, `created_by`/`updated_by uuid references auth.users(id) on delete set null`.

## Required objects (every dedicated document table)

- [ ] `enforce_<table>_project_same_organisation()` — `BEFORE INSERT OR UPDATE` trigger confirming `NEW.project_id` actually belongs to `NEW.organisation_id`. A foreign key alone does not guarantee this.
- [ ] `set_updated_at()` trigger (reuse the existing shared function, don't write a new one).
- [ ] RLS enabled, exactly 3 policies (`select`/`insert`/`update`, no `delete` — soft-delete via `status = 'archived'`, per ADR-010), each scoped `organisation_id = internal.current_organisation_id()`.
- [ ] Explicit grants: `revoke all ... from public, anon; grant select, insert, update on <table> to authenticated`. Nothing is inherited by default for a new table — this must be explicit every time.
- [ ] If (and only if) atomic numbering is needed: follow `011`'s pattern exactly — a dedicated `internal.<x>_counters` table (RLS enabled, zero policies, zero grants), a canonical-format helper, a manual-entry normaliser, a `BEFORE INSERT` assignment trigger with the proactive collision-avoidance loop, and a `create_<x>()` `SECURITY INVOKER` RPC wrapping validation + the insert + a bounded retry on the specific unique-violation constraint. Do not build a lighter version of this — the collision/race analysis in `011`'s own comments is the reason it looks the way it does.

## Before applying to Supabase

- [ ] Local Postgres dry run with disposable fixtures, testing as the `authenticated` role (a real JWT claim), not the superuser.
- [ ] If numbering is involved: the same test matrix `011` used — auto-assign, manual-entry normalisation, duplicate rejection, cross-organisation rejection, counter non-decrease, beyond-999 (or whatever the natural width boundary is), a genuine overlapping-transaction concurrency test.
- [ ] Apply only after explicit review sign-off, same as every migration in this repo — draft-then-review-then-apply, never skipped.
- [ ] Live catalog + functional verification with disposable data after applying, cleanup confirmed, real production data confirmed untouched before and after.

## Frontend wiring

Use `js/toolkit/supabase-project-context.js` and `js/toolkit/supabase-record-panel.js` (Sprint 4) — do not write a bespoke per-tool integration file. See `js/tools/variation-notice/supabase-integration.js` for the worked example of a tool built on top of them.
