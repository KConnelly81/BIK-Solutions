-- ============================================================================
-- Migration: 002_create_profiles.sql
-- Purpose:   Creates the profiles table — the app-facing identity record for
--            every authenticated user. Extends auth.users 1:1 and assigns
--            each user to exactly one organisation (tenant) with a role.
-- Phase:     1 (Foundation)
-- Depends on: 001_create_organisations.sql (organisations table,
--             set_updated_at() trigger function)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: profiles
-- One row per auth.users row. Not a separate identity system — Supabase Auth
-- remains the sole source of truth for login, password, and email
-- verification. This table only carries the app-facing profile and tenancy
-- assignment for that identity.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  -- Same UUID as the authenticated user. No default — the inserting caller
  -- (currently: a future bootstrap RPC, not built in this migration) must
  -- supply auth.uid() explicitly. on delete cascade: a profile cannot
  -- outlive the auth identity it represents.
  id                uuid primary key references auth.users(id) on delete cascade,

  -- Tenancy assignment. RESTRICT (not CASCADE): deleting an organisation
  -- must never silently delete member profiles. An org can only be deleted
  -- once it has zero remaining profiles referencing it.
  organisation_id   uuid not null references public.organisations(id) on delete restrict,

  -- Display/profile fields
  full_name         text,
  -- Display-only copy of auth.users.email for admin lists and UI — NOT the
  -- authoritative login identity. Auth, password reset, and email
  -- verification continue to run entirely through Supabase Auth
  -- (auth.users.email). This column can drift from auth.users.email until
  -- the app re-syncs it and that is an accepted, non-security-relevant gap.
  email             text,
  phone             text,
  job_title         text,

  -- Deliberately small role set for Phase 1. No subcontractor, client
  -- portal, or granular per-resource permissions yet — those extend this
  -- column's check constraint later without touching the tenant model.
  role              text not null default 'member',

  -- Independent of organisations.status: this reflects the individual
  -- member's standing within their org (e.g. offboarded staff), not the
  -- org's own lifecycle.
  status            text not null default 'active',

  -- Audit fields, same convention as 001: reference auth.users directly.
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  updated_by        uuid references auth.users(id) on delete set null,

  constraint profiles_role_check
    check (role in ('owner', 'admin', 'member')),

  constraint profiles_status_check
    check (status in ('active', 'suspended')),

  constraint profiles_email_format_check
    check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

comment on table public.profiles is
  'App-facing identity for each auth.users row. One profile per user, assigned to exactly one organisation with a role. Supabase Auth remains authoritative for login/email verification.';
comment on column public.profiles.id is
  'Same UUID as auth.users.id. Not independently generated — this row does not exist without a matching auth identity.';
comment on column public.profiles.email is
  'Display-only copy of auth.users.email for admin/UI purposes. Not authoritative — never use this column for authentication or verification decisions.';
comment on column public.profiles.role is
  'Phase 1 role set: owner, admin, member. Deliberately minimal — no subcontractor or client-portal roles yet.';
comment on column public.profiles.status is
  'Member standing within their organisation (active/suspended). Independent of organisations.status.';

-- ----------------------------------------------------------------------------
-- Indexes
-- Chosen to match real query patterns rather than indexing every column
-- individually — role and status are low-cardinality on their own, so they
-- are indexed in combination with organisation_id, which is how they will
-- actually be queried (e.g. "list owners of this org", "list active
-- members of this org").
-- ----------------------------------------------------------------------------

-- Base FK-lookup index: Postgres does not auto-index the referencing side
-- of a foreign key, and every RLS policy in 005 will filter on this column.
create index if not exists profiles_organisation_id_idx
  on public.profiles (organisation_id);

-- Supports "who are the owners/admins of org X" — used by RLS policies that
-- gate organisation-level writes, and by future admin/member-management UI.
create index if not exists profiles_organisation_role_idx
  on public.profiles (organisation_id, role);

-- Supports "list active members of org X" for member-management UI.
create index if not exists profiles_organisation_status_idx
  on public.profiles (organisation_id, status);

-- ----------------------------------------------------------------------------
-- updated_at trigger (reuses public.set_updated_at() from 001)
-- ----------------------------------------------------------------------------
create or replace trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- Enabled immediately, no policies yet — same secure-by-default posture as
-- 001. Policies (including the auth_org_id() helper function that reads a
-- caller's organisation_id from this very table) are deferred to
-- 005_phase1_rls.sql, since that is where they are actually consumed.
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- ----------------------------------------------------------------------------
-- NOT built in this migration (documented, deferred):
--
-- Bootstrap path for new signups. A brand-new auth.users row has no
-- profiles row and therefore no organisation_id — nothing in this schema
-- creates the first organisations + profiles pair for a new user. That
-- requires either:
--   (a) a SECURITY DEFINER Postgres function callable post-signup that
--       inserts one organisations row and one profiles row (role='owner')
--       in a single transaction, or
--   (b) an Edge Function performing the same, invoked from the signup flow.
-- This is deliberately out of scope for 002 (table-only) and will be
-- addressed either alongside 005 (RLS policies) or as its own migration,
-- once the signup UX is designed.
-- ----------------------------------------------------------------------------
