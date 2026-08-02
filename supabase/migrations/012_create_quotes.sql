-- ============================================================================
-- Migration: 012_create_quotes.sql
-- Purpose:   Creates public.quotes and public.quote_line_items — CORE LAYER
--            ONLY: table shape, line items, calculation ownership, RLS,
--            grants, indexes, draft editing. No numbering (013), no issue
--            workflow (014). Field inventory and review history:
--            docs/PHASE_5A_DESIGN_PROPOSAL.md,
--            docs/PHASE_5A_QUOTES_MIGRATION_REVIEW.md.
--
--            DRAFT — NOT APPLIED to hpcqncghvdrlvufxfdnd.
--
--            RESTRUCTURED from a single combined 012 draft, on request, into
--            three ordered, independently reviewable and independently
--            appliable migrations — mirroring how 010 (table) and 011
--            (numbering) were already kept apart in this exact repo, with
--            014 as a new third layer this project didn't previously need.
--            The combined draft's full design reasoning (why typed line
--            items over jsonb, why calculation ownership works the way it
--            does, why post-issue immutability has no exceptions, why
--            issuing is RPC-only) is unchanged and is not repeated in full
--            here — see the design doc. This header covers what's specific
--            to *this* file, the core layer:
--
--              1. quote_number is a plain, manually-supplied NOT NULL
--                 column in this migration — there is no auto-assignment
--                 trigger yet (013 adds it). A client must supply a value
--                 directly on INSERT. The organisation-scoped uniqueness
--                 constraint (quotes_org_number_unique_idx) IS created here,
--                 not deferred to 013 — data integrity (no duplicate
--                 numbers) is a core-table concern regardless of whether
--                 numbers are auto-assigned or typed by hand, matching
--                 010's own precedent (010 defines
--                 variation_notices_org_project_number_unique_idx itself;
--                 011 only adds the auto-assignment trigger on top of an
--                 already-unique-constrained column).
--              2. The full 7-value status lifecycle
--                 (draft/issued/accepted/declined/expired/void/archived) is
--                 declared in this migration's CHECK constraint even though
--                 only 'draft' is reachable until 014 exists — a schema-
--                 level fact about valid values is independent of which
--                 transitions are currently implemented, same relationship
--                 variation_notices' own check constraint (010) already has
--                 to 'approved'/'rejected' (declared before any workflow
--                 RPC for them existed).
--              3. authenticated's UPDATE grant on quotes excludes `status`
--                 from day one, in this migration, even though nothing here
--                 defines what a non-draft status means yet and 014's
--                 issued_at/issued_by/issued_snapshot columns don't exist
--                 yet either. This is deliberate, not premature: if status
--                 were left open to plain UPDATE in the gap between this
--                 migration and 014, a client could label a quote 'issued'
--                 with zero validation, zero snapshot, and no real meaning
--                 behind it — then 014's later immutability trigger would
--                 freeze that already-mislabelled row the moment it's
--                 applied, with no clean way to recover it. Preventing the
--                 hazard at this layer is strictly safer than trying to
--                 clean it up in 014. subtotal_cents/gst_cents/total_cents
--                 are excluded from the client grant for the same
--                 belt-and-braces reason as before — already fully
--                 protected by trigger overwrite regardless.
--              4. Consequence of (3): between this migration and 014,
--                 every quote is permanently 'draft' — there is no grant
--                 path and no trigger path that can move it, so there is
--                 nothing yet to make "immutable". Post-issue immutability
--                 genuinely only becomes a concept once 014 exists.
-- Phase:     5a (Tool migration — Quotes, core layer)
-- Depends on: 001_create_organisations.sql (set_updated_at()),
--             004_create_projects.sql (projects table),
--             005_phase1_rls.sql (internal schema, internal.
--             current_organisation_id())
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: quotes
-- ----------------------------------------------------------------------------
create table if not exists public.quotes (
  id                      uuid primary key default gen_random_uuid(),

  organisation_id         uuid not null references public.organisations(id) on delete restrict,
  project_id              uuid not null references public.projects(id) on delete restrict,

  -- Plain, manually-supplied in this migration — see decision 1 above.
  -- 013 adds auto-assignment; nothing here changes once it does (013's
  -- trigger only populates this when the client leaves it blank).
  quote_number            text not null,

  -- Snapshot-style client fields, decoupled from any live customer record —
  -- same reasoning as variation_notices.client_name (010). Nullable: a
  -- draft may exist before a recipient is chosen.
  client_name             text,
  client_email            text,
  client_phone            text,
  client_address          text,

  quote_date              date not null default current_date,
  valid_until             date,
  quote_type              text,
  scope_of_works          text,
  inclusions              text,
  exclusions              text,
  assumptions             text,
  optional_items          text,
  deposit_percent         smallint,
  payment_terms           text,
  additional_terms        text,
  builder_approval_name   text,

  -- Stored explicitly per quote, not hard-coded — see
  -- docs/PHASE_5A_DESIGN_PROPOSAL.md, "GST and retention".
  gst_rate                numeric(5,4) not null default 0.1000,

  -- Server-computed, never independently writable — see
  -- recalculate_quote_totals() below. Plain columns, not GENERATED ALWAYS
  -- AS, so the calculation logic lives in one reviewable trigger function.
  subtotal_cents          bigint not null default 0,
  gst_cents               bigint not null default 0,
  total_cents             bigint not null default 0,

  -- Full lifecycle vocabulary declared now (decision 2 above); only
  -- 'draft' is reachable until 014 exists.
  status                  text not null default 'draft',

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid references auth.users(id) on delete set null,
  updated_by              uuid references auth.users(id) on delete set null,

  constraint quotes_status_check
    check (status in ('draft', 'issued', 'accepted', 'declined', 'expired', 'void', 'archived')),

  constraint quotes_quote_type_check
    check (quote_type is null or quote_type in ('fixed', 'estimate', 'cost-plus')),

  constraint quotes_deposit_percent_check
    check (deposit_percent is null or deposit_percent in (0, 5, 10, 20, 25, 50)),

  constraint quotes_gst_rate_check
    check (gst_rate >= 0 and gst_rate < 1),

  constraint quotes_totals_non_negative_check
    check (subtotal_cents >= 0 and gst_cents >= 0 and total_cents >= 0),

  constraint quotes_client_email_format_check
    check (client_email is null or client_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

comment on table public.quotes is
  'One row per Quote. Dedicated, strongly typed table (ADR-016). Core layer only — see 013 (numbering) and 014 (issue workflow) for the rest of the lifecycle.';
comment on column public.quotes.quote_number is
  'Manually supplied in this migration — no auto-assignment trigger exists until 013. Organisation-scoped uniqueness is enforced here regardless (quotes_org_number_unique_idx below).';
comment on column public.quotes.status is
  'Full 7-value lifecycle declared here; only ''draft'' is reachable until 014 exists — see the migration header comment, decision 2/3.';
comment on column public.quotes.gst_rate is
  'The GST rate actually applied to this quote, stored explicitly so historical quotes remain correct and self-describing if the platform default rate ever changes.';
comment on column public.quotes.subtotal_cents is
  'Server-computed sum of quote_line_items.line_total_cents. Never independently writable — see recalculate_quote_totals().';
comment on column public.quotes.total_cents is
  'Server-computed subtotal_cents + gst_cents. Never independently writable — see recalculate_quote_totals().';

-- ----------------------------------------------------------------------------
-- Table: quote_line_items
-- ----------------------------------------------------------------------------
create table if not exists public.quote_line_items (
  id                 uuid primary key default gen_random_uuid(),

  -- Cascade is deliberate — a draft's own working rows, not the top-level
  -- document ADR-010 protects. Once status leaves 'draft' (only possible
  -- once 014 exists), enforce_quote_line_item_draft_only() below blocks
  -- all further insert/update/delete regardless.
  quote_id           uuid not null references public.quotes(id) on delete cascade,

  position           smallint not null,
  description        text not null,
  quantity           numeric(12,2) not null default 1,
  unit               text,

  unit_price_cents   bigint not null,
  gst_applicable     boolean not null default true,

  -- Server-computed, never independently writable — see
  -- compute_quote_line_item_amounts() below.
  line_total_cents   bigint not null default 0,
  gst_cents          bigint not null default 0,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint quote_line_items_position_check check (position >= 1),
  constraint quote_line_items_quantity_check check (quantity > 0),
  constraint quote_line_items_unit_price_check check (unit_price_cents >= 0),
  constraint quote_line_items_line_total_check check (line_total_cents >= 0),
  constraint quote_line_items_position_unique unique (quote_id, position)
);

comment on table public.quote_line_items is
  'Typed line items for a quote. line_total_cents/gst_cents are server-computed on every insert/update. Freely insertable/updatable/deletable while the parent quote is draft (the only reachable status until 014 exists).';

-- ----------------------------------------------------------------------------
-- Cross-tenant integrity: project_id must belong to organisation_id.
-- Identical pattern to enforce_variation_notice_project_same_organisation()
-- (010).
-- ----------------------------------------------------------------------------
create or replace function public.enforce_quote_project_same_organisation()
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
    raise exception 'project_id must belong to the same organisation as the quote.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

comment on function public.enforce_quote_project_same_organisation() is
  'SECURITY DEFINER — required because authenticated has no grant on public.projects beyond what its own RLS already allows the caller, and this check must succeed regardless of the caller''s own project visibility. Independently validates project_id/organisation_id itself (its entire purpose) rather than relying on any RLS check elsewhere. Fixed search_path, fully qualified references, EXECUTE revoked from all client roles below.';

create or replace trigger quotes_enforce_project_same_organisation
  before insert or update on public.quotes
  for each row
  execute function public.enforce_quote_project_same_organisation();

revoke all on function public.enforce_quote_project_same_organisation() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: compute_quote_line_item_amounts
-- Overwrites line_total_cents/gst_cents on every insert/update, regardless
-- of client input. INVOKER (default) — reads quotes.gst_rate, which the
-- caller already has RLS-permitted SELECT access to; nothing to elevate.
-- ----------------------------------------------------------------------------
create or replace function public.compute_quote_line_item_amounts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_gst_rate numeric(5,4);
begin
  select gst_rate into v_gst_rate from public.quotes where id = new.quote_id;
  if v_gst_rate is null then
    raise exception 'quote_id does not reference an existing quote.' using errcode = '23503';
  end if;

  new.line_total_cents := round(new.quantity * new.unit_price_cents);
  new.gst_cents := case when new.gst_applicable
    then round(new.line_total_cents * v_gst_rate)
    else 0
  end;
  return new;
end;
$$;

create or replace trigger quote_line_items_compute_amounts
  before insert or update on public.quote_line_items
  for each row
  execute function public.compute_quote_line_item_amounts();

-- ----------------------------------------------------------------------------
-- Trigger: enforce_quote_line_item_draft_only
-- Blocks any insert/update/delete on a line item once its parent quote is
-- no longer draft. In this migration alone, quotes.status can never
-- actually leave 'draft' (see decision 3/4 above), so this trigger is
-- inert-but-correct here — it becomes load-bearing the moment 014 is
-- applied, with no change needed to this function itself.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_quote_line_item_draft_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status  text;
  v_qid     uuid;
begin
  v_qid := case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;
  select status into v_status from public.quotes where id = v_qid;

  if v_status is distinct from 'draft' then
    raise exception 'Line items cannot be changed once the quote has been issued.'
      using errcode = '55000';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace trigger quote_line_items_enforce_draft_only
  before insert or update or delete on public.quote_line_items
  for each row
  execute function public.enforce_quote_line_item_draft_only();

-- ----------------------------------------------------------------------------
-- Trigger: recalculate_quote_totals
-- AFTER trigger on quote_line_items: recomputes the parent quote's
-- subtotal_cents/gst_cents/total_cents from the current sum of its line
-- items, on every insert, update, or delete.
--
-- SECURITY DEFINER — required: authenticated's UPDATE grant on quotes
-- (below) does not cover subtotal_cents/gst_cents/total_cents, and this
-- function issues its own separate UPDATE statement (not a same-statement
-- NEW reassignment, which wouldn't need this). Independent ownership check
-- included below even though v_qid is always derived from a
-- quote_line_items row the caller's own RLS already permitted in the same
-- statement (no client-suppliable parameter exists for this function to
-- misuse) — added anyway, as explicit belt-and-braces, per this project's
-- policy that a DEFINER function must not rely solely on the RLS check
-- that initiated the trigger it runs inside. If the check ever fails
-- (should not be reachable in practice), the function no-ops rather than
-- raising — it performs derived-data maintenance, not authorisation, so a
-- silent skip is safer than blocking an unrelated caller's transaction.
-- ----------------------------------------------------------------------------
create or replace function public.recalculate_quote_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qid     uuid;
  v_org_id  uuid;
begin
  v_qid := case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;

  v_org_id := internal.current_organisation_id();
  if v_org_id is null or not exists (
    select 1 from public.quotes where id = v_qid and organisation_id = v_org_id
  ) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  update public.quotes
  set subtotal_cents = coalesce((select sum(line_total_cents) from public.quote_line_items where quote_id = v_qid), 0),
      gst_cents       = coalesce((select sum(gst_cents)       from public.quote_line_items where quote_id = v_qid), 0),
      total_cents     = coalesce((select sum(line_total_cents) + sum(gst_cents) from public.quote_line_items where quote_id = v_qid), 0)
  where id = v_qid and organisation_id = v_org_id;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace trigger quote_line_items_recalculate_parent_totals
  after insert or update or delete on public.quote_line_items
  for each row
  execute function public.recalculate_quote_totals();

revoke all on function public.compute_quote_line_item_amounts() from public, anon, authenticated;
revoke all on function public.enforce_quote_line_item_draft_only() from public, anon, authenticated;
revoke all on function public.recalculate_quote_totals() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists quotes_organisation_id_idx on public.quotes (organisation_id);
create index if not exists quotes_project_id_idx on public.quotes (project_id);
create index if not exists quotes_organisation_status_idx on public.quotes (organisation_id, status);

-- Organisation-scoped uniqueness — a core data-integrity concern, defined
-- here regardless of numbering being manual (this migration) or
-- auto-assigned (013) — see decision 1 above.
create unique index if not exists quotes_org_number_unique_idx
  on public.quotes (organisation_id, quote_number);

create index if not exists quote_line_items_quote_id_idx on public.quote_line_items (quote_id);

-- ----------------------------------------------------------------------------
-- updated_at (reuses public.set_updated_at() from 001)
-- ----------------------------------------------------------------------------
create or replace trigger quotes_set_updated_at
  before update on public.quotes
  for each row
  execute function public.set_updated_at();

create or replace trigger quote_line_items_set_updated_at
  before update on public.quote_line_items
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.quotes enable row level security;

drop policy if exists quotes_select_same_org on public.quotes;
create policy quotes_select_same_org
  on public.quotes for select to authenticated
  using (organisation_id = (select internal.current_organisation_id()));

drop policy if exists quotes_insert_same_org on public.quotes;
create policy quotes_insert_same_org
  on public.quotes for insert to authenticated
  with check (organisation_id = (select internal.current_organisation_id()));

drop policy if exists quotes_update_same_org on public.quotes;
create policy quotes_update_same_org
  on public.quotes for update to authenticated
  using (organisation_id = (select internal.current_organisation_id()))
  with check (organisation_id = (select internal.current_organisation_id()));

alter table public.quote_line_items enable row level security;

drop policy if exists quote_line_items_select_same_org on public.quote_line_items;
create policy quote_line_items_select_same_org
  on public.quote_line_items for select to authenticated
  using (exists (
    select 1 from public.quotes q
    where q.id = quote_line_items.quote_id
      and q.organisation_id = (select internal.current_organisation_id())
  ));

drop policy if exists quote_line_items_insert_same_org on public.quote_line_items;
create policy quote_line_items_insert_same_org
  on public.quote_line_items for insert to authenticated
  with check (exists (
    select 1 from public.quotes q
    where q.id = quote_line_items.quote_id
      and q.organisation_id = (select internal.current_organisation_id())
  ));

drop policy if exists quote_line_items_update_same_org on public.quote_line_items;
create policy quote_line_items_update_same_org
  on public.quote_line_items for update to authenticated
  using (exists (
    select 1 from public.quotes q
    where q.id = quote_line_items.quote_id
      and q.organisation_id = (select internal.current_organisation_id())
  ))
  with check (exists (
    select 1 from public.quotes q
    where q.id = quote_line_items.quote_id
      and q.organisation_id = (select internal.current_organisation_id())
  ));

drop policy if exists quote_line_items_delete_same_org on public.quote_line_items;
create policy quote_line_items_delete_same_org
  on public.quote_line_items for delete to authenticated
  using (exists (
    select 1 from public.quotes q
    where q.id = quote_line_items.quote_id
      and q.organisation_id = (select internal.current_organisation_id())
  ));

-- ----------------------------------------------------------------------------
-- Grants — nothing inherited, explicit here.
--
-- quotes' UPDATE grant is column-scoped from this first migration — see
-- decision 3 above. `status` is excluded here even though 014's lifecycle
-- columns don't exist yet: there is no legitimate reason for a client to
-- move status away from 'draft' at this layer, and leaving it open would
-- create a hazard once 014 lands (an already-mislabelled row with no
-- validation or snapshot behind it, immediately frozen by 014's
-- immutability trigger). subtotal_cents/gst_cents/total_cents are excluded
-- too — belt-and-braces on top of the trigger overwrite that already
-- prevents forging them.
-- ----------------------------------------------------------------------------
revoke all on public.quotes from anon, authenticated;
grant select, insert on public.quotes to authenticated;
-- quote_number is deliberately NOT in this list — normalize_quote_number()
-- (013) only runs on INSERT (assign_quote_number()'s trigger timing), so a
-- direct client UPDATE to quote_number would bypass normalisation entirely
-- and could produce a non-canonical string that doesn't collide with the
-- canonical form in quotes_org_number_unique_idx (e.g. "qt-5" alongside
-- "QT-0005"). There is no legitimate reason to change it after creation —
-- same "no reassignment-on-UPDATE path, and this does not add one"
-- decision already shipped for variation_notices.variation_number (010/011).
grant update (
  client_name, client_email, client_phone, client_address,
  quote_date, valid_until, quote_type,
  scope_of_works, inclusions, exclusions, assumptions, optional_items,
  deposit_percent, payment_terms, additional_terms, builder_approval_name,
  gst_rate, updated_by
) on public.quotes to authenticated;

revoke all on public.quote_line_items from anon, authenticated;
grant select, insert, update, delete on public.quote_line_items to authenticated;

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberately deferred):
--   - Auto-numbering / manual-entry normalisation — 013.
--   - Any RPC entry point for creation — 013 (create_quote()).
--   - Issue workflow, issued_at/issued_by/issued_snapshot columns,
--     issue_quote() RPC, post-issue immutability trigger — 014.
--   - Everything already listed as deferred in the combined draft this
--     migration replaces (accept/decline/void/archive transitions, per-line
--     GST override, multi-currency, builder profile snapshotting).
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Local functional test plan (this migration ALONE, before 013/014 exist):
--   1. Insert a quote directly (plain authenticated INSERT) supplying
--      quote_number manually (e.g. "TEST-1") — confirm it succeeds (no
--      auto-numbering exists yet, this is expected and required to work).
--   2. Insert a second quote with the same quote_number in the same
--      organisation — confirm rejection by quotes_org_number_unique_idx.
--   3. Insert 2-3 quote_line_items with a tampered line_total_cents/
--      gst_cents payload — confirm silently overwritten with correct
--      server-computed values, and confirm the parent's subtotal_cents/
--      gst_cents/total_cents update correctly after insert/update/delete.
--   4. Attempt a plain client UPDATE setting status = 'issued' (or any
--      non-'draft' value) — confirm rejected with a Postgres permission
--      error (column not granted), proving status cannot move at all yet,
--      by design.
--   5. Attempt a plain client UPDATE setting subtotal_cents/gst_cents/
--      total_cents directly — confirm the same permission rejection.
--   6. Cross-organisation: confirm Org B cannot select, insert against, or
--      see any of Org A's quotes or quote_line_items.
--   7. Cross-tenant project mismatch: confirm rejection by
--      enforce_quote_project_same_organisation().
--   8. search_path / grant catalog checks on every function above.
-- ============================================================================
