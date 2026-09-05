-- ============================================================================
-- PRODUCTION smoke test for the attendance capability-link hardening
-- (020/021, expand step). Run this against the LIVE Supabase project via
-- an admin SQL connection (SQL Editor or `psql`) AFTER 020 and 021 have
-- been applied there -- it does not depend on whether PR #16's frontend
-- has shipped yet, by design (that's the whole point of the expand step).
--
-- Uses two clearly-labelled, disposable organisations/projects/tokens
-- and one worker record, all created and torn down by this same script.
-- No real customer data is read, written, or exposed.
--
-- Scaffolding (organisations/projects/tokens/profile) is inserted
-- directly rather than through the app's own RPCs (bootstrap_organisation,
-- get_or_create_checkin_token) -- those enforce one-profile-per-user and
-- ownership checks that need a real, already-provisioned account and a
-- faked JWT to satisfy, which added fragility without making the actual
-- thing under test -- the attendance RPCs -- any more realistic. The
-- attendance RPCs themselves (attendance_checkin, attendance_get_by_id,
-- attendance_checkout) ARE called exactly as a real anon browser
-- request would, via `set role anon`, which is the part this migration
-- actually changes.
-- ============================================================================
\set ON_ERROR_STOP on

\echo '=== 1. Scaffold two disposable orgs (each needs its own owner -- an org cannot exist ownerless, even transiently) ==='
select gen_random_uuid() as smoke_owner_a \gset
select gen_random_uuid() as smoke_owner_b \gset
select gen_random_uuid() as smoke_org_a \gset
select gen_random_uuid() as smoke_org_b \gset
select gen_random_uuid() as smoke_project_a \gset
select gen_random_uuid() as smoke_project_b \gset
select md5(gen_random_uuid()::text || clock_timestamp()::text) as smoke_token_a \gset
select md5(random()::text || clock_timestamp()::text) as smoke_token_b \gset

-- organisations_last_owner_guard is DEFERRABLE INITIALLY DEFERRED (see
-- 007_protect_last_owner.sql) precisely so an organisation and its first
-- owner profile can be inserted as two separate statements within one
-- transaction -- but psql runs each statement as its own implicit
-- transaction outside an explicit BEGIN, which would commit (and so
-- check the deferred constraint) before the profile insert below ever
-- runs. Wrap both in one explicit transaction so the check happens once,
-- correctly, at the end.
begin;

insert into auth.users (id, email) values
  (:'smoke_owner_a'::uuid, 'smoke-test-a+' || :'smoke_owner_a' || '@biksolutions.com.au'),
  (:'smoke_owner_b'::uuid, 'smoke-test-b+' || :'smoke_owner_b' || '@biksolutions.com.au');

insert into public.organisations (id, name, status) values
  (:'smoke_org_a'::uuid, 'SMOKE TEST A - safe to delete', 'active'),
  (:'smoke_org_b'::uuid, 'SMOKE TEST B - safe to delete', 'active');

insert into public.profiles (id, organisation_id, full_name, email, status, role) values
  (:'smoke_owner_a'::uuid, :'smoke_org_a'::uuid, 'Smoke Test Runner A', 'smoke-test-a+' || :'smoke_owner_a' || '@biksolutions.com.au', 'active', 'owner'),
  (:'smoke_owner_b'::uuid, :'smoke_org_b'::uuid, 'Smoke Test Runner B', 'smoke-test-b+' || :'smoke_owner_b' || '@biksolutions.com.au', 'active', 'owner');

insert into public.projects (id, organisation_id, name, site_address, status) values
  (:'smoke_project_a'::uuid, :'smoke_org_a'::uuid, 'SMOKE TEST A project - safe to delete', 'N/A', 'active'),
  (:'smoke_project_b'::uuid, :'smoke_org_b'::uuid, 'SMOKE TEST B project - safe to delete', 'N/A', 'active');

commit;

