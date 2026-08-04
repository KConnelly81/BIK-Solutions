-- ============================================================================
-- Migration: 018_create_attendance.sql
-- Purpose:   Creates a fully Supabase-backed Site Attendance module —
--            public.project_checkin_tokens, public.attendance_records, and
--            public.attendance_audit_log — replacing the previous
--            localStorage-only implementation (js/toolkit/attendance-store.js,
--            js/toolkit/checkin-token.js), which stored data per-browser and
--            never made a worker's own-device check-in visible to the
--            builder's authenticated dashboard on another device. That
--            cross-device gap is the defect this migration exists to fix —
--            see docs/MVP_READINESS_AUDIT.md (Site Attendance, P1).
--
--            Core design decision: a worker checking in via a QR code has
--            no Supabase Auth session (no login, by explicit product
--            requirement — "check in without an account"). Every worker-
--            facing mutation therefore goes through a SECURITY DEFINER RPC
--            (attendance_checkin / attendance_checkout), never a direct
--            table grant to `anon`. The attendance_records and
--            attendance_audit_log tables themselves grant no INSERT/UPDATE
--            to `anon` OR `authenticated` at all — every write, by builder
--            or by worker, is forced through an audited RPC. This mirrors
--            this codebase's existing pattern of routing calculated/
--            cross-row writes through SECURITY DEFINER functions (see
--            015_create_progress_claims.sql's recalculate_progress_claim_
--            totals()), extended here to the entry point itself so a
--            correction can never be saved without a reason being recorded.
--
--            A worker is identified to the system only by the project's
--            check-in token (a 128-bit random value, opaque to the client —
--            same shape as the previous localStorage implementation's
--            token) and, after checking in, by the record's own uuid (used
--            as an unguessable capability link for the checkout page, e.g.
--            checkout.html?id=<uuid> — same trust model as an email
--            password-reset link). No global cross-project/cross-tenant
--            worker search exists anywhere in this migration.
-- Phase:     6 (Site Attendance — MVP Completion Package 2)
-- Depends on: 001_create_organisations.sql (set_updated_at()),
--             004_create_projects.sql (projects table),
--             005_phase1_rls.sql (internal.current_organisation_id())
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: project_checkin_tokens
-- One active token per project at a time (partial unique index below).
-- Builder-facing only — created/rotated by the authenticated builder via
-- get_or_create_checkin_token()/rotate_checkin_token() (below). Read by
-- anonymous workers only through resolve_checkin_token(), which returns
-- nothing beyond project name/address — never the internal project id.
-- ----------------------------------------------------------------------------
create table if not exists public.project_checkin_tokens (
  id                uuid primary key default gen_random_uuid(),

  organisation_id   uuid not null references public.organisations(id) on delete restrict,
  project_id        uuid not null references public.projects(id) on delete restrict,

  -- 32-char hex (128-bit), generated server-side in
  -- get_or_create_checkin_token() — never client-supplied.
  token             text not null,

  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,

  -- NULL while active. Set (not deleted) on rotation/revocation so old QR
  -- codes fail closed with a clear "no longer valid" outcome rather than
  -- resolving to a different, newer token.
  revoked_at        timestamptz,

  constraint project_checkin_tokens_token_format_check
    check (token ~ '^[0-9a-f]{32}$')
);

comment on table public.project_checkin_tokens is
  'Public QR/check-in tokens for a project. Opaque to the client — encodes nothing about the project. Anonymous workers resolve a token to a project name/address via resolve_checkin_token() only; they never see project_id or any other project data.';

create unique index if not exists project_checkin_tokens_token_unique_idx
  on public.project_checkin_tokens (token);

-- At most one active (non-revoked) token per project — prevents a race
-- between two concurrent "get or create" calls from leaving two live QR
-- codes for the same project.
create unique index if not exists project_checkin_tokens_active_project_unique_idx
  on public.project_checkin_tokens (project_id)
  where revoked_at is null;

create index if not exists project_checkin_tokens_organisation_id_idx
  on public.project_checkin_tokens (organisation_id);

