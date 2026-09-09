-- ============================================================================
-- Migration: 024_mobile_attendance_gps_DRAFT.sql
-- Status:    DRAFT — NOT APPLIED to any Supabase project (dev, staging, or
--            production) as of this commit. Written for review as part of
--            the BIK Field mobile app's Attendance GPS feature
--            (mobile/www/attendance.html). Do not apply without review —
--            see /mobile-release/RELEASE_CHECKLIST.md's NEEDS KAREN section.
--
-- Purpose:   Adds an optional GPS location capture to attendance check-in
--            and check-out — the mobile app records the device's location
--            once, at the moment of the tap, purely to attach it to that
--            attendance record (never continuous tracking, never a
--            background permission). See mobile/mobile-release/
--            PRIVACY_DATA_INVENTORY.md for the full data-use description.
--
-- Design (additive, non-breaking):
--   1. Two nullable columns on attendance_records: check-in and check-out
--      coordinates are stored separately, since they can differ (a worker
--      may check in at the gate and check out from a different spot on a
--      large site) and neither should ever overwrite the other.
--   2. New OVERLOADED versions of attendance_checkin(), attendance_checkout(),
--      and attendance_checkout_authenticated() — each with two new trailing
--      optional parameters (p_latitude, p_longitude, both default null).
--      Per this codebase's own established pattern (020 added new
--      capability-token-scoped overloads of attendance_checkout/
--      attendance_get_by_id alongside the originals; 022 later dropped the
--      old ones once every caller had migrated) — CREATE OR REPLACE cannot
--      change a function's parameter count, so adding parameters always
--      creates a new, separate overload rather than replacing the existing
--      one. The OLD (pre-GPS) overloads are deliberately left untouched by
--      this migration — every existing caller (checkin.html, checkout.html,
--      attendance.html's quick-checkout) keeps working exactly as today,
--      completely unaffected, whether or not this migration is applied.
--   3. Only once the mobile app's calls (which always pass all params,
--      including null when location is denied/unavailable) are confirmed
--      working in production should a FOLLOW-UP migration drop the old,
--      now-unused overloads — mirroring 022's own precedent. That drop is
--      NOT part of this migration; do it separately, after verification.
--
-- Depends on: 018_create_attendance.sql, 020_harden_attendance_capability_
--             checks.sql, 023_add_authenticated_attendance_checkout.sql
-- ============================================================================

-- ── 1. New nullable columns ──────────────────────────────────────────────
alter table public.attendance_records
  add column if not exists checkin_latitude   double precision,
  add column if not exists checkin_longitude  double precision,
  add column if not exists checkout_latitude  double precision,
  add column if not exists checkout_longitude double precision;

comment on column public.attendance_records.checkin_latitude is
  'Device GPS latitude captured once at check-in, if the app had location permission. Null for every record created before this migration, and for any check-in where the worker denied/lacked location access — GPS is never required to check in.';
comment on column public.attendance_records.checkin_longitude is
  'Paired with checkin_latitude — see that column''s comment.';
comment on column public.attendance_records.checkout_latitude is
  'Device GPS latitude captured once at check-out, if the app had location permission. Independent of checkin_latitude — a worker can check out from a different spot on site.';
comment on column public.attendance_records.checkout_longitude is
  'Paired with checkout_latitude — see that column''s comment.';

-- ── 2. attendance_checkin — new 9-arg overload (was 7) ───────────────────
create or replace function public.attendance_checkin(
  p_token       text,
  p_name        text,
  p_company     text default '',
  p_trade       text default '',
  p_mobile      text default '',
  p_worker_type text default 'subcontractor',
  p_notes       text default '',
  p_latitude    double precision default null,
  p_longitude   double precision default null
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
    notes, checked_in_by, created_by,
    checkin_latitude, checkin_longitude
  ) values (
    v_organisation_id, v_project_id, v_token_id,
    v_name, trim(coalesce(p_company, '')), trim(coalesce(p_trade, '')), v_mobile_norm,
    coalesce(nullif(trim(p_worker_type), ''), 'subcontractor'),
    trim(coalesce(p_notes, '')), 'self', null,
    p_latitude, p_longitude
  )
  returning * into v_new;

  return query select
    v_new.id, v_new.name, v_new.trade, v_new.company,
    v_new.worker_type, v_new.time_in, false, v_project_name, v_site_address;
end;
$$;

comment on function public.attendance_checkin(text, text, text, text, text, text, text, double precision, double precision) is
  'GPS-capturing overload for the BIK Field mobile app — identical to attendance_checkin(text,text,text,text,text,text,text) except it also stores an optional device location against the new record. Both overloads coexist; see this migration''s header for why. Anonymous-callable, same as the original.';

revoke all on function public.attendance_checkin(text, text, text, text, text, text, text, double precision, double precision) from public;
grant execute on function public.attendance_checkin(text, text, text, text, text, text, text, double precision, double precision) to anon, authenticated;

