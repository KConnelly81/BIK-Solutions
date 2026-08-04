/**
 * Thin wrappers around the Site Attendance Supabase RPCs
 * (supabase/migrations/018_create_attendance.sql). Used by checkin.html,
 * checkout.html (both anonymous — no auth session), and attendance.html
 * (authenticated builder dashboard).
 *
 * Each function returns `{ data, error }` (never throws for an expected
 * RPC rejection — Supabase surfaces those as `error`, not a thrown
 * exception) so callers can show friendly text without a try/catch around
 * every call. `error.message` is already the human-readable text raised
 * by the database function (see the migration's RAISE EXCEPTION messages).
 */

import { supabase } from '../supabase/client.js';

export async function resolveCheckinToken(token) {
  const { data, error } = await supabase.rpc('resolve_checkin_token', { p_token: token });
  if (error) return { data: null, error };
  return { data: data && data[0] ? data[0] : null, error: null };
}

export async function attendanceCheckIn({ token, name, company, trade, mobile, workerType, notes }) {
  const { data, error } = await supabase.rpc('attendance_checkin', {
    p_token: token,
    p_name: name,
    p_company: company || '',
    p_trade: trade || '',
    p_mobile: mobile || '',
    p_worker_type: workerType || 'subcontractor',
    p_notes: notes || '',
  });
  if (error) return { data: null, error };
  return { data: data && data[0] ? data[0] : null, error: null };
}

export async function attendanceLookupActive(token, name, mobile) {
  const { data, error } = await supabase.rpc('attendance_lookup_active', {
    p_token: token,
    p_name: name || '',
    p_mobile: mobile || '',
  });
  return { data: data || [], error };
}

export async function attendanceGetById(recordId) {
  const { data, error } = await supabase.rpc('attendance_get_by_id', { p_record_id: recordId });
  if (error) return { data: null, error };
  return { data: data && data[0] ? data[0] : null, error: null };
}

export async function attendanceCheckOut(recordId, notes) {
  const { data, error } = await supabase.rpc('attendance_checkout', {
    p_record_id: recordId,
    p_notes: notes || null,
  });
  if (error) return { data: null, error };
  return { data: data && data[0] ? data[0] : null, error: null };
}

export async function getOrCreateCheckinToken(projectId) {
  return supabase.rpc('get_or_create_checkin_token', { p_project_id: projectId });
}

export async function rotateCheckinToken(projectId) {
  return supabase.rpc('rotate_checkin_token', { p_project_id: projectId });
}

export async function attendanceEdit(recordId, patch, reason) {
  const { data, error } = await supabase.rpc('attendance_edit', {
    p_record_id: recordId,
    p_name: patch.name,
    p_company: patch.company,
    p_trade: patch.trade,
    p_mobile: patch.mobile,
    p_worker_type: patch.workerType,
    p_time_in: patch.timeIn,
    p_time_out: patch.timeOut,
    p_break_minutes: patch.breakMinutes,
    p_notes: patch.notes,
    p_reason: reason,
  });
  if (error) return { data: null, error };
  return { data, error: null };
}

export async function attendanceVoid(recordId, reason) {
  const { data, error } = await supabase.rpc('attendance_void', {
    p_record_id: recordId,
    p_reason: reason,
  });
  if (error) return { data: null, error };
  return { data, error: null };
}

/** Turns a raised database message into text safe to show a worker/builder. */
export function friendlyAttendanceError(error) {
  if (!error) return 'Something went wrong. Please try again.';
  return error.message || String(error);
}