-- ----------------------------------------------------------------------------
-- Table: attendance_records
-- One row per worker sign-in. Mirrors the field shape of the previous
-- js/toolkit/attendance-store.js record (v2) so the builder-facing UI logic
-- (Today/Register/Reports tabs) ports over with minimal change.
-- ----------------------------------------------------------------------------
create table if not exists public.attendance_records (
  id                  uuid primary key default gen_random_uuid(),

  organisation_id     uuid not null references public.organisations(id) on delete restrict,
  project_id          uuid not null references public.projects(id) on delete restrict,

  -- Which QR token was used to check in, if any (NULL is possible in
  -- principle for a future builder-entered record — checked_in_by would be
  -- 'builder' in that case; no such entry path is built yet, see the
  -- "NOT built" note at the end of this file). SET NULL: a token rotation/
  -- revocation must never delete or block deletion of attendance history.
  checkin_token_id    uuid references public.project_checkin_tokens(id) on delete set null,

  -- Derived server-side at check-in from the project's local date
  -- (Australia/Sydney) — see attendance_checkin() below for the documented
  -- simplification (a single fixed timezone for a single-country product,
  -- matching the previous client-side implementation's use of the
  -- browser's local date).
  attendance_date     date not null default (timezone('Australia/Sydney', now()))::date,

  name                text not null,
  company             text not null default '',
  trade               text not null default '',
  -- Normalised (04xxxxxxxx -> +614xxxxxxxx) by attendance_checkin()/
  -- attendance_edit() — see normalise_au_mobile() below.
  mobile              text not null default '',
  worker_type         text not null default 'subcontractor',

  time_in             timestamptz not null default now(),
  time_out            timestamptz,
  break_minutes       integer not null default 0,
  -- Server-computed by compute_attendance_hours() (below) from time_in/
  -- time_out/break_minutes. Never client-suppliable.
  hours_on_site       numeric(6,2),

  status              text not null default 'active',
  void_reason         text,
  notes               text not null default '',

  checked_in_by       text not null default 'self',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- NULL for a worker's own self-check-in (no auth session exists to
  -- attribute it to); set to the builder's auth.uid() only for a future
  -- builder-entered record (not built yet).
  created_by          uuid references auth.users(id) on delete set null,
  -- Set by attendance_edit()/attendance_void() to the builder who made the
  -- correction — never by a worker-facing RPC.
  updated_by          uuid references auth.users(id) on delete set null,

  constraint attendance_records_worker_type_check
    check (worker_type in ('subcontractor', 'employee', 'contractor', 'labour-hire', 'visitor', 'inspector', 'supplier', 'other')),

  constraint attendance_records_status_check
    check (status in ('active', 'checked-out', 'voided')),

  constraint attendance_records_checked_in_by_check
    check (checked_in_by in ('self', 'builder')),

  constraint attendance_records_name_not_blank_check
    check (length(trim(name)) >= 2),

  constraint attendance_records_time_out_after_time_in_check
    check (time_out is null or time_out > time_in),

  constraint attendance_records_break_minutes_check
    check (break_minutes >= 0 and break_minutes <= 480),

  constraint attendance_records_hours_non_negative_check
    check (hours_on_site is null or hours_on_site >= 0)
);

comment on table public.attendance_records is
  'One row per worker site sign-in/out. All writes — worker self-service and builder correction alike — go through SECURITY DEFINER RPCs (attendance_checkin, attendance_checkout, attendance_edit, attendance_void); no direct INSERT/UPDATE grant exists on this table for anon or authenticated. See migration header for the full reasoning.';
comment on column public.attendance_records.hours_on_site is
  'Server-computed only (compute_attendance_hours() trigger). Reflects recorded sign-in/sign-out times, not approved payroll or billable hours — the same "Not payroll" disclaimer shown in the UI applies at the data layer too.';
comment on column public.attendance_records.attendance_date is
  'Derived from Australia/Sydney local time at check-in. A single fixed timezone is a deliberate simplification for a single-country product — a worker checking in right at local midnight in a different Australian timezone could see their record dated one day off. Documented, not silently assumed.';

-- ----------------------------------------------------------------------------
-- Table: attendance_audit_log
-- Every correction (attendance_edit) or void (attendance_void) writes
-- exactly one row here, with a mandatory reason. There is no path to
-- mutate an existing attendance_records row without one — see
-- attendance_edit()/attendance_void() below, which enforce this themselves
-- (reason is a required, non-blank parameter), not merely a UI convention.
-- ----------------------------------------------------------------------------
create table if not exists public.attendance_audit_log (
  id                    uuid primary key default gen_random_uuid(),

  attendance_record_id  uuid not null references public.attendance_records(id) on delete cascade,

  changed_at            timestamptz not null default now(),
  changed_by_user_id    uuid references auth.users(id) on delete set null,
  source                text not null default 'dashboard edit',
  reason                text not null,
  -- [{ "field": "timeIn", "from": "...", "to": "..." }, ...]
  changes               jsonb not null,

  constraint attendance_audit_log_reason_not_blank_check
    check (length(trim(reason)) >= 1),
  constraint attendance_audit_log_changes_is_array_check
    check (jsonb_typeof(changes) = 'array')
);

