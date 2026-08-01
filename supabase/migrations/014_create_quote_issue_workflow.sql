-- ============================================================================
-- Migration: 014_create_quote_issue_workflow.sql
-- Purpose:   Adds the issue workflow for Quotes — issued_at/issued_by/
--            issued_snapshot columns, the full lifecycle state-machine
--            trigger, and issue_quote(), the sole path to draft -> issued.
--            Layer 3 of 3 — depends on 012 (table) and 013 (numbering).
--
--            DRAFT — NOT APPLIED to hpcqncghvdrlvufxfdnd.
--
--            Tightened requirements, per explicit direction, beyond what
--            the pre-restructure combined draft validated:
--              - quote_type must be present (was optional at issue).
--              - valid_until must be present AND >= quote_date (was not
--                checked at all).
--              - recipient details "complete", interpreted here as
--                client_name AND client_email both non-blank (was
--                client_name only). client_phone/client_address remain
--                optional — not everything needed to send a quote is a
--                strict prerequisite the way a name and a way to reach the
--                client are. This is a judgement call on an intentionally
--                open instruction ("recipient details are complete"); flag
--                if a narrower or broader definition was intended.
--              - line item count (>=1) and totals-consistency checks:
--                unchanged from the pre-restructure draft.
--
--            Column addition strategy: issued_at/issued_by/issued_snapshot/
--            status_changed_at/status_changed_by are added HERE, by ALTER
--            TABLE, not pre-declared (even as unused/nullable) in 012 —
--            so a reviewer reading 012 alone sees only what draft editing
--            actually needs, and a reviewer reading this file sees exactly
--            what the issue workflow adds, nothing implicit. Consequence,
--            confirmed rather than assumed: authenticated is NOT granted
--            UPDATE on any of these new columns by this migration —
--            Postgres does not retroactively extend an existing
--            column-level GRANT list to a newly added column, so they
--            start with zero client-role privilege by construction, the
--            same secure-by-default property a brand new table has. No
--            explicit REVOKE is needed for them; there is nothing to
--            revoke. issue_quote() (SECURITY DEFINER, below) is therefore
--            the only path capable of writing them from the moment this
--            migration is applied.
-- Phase:     5a (Tool migration — Quotes, issue-workflow layer)
-- Depends on: 012_create_quotes.sql, 013_create_quote_numbering.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Columns: issue-workflow surface
-- ----------------------------------------------------------------------------
alter table public.quotes
  add column if not exists issued_at         timestamptz,
  add column if not exists issued_by         uuid references auth.users(id) on delete set null,
  add column if not exists issued_snapshot    jsonb,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references auth.users(id) on delete set null;

comment on column public.quotes.issued_by is
  'Who issued this quote — set once, by issue_quote() only, at the same moment as issued_at. Not covered by any authenticated column grant (see the migration header comment) — there is no plain-UPDATE path to this column at all.';
comment on column public.quotes.issued_snapshot is
  'A frozen copy of this quote and its line items exactly as they stood at the moment of issue, captured by enforce_quote_status_transition(). Redundant with the fact that the whole row is independently made immutable on issue, kept anyway for forward-compatibility with a future correction/revision mechanism — see docs/PHASE_5A_DESIGN_PROPOSAL.md.';

-- ----------------------------------------------------------------------------
-- Trigger: enforce_quote_status_transition
-- The entire lifecycle state machine, in one function — see
-- docs/PHASE_5A_DESIGN_PROPOSAL.md §5 for the full reasoning on why this is
-- a single function and why issuing must be RPC-only.
--
-- INVOKER (default): every read/write here is something the caller already
-- has direct RLS-permitted access to (their own organisation's quotes and
-- quote_line_items). In practice this trigger's issue-transition branch is
-- reachable exclusively through issue_quote() below, since authenticated
-- has no column grant that could reach `status` at all (012's grant,
-- unchanged by this migration) — but the trigger itself needs no elevated
-- privilege regardless of who calls it.
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
    -- A new row always starts as draft, regardless of client input. Belt-
    -- and-braces: 012's grant already prevents a client from supplying any
    -- of these on INSERT in a way that matters (INSERT is table-level, but
    -- these columns did not exist before this migration and a legitimate
    -- INSERT payload never includes them), so this is defensive, not the
    -- primary guarantee.
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
    -- else. Future accept/decline/expire/void/archive transitions are
    -- controlled RPCs, not built in this migration, and will need their
    -- own explicit, reviewed path around this trigger when they are.
    raise exception 'This quote has been issued and can no longer be changed. Status: %.', old.status
      using errcode = '55000';
  end if;

  if new.status = 'draft' then
    return new; -- ordinary draft edit
  end if;

  if new.status <> 'issued' then
    raise exception 'A draft quote can only transition to issued (attempted: %).', new.status
      using errcode = '55000';
  end if;

  -- draft -> issued: the one transition this migration implements.
  -- Tightened requirements — see the migration header comment.
  if new.quote_type is null then
    raise exception 'Quote type (fixed/estimate/cost-plus) is required before a quote can be issued.' using errcode = '22023';
  end if;

  if new.valid_until is null then
    raise exception 'A valid-until date is required before a quote can be issued.' using errcode = '22023';
  end if;

  if new.valid_until < new.quote_date then
    raise exception 'Valid-until date cannot be before the quote date.' using errcode = '22023';
  end if;

  if btrim(coalesce(new.client_name, '')) = '' then
    raise exception 'Client name is required before a quote can be issued.' using errcode = '22023';
  end if;

  if btrim(coalesce(new.client_email, '')) = '' then
    raise exception 'Client email is required before a quote can be issued.' using errcode = '22023';
  end if;

  select count(*) into v_line_count from public.quote_line_items where quote_id = new.id;
  if v_line_count < 1 then
    raise exception 'At least one line item is required before a quote can be issued.' using errcode = '22023';
  end if;

  -- Defensive re-check, not the primary guarantee (recalculate_quote_totals()
  -- (012) already keeps these consistent on every line-item change) — an
  -- irreversible transition is exactly the moment to re-verify rather than
  -- only trust.
  if new.total_cents <> new.subtotal_cents + new.gst_cents then
    raise exception 'Quote totals are inconsistent and cannot be issued — contact support.'
      using errcode = 'XX000';
  end if;

  new.issued_at := now();
  new.issued_by := auth.uid();
  new.status_changed_at := now();
  new.status_changed_by := auth.uid();

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
  'The full lifecycle state machine for quotes. Forces every INSERT to start as draft; validates (quote_type, valid_until, recipient name+email, >=1 line item, totals consistency), stamps, and snapshots the one legal draft -> issued transition; rejects any UPDATE once a row is no longer draft, with no exceptions. In practice only reachable via issue_quote() — see that function''s comment.';

