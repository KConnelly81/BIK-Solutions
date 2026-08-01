-- ============================================================================
-- Functional test suite for supabase/migrations/012-017 (Quotes and
-- Progress Claims), run via supabase/local-test/run-local-dry-run.sh.
-- Consolidates the coverage exercised manually across Sprint 5a's review
-- rounds into one repeatable script.
--
-- Convention used throughout: an "expected failure" statement is wrapped
-- in `\set ON_ERROR_STOP off` / `\set ON_ERROR_STOP on` rather than a
-- dollar-quoted DO block — psql does not perform :'var' substitution
-- inside dollar-quoted bodies, which makes DO blocks awkward for this
-- pattern. Every such block is immediately preceded by a `select '...' as
-- step;` line naming what's being tested, so failures are traceable in
-- the output without needing inline comments on every statement.
--
-- Fixture rows are deliberately never DELETEd — authenticated has no
-- DELETE grant on quotes/progress_claims (ADR-010), which is itself part
-- of what this suite implicitly confirms. This is a disposable database;
-- leftover fixtures are expected and harmless.
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off

-- ============================================================
-- Setup: two organisations, one user each, one project in Org A
-- ============================================================
begin;
insert into public.organisations (id, name, status) values
  ('11111111-1111-1111-1111-111111111111', 'Org A Pty Ltd', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Org B Pty Ltd', 'active');
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@orga.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@orgb.test');
insert into public.profiles (id, organisation_id, full_name, email, status, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Alice', 'a@orga.test', 'active', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Bob', 'b@orgb.test', 'active', 'owner');
insert into public.projects (id, organisation_id, name, status) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Test Project A1', 'active'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Test Project B1', 'active');
commit;

set role authenticated;
select set_config('bik_test.uid', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);

-- ============================================================
-- QUOTES
-- ============================================================

select 'QUOTES: status enum accepts all 7 values; INSERT still forces draft' as step;
insert into public.quotes (organisation_id, project_id, quote_number, status) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'ENUMTEST', 'void');
select status from public.quotes where quote_number = 'ENUMTEST'; -- expect: draft

select 'QUOTES: create_quote via numbering RPC' as step;
select * from public.create_quote(p_project_id => '33333333-3333-3333-3333-333333333333') \gset q_
select :'q_quote_number' as quote_number; -- expect: QT-0001 (or next in sequence)

insert into public.quote_line_items (quote_id, position, description, quantity, unit_price_cents)
values (:'q_id', 1, 'Widget', 1, 100000);

select 'QUOTES: tampered line_total_cents/gst_cents are silently overwritten, not merely rejected' as step;
insert into public.quote_line_items (quote_id, position, description, quantity, unit_price_cents, line_total_cents, gst_cents)
values (:'q_id', 2, 'Tamper attempt', 1, 100, 999999999, 999999999);
select description, unit_price_cents, line_total_cents, gst_cents from public.quote_line_items where quote_id = :'q_id' and position = 2;
-- expect: line_total_cents=100, gst_cents=10 (10% of 100) -- NOT 999999999

select 'QUOTES: issue_quote fails - quote_type missing (checked first)' as step;
\set ON_ERROR_STOP off
select public.issue_quote(:'q_id');
\set ON_ERROR_STOP on

update public.quotes set quote_type = 'fixed' where id = :'q_id';
select 'QUOTES: issue_quote fails - valid_until missing' as step;
\set ON_ERROR_STOP off
select public.issue_quote(:'q_id');
\set ON_ERROR_STOP on

update public.quotes set valid_until = quote_date - 1 where id = :'q_id';
select 'QUOTES: issue_quote fails - valid_until before quote_date' as step;
\set ON_ERROR_STOP off
select public.issue_quote(:'q_id');
\set ON_ERROR_STOP on

update public.quotes set valid_until = quote_date + 30, client_name = 'Client One' where id = :'q_id';
select 'QUOTES: issue_quote fails - client_email still missing (name alone is not "complete")' as step;
\set ON_ERROR_STOP off
select public.issue_quote(:'q_id');
\set ON_ERROR_STOP on

update public.quotes set client_email = 'client@example.com' where id = :'q_id';
select 'QUOTES: issue_quote succeeds - all requirements met' as step;
select * from public.issue_quote(:'q_id') \gset qi_
select :'qi_status' as status, :'qi_quote_type' as quote_type, (:'qi_issued_by' is not null) as has_issued_by;
select issued_snapshot->>'quote_number' as snap_quote_number,
       jsonb_array_length(issued_snapshot->'line_items') as snap_line_count
from public.quotes where id = :'q_id';

select 'QUOTES: direct client UPDATE status=issued -- must be a PERMISSION error, not a business-rule error' as step;
\set ON_ERROR_STOP off
update public.quotes set status = 'issued' where id = :'q_id';
\set ON_ERROR_STOP on

