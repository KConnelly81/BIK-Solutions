-- ============================================================================
-- Migration: 023_add_authenticated_attendance_checkout.sql
-- Purpose:   attendance.html's own "Quick check-out" button (the builder/
--            admin dashboard's doCheckout(id)) calls the SAME
--            public.attendance_checkout(...) RPC as the anonymous
--            worker-facing capability-link flow (checkout.html), via the
--            shared attendanceCheckOut() wrapper in
--            js/toolkit/attendance-rpc.js. That wrapper always includes
--            p_token as a named key (null when the caller has none), so
--            since 020 added the token-scoped attendance_checkout(uuid,
--            text, text) overload, every dashboard quick-checkout call
--            has been resolving to that NEW overload instead of the old
--            id-only one -- and failing with "This check-out link is
--            missing its site token", because the authenticated builder
--            never had a project token to supply in the first place.
--            Confirmed live in production (2026-09-05): the dashboard's
--            checkout button returned exactly that error.
--
--            The old, unhardened 2-arg attendance_checkout(uuid, text) is
--            not a fix either -- it has zero authorisation beyond "the
--            record exists" (grantable to anon and authenticated alike),
--            which is the very capability-link exposure 020 exists to
--            close, and it is scheduled for removal in 022 regardless.
--
--            This migration adds a THIRD, distinct function --
--            attendance_checkout_authenticated(p_record_id, p_notes) --
--            for the authenticated dashboard path specifically. It needs
--            no project token at all: like attendance_edit()/
--            attendance_void() (both already authenticated-only,
--            org-scoped via internal.current_organisation_id()), it
--            authorises the caller by their own organisation membership,
--            not by capability-link possession. It currently applies the
--            same checkout validation (voided / already-signed-out
--            rejection) and the same field updates (time_out, notes,
--            status) as the worker-facing attendance_checkout(uuid,
--            text, text) -- the logic is duplicated, not shared, so the
--            two can drift apart if one is changed without the other;
--            they only differ today in how the caller is authorised.
--            Also writes an attendance_audit_log entry, matching
--            attendance_edit/attendance_void (the anonymous
--            worker checkout does not, and still doesn't -- there is no
--            authenticated actor to attribute it to).
--
--            js/toolkit/attendance-rpc.js gains a new
--            attendanceCheckOutAuthenticated() wrapper, and
--            attendance.html's doCheckout() is switched to call it
--            instead of the anonymous-capability attendanceCheckOut().
--            checkout.html (the actual worker-facing anonymous flow) is
--            untouched -- it already calls attendanceCheckOut() with a
--            real token and continues to.
--
-- Phase:     6 (Site Attendance — hardening follow-up)
-- Depends on: 018_create_attendance.sql (attendance_records,
--             attendance_audit_log, internal.current_organisation_id),
--             020_harden_attendance_capability_checks.sql (the
--             token-scoped attendance_checkout this is NOT a replacement
--             for -- both coexist, serving different callers)
-- ============================================================================

create or replace function public.attendance_checkout_authenticated(
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
  set time_out   = now(),
      notes      = case when p_notes is not null and trim(p_notes) != '' then trim(p_notes) else ar.notes end,
      status     = 'checked-out',
      updated_by = auth.uid()
  where ar.id = p_record_id
  returning * into v_new;

  insert into public.attendance_audit_log (attendance_record_id, changed_by_user_id, source, reason, changes)
  values (
    p_record_id, auth.uid(), 'dashboard checkout',
    coalesce(nullif(trim(p_notes), ''), 'Checked out via builder dashboard'),
    jsonb_build_array(jsonb_build_object('field', 'status', 'from', v_old.status, 'to', 'checked-out'))
  );

  select p.name into v_project_name from public.projects p where p.id = v_new.project_id;

  return query select v_new.id, v_new.name, v_new.time_out, v_new.hours_on_site, v_project_name;
end;
$$;

comment on function public.attendance_checkout_authenticated(uuid, text) is
  'Authenticated-only builder/admin quick-checkout from attendance.html''s dashboard. Distinct from the anonymous, token-scoped public.attendance_checkout(uuid, text, text) used by the worker capability-link flow (checkout.html) -- this caller has an authenticated session instead of a project token, so it is authorised via internal.current_organisation_id() (same pattern as attendance_edit/attendance_void), never a token. Same checkout validation and field updates as attendance_checkout(uuid, text, text). Writes an attendance_audit_log entry (source=''dashboard checkout''), matching attendance_edit/attendance_void.';

revoke all on function public.attendance_checkout_authenticated(uuid, text) from public, anon;
grant execute on function public.attendance_checkout_authenticated(uuid, text) to authenticated;

comment on table public.attendance_audit_log is
  'Append-only correction/action history for attendance_records. Written only by attendance_edit()/attendance_void()/attendance_checkout_authenticated() (all SECURITY DEFINER) -- never directly insertable by any client role. The anonymous, token-scoped attendance_checkout(uuid, text, text) does not write here (no authenticated actor to attribute an entry to).';