comment on table public.attendance_audit_log is
  'Append-only correction history for attendance_records. Written only by attendance_edit()/attendance_void() (SECURITY DEFINER) — never directly insertable by any client role, so a correction cannot be saved without a reason.';

create index if not exists attendance_audit_log_record_id_idx
  on public.attendance_audit_log (attendance_record_id);

-- ----------------------------------------------------------------------------
-- Indexes on attendance_records
-- ----------------------------------------------------------------------------
create index if not exists attendance_records_organisation_id_idx
  on public.attendance_records (organisation_id);

create index if not exists attendance_records_project_id_idx
  on public.attendance_records (project_id);

-- Supports the dashboard's primary query: this project, this date.
create index if not exists attendance_records_project_date_idx
  on public.attendance_records (project_id, attendance_date);

-- Supports "who is currently on site" (time_out is null) and duplicate
-- check-in detection, both scoped to a project.
create index if not exists attendance_records_project_open_idx
  on public.attendance_records (project_id, time_in)
  where time_out is null and status != 'voided';

create index if not exists attendance_records_checkin_token_id_idx
  on public.attendance_records (checkin_token_id);

-- ----------------------------------------------------------------------------
-- updated_at trigger (reuses public.set_updated_at() from 001)
-- project_checkin_tokens has no updated_at column — rotation inserts a new
-- row rather than mutating an existing one — so no trigger is needed there.
-- ----------------------------------------------------------------------------
create or replace trigger attendance_records_set_updated_at
  before update on public.attendance_records
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Cross-tenant integrity: project_id must belong to organisation_id.
-- Identical pattern to enforce_progress_claim_project_same_organisation()
-- (015) — independent of the values the DEFINER RPCs below construct these
-- rows with, not dependent on any other check.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_attendance_project_same_organisation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.projects
    where id = new.project_id
      and organisation_id = new.organisation_id
  ) then
    raise exception 'project_id must belong to the same organisation as the attendance record.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_attendance_project_same_organisation() from public, anon, authenticated;

create or replace trigger attendance_records_enforce_project_same_organisation
  before insert or update on public.attendance_records
  for each row
  execute function public.enforce_attendance_project_same_organisation();

create or replace trigger project_checkin_tokens_enforce_project_same_organisation
  before insert or update on public.project_checkin_tokens
  for each row
  execute function public.enforce_attendance_project_same_organisation();

-- ----------------------------------------------------------------------------
-- Trigger: compute_attendance_hours
-- BEFORE INSERT OR UPDATE. Recomputes hours_on_site from time_in/time_out/
-- break_minutes on every write, so it can never drift from those three
-- columns regardless of which RPC touched them. INVOKER — reads/writes
-- only NEW, nothing to elevate.
-- ----------------------------------------------------------------------------
create or replace function public.compute_attendance_hours()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.time_out is null then
    new.hours_on_site := null;
  else
    new.hours_on_site := greatest(
      0,
      round(
        (extract(epoch from (new.time_out - new.time_in)) / 3600.0)
        - (greatest(0, coalesce(new.break_minutes, 0)) / 60.0),
        2
      )
    );
  end if;
  return new;
end;
$$;

revoke all on function public.compute_attendance_hours() from public, anon, authenticated;

create or replace trigger attendance_records_compute_hours
  before insert or update on public.attendance_records
  for each row
  execute function public.compute_attendance_hours();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.project_checkin_tokens enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_audit_log enable row level security;

-- project_checkin_tokens: ordinary organisation-scoped CRUD (minus delete —
-- rotation soft-revokes) for the authenticated builder. Anon gets no grant
-- at all on this table (see the grants block below); the only anon-reachable
-- path onto this table's data is resolve_checkin_token() (DEFINER, returns
-- only project name/address).
drop policy if exists project_checkin_tokens_select_same_org on public.project_checkin_tokens;
create policy project_checkin_tokens_select_same_org
  on public.project_checkin_tokens for select to authenticated
  using (organisation_id = (select internal.current_organisation_id()));

drop policy if exists project_checkin_tokens_insert_same_org on public.project_checkin_tokens;
create policy project_checkin_tokens_insert_same_org
  on public.project_checkin_tokens for insert to authenticated
  with check (organisation_id = (select internal.current_organisation_id()));

