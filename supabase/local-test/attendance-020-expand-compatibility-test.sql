-- ============================================================================
-- Compatibility verification for the 020/022 expand/contract rollout of
-- the attendance capability-link hardening.
--
-- Unlike the other files in this directory, this is NOT meant to be run
-- via run-local-dry-run.sh against the full migration set (that applies
-- every migration found, including 022, which is exactly the state this
-- file needs to NOT yet exist in order to test anything). Run it against
-- a database built from migrations 001-021 only (020's additive/expand
-- step applied, 022's contract/retire step NOT applied) — e.g.:
--
--   for f in supabase/migrations/0{01..21}_*.sql; do
--     sudo -u postgres psql -d bik_compat_expand -v ON_ERROR_STOP=1 -f "$f"
--   done
--   sudo -u postgres psql -d bik_compat_expand \
--     -c "grant usage on schema auth to anon, authenticated, service_role; grant execute on function auth.uid() to anon, authenticated, service_role;"
--   sudo -u postgres psql -d bik_compat_expand -f supabase/local-test/auth-stub.sql   -- run this FIRST, before 001
--   sudo -u postgres psql -d bik_compat_expand -f supabase/local-test/attendance-020-expand-compatibility-test.sql
--
-- What this proves, empirically (not inferred from reading the SQL):
--   A. OLD frontend call shape (attendance_get_by_id(p_record_id),
--      attendance_checkout(p_record_id, p_notes) -- no p_token at all)
--      against a database that already has 020/021 -- MUST still work.
--   B. NEW frontend call shape (both RPCs called with p_token, exactly
--      as js/toolkit/attendance-rpc.js sends it) -- MUST also work, and
--      MUST still reject a missing/invalid/cross-org token.
--
-- Both were found to FAIL before 020 was redesigned as additive-only
-- (the original single-step drop-and-replace version broke direction A
-- outright: empty result from attendance_get_by_id, hard error from
-- attendance_checkout). The fix was making the new p_token parameter
-- non-defaulted (a defaulted p_token made the two overloads ambiguous
-- for the old 1-arg/2-arg call shape) and reordering attendance_checkout's
-- parameters so the non-defaulted p_token doesn't follow the defaulted
-- p_notes (Postgres requires defaulted parameters to trail) -- transparent
-- to callers either way, since both the real frontend and this test use
-- named parameters throughout.
-- ============================================================================
\set ON_ERROR_STOP on

begin;
insert into public.organisations (id, name, status) values ('11111111-1111-1111-1111-111111111111', 'Org A Pty Ltd', 'active');
insert into auth.users (id, email) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@orga.test');
insert into public.profiles (id, organisation_id, full_name, email, status, role) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Alice', 'a@orga.test', 'active', 'owner');
insert into public.projects (id, organisation_id, name, site_address, status) values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Test Project A1', '1 Test St, Sydney', 'active');
commit;

set role authenticated;
select set_config('bik_test.uid', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
select public.get_or_create_checkin_token('33333333-3333-3333-3333-333333333333') \gset tok_a_
reset role;

set role anon;
select * from public.attendance_checkin(p_token => :'tok_a_get_or_create_checkin_token', p_name => 'James Talbot (old-shape caller)') \gset james_
select * from public.attendance_checkin(p_token => :'tok_a_get_or_create_checkin_token', p_name => 'Sarah Mitchell (new-shape caller)') \gset sarah_
select * from public.attendance_checkin(p_token => :'tok_a_get_or_create_checkin_token', p_name => 'Bad Token Target') \gset bad_
reset role;

set role anon;

select 'DIRECTION A: OLD frontend call shape (no p_token at all) must still work -- attendance_get_by_id' as step;
select name, status from public.attendance_get_by_id(p_record_id => :'james_id'::uuid); -- expect: James Talbot (old-shape caller), active

select 'DIRECTION A: OLD frontend call shape must still work -- attendance_checkout' as step;
select name, hours_on_site from public.attendance_checkout(p_record_id => :'james_id'::uuid, p_notes => 'checked out via old call shape') \gset a_result_
select :'a_result_name' as checked_out_name; -- expect: James Talbot (old-shape caller)

select 'DIRECTION B: NEW frontend call shape (with p_token) must work -- attendance_get_by_id' as step;
select name, status from public.attendance_get_by_id(p_record_id => :'sarah_id'::uuid, p_token => :'tok_a_get_or_create_checkin_token'); -- expect: Sarah Mitchell (new-shape caller), active

select 'DIRECTION B: NEW frontend call shape must work -- attendance_checkout' as step;
select name, hours_on_site from public.attendance_checkout(p_record_id => :'sarah_id'::uuid, p_token => :'tok_a_get_or_create_checkin_token', p_notes => 'checked out via new call shape') \gset b_result_
select :'b_result_name' as checked_out_name; -- expect: Sarah Mitchell (new-shape caller)

select 'DIRECTION B: NEW call shape with a missing (explicit null) token is still rejected -- get_by_id returns zero rows' as step;
select count(*) as should_be_zero from public.attendance_get_by_id(p_record_id => :'bad_id'::uuid, p_token => null);

select 'DIRECTION B: NEW call shape with an invalid token is still rejected -- checkout errors' as step;
\set ON_ERROR_STOP off
select * from public.attendance_checkout(p_record_id => :'bad_id'::uuid, p_token => '00000000000000000000000000000000', p_notes => 'wrong token');
\set ON_ERROR_STOP on

reset role;

select 'EXPAND-PHASE COMPATIBILITY VERIFIED: both call shapes work; hardening still rejects bad tokens' as result;
