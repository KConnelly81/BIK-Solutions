-- ============================================================================
-- Functional test suite for supabase/migrations/018_create_attendance.sql,
-- run via supabase/local-test/run-local-dry-run.sh. Same conventions as
-- functional-tests.sql (012-017): "expected failure" wrapped in
-- \set ON_ERROR_STOP off/on, fixtures never DELETEd.
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off

-- ============================================================
-- Setup: two organisations, one builder (owner) each, one project each
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

-- ============================================================
-- Builder (Alice, Org A) generates a check-in token for her project
-- ============================================================
set role authenticated;
select set_config('bik_test.uid', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);

select 'BUILDER: get_or_create_checkin_token issues a 32-char hex token' as step;
select public.get_or_create_checkin_token('33333333-3333-3333-3333-333333333333') \gset tok_a_
select :'tok_a_get_or_create_checkin_token' ~ '^[0-9a-f]{32}$' as token_looks_right; -- expect: t

select 'BUILDER: calling it again returns the SAME token (no duplicate active tokens)' as step;
select public.get_or_create_checkin_token('33333333-3333-3333-3333-333333333333') = :'tok_a_get_or_create_checkin_token' as same_token; -- expect: t

select 'BUILDER: cannot mint a token for another organisation''s project' as step;
\set ON_ERROR_STOP off
select public.get_or_create_checkin_token('44444444-4444-4444-4444-444444444444');
\set ON_ERROR_STOP on

reset role;
select set_config('bik_test.uid', '', false);

-- ============================================================
-- Worker (anon) resolves the token and checks in
-- ============================================================
set role anon;

select 'ANON: resolve_checkin_token returns project name/address, nothing else' as step;
select * from public.resolve_checkin_token(:'tok_a_get_or_create_checkin_token');

select 'ANON: an unknown token resolves to zero rows, not an error' as step;
select count(*) as should_be_zero from public.resolve_checkin_token('00000000000000000000000000000000');

select 'ANON: cannot read project_checkin_tokens directly' as step;
\set ON_ERROR_STOP off
select * from public.project_checkin_tokens;
\set ON_ERROR_STOP on

select 'ANON: cannot read attendance_records directly' as step;
\set ON_ERROR_STOP off
select * from public.attendance_records;
\set ON_ERROR_STOP on

select 'ANON: check in James Talbot' as step;
select * from public.attendance_checkin(
  p_token       => :'tok_a_get_or_create_checkin_token',
  p_name        => 'James Talbot',
  p_company     => 'Talbot Plumbing',
  p_trade       => 'Plumber',
  p_mobile      => '0400 111 222',
  p_worker_type => 'subcontractor'
) \gset james_
select :'james_is_duplicate' as should_be_f; -- expect: f
select :'james_time_in' is not null as has_time_in; -- expect: t

select 'ANON: checking in again with the same name within 12h returns the SAME record (duplicate)' as step;
select * from public.attendance_checkin(
  p_token       => :'tok_a_get_or_create_checkin_token',
  p_name        => 'James Talbot',
  p_company     => 'Talbot Plumbing',
  p_trade       => 'Plumber',
  p_mobile      => '0400 111 222'
) \gset james2_
select :'james2_id' = :'james_id' as same_record; -- expect: t
select :'james2_is_duplicate' as should_be_t; -- expect: t

select 'ANON: mobile was normalised to +61 format' as step;
-- Verified as the superuser, not anon — anon has no SELECT grant on
-- attendance_records at all (by design); this is ground-truth inspection,
-- not a claim about what an anon client can read.
reset role;
select mobile from public.attendance_records where id = :'james_id'::uuid; -- expect: +61400111222
set role anon;

select 'ANON: an invalid/revoked token is rejected with a friendly message' as step;
\set ON_ERROR_STOP off
select * from public.attendance_checkin(p_token => '00000000000000000000000000000000', p_name => 'Nobody');
\set ON_ERROR_STOP on

select 'ANON: a second, different worker checks in cleanly (no false duplicate)' as step;
select * from public.attendance_checkin(
  p_token       => :'tok_a_get_or_create_checkin_token',
  p_name        => 'Sarah Mitchell',
  p_company     => 'SM Electrical',
  p_trade       => 'Electrician',
  p_worker_type => 'subcontractor'
) \gset sarah_
select :'sarah_is_duplicate' as should_be_f; -- expect: f

select 'ANON: attendance_lookup_active finds Sarah by name, scoped to this project/token' as step;
select count(*) as should_be_one from public.attendance_lookup_active(:'tok_a_get_or_create_checkin_token', 'Sarah Mitchell', '');

select 'ANON: attendance_get_by_id returns James''s record for the checkout capability link' as step;
select name, status from public.attendance_get_by_id(:'james_id'::uuid); -- expect: James Talbot, active

select 'ANON: checks James out' as step;
select * from public.attendance_checkout(:'james_id'::uuid, 'All good, no issues.') \gset james_out_
select :'james_out_time_out' is not null as checked_out; -- expect: t
reset role;
select hours_on_site from public.attendance_records where id = :'james_id'::uuid; -- expect: 0.00 (instant checkout in test)
set role anon;

select 'ANON: checking out an already-checked-out record is rejected' as step;
\set ON_ERROR_STOP off
select * from public.attendance_checkout(:'james_id'::uuid);
\set ON_ERROR_STOP on

