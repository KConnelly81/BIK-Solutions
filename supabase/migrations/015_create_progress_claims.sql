-- ============================================================================
-- Migration: 015_create_progress_claims.sql
-- Purpose:   Creates public.progress_claims and
--            public.progress_claim_line_items — CORE LAYER ONLY: table
--            shape, line items, calculation ownership, RLS, grants,
--            indexes, draft editing. No numbering (016), no issue workflow
--            (017 — BLOCKED). Mirrors 012_create_quotes.sql's layering
--            exactly; see that migration's header comment for the shared
--            reasoning (manual numbering until the numbering layer exists,
--            full status vocabulary declared now, status excluded from the
--            client grant from day one). This header covers what's
--            specific to Progress Claims.
--
--            DRAFT — NOT APPLIED to hpcqncghvdrlvufxfdnd.
--
--              1. `status` enum: draft/issued/approved/disputed/paid/
--                 archived (no 'void' — not requested for this table).
--              2. previously_claimed_cents derivation MOVED here, out of
--                 the numbering layer it was bundled with in the
--                 pre-restructure draft. It is a calculation-ownership
--                 concern (deriving a value from other rows), not a
--                 numbering concern, and — checked, not assumed — it does
--                 NOT need SECURITY DEFINER: it only reads other
--                 progress_claims rows in the caller's own organisation,
--                 which the caller's own RLS SELECT policy already permits.
--                 Bundling it with numbering in the original draft would
--                 have carried unnecessary elevated privilege for a
--                 calculation that never needed it — corrected here per
--                 the least-privilege review (grant/elevate only where
--                 actually required). See
--                 derive_progress_claim_previously_claimed() below.
--              3. NEW interim constraint, per explicit direction, pending
--                 external confirmation of the GST/retention/overclaiming
--                 questions: remaining_value_cents >= 0, added to
--                 progress_claims_totals_non_negative_check. Because
--                 remaining_value_cents = contract_value_cents -
--                 claimed_to_date_cents, this single constraint also
--                 enforces "a claim cannot exceed the recognised contract
--                 value" — the two requirements are mathematically the
--                 same constraint, not two separate ones. Applies to every
--                 draft, not only at issue time (issuing is blocked
--                 entirely regardless — see 017) — draft functionality for
--                 internal testing remains fully available for any
--                 internally-consistent set of figures; only a genuinely
--                 over-claimed state is rejected, immediately, by the
--                 database, not left to be caught later.
-- Phase:     5a (Tool migration — Progress Claims, core layer)
-- Depends on: 001_create_organisations.sql (set_updated_at()),
--             004_create_projects.sql (projects table),
--             005_phase1_rls.sql (internal.current_organisation_id())
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: progress_claims
-- ----------------------------------------------------------------------------
create table if not exists public.progress_claims (
  id                            uuid primary key default gen_random_uuid(),

  organisation_id               uuid not null references public.organisations(id) on delete restrict,
  project_id                    uuid not null references public.projects(id) on delete restrict,

  -- Plain, manually-supplied in this migration — 016 adds auto-assignment.
  claim_number                  text not null,

  client_name                   text,
  client_email                  text,

  contract_ref                  text,
  claim_date                    date not null default current_date,
  claim_period_from             date,
  claim_period_to               date,

  -- Server-computed from line items — see recalculate_progress_claim_totals().
  contract_value_cents          bigint not null default 0,

  -- Server-derived at INSERT by derive_progress_claim_previously_claimed()
  -- below (decision 2), then an ordinary directly-editable column while
  -- draft — a documented exception (see docs/PHASE_5A_DESIGN_PROPOSAL.md §6).
  previously_claimed_cents      bigint not null default 0,

  this_claim_cents              bigint not null default 0,
  claimed_to_date_cents         bigint not null default 0,
  remaining_value_cents         bigint not null default 0,

  gst_rate                      numeric(5,4) not null default 0.1000,
  gst_calculation_method        text not null default 'gst_on_claim_before_retention',
  gst_cents                     bigint not null default 0,

  -- Fraction, not a percentage figure — 0.0500 = 5%.
  retention_rate                numeric(5,4) not null default 0,
  retention_calculation_method  text not null default 'flat_percentage_of_claim',
  retention_amount_cents        bigint not null default 0,

  net_payable_cents             bigint not null default 0,

  percent_complete              numeric(5,2),
  description_of_work           text,
  special_conditions            text,
  builder_approval_name         text,
  client_approval_name          text,

  -- Full 6-value lifecycle declared now; only 'draft' is reachable until
  -- 017 exists, and 017 remains BLOCKED for real issuing regardless.
  status                        text not null default 'draft',

  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  created_by                    uuid references auth.users(id) on delete set null,
  updated_by                    uuid references auth.users(id) on delete set null,

  constraint progress_claims_status_check
    check (status in ('draft', 'issued', 'approved', 'disputed', 'paid', 'archived')),

  constraint progress_claims_gst_rate_check
    check (gst_rate >= 0 and gst_rate < 1),

  constraint progress_claims_gst_method_check
    check (gst_calculation_method in ('gst_on_claim_before_retention')),

  constraint progress_claims_retention_rate_check
    check (retention_rate >= 0 and retention_rate < 1),

  constraint progress_claims_retention_method_check
    check (retention_calculation_method in ('flat_percentage_of_claim')),

  -- remaining_value_cents >= 0 is the new interim constraint (decision 3) —
  -- equivalent to "claimed_to_date_cents cannot exceed contract_value_cents".
  constraint progress_claims_totals_non_negative_check
    check (
      contract_value_cents >= 0 and previously_claimed_cents >= 0 and
      this_claim_cents >= 0 and claimed_to_date_cents >= 0 and
      gst_cents >= 0 and retention_amount_cents >= 0 and
      remaining_value_cents >= 0
    ),

  constraint progress_claims_percent_complete_check
    check (percent_complete is null or (percent_complete >= 0 and percent_complete <= 100)),

  constraint progress_claims_period_check
    check (claim_period_to is null or claim_period_from is null or claim_period_to >= claim_period_from),

  constraint progress_claims_client_email_format_check
    check (client_email is null or client_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

comment on table public.progress_claims is
  'One row per Progress Claim. Dedicated, strongly typed table (ADR-016). Core layer only — see 016 (numbering) and 017 (issue workflow, BLOCKED pending accounting confirmation).';
comment on column public.progress_claims.remaining_value_cents is
  'Server-computed, and constrained >= 0 (progress_claims_totals_non_negative_check) as an interim safety rule pending confirmation of the overclaiming question — see the migration header comment, decision 3, and docs/PHASE_5A_PROGRESS_CLAIMS_MIGRATION_REVIEW.md.';
comment on column public.progress_claims.gst_calculation_method is
  'Records which GST calculation order was actually applied. Only one value is implemented (see the check constraint) — explicit and auditable rather than a silent default. The specific accountant question this leaves open is in docs/PHASE_5A_PROGRESS_CLAIMS_MIGRATION_REVIEW.md.';
comment on column public.progress_claims.previously_claimed_cents is
  'Database-derived at INSERT by derive_progress_claim_previously_claimed() (below) — sum of prior issued/approved/paid claims'' this_claim_cents on the same project. Always 0 while issuing remains blocked (017). Frozen against line-item recalculation thereafter, but remains directly editable while draft — a documented exception.';

-- ----------------------------------------------------------------------------
-- Table: progress_claim_line_items
-- The structured schedule of values. No per-line GST or retention — both
-- are payment-claim-level concepts in Australian practice, and the
-- original tool only ever had one retentionRate field.
--
-- previously_claimed_cents here is a DIFFERENT thing from the header
-- column of the same name, and is deliberately NOT derived — see
-- docs/PHASE_5A_DESIGN_PROPOSAL.md §6 for why correctly deriving a
-- per-schedule-item figure needs a stable, identity-bearing schedule
-- template shared across a project's claims, which doesn't exist yet.
-- ----------------------------------------------------------------------------
create table if not exists public.progress_claim_line_items (
  id                       uuid primary key default gen_random_uuid(),

  progress_claim_id        uuid not null references public.progress_claims(id) on delete cascade,

  position                 smallint not null,
  description              text not null,

  contract_value_cents     bigint not null,
  previously_claimed_cents bigint not null default 0,
  this_claim_percent       numeric(5,2),

  -- Server-overwritten from this_claim_percent when supplied; otherwise
  -- accepted as the client's direct input for this line.
  this_claim_cents         bigint not null default 0,

  -- Always server-computed.
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
  'The structured schedule of values for a progress claim. this_claim_cents is server-computed from this_claim_percent when supplied; claimed_to_date_cents/remaining_value_cents are always server-computed. previously_claimed_cents on this table is user-entered, not derived.';

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

comment on function public.enforce_progress_claim_project_same_organisation() is
  'SECURITY DEFINER — independently validates project_id/organisation_id itself (its entire purpose), not dependent on any other trigger or RLS check. Fixed search_path, fully qualified references, EXECUTE revoked from all client roles below.';

create or replace trigger progress_claims_enforce_project_same_organisation
  before insert or update on public.progress_claims
  for each row
  execute function public.enforce_progress_claim_project_same_organisation();

revoke all on function public.enforce_progress_claim_project_same_organisation() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: derive_progress_claim_previously_claimed
-- BEFORE INSERT only. Computes previously_claimed_cents from prior claims
-- on the same project — see the migration header comment, decision 2, for
-- why this is INVOKER (no elevated privilege needed: it only reads rows
-- the caller's own RLS already permits) despite deriving a value the
-- client cannot otherwise supply. Always evaluates to 0 while no claim can
-- reach 'issued'/'approved'/'paid' (true until 017, and 017 stays BLOCKED
-- regardless pending accounting confirmation) — correct and inert until
-- then, exactly like enforce_quote_line_item_draft_only() is inert in
-- 012 alone.
-- ----------------------------------------------------------------------------
create or replace function public.derive_progress_claim_previously_claimed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.previously_claimed_cents := coalesce((
    select sum(this_claim_cents) from public.progress_claims
    where project_id = new.project_id
      and status in ('issued', 'approved', 'paid')
  ), 0);
  return new;
end;
$$;

comment on function public.derive_progress_claim_previously_claimed() is
  'Computes previously_claimed_cents at INSERT from prior issued/approved/paid claims on the same project, regardless of what the client supplies. INVOKER — only reads rows the caller''s own RLS already permits; no elevated privilege required or used.';

create or replace trigger progress_claims_derive_previously_claimed
  before insert on public.progress_claims
  for each row
  execute function public.derive_progress_claim_previously_claimed();

revoke all on function public.derive_progress_claim_previously_claimed() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: compute_progress_claim_derived_totals
-- Runs BEFORE every insert/update of the header row (not only ones caused
-- by a line-item change) and recomputes claimed_to_date_cents/
-- remaining_value_cents/retention_amount_cents/gst_cents/net_payable_cents
-- from contract_value_cents/this_claim_cents/previously_claimed_cents/
-- gst_rate/retention_rate — closes the staleness gap a direct edit to
-- previously_claimed_cents or retention_rate would otherwise leave until
-- the next line-item touch. INVOKER — reads/writes only NEW, no cross-
-- table access, nothing to elevate.
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

revoke all on function public.enforce_progress_claim_line_item_draft_only() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Trigger: recalculate_progress_claim_totals
-- SECURITY DEFINER — required: authenticated's UPDATE grant on
-- progress_claims (below) does not cover contract_value_cents/
-- this_claim_cents, and this function issues its own separate UPDATE.
-- Independent ownership check included (belt-and-braces, same reasoning
-- as recalculate_quote_totals() (012) — no client-suppliable parameter
-- exists here to misuse, but the check is added anyway per this project's
-- policy that a DEFINER function must not rely solely on the RLS check
-- that initiated the trigger it runs inside).
-- ----------------------------------------------------------------------------
create or replace function public.recalculate_progress_claim_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pcid    uuid;
  v_org_id  uuid;
begin
  v_pcid := case when tg_op = 'DELETE' then old.progress_claim_id else new.progress_claim_id end;

  v_org_id := internal.current_organisation_id();
  if v_org_id is null or not exists (
    select 1 from public.progress_claims where id = v_pcid and organisation_id = v_org_id
  ) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  update public.progress_claims
  set contract_value_cents = coalesce((select sum(contract_value_cents) from public.progress_claim_line_items where progress_claim_id = v_pcid), 0),
      this_claim_cents     = coalesce((select sum(this_claim_cents)     from public.progress_claim_line_items where progress_claim_id = v_pcid), 0)
  where id = v_pcid and organisation_id = v_org_id;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace trigger progress_claim_line_items_recalculate_parent_totals
  after insert or update or delete on public.progress_claim_line_items
  for each row
  execute function public.recalculate_progress_claim_totals();

revoke all on function public.recalculate_progress_claim_totals() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists progress_claims_organisation_id_idx on public.progress_claims (organisation_id);
create index if not exists progress_claims_project_id_idx on public.progress_claims (project_id);
create index if not exists progress_claims_organisation_status_idx on public.progress_claims (organisation_id, status);

-- Organisation+project-scoped uniqueness — defined here regardless of
-- numbering being manual (this migration) or auto-assigned (016).
create unique index if not exists progress_claims_org_project_number_unique_idx
  on public.progress_claims (organisation_id, project_id, claim_number);

create index if not exists progress_claim_line_items_progress_claim_id_idx
  on public.progress_claim_line_items (progress_claim_id);

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
-- Row Level Security
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
-- Grants — nothing inherited, explicit here. `status` excluded from day
-- one, same reasoning as 012's quotes grant.
-- ----------------------------------------------------------------------------
revoke all on public.progress_claims from anon, authenticated;
grant select, insert on public.progress_claims to authenticated;
-- claim_number is deliberately NOT in this list — same reasoning as
-- quotes.quote_number's exclusion (012): normalize_progress_claim_number()
-- (016) only runs on INSERT, so a direct client UPDATE would bypass it.
grant update (
  client_name, client_email, contract_ref,
  claim_date, claim_period_from, claim_period_to,
  previously_claimed_cents, gst_rate, retention_rate,
  percent_complete, description_of_work, special_conditions,
  builder_approval_name, client_approval_name, updated_by
) on public.progress_claims to authenticated;

revoke all on public.progress_claim_line_items from anon, authenticated;
grant select, insert, update, delete on public.progress_claim_line_items to authenticated;

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberately deferred):
--   - Auto-numbering / manual-entry normalisation — 016.
--   - Any RPC entry point for creation — 016 (create_progress_claim()).
--   - Issue workflow, issued_at/issued_by/issued_snapshot columns,
--     issue_progress_claim() RPC — 017, and 017 remains BLOCKED for real
--     issuing regardless of being drafted, pending accounting confirmation.
--   - Retention caps, per-line GST/retention, multi-currency, a shared
--     cross-claim schedule-of-values template.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Local functional test plan (this migration ALONE, before 016/017 exist):
--   1. Insert a claim directly supplying claim_number manually — confirm
--      success (no auto-numbering yet). previously_claimed_cents confirmed
--      derived as 0 (no prior claims can exist with a non-draft status).
--   2. Insert a second claim with the same claim_number on the same
--      project — confirm rejection by
--      progress_claims_org_project_number_unique_idx.
--   3. Insert schedule items (mix of this_claim_percent-driven and direct
--      this_claim_cents) — confirm per-line and header totals compute
--      correctly, including after insert/update/delete.
--   4. Directly UPDATE previously_claimed_cents (while draft, a granted
--      column) to a value large enough that remaining_value_cents would go
--      negative given the current contract_value_cents — confirm REJECTED
--      by progress_claims_totals_non_negative_check (the new interim
--      constraint), not silently accepted.
--   5. Directly UPDATE retention_rate — confirm retention_amount_cents/
--      gst_cents/net_payable_cents recompute immediately, no line-item
--      touch required.
--   6. Attempt a plain client UPDATE setting status to any non-'draft'
--      value — confirm rejected with a Postgres permission error.
--   7. Cross-organisation and cross-tenant-project-mismatch checks,
--      identical in shape to 012's tests.
--   8. search_path / grant catalog checks on every function above —
--      confirm derive_progress_claim_previously_claimed() and
--      compute_progress_claim_derived_totals() are NOT SECURITY DEFINER
--      (least-privilege — they don't need it), while
--      recalculate_progress_claim_totals() and
--      enforce_progress_claim_project_same_organisation() ARE.
-- ============================================================================
