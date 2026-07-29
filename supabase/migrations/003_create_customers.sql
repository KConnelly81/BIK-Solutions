-- ============================================================================
-- Migration: 003_create_customers.sql
-- Purpose:   Creates the customers table — the clients of a builder/trade
--            business. Normalises the flat clientName/clientEmail/clientPhone
--            fields currently duplicated across every tool's localStorage
--            record into one organisation-owned CRM record that projects
--            (004) can reference.
-- Phase:     1 (Foundation)
-- Depends on: 001_create_organisations.sql (organisations table,
--             set_updated_at() trigger function)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: customers
-- A client of one specific organisation. Represents either an individual
-- (e.g. a homeowner) or a business/company (e.g. a commercial client).
-- ----------------------------------------------------------------------------
create table if not exists public.customers (
  id                uuid primary key default gen_random_uuid(),

  -- Tenancy. RESTRICT (not CASCADE): an organisation must not be deletable
  -- while customer records remain, same reasoning as profiles in 002.
  organisation_id   uuid not null references public.organisations(id) on delete restrict,

  -- Individual vs business/company. Deliberately just a flag, not two
  -- separate tables — both shapes share the same fields below (an
  -- individual leaves business_name blank; a business may still have a
  -- named contact person via first_name/last_name).
  customer_type     text not null default 'individual',

  -- Identity fields. All nullable individually — a record can be created
  -- with almost nothing and completed later — but see
  -- customers_identity_present_check below for the one minimal guard.
  business_name     text,
  first_name        text,
  last_name         text,

  email             text,
  phone             text,
  -- Australian Business Number. Applicable to businesses and to sole
  -- traders operating as an "individual" customer_type, so it is not
  -- restricted by customer_type. Nullable — most individual customers
  -- won't have one.
  abn               text,

  -- Single billing/postal address field. Multiple addresses per customer
  -- are a future extension (see note at bottom of file), not Phase 1.
  address           text,

  notes             text,

  -- Customer lifecycle within the organisation (e.g. archived when the
  -- builder no longer does business with them). Independent of
  -- organisations.status and profiles.status.
  status            text not null default 'active',

  -- Audit fields, same convention as 001/002.
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  updated_by        uuid references auth.users(id) on delete set null,

  constraint customers_type_check
    check (customer_type in ('individual', 'business')),

  constraint customers_status_check
    check (status in ('active', 'archived')),

  -- Deliberately not type-specific (e.g. NOT "business requires
  -- business_name"). The only guard is that the record isn't completely
  -- nameless — at least one of business_name / first_name / last_name must
  -- be present. This still allows a business customer with no contact
  -- person yet, or an individual with only a first name.
  constraint customers_identity_present_check
    check (
      coalesce(business_name, '') <> '' or
      coalesce(first_name, '') <> '' or
      coalesce(last_name, '') <> ''
    ),

  constraint customers_email_format_check
    check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

  -- Deliberately permissive: digits, spaces, +, -, parentheses, 6-20
  -- characters. Accepts Australian mobile/landline formats
  -- (e.g. "0412 345 678", "(02) 9876 5432") and international numbers
  -- (e.g. "+64 21 123 4567") without assuming any particular country's
  -- numbering plan.
  constraint customers_phone_format_check
    check (phone is null or phone ~ '^[0-9+\-\s()]{6,20}$'),

  -- Same loose 11-digit format as organisations.abn — app layer strips
  -- whitespace before insert/update.
  constraint customers_abn_format_check
    check (abn is null or abn ~ '^[0-9]{11}$')
);

comment on table public.customers is
  'Clients of one organisation. Represents an individual or a business/company. No cross-organisation uniqueness — the same real-world person or business may legitimately exist as separate customer rows in different organisations, or even appear more than once within one organisation.';
comment on column public.customers.customer_type is
  'individual or business. A flag, not a type-specific schema — both shapes share the same columns.';
comment on column public.customers.email is
  'Not unique, deliberately. Different organisations may share a customer, and one organisation may have multiple contacts on a shared email address.';

-- ----------------------------------------------------------------------------
-- Indexes
-- No unique constraints on email/phone/business_name — see table comment.
-- ----------------------------------------------------------------------------

-- Base FK-lookup index; every RLS policy in 005 filters on this column.
create index if not exists customers_organisation_id_idx
  on public.customers (organisation_id);

-- Supports "list active/archived customers of org X" — the primary
-- customer-list screen query.
create index if not exists customers_organisation_status_idx
  on public.customers (organisation_id, status);

-- Supports searching/sorting a builder's customer list by business name.
create index if not exists customers_organisation_business_name_idx
  on public.customers (organisation_id, business_name);

-- Supports "does a customer with this email already exist in my org"
-- lookups (e.g. avoiding accidental duplicate creation in the UI) without
-- enforcing uniqueness.
create index if not exists customers_organisation_email_idx
  on public.customers (organisation_id, email);

-- ----------------------------------------------------------------------------
-- updated_at trigger (reuses public.set_updated_at() from 001)
-- ----------------------------------------------------------------------------
create or replace trigger customers_set_updated_at
  before update on public.customers
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- Enabled immediately, no policies yet — same secure-by-default posture as
-- 001 and 002. Policies are added in 005_phase1_rls.sql.
-- ----------------------------------------------------------------------------
alter table public.customers enable row level security;

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberate Phase 1 scope limits):
--   - Multiple contacts per customer (e.g. several people at one company)
--   - Multiple addresses per customer (separate billing/site addresses)
--   - CRM activity history / interaction log
--   - Client portal access (a customer logging in to view their own documents)
-- These are natural extensions once real usage shows they're needed, and
-- none of them require reshaping this table — they would be added tables
-- referencing customers.id, not changes to customers itself.
-- ----------------------------------------------------------------------------
