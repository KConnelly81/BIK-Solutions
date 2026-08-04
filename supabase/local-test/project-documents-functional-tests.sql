-- ============================================================================
-- Functional test suite for supabase/migrations/019_create_project_documents.sql,
-- run via supabase/local-test/run-local-dry-run.sh. Same conventions as
-- functional-tests.sql / attendance-functional-tests.sql.
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off

-- ============================================================
-- Setup: two organisations, one builder each, one project each
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

select 'ALICE: inserts a Defect Report draft' as step;
insert into public.project_documents (organisation_id, project_id, document_type, title, form_data, created_by, updated_by)
values (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
  'defect_report', 'DEF-001', '{"defectDescription": "Cracked tile", "defectLocation": "Kitchen"}'::jsonb,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
) returning id \gset defect_

select 'ALICE: inserts a SWMS draft on the same project' as step;
insert into public.project_documents (organisation_id, project_id, document_type, title, form_data, created_by, updated_by)
values (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
  'swms', 'SWMS-014', '{"workActivity": "Roof work"}'::jsonb,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
) returning id \gset swms_

select 'ALICE: an invalid document_type is rejected' as step;
\set ON_ERROR_STOP off
insert into public.project_documents (organisation_id, project_id, document_type, title, form_data)
values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'not_a_real_type', 'x', '{}'::jsonb);
\set ON_ERROR_STOP on

select 'ALICE: form_data must be a JSON object, not an array or scalar' as step;
\set ON_ERROR_STOP off
insert into public.project_documents (organisation_id, project_id, document_type, title, form_data)
values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'defect_report', 'x', '[1,2,3]'::jsonb);
\set ON_ERROR_STOP on

select 'ALICE: cannot attach a project from another organisation' as step;
\set ON_ERROR_STOP off
insert into public.project_documents (organisation_id, project_id, document_type, title, form_data)
values ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'defect_report', 'x', '{}'::jsonb);
\set ON_ERROR_STOP on

select 'ALICE: filters her own project''s documents by a single type (per-tool list)' as step;
select count(*) as should_be_one from public.project_documents
where project_id = '33333333-3333-3333-3333-333333333333' and document_type = 'defect_report';

select 'ALICE: filters her own project''s documents by a type set (Project Hub grouped list)' as step;
select count(*) as should_be_two from public.project_documents
where project_id = '33333333-3333-3333-3333-333333333333'
  and document_type in ('defect_report', 'swms', 'incident_report');

select 'ALICE: updates the Defect Report (title + form_data), status default is draft' as step;
update public.project_documents
set title = 'DEF-001', form_data = '{"defectDescription": "Cracked tile, now grouted", "defectLocation": "Kitchen"}'::jsonb
where id = :'defect_id'::uuid
returning status; -- expect: draft

select 'ALICE: archives the SWMS document (soft delete via status)' as step;
update public.project_documents set status = 'archived' where id = :'swms_id'::uuid;
select status from public.project_documents where id = :'swms_id'::uuid; -- expect: archived

select 'ALICE: cannot physically DELETE a document (no grant)' as step;
\set ON_ERROR_STOP off
delete from public.project_documents where id = :'swms_id'::uuid;
\set ON_ERROR_STOP on

reset role;

-- ============================================================
-- Tenant isolation: Bob (Org B) must see none of Alice's documents
-- ============================================================
set role authenticated;
select set_config('bik_test.uid', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);

select 'BOB (Org B): sees zero of Org A''s documents' as step;
select count(*) as should_be_zero from public.project_documents where project_id = '33333333-3333-3333-3333-333333333333';

select 'BOB (Org B): cannot update Alice''s document (RLS blocks the match, 0 rows affected, no error)' as step;
update public.project_documents set title = 'Hacked' where id = :'defect_id'::uuid;
select format('rows affected: %s (expect 0)', (select count(*) from public.project_documents where id = :'defect_id'::uuid and title = 'Hacked')) as result;

select 'BOB (Org B): can insert his own document in his own project' as step;
insert into public.project_documents (organisation_id, project_id, document_type, title, form_data, created_by, updated_by)
values (
  '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444',
  'toolbox_talk', 'TBT-001', '{"topic": "Ladder safety"}'::jsonb,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);
select count(*) as should_be_one from public.project_documents where project_id = '44444444-4444-4444-4444-444444444444';

reset role;

-- ============================================================
-- Anonymous role: zero access, confirming no accidental public exposure
-- ============================================================
set role anon;

select 'ANON: cannot read project_documents at all' as step;
\set ON_ERROR_STOP off
select * from public.project_documents;
\set ON_ERROR_STOP on

select 'ANON: cannot insert into project_documents at all' as step;
\set ON_ERROR_STOP off
insert into public.project_documents (organisation_id, project_id, document_type, title, form_data)
values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'defect_report', 'x', '{}'::jsonb);
\set ON_ERROR_STOP on

reset role;

select 'ALL PROJECT_DOCUMENTS FUNCTIONAL TESTS COMPLETED' as result;
