-- ============================================================================
-- Migration: 010_create_documents.sql
-- Purpose:   Creates public.documents — a single generic table shared across
--            every document-generating tool (Variation Notices first;
--            Progress Claims, Quotes, Defect Reports, etc. to follow), rather
--            than a dedicated table per document type. See ADR-016
--            (docs/decisions/README.md) for why: at ~20 tools, a table per
--            type means ~20 near-identical migrations and RLS policy sets
--            for what is structurally the same shape (fields + status +
--            project + organisation). One table, a `type` discriminator, and
--            a `fields` jsonb payload keeps the migration surface flat as
--            more tools are added, and gets a cross-tool "all documents for
--            this project" view for free.
--
--            DRAFT — not yet applied to hpcqncghvdrlvufxfdnd. This file is
--            for review alongside docs/PHASE_3_DOCUMENTS_SCHEMA.md and
--            ADR-016 before it is run against the live project, following
--            the same draft-then-review-then-apply sequence every migration
--            in this repo has gone through.
-- Phase:     3 (Tool migration — Variation Notices pilot)
-- Depends on: 001_create_organisations.sql (set_updated_at() trigger),
--             004_create_projects.sql (projects table),
--             005_phase1_rls.sql (internal.current_organisation_id())
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: documents
-- One row per generated document (a Variation Notice, a Progress Claim,
-- etc.), always scoped to exactly one project and one organisation.
-- ----------------------------------------------------------------------------
create table if not exists public.documents (
  id                    uuid primary key default gen_random_uuid(),

  -- Tenancy. RESTRICT, same convention as 002-004: an organisation must not
  -- be deletable while any document remains.
  organisation_id       uuid not null references public.organisations(id) on delete restrict,

  -- Every document belongs to a project — unlike customer_id on projects
  -- (004), this is not optional. A document with no project doesn't fit
  -- this model; if a "quick document, no project yet" flow is ever wanted,
  -- that is a deliberate future product decision, not a default to fall
  -- into here. RESTRICT: deleting a project must not silently delete or
  -- orphan its document history.
  project_id            uuid not null references public.projects(id) on delete restrict,

  -- Discriminator for which tool/template produced this row. Deliberately a
  -- CHECK, not left open: garbage or misspelled type values are a real risk
  -- with a shared table, and each addition is already its own reviewed
  -- migration (one ALTER per tool-migration batch), so the small maintenance
  -- cost is worth the protection. Extend with:
  --   alter table public.documents drop constraint documents_type_check;
  --   alter table public.documents add constraint documents_type_check
  --     check (type in ('variation_notice', '<next-type>', ...));
  type                  text not null,

  -- Free-text identifier (e.g. "VN-0042"), same nullable/not-auto-generated
  -- convention as projects.project_number (004) — numbering is an
  -- application-layer concern, not this migration's.
  document_number       text,

  -- Lifecycle. draft: being edited, mutable. issued: sent to the client —
  -- see issued_snapshot below for what "issued" freezes. approved/rejected:
  -- client response to an issued document. archived: soft-deleted, ADR-010
  -- convention (no DELETE policy is added below).
  status                text not null default 'draft',

  -- The actual form data — field names/shapes are owned by each tool's own
  -- config.js, not by this schema. This is the deliberate trade-off ADR-016
  -- discusses: no per-field DB constraint, in exchange for one shared table
  -- across every document type instead of one migration per type.
  fields                jsonb not null default '{}'::jsonb,

  -- Frozen at the moment status transitions draft -> issued (application-
  -- layer responsibility for now, not DB-enforced — see the migration's
  -- accompanying design note for why immutability-after-issue is a
  -- deliberately deferred v2 hardening, not built here). Preserves what was
  -- actually sent to the client even if fields is edited afterwards.
  issued_snapshot        jsonb,

  -- Same free-text integration-reference convention as
  -- projects.external_reference (004).
  external_reference    text,
  notes                 text,

  -- Captures the most recent status transition only (who moved this to
  -- issued/approved/rejected/archived, and when) — not a full multi-
  -- transition history. A dedicated document_status_history table is a
  -- reasonable future addition if a full audit trail is ever required;
  -- deliberately not built in this migration. See ADR-016.
  status_changed_at     timestamptz,
  status_changed_by     uuid references auth.users(id) on delete set null,

  -- Audit fields, same convention as 001-004.
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id) on delete set null,
  updated_by            uuid references auth.users(id) on delete set null,

  constraint documents_type_check
    check (type in ('variation_notice')),

  constraint documents_status_check
    check (status in ('draft', 'issued', 'approved', 'rejected', 'archived'))
);

