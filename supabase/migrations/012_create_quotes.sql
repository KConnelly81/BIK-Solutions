-- ============================================================================
-- Migration: 012_create_quotes.sql
-- Purpose:   Creates public.quotes and public.quote_line_items — the second
--            tool migrated onto the authenticated project model (Quote
--            Builder, js/tools/quote-builder/), and the first with a
--            genuinely repeating sub-record (line items). Field inventory and
--            the review history behind every decision in this migration:
--            docs/PHASE_5A_DESIGN_PROPOSAL.md.
--
--            DRAFT — NOT APPLIED to hpcqncghvdrlvufxfdnd. For review
--            alongside docs/PHASE_5A_DESIGN_PROPOSAL.md before it is run,
--            same draft-then-review-then-apply sequence as every migration
--            in this repo (010, 011).
--
--            Design decisions carried over from 010/011 without change:
--            dedicated typed table per ADR-016, integer cents for money,
--            organisation_id/project_id both NOT NULL with ON DELETE
--            RESTRICT, a cross-tenant project/organisation consistency
--            trigger, ADR-010 soft-delete-only (no DELETE policy on the
--            header table), explicit grants (nothing inherited), RLS scoped
--            through internal.current_organisation_id().
--
--            Decisions specific to this migration, each reviewed before this
--            draft (see docs/PHASE_5A_DESIGN_PROPOSAL.md for the full
--            reasoning, this is the short version):
--              1. Line items are a typed child table (quote_line_items), not
--                 jsonb — reversing an earlier draft of this design that
--                 proposed jsonb. quote_id cascades on delete: this is a
--                 draft's own working rows, not the top-level document
--                 ADR-010 protects.
--              2. Calculation ownership: the client submits quantity, unit,
--                 unit_price_cents, gst_applicable per line. Every derived
--                 monetary value (line_total_cents, line gst_cents, and the
--                 header's subtotal_cents/gst_cents/total_cents) is computed
--                 and overwritten server-side, regardless of what the client
--                 sends for those columns — see the trigger functions below.
--              3. gst_rate is stored explicitly per quote (not hard-coded in
--                 a generated column expression), so the rate actually
--                 applied to a given quote is part of its permanent,
--                 auditable record even if the platform default changes
--                 later.
--              4. Numbering: server-side, concurrency-safe, canonical
--                 "QT-0001" format, unique per ORGANISATION (not per
--                 project) — a builder thinks in terms of their own quote
--                 sequence, and a quote's project may not even be won yet.
--                 Same mechanism as 011 (internal.quote_counters, atomic
--                 upsert, proactive collision-avoidance loop, bounded RPC
--                 retry), adapted to organisation scope.
--              5. Post-issue immutability has NO exceptions — not for
--                 status, not for approval names. A single BEFORE INSERT OR
--                 UPDATE trigger (enforce_quote_status_transition) is the
--                 entire state machine: every INSERT is forced to start as
--                 'draft' regardless of client input; the one legal
--                 transition this migration implements is draft -> issued,
--                 validated (recipient present, at least one line item,
--                 totals internally consistent) and stamped entirely inside
--                 the trigger; any UPDATE attempted once a row is no longer
--                 'draft' is rejected outright, full stop. Accept/decline/
--                 void/correction operations are deliberately NOT built in
--                 this migration — see "NOT built" at the end.
--              6. Issue-transition entry point — REVISED from the first
--                 draft of this migration, which allowed the draft ->
--                 issued transition via either issue_quote() or a plain
--                 client UPDATE (mirroring how 011's
--                 create_variation_notice() and a plain INSERT are equally
--                 valid paths to *create* a row). On review that equivalence
--                 was correctly flagged as inconsistent with this project's
--                 own stated preference that a document's status transition
--                 be a controlled RPC, not an ordinary table write — issuing
--                 is a one-way, legally/commercially significant act in a
--                 way that creating a draft is not, and deserves a narrower
--                 door. Now: ordinary authenticated INSERT/UPDATE may create
--                 and edit a draft freely (unchanged), but authenticated's
--                 UPDATE grant on quotes is column-scoped and does NOT
--                 include status, issued_at, issued_by, issued_snapshot,
--                 status_changed_at, or status_changed_by (see the grants
--                 section below) — a plain client UPDATE that touches any of
--                 those columns is rejected by Postgres itself with a
--                 permission error, before the row is ever examined.
--                 issue_quote() is SECURITY DEFINER specifically so it can
--                 still write those columns (it independently re-checks
--                 organisation ownership itself, the same pattern
--                 assign_variation_notice_number() (011) already established
--                 for calling a DEFINER function safely) — it is now the
--                 only path capable of reaching the draft -> issued
--                 transition at all. The validation logic itself
--                 (recipient present, >=1 line item, totals consistent)
--                 stays written once, inside enforce_quote_status_transition
--                 — not duplicated into issue_quote()'s own body — because
--                 that trigger's issue-transition branch is now reachable
--                 exclusively through this RPC; writing the same checks
--                 twice would create two sources of truth that could drift.
--                 issued_by and issued_snapshot (new columns, not present in
--                 the first draft) are both set only inside that same
--                 trigger branch, at the same moment as issued_at.
-- Phase:     5a (Tool migration — Quotes)
-- Depends on: 001_create_organisations.sql (set_updated_at()),
--             004_create_projects.sql (projects table),
--             005_phase1_rls.sql (internal schema, internal.
--             current_organisation_id())
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: quotes
-- One row per Quote. Always scoped to exactly one project and one
-- organisation. May exist as a near-empty draft — most fields are nullable
-- at this level; issue_quote() (below) is what actually requires the
-- recipient details and at least one line item, at the moment a quote
-- transitions out of draft, not at creation time.
-- ----------------------------------------------------------------------------
create table if not exists public.quotes (
  id                      uuid primary key default gen_random_uuid(),

  organisation_id         uuid not null references public.organisations(id) on delete restrict,
  project_id              uuid not null references public.projects(id) on delete restrict,

  -- ── Identity ────────────────────────────────────────────────────────────
  -- Canonical "QT-0001", assigned by assign_quote_number() below. Nullable
  -- only for the instant between INSERT and that BEFORE INSERT trigger
  -- running — never actually null once a row exists, since the trigger
  -- always assigns or normalises a value before the row is written.
  quote_number            text not null,

  -- ── Client snapshot ─────────────────────────────────────────────────────
  -- Same decoupling as variation_notices.client_name (010): a plain,
  -- independently mutable copy, not a live join. Nullable at the table
  -- level — a fresh draft may not have a recipient chosen yet;
  -- issue_quote() requires client_name to be non-blank before issuing.
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

  -- ── GST ─────────────────────────────────────────────────────────────────
  -- Stored explicitly per quote, not assumed — see the migration header
  -- comment (decision 3). Applied uniformly to every line on this quote
  -- (Australia has one national GST rate today; storing it per-document
  -- rather than hard-coding it means a future rate change does not require
  -- reinterpreting historical quotes).
  gst_rate                numeric(5,4) not null default 0.1000,

  -- ── Totals — ALL server-computed, never independently writable ─────────
  -- Maintained by recalculate_quote_totals() (below) from the sum of this
  -- quote's line items, every time a line item is inserted, updated, or
  -- deleted. A client-supplied value for any of these three columns is
  -- always overwritten; see the trigger for the exact mechanism. Plain
  -- columns, not GENERATED ALWAYS AS — deliberately, so the calculation
  -- logic lives in one reviewable trigger function rather than being frozen
  -- into the table's DDL (docs/PHASE_5A_DESIGN_PROPOSAL.md, "GST and
  -- retention").
  subtotal_cents          bigint not null default 0,
  gst_cents               bigint not null default 0,
  total_cents             bigint not null default 0,

  -- ── Lifecycle ───────────────────────────────────────────────────────────
  status                  text not null default 'draft',

  -- Set exactly once, by issue_quote() only — see "Issue-transition
  -- redesign" in the migration header comment. issued_by is distinct from
  -- status_changed_by below: issued_by never changes again once set,
  -- while status_changed_at/by will track the *most recent* transition
  -- once future accept/decline/void transitions exist.
  issued_at               timestamptz,
  issued_by               uuid references auth.users(id) on delete set null,

  -- A frozen copy of this quote (and its line items) exactly as it stood
  -- at the moment of issue — see capture_quote_issued_snapshot() below for
  -- why this exists even though the whole row is already immutable
  -- post-issue.
  issued_snapshot         jsonb,

  status_changed_at       timestamptz,
  status_changed_by       uuid references auth.users(id) on delete set null,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid references auth.users(id) on delete set null,
  updated_by              uuid references auth.users(id) on delete set null,

  constraint quotes_status_check
    check (status in ('draft', 'issued', 'accepted', 'declined', 'expired')),

  constraint quotes_quote_type_check
    check (quote_type is null or quote_type in ('fixed', 'estimate', 'cost-plus')),

  constraint quotes_deposit_percent_check
    check (deposit_percent is null or deposit_percent in (0, 5, 10, 20, 25, 50)),

  constraint quotes_gst_rate_check
    check (gst_rate >= 0 and gst_rate < 1),

  constraint quotes_totals_non_negative_check
    check (subtotal_cents >= 0 and gst_cents >= 0 and total_cents >= 0),

  -- Same deliberately loose format check as variation_notices.client_email
  -- (010) — see that migration's comment for the full reasoning.
  constraint quotes_client_email_format_check
    check (client_email is null or client_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

comment on table public.quotes is
  'One row per Quote. Dedicated, strongly typed table (ADR-016). May exist as a near-empty draft — issue_quote() enforces recipient/line-item requirements at the moment of issue, not at creation.';
comment on column public.quotes.gst_rate is
  'The GST rate actually applied to this quote, stored explicitly so historical quotes remain correct and self-describing if the platform default rate ever changes. See docs/PHASE_5A_DESIGN_PROPOSAL.md, "GST and retention".';
comment on column public.quotes.subtotal_cents is
  'Server-computed sum of quote_line_items.line_total_cents for this quote. Never independently writable — see recalculate_quote_totals().';
comment on column public.quotes.total_cents is
  'Server-computed subtotal_cents + gst_cents. Never independently writable — see recalculate_quote_totals().';
comment on column public.quotes.issued_by is
  'Who issued this quote — set once, by issue_quote() only, at the same moment as issued_at. Never writable via a plain client UPDATE (see the grants section) and never changed again after that one write.';
comment on column public.quotes.issued_snapshot is
  'A frozen copy of this quote and its line items exactly as they stood at the moment of issue, captured by enforce_quote_status_transition(). Redundant with the fact that the whole row is independently made immutable on issue (this migration has no exceptions to that), but deliberately kept anyway: it gives a stable, self-contained "what was actually issued" record that survives unaffected if a future migration ever adds a legitimate post-issue correction/revision path around the immutability trigger.';

-- ----------------------------------------------------------------------------
-- Table: quote_line_items
-- Typed child rows — the priced items making up a quote. No organisation_id
-- column: tenancy is enforced through the join to quotes (RLS below), not
-- duplicated onto every line.
-- ----------------------------------------------------------------------------
create table if not exists public.quote_line_items (
  id                 uuid primary key default gen_random_uuid(),

  -- Cascade is deliberate, unlike quotes.project_id's RESTRICT — this is a
  -- draft's own working rows, not the top-level document ADR-010 protects.
  -- Once a quote leaves draft, enforce_quote_line_item_draft_only() below
  -- blocks all further insert/update/delete on its line items regardless —
  -- the cascade only ever fires against a still-draft quote in the ordinary
  -- authenticated path (a client cannot delete an issued quote row at all,
  -- per this table's own RLS, so there is nothing left to cascade from).
  quote_id           uuid not null references public.quotes(id) on delete cascade,

  position           smallint not null,
  description        text not null,
  quantity           numeric(12,2) not null default 1,
  unit               text,

  -- Client-supplied input.
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
  'Typed line items for a quote. line_total_cents/gst_cents are server-computed on every insert/update — see compute_quote_line_item_amounts(). Freely insertable/updatable/deletable while the parent quote is draft; frozen entirely once issued — see enforce_quote_line_item_draft_only().';

-- ----------------------------------------------------------------------------
-- Cross-tenant integrity: project_id must belong to organisation_id.
-- Identical pattern and reasoning to
-- enforce_variation_notice_project_same_organisation() (010) — see that
-- migration's comment for the full analysis, unchanged here.
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

create or replace trigger quotes_enforce_project_same_organisation
  before insert or update on public.quotes
  for each row
  execute function public.enforce_quote_project_same_organisation();

revoke all on function public.enforce_quote_project_same_organisation() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: enforce_quote_status_transition
-- The entire lifecycle state machine for this table, in one function — see
-- the migration header comment (decision 5) for why this is a single
-- function rather than a separate "immutability" trigger plus a separate
-- "issue validation" trigger: the three branches below (insert, ordinary
-- draft edit, draft -> issued) are one state machine, not orthogonal
-- concerns, and keeping them together means there is exactly one place that
-- can ever move this row out of 'draft'.
--
-- SECURITY INVOKER (default): every read/write here is something the caller
-- already has direct RLS-permitted access to (their own organisation's
-- quotes and quote_line_items) — no elevation needed, same reasoning as
-- create_variation_notice() (011). Remains INVOKER even though the
-- draft -> issued branch is now, in practice, only ever reached via the
-- SECURITY DEFINER issue_quote() below: the trigger itself still touches
-- nothing this table's own caller doesn't already have RLS-permitted
-- access to (its own organisation's quotes and quote_line_items), so
-- there is still nothing here for INVOKER to fail to reach.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_quote_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_line_count integer;
begin
  if tg_op = 'INSERT' then
    -- A new row always starts as draft, regardless of what the client
    -- supplies. The only legal way to reach 'issued' is the branch below,
    -- on a subsequent UPDATE — and, per decision 6 above, only via
    -- issue_quote() in practice, since authenticated's column-scoped
    -- UPDATE grant (see the grants section below) cannot write any of
    -- these columns directly.
    new.status := 'draft';
    new.issued_at := null;
    new.issued_by := null;
    new.issued_snapshot := null;
    new.status_changed_at := null;
    new.status_changed_by := null;
    return new;
  end if;

  -- tg_op = 'UPDATE' from here.
  if old.status <> 'draft' then
    -- Fully frozen. No exceptions for status, approval names, or anything
    -- else. Future accept/decline/expire/void/correction operations are
    -- controlled RPCs, not built in this migration, and will need their own
    -- explicit, reviewed path around this trigger when they are — see the
    -- "NOT built" section at the end of this file.
    raise exception 'This quote has been issued and can no longer be changed. Status: %.', old.status
      using errcode = '55000';
  end if;

  if new.status = 'draft' then
    return new; -- ordinary draft edit — nothing further to check here
  end if;

  if new.status <> 'issued' then
    raise exception 'A draft quote can only transition to issued (attempted: %).', new.status
      using errcode = '55000';
  end if;

  -- draft -> issued: the one transition this migration implements.
  if btrim(coalesce(new.client_name, '')) = '' then
    raise exception 'Client name is required before a quote can be issued.' using errcode = '22023';
  end if;

  select count(*) into v_line_count from public.quote_line_items where quote_id = new.id;
  if v_line_count < 1 then
    raise exception 'At least one line item is required before a quote can be issued.' using errcode = '22023';
  end if;

  -- Defensive re-check, not the primary guarantee (recalculate_quote_totals()
  -- already keeps these three columns consistent on every line-item change)
  -- — an irreversible transition is exactly the moment to re-verify an
  -- invariant rather than only trust it. XX000 (internal_error): this
  -- should never actually happen; if it does, something upstream is broken
  -- and issuing must not proceed.
  if new.total_cents <> new.subtotal_cents + new.gst_cents then
    raise exception 'Quote totals are inconsistent and cannot be issued — contact support.'
      using errcode = 'XX000';
  end if;

  new.issued_at := now();
  new.issued_by := auth.uid();
  new.status_changed_at := now();
  new.status_changed_by := auth.uid();

  -- Frozen copy of this quote and its line items exactly as issued — see
  -- the table-level comment on quotes.issued_snapshot for why this exists
  -- even though the whole row is independently made immutable by the
  -- branch above. new.id is available here (either supplied or already
  -- defaulted by gen_random_uuid() before any BEFORE trigger runs), and
  -- quote_line_items rows for it already exist at this point — issuing is
  -- always a subsequent UPDATE, never the same statement as the row's own
  -- INSERT.
  new.issued_snapshot := jsonb_build_object(
    'quote_number',          new.quote_number,
    'client_name',           new.client_name,
    'client_email',          new.client_email,
    'client_phone',          new.client_phone,
    'client_address',        new.client_address,
    'quote_date',            new.quote_date,
    'valid_until',           new.valid_until,
    'quote_type',            new.quote_type,
    'scope_of_works',        new.scope_of_works,
    'inclusions',            new.inclusions,
    'exclusions',            new.exclusions,
    'assumptions',           new.assumptions,
    'optional_items',        new.optional_items,
    'deposit_percent',       new.deposit_percent,
    'payment_terms',         new.payment_terms,
    'additional_terms',      new.additional_terms,
    'builder_approval_name', new.builder_approval_name,
    'gst_rate',              new.gst_rate,
    'subtotal_cents',        new.subtotal_cents,
    'gst_cents',             new.gst_cents,
    'total_cents',           new.total_cents,
    'line_items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'position',         li.position,
               'description',      li.description,
               'quantity',         li.quantity,
               'unit',             li.unit,
               'unit_price_cents', li.unit_price_cents,
               'gst_applicable',   li.gst_applicable,
               'line_total_cents', li.line_total_cents,
               'gst_cents',        li.gst_cents
             ) order by li.position), '[]'::jsonb)
      from public.quote_line_items li
      where li.quote_id = new.id
    )
  );

  return new;
end;
$$;

comment on function public.enforce_quote_status_transition() is
  'The full lifecycle state machine for quotes. Forces every INSERT to start as draft; validates, stamps (issued_at/issued_by/status_changed_at/status_changed_by), and snapshots the one legal draft -> issued transition; rejects any UPDATE once a row is no longer draft, with no exceptions. In practice only reachable via issue_quote() — see the migration header comment, decision 6, and docs/PHASE_5A_DESIGN_PROPOSAL.md, "Post-issue immutability".';

create or replace trigger quotes_enforce_status_transition
  before insert or update on public.quotes
  for each row
  execute function public.enforce_quote_status_transition();

-- ----------------------------------------------------------------------------
-- Trigger: compute_quote_line_item_amounts
-- Overwrites line_total_cents/gst_cents on every insert/update, regardless
-- of what the client supplies for them — the client's own input for these
-- two columns is discarded, not merely validated. Reads the parent quote's
-- gst_rate (a single SELECT, cheap, one row by primary key) rather than
-- assuming a rate — see the migration header comment (decision 3).
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
-- Blocks any insert/update/delete on a line item once its parent quote is no
-- longer draft. Combined with enforce_quote_status_transition() above
-- (which blocks all changes to the parent row itself once issued), this
-- means an issued quote and its line items are both completely frozen —
-- "post-issue immutability" covers line items exactly the same as the
-- header, per the migration header comment (decision 5).
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
-- items, on every insert, update, or delete. This UPDATE against
-- public.quotes only ever runs while the parent is still 'draft' (line-item
-- writes are blocked otherwise, by the trigger above), so it always passes
-- enforce_quote_status_transition()'s "ordinary draft edit" branch cleanly —
-- no special-case bypass needed for this internal write.
--
-- SECURITY DEFINER — required, not optional, once authenticated's UPDATE
-- grant on quotes became column-scoped (see the grants section) and no
-- longer covers subtotal_cents/gst_cents/total_cents: this function issues
-- its own separate UPDATE statement against quotes (distinct from a BEFORE
-- trigger merely reassigning NEW within the client's original statement,
-- which is never separately privilege-checked), so it runs under whatever
-- role executes it — DEFINER here, same as assign_quote_number(). Safe
-- without an additional organisation re-check (unlike issue_quote()/
-- assign_quote_number(), which take a client-supplied id/organisation_id
-- and so must re-verify ownership themselves): v_qid here is always
-- read from a quote_line_items row the caller already had RLS-permitted
-- access to write, in the very same statement that fired this trigger —
-- there is no separate, client-suppliable input to misuse.
-- ----------------------------------------------------------------------------
create or replace function public.recalculate_quote_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qid uuid;
begin
  v_qid := case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;

  update public.quotes
  set subtotal_cents = coalesce((select sum(line_total_cents) from public.quote_line_items where quote_id = v_qid), 0),
      gst_cents       = coalesce((select sum(gst_cents)       from public.quote_line_items where quote_id = v_qid), 0),
      total_cents     = coalesce((select sum(line_total_cents) + sum(gst_cents) from public.quote_line_items where quote_id = v_qid), 0)
  where id = v_qid;

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
-- Numbering: internal.quote_counters, canonical "QT-0001" format.
-- Same architecture as internal.variation_number_counters (011): RLS
-- enabled with zero policies, zero grants — the only path to this table is
-- the SECURITY DEFINER trigger below. Keyed by organisation_id (not
-- project_id) — see the migration header comment (decision 4).
-- ----------------------------------------------------------------------------
create table if not exists internal.quote_counters (
  organisation_id  uuid primary key references public.organisations(id) on delete cascade,
  next_number      integer not null default 1,
  updated_at       timestamptz not null default now()
);

comment on table internal.quote_counters is
  'One row per organisation, tracking the next quotes.quote_number to assign. Internal bookkeeping only — never read or written directly by any client role.';

alter table internal.quote_counters enable row level security;
revoke all on internal.quote_counters from public, anon, authenticated;

create or replace function internal.prevent_quote_counter_decrease()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.next_number < old.next_number then
    raise exception 'quote_counters.next_number cannot be decreased (was %, attempted %).', old.next_number, new.next_number
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace trigger quote_counters_prevent_decrease
  before update on internal.quote_counters
  for each row
  execute function internal.prevent_quote_counter_decrease();

revoke all on function internal.prevent_quote_counter_decrease() from public, anon, authenticated;

-- Pure formatting: zero-pads to 4 digits below 10000; passes through
-- unpadded at/above it. Same lpad-truncation caution as
-- internal.format_variation_number() (011, round two's bug fix) — lpad()
-- truncates rather than passing through once the input is already wider
-- than the target width, so the width check below is required, not
-- decorative.
create or replace function internal.format_quote_number(p_number bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_number < 10000 then lpad(p_number::text, 4, '0')
    else p_number::text
  end;
$$;

revoke all on function internal.format_quote_number(bigint) from public, anon, authenticated;

-- Recognises a standard-equivalent manual entry (bare digits, or "QT"/"qt"
-- with an optional hyphen/space then digits) and reduces it to canonical
-- "QT-NNNN" form; leaves a genuinely custom reference untouched. Identical
-- shape to internal.normalize_variation_number() (011) — see that
-- migration's "Canonical format and normalisation" section for the full
-- reasoning, unchanged here beyond the prefix and padding width.
create or replace function internal.normalize_quote_number(p_input text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_trimmed  text;
  v_upper    text;
  v_digits   text;
begin
  v_trimmed := btrim(p_input);
  if v_trimmed = '' then
    return v_trimmed;
  end if;

  v_upper := upper(v_trimmed);

  if v_upper ~ '^[0-9]+$' then
    v_digits := v_upper;
  elsif v_upper ~ '^QT[- ]?[0-9]+$' then
    v_digits := regexp_replace(v_upper, '^QT[- ]?', '');
  else
    return v_trimmed;
  end if;

  return 'QT-' || internal.format_quote_number(v_digits::bigint);
end;
$$;

revoke all on function internal.normalize_quote_number(text) from public, anon, authenticated;
grant execute on function internal.normalize_quote_number(text) to authenticated;

-- Assigns the next free per-organisation quote_number in canonical
-- "QT-0001" form when the client leaves it blank (proactively skipping any
-- candidate already taken), or normalises a manual entry. Identical
-- mechanism to assign_variation_notice_number() (011) — same atomic
-- INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING, same bounded
-- collision-avoidance loop, same reasoning for why no advisory lock is
-- needed. See that migration's comment for the full analysis.
create or replace function public.assign_quote_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next          integer;
  v_candidate     text;
  v_attempts      integer := 0;
  v_max_attempts  constant integer := 1000;
begin
  if new.quote_number is not null and btrim(new.quote_number) <> '' then
    new.quote_number := internal.normalize_quote_number(new.quote_number);
    return new;
  end if;

  loop
    insert into internal.quote_counters (organisation_id, next_number)
    values (new.organisation_id, 1)
    on conflict (organisation_id) do update
      set next_number = internal.quote_counters.next_number + 1,
          updated_at = now()
    returning next_number into v_next;

    v_candidate := 'QT-' || internal.format_quote_number(v_next);

    exit when not exists (
      select 1 from public.quotes
      where organisation_id = new.organisation_id
        and quote_number = v_candidate
    );

    v_attempts := v_attempts + 1;
    if v_attempts >= v_max_attempts then
      raise exception 'Could not find a free quote number for this organisation after % attempts.', v_max_attempts
        using errcode = '40001';
    end if;
  end loop;

  new.quote_number := v_candidate;
  return new;
end;
$$;

-- Fires before enforce_quote_status_transition() alphabetically
-- ("assign_..." < "quotes_enforce..."), which is fine: that trigger only
-- inspects status-related columns, not quote_number, so ordering between
-- the two does not matter for correctness.
create or replace trigger quotes_assign_number
  before insert on public.quotes
  for each row
  execute function public.assign_quote_number();

revoke all on function public.assign_quote_number() from public, anon, authenticated;

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
-- Function: create_quote
-- Recommended client entry point: validates the caller and project, creates
-- a draft row (header only — line items are added afterward via ordinary
-- authenticated inserts against quote_line_items, RLS-scoped), and returns
-- it. A plain authenticated INSERT against quotes remains equally valid and
-- equally correct, same relationship as create_variation_notice() (011) —
-- this exists for clean validation errors and one round-trip, not because
-- direct inserts are unsafe.
--
-- SECURITY INVOKER (default) — least-privilege, same reasoning as
-- create_variation_notice(): every operation here is something the caller
-- already has direct RLS-permitted access to.
-- ----------------------------------------------------------------------------
create or replace function public.create_quote(
  p_project_id      uuid,
  p_client_name     text default null,
  p_client_email    text default null,
  p_client_phone    text default null,
  p_client_address  text default null,
  p_quote_number    text default null
)
returns public.quotes
language plpgsql
set search_path = ''
as $$
declare
  v_org_id  uuid;
  v_row     public.quotes;
  v_attempts      integer := 0;
  v_max_attempts  constant integer := 5;
  v_constraint    text;
  v_manual        boolean;
begin
  v_org_id := internal.current_organisation_id();
  if v_org_id is null then
    raise exception 'Authentication required, or your account has no active organisation.'
      using errcode = '28000';
  end if;

  if p_project_id is null or not exists (
    select 1 from public.projects
    where id = p_project_id and organisation_id = v_org_id
  ) then
    raise exception 'Project not found in your organisation.' using errcode = '42501';
  end if;

  v_manual := p_quote_number is not null and btrim(p_quote_number) <> '';

  loop
    begin
      insert into public.quotes (
        organisation_id, project_id, quote_number,
        client_name, client_email, client_phone, client_address,
        created_by, updated_by
      ) values (
        v_org_id, p_project_id, p_quote_number,
        nullif(btrim(coalesce(p_client_name, '')), ''),
        nullif(btrim(coalesce(p_client_email, '')), ''),
        p_client_phone, p_client_address,
        auth.uid(), auth.uid()
      )
      returning * into v_row;

      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint <> 'quotes_org_number_unique_idx' then
        raise;
      end if;

      if v_manual then
        raise exception 'A quote numbered "%" already exists for your organisation. Choose a different number.', internal.normalize_quote_number(p_quote_number)
          using errcode = '23505';
      end if;

      v_attempts := v_attempts + 1;
      if v_attempts >= v_max_attempts then
        raise exception 'Could not allocate a quote number after % attempts — please try again.', v_max_attempts
          using errcode = '40001';
      end if;
    end;
  end loop;

  return v_row;
end;
$$;

comment on function public.create_quote is
  'Recommended client entry point for creating a Quote draft (header only — add line items separately against quote_line_items). Validates the caller and project, atomically allocates a canonical "QT-0001" number (or normalises/accepts a supplied manual override), inserts the row, and returns it.';

revoke all on function public.create_quote(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.create_quote(uuid, text, text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Function: issue_quote
-- Transitions a draft quote to issued. Per the migration header comment,
-- decision 6: this is now THE ONLY path capable of reaching that
-- transition — authenticated's UPDATE grant on quotes (below) is
-- column-scoped and does not include status/issued_at/issued_by/
-- issued_snapshot/status_changed_at/status_changed_by, so a plain client
-- UPDATE touching any of them fails with a Postgres permission error
-- before this function, or the row, is ever involved.
--
-- SECURITY DEFINER, unlike create_quote()/every other INVOKER function in
-- this migration — deliberately: it must be able to write the columns
-- authenticated's own grant deliberately excludes. Because DEFINER means
-- this function does NOT run under RLS, it re-establishes the exact same
-- access boundary RLS would have given it explicitly, in code: the initial
-- SELECT (and the UPDATE's WHERE clause) both require organisation_id to
-- match the caller's own internal.current_organisation_id() — the same
-- pattern already established by assign_variation_notice_number() (011)
-- for calling a DEFINER function safely from an authenticated context.
--
-- All actual validation (recipient present, at least one line item, totals
-- internally consistent) and the issued_at/issued_by/status_changed_at/
-- status_changed_by/issued_snapshot stamping still live entirely inside
-- enforce_quote_status_transition() — not duplicated here. See that
-- function's comment and the migration header comment, decision 6, for why
-- keeping the validation in exactly one place is deliberate now that this
-- RPC is the only caller that can ever reach it.
-- ----------------------------------------------------------------------------
create or replace function public.issue_quote(p_quote_id uuid)
returns public.quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_row    public.quotes;
begin
  v_org_id := internal.current_organisation_id();
  if v_org_id is null then
    raise exception 'Authentication required, or your account has no active organisation.'
      using errcode = '28000';
  end if;

  select * into v_row from public.quotes
  where id = p_quote_id and organisation_id = v_org_id;

  if v_row is null then
    raise exception 'Quote not found in your organisation.' using errcode = '42501';
  end if;

  update public.quotes set status = 'issued'
  where id = p_quote_id and organisation_id = v_org_id
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.issue_quote(uuid) is
  'The only path capable of transitioning a quote from draft to issued — authenticated''s column-scoped UPDATE grant on quotes excludes every lifecycle column, so a plain client UPDATE cannot reach this transition. SECURITY DEFINER; independently re-checks organisation ownership since it does not run under RLS. Validation and stamping live in enforce_quote_status_transition() — see that function''s comment.';

revoke all on function public.issue_quote(uuid) from public, anon;
grant execute on function public.issue_quote(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists quotes_organisation_id_idx on public.quotes (organisation_id);
create index if not exists quotes_project_id_idx on public.quotes (project_id);
create index if not exists quotes_organisation_status_idx on public.quotes (organisation_id, status);

-- No duplicate quote numbers within one ORGANISATION (not per-project) —
-- see decision 4 above.
create unique index if not exists quotes_org_number_unique_idx
  on public.quotes (organisation_id, quote_number);

create index if not exists quote_line_items_quote_id_idx on public.quote_line_items (quote_id);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- quotes: same shape as variation_notices (010) — any org member may read/
-- create/update within their own organisation; no DELETE policy (ADR-010).
-- quote_line_items: scoped through the parent quote, not an independent
-- organisation_id column. DELETE is granted here (unlike the header table)
-- — see the migration header comment (decision 1) and the table comment
-- above for why this does not conflict with ADR-010.
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
-- Grants — nothing inherited, explicit here, same rationale as 010.
--
-- quotes' UPDATE grant is column-scoped, not table-scoped — this is the
-- actual enforcement mechanism behind decision 6 above (issue_quote() is
-- the only path to draft -> issued), not merely documentation of it. Every
-- column NOT listed below (status, issued_at, issued_by, issued_snapshot,
-- status_changed_at, status_changed_by — the whole lifecycle surface — and
-- also organisation_id/project_id/created_at/created_by/updated_at, none
-- of which a client legitimately rewrites post-creation either) is
-- unreachable to authenticated via any plain UPDATE statement; Postgres
-- rejects the statement outright with a permission error before this
-- table's own RLS or triggers are even consulted. SELECT and INSERT stay
-- table-scoped: INSERT is already fully governed by
-- enforce_quote_status_transition()'s "every INSERT forced to draft"
-- branch, so a column-level restriction there would be redundant, not
-- additionally protective. subtotal_cents/gst_cents/total_cents are also
-- excluded from the UPDATE grant, even though they are separately already
-- always overwritten by recalculate_quote_totals() regardless of client
-- input (§1 of docs/PHASE_5A_DESIGN_PROPOSAL.md) — belt-and-braces, not
-- required for correctness on its own.
-- ----------------------------------------------------------------------------
revoke all on public.quotes from anon, authenticated;
grant select, insert on public.quotes to authenticated;
grant update (
  client_name, client_email, client_phone, client_address,
  quote_number, quote_date, valid_until, quote_type,
  scope_of_works, inclusions, exclusions, assumptions, optional_items,
  deposit_percent, payment_terms, additional_terms, builder_approval_name,
  gst_rate, updated_by
) on public.quotes to authenticated;

revoke all on public.quote_line_items from anon, authenticated;
grant select, insert, update, delete on public.quote_line_items to authenticated;

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberately deferred, tracked here):
--   - accepted/declined/expired transitions, and any void/correction/
--     revision workflow. Only draft -> issued exists. A record that is
--     'issued' is fully frozen (enforce_quote_status_transition()) — moving
--     it further requires a new, explicitly reviewed controlled RPC and,
--     per docs/PHASE_5A_DESIGN_PROPOSAL.md, a real transition mechanism
--     around the immutability trigger (not a blanket exception added to it).
--     A correction to an issued quote should produce a new revision/
--     replacement row, not a mutation of the original — not designed here.
--   - Per-line GST override (a single gst_rate applies to the whole quote).
--   - Multi-currency (bigint cents assumes AUD throughout, same as every
--     other money column in this schema).
--   - Snapshotting builder/business profile details onto quotes — same
--     deliberate omission as variation_notices (010): already fully covered
--     by organisation_id -> organisations, no product requirement yet to
--     decouple.
--
-- ----------------------------------------------------------------------------
-- Local functional test plan (run as `authenticated`, disposable fixtures,
-- before this migration is applied anywhere) — same posture as 010/011:
--   1. Create a draft quote via create_quote() with only p_project_id.
--      Confirm it is created with status='draft', quote_number assigned
--      ("QT-0001" on a fresh organisation), subtotal/gst/total all 0.
--   2. Insert 2-3 quote_line_items directly (plain authenticated insert).
--      Confirm line_total_cents/gst_cents are server-computed correctly
--      regardless of what is sent for those two columns, and that the
--      parent quote's subtotal_cents/gst_cents/total_cents update to match
--      the sum after each insert/update/delete.
--   3. Attempt issue_quote() on that draft with client_name still blank.
--      Confirm a clear "Client name is required" error, no status change.
--   4. Set client_name, delete all line items, attempt issue_quote() again.
--      Confirm "At least one line item is required", no status change.
--   5. Restore a line item, call issue_quote() successfully. Confirm
--      status='issued', issued_at/issued_by/status_changed_at/status_changed_by
--      all set, quote_number unchanged, and issued_snapshot contains the
--      correct frozen field values plus the correct line items array.
--   5a. Before calling issue_quote(): attempt a plain client UPDATE that
--       sets status = 'issued' directly (e.g. `update quotes set status =
--       'issued' where id = ...`). Confirm this fails with a Postgres
--       permission error (42501, "permission denied for table quotes" or
--       column-specific equivalent) — NOT the trigger's business-rule
--       error — proving the column-scoped grant is what's actually
--       stopping it, not merely the trigger.
--   6. Attempt a plain UPDATE against the now-issued quote (e.g. changing
--      scope_of_works) — confirm it is rejected with the "has been issued"
--      error. Attempt inserting/updating/deleting one of its line items —
--      confirm the same rejection from enforce_quote_line_item_draft_only().
--   7. Attempt issue_quote() a second time on the same (already-issued)
--      quote. Confirm rejection, not a silent no-op or duplicate stamping.
--   8. Numbering: create quotes with a blank quote_number across two
--      concurrent-ish sessions in the same organisation; confirm no
--      collision and sequential QT-0001/QT-0002 assignment. Manually type
--      "5", "qt-5", "QT 5" on separate drafts in a fresh organisation;
--      confirm all normalise to "QT-0005" and the second/third attempts
--      raise the friendly duplicate error, not a raw constraint violation.
--      Type a genuinely custom reference (e.g. "CLIENT-Q-9"); confirm it is
--      stored unchanged.
--   9. Cross-organisation: confirm Org B cannot select, insert against, or
--      see in a list any of Org A's quotes or quote_line_items.
--  10. Cross-tenant project mismatch: attempt to insert a quote with
--      project_id belonging to a different organisation than
--      organisation_id claims. Confirm rejection by
--      enforce_quote_project_same_organisation().
--  11. search_path / grant catalog checks: confirm every SECURITY DEFINER
--      function above has search_path = '' set, and that
--      internal.quote_counters/internal.format_quote_number/
--      internal.normalize_quote_number (except its authenticated EXECUTE
--      grant) have zero grants to anon/authenticated.
--  12. Cleanup: delete all disposable fixtures via service_role, confirm
--      internal.quote_counters rows for the disposable organisations are
--      gone too (either via cascade or explicit cleanup), confirm no
--      production data was touched.
-- ============================================================================