insert into public.project_checkin_tokens (organisation_id, project_id, token, created_by) values
  (:'smoke_org_a'::uuid, :'smoke_project_a'::uuid, :'smoke_token_a', :'smoke_owner_a'::uuid),
  (:'smoke_org_b'::uuid, :'smoke_project_b'::uuid, :'smoke_token_b', :'smoke_owner_b'::uuid);

\echo '=== 2. Worker checks in on project A (anon, as a real check-in page would) ==='
set role anon;
select * from public.attendance_checkin(p_token => :'smoke_token_a', p_name => 'Smoke Test Worker') \gset worker_
reset role;

\echo '--- SMOKE TEST 1: valid access still works (get_by_id + checkout with the correct token) ---'
set role anon;
select name, status from public.attendance_get_by_id(p_record_id => :'worker_id'::uuid, p_token => :'smoke_token_a');
-- expect: Smoke Test Worker, active

\echo '--- SMOKE TEST 2: missing token fails correctly (explicit null, matching real frontend behaviour) ---'
select count(*) as should_be_zero from public.attendance_get_by_id(p_record_id => :'worker_id'::uuid, p_token => null);
-- expect: 0

\echo '--- SMOKE TEST 3: invalid/unknown token fails correctly ---'
select count(*) as should_be_zero from public.attendance_get_by_id(p_record_id => :'worker_id'::uuid, p_token => '00000000000000000000000000000000');
-- expect: 0

\echo '--- SMOKE TEST 4: a valid token for a DIFFERENT project (org B) is rejected for org A''s record ---'
select count(*) as should_be_zero from public.attendance_get_by_id(p_record_id => :'worker_id'::uuid, p_token => :'smoke_token_b');
-- expect: 0
\set ON_ERROR_STOP off
select * from public.attendance_checkout(p_record_id => :'worker_id'::uuid, p_token => :'smoke_token_b', p_notes => 'smoke test cross-org probe');
-- expect: ERROR "Sign-in record not found." (not a leak of which project the record actually belongs to)
\set ON_ERROR_STOP on
reset role;

\echo '--- SMOKE TEST 5: normal authenticated behaviour is unchanged (owner reads their own project''s attendance list, RLS same-org) ---'
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'smoke_owner_a', 'role', 'authenticated')::text, false);
select count(*) as should_be_one from public.attendance_records where project_id = :'smoke_project_a'::uuid;
-- expect: 1
select count(*) as should_be_zero from public.attendance_records where project_id = :'smoke_project_b'::uuid;
-- expect: 0 (org A's owner cannot see org B's records -- unrelated to 020/021, confirms RLS is still intact)
reset role;

\echo '--- Complete the checkout with the CORRECT token, confirming the whole real journey still works end to end ---'
set role anon;
select name, hours_on_site from public.attendance_checkout(p_record_id => :'worker_id'::uuid, p_token => :'smoke_token_a', p_notes => 'smoke test complete');
-- expect: Smoke Test Worker, 0.00
reset role;

\echo '=== 3. Clean up: remove everything this script created ==='
-- One explicit transaction, same reasoning as the scaffolding step: the
-- profiles delete alone would trip the deferred last-owner guard unless
-- the organisation itself is also gone by the time that check runs at
-- commit (see assert_organisation_has_active_owner's early-return for a
-- since-deleted organisation, in 007_protect_last_owner.sql).
begin;
delete from public.attendance_records where id = :'worker_id'::uuid;
delete from public.project_checkin_tokens where token in (:'smoke_token_a', :'smoke_token_b');
delete from public.projects where id in (:'smoke_project_a'::uuid, :'smoke_project_b'::uuid);
delete from public.profiles where id in (:'smoke_owner_a'::uuid, :'smoke_owner_b'::uuid);
delete from public.organisations where id in (:'smoke_org_a'::uuid, :'smoke_org_b'::uuid);
delete from auth.users where id in (:'smoke_owner_a'::uuid, :'smoke_owner_b'::uuid);
commit;

select 'PRODUCTION SMOKE TEST COMPLETE -- all scaffolding cleaned up' as result;
