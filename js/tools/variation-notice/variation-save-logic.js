/**
 * Variation Notice — Save Logic (Sprint 3)
 *
 * Pure functions only: no DOM, no network, no imports of anything that
 * touches `window`/`document`/Supabase. This is what makes them plain-Node
 * unit testable (see js/tools/variation-notice/__tests__/
 * variation-save-logic.test.js) without a browser or a live project.
 * js/tools/variation-notice/supabase-integration.js is the DOM/network
 * layer that calls these.
 *
 * Design constraints these functions exist to enforce (see
 * supabase/migrations/011_variation_notice_number_generator.sql and the
 * Sprint 3 requirements):
 *   - Never generate, predict, or reformat a variation number client-side.
 *     buildRpcParams() passes a typed value through exactly as trimmed;
 *     the database alone decides whether it's normalised or kept custom.
 *   - Never surface a raw database/auth error to the user.
 *     friendlyVariationError() only ever returns one of the RPC's own
 *     known-safe messages or a generic fallback — never anything naming
 *     an internal schema, function, or constraint.
 */

// ── Money ────────────────────────────────────────────────────────

/** Dollars (string/number, as typed in the form) -> integer cents. Never negative, never NaN. */
export function dollarsToCents(value) {
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/** Integer cents -> dollars (number), the inverse of dollarsToCents, for display. */
export function centsToDollars(cents) {
  const n = Number(cents);
  return Number.isFinite(n) ? n / 100 : 0;
}

// ── RPC / table payloads ─────────────────────────────────────────

/**
 * Builds the parameter object for public.create_variation_notice(). The
 * database — not this function — decides what a blank/typed
 * variation_number becomes; p_variation_number is passed through exactly
 * as trimmed, never computed or reformatted here.
 */
export function buildRpcParams(state, projectId) {
  const trimmedNumber = String(state.variationNumber ?? '').trim();
  return {
    p_project_id: projectId,
    p_client_name: state.clientName || '',
    p_reason_for_variation: state.reasonForVariation || '',
    p_description_of_work: state.descriptionOfWork || '',
    p_cost_excl_gst_cents: dollarsToCents(state.additionalCost),
    p_client_email: state.clientEmail || null,
    p_site_address: state.siteAddress || null,
    p_contract_reference: state.contractRef || null,
    p_requested_by: state.requestedBy || null,
    p_exclusions_assumptions: state.exclusionsAssumptions || null,
    p_materials_required: state.materialsRequired || null,
    p_labour_required: state.labourRequired || null,
    p_gst_applicable: state.gstApplicable === 'yes',
    p_cost_type: state.costType || 'fixed',
    p_extension_of_time_days: parseInt(state.extensionOfTime, 10) || 0,
    p_revised_completion_date: state.revisedCompletionDate || null,
    p_payment_terms: state.paymentTerms || '14days-approval',
    p_builder_notes: state.builderNotes || null,
    p_builder_approval_name: state.builderApprovalName || null,
    p_client_approval_name: state.clientApprovalName || null,
    p_variation_number: trimmedNumber || null
  };
}

/**
 * Builds the payload for a plain authenticated UPDATE against an
 * already-created row (second and later "Save to project" clicks in the
 * same session). Deliberately excludes variation_number entirely — there
 * is no reassignment-on-UPDATE path in the database (011's "NOT built"),
 * and this function must not invent one client-side.
 */
export function buildUpdatePayload(state) {
  return {
    client_name: state.clientName || '',
    client_email: state.clientEmail || null,
    site_address: state.siteAddress || null,
    contract_reference: state.contractRef || null,
    requested_by: state.requestedBy || null,
    reason_for_variation: state.reasonForVariation || '',
    description_of_work: state.descriptionOfWork || '',
    exclusions_assumptions: state.exclusionsAssumptions || null,
    materials_required: state.materialsRequired || null,
    labour_required: state.labourRequired || null,
    cost_excl_gst_cents: dollarsToCents(state.additionalCost),
    gst_applicable: state.gstApplicable === 'yes',
    cost_type: state.costType || 'fixed',
    extension_of_time_days: parseInt(state.extensionOfTime, 10) || 0,
    revised_completion_date: state.revisedCompletionDate || null,
    payment_terms: state.paymentTerms || '14days-approval',
    builder_notes: state.builderNotes || null,
    builder_approval_name: state.builderApprovalName || null,
    client_approval_name: state.clientApprovalName || null
  };
}

// ── Validation ───────────────────────────────────────────────────

/**
 * Lightweight, pre-flight check mirroring exactly what
 * create_variation_notice() itself requires (client name, reason,
 * description, a valid cost) — deliberately not the full form's
 * engine.validate(), which also enforces fields the RPC never receives
 * (e.g. builderName, dateIssued) and would block a legitimate save on
 * unrelated, PDF-only fields. Returns null when valid, or the same
 * wording the RPC would itself raise, so the message is consistent
 * whichever path catches the problem first.
 */
export function validateForSave(state) {
  if (!String(state.clientName || '').trim()) return 'Client name is required.';
  if (!String(state.reasonForVariation || '').trim()) return 'Reason for variation is required.';
  if (!String(state.descriptionOfWork || '').trim()) return 'Description of work is required.';
  const cost = parseFloat(state.additionalCost);
  if (!Number.isFinite(cost) || cost < 0) return 'A valid cost (0 or greater) is required.';
  return null;
}

// ── Error translation ────────────────────────────────────────────

// Messages create_variation_notice() itself is written to raise — already
// clean, safe to show verbatim (see supabase/migrations/
// 011_variation_notice_number_generator.sql). Anything not matching one of
// these, or one of the auth/RLS cases handled explicitly below, is an
// unexpected error and must never be shown verbatim: it could be a raw
// Postgres message naming an internal schema, function, or constraint.
const SAFE_RPC_MESSAGE_PATTERNS = [
  /^Client name is required\.$/,
  /^Reason for variation is required\.$/,
  /^Description of work is required\.$/,
  /^A valid cost \(0 or greater\) is required\.$/,
  /^A variation numbered ".*" already exists for this project\. Choose a different number\.$/,
  /^Could not allocate a variation number after \d+ attempts? — please try again\.$/
];

/**
 * Translates an error from create_variation_notice() / a direct table
 * UPDATE / the project lookup into safe, user-facing text. Never passes
 * an unrecognised message through — the caller is expected to log the
 * original error for diagnosis; this function only ever returns text
 * that is safe to render, matching the "no internal details in error
 * messages" requirement.
 */
export function friendlyVariationError(error) {
  const message = error?.message || String(error || '');

  if (/Project not found in your organisation/i.test(message)) {
    return 'This project could not be found in your organisation.';
  }
  if (/Authentication required, or your account has no active organisation/i.test(message)) {
    return 'Your session has expired — please sign in again.';
  }
  if (/JWT|refresh_token|invalid.*token/i.test(message)) {
    return 'Your session has expired — please sign in again.';
  }
  if (SAFE_RPC_MESSAGE_PATTERNS.some((re) => re.test(message))) {
    return message;
  }

  return 'Something went wrong saving this variation. Please try again.';
}

// ── Project snapshot ─────────────────────────────────────────────

/**
 * One-time client/project snapshot, derived from a Supabase project row
 * (with an optionally embedded customer). Returns only the fields that
 * have a clear source column — never invents a value. Caller decides
 * whether to apply each field (e.g. skip a field the user has already
 * started typing into).
 */
export function deriveClientSnapshot(project) {
  const customer = project?.customers || null;
  const clientName = customer
    ? (customer.business_name || [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim())
    : '';
  return {
    clientName: clientName || '',
    clientEmail: customer?.email || '',
    projectName: project?.name || '',
    siteAddress: project?.site_address || ''
  };
}