comment on table public.documents is
  'One row per generated document, shared across every document-generating tool via the type discriminator. Always scoped to exactly one project and organisation. See ADR-016 for the generic-table-vs-per-type rationale.';
comment on column public.documents.type is
  'Which tool/template produced this row. CHECK-constrained deliberately — extend via ALTER TABLE as each new tool migrates, see the constraint definition below for the exact statement.';
comment on column public.documents.fields is
  'The document''s actual form data. Field names/shapes are owned by each tool''s own config.js, not enforced at the database layer — the trade-off this table''s design deliberately makes (ADR-016).';
comment on column public.documents.issued_snapshot is
  'Frozen copy of fields at the moment status first became issued. Populated by the application, not a trigger — immutability-after-issue is not DB-enforced in this migration.';
comment on column public.documents.status_changed_at is
  'Timestamp of the most recent status transition only, not a full history. A dedicated history table is a deliberately deferred future addition, see ADR-016.';

-- ----------------------------------------------------------------------------
-- Cross-tenant integrity: project_id must belong to the same organisation as
-- organisation_id. Without this, the organisation_id column alone (correctly
-- re-validated by this table's own RLS WITH CHECK below) does nothing to
-- stop project_id from pointing at a project belonging to a DIFFERENT
-- organisation — the foreign key only confirms the project exists
-- *somewhere*, not that it's the caller's own. This is exactly the kind of
-- cross-tenant leak vector 005's "every request is potentially malicious"
-- posture exists to close, so it is checked explicitly here rather than
-- assumed safe by construction.
--
-- SECURITY DEFINER + explicit organisation-match check (rather than relying
-- on projects' own RLS implicitly scoping an invoker-privileged lookup to
-- the caller's org): explicit and independently correct, not dependent on
-- projects' RLS being configured a particular way elsewhere — same reasoning
-- internal.current_organisation_id() (005) gives for its own DEFINER use.
-- SET search_path = '': prevents search_path hijacking, same as every other
-- DEFINER function in this schema.
-- Not deferrable: unlike 007's last-owner invariant, there is no legitimate
-- multi-step transaction where project_id/organisation_id is expected to be
-- momentarily inconsistent, so an immediate check is correct here.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_document_project_same_organisation()
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
      using errcode = '23514'; -- check_violation
  end if;
  return new;
end;
$$;

comment on function public.enforce_document_project_same_organisation() is
  'Blocks inserting/updating a document whose project_id belongs to a different organisation than organisation_id claims. Defence-in-depth alongside this table''s own RLS WITH CHECK, which only validates organisation_id in isolation.';

create or replace trigger documents_enforce_project_same_organisation
  before insert or update on public.documents
  for each row
  execute function public.enforce_document_project_same_organisation();

-- Trigger function, not called directly by any client role — same reasoning
-- as public.set_updated_at() (001).
revoke all on function public.enforce_document_project_same_organisation() from public;
revoke all on function public.enforce_document_project_same_organisation() from anon;
revoke all on function public.enforce_document_project_same_organisation() from authenticated;

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

create index if not exists documents_organisation_id_idx
  on public.documents (organisation_id);

create index if not exists documents_project_id_idx
  on public.documents (project_id);

-- Supports the primary "documents for this project" and "documents of this
-- type in this org" list views.
create index if not exists documents_organisation_status_idx
  on public.documents (organisation_id, status);

create index if not exists documents_organisation_type_idx
  on public.documents (organisation_id, type);

-- No duplicate document numbers within one organisation *and* type, once a
-- number has been assigned (NULLs excluded, same partial-index pattern as
-- projects_organisation_project_number_unique_idx, 004). Scoped by type as
-- well as organisation_id: "Variation Notice #1" and "Progress Claim #1"
-- must not collide with each other.
create unique index if not exists documents_organisation_type_number_unique_idx
  on public.documents (organisation_id, type, document_number)
  where document_number is not null;

-- ----------------------------------------------------------------------------
-- updated_at trigger (reuses public.set_updated_at() from 001)
-- ----------------------------------------------------------------------------
create or replace trigger documents_set_updated_at
  before update on public.documents
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- Same shape as customers/projects (005): any org member (owner/admin/
-- member) may read, create, and update within their own organisation.
-- Reuses internal.current_organisation_id() directly — no new helper
-- function needed.
--
-- No DELETE policy — per ADR-010 (soft delete), "removal" is this same
-- UPDATE policy setting status = 'archived'. Physical row deletion follows
-- the same service_role-only path as customers/projects.
-- ----------------------------------------------------------------------------
alter table public.documents enable row level security;

drop policy if exists documents_select_same_org on public.documents;
create policy documents_select_same_org
  on public.documents
  for select
  to authenticated
  using (organisation_id = (select internal.current_organisation_id()));

drop policy if exists documents_insert_same_org on public.documents;
create policy documents_insert_same_org
  on public.documents
  for insert
  to authenticated
  with check (organisation_id = (select internal.current_organisation_id()));

drop policy if exists documents_update_same_org on public.documents;
create policy documents_update_same_org
  on public.documents
  for update
  to authenticated
  using (organisation_id = (select internal.current_organisation_id()))
  with check (organisation_id = (select internal.current_organisation_id()));

-- ----------------------------------------------------------------------------
-- Baseline table-level GRANTs for authenticated.
--
-- Not inherited from anywhere — ADR-014/ADR-015 (008/009) corrected the
-- *default* ACL only for the dangerous MAINTAIN/REFERENCES/TRIGGER/TRUNCATE
-- privileges (so those never reappear on a future table by default); they
-- deliberately did not make SELECT/INSERT/UPDATE default for future tables,
-- consistent with this codebase's "grant only what a policy can act on"
-- philosophy (ADR-014's own rationale). A new table created via SQL
-- migration starts with zero client-role privileges, secure-by-default,
-- same as organisations/profiles/customers/projects did before 008 existed.
-- This table's own grants are therefore issued explicitly here, in the same
-- migration that creates it — learning C2's lesson (a missing-grant defect
-- found only during live deployment validation) rather than repeating it.
--
-- No DELETE (matches the RLS policies above — no DELETE policy exists for
-- authenticated, so a DELETE grant would be strictly wider than what any
-- policy supports). Nothing granted to anon.
--
-- Created via SQL migration, not the Supabase Studio Table Editor — ADR-015
-- documents that the Table Editor creates objects as supabase_admin, whose
-- own default ACL grants anon/authenticated/service_role full privileges
-- automatically. That path is not used here or for any future table.
-- ----------------------------------------------------------------------------
revoke all on public.documents from anon, authenticated;
grant select, insert, update on public.documents to authenticated;

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberately deferred, tracked here):
--   - Per-type field-shape validation at the database layer (ADR-016) — the
--     `fields` jsonb column is not schema-validated by Postgres; each tool's
--     own config.js is the source of truth for its field shape.
--   - Full multi-transition audit/status-history table — status_changed_at/
--     status_changed_by capture only the most recent transition.
--   - DB-enforced immutability of `fields`/`issued_snapshot` once a document
--     is issued — left to the application layer (each tool's own UI) for
--     now.
--   - Approval workflow beyond a single status value (e.g. multi-party
--     sign-off, approval comments) — 'approved'/'rejected' are plain status
--     values, not a modelled workflow.
--   - Customer linkage — documents reference project_id only. If a document
--     needs its own direct customer_id later (rather than going through
--     project.customer_id), that is a separate, reviewed schema change.
-- ----------------------------------------------------------------------------