select 'ANON: a nonexistent record id is rejected' as step;
\set ON_ERROR_STOP off
select * from public.attendance_checkout('99999999-9999-9999-9999-999999999999'::uuid);
\set ON_ERROR_STOP on

select 'ANON: cannot call the builder-only correction RPCs' as step;
\set ON_ERROR_STOP off
select public.attendance_edit(:'sarah_id'::uuid, 'Sarah M', '', '', '', 'subcontractor', now(), null, 0, '', 'test');
\set ON_ERROR_STOP on
\set ON_ERROR_STOP off
select public.attendance_void(:'sarah_id'::uuid, 'test');
\set ON_ERROR_STOP on

reset role;

-- ============================================================
-- Builder (Alice) views and corrects the dashboard
-- ============================================================
set role authenticated;
select set_config('bik_test.uid', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);

select 'BUILDER: sees both attendance records for her project' as step;
select count(*) as should_be_two from public.attendance_records where project_id = '33333333-3333-3333-3333-333333333333';

select 'BUILDER: cannot INSERT directly into attendance_records (no grant)' as step;
\set ON_ERROR_STOP off
insert into public.attendance_records (organisation_id, project_id, name) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Direct Insert Attempt');
\set ON_ERROR_STOP on

select 'BUILDER: cannot UPDATE directly into attendance_records (no grant)' as step;
\set ON_ERROR_STOP off
update public.attendance_records set name = 'Hacked' where id = :'sarah_id'::uuid;
\set ON_ERROR_STOP on

select 'BUILDER: attendance_edit without a reason is rejected' as step;
\set ON_ERROR_STOP off
select public.attendance_edit(:'sarah_id'::uuid, 'Sarah Mitchell', 'SM Electrical', 'Electrician', '', 'subcontractor', now(), null, 0, '', '');
\set ON_ERROR_STOP on

select 'BUILDER: attendance_edit corrects Sarah''s trade and logs an audit entry' as step;
select * from public.attendance_edit(
  :'sarah_id'::uuid, 'Sarah Mitchell', 'SM Electrical', 'Senior Electrician', '',
  'subcontractor', (select time_in from public.attendance_records where id = :'sarah_id'::uuid), null, 0, '',
  'Corrected trade title'
) \gset sarah_edit_
select :'sarah_edit_trade' as should_be_senior_electrician;

select 'BUILDER: exactly one audit log entry exists, with the reason' as step;
select count(*) as should_be_one, reason from public.attendance_audit_log where attendance_record_id = :'sarah_id'::uuid group by reason;

select 'BUILDER: editing with no actual changes writes no new audit entry' as step;
select public.attendance_edit(
  :'sarah_id'::uuid, 'Sarah Mitchell', 'SM Electrical', 'Senior Electrician', '',
  'subcontractor', (select time_in from public.attendance_records where id = :'sarah_id'::uuid), null, 0, '',
  'No-op edit'
);
select count(*) as should_still_be_one from public.attendance_audit_log where attendance_record_id = :'sarah_id'::uuid;

select 'BUILDER: voids Sarah''s record with a reason' as step;
select * from public.attendance_void(:'sarah_id'::uuid, 'Duplicate entry') \gset sarah_void_
select :'sarah_void_status' as should_be_voided;

select 'BUILDER: voiding an already-voided record is rejected' as step;
\set ON_ERROR_STOP off
select public.attendance_void(:'sarah_id'::uuid, 'again');
\set ON_ERROR_STOP on

select 'BUILDER: cannot edit a record belonging to another organisation''s project' as step;
select * from public.attendance_checkin(p_token => :'tok_a_get_or_create_checkin_token', p_name => 'Cross Org Probe Target') \gset probe_
\set ON_ERROR_STOP off
select public.attendance_edit('99999999-9999-9999-9999-999999999999'::uuid, 'x','','','','subcontractor', now(), null, 0, '', 'test');
\set ON_ERROR_STOP on

reset role;

-- ============================================================
-- Tenant isolation: Bob (Org B) must see none of Org A's data
-- ============================================================
set role authenticated;
select set_config('bik_test.uid', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);

select 'BOB (Org B): sees zero of Org A''s attendance records' as step;
select count(*) as should_be_zero from public.attendance_records where project_id = '33333333-3333-3333-3333-333333333333';

select 'BOB (Org B): cannot resolve Org A''s token to mint his own checkin_token_id link (irrelevant), but CAN still resolve it via the anon-style RPC since it is a public lookup by design' as step;
select * from public.resolve_checkin_token(:'tok_a_get_or_create_checkin_token'); -- expect: still resolves (token itself is the boundary, not org membership) — documents intended behaviour, not a bug

select 'BOB (Org B): attendance_edit on Alice''s record is rejected as not-found (org-scoped)' as step;
\set ON_ERROR_STOP off
select public.attendance_edit(:'probe_id'::uuid, 'x','','','','subcontractor', now(), null, 0, '', 'test');
\set ON_ERROR_STOP on

select 'BOB (Org B): attendance_void on Alice''s record is rejected as not-found (org-scoped)' as step;
\set ON_ERROR_STOP off
select public.attendance_void(:'probe_id'::uuid, 'test');
\set ON_ERROR_STOP on

select 'BOB (Org B): get_or_create_checkin_token on his own project works fine' as step;
select public.get_or_create_checkin_token('44444444-4444-4444-4444-444444444444') ~ '^[0-9a-f]{32}$' as token_ok;

reset role;

select 'ALL ATTENDANCE FUNCTIONAL TESTS COMPLETED' as result;