-- ── 3. attendance_checkout — new 5-arg overload (was 3) ──────────────────
create or replace function public.attendance_checkout(
  p_record_id uuid,
  p_token     text,
  p_notes     text default null,
  p_latitude  double precision default null,
  p_longitude double precision default null
)
returns table (
  id uuid, name text, time_out timestamptz, hours_on_site numeric, project_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row        public.attendance_records%rowtype;
  v_project_id uuid;
  v_project_name text;
begin
  if p_token is null or trim(p_token) = '' then
    raise exception 'This check-out link is missing its site token. Please ask the site supervisor for an updated link.'
      using errcode = 'P0002';
  end if;

  select t.project_id into v_project_id
  from public.project_checkin_tokens t
  where t.token = p_token
    and t.revoked_at is null;

  if v_project_id is null then
    raise exception 'This check-out link is no longer valid. Please ask the site supervisor for an updated link.'
      using errcode = 'P0002';
  end if;

  select * into v_row
  from public.attendance_records ar
  where ar.id = p_record_id
    and ar.project_id = v_project_id;

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
      status = 'checked-out',
      checkout_latitude = p_latitude,
      checkout_longitude = p_longitude
  where ar.id = p_record_id
  returning * into v_row;

  select p.name into v_project_name from public.projects p where p.id = v_row.project_id;

  return query select v_row.id, v_row.name, v_row.time_out, v_row.hours_on_site, v_project_name;
end;
$$;

comment on function public.attendance_checkout(uuid, text, text, double precision, double precision) is
  'GPS-capturing overload for the BIK Field mobile app — identical to attendance_checkout(uuid,text,text) except it also stores an optional device location at checkout. Both overloads coexist; see this migration''s header for why. Anonymous-callable, same token-scoped authorisation as the original.';

revoke all on function public.attendance_checkout(uuid, text, text, double precision, double precision) from public;
grant execute on function public.attendance_checkout(uuid, text, text, double precision, double precision) to anon, authenticated;

-- ── 4. attendance_checkout_authenticated — new 4-arg overload (was 2) ────
create or replace function public.attendance_checkout_authenticated(
  p_record_id uuid,
  p_notes     text default null,
  p_latitude  double precision default null,
  p_longitude double precision default null
)
returns table (
  id uuid, name text, time_out timestamptz, hours_on_site numeric, project_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id       uuid;
  v_old          public.attendance_records%rowtype;
  v_new          public.attendance_records%rowtype;
  v_project_name text;
begin
  v_org_id := internal.current_organisation_id();
  if v_org_id is null then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  select * into v_old
  from public.attendance_records ar
  where ar.id = p_record_id
    and ar.organisation_id = v_org_id
  for update;

  if not found then
    raise exception 'Attendance record not found.' using errcode = 'P0002';
  end if;
  if v_old.status = 'voided' then
    raise exception 'This sign-in record has been voided by the site supervisor.' using errcode = 'P0002';
  end if;
  if v_old.time_out is not null then
    raise exception 'This record has already been signed out.' using errcode = 'P0002';
  end if;

  update public.attendance_records ar
  set time_out = now(),
      notes = case when p_notes is not null and trim(p_notes) != '' then trim(p_notes) else ar.notes end,
      status = 'checked-out',
      checkout_latitude = p_latitude,
      checkout_longitude = p_longitude
  where ar.id = p_record_id
  returning * into v_new;

  insert into public.attendance_audit_log (attendance_record_id, changed_by_user_id, source, reason, changes)
  values (
    p_record_id, auth.uid(), 'dashboard checkout',
    coalesce(nullif(trim(p_notes), ''), 'Checked out via builder dashboard'),
    jsonb_build_array(
      jsonb_build_object('field', 'status', 'from', v_old.status, 'to', 'checked-out'),
      jsonb_build_object('field', 'checkout_location', 'from', null, 'to', case when p_latitude is not null then jsonb_build_object('lat', p_latitude, 'lng', p_longitude) else null end)
    )
  );

  select p.name into v_project_name from public.projects p where p.id = v_new.project_id;

  return query select v_new.id, v_new.name, v_new.time_out, v_new.hours_on_site, v_project_name;
end;
$$;

comment on function public.attendance_checkout_authenticated(uuid, text, double precision, double precision) is
  'GPS-capturing overload for the BIK Field mobile app''s own authenticated self-checkout — identical to attendance_checkout_authenticated(uuid,text) except it also stores an optional device location and includes it in the audit log entry. Both overloads coexist; see this migration''s header for why.';

revoke all on function public.attendance_checkout_authenticated(uuid, text, double precision, double precision) from public, anon;
grant execute on function public.attendance_checkout_authenticated(uuid, text, double precision, double precision) to authenticated;

-- ── Reviewer checklist before applying ───────────────────────────────────
-- [ ] Confirm attendance_audit_log's actual column names/types match the
--     insert above (copied from 023's own insert — re-verify against the
--     live schema before applying, in case anything has changed since).
-- [ ] Apply to a staging project first if one exists; this repo currently
--     has only one Supabase project (production) — see RELEASE_CHECKLIST.md.
-- [ ] After confirming the mobile app works end-to-end against this
--     migration, schedule a follow-up migration to DROP the three old
--     (pre-GPS) overloads, once satisfied nothing else still calls them.
