-- ============================================================================
-- Functional test suite for supabase/migrations/023_add_authenticated_
-- attendance_checkout.sql, run via run-local-dry-run.sh. Same conventions
-- as attendance-functional-tests.sql: "expected failure" wrapped in
-- \set ON_ERROR_STOP off/on, fixtures never DELETEd.
--
-- Covers, specifically, the regression this migration fixes and the two
-- distinct checkout paths side by side:
--   1. Authenticated admin quick checkout (attendance_checkout_authenticated)
--      -- succeeds only for a record in the caller's own organisation,
--      rejects cross-organisation access, requires authentication at all,
--      is not callable by anon, and behaves the same as the worker-facing
--      function for voided / already-checked-out records.
--   2. Anonymous worker checkout (attendance_checkout, the token-scoped
--      one from 020) -- succeeds with the correct project token, rejects
--      missing/invalid/cross-project tokens. (Already covered by
--      attendance-functional-tests.sql and
--      attendance-020-expand-compatibility-test.sql; repeated here
--      briefly so this file stands alone as the regression record for
--      "both checkout paths, side by side, after the 023 fix.")
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off

-- ============================================================
-- Setup: two organisations, one owner each, one project each,
-- one worker checked in on each project.
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
insert into public.projects (id, organisation_id, name, site_address, status) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Test Project A1', '1 Test St, Sydney', 'active'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Test Project B1', '2 Other St, Perth', 'active');
commit;