create or replace trigger quotes_enforce_status_transition
  before insert or update on public.quotes
  for each row
  execute function public.enforce_quote_status_transition();

-- ----------------------------------------------------------------------------
-- Function: issue_quote
-- The only path capable of transitioning a quote from draft to issued —
-- authenticated has no UPDATE grant, at any column-scope, on status/
-- issued_at/issued_by/issued_snapshot/status_changed_at/status_changed_by
-- (012's grant excludes status; this migration grants nothing new to
-- authenticated at all). A plain client UPDATE touching any of them fails
-- with a Postgres permission error before this function, or the row, is
-- ever involved.
--
-- SECURITY DEFINER — required to write those columns. Does not run under
-- RLS, so independently re-establishes the exact access boundary RLS would
-- have given it: both the lookup and the UPDATE's WHERE clause require
-- organisation_id = internal.current_organisation_id(). Same pattern
-- 011's assign_variation_notice_number() and 013's assign_quote_number()
-- already established for calling a DEFINER function safely. Fixed
-- search_path, fully qualified references throughout, EXECUTE revoked from
-- public/anon below, granted only to authenticated.
--
-- Validation logic stays written once, inside
-- enforce_quote_status_transition() — not duplicated here. Since that
-- trigger's issue-transition branch is reachable exclusively through this
-- RPC, writing the checks twice would create two sources of truth that
-- could drift; this function is functionally the sole validator even
-- though the code lives in one place.
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
  'The only path capable of transitioning a quote from draft to issued — authenticated has no UPDATE grant on any lifecycle column, so a plain client UPDATE cannot reach this transition. SECURITY DEFINER; independently re-checks organisation ownership since it does not run under RLS. Validation and stamping live in enforce_quote_status_transition().';

revoke all on function public.issue_quote(uuid) from public, anon;
grant execute on function public.issue_quote(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberately deferred):
--   - accepted/declined/expired/void/archived transitions, and any
--     correction/revision workflow — only draft -> issued exists. A
--     correction to an issued quote should produce a new revision/
--     replacement row, not a mutation of the original — not built here.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Local functional test plan (this migration ON TOP OF 012 + 013):
--   1. Create a draft via create_quote(), add a valid line item, set
--      client_name only (no email, no quote_type, no valid_until).
--      Attempt issue_quote() — confirm rejected with the quote_type error
--      first (order of checks: quote_type, then valid_until, then client_
--      name, then client_email, then line items, then totals).
--   2. Set quote_type; retry — confirm the valid_until error.
--   3. Set valid_until to a date BEFORE quote_date; retry — confirm the
--      "cannot be before the quote date" error, distinct from "required".
--   4. Set valid_until correctly, still no client_email; retry — confirm
--      the client_email error specifically (proving client_name alone is
--      no longer sufficient).
--   5. Set client_email; delete the line item; retry — confirm the line-
--      item error.
--   6. Restore the line item; call issue_quote() — confirm success:
--      status='issued', issued_at/issued_by/status_changed_at/
--      status_changed_by all set, issued_snapshot correct (including a
--      correctly-ordered line_items array).
--   7. Attempt a plain client UPDATE setting status='issued' directly on a
--      separate, fully-valid draft — confirm a Postgres permission error,
--      not the trigger's business-rule error.
--   8. Post-issue: a header UPDATE, a line-item INSERT, and a second
--      issue_quote() call on the now-issued quote — confirm all three
--      rejected.
--   9. Cross-organisation: Org B's issue_quote() call against an Org A
--      quote id — confirm "not found", not success or a data leak.
-- ============================================================================
