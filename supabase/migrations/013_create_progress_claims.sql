-- ============================================================================
-- Migration: 013_create_progress_claims.sql
-- Purpose:   Creates public.progress_claims and
--            public.progress_claim_line_items — the third tool migrated onto
--            the authenticated project model (Progress Claim,
--            js/tools/progress-claim/). Field inventory and the review
--            history behind every decision in this migration:
--            docs/PHASE_5A_DESIGN_PROPOSAL.md.
--
--            DRAFT — NOT APPLIED to hpcqncghvdrlvufxfdnd. For review
--            alongside docs/PHASE_5A_DESIGN_PROPOSAL.md before it is run.
--            Depends on 012_create_quotes.sql only for shared conventions,
--            not for any object it defines — these are two independently
--            reviewable and independently appliable migration packages.
--
--            The old tool's freeform "schedule of values" textarea is
--            replaced by progress_claim_line_items, a genuine structured
--            schedule — not a straight port. See the migration header
--            comment on 012 for decisions shared with Quotes (typed line
--            items over jsonb, calculation ownership, numbering shape,
--            post-issue immutability as one state-machine trigger with no
--            exceptions). This comment covers what's specific to Progress
--            Claims:
--
--              1. GST and retention are NOT asserted as one universal
--                 calculation order. gst_rate and retention_rate are stored
--                 explicitly per claim (not hard-coded), and
--                 gst_calculation_method / retention_calculation_method
--                 record, per claim, exactly which method was actually
--                 applied — plain text columns with a check constraint, not
--                 buried in a generated column expression. Today only one
--                 value of each is implemented
--                 ('gst_on_claim_before_retention',
--                 'flat_percentage_of_claim') — see compute_progress_
--                 claim_derived_totals() below, which raises rather than
--                 silently guessing if it ever sees an unrecognised method.
--                 THE OPEN QUESTION THIS DOES NOT ANSWER, flagged for an
--                 accountant or the contract-policy owner before Progress
--                 Claims are used to issue a real document to a real client:
--                 is GST correctly calculated on the full claimed amount
--                 before retention is withheld (this migration's default),
--                 or only on the net amount actually paid after retention
--                 deduction — and does the applicable contract's retention
--                 terms affect the timing of GST attribution on the
--                 withheld portion? This migration takes no position beyond
--                 recording, per claim, which method was used, so a future
--                 correction changes data/config, not schema, and no
--                 existing issued claim's record needs reinterpreting.
--              2. previously_claimed_cents (header) is genuinely
--                 database-derived — computed at INSERT time (regardless of
--                 entry path: the create_progress_claim() RPC or a plain
--                 INSERT) as the sum of this_claim_cents from prior claims
--                 on the same project with status in ('issued', 'approved',
--                 'paid'). It is then frozen relative to line-item changes
--                 (recalculate_progress_claim_totals() never touches it) but
--                 remains an ordinary, directly UPDATE-able column while the
--                 claim is still draft — a deliberate exception allowing a
--                 manual correction for a claim made outside the system
--                 before this tool existed on a given contract. See
--                 docs/PHASE_5A_DESIGN_PROPOSAL.md §6 for the full
--                 reasoning, including why the *line-level*
--                 previously_claimed_cents (below) is NOT similarly derived.
--              3. Header aggregates (contract_value_cents, this_claim_cents,
--                 and everything derived from them) are owned by the
--                 database in two layers, not one: recalculate_progress_
--                 claim_totals() (AFTER trigger on the line items) sums
--                 contract_value_cents/this_claim_cents from the current
--                 line items into the header; compute_progress_claim_
--                 derived_totals() (BEFORE trigger on the header itself)
--                 then recomputes claimed_to_date_cents/remaining_value_
--                 cents/retention_amount_cents/gst_cents/net_payable_cents
--                 from those sums plus previously_claimed_cents/gst_rate/
--                 retention_rate — on EVERY header update, not only ones
--                 triggered by a line-item change. This closes a real
--                 staleness gap: a direct edit to previously_claimed_cents
--                 (decision 2 above) or to gst_rate/retention_rate
--                 recomputes every dependent figure immediately, rather than
--                 waiting for the next unrelated line-item write.
--              4. Issue-transition entry point — same redesign as
--                 012_create_quotes.sql's decision 6, applied identically
--                 here: authenticated's UPDATE grant on progress_claims is
--                 column-scoped and excludes the entire lifecycle surface
--                 (status, issued_at, issued_by, issued_snapshot,
--                 status_changed_at, status_changed_by); issue_progress_
--                 claim() is SECURITY DEFINER and is now the only path
--                 capable of reaching draft -> issued. See 012's decision 6
--                 for the full reasoning — unchanged here beyond the table
--                 name.
--              5. TEMPORARY ISSUING GATE — because decision 1's GST/
--                 retention question is genuinely unconfirmed, and Progress
--                 Claims are legal payment claims under state Security of
--                 Payment legislation, this migration does not merely
--                 document that risk, it enforces it: the draft -> issued
--                 branch of enforce_progress_claim_status_transition()
--                 unconditionally refuses to issue ANY progress claim,
--                 before any other validation runs, citing
--                 docs/PHASE_5A_PROGRESS_CLAIMS_MIGRATION_REVIEW.md. Drafts
--                 remain fully creatable, editable, and calculable for
--                 testing — only the draft -> issued transition is blocked.
--                 Lifting this gate once GST/retention is confirmed is a
--                 tiny, obviously-scoped follow-up migration (removing one
--                 `raise exception` statement) — not a schema change, and
--                 not something this migration tries to make configurable
--                 or toggleable ahead of that actually being needed.
-- Phase:     5a (Tool migration — Progress Claims)
-- Depends on: 001_create_organisations.sql (set_updated_at()),
--             004_create_projects.sql (projects table),
--             005_phase1_rls.sql (internal schema, internal.
--             current_organisation_id())
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: progress_claims
-- One row per Progress Claim. May exist as a near-empty draft, same as
-- quotes (012) — issue_progress_claim() (below) is what actually requires
-- the recipient details and at least one line item.
-- ----------------------------------------------------------------------------
create table if not exists public.progress_claims (
  id                            uuid primary key default gen_random_uuid(),

  organisation_id               uuid not null references public.organisations(id) on delete restrict,
  project_id                    uuid not null references public.projects(id) on delete restrict,

  -- Canonical "PC-001", assigned by assign_progress_claim_number() below,
  -- unique per PROJECT (not per organisation) — claims are inherently
  -- sequential within one contract, same scoping as variation_notices'
  -- VAR-NNN (010).
  claim_number                  text not null,

  client_name                   text,
  client_email                  text,

  contract_ref                  text,
  claim_date                    date not null default current_date,
  claim_period_from             date,
  claim_period_to               date,

  -- ── Totals — ALL server-computed, never independently writable ─────────
  -- contract_value_cents/this_claim_cents: summed from progress_claim_
  -- line_items by recalculate_progress_claim_totals() (below).
  -- claimed_to_date_cents/remaining_value_cents/retention_amount_cents/
  -- gst_cents/net_payable_cents: recomputed from those sums plus
  -- previously_claimed_cents/gst_rate/retention_rate by
  -- compute_progress_claim_derived_totals() (below) on every header write.
  -- previously_claimed_cents is the one exception: database-derived at
  -- INSERT only (assign_progress_claim_number() below), then an ordinary,
  -- directly editable column while draft — see decision 2 above.
  contract_value_cents          bigint not null default 0,
  previously_claimed_cents      bigint not null default 0,
  this_claim_cents              bigint not null default 0,
  claimed_to_date_cents         bigint not null default 0,
  remaining_value_cents         bigint not null default 0,

  -- ── GST ─────────────────────────────────────────────────────────────────
  gst_rate                      numeric(5,4) not null default 0.1000,
  gst_calculation_method        text not null default 'gst_on_claim_before_retention',
  gst_cents                     bigint not null default 0,

  -- ── Retention ───────────────────────────────────────────────────────────
  -- Fraction, not a percentage figure — 0.0500 = 5%, consistent with
  -- gst_rate's representation. Header-level only, not per line — see the
  -- progress_claim_line_items table comment below for why.
  retention_rate                numeric(5,4) not null default 0,
  retention_calculation_method  text not null default 'flat_percentage_of_claim',
  retention_amount_cents        bigint not null default 0,

  net_payable_cents             bigint not null default 0,

  percent_complete               numeric(5,2),
  description_of_work           text,
  special_conditions             text,
  builder_approval_name         text,
  client_approval_name          text,

  -- ── Lifecycle ───────────────────────────────────────────────────────────
  status                        text not null default 'draft',

  -- Set exactly once, by issue_progress_claim() only — see "Issue-
  -- transition redesign" in the migration header comment (mirrors
  -- 012_create_quotes.sql's decision 6 exactly).
  issued_at                     timestamptz,
  issued_by                     uuid references auth.users(id) on delete set null,
  issued_snapshot                jsonb,

  status_changed_at             timestamptz,
  status_changed_by             uuid references auth.users(id) on delete set null,

  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  created_by                    uuid references auth.users(id) on delete set null,
  updated_by                    uuid references auth.users(id) on delete set null,

  constraint progress_claims_status_check
    check (status in ('draft', 'issued', 'approved', 'disputed', 'paid')),

  constraint progress_claims_gst_rate_check
    check (gst_rate >= 0 and gst_rate < 1),

  constraint progress_claims_gst_method_check
    check (gst_calculation_method in ('gst_on_claim_before_retention')),

  constraint progress_claims_retention_rate_check
    check (retention_rate >= 0 and retention_rate < 1),

  constraint progress_claims_retention_method_check
    check (retention_calculation_method in ('flat_percentage_of_claim')),

  constraint progress_claims_totals_non_negative_check
    check (
      contract_value_cents >= 0 and previously_claimed_cents >= 0 and
      this_claim_cents >= 0 and claimed_to_date_cents >= 0 and
      gst_cents >= 0 and retention_amount_cents >= 0
    ),

  constraint progress_claims_percent_complete_check
    check (percent_complete is null or (percent_complete >= 0 and percent_complete <= 100)),

  constraint progress_claims_period_check
    check (claim_period_to is null or claim_period_from is null or claim_period_to >= claim_period_from),

  constraint progress_claims_client_email_format_check
    check (client_email is null or client_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

comment on table public.progress_claims is
  'One row per Progress Claim. Dedicated, strongly typed table (ADR-016). See the migration header comment for the GST/retention audit trail and the previously_claimed_cents derivation rule.';
comment on column public.progress_claims.gst_calculation_method is
  'Records which GST calculation order was actually applied to this claim. Only one value is implemented today (see the check constraint) — this column exists so the assumption is explicit and auditable, not a silent default, and so a future correction changes data, not schema. See the migration header comment for the specific accountant question this leaves open.';
comment on column public.progress_claims.previously_claimed_cents is
  'Database-derived at creation (sum of prior issued/approved/paid claims'' this_claim_cents on the same project) — see assign_progress_claim_number(). Frozen against line-item recalculation thereafter, but remains a directly editable column while the claim is draft, for a documented manual-correction case. See the migration header comment, decision 2.';
comment on column public.progress_claims.issued_by is
  'Who issued this claim — set once, by issue_progress_claim() only, at the same moment as issued_at. Never writable via a plain client UPDATE (see the grants section). Currently unreachable for any real claim — see the temporary issuing gate, decision 5.';
comment on column public.progress_claims.issued_snapshot is
  'A frozen copy of this claim and its schedule items exactly as they stood at the moment of issue — see quotes.issued_snapshot (012) for the identical reasoning. Currently unreachable for any real claim — see the temporary issuing gate, decision 5.';

-- ----------------------------------------------------------------------------
-- Table: progress_claim_line_items
-- The structured schedule of values, replacing the old tool's freeform
-- textarea. No per-line GST or retention — both are payment-claim-level
-- concepts in Australian practice (shown once at the bottom of the claim,
-- not itemised per schedule line), and the original tool only ever had one
-- retentionRate field — adding per-line retention would be schema
-- complexity with no product requirement behind it.
--
-- previously_claimed_cents here is a DIFFERENT thing from the header
-- column of the same name, and is deliberately NOT derived: correctly
-- deriving "this schedule item's amount previously claimed" would require
-- matching a line to "the same" line in an earlier claim, which is only
-- reliable if claims share a stable, identity-bearing schedule template —
-- they don't yet (each claim's lines are typed fresh). Building that (a
-- shared project-level schedule template every claim's lines reference) is
-- a real improvement but bigger than this migration's scope. This column
-- is therefore user-entered, exactly as flagged in
-- docs/PHASE_5A_DESIGN_PROPOSAL.md §6 — not silently presented as more
-- accurate than it is.
-- ----------------------------------------------------------------------------
create table if not exists public.progress_claim_line_items (
  id                       uuid primary key default gen_random_uuid(),

  progress_claim_id        uuid not null references public.progress_claims(id) on delete cascade,

  position                 smallint not null,
  description              text not null,

  -- Client-supplied inputs.
  contract_value_cents     bigint not null,
  previously_claimed_cents bigint not null default 0,
  this_claim_percent       numeric(5,2),

  -- this_claim_cents: server-overwritten from this_claim_percent when that
  -- is supplied (round(contract_value_cents * this_claim_percent / 100));
  -- otherwise treated as the client's own direct input for this line and
  -- left as supplied. See compute_progress_claim_line_item_amounts() below.
  this_claim_cents         bigint not null default 0,

  -- Always server-computed, never independently writable.
  claimed_to_date_cents    bigint not null default 0,
  remaining_value_cents    bigint not null default 0,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint progress_claim_line_items_position_check check (position >= 1),
  constraint progress_claim_line_items_contract_value_check check (contract_value_cents >= 0),
  constraint progress_claim_line_items_previously_claimed_check check (previously_claimed_cents >= 0),
  constraint progress_claim_line_items_percent_check
    check (this_claim_percent is null or (this_claim_percent >= 0 and this_claim_percent <= 100)),
  constraint progress_claim_line_items_position_unique unique (progress_claim_id, position)
);

comment on table public.progress_claim_line_items is
  'The structured schedule of values for a progress claim. this_claim_cents is server-computed from this_claim_percent when supplied; claimed_to_date_cents/remaining_value_cents are always server-computed. previously_claimed_cents on this table is user-entered, not derived — see this migration''s header comment and the table comment above for why.';

-- ----------------------------------------------------------------------------
-- Cross-tenant integrity (identical pattern to 010/012).
-- ----------------------------------------------------------------------------
create or replace function public.enforce_progress_claim_project_same_organisation()
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
    raise exception 'project_id must belong to the same organisation as the progress claim.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace trigger progress_claims_enforce_project_same_organisation
  before insert or update on public.progress_claims
  for each row
  execute function public.enforce_progress_claim_project_same_organisation();

revoke all on function public.enforce_progress_claim_project_same_organisation() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: compute_progress_claim_derived_totals
-- Runs BEFORE every insert/update of the header row (not only ones caused
-- by a line-item change) and unconditionally recomputes
-- claimed_to_date_cents/remaining_value_cents/retention_amount_cents/
-- gst_cents/net_payable_cents from NEW.contract_value_cents/this_claim_
-- cents/previously_claimed_cents/gst_rate/retention_rate — see the
-- migration header comment, decision 3, for why this closes a staleness
-- gap that an AFTER-trigger-on-line-items-only design would leave open.
-- Named to sort alphabetically before enforce_progress_claim_status_
-- transition (below), so that trigger's issue-time "totals internally
-- consistent" check sees fully recomputed values.
-- ----------------------------------------------------------------------------
create or replace function public.compute_progress_claim_derived_totals()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.claimed_to_date_cents := new.previously_claimed_cents + new.this_claim_cents;
  new.remaining_value_cents := new.contract_value_cents - new.claimed_to_date_cents;
  new.retention_amount_cents := round(new.this_claim_cents * new.retention_rate);

  new.gst_cents := case new.gst_calculation_method
    when 'gst_on_claim_before_retention' then round(new.this_claim_cents * new.gst_rate)
    else null
  end;
  if new.gst_cents is null then
    raise exception 'Unrecognised gst_calculation_method: %', new.gst_calculation_method
      using errcode = 'XX000';
  end if;

  new.net_payable_cents := new.this_claim_cents + new.gst_cents - new.retention_amount_cents;
  return new;
end;
$$;

create or replace trigger progress_claims_compute_derived_totals
  before insert or update on public.progress_claims
  for each row
  execute function public.compute_progress_claim_derived_totals();

revoke all on function public.compute_progress_claim_derived_totals() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: enforce_progress_claim_status_transition
-- Identical state-machine shape to enforce_quote_status_transition() (012)
-- — see that function's comment for the full reasoning, unchanged here
-- beyond the table-specific validation. Every INSERT is forced to start as
-- 'draft'; the one legal transition is draft -> issued, validated here;
-- any UPDATE once no longer draft is rejected outright, no exceptions.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_progress_claim_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_line_count integer;
begin
  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.issued_at := null;
    new.issued_by := null;
    new.issued_snapshot := null;
    new.status_changed_at := null;
    new.status_changed_by := null;
    return new;
  end if;

  if old.status <> 'draft' then
    raise exception 'This progress claim has been issued and can no longer be changed. Status: %.', old.status
      using errcode = '55000';
  end if;

  if new.status = 'draft' then
    return new;
  end if;

  if new.status <> 'issued' then
    raise exception 'A draft progress claim can only transition to issued (attempted: %).', new.status
      using errcode = '55000';
  end if;

  -- TEMPORARY ISSUING GATE — see the migration header comment, decision 5.
  -- Checked first, ahead of every other validation below: the GST-versus-
  -- retention calculation order this migration applies
  -- (gst_calculation_method's only implemented value) has not been
  -- confirmed by an accountant or against the applicable contract/
  -- jurisdiction. Drafts remain fully usable; only this transition is
  -- blocked. Remove this one check (and only this check) once that
  -- confirmation is recorded — see
  -- docs/PHASE_5A_PROGRESS_CLAIMS_MIGRATION_REVIEW.md.
  raise exception 'Progress Claims cannot be issued yet — the GST/retention calculation method requires accountant confirmation before this goes live. Drafts remain fully usable for testing. See docs/PHASE_5A_PROGRESS_CLAIMS_MIGRATION_REVIEW.md.'
    using errcode = '55000';

  if btrim(coalesce(new.client_name, '')) = '' then
    raise exception 'Client name is required before a progress claim can be issued.' using errcode = '22023';
  end if;

  select count(*) into v_line_count from public.progress_claim_line_items where progress_claim_id = new.id;
  if v_line_count < 1 then
    raise exception 'At least one schedule item is required before a progress claim can be issued.' using errcode = '22023';
  end if;

  if new.net_payable_cents <> new.this_claim_cents + new.gst_cents - new.retention_amount_cents
     or new.claimed_to_date_cents <> new.previously_claimed_cents + new.this_claim_cents
  then
    raise exception 'Progress claim totals are inconsistent and cannot be issued — contact support.'
      using errcode = 'XX000';
  end if;

  new.issued_at := now();
  new.issued_by := auth.uid();
  new.status_changed_at := now();
  new.status_changed_by := auth.uid();

  new.issued_snapshot := jsonb_build_object(
    'claim_number',              new.claim_number,
    'client_name',                new.client_name,
    'client_email',                new.client_email,
    'contract_ref',                new.contract_ref,
    'claim_date',                  new.claim_date,
    'claim_period_from',           new.claim_period_from,
    'claim_period_to',             new.claim_period_to,
    'contract_value_cents',        new.contract_value_cents,
    'previously_claimed_cents',    new.previously_claimed_cents,
    'this_claim_cents',            new.this_claim_cents,
    'claimed_to_date_cents',       new.claimed_to_date_cents,
    'remaining_value_cents',       new.remaining_value_cents,
    'gst_rate',                    new.gst_rate,
    'gst_calculation_method',      new.gst_calculation_method,
    'gst_cents',                   new.gst_cents,
    'retention_rate',              new.retention_rate,
    'retention_calculation_method',new.retention_calculation_method,
    'retention_amount_cents',      new.retention_amount_cents,
    'net_payable_cents',           new.net_payable_cents,
    'percent_complete',            new.percent_complete,
    'description_of_work',         new.description_of_work,
    'special_conditions',          new.special_conditions,
    'builder_approval_name',       new.builder_approval_name,
    'client_approval_name',        new.client_approval_name,
    'line_items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'position',                 li.position,
               'description',              li.description,
               'contract_value_cents',     li.contract_value_cents,
               'previously_claimed_cents', li.previously_claimed_cents,
               'this_claim_percent',       li.this_claim_percent,
               'this_claim_cents',         li.this_claim_cents,
               'claimed_to_date_cents',    li.claimed_to_date_cents,
               'remaining_value_cents',    li.remaining_value_cents
             ) order by li.position), '[]'::jsonb)
      from public.progress_claim_line_items li
      where li.progress_claim_id = new.id
    )
  );

  return new;
