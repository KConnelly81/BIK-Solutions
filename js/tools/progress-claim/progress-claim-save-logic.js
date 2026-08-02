/**
 * Progress Claim — Save Logic (Sprint 5a)
 *
 * Pure functions only: no DOM, no network — see
 * js/tools/progress-claim/__tests__/progress-claim-save-logic.test.js.
 * Same two design constraints as quote-save-logic.js:
 *   - Never generate, predict, or reformat claim_number client-side.
 *   - Never surface a raw database/auth error to the user.
 *
 * Backend: supabase/migrations/015_create_progress_claims.sql (table, core
 * layer), 016_create_progress_claim_numbering.sql (create_progress_claim()),
 * 017_create_progress_claim_issue_workflow.sql (issue_progress_claim() —
 * BLOCKED: every draft -> issued attempt is unconditionally rejected
 * pending accounting/contract confirmation, checked first in the trigger,
 * ahead of every other validation). Deliberately no validateForIssue()
 * here, unlike quote-save-logic.js's: pre-validating client-side would be
 * guessing about data the server's rejection doesn't even look at — the
 * gate fires before any per-field check runs. Every click that reaches the
 * RPC at all gets the real, current, correctly-worded BLOCKED message back
 * from the server, not a client-side approximation of it.
 */

import { dollarsToCents } from '../../toolkit/calculator.js';

// ── RPC / table payloads ─────────────────────────────────────────

/** Params for public.create_progress_claim() — deliberately minimal, mirrors buildCreatePayload() in quote-save-logic.js. */
export function buildCreatePayload(state, projectId) {
  const trimmedNumber = String(state.claimNumber ?? '').trim();
  return {
    p_project_id: projectId,
    p_client_name: state.clientName || '',
    p_client_email: state.clientEmail || null,
    p_contract_ref: state.contractRef || null,
    p_claim_number: trimmedNumber || null
  };
}

/**
 * Derives the retention_rate fraction (0 <= rate < 1) the database
 * expects from the legacy tool's percent-select-or-custom-dollar UI.
 * "custom" is back-computed as an effective rate from the entered dollar
 * amount over this claim's total — the database only ever stores a rate
 * (retention_amount_cents is always server-derived from it,
 * compute_progress_claim_derived_totals(), 015), there is no raw-dollar
 * retention override column to send instead.
 */
export function deriveRetentionRate(state) {
  if (state.retentionRate === 'custom') {
    const claim = parseFloat(state.thisClaimAmount) || 0;
    const custom = parseFloat(state.retentionCustom) || 0;
    if (claim <= 0) return 0;
    const rate = custom / claim;
    return Math.min(Math.max(rate, 0), 0.9999);
  }
  const pct = parseFloat(state.retentionRate) || 0;
  return Math.min(Math.max(pct / 100, 0), 0.9999);
}

/**
 * Payload for a plain authenticated UPDATE — every progress_claims column
 * authenticated is granted UPDATE on except claim_number (no
 * reassignment-on-UPDATE path — matches quotes.quote_number's exclusion,
 * 015's grant comment) and gst_rate (platform default, not user-editable
 * in this form). Used both for the create-then-backfill follow-up and
 * every later "Save to project" click.
 */
export function buildHeaderPayload(state) {
  return {
    client_name: state.clientName || '',
    client_email: state.clientEmail || null,
    contract_ref: state.contractRef || null,
    claim_date: state.claimDate || undefined,
    claim_period_from: state.claimPeriodFrom || null,
    claim_period_to: state.claimPeriodTo || null,
    previously_claimed_cents: dollarsToCents(state.previouslyClaimed),
    retention_rate: deriveRetentionRate(state),
    percent_complete: state.percentComplete !== '' && state.percentComplete != null
      ? parseFloat(state.percentComplete)
      : null,
    description_of_work: state.descriptionOfWork || null,
    special_conditions: state.specialConditions || null,
    builder_approval_name: state.builderApprovalName || null,
    client_approval_name: state.clientApprovalName || null
  };
}

/**
 * One row for progress_claim_line_items from one ScheduleOfValuesEditor
 * item + its 0-based position. this_claim_cents/claimed_to_date_cents/
 * remaining_value_cents are never sent — server-computed on every insert
 * (015's compute_progress_claim_line_item_amounts()).
 */
export function mapScheduleItemToRow(item, index) {
  return {
    position: index + 1,
    description: item.description || '',
    contract_value_cents: Math.round((parseFloat(item.contractValue) || 0) * 100),
    previously_claimed_cents: Math.round((parseFloat(item.previouslyClaimed) || 0) * 100),
    this_claim_percent: item.thisClaimPercent === '' || item.thisClaimPercent == null
      ? null
      : parseFloat(item.thisClaimPercent)
  };
}

// ── Validation ───────────────────────────────────────────────────

/** Pre-flight check for "Save to project" — mirrors create_progress_claim()'s own minimal requirement. */
export function validateForSave(state) {
  if (!String(state.clientName || '').trim()) return 'Client name is required.';
  return null;
}

// ── Error translation ────────────────────────────────────────────

const SAFE_MESSAGE_PATTERNS = [
  /^A progress claim numbered ".*" already exists for this project\. Choose a different number\.$/,
  /^Could not allocate a claim number after \d+ attempts? — please try again\.$/,
  /^Progress Claims cannot be issued yet — GST, retention, and overclaiming treatment require accountant\/contract confirmation before this goes live\. Drafts remain fully usable for testing\. See docs\/PHASE_5A_PROGRESS_CLAIMS_MIGRATION_REVIEW\.md\.$/,
  /^This progress claim has been issued and can no longer be changed\. Status: .*\.$/,
  /^Schedule items cannot be changed once the progress claim has been issued\.$/
];

// The interim overclaiming check (progress_claims_totals_non_negative_check,
// 015) is a raw Postgres constraint-violation message — checked explicitly,
// ahead of SAFE_MESSAGE_PATTERNS, and translated to plain language rather
// than shown verbatim, since a bare constraint name is exactly the kind of
// internal detail this function exists to hide.
export function friendlyProgressClaimError(error) {
  const message = error?.message || String(error || '');

  if (/violates check constraint "progress_claims_totals_non_negative_check"/.test(message)) {
    return 'This would claim more than the recognised contract value. Reduce previously claimed or the schedule amounts.';
  }
  if (/Project not found in your organisation/i.test(message)) {
    return 'This project could not be found in your organisation.';
  }
  if (/Progress claim not found in your organisation/i.test(message)) {
    return 'This progress claim could not be found in your organisation.';
  }
  if (/Authentication required, or your account has no active organisation/i.test(message)) {
    return 'Your session has expired — please sign in again.';
  }
  if (/JWT|refresh_token|invalid.*token/i.test(message)) {
    return 'Your session has expired — please sign in again.';
  }
  if (SAFE_MESSAGE_PATTERNS.some((re) => re.test(message))) {
    return message;
  }

  return 'Something went wrong saving this progress claim. Please try again.';
}

// ── Project snapshot ─────────────────────────────────────────────

/** One-time client snapshot from a loaded project (+ optionally embedded customer). */
export function deriveClientSnapshot(project) {
  const customer = project?.customers || null;
  const clientName = customer
    ? (customer.business_name || [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim())
    : '';
  return {
    clientName: clientName || '',
    clientEmail: customer?.email || ''
  };
}