drop policy if exists project_checkin_tokens_update_same_org on public.project_checkin_tokens;
create policy project_checkin_tokens_update_same_org
  on public.project_checkin_tokens for update to authenticated
  using (organisation_id = (select internal.current_organisation_id()))
  with check (organisation_id = (select internal.current_organisation_id()));

-- attendance_records: SELECT only for authenticated (dashboard reads).
-- Deliberately no INSERT/UPDATE policy for authenticated: every mutation,
-- including a builder's own correction, is forced through attendance_edit()/
-- attendance_void() (SECURITY DEFINER, below) so a reason is always
-- captured. No grant exists for anon at all — see the grants block.
drop policy if exists attendance_records_select_same_org on public.attendance_records;
create policy attendance_records_select_same_org
  on public.attendance_records for select to authenticated
  using (organisation_id = (select internal.current_organisation_id()));

-- attendance_audit_log: SELECT only, same reasoning — INSERT happens only
-- via the DEFINER correction RPCs.
drop policy if exists attendance_audit_log_select_same_org on public.attendance_audit_log;
create policy attendance_audit_log_select_same_org
  on public.attendance_audit_log for select to authenticated
  using (exists (
    select 1 from public.attendance_records ar
    where ar.id = attendance_audit_log.attendance_record_id
      and ar.organisation_id = (select internal.current_organisation_id())
  ));

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------
revoke all on public.project_checkin_tokens from anon, authenticated;
grant select, insert, update on public.project_checkin_tokens to authenticated;

revoke all on public.attendance_records from anon, authenticated;
grant select on public.attendance_records to authenticated;
-- No insert/update grant to authenticated or anon — see table comment.

revoke all on public.attendance_audit_log from anon, authenticated;
grant select on public.attendance_audit_log to authenticated;
-- No insert grant to authenticated or anon — written only by the DEFINER
-- correction RPCs.