end;
$$;

comment on function public.enforce_progress_claim_status_transition() is
  'The full lifecycle state machine for progress claims. See enforce_quote_status_transition() (012) — identical shape, plus a temporary hard gate blocking the draft -> issued transition entirely until GST/retention treatment is confirmed (decision 5, migration header comment). Post-issue: no exceptions, see docs/PHASE_5A_DESIGN_PROPOSAL.md.';

create or replace trigger progress_claims_enforce_status_transition
  before insert or update on public.progress_claims
  for each row
  execute function public.enforce_progress_claim_status_transition();

-- ----------------------------------------------------------------------------
-- Trigger: compute_progress_claim_line_item_amounts
-- ----------------------------------------------------------------------------
create or replace function public.compute_progress_claim_line_item_amounts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.this_claim_percent is not null then
    new.this_claim_cents := round(new.contract_value_cents * new.this_claim_percent / 100);
  end if;

  new.claimed_to_date_cents := new.previously_claimed_cents + new.this_claim_cents;
  new.remaining_value_cents := new.contract_value_cents - new.claimed_to_date_cents;
  return new;
end;
$$;

create or replace trigger progress_claim_line_items_compute_amounts
  before insert or update on public.progress_claim_line_items
  for each row
  execute function public.compute_progress_claim_line_item_amounts();

