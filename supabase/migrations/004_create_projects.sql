-- ============================================================================
-- Migration: 004_create_projects.sql
-- Purpose:   Creates the projects table — the primary business object in
--            BIK. Almost every future module (Variation Notices, AI
--            Documents, Site Diary, Attendance, Defects, Progress Claims,
--            Quotes, Invoices, Purchase Orders, RFIs, Photos, the Approval
--            Portal) will reference projects.id rather than duplicating
--            project details. This table is designed to stay stable as
--            those modules are added, not to be reshaped by each one.
-- Phase:     1 (Foundation)
-- Depends on: 001_create_organisations.sql (organisations table,
--             set_updated_at() trigger function)
--             003_create_customers.sql (customers table)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: projects
-- One row per construction/trade job. Mirrors the current
-- js/toolkit/project-store.js record shape, normalised onto customers (003)
-- instead of duplicating client name/email/phone inline.
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id                          uuid primary key default gen_random_uuid(),

  -- Tenancy. RESTRICT: an organisation must not be deletable while any
  -- project remains, same pattern as profiles (002) and customers (003).
  organisation_id             uuid not null references public.organisations(id) on delete restrict,

  -- Optional by design (see 003 review): a project can be created before a
  -- formal customer record exists, matching today's quick-create flow.
  -- SET NULL (not RESTRICT): deleting a customer must not delete or block
  -- deletion of their project history — it should just detach the link.
  -- Whether a customer-facing document (e.g. an invoice) can be issued
  -- without a linked, complete customer record is a business-logic
  -- decision enforced by the application layer, not by this schema.
  customer_id                 uuid references public.customers(id) on delete set null,

  -- Identity. project_number is intentionally nullable and not generated
  -- here — see the numbering note at the bottom of this file.
  project_number              text,
  -- Free-text identifier from an external system: a BuilderTrend job ID, a
  -- Xero job/tracking code, a client's own job number, a council DA/permit
  -- reference. Deliberately a single flexible field rather than a set of
  -- named integration columns — new integrations are a WHERE clause away,
  -- not a schema change.
  external_reference          text,
  name                        text not null,
  description                 text,

  status                      text not null default 'draft',

  site_address                text,
  start_date                  date,
  completion_date             date,
  -- Estimated contract value, stored as integer cents (same convention as
  -- the rest of the platform — see integration-architecture.md — to avoid
  -- floating-point rounding on money). This is an estimate, not the
  -- authoritative contract/progress-claim total; that ledger belongs to
  -- Progress Claims / Invoices in a later phase, not this column.
  estimated_contract_value_cents bigint,
  notes                       text,

  -- Audit fields, same convention as 001/002/003.
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  created_by                  uuid references auth.users(id) on delete set null,
  updated_by                  uuid references auth.users(id) on delete set null,

  constraint projects_status_check
    check (status in ('draft', 'active', 'completed', 'archived')),

  -- Sensible, not strict: only rejects an impossible date pair. Either date
  -- may be absent (a draft project has neither yet).
  constraint projects_dates_check
    check (completion_date is null or start_date is null or completion_date >= start_date),

  constraint projects_contract_value_check
    check (estimated_contract_value_cents is null or estimated_contract_value_cents >= 0)
);

comment on table public.projects is
  'The primary business object in BIK. Future modules (documents, attendance, defects, claims, approvals, etc.) reference projects.id via foreign key rather than duplicating project details — this table is designed to stay stable as those modules are added.';
comment on column public.projects.customer_id is
  'Optional. A project may exist before a formal customer record is linked. Application logic must verify a complete customer record exists before issuing customer-facing documents (invoices, approval requests) — this is not enforced at the schema level.';
comment on column public.projects.project_number is
  'Nullable, not auto-generated by this migration. Automatic sequential numbering (e.g. per-organisation "PRJ-0042") is an application service or Edge Function concern, added later.';
comment on column public.projects.external_reference is
  'Free-text reference from an external system (BuilderTrend job ID, Xero job code, client job number, council application number, etc.). Enables future integrations to look up a project by a foreign identifier without overloading project_number.';
comment on column public.projects.status is
  'Simple Phase 1 lifecycle: draft, active, completed, archived. Deliberately does not model schedules, milestones, or on-hold/paused states yet.';
comment on column public.projects.estimated_contract_value_cents is
  'Estimate only, stored as integer cents. Not the authoritative contract ledger — that belongs to Progress Claims/Invoices in a later phase.';

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

-- Base FK-lookup indexes; every RLS policy in 005 filters on organisation_id,
-- and customer_id is queried whenever a customer's project history is shown.
create index if not exists projects_organisation_id_idx
  on public.projects (organisation_id);

create index if not exists projects_customer_id_idx
  on public.projects (customer_id);

-- Supports the primary project-list screen: filter by status within an org.
create index if not exists projects_organisation_status_idx
  on public.projects (organisation_id, status);

-- Supports search/sort by project name within an org.
create index if not exists projects_organisation_name_idx
  on public.projects (organisation_id, name);

-- Enforces no duplicate project numbers within one organisation, once a
-- number has been assigned, without blocking the many draft projects that
-- have no number yet (NULLs are excluded from a partial unique index).
create unique index if not exists projects_organisation_project_number_unique_idx
  on public.projects (organisation_id, project_number)
  where project_number is not null;

-- Supports "find the project for this BuilderTrend/Xero/council reference"
-- lookups from future integrations. Not unique — a builder could
-- legitimately paste the same external reference more than once (e.g. a
-- placeholder), and that is a data-quality concern, not a constraint
-- violation.
create index if not exists projects_organisation_external_reference_idx
  on public.projects (organisation_id, external_reference)
  where external_reference is not null;

-- ----------------------------------------------------------------------------
-- updated_at trigger (reuses public.set_updated_at() from 001)
-- ----------------------------------------------------------------------------
create or replace trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- Enabled immediately, no policies yet — same secure-by-default posture as
-- 001, 002, and 003. Policies are added in 005_phase1_rls.sql.
-- ----------------------------------------------------------------------------
alter table public.projects enable row level security;

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberate Phase 1 scope limits):
--   - Automatic project numbering (application service / Edge Function,
--     later — see project_number comment above)
--   - Schedules, milestones, budgets, cost codes
--   - Multiple site addresses per project, or GPS/geo fields
--   - Document/attendance/defect/claim linkage — those future tables will
--     each carry a project_id uuid references public.projects(id), not
--     duplicate project fields
-- ----------------------------------------------------------------------------
