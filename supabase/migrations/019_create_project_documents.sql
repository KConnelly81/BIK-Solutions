-- ============================================================================
-- Migration: 019_create_project_documents.sql
-- Purpose:   One shared, multi-tenant table — public.project_documents — for
--            every remaining standalone/localStorage document-generator tool
--            (Contract Termination, Defect Report, Delay Notice, EOT Claim,
--            Handover Checklist, Incident Report, Inspection Checklist,
--            Instruction to Proceed, Non-Conformance Report, Notice to Show
--            Cause, Payment Reminder, Practical Completion, Scope of Works,
--            Site Diary, Subcontractor Agreement, SWMS, Toolbox Talk — 17
--            tools). Closes the last gap in "every existing tool is
--            project-connected, multi-tenant cloud-backed" — see the Closed
--            Beta Preparation pass's own follow-up instruction.
--
--            Deliberate deviation from the Quotes/Progress Claims/Variation
--            Notices precedent (each its own dedicated table): every one of
--            these 17 tools was checked against its actual field schema
--            (js/tools/<tool>/config.js) before this design was chosen, not
--            assumed. None has repeating line items or a server-computed
--            running total — the specific reasons Quotes (012) and Progress
--            Claims (015) got dedicated tables with triggers and numbering.
--            They are all flat, single-record forms. One shared table with
--            a `document_type` discriminator and a `form_data jsonb`
--            payload is the same multi-tenant RLS boundary applied once
--            instead of duplicated seventeen times — not a shortcut, a
--            better fit for what this data actually is. A tool whose needs
--            outgrow this (a calculated total, a numbering sequence) is a
--            future ADR to split it into its own dedicated table, exactly
--            as Quotes was split out originally — this table is not a
--            trap that other tables can't be extracted from later.
--
--            No SECURITY DEFINER function, no RPC, and no numbering
--            sequence exist in this migration — deliberately. Every
--            existing dedicated-table tool needed one of those because of
--            cross-row derived values (totals, previously-claimed amounts)
--            or an auto-assigned number. None of these 17 tools has either:
--            each already generates its own reference number client-side
--            (e.g. "DN-001") via a per-tool localStorage counter, unchanged
--            by this migration — project_documents.title simply records
--            whatever that already-generated reference is, exactly the way
--            quotes.quote_number records a database-generated one. Plain
--            authenticated INSERT/UPDATE, RLS-scoped, is the entire write
--            path.
-- Phase:     7 (Full platform migration — remaining standalone tools)
-- Depends on: 001_create_organisations.sql (set_updated_at()),
--             004_create_projects.sql (projects table),
--             005_phase1_rls.sql (internal.current_organisation_id())
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: project_documents
-- ----------------------------------------------------------------------------
create table if not exists public.project_documents (
  id                uuid primary key default gen_random_uuid(),

  organisation_id   uuid not null references public.organisations(id) on delete restrict,
  project_id        uuid not null references public.projects(id) on delete restrict,

  -- Controlled vocabulary — one value per tool. Deliberately enumerated
  -- (not free text): this is the single source of truth for "which simple
  -- document tools exist" at the database layer, same posture as every
  -- other status/type column in this schema (profiles.role,
  -- attendance_records.worker_type, etc.).
  document_type     text not null,

  -- The tool's own client-generated reference (e.g. "DN-001", "SWMS-014")
  -- or, failing that, a fallback the frontend derives — never
  -- database-assigned. Same role as quotes.quote_number, but sourced from
  -- the tool's existing per-device counter rather than a numbering RPC,
  -- because unlike quote_number this value was never meant to be globally
  -- unique or gapless — it already isn't, across devices, today.
  title             text not null default '',

  -- Soft-delete only, per ADR-010 (see 005_phase1_rls.sql's projects/
  -- customers sections) — no DELETE grant exists for authenticated below.
  status            text not null default 'draft',

  -- The full FormEngine field-value map for this document. Not validated
  -- field-by-field at the database layer (deliberate — these are draft
  -- documents a builder is iterating on, not a financial ledger with
  -- calculation integrity requirements like quotes/progress_claims); the
  -- form's own client-side required-field handling is unchanged by this
  -- migration.
  form_data         jsonb not null default '{}'::jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  updated_by        uuid references auth.users(id) on delete set null,

  constraint project_documents_document_type_check
    check (document_type in (
      'contract_termination', 'defect_report', 'delay_notice', 'eot_claim',
      'handover_checklist', 'incident_report', 'inspection_checklist',
      'instruction_to_proceed', 'non_conformance_report', 'notice_to_show_cause',
      'payment_reminder', 'practical_completion', 'scope_of_works', 'site_diary',
      'subcontractor_agreement', 'swms', 'toolbox_talk'
    )),

  constraint project_documents_status_check
    check (status in ('draft', 'archived')),

  constraint project_documents_form_data_is_object_check
    check (jsonb_typeof(form_data) = 'object')
);

comment on table public.project_documents is
  'Shared, multi-tenant table for every simple (no line items, no server-computed totals) document-generator tool. See migration header for why this is one table, not seventeen, and how that decision was reached.';