revoke all on function public.compute_progress_claim_line_item_amounts() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: enforce_progress_claim_line_item_draft_only
-- Same shape as enforce_quote_line_item_draft_only() (012).
-- ----------------------------------------------------------------------------
create or replace function public.enforce_progress_claim_line_item_draft_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status  text;
  v_pcid    uuid;
begin
  v_pcid := case when tg_op = 'DELETE' then old.progress_claim_id else new.progress_claim_id end;
  select status into v_status from public.progress_claims where id = v_pcid;

  if v_status is distinct from 'draft' then
    raise exception 'Schedule items cannot be changed once the progress claim has been issued.'
      using errcode = '55000';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace trigger progress_claim_line_items_enforce_draft_only
  before insert or update or delete on public.progress_claim_line_items
  for each row
  execute function public.enforce_progress_claim_line_item_draft_only();

-- ----------------------------------------------------------------------------
-- Trigger: recalculate_progress_claim_totals
-- AFTER trigger on progress_claim_line_items: sums contract_value_cents/
-- this_claim_cents from the current line items into the header. The
-- header's own compute_progress_claim_derived_totals() (above) then
-- recomputes everything else from those sums on the same UPDATE — see the
-- migration header comment, decision 3.
--
-- SECURITY DEFINER — same requirement and same reasoning as
-- recalculate_quote_totals() (012): authenticated's column-scoped UPDATE
-- grant on progress_claims does not cover contract_value_cents/
-- this_claim_cents, and this function issues its own separate UPDATE
-- statement against the header, not a same-statement NEW reassignment. Safe
-- without an additional organisation check for the same reason given there.
-- ----------------------------------------------------------------------------
create or replace function public.recalculate_progress_claim_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pcid uuid;
begin
  v_pcid := case when tg_op = 'DELETE' then old.progress_claim_id else new.progress_claim_id end;

  update public.progress_claims
  set contract_value_cents = coalesce((select sum(contract_value_cents) from public.progress_claim_line_items where progress_claim_id = v_pcid), 0),
      this_claim_cents     = coalesce((select sum(this_claim_cents)     from public.progress_claim_line_items where progress_claim_id = v_pcid), 0)
  where id = v_pcid;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace trigger progress_claim_line_items_recalculate_parent_totals
  after insert or update or delete on public.progress_claim_line_items
  for each row
  execute function public.recalculate_progress_claim_totals();