-- ============================================================================
-- Helper: normalise_au_mobile
-- Same normalisation the previous client-side implementation applied
-- (js/toolkit/attendance-store.js's _normaliseMobile) — 04xxxxxxxx ->
-- +614xxxxxxxx, moved server-side so it applies uniformly regardless of
-- which RPC or client wrote the value.
-- ============================================================================
create or replace function internal.normalise_au_mobile(p_mobile text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_stripped text;
begin
  if p_mobile is null or trim(p_mobile) = '' then
    return '';
  end if;
  v_stripped := regexp_replace(p_mobile, '[\s\-().]', '', 'g');
  if v_stripped ~ '^04\d{8}$' then
    return '+61' || substring(v_stripped from 2);
  elsif v_stripped ~ '^4\d{8}$' then
    return '+61' || v_stripped;
  elsif v_stripped ~ '^614\d{8}$' then
    return '+' || v_stripped;
  else
    return trim(p_mobile);
  end if;
end;
$$;

revoke all on function internal.normalise_au_mobile(text) from public, anon, authenticated;

-- ============================================================================
-- Worker-facing RPCs (SECURITY DEFINER — callable by `anon`)
-- Every function below independently resolves and validates the token
-- itself; none trust a client-supplied project_id or organisation_id.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- resolve_checkin_token(p_token)
-- Used by checkin.html on load. Returns only what the check-in page needs
-- to render (project name/address) — never project_id or organisation_id.
-- Returns zero rows for an unknown or revoked token (client shows its
-- existing "check-in link not found" screen); does not raise, so a stray
-- exception never leaks internal detail to an anonymous caller.
-- ----------------------------------------------------------------------------
create or replace function public.resolve_checkin_token(p_token text)
returns table (project_name text, site_address text)
language sql
security definer
stable
set search_path = ''
as $$
  select p.name, coalesce(p.site_address, '')
  from public.project_checkin_tokens t
  join public.projects p on p.id = t.project_id
  where t.token = p_token
    and t.revoked_at is null
  limit 1;
$$;

comment on function public.resolve_checkin_token(text) is
  'Anonymous-callable. Resolves a check-in token to a project name/address only — never project_id/organisation_id. Zero rows for an unknown/revoked token.';

revoke all on function public.resolve_checkin_token(text) from public;
grant execute on function public.resolve_checkin_token(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- attendance_checkin(...)
-- Validates the token, checks for an existing open sign-in by the same
-- name/mobile on the same project within the last 12 hours (same window as
-- the previous client-side findDuplicate()), and either returns that
-- existing record (is_duplicate = true, no new row written) or inserts a
-- new one. created_by is always NULL (no auth session exists for a worker
-- self-check-in).
-- ----------------------------------------------------------------------------
create or replace function public.attendance_checkin(
  p_token       text,
  p_name        text,
  p_company     text default '',
  p_trade       text default '',
  p_mobile      text default '',
  p_worker_type text default 'subcontractor',
  p_notes       text default ''
)
returns table (
  id uuid, name text, trade text, company text, worker_type text,
  time_in timestamptz, is_duplicate boolean, project_name text, site_address text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id      uuid;
  v_organisation_id uuid;
  v_token_id        uuid;
  v_project_name    text;
  v_site_address    text;
  v_mobile_norm     text;
  v_name            text;
  v_existing        public.attendance_records%rowtype;
  v_new             public.attendance_records%rowtype;
begin
  v_name := trim(p_name);
  if length(v_name) < 2 then
    raise exception 'Please enter your full name.' using errcode = '22023';
  end if;

  select t.id, t.project_id, t.organisation_id, p.name, coalesce(p.site_address, '')
    into v_token_id, v_project_id, v_organisation_id, v_project_name, v_site_address
  from public.project_checkin_tokens t
  join public.projects p on p.id = t.project_id
  where t.token = p_token
    and t.revoked_at is null;

  if v_project_id is null then
    raise exception 'This check-in link is no longer valid. Please ask the site supervisor for an updated link.'
      using errcode = 'P0002';
  end if;

  v_mobile_norm := internal.normalise_au_mobile(p_mobile);

  select ar.* into v_existing
  from public.attendance_records ar
  where ar.project_id = v_project_id
    and ar.time_out is null
    and ar.status != 'voided'
    and ar.time_in > now() - interval '12 hours'
    and (
      lower(ar.name) = lower(v_name)
      or (v_mobile_norm != '' and ar.mobile = v_mobile_norm)
    )
  order by ar.time_in desc
  limit 1;

  if found then
    return query select
      v_existing.id, v_existing.name, v_existing.trade, v_existing.company,
      v_existing.worker_type, v_existing.time_in, true, v_project_name, v_site_address;
    return;
  end if;

  insert into public.attendance_records (
    organisation_id, project_id, checkin_token_id,
    name, company, trade, mobile, worker_type,
    notes, checked_in_by, created_by
  ) values (
    v_organisation_id, v_project_id, v_token_id,
    v_name, trim(coalesce(p_company, '')), trim(coalesce(p_trade, '')), v_mobile_norm,
    coalesce(nullif(trim(p_worker_type), ''), 'subcontractor'),
    trim(coalesce(p_notes, '')), 'self', null
  )
  returning * into v_new;

  return query select
    v_new.id, v_new.name, v_new.trade, v_new.company,
    v_new.worker_type, v_new.time_in, false, v_project_name, v_site_address;
end;
$$;

comment on function public.attendance_checkin(text, text, text, text, text, text, text) is
  'Anonymous-callable. Validates the token independently (never trusts a client-supplied project id), detects a duplicate open sign-in within 12 hours, and otherwise inserts a new attendance_records row with created_by NULL. This is the fix for the cross-device defect: the row lands directly in Supabase, visible to the builder''s dashboard on any device, not in browser-local storage.';

revoke all on function public.attendance_checkin(text, text, text, text, text, text, text) from public;
grant execute on function public.attendance_checkin(text, text, text, text, text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- attendance_lookup_active(p_token, p_name, p_mobile)
-- Used by checkout.html's manual-lookup fallback (no ?id= in the URL).
-- Deliberately scoped to one project via the token — never a global,
-- cross-tenant worker search. Returns at most 10 rows.
-- ----------------------------------------------------------------------------
create or replace function public.attendance_lookup_active(
  p_token  text,
  p_name   text default '',
  p_mobile text default ''
)
returns table (
  id uuid, name text, company text, trade text, time_in timestamptz, project_name text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_project_id  uuid;
  v_mobile_norm text;
  v_name        text;
begin
  v_name := trim(coalesce(p_name, ''));
  v_mobile_norm := internal.normalise_au_mobile(p_mobile);

  if v_name = '' and v_mobile_norm = '' then
    return;
  end if;

  select t.project_id into v_project_id
  from public.project_checkin_tokens t
  where t.token = p_token
    and t.revoked_at is null;

  if v_project_id is null then
    return;
  end if;

  return query
  select ar.id, ar.name, ar.company, ar.trade, ar.time_in, p.name
  from public.attendance_records ar
  join public.projects p on p.id = ar.project_id
  where ar.project_id = v_project_id
    and ar.time_out is null
    and ar.status != 'voided'
    and (
      (v_name != '' and lower(ar.name) = lower(v_name))
      or (v_mobile_norm != '' and ar.mobile = v_mobile_norm)
    )
  order by ar.time_in desc
  limit 10;
end;
$$;

comment on function public.attendance_lookup_active(text, text, text) is
  'Anonymous-callable. Looks up open sign-ins by name/mobile, scoped to a single project via its check-in token — never a cross-project or cross-tenant search.';

revoke all on function public.attendance_lookup_active(text, text, text) from public;
grant execute on function public.attendance_lookup_active(text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- attendance_get_by_id(p_record_id)
-- Used by checkout.html when opened via its capability link
-- (checkout.html?id=<uuid>) — the uuid itself is the authorisation (same
-- trust model as an emailed password-reset link), so this intentionally
-- takes no token. Returns zero rows for an unknown id.
-- ----------------------------------------------------------------------------
create or replace function public.attendance_get_by_id(p_record_id uuid)
returns table (
  id uuid, name text, company text, trade text, time_in timestamptz,
  time_out timestamptz, hours_on_site numeric, status text, project_name text
)
language sql
security definer
stable
set search_path = ''
as $$
  select ar.id, ar.name, ar.company, ar.trade, ar.time_in,
         ar.time_out, ar.hours_on_site, ar.status, p.name
  from public.attendance_records ar
  join public.projects p on p.id = ar.project_id
  where ar.id = p_record_id;
$$;

revoke all on function public.attendance_get_by_id(uuid) from public;
grant execute on function public.attendance_get_by_id(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- attendance_checkout(p_record_id, p_notes)
-- The record's own uuid is the capability/authorisation — see
-- attendance_get_by_id() above for the same reasoning.
-- ----------------------------------------------------------------------------
create or replace function public.attendance_checkout(
  p_record_id uuid,
  p_notes     text default null
)
returns table (
  id uuid, name text, time_out timestamptz, hours_on_site numeric, project_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.attendance_records%rowtype;
  v_project_name text;
begin
  select * into v_row from public.attendance_records ar where ar.id = p_record_id;

  if not found then
    raise exception 'Sign-in record not found.' using errcode = 'P0002';
  end if;
  if v_row.status = 'voided' then
    raise exception 'This sign-in record has been voided by the site supervisor.' using errcode = 'P0002';
  end if;
  if v_row.time_out is not null then
    raise exception 'This record has already been signed out.' using errcode = 'P0002';
  end if;

  update public.attendance_records ar
  set time_out = now(),
      notes = case when p_notes is not null and trim(p_notes) != '' then trim(p_notes) else ar.notes end,
      status = 'checked-out'
  where ar.id = p_record_id
  returning * into v_row;

  select p.name into v_project_name from public.projects p where p.id = v_row.project_id;

  return query select v_row.id, v_row.name, v_row.time_out, v_row.hours_on_site, v_project_name;
end;
$$;

comment on function public.attendance_checkout(uuid, text) is
  'Anonymous-callable. The record uuid is the authorisation (capability-link model, like an emailed reset link) — no token parameter. Rejects an already-checked-out or voided record explicitly rather than silently overwriting.';

revoke all on function public.attendance_checkout(uuid, text) from public;
grant execute on function public.attendance_checkout(uuid, text) to anon, authenticated;

-- ============================================================================
-- Builder-facing RPCs (authenticated)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- get_or_create_checkin_token(p_project_id)
-- SECURITY INVOKER — relies entirely on the ordinary RLS policies above
-- (project_checkin_tokens_select_same_org/_insert_same_org) plus the
-- cross-tenant trigger; no elevated privilege is needed or used.
-- ----------------------------------------------------------------------------
create or replace function public.get_or_create_checkin_token(p_project_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_token  text;
begin
  v_org_id := internal.current_organisation_id();
  if v_org_id is null then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  select token into v_token
  from public.project_checkin_tokens
  where project_id = p_project_id
    and organisation_id = v_org_id
    and revoked_at is null;

  if v_token is not null then
    return v_token;
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.project_checkin_tokens (organisation_id, project_id, token, created_by)
  values (v_org_id, p_project_id, v_token, auth.uid());

  return v_token;
end;
$$;

revoke all on function public.get_or_create_checkin_token(uuid) from public, anon;
grant execute on function public.get_or_create_checkin_token(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- rotate_checkin_token(p_project_id)
-- Revokes the current active token (old QR codes stop working immediately)
-- and issues a new one. Same privilege model as get_or_create above.
-- ----------------------------------------------------------------------------
create or replace function public.rotate_checkin_token(p_project_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_token  text;
begin
  v_org_id := internal.current_organisation_id();
  if v_org_id is null then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  update public.project_checkin_tokens
  set revoked_at = now()
  where project_id = p_project_id
    and organisation_id = v_org_id
    and revoked_at is null;

  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.project_checkin_tokens (organisation_id, project_id, token, created_by)
  values (v_org_id, p_project_id, v_token, auth.uid());

  return v_token;
end;
$$;

revoke all on function public.rotate_checkin_token(uuid) from public, anon;
grant execute on function public.rotate_checkin_token(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- attendance_edit(...)
-- SECURITY DEFINER — required: authenticated has no direct UPDATE grant on
-- attendance_records (see the grants block above), so this function's own
-- UPDATE must run as the function owner. Independently re-verifies
-- organisation membership via internal.current_organisation_id() rather
-- than relying on RLS alone (belt-and-braces, same posture as
-- recalculate_progress_claim_totals() in 015). A reason is mandatory and
-- checked here, not just by the calling UI — the same guarantee
-- attendance_audit_log's own reason-not-blank constraint provides, applied
-- one layer earlier so a bad call fails with a clear message instead of a
-- raw constraint violation.
-- ----------------------------------------------------------------------------
create or replace function public.attendance_edit(
  p_record_id    uuid,
  p_name         text,
  p_company      text,
  p_trade        text,
  p_mobile       text,
  p_worker_type  text,
  p_time_in      timestamptz,
  p_time_out     timestamptz,
  p_break_minutes integer,
  p_notes        text,
  p_reason       text
)
returns public.attendance_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id      uuid;
  v_old         public.attendance_records%rowtype;
  v_new         public.attendance_records%rowtype;
  v_mobile_norm text;
  v_changes     jsonb := '[]'::jsonb;
begin
  v_org_id := internal.current_organisation_id();
  if v_org_id is null then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  if trim(coalesce(p_reason, '')) = '' then
    raise exception 'A correction reason is required.' using errcode = '22023';
  end if;

  select * into v_old
  from public.attendance_records
  where id = p_record_id
    and organisation_id = v_org_id;

  if not found then
    raise exception 'Attendance record not found.' using errcode = 'P0002';
  end if;

  v_mobile_norm := internal.normalise_au_mobile(p_mobile);

  if v_old.name is distinct from trim(p_name) then
    v_changes := v_changes || jsonb_build_object('field', 'name', 'from', v_old.name, 'to', trim(p_name));
  end if;
  if v_old.company is distinct from trim(coalesce(p_company, '')) then
    v_changes := v_changes || jsonb_build_object('field', 'company', 'from', v_old.company, 'to', trim(coalesce(p_company, '')));
  end if;
  if v_old.trade is distinct from trim(coalesce(p_trade, '')) then
    v_changes := v_changes || jsonb_build_object('field', 'trade', 'from', v_old.trade, 'to', trim(coalesce(p_trade, '')));
  end if;
  if v_old.mobile is distinct from v_mobile_norm then
    v_changes := v_changes || jsonb_build_object('field', 'mobile', 'from', v_old.mobile, 'to', v_mobile_norm);
  end if;
  if v_old.worker_type is distinct from coalesce(nullif(trim(p_worker_type), ''), v_old.worker_type) then
    v_changes := v_changes || jsonb_build_object('field', 'worker_type', 'from', v_old.worker_type, 'to', p_worker_type);
  end if;
  if v_old.time_in is distinct from p_time_in then
    v_changes := v_changes || jsonb_build_object('field', 'time_in', 'from', v_old.time_in, 'to', p_time_in);
  end if;
  if v_old.time_out is distinct from p_time_out then
    v_changes := v_changes || jsonb_build_object('field', 'time_out', 'from', v_old.time_out, 'to', p_time_out);
  end if;
  if v_old.break_minutes is distinct from coalesce(p_break_minutes, v_old.break_minutes) then
    v_changes := v_changes || jsonb_build_object('field', 'break_minutes', 'from', v_old.break_minutes, 'to', p_break_minutes);
  end if;
  if v_old.notes is distinct from trim(coalesce(p_notes, '')) then
    v_changes := v_changes || jsonb_build_object('field', 'notes', 'from', v_old.notes, 'to', trim(coalesce(p_notes, '')));
  end if;

  if jsonb_array_length(v_changes) = 0 then
    return v_old;
  end if;

  update public.attendance_records set
    name          = trim(p_name),
    company       = trim(coalesce(p_company, '')),
    trade         = trim(coalesce(p_trade, '')),
    mobile        = v_mobile_norm,
    worker_type   = coalesce(nullif(trim(p_worker_type), ''), worker_type),
    time_in       = p_time_in,
    time_out      = p_time_out,
    break_minutes = coalesce(p_break_minutes, break_minutes),
    notes         = trim(coalesce(p_notes, '')),
    status        = case when p_time_out is null then 'active' else 'checked-out' end,
    updated_by    = auth.uid()
  where id = p_record_id and organisation_id = v_org_id
  returning * into v_new;

  insert into public.attendance_audit_log (attendance_record_id, changed_by_user_id, source, reason, changes)
  values (p_record_id, auth.uid(), 'dashboard edit', trim(p_reason), v_changes);

  return v_new;
end;
$$;

comment on function public.attendance_edit(uuid, text, text, text, text, text, timestamptz, timestamptz, integer, text, text) is
  'Authenticated-only. SECURITY DEFINER because authenticated has no direct UPDATE grant on attendance_records — every correction is forced through here so it always writes a reason to attendance_audit_log. Independently re-checks organisation_id, not solely reliant on RLS.';

revoke all on function public.attendance_edit(uuid, text, text, text, text, text, timestamptz, timestamptz, integer, text, text) from public, anon;
grant execute on function public.attendance_edit(uuid, text, text, text, text, text, timestamptz, timestamptz, integer, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- attendance_void(p_record_id, p_reason)
-- Same privilege posture as attendance_edit() above.
-- ----------------------------------------------------------------------------
create or replace function public.attendance_void(p_record_id uuid, p_reason text)
returns public.attendance_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_old    public.attendance_records%rowtype;
  v_new    public.attendance_records%rowtype;
begin
  v_org_id := internal.current_organisation_id();
  if v_org_id is null then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  if trim(coalesce(p_reason, '')) = '' then
    raise exception 'A void reason is required.' using errcode = '22023';
  end if;

  select * into v_old
  from public.attendance_records
  where id = p_record_id and organisation_id = v_org_id;

  if not found then
    raise exception 'Attendance record not found.' using errcode = 'P0002';
  end if;
  if v_old.status = 'voided' then
    raise exception 'This record has already been voided.' using errcode = 'P0002';
  end if;

  update public.attendance_records
  set status = 'voided', void_reason = trim(p_reason), updated_by = auth.uid()
  where id = p_record_id and organisation_id = v_org_id
  returning * into v_new;

  insert into public.attendance_audit_log (attendance_record_id, changed_by_user_id, source, reason, changes)
  values (
    p_record_id, auth.uid(), 'dashboard edit', trim(p_reason),
    jsonb_build_array(jsonb_build_object('field', 'status', 'from', v_old.status, 'to', 'voided'))
  );

  return v_new;
end;
$$;

comment on function public.attendance_void(uuid, text) is
  'Authenticated-only. SECURITY DEFINER, same reasoning as attendance_edit(). Soft-delete only — the record is kept, marked voided, for audit purposes; never physically deleted through any client-facing path (ADR-010 pattern).';

revoke all on function public.attendance_void(uuid, text) from public, anon;
grant execute on function public.attendance_void(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- NOT built in this migration (deliberate MVP Completion Package 2 scope
-- limits, per the confirmed product decision):
--   - A builder-initiated "add worker manually" entry path. checked_in_by
--     = 'builder' is declared in the check constraint for schema
--     completeness but nothing currently sets it — every row today is
--     checked_in_by = 'self', inserted by attendance_checkin().
--   - Multi-timezone attendance_date derivation (see the column comment).
--   - Site Diary / Payment Reminder Supabase persistence — explicitly
--     deferred to a later release; those tools remain standalone
--     generators with no schema here.
--   - A "checkout required" (forgotten checkout) stored status — this
--     stays a dashboard-side computed view (time_in older than ~18h with
--     no time_out), same as the previous client-side implementation,
--     not a fourth value in attendance_records_status_check.
-- ============================================================================
