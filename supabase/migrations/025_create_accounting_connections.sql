-- ============================================================================
-- Migration: 025_create_accounting_connections.sql
-- Purpose:   Storage for OAuth2 connections to third-party accounting
--            platforms (Xero first; MYOB can reuse this same table via its
--            own `provider` value once built). One row per organisation per
--            connected tenant.
--
--            This table holds live OAuth access/refresh tokens. It is
--            intentionally reachable only by the service_role key — RLS is
--            enabled with no policies at all, and no grant is made to
--            `anon` or `authenticated`, so an authenticated builder's own
--            browser session can never read or write a row here directly,
--            even their own organisation's. The only code that touches this
--            table is the dedicated Cloudflare Worker
--            (cloudflare-worker-xero/worker.js), which holds the
--            SUPABASE_SERVICE_ROLE_KEY as a Worker secret and exposes a
--            narrow /status endpoint to the browser that returns connection
--            metadata only (provider, tenant_name, connected_at) — never a
--            token. This mirrors the existing rule for
--            SUPABASE_SERVICE_ROLE_KEY documented in js/supabase/client.js:
--            that key must never appear in any file under js/.
-- Depends on: 001_create_organisations.sql (organisations table,
--             set_updated_at()), auth.users (built-in)
-- ============================================================================

create table if not exists public.accounting_connections (
  id                uuid primary key default gen_random_uuid(),

  organisation_id   uuid not null references public.organisations(id) on delete cascade,

  -- 'xero' today; 'myob' can reuse this table unchanged when that
  -- integration is built.
  provider          text not null,

  -- The connected accounting-platform tenant/organisation (Xero calls this
  -- a "tenant"). tenant_name is a display label only, refreshed on
  -- (re)connect — never used for any access-control decision.
  tenant_id         text not null,
  tenant_name       text not null default '',

  -- OAuth2 tokens, written only by the Worker's token-exchange/refresh
  -- calls. Xero access tokens expire in ~30 minutes and refresh tokens
  -- rotate (are replaced) on every use — the Worker overwrites both
  -- columns on each refresh rather than appending history.
  access_token      text not null,
  refresh_token     text not null,
  token_type        text not null default 'Bearer',
  expires_at        timestamptz not null,
  scope             text not null default '',

  connected_by      uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint accounting_connections_provider_check
    check (provider in ('xero', 'myob')),

  -- One connected tenant per organisation per provider. Re-connecting the
  -- same tenant updates this row (upsert) rather than creating a second
  -- one; connecting a different tenant for the same provider is a
  -- deliberate re-point and also updates this row, so an organisation
  -- never silently accumulates stale connections.
  constraint accounting_connections_org_provider_unique
    unique (organisation_id, provider)
);

comment on table public.accounting_connections is
  'OAuth2 connections to third-party accounting platforms (Xero, MYOB). Service-role only — see migration header. Never queried or written from browser code.';
comment on column public.accounting_connections.access_token is
  'Short-lived OAuth access token. Service-role readable only.';
comment on column public.accounting_connections.refresh_token is
  'Single-use, rotating OAuth refresh token. Service-role readable only.';

create index if not exists accounting_connections_organisation_id_idx
  on public.accounting_connections (organisation_id);

-- ----------------------------------------------------------------------------
-- updated_at trigger (reuses public.set_updated_at() from 001)
-- ----------------------------------------------------------------------------
create or replace trigger accounting_connections_set_updated_at
  before update on public.accounting_connections
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — deny-all by design. No policy is created for any role; the table is
-- reachable only via the service_role key, which bypasses RLS entirely by
-- Postgres/Supabase convention. See migration header for why.
-- ----------------------------------------------------------------------------
alter table public.accounting_connections enable row level security;

revoke all on public.accounting_connections from anon, authenticated;
-- No grant to anon or authenticated at all — every read and write goes
-- through the Worker's service-role connection. See migration header.