revoke all on function public.enforce_progress_claim_line_item_draft_only() from public, anon, authenticated;
revoke all on function public.recalculate_progress_claim_totals() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Numbering: internal.progress_claim_counters, canonical "PC-001" format,
-- unique per PROJECT. Identical architecture to
-- internal.variation_number_counters (011) — RLS enabled, zero policies,
-- zero grants, CASCADE from projects (privileged-cleanup path only, same
-- reasoning as 011).
--
-- This is also where previously_claimed_cents is derived on INSERT,
-- regardless of entry path (RPC or a plain client INSERT) — see the
-- migration header comment, decision 2. It lives here rather than in a
-- separate trigger because it needs the same SECURITY DEFINER elevation
-- this function already has for the counters table, and because it is,
-- like the number itself, an authoritative value assigned once at
-- creation.
-- ----------------------------------------------------------------------------
create table if not exists internal.progress_claim_counters (
  project_id       uuid primary key references public.projects(id) on delete cascade,
  organisation_id  uuid not null references public.organisations(id) on delete restrict,
  next_number      integer not null default 1,
  updated_at       timestamptz not null default now()
);

comment on table internal.progress_claim_counters is
  'One row per project, tracking the next progress_claims.claim_number to assign. Internal bookkeeping only.';

alter table internal.progress_claim_counters enable row level security;
revoke all on internal.progress_claim_counters from public, anon, authenticated;