select 'QUOTES: post-issue, an already-granted column (scope_of_works) is still rejected -- full freeze' as step;
\set ON_ERROR_STOP off
update public.quotes set scope_of_works = 'tamper attempt' where id = :'q_id';
\set ON_ERROR_STOP on

select 'QUOTES: re-issue via RPC rejected' as step;
\set ON_ERROR_STOP off
select public.issue_quote(:'q_id');
\set ON_ERROR_STOP on

select 'QUOTES: post-issue line-item insert rejected' as step;
\set ON_ERROR_STOP off
insert into public.quote_line_items (quote_id, position, description, quantity, unit_price_cents)
values (:'q_id', 9, 'tamper', 1, 100);
\set ON_ERROR_STOP on

select 'QUOTES: manual numbering normalisation ("qt 50" -> QT-0050)' as step;
select * from public.create_quote(p_project_id => '33333333-3333-3333-3333-333333333333', p_quote_number => 'qt 50') \gset q3_
select :'q3_quote_number' as expect_QT_0050;

select 'QUOTES: duplicate manual number rejected with friendly error, not a raw constraint name' as step;
\set ON_ERROR_STOP off
select public.create_quote(p_project_id => '33333333-3333-3333-3333-333333333333', p_quote_number => '0050');
\set ON_ERROR_STOP on

select 'QUOTES: cross-tenant project/organisation mismatch rejected' as step;
\set ON_ERROR_STOP off
insert into public.quotes (organisation_id, project_id) values
  ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444');
\set ON_ERROR_STOP on

select 'QUOTES: plain manual quote_number insert (core-layer-only style) still works on top of the full stack' as step;
insert into public.quotes (organisation_id, project_id, quote_number, client_name)
values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'MANUAL-1', 'Direct Client');
select quote_number, status from public.quotes where quote_number = 'MANUAL-1';

-- ============================================================
-- PROGRESS CLAIMS
-- ============================================================

select 'PROGRESS CLAIMS: status enum accepts archived; INSERT still forces draft' as step;
insert into public.progress_claims (organisation_id, project_id, claim_number, status) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'ENUMTEST', 'archived');
select status from public.progress_claims where claim_number = 'ENUMTEST'; -- expect: draft

select 'PROGRESS CLAIMS: create_progress_claim via numbering RPC; previously_claimed_cents derived as 0' as step;
select * from public.create_progress_claim(p_project_id => '33333333-3333-3333-3333-333333333333', p_client_name => 'Client Two') \gset pc_
select :'pc_claim_number' as claim_number, :'pc_previously_claimed_cents' as expect_zero;

insert into public.progress_claim_line_items (progress_claim_id, position, description, contract_value_cents, this_claim_cents)
values (:'pc_id', 1, 'Earthworks', 1000000, 200000);

select 'PROGRESS CLAIMS: interim overclaim guard -- setting previously_claimed_cents so remaining would go negative is REJECTED' as step;
\set ON_ERROR_STOP off
update public.progress_claims set previously_claimed_cents = 900000 where id = :'pc_id';
\set ON_ERROR_STOP on
select previously_claimed_cents, claimed_to_date_cents, remaining_value_cents from public.progress_claims where id = :'pc_id';
-- expect: unchanged from before the rejected update (0 / 200000 / 800000)

select 'PROGRESS CLAIMS: a legitimate (non-overclaiming) edit to previously_claimed_cents still works, totals recompute immediately' as step;
update public.progress_claims set previously_claimed_cents = 100000 where id = :'pc_id';
select claimed_to_date_cents, remaining_value_cents from public.progress_claims where id = :'pc_id';
-- expect: 300000 / 700000

select 'PROGRESS CLAIMS: issue_progress_claim BLOCKED by the temporary gate, even for a fully valid claim' as step;
\set ON_ERROR_STOP off
select public.issue_progress_claim(:'pc_id');
\set ON_ERROR_STOP on

select 'PROGRESS CLAIMS: direct client UPDATE status=issued -- must be a PERMISSION error' as step;
\set ON_ERROR_STOP off
update public.progress_claims set status = 'issued' where id = :'pc_id';
\set ON_ERROR_STOP on

-- ============================================================
-- Cross-organisation isolation
-- ============================================================
select set_config('bik_test.uid', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);

select 'CROSS-ORG: Org B cannot see Org A quotes, quote_line_items, or progress_claims' as step;
select count(*) as should_be_zero from public.quotes where id = :'q_id';
select count(*) as should_be_zero from public.quote_line_items where quote_id = :'q_id';
select count(*) as should_be_zero from public.progress_claims where id = :'pc_id';

select 'CROSS-ORG: Org B issue_quote()/issue_progress_claim() on Org A ids -- "not found", not success or a data leak' as step;
\set ON_ERROR_STOP off
select public.issue_quote(:'q_id');
\set ON_ERROR_STOP on
\set ON_ERROR_STOP off
select public.issue_progress_claim(:'pc_id');
\set ON_ERROR_STOP on

reset role;
select 'ALL FUNCTIONAL TESTS COMPLETED' as final_step;