set role authenticated;
select set_config('bik_test.uid', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
select public.get_or_create_checkin_token('33333333-3333-3333-3333-333333333333') \gset tok_a_
reset role;

set role authenticated;
select set_config('bik_test.uid', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);
select public.get_or_create_checkin_token('44444444-4444-4444-4444-444444444444') \gset tok_b_
reset role;

set role anon;
select * from public.attendance_checkin(p_token => :'tok_a_get_or_create_checkin_token', p_name => 'Worker A') \gset worker_a_
select * from public.attendance_checkin(p_token => :'tok_b_get_or_create_checkin_token', p_name => 'Worker B') \gset worker_b_
reset role;

-- ============================================================
-- PATH 1: Authenticated admin quick checkout
-- (attendance_checkout_authenticated -- migration 023, this fix)
-- ============================================================

select 'GRANTS: attendance_checkout_authenticated is NOT executable by anon' as step;
select has_function_privilege('anon', 'public.attendance_checkout_authenticated(uuid, text)', 'execute') as should_be_false;

select 'GRANTS: attendance_checkout_authenticated IS executable by authenticated' as step;
select has_function_privilege('authenticated', 'public.attendance_checkout_authenticated(uuid, text)', 'execute') as should_be_true;

select 'ANON: cannot call attendance_checkout_authenticated at all (no execute grant)' as step;
set role anon;
\set ON_ERROR_STOP off
select * from public.attendance_checkout_authenticated(p_record_id => :'worker_a_id'::uuid);
\set ON_ERROR_STOP on
reset role;

select 'AUTHENTICATED, no org context (no profile/session): rejected as Not authorised' as step;
set role authenticated;
select set_config('bik_test.uid', '99999999-9999-9999-9999-999999999999', false);
\set ON_ERROR_STOP off
select * from public.attendance_checkout_authenticated(p_record_id => :'worker_a_id'::uuid);
\set ON_ERROR_STOP on
reset role;

select 'ADMIN (Alice, Org A): cross-organisation checkout of Org B''s worker is rejected as not-found' as step;
set role authenticated;
select set_config('bik_test.uid', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
\set ON_ERROR_STOP off
select * from public.attendance_checkout_authenticated(p_record_id => :'worker_b_id'::uuid);
\set ON_ERROR_STOP on
select status as should_still_be_active from public.attendance_records where id = :'worker_b_id'::uuid;
reset role;

select 'ADMIN (Alice, Org A): checkout of her OWN org''s worker succeeds -- no token needed' as step;
set role authenticated;
select set_config('bik_test.uid', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
select name, hours_on_site, project_name from public.attendance_checkout_authenticated(p_record_id => :'worker_a_id'::uuid, p_notes => 'Left early, all good');
-- expect: Worker A, 0.00-ish, Test Project A1
select status, notes from public.attendance_records where id = :'worker_a_id'::uuid;
-- expect: checked-out, 'Left early, all good'
reset role;

select 'AUDIT LOG: the authenticated checkout wrote an audit_log entry (attendance_edit/void/checkout_authenticated all do; anon checkout does not)' as step;
select source, reason, changes from public.attendance_audit_log where attendance_record_id = :'worker_a_id'::uuid order by changed_at desc limit 1;
-- expect: source='dashboard checkout', reason='Left early, all good', changes=[{"field":"status","from":"active","to":"checked-out"}]

select 'ADMIN (Alice): checking out an already-checked-out record is rejected, same message as the worker-facing function' as step;
set role authenticated;
select set_config('bik_test.uid', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
\set ON_ERROR_STOP off
select * from public.attendance_checkout_authenticated(p_record_id => :'worker_a_id'::uuid);
\set ON_ERROR_STOP on
reset role;

select 'ADMIN (Alice): a nonexistent record id is rejected' as step;
set role authenticated;
select set_config('bik_test.uid', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
\set ON_ERROR_STOP off
select * from public.attendance_checkout_authenticated(p_record_id => '99999999-9999-9999-9999-999999999999'::uuid);
\set ON_ERROR_STOP on
reset role;

select 'ADMIN (Alice): checking out a VOIDED record is rejected with the same message as the worker-facing function' as step;
set role anon;
select * from public.attendance_checkin(p_token => :'tok_a_get_or_create_checkin_token', p_name => 'Worker A2 (to be voided)') \gset worker_a2_
reset role;
set role authenticated;
select set_config('bik_test.uid', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
select public.attendance_void(:'worker_a2_id'::uuid, 'test void for checkout-rejection coverage');
\set ON_ERROR_STOP off
select * from public.attendance_checkout_authenticated(p_record_id => :'worker_a2_id'::uuid);
\set ON_ERROR_STOP on
reset role;

-- ============================================================
-- PATH 2: Anonymous worker checkout (attendance_checkout, from 020) --
-- side by side with PATH 1 above, confirming both coexist correctly and
-- neither regressed the other.
-- ============================================================

select 'WORKER (anon, Org B''s worker, own project token): valid checkout succeeds' as step;
set role anon;
select name, hours_on_site, project_name from public.attendance_checkout(p_record_id => :'worker_b_id'::uuid, p_token => :'tok_b_get_or_create_checkin_token', p_notes => 'Anon self-checkout');
-- expect: Worker B, 0.00-ish, Test Project B1

select 'WORKER (anon): missing token (explicit null, matching real frontend behaviour) rejected' as step;
set role anon;
select * from public.attendance_checkin(p_token => :'tok_a_get_or_create_checkin_token', p_name => 'Worker A3') \gset worker_a3_
\set ON_ERROR_STOP off
select * from public.attendance_checkout(p_record_id => :'worker_a3_id'::uuid, p_token => null, p_notes => 'no token');
\set ON_ERROR_STOP on

select 'WORKER (anon): invalid/unknown token rejected' as step;
\set ON_ERROR_STOP off
select * from public.attendance_checkout(p_record_id => :'worker_a3_id'::uuid, p_token => '00000000000000000000000000000000', p_notes => 'bad token');
\set ON_ERROR_STOP on

select 'WORKER (anon): cross-project token (Org B''s valid token, against Org A''s record) rejected -- no cross-tenant leak' as step;
\set ON_ERROR_STOP off
select * from public.attendance_checkout(p_record_id => :'worker_a3_id'::uuid, p_token => :'tok_b_get_or_create_checkin_token', p_notes => 'cross-project attempt');
\set ON_ERROR_STOP on

select 'WORKER (anon): correct token finally succeeds' as step;
select name from public.attendance_checkout(p_record_id => :'worker_a3_id'::uuid, p_token => :'tok_a_get_or_create_checkin_token', p_notes => 'correct token');
-- expect: Worker A3
reset role;

select 'AUDIT LOG: the anonymous worker checkout did NOT write an audit_log entry (no authenticated actor)' as step;
select count(*) as should_be_zero from public.attendance_audit_log where attendance_record_id = :'worker_a3_id'::uuid;

select 'BOTH CHECKOUT PATHS VERIFIED SIDE BY SIDE -- 023 FIX CONFIRMED' as result;
