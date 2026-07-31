-- ============================================================================
-- Migration: 010_create_variation_notices.sql
-- Purpose:   Creates public.variation_notices — a dedicated, strongly typed
--            table for the first tool migrated onto the authenticated
--            project model (Variation Generator, js/tools/variation-notice/).
--            Supersedes an earlier draft of this migration that proposed a
--            single generic public.documents table with a type discriminator
--            and a jsonb fields payload; see ADR-016 (docs/decisions/
--            README.md) for why that draft was replaced with this dedicated-
--            table approach instead.
--
--            Every column with any bearing on calculation, filtering,
--            reporting, status, or output is a real typed column, derived
--            directly from js/tools/variation-notice/config.js's SCHEMA (see
--            docs/PHASE_3_VARIATION_NOTICES_SCHEMA.md for the full field
--            inventory this migration was drafted from). jsonb is used for
--            exactly one column (issued_snapshot) — genuinely variable
--            secondary/derived data, not the document's primary content.
--
--            DRAFT — not yet applied to hpcqncghvdrlvufxfdnd. For review
--            alongside docs/PHASE_3_VARIATION_NOTICES_SCHEMA.md and ADR-016
--            before it is run, same draft-then-review-then-apply sequence
--            every migration in this repo has gone through.
-- Phase:     3 (Tool migration — Variation Notices pilot)
-- Depends on: 001_create_organisations.sql (set_updated_at() trigger),
--             004_create_projects.sql (projects table),
--             005_phase1_rls.sql (internal.current_organisation_id())
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: variation_notices
-- One row per Variation Notice. Always scoped to exactly one project and one
-- organisation — same convention as every other Phase 1 table.
-- ----------------------------------------------------------------------------
create table if not exists public.variation_notices (
  id                        uuid primary key default gen_random_uuid(),

  -- Tenancy. RESTRICT, same convention as 002-004: an organisation must not
  -- be deletable while any variation notice remains.
  organisation_id           uuid not null references public.organisations(id) on delete restrict,

  -- Every variation notice belongs to a project — not optional, unlike
  -- projects.customer_id. RESTRICT: deleting a project must not silently
  -- delete or orphan its variation notice history.
  project_id                uuid not null references public.projects(id) on delete restrict,

  -- ── Identity ────────────────────────────────────────────────────────────
  -- Free-text (e.g. "003"), matching the tool's existing VN-### numbering.
  -- Not DB-generated: the tool's current counter is a per-browser
  -- localStorage value (bik-variation-counter), which is not safe to carry
  -- over unchanged into a shared, multi-user organisation (two users could
  -- generate the same next number concurrently). Deriving a correct,
  -- concurrency-safe per-organisation next-number is an application-layer
  -- concern for the frontend migration step, not solved by this migration —
  -- same deliberate deferral 004 made for projects.project_number.
  variation_number          text not null,
  date_issued               date not null default current_date,

  -- ── Lifecycle ───────────────────────────────────────────────────────────
  -- draft: being edited, mutable. issued: sent to the client (see
  -- issued_snapshot below). approved/rejected: client response. archived:
  -- soft-deleted, ADR-010 convention (no DELETE policy is added below).
  status                    text not null default 'draft',

  -- ── Client details snapshot ─────────────────────────────────────────────
  -- A plain copy on this row, not a live join through project_id ->
  -- customer_id -> customers. Decoupled deliberately: what a variation
  -- notice says about the client is a fact about that document as issued,
  -- not something that should silently change if the linked customer
  -- record is edited later.
  client_name               text not null,
  client_email              text,

  -- ── Project/document context ────────────────────────────────────────────
  -- site_address is kept as its own field (not sourced from projects.site_
  -- address) because a variation can legitimately specify a different work
  -- address than the project's own. contract_reference is likewise this
  -- document's own stated reference, not necessarily identical to any
  -- project-level reference field.
  site_address              text,
  contract_reference        text,
  requested_by              text,

  -- ── Core content ─────────────────────────────────────────────────────────
  reason_for_variation      text not null,
  description_of_work       text not null,
  exclusions_assumptions    text,
  materials_required        text,
  labour_required            text,
  builder_notes             text,

  -- ── Cost (integer cents, matching projects.estimated_contract_value_cents'
  --    existing platform-wide money convention — avoids floating-point
  --    rounding) ───────────────────────────────────────────────────────────
  cost_excl_gst_cents       bigint not null,
  gst_applicable            boolean not null default true,

  -- Both computed, never independently writable — always exactly consistent
  -- with cost_excl_gst_cents/gst_applicable by construction, so there is no
  -- "stored total drifted from its inputs" failure mode to guard against.
  -- Postgres does not allow a generated column's expression to reference
  -- another generated column, so the GST case expression is repeated in
  -- total_cents rather than reused from gst_cents.
  gst_cents                 bigint generated always as (
                               case when gst_applicable
                                 then round(cost_excl_gst_cents * 0.1)::bigint
                                 else 0::bigint
                               end
                             ) stored,
  total_cents               bigint generated always as (
                               cost_excl_gst_cents + (
                                 case when gst_applicable
                                   then round(cost_excl_gst_cents * 0.1)::bigint
                                   else 0::bigint
                                 end
                               )
                             ) stored,

  cost_type                 text not null default 'fixed',
  extension_of_time_days    integer not null default 0,
  revised_completion_date   date,
  payment_terms             text default '14days-approval',

  -- ── Approval ────────────────────────────────────────────────────────────
  -- The printed signatory name on the document itself — distinct from
  -- status_changed_by below (the authenticated app user who performed the
  -- status transition, which may not be the same person named here).
  builder_approval_name     text,
  client_approval_name      text,

  -- Captures the most recent status transition only (who moved this to
  -- issued/approved/rejected/archived, and when) — not a full multi-
  -- transition history. A dedicated status-history table is a reasonable
  -- future addition if a full audit trail is ever required; deliberately
  -- not built in this migration.
  status_changed_at         timestamptz,
  status_changed_by         uuid references auth.users(id) on delete set null,

  -- Frozen at the moment status first transitions draft -> issued
  -- (application-layer responsibility, not a DB trigger in this migration).
  -- The one deliberately jsonb column on this table: a serialized copy of
  -- the typed columns above as they stood at issue time, so an edited draft
  -- can never silently rewrite what was actually sent to the client. This
  -- is genuinely variable/derived secondary data about the row, not the
  -- row's primary content — unlike the earlier generic-documents draft,
  -- where jsonb held the primary payload itself.
  issued_snapshot           jsonb,

  -- Audit fields, same convention as 001-004.
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  created_by                uuid references auth.users(id) on delete set null,
  updated_by                uuid references auth.users(id) on delete set null,

  constraint variation_notices_status_check
    check (status in ('draft', 'issued', 'approved', 'rejected', 'archived')),

  constraint variation_notices_cost_type_check
    check (cost_type in ('fixed', 'estimate', 'provisional')),

  constraint variation_notices_payment_terms_check
    check (payment_terms is null or payment_terms in (
      '7days-approval', '14days-approval', '14days-invoice',
      '30days-invoice', 'practical-completion', 'per-contract'
    )),

  constraint variation_notices_cost_check
    check (cost_excl_gst_cents >= 0),

  constraint variation_notices_extension_of_time_check
    check (extension_of_time_days >= 0),

  -- Sensible, not strict — same convention as projects_dates_check (004):
  -- only rejects an impossible pair, and only when both are present.
  constraint variation_notices_dates_check
    check (revised_completion_date is null or revised_completion_date >= date_issued),

  constraint variation_notices_client_email_format_check
    check (client_email is null or client_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

comment on table public.variation_notices is
  'One row per Variation Notice, the first tool migrated onto the authenticated project model. Dedicated, strongly typed table — see ADR-016 for why this was chosen over a shared generic documents table.';
comment on column public.variation_notices.client_name is
  'Snapshot of the client name as entered on this document, deliberately decoupled from any live customers record — see the migration header comment.';
comment on column public.variation_notices.issued_snapshot is
  'Frozen copy of this row''s typed field values at the moment status first became issued. The only jsonb column on this table, and deliberately so — see the migration header comment and ADR-016.';
comment on column public.variation_notices.variation_number is
  'Free-text variation number (e.g. "003"). Not DB-generated — see the migration header comment on why the tool''s existing localStorage counter cannot be carried over unchanged into a shared, multi-user organisation.';

-- ----------------------------------------------------------------------------
-- Cross-tenant integrity: project_id must belong to the same organisation as
-- organisation_id. Without this, organisation_id alone (correctly
-- re-validated by this table's own RLS WITH CHECK below) does nothing to
-- stop project_id from pointing at a project belonging to a DIFFERENT
-- organisation — a foreign key only confirms the project exists
-- *somewhere*, not that it's the caller's own. Exactly the kind of
-- cross-tenant leak vector 005's "every request is potentially malicious"
-- posture exists to close, so it is checked explicitly here rather than
-- assumed safe by construction. Same trigger design as first drafted for
-- the (now superseded) generic documents table — this integrity concern is
-- unchanged by the dedicated-table decision.
--
-- SECURITY DEFINER + explicit organisation-match check (rather than relying
-- on projects' own RLS implicitly scoping an invoker-privileged lookup):
-- explicit and independently correct, not dependent on projects' RLS being
-- configured a particular way elsewhere — same reasoning
-- internal.current_organisation_id() (005) gives for its own DEFINER use.
-- SET search_path = '': prevents search_path hijacking, same as every other
-- DEFINER function in this schema.
-- Not deferrable: there is no legitimate multi-step transaction where
-- project_id/organisation_id is expected to be momentarily inconsistent, so
-- an immediate check is correct here (unlike 007's deferred last-owner
-- invariant).
-- ----------------------------------------------------------------------------
create or replace function public.enforce_variation_notice_project_same_organisation()
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
    raise exception 'project_id must belong to the same organisation as the variation notice.'
      using errcode = '23514'; -- check_violation
  end if;
  return new;
end;
$$;

comment on function public.enforce_variation_notice_project_same_organisation() is
  'Blocks inserting/updating a variation notice whose project_id belongs to a different organisation than organisation_id claims. Defence-in-depth alongside this table''s own RLS WITH CHECK, which only validates organisation_id in isolation.';

create or replace trigger variation_notices_enforce_project_same_organisation
  before insert or update on public.variation_notices
  for each row
  execute function public.enforce_variation_notice_project_same_organisation();

-- Trigger function, not called directly by any client role — same reasoning
-- as public.set_updated_at() (001).
revoke all on function public.enforce_variation_notice_project_same_organisation() from public;
revoke all on function public.enforce_variation_notice_project_same_organisation() from anon;
revoke all on function public.enforce_variation_notice_project_same_organisation() from authenticated;

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

create index if not exists variation_notices_organisation_id_idx
  on public.variation_notices (organisation_id);

create index if not exists variation_notices_project_id_idx
  on public.variation_notices (project_id);

-- Supports the primary "variation notices for this project"/"...in this org
-- by status" list views.
create index if not exists variation_notices_organisation_status_idx
  on public.variation_notices (organisation_id, status);

-- No duplicate variation numbers within one organisation. Not a partial
-- index (unlike projects.project_number) — variation_number is NOT NULL on
-- this table, so every row participates.
create unique index if not exists variation_notices_organisation_number_unique_idx
  on public.variation_notices (organisation_id, variation_number);

-- Supports "this client's variation history" lookups.
create index if not exists variation_notices_organisation_client_name_idx
  on public.variation_notices (organisation_id, client_name);

-- ----------------------------------------------------------------------------
-- updated_at trigger (reuses public.set_updated_at() from 001)
-- ----------------------------------------------------------------------------
create or replace trigger variation_notices_set_updated_at
  before update on public.variation_notices
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
alter table public.variation_notices enable row level security;

drop policy if exists variation_notices_select_same_org on public.variation_notices;
create policy variation_notices_select_same_org
  on public.variation_notices
  for select
  to authenticated
  using (organisation_id = (select internal.current_organisation_id()));

drop policy if exists variation_notices_insert_same_org on public.variation_notices;
create policy variation_notices_insert_same_org
  on public.variation_notices
  for insert
  to authenticated
  with check (organisation_id = (select internal.current_organisation_id()));

drop policy if exists variation_notices_update_same_org on public.variation_notices;
create policy variation_notices_update_same_org
  on public.variation_notices
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
-- No DELETE (matches the RLS policies above). Nothing granted to anon.
--
-- Created via SQL migration, not the Supabase Studio Table Editor — ADR-015
-- documents that the Table Editor creates objects as supabase_admin, whose
-- own default ACL grants anon/authenticated/service_role full privileges
-- automatically. That path is not used here or for any future table.
-- ----------------------------------------------------------------------------
revoke all on public.variation_notices from anon, authenticated;
grant select, insert, update on public.variation_notices to authenticated;

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberately deferred, tracked here):
--   - Concurrency-safe per-organisation variation_number generation — see
--     the column comment above. Existing tool uses a per-browser
--     localStorage counter, not safe to carry over unchanged.
--   - Full multi-transition audit/status-history table — status_changed_at/
--     status_changed_by capture only the most recent transition.
--   - DB-enforced immutability of typed columns/issued_snapshot once a
--     variation notice is issued — left to the application layer for now.
--   - Approval workflow beyond a single status value (e.g. multi-party
--     sign-off, approval comments) — 'approved'/'rejected' are plain status
--     values, not a modelled workflow.
--   - Snapshotting builder/business details (name, ABN, phone, email,
--     address) onto this table. Deliberately not duplicated — these are
--     already fully covered by organisation_id -> organisations, and unlike
--     client details there is no product requirement yet to decouple them
--     from the live organisation record. Revisit if that requirement
--     appears.
--   - The same pattern for any other document type (Progress Claims,
--     Quotes, etc.) — each gets its own dedicated table and migration when
--     its turn comes, per ADR-016.
-- ----------------------------------------------------------------------------
