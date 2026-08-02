-- ============================================================================
-- Migration: 017_create_progress_claim_issue_workflow.sql
-- Purpose:   Adds the issue workflow for Progress Claims — issued_at/
--            issued_by/issued_snapshot columns, the full lifecycle
--            state-machine trigger, and issue_progress_claim(), the sole
--            RPC entry point to draft -> issued. Layer 3 of 3 — depends on
--            015 (table) and 016 (numbering).
--
-- ****************************************************************************
-- * STATUS: BLOCKED FOR REAL ISSUING. Drafted for design/review purposes    *
-- * only, per explicit instruction. Even if this migration is applied, NO  *
-- * progress claim can ever reach 'issued' through it — see the            *
-- * unconditional gate in enforce_progress_claim_status_transition()       *
-- * below, which is the FIRST check in the issue-transition branch, ahead  *
-- * of every other validation. This is a database-enforced guarantee, not *
-- * a frontend-hiding convention — "do not rely only on frontend hiding"   *
-- * was explicit, and this migration does not.                            *
-- ****************************************************************************
--
--            DRAFT — NOT APPLIED to hpcqncghvdrlvufxfdnd.
--
--            Five unresolved external questions gate this migration's real
--            use (see docs/PHASE_5A_PROGRESS_CLAIMS_MIGRATION_REVIEW.md for
--            full detail on each):
--              1. GST calculated before or after retention is withheld.
--              2. Retention calculated GST-inclusive or GST-exclusive.
--              3. Treatment of previously claimed amounts.
--              4. Whether overclaiming is permitted at all (015 already
--                 enforces a hard interim "no negative remaining value"
--                 rule regardless of this question's eventual answer —
--                 that constraint does not depend on this migration and
--                 stays in force whether or not 017 is ever applied).
--              5. Whether contract value includes approved variations.
--
--            Same column-addition strategy as 014 (Quotes): issued_at/
--            issued_by/issued_snapshot/status_changed_at/status_changed_by
--            are added HERE by ALTER TABLE, not pre-declared in 015.
--            authenticated is granted nothing on them by this migration —
--            Postgres does not retroactively extend an existing column-
--            level GRANT to a newly added column, so they start with zero
--            client-role privilege by construction. issue_progress_claim()
--            (SECURITY DEFINER, below) would be the only path capable of
--            writing them, IF it could ever succeed — which, per the gate,
--            it cannot.
-- Phase:     5a (Tool migration — Progress Claims, issue-workflow layer — BLOCKED)
-- Depends on: 015_create_progress_claims.sql, 016_create_progress_claim_numbering.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Columns: issue-workflow surface
-- ----------------------------------------------------------------------------
alter table public.progress_claims
  add column if not exists issued_at         timestamptz,
  add column if not exists issued_by         uuid references auth.users(id) on delete set null,
  add column if not exists issued_snapshot    jsonb,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references auth.users(id) on delete set null;

comment on column public.progress_claims.issued_by is
  'Who issued this claim — set once, by issue_progress_claim() only. Currently unreachable for any real claim — see the BLOCKED gate in enforce_progress_claim_status_transition().';
comment on column public.progress_claims.issued_snapshot is
  'A frozen copy of this claim and its schedule items exactly as issued — see quotes.issued_snapshot (014) for the identical reasoning. Currently unreachable — see the BLOCKED gate.';

