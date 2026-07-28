-- ============================================================================
-- Migration: 001_create_organisations.sql
-- Purpose:   Creates the tenant root table for BIK's multi-tenant SaaS model.
--            Every other table in the platform (profiles, customers, projects,
--            and future documents/approvals) scopes its data to one
--            organisation_id. One organisation = one builder business.
-- Phase:     1 (Foundation)
-- Depends on: none (first migration)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Shared trigger function: keeps `updated_at` current on every UPDATE.
-- Created here (first migration) because every Phase 1 table uses it.
-- CREATE OR REPLACE makes this safe to re-run.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Shared BEFORE UPDATE trigger function. Stamps updated_at = now() on every row update. Reused by all Phase 1 tables.';

-- ----------------------------------------------------------------------------
-- Table: organisations
-- The tenant boundary. Represents one builder/trade business using BIK.
-- ----------------------------------------------------------------------------
create table if not exists public.organisations (
  id                uuid primary key default gen_random_uuid(),

  -- Core business identity (maps to today's localStorage bik-builder-profile)
  name              text not null,
  abn               text,
  licence_number    text,
  phone             text,
  email             text,
  address           text,

  -- Basic tenant lifecycle. NOT a billing/subscription field — plan/tier
  -- columns belong to Phase 2 (Stripe) and are deliberately excluded here.
  status            text not null default 'active',

  -- Audit fields. Reference auth.users directly (not public.profiles) because
  -- profiles doesn't exist until migration 002 — this avoids a circular FK
  -- between organisations and profiles, and ties audit identity to the
  -- Supabase-managed auth record, which always exists first.
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  updated_by        uuid references auth.users(id) on delete set null,

  constraint organisations_status_check
    check (status in ('active', 'suspended')),

  -- Loose format guard on ABN (11 digits, no spaces/hyphens). The app layer
  -- is responsible for stripping whitespace before insert/update.
  constraint organisations_abn_format_check
    check (abn is null or abn ~ '^[0-9]{11}$'),

  constraint organisations_email_format_check
    check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

comment on table public.organisations is
  'Tenant root. One row per builder/trade business. All other Phase 1 tables scope to organisation_id.';
comment on column public.organisations.abn is
  'Australian Business Number, 11 digits, no separators. Nullable — not every signup has one to hand immediately.';
comment on column public.organisations.status is
  'Basic tenant lifecycle flag (active/suspended). Not a subscription/plan field — that is Phase 2 (Stripe).';

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

-- One legal business entity should not appear twice. Partial index (ignores
-- NULLs) so orgs without an ABN yet don't collide with each other.
create unique index if not exists organisations_abn_unique_idx
  on public.organisations (abn)
  where abn is not null;

-- Cheap, supports future "list active orgs" admin/ops queries.
create index if not exists organisations_status_idx
  on public.organisations (status);

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
create or replace trigger organisations_set_updated_at
  before update on public.organisations
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- Enabled immediately (secure-by-default), even though no policies exist
-- yet. Until migration 005 lands, this table is fully inaccessible via the
-- API to anon/authenticated roles — only the service_role (which bypasses
-- RLS) can read/write it. This is intentional, not an oversight.
-- ----------------------------------------------------------------------------
alter table public.organisations enable row level security;
