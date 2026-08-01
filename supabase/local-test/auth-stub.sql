-- ============================================================================
-- Local-only stub of what the real Supabase platform provides (auth.users,
-- auth.uid(), the anon/authenticated/service_role roles), just enough for
-- this repo's migrations to apply and be functionally exercised against a
-- disposable local Postgres instance. NOT a faithful reproduction of
-- Supabase Auth — this is for local dry-run testing only, never for
-- anything resembling a real deployment target.
--
-- auth.uid() reads a session-local GUC so a test script can simulate "the
-- current authenticated user" per psql session via:
--   select set_config('bik_test.uid', '<uuid>', false);
-- ============================================================================

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('bik_test.uid', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;