-- ----------------------------------------------------------------------------
-- Trigger: enforce_progress_claim_status_transition
-- Identical state-machine shape to enforce_quote_status_transition() (014).
-- INVOKER — same reasoning: nothing here needs elevation regardless of
-- who calls it, since in practice it's only reachable via
-- issue_progress_claim() (authenticated has no column grant on `status`
-- at any layer of this restructure).
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

  -- ════════════════════════════════════════════════════════════════════════
  -- BLOCKED — checked first, ahead of every other validation below. The
  -- GST/retention/overclaiming/contract-value questions listed in this
  -- migration's header comment have not been confirmed. Drafts remain
  -- fully usable (create, edit, calculate — including the hard "no
  -- negative remaining value" rule 015 already enforces regardless of this
  -- gate). Only this transition is blocked. Remove ONLY this check, once
  -- confirmation is formally recorded — every other check below it is
  -- already written, tested (with this gate temporarily disabled in a
  -- disposable local build, never shipped that way), and ready.
  -- ════════════════════════════════════════════════════════════════════════
  raise exception 'Progress Claims cannot be issued yet — GST, retention, and overclaiming treatment require accountant/contract confirmation before this goes live. Drafts remain fully usable for testing. See docs/PHASE_5A_PROGRESS_CLAIMS_MIGRATION_REVIEW.md.'
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
    'claim_number',                 new.claim_number,
    'client_name',                  new.client_name,
    'client_email',                 new.client_email,
    'contract_ref',                 new.contract_ref,
    'claim_date',                   new.claim_date,
    'claim_period_from',            new.claim_period_from,
    'claim_period_to',              new.claim_period_to,
    'contract_value_cents',         new.contract_value_cents,
    'previously_claimed_cents',     new.previously_claimed_cents,
    'this_claim_cents',             new.this_claim_cents,
    'claimed_to_date_cents',        new.claimed_to_date_cents,
    'remaining_value_cents',        new.remaining_value_cents,
    'gst_rate',                     new.gst_rate,
    'gst_calculation_method',       new.gst_calculation_method,
    'gst_cents',                    new.gst_cents,
    'retention_rate',               new.retention_rate,
    'retention_calculation_method', new.retention_calculation_method,
    'retention_amount_cents',       new.retention_amount_cents,
    'net_payable_cents',            new.net_payable_cents,
    'percent_complete',             new.percent_complete,
    'description_of_work',          new.description_of_work,
    'special_conditions',           new.special_conditions,
    'builder_approval_name',        new.builder_approval_name,
    'client_approval_name',         new.client_approval_name,
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
  'BLOCKED. The full lifecycle state machine for progress claims, identical shape to enforce_quote_status_transition() (014), plus an unconditional gate that rejects every draft -> issued attempt until GST/retention/overclaiming/contract-value treatment is confirmed. Post-issue: no exceptions, matching Quotes.';

create or replace trigger progress_claims_enforce_status_transition
  before insert or update on public.progress_claims
  for each row
  execute function public.enforce_progress_claim_status_transition();

-- ----------------------------------------------------------------------------
-- Function: issue_progress_claim
-- BLOCKED — see the trigger above. Built and grantable now so the
-- frontend has a stable integration point and a real, correctly-worded
-- error to surface while the gate is in place; cannot succeed for any real
-- claim regardless of caller, input, or organisation.
--
-- SECURITY DEFINER, same reasoning as issue_quote() (014): must be able to
-- write columns authenticated has no grant on; independently re-checks
-- organisation ownership since it does not run under RLS.
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
  'BLOCKED. The only path capable of transitioning a progress claim from draft to issued — currently unconditionally rejected by enforce_progress_claim_status_transition()''s temporary gate, regardless of caller or claim validity, pending accounting/contract confirmation. SECURITY DEFINER; independently re-checks organisation ownership.';

revoke all on function public.issue_progress_claim(uuid) from public, anon;
grant execute on function public.issue_progress_claim(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Local functional test plan (this migration ON TOP OF 015 + 016) — the
-- PRIMARY test is that issuing is impossible, full stop:
--   1. Create a fully valid draft (real client_name, real line item,
--      internally consistent totals). Attempt issue_progress_claim() —
--      confirm rejection by the gate's specific message, not a generic or
--      business-rule error, proving the gate fires first.
--   2. Attempt a plain client UPDATE setting status = 'issued' directly —
--      confirm a Postgres permission error (proving the grant boundary
--      holds independently of the gate).
--   3. (Gate-disabled build only, local, never shipped that way.) Confirm
--      the validation chain below the gate is independently correct:
--      blank client_name rejected, zero line items rejected, a fully
--      valid claim issues successfully with issued_at/issued_by/
--      status_changed_at/status_changed_by set and issued_snapshot
--      populated correctly including its line_items array. This proves
--      the migration is ready to activate the moment the gate is removed,
--      without needing to write or re-verify new logic at that time.
-- ============================================================================