create or replace function internal.prevent_progress_claim_counter_decrease()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.next_number < old.next_number then
    raise exception 'progress_claim_counters.next_number cannot be decreased (was %, attempted %).', old.next_number, new.next_number
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace trigger progress_claim_counters_prevent_decrease
  before update on internal.progress_claim_counters
  for each row
  execute function internal.prevent_progress_claim_counter_decrease();

revoke all on function internal.prevent_progress_claim_counter_decrease() from public, anon, authenticated;

create or replace function internal.format_progress_claim_number(p_number bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_number < 1000 then lpad(p_number::text, 3, '0')
    else p_number::text
  end;
$$;

revoke all on function internal.format_progress_claim_number(bigint) from public, anon, authenticated;

create or replace function internal.normalize_progress_claim_number(p_input text)
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
  elsif v_upper ~ '^PC[- ]?[0-9]+$' then
    v_digits := regexp_replace(v_upper, '^PC[- ]?', '');
  else
    return v_trimmed;
  end if;

  return 'PC-' || internal.format_progress_claim_number(v_digits::bigint);
end;
$$;

revoke all on function internal.normalize_progress_claim_number(text) from public, anon, authenticated;
grant execute on function internal.normalize_progress_claim_number(text) to authenticated;

create or replace function public.assign_progress_claim_number()
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
  -- Database-derived, regardless of what the client supplies (or omits) —
  -- see the migration header comment, decision 2.
  new.previously_claimed_cents := coalesce((
    select sum(this_claim_cents) from public.progress_claims
    where project_id = new.project_id
      and status in ('issued', 'approved', 'paid')
  ), 0);

  if new.claim_number is not null and btrim(new.claim_number) <> '' then
    new.claim_number := internal.normalize_progress_claim_number(new.claim_number);
    return new;
  end if;

  if not exists (
    select 1 from public.projects
    where id = new.project_id
      and organisation_id = new.organisation_id
  ) then
    return new;
  end if;

  loop
    insert into internal.progress_claim_counters (project_id, organisation_id, next_number)
    values (new.project_id, new.organisation_id, 1)
    on conflict (project_id) do update
      set next_number = internal.progress_claim_counters.next_number + 1,
          updated_at = now()
    returning next_number into v_next;

    v_candidate := 'PC-' || internal.format_progress_claim_number(v_next);

    exit when not exists (
      select 1 from public.progress_claims
      where project_id = new.project_id
        and claim_number = v_candidate
    );

    v_attempts := v_attempts + 1;
    if v_attempts >= v_max_attempts then
      raise exception 'Could not find a free claim number for this project after % attempts.', v_max_attempts
        using errcode = '40001';
    end if;
  end loop;

  new.claim_number := v_candidate;
  return new;
end;
$$;

create or replace trigger progress_claims_assign_number
  before insert on public.progress_claims
  for each row
  execute function public.assign_progress_claim_number();

revoke all on function public.assign_progress_claim_number() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- updated_at (reuses public.set_updated_at() from 001)
-- ----------------------------------------------------------------------------
create or replace trigger progress_claims_set_updated_at
  before update on public.progress_claims
  for each row
  execute function public.set_updated_at();

create or replace trigger progress_claim_line_items_set_updated_at
  before update on public.progress_claim_line_items
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Function: create_progress_claim
-- Same shape and reasoning as create_quote() (012) — recommended entry
-- point, not the only valid path. previously_claimed_cents is deliberately
-- not a parameter here: it is always database-derived (see
-- assign_progress_claim_number() above), never client-supplied, on this or
-- any other insert path.
-- ----------------------------------------------------------------------------
create or replace function public.create_progress_claim(
  p_project_id      uuid,
  p_client_name     text default null,
  p_client_email    text default null,
  p_contract_ref    text default null,
  p_claim_number    text default null
)
returns public.progress_claims
language plpgsql
set search_path = ''
as $$
declare
  v_org_id        uuid;
  v_row           public.progress_claims;
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

  v_manual := p_claim_number is not null and btrim(p_claim_number) <> '';

  loop
    begin
      insert into public.progress_claims (
        organisation_id, project_id, claim_number,
        client_name, client_email, contract_ref,
        created_by, updated_by
      ) values (
        v_org_id, p_project_id, p_claim_number,
        nullif(btrim(coalesce(p_client_name, '')), ''),
        nullif(btrim(coalesce(p_client_email, '')), ''),
        p_contract_ref,
        auth.uid(), auth.uid()
      )
      returning * into v_row;

      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint <> 'progress_claims_org_project_number_unique_idx' then
        raise;
      end if;

      if v_manual then
        raise exception 'A progress claim numbered "%" already exists for this project. Choose a different number.', internal.normalize_progress_claim_number(p_claim_number)
          using errcode = '23505';
      end if;

      v_attempts := v_attempts + 1;
      if v_attempts >= v_max_attempts then
        raise exception 'Could not allocate a claim number after % attempts — please try again.', v_max_attempts
          using errcode = '40001';
      end if;
    end;
  end loop;

  return v_row;
end;
$$;

comment on function public.create_progress_claim is
  'Recommended client entry point for creating a Progress Claim draft (header only — add schedule items separately against progress_claim_line_items). previously_claimed_cents is always database-derived, never a parameter here.';

revoke all on function public.create_progress_claim(uuid, text, text, text, text) from public, anon;
grant execute on function public.create_progress_claim(uuid, text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Function: issue_progress_claim
-- Same shape and reasoning as issue_quote() (012) — SECURITY DEFINER, the
-- only path capable of reaching draft -> issued (authenticated's UPDATE
-- grant on progress_claims, below, excludes the whole lifecycle surface),
-- independently re-checks organisation ownership since it does not run
-- under RLS. Currently unreachable in practice for any real claim: the
-- temporary issuing gate in enforce_progress_claim_status_transition()
-- (migration header comment, decision 5) unconditionally blocks the
-- transition until GST/retention treatment is confirmed. This function is
-- still built now, not deferred, so the frontend has a stable integration
-- point to call and a real error message to surface while that
-- confirmation is pending.
-- ----------------------------------------------------------------------------
create or replace function public.issue_progress_claim(p_progress_claim_id uuid)
returns public.progress_claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_row    public.progress_claims;
begin
  v_org_id := internal.current_organisation_id();
  if v_org_id is null then
    raise exception 'Authentication required, or your account has no active organisation.'
      using errcode = '28000';
  end if;

  select * into v_row from public.progress_claims
  where id = p_progress_claim_id and organisation_id = v_org_id;

  if v_row is null then
    raise exception 'Progress claim not found in your organisation.' using errcode = '42501';
  end if;

  update public.progress_claims set status = 'issued'
  where id = p_progress_claim_id and organisation_id = v_org_id
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.issue_progress_claim(uuid) is
  'The only path capable of transitioning a progress claim from draft to issued — currently blocked unconditionally by the temporary issuing gate (see enforce_progress_claim_status_transition()) pending GST/retention confirmation. SECURITY DEFINER; independently re-checks organisation ownership since it does not run under RLS.';

revoke all on function public.issue_progress_claim(uuid) from public, anon;
grant execute on function public.issue_progress_claim(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists progress_claims_organisation_id_idx on public.progress_claims (organisation_id);
create index if not exists progress_claims_project_id_idx on public.progress_claims (project_id);
create index if not exists progress_claims_organisation_status_idx on public.progress_claims (organisation_id, status);

create unique index if not exists progress_claims_org_project_number_unique_idx
  on public.progress_claims (organisation_id, project_id, claim_number);

create index if not exists progress_claim_line_items_progress_claim_id_idx
  on public.progress_claim_line_items (progress_claim_id);

-- ----------------------------------------------------------------------------
-- Row Level Security (identical shape to 012)
-- ----------------------------------------------------------------------------
alter table public.progress_claims enable row level security;

drop policy if exists progress_claims_select_same_org on public.progress_claims;
create policy progress_claims_select_same_org
  on public.progress_claims for select to authenticated
  using (organisation_id = (select internal.current_organisation_id()));

drop policy if exists progress_claims_insert_same_org on public.progress_claims;
create policy progress_claims_insert_same_org
  on public.progress_claims for insert to authenticated
  with check (organisation_id = (select internal.current_organisation_id()));

drop policy if exists progress_claims_update_same_org on public.progress_claims;
create policy progress_claims_update_same_org
  on public.progress_claims for update to authenticated
  using (organisation_id = (select internal.current_organisation_id()))
  with check (organisation_id = (select internal.current_organisation_id()));

alter table public.progress_claim_line_items enable row level security;

drop policy if exists progress_claim_line_items_select_same_org on public.progress_claim_line_items;
create policy progress_claim_line_items_select_same_org
  on public.progress_claim_line_items for select to authenticated
  using (exists (
    select 1 from public.progress_claims pc
    where pc.id = progress_claim_line_items.progress_claim_id
      and pc.organisation_id = (select internal.current_organisation_id())
  ));

drop policy if exists progress_claim_line_items_insert_same_org on public.progress_claim_line_items;
create policy progress_claim_line_items_insert_same_org
  on public.progress_claim_line_items for insert to authenticated
  with check (exists (
    select 1 from public.progress_claims pc
    where pc.id = progress_claim_line_items.progress_claim_id
      and pc.organisation_id = (select internal.current_organisation_id())
  ));

drop policy if exists progress_claim_line_items_update_same_org on public.progress_claim_line_items;
create policy progress_claim_line_items_update_same_org
  on public.progress_claim_line_items for update to authenticated
  using (exists (
    select 1 from public.progress_claims pc
    where pc.id = progress_claim_line_items.progress_claim_id
      and pc.organisation_id = (select internal.current_organisation_id())
  ))
  with check (exists (
    select 1 from public.progress_claims pc
    where pc.id = progress_claim_line_items.progress_claim_id
      and pc.organisation_id = (select internal.current_organisation_id())
  ));

drop policy if exists progress_claim_line_items_delete_same_org on public.progress_claim_line_items;
create policy progress_claim_line_items_delete_same_org
  on public.progress_claim_line_items for delete to authenticated
  using (exists (
    select 1 from public.progress_claims pc
    where pc.id = progress_claim_line_items.progress_claim_id
      and pc.organisation_id = (select internal.current_organisation_id())
  ));

-- ----------------------------------------------------------------------------
-- Grants — nothing inherited, explicit here, same rationale as 010/012.
--
-- progress_claims' UPDATE grant is column-scoped, same mechanism and same
-- reasoning as quotes' (012's grants section) — the actual enforcement
-- behind decision 4 above. Excluded: status, issued_at, issued_by,
-- issued_snapshot, status_changed_at, status_changed_by, every
-- server-computed total (contract_value_cents, this_claim_cents,
-- claimed_to_date_cents, remaining_value_cents, gst_cents,
-- retention_amount_cents, net_payable_cents), gst_calculation_method/
-- retention_calculation_method (platform policy, not a user input), and
-- organisation_id/project_id/created_at/created_by. previously_claimed_
-- cents IS included — see decision 2, the deliberate documented exception.
-- ----------------------------------------------------------------------------
revoke all on public.progress_claims from anon, authenticated;
grant select, insert on public.progress_claims to authenticated;
grant update (
  client_name, client_email, contract_ref,
  claim_date, claim_period_from, claim_period_to,
  previously_claimed_cents, gst_rate, retention_rate, percent_complete,
  description_of_work, special_conditions,
  builder_approval_name, client_approval_name,
  claim_number, updated_by
) on public.progress_claims to authenticated;

revoke all on public.progress_claim_line_items from anon, authenticated;
grant select, insert, update, delete on public.progress_claim_line_items to authenticated;

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberately deferred, tracked here):
--   - accepted/disputed/paid transitions, and any void/correction/revision
--     workflow. Only draft -> issued exists — same deliberate limitation as
--     012, same reasoning.
--   - Retention caps (e.g. "5% withheld until cumulative retention reaches
--     half the contract's total retention target, then nil") — flat
--     percentage-of-claim only. Real construction contracts sometimes work
--     this way; flagged as a genuine limitation for the same accountant/
--     contract-policy conversation as the GST timing question above, not
--     built speculatively.
--   - A shared, identity-bearing schedule-of-values template that would let
--     line-level previously_claimed_cents/claimed_to_date_cents be
--     database-derived the same way the header-level figure is — see the
--     progress_claim_line_items table comment above.
--   - Per-line GST or retention.
--   - Multi-currency.
--
-- ----------------------------------------------------------------------------
-- Local functional test plan (run as `authenticated`, disposable fixtures,
-- before this migration is applied anywhere):
--   1. Create a draft claim via create_progress_claim() on a project with
--      no prior claims. Confirm claim_number "PC-001",
--      previously_claimed_cents = 0, all totals 0.
--   2. Insert 2-3 progress_claim_line_items with a mix of direct
--      this_claim_cents and this_claim_percent-driven lines. Confirm
--      this_claim_cents/claimed_to_date_cents/remaining_value_cents compute
--      correctly per line, and the header's contract_value_cents/
--      this_claim_cents/claimed_to_date_cents/remaining_value_cents/
--      retention_amount_cents/gst_cents/net_payable_cents all update
--      correctly after each insert/update/delete.
--   3. Attempt issue_progress_claim() on that claim, even though it's fully
--      valid (client_name set, line items present). Confirm it is
--      unconditionally rejected by the temporary issuing gate (decision 5)
--      — this is the PRIMARY test for this migration as drafted: no
--      progress claim can be issued at all right now, regardless of
--      validity. The recipient/line-item/totals-consistency checks below
--      the gate are unreachable until it is removed — re-run tests 3a/6
--      against a build with the gate commented out, as a one-off local
--      check, to confirm that logic independently (do not ship that
--      change; it is purely to verify the code the gate is currently
--      hiding).
--   3a. Attempt a plain client UPDATE setting status = 'issued' directly.
--       Confirm a Postgres permission error (not the trigger's gate
--       message) — proving the column-scoped grant, not just the gate, is
--       what stops this.
--   4. Create a SECOND claim on the same project. Confirm
--      previously_claimed_cents equals the first claim's this_claim_cents
--      exactly, with no client involvement in that figure.
--   5. Directly UPDATE the second claim's previously_claimed_cents (while
--      still draft) to a different manual figure. Confirm claimed_to_date_
--      cents/remaining_value_cents/retention_amount_cents/gst_cents/
--      net_payable_cents all immediately reflect the new figure, without
--      touching any line item.
--   6. (Gate-disabled build only, per test 3's note.) Attempt
--      issue_progress_claim() with zero line items, and separately with
--      client_name blank. Confirm the two distinct, clear errors, and that
--      a fully valid claim then issues successfully with issued_at/
--      issued_by/status_changed_at/status_changed_by set and
--      issued_snapshot populated correctly, including its line_items array.
--   7. gst_calculation_method / retention_calculation_method: confirm the
--      check constraints reject any value outside the single implemented
--      option for each.
--   8. Numbering: manual entry normalisation ("3", "pc-3", "PC 3" all
--      collapse to "PC-003"); duplicate manual entry raises the friendly
--      error; a genuinely custom reference is stored unchanged; counter
--      non-decrease holds under a direct privileged UPDATE attempt.
--   9. Cross-organisation and cross-tenant-project-mismatch checks,
--      identical in shape to 012's tests 9-10.
--  10. search_path / grant catalog checks, identical in shape to 012's
--      test 11.
--  11. Cleanup: disposable fixtures removed via service_role, confirm
--      internal.progress_claim_counters rows for disposable projects are
--      gone, confirm no production data touched.
-- ============================================================================
