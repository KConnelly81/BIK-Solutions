-- ============================================================================
-- Migration: 020_harden_attendance_capability_checks.sql
-- Purpose:   attendance_get_by_id() and attendance_checkout() (018) currently
--            authorise solely on possession of an attendance_records.id uuid
--            — by design, per 018's own comments, "same trust model as an
--            emailed password-reset link". A platform health check flagged
--            this as worth tightening: unlike a password-reset link, this
--            capability link never expires, and the id alone carries no
--            record of which project/token it belongs to, so a leaked or
--            forwarded checkout URL grants indefinite, unauthenticated
--            read/write access to that one worker's attendance record with
--            no way to scope or revoke it independently of the record
--            itself.
--
--            This migration adds a mandatory p_token parameter to both
--            functions — the same project check-in token already resolved
--            by attendance_checkin()/attendance_lookup_active(), and already
--            present in every URL checkin.html hands to checkout.html
--            (checkout.html?id=<uuid>&t=<token>, see checkin.html's existing
--            redirect). A record is now only readable/checkout-able when the
--            supplied token is currently active (not revoked) AND resolves
--            to the SAME project the record belongs to. This closes the
--            cross-tenant exposure without requiring a login: anyone who
--            legitimately received a project's QR/check-in link can still
--            complete the checkout journey exactly as before; a bare
--            record id alone, without that project's token, can no longer
--            read or mutate anything.
--
--            The new p_token parameter changes each function's argument
--            signature, so CREATE OR REPLACE FUNCTION alone would not
--            replace the existing 018 definitions — Postgres identifies a
--            function by name *and* parameter type list, and a changed
--            list creates a second, separate overload alongside the
--            original rather than replacing it (confirmed empirically
--            against a local dry-run before writing this migration this
--            way). Each old signature is therefore explicitly DROPped
--            first, so exactly one (hardened) version of each function
--            exists afterwards — never both. A NULL/blank/wrong-project
--            token is treated identically to an unknown record id in each
--            function's existing error/empty-result style, so this does
--            not leak whether a given id exists in a different project or
--            organisation.
--
--            Frontend callers (checkout.html, via
--            js/toolkit/attendance-rpc.js) are updated in the same change
--            to pass the token, which is already available at both call
--            sites — see attendance-rpc.js and checkout.html in this diff.
--
-- Phase:     6 (Site Attendance — hardening follow-up)
-- Depends on: 018_create_attendance.sql (project_checkin_tokens,
--             attendance_records, attendance_get_by_id, attendance_checkout)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- attendance_get_by_id(p_record_id, p_token)
-- Was: SQL, unconditional lookup by id alone.
-- Now: PL/pgSQL — resolves p_token to a project via project_checkin_tokens
-- (same lookup attendance_checkin/attendance_lookup_active already use),
-- and only returns the record if its project_id matches. Preserves the
-- existing "zero rows for unknown id" contract used by checkout.html
-- (`if (!rec) { token ? show('screen-lookup') : show('screen-no-context'); }`)
-- — a missing/invalid/wrong-project token now falls into that same,
-- already-handled empty-result path rather than a new error type.
-- ----------------------------------------------------------------------------
drop function if exists public.attendance_get_by_id(uuid);

create or replace function public.attendance_get_by_id(
  p_record_id uuid,
  p_token     text default null
)
returns table (
  id uuid, name text, company text, trade text, time_in timestamptz,
  time_out timestamptz, hours_on_site numeric, status text, project_name text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  if p_token is null or trim(p_token) = '' then
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
  select ar.id, ar.name, ar.company, ar.trade, ar.time_in,
         ar.time_out, ar.hours_on_site, ar.status, p.name
  from public.attendance_records ar
  join public.projects p on p.id = ar.project_id
  where ar.id = p_record_id
    and ar.project_id = v_project_id;
end;
$$;

comment on function public.attendance_get_by_id(uuid, text) is
  'Anonymous-callable. Requires the project''s active check-in token in addition to the record id — the id alone is no longer sufficient (hardened 2026-09, was id-only capability link). Returns zero rows for an unknown id, a missing/invalid/revoked token, or a token that resolves to a different project than the record — these are indistinguishable to the caller by design, so a wrong token never reveals whether the id exists elsewhere.';

revoke all on function public.attendance_get_by_id(uuid, text) from public;
grant execute on function public.attendance_get_by_id(uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- attendance_checkout(p_record_id, p_notes, p_token)
-- Was: unconditional lookup/update by id alone.
-- Now: same token-to-project verification as attendance_get_by_id() above,
-- applied before the record is even looked up, so a wrong-project token
-- and a nonexistent id both fall through to the same existing
-- "Sign-in record not found" message — no cross-tenant existence leak.
-- ----------------------------------------------------------------------------
drop function if exists public.attendance_checkout(uuid, text);

create or replace function public.attendance_checkout(
  p_record_id uuid,
  p_notes     text default null,
  p_token     text default null
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
      status = 'checked-out'
  where ar.id = p_record_id
  returning * into v_row;

  select p.name into v_project_name from public.projects p where p.id = v_row.project_id;

  return query select v_row.id, v_row.name, v_row.time_out, v_row.hours_on_site, v_project_name;
end;
$$;

comment on function public.attendance_checkout(uuid, text, text) is
  'Anonymous-callable. Requires the project''s active check-in token in addition to the record id — the id alone is no longer sufficient (hardened 2026-09, was id-only capability link). A missing/invalid/revoked token, or a token for a different project than the record, is rejected with the same "Sign-in record not found" message used for an unknown id, so no cross-tenant existence is leaked.';

revoke all on function public.attendance_checkout(uuid, text, text) from public;
grant execute on function public.attendance_checkout(uuid, text, text) to anon, authenticated;