comment on column public.project_documents.title is
  'The tool''s own client-generated reference number (e.g. "DN-001"), recorded here, not assigned here — same role as quotes.quote_number but sourced from each tool''s existing per-device counter, unchanged by this migration.';
comment on column public.project_documents.form_data is
  'The full form field-value map, as FormEngine.getState() returns it. Not validated per-field at the database layer — see table comment.';

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists project_documents_organisation_id_idx
  on public.project_documents (organisation_id);

create index if not exists project_documents_project_id_idx
  on public.project_documents (project_id);

-- Supports both a single tool's own list (WHERE project_id = X AND
-- document_type = 'defect_report') and a taxonomy-grouped list on Project
-- Hub (WHERE project_id = X AND document_type IN (...)).
create index if not exists project_documents_project_type_idx
  on public.project_documents (project_id, document_type);

create index if not exists project_documents_organisation_status_idx
  on public.project_documents (organisation_id, status);

-- ----------------------------------------------------------------------------
-- updated_at trigger (reuses public.set_updated_at() from 001)
-- ----------------------------------------------------------------------------
create or replace trigger project_documents_set_updated_at
  before update on public.project_documents
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Cross-tenant integrity: project_id must belong to organisation_id.
-- Identical pattern to enforce_attendance_project_same_organisation() (018)
-- and enforce_progress_claim_project_same_organisation() (015) — a new
-- function, not a shared one, because a shared cross-table trigger function
-- would need dynamic per-call table awareness Postgres trigger functions
-- don't have a clean way to express; this one-line function is cheap
-- enough that duplicating its (tiny) body per table, as every other
-- migration in this schema already does, is the right amount of reuse —
-- see the platform-wide Closed Beta Preparation instruction to extend
-- shared code, which this migration does everywhere it actually can
-- (project_documents itself is that extension, applied once instead of
-- seventeen times; see the header comment).
-- ----------------------------------------------------------------------------
create or replace function public.enforce_project_document_same_organisation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.projects
    where id = new.project_id
      and organisation_id = new.organisation_id
  ) then
    raise exception 'project_id must belong to the same organisation as the document.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_project_document_same_organisation() from public, anon, authenticated;

create or replace trigger project_documents_enforce_project_same_organisation
  before insert or update on public.project_documents
  for each row
  execute function public.enforce_project_document_same_organisation();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- Same shape as customers/projects (005_phase1_rls.sql): full read/create/
-- update for any org member, within their own organisation. No DELETE
-- policy for any role — per ADR-010, routine removal is
-- status = 'archived' via the existing UPDATE policy, already available to
-- any org member. Physical row deletion is a service_role/admin-tooling
-- concern, not part of the client-facing API — identical posture to every
-- other table in this schema.
-- ----------------------------------------------------------------------------
alter table public.project_documents enable row level security;

drop policy if exists project_documents_select_same_org on public.project_documents;
create policy project_documents_select_same_org
  on public.project_documents for select to authenticated
  using (organisation_id = (select internal.current_organisation_id()));

drop policy if exists project_documents_insert_same_org on public.project_documents;
create policy project_documents_insert_same_org
  on public.project_documents for insert to authenticated
  with check (organisation_id = (select internal.current_organisation_id()));

drop policy if exists project_documents_update_same_org on public.project_documents;
create policy project_documents_update_same_org
  on public.project_documents for update to authenticated
  using (organisation_id = (select internal.current_organisation_id()))
  with check (organisation_id = (select internal.current_organisation_id()));

-- ----------------------------------------------------------------------------
-- Grants — no anon access at all (unlike attendance, none of these 17
-- tools has a worker-facing/anonymous entry point; every save is an
-- authenticated builder). document_type and organisation_id are granted
-- for UPDATE (unlike quotes.quote_number/status, which are deliberately
-- excluded) because there is no numbering RPC or lifecycle trigger here to
-- bypass — a client changing its own draft's document_type would just be
-- self-inflicted confusion, not a security or numbering-integrity issue,
-- and locking it down would need machinery (a column-grant carve-out) this
-- table has no other reason to carry.
-- ----------------------------------------------------------------------------
revoke all on public.project_documents from anon, authenticated;
grant select, insert, update on public.project_documents to authenticated;

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberate scope limits):
--   - Any numbering RPC — each tool keeps its own existing client-side
--     counter, unchanged.
--   - Any issue/lock workflow — none of these 17 tools has one today (only
--     Quotes/014 does; Progress Claims'/017 stays BLOCKED); adding one
--     would be a new feature, not a migration of an existing one.
--   - Per-document-type dedicated columns or child tables (e.g. SWMS'
--     hazard/control rows, Toolbox Talk's attendee list) — these remain
--     inside form_data jsonb. If a specific tool's structured sub-data
--     later needs real querying/reporting, splitting it into its own
--     dedicated table (and, if warranted, its own migration) is a future,
--     separate decision — not foreclosed by this one.
-- ============================================================================
