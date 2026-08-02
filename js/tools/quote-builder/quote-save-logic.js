/**
 * Quote Builder — Save Logic (Sprint 5a)
 *
 * Pure functions only: no DOM, no network, no imports of anything that
 * touches `window`/`document`/Supabase — see
 * js/tools/quote-builder/__tests__/quote-save-logic.test.js. Mirrors
 * js/tools/variation-notice/variation-save-logic.js's shape and the same
 * two design constraints:
 *   - Never generate, predict, or reformat quote_number client-side.
 *     buildCreatePayload() passes a typed value through exactly as
 *     trimmed; the database alone decides whether it's normalised or kept
 *     custom (013's assign_quote_number()).
 *   - Never surface a raw database/auth error to the user.
 *     friendlyQuoteError() only returns one of the backend's own
 *     known-safe messages or a generic fallback.
 *
 * Backend: supabase/migrations/012_create_quotes.sql (table, core layer),
 * 013_create_quote_numbering.sql (create_quote()), 014_create_quote_issue_
 * workflow.sql (issue_quote()). create_quote() only accepts a minimal
 * header subset on creation (project id, client snapshot, quote_number) —
 * unlike create_variation_notice() (011), which accepts every field at
 * once — so buildHeaderPayload() is reused both as the immediate
 * create-then-backfill follow-up (wireSaveButton()'s
 * buildCreateFollowUpPayload) and as every later save's plain UPDATE.
 */

import { dollarsToCents } from '../../toolkit/calculator.js';

// ── RPC / table payloads ─────────────────────────────────────────

/**
 * Params for public.create_quote() — deliberately minimal: only what the
 * RPC itself accepts (project id, client snapshot, an optional manual
 * quote_number). Every other header field is applied by an immediate
 * follow-up UPDATE using buildHeaderPayload() — see the module header.
 */
export function buildCreatePayload(state, projectId) {
  const trimmedNumber = String(state.quoteNumber ?? '').trim();
  return {
    p_project_id: projectId,
    p_client_name: state.clientName || '',
    p_client_email: state.clientEmail || null,
    p_client_phone: state.clientPhone || null,
    p_client_address: state.clientAddress || null,
    p_quote_number: trimmedNumber || null
  };
}

/**
 * Payload for a plain authenticated UPDATE — every quotes column
 * authenticated is granted UPDATE on except quote_number (excluded here:
 * no reassignment-on-UPDATE path exists — see 012's grant comment — this
 * function must not invent one client-side) and gst_rate (platform
 * default, not user-editable in this form). Used both for the
 * create-then-backfill follow-up and for every later "Save to project"
 * click.
 */
export function buildHeaderPayload(state) {
  return {
    client_name: state.clientName || '',
    client_email: state.clientEmail || null,
    client_phone: state.clientPhone || null,
    client_address: state.clientAddress || null,
    quote_date: state.quoteDate || undefined,
    valid_until: state.validUntil || null,
    quote_type: state.quoteType || null,
    scope_of_works: state.scopeOfWorks || null,
    inclusions: state.inclusions || null,
    exclusions: state.exclusions || null,
    assumptions: state.assumptions || null,
    optional_items: state.optionalItems || null,
    deposit_percent: state.depositPercent !== '' && state.depositPercent != null
      ? parseInt(state.depositPercent, 10)
      : null,
    payment_terms: state.paymentTerms || null,
    additional_terms: state.additionalTerms || null,
    builder_approval_name: state.builderApprovalName || null
  };
}

/**
 * One row for quote_line_items from one LineItemsEditor item + its 0-based
 * position (see js/toolkit/supabase-line-items.js's syncLineItems()).
 * line_total_cents/gst_cents are never sent — server-computed on every
 * insert (012's compute_quote_line_item_amounts()), any value sent here
 * would be silently overwritten anyway.
 */
export function mapLineItemToRow(item, index) {
  return {
    position: index + 1,
    description: item.description || '',
    quantity: item.qty || 0,
    unit: item.unit || null,
    unit_price_cents: dollarsToCents(item.unitPrice),
    gst_applicable: !!item.gst
  };
}

// ── Validation ───────────────────────────────────────────────────

/** Pre-flight check for "Save to project" — mirrors create_quote()'s own minimal requirement. */
export function validateForSave(state) {
  if (!String(state.clientName || '').trim()) return 'Client name is required.';
  return null;
}

/**
 * Pre-flight check for "Issue quote", mirroring 014's
 * enforce_quote_status_transition() requirement chain exactly, in the same
 * order, so a user sees one clear message instead of a round-trip failure
 * for an obviously-incomplete quote. `lineItemCount` is the current
 * LineItemsEditor row count with a non-blank description (matching what
 * will actually be synced — see supabase-integration.js).
 */
export function validateForIssue(state, lineItemCount) {
  if (!state.quoteType) return 'Quote type (fixed/estimate/cost-plus) is required before a quote can be issued.';
  if (!state.validUntil) return 'A valid-until date is required before a quote can be issued.';
  if (state.quoteDate && state.validUntil < state.quoteDate) return 'Valid-until date cannot be before the quote date.';
  if (!String(state.clientName || '').trim()) return 'Client name is required before a quote can be issued.';
  if (!String(state.clientEmail || '').trim()) return 'Client email is required before a quote can be issued.';
  if (!lineItemCount) return 'At least one line item is required before a quote can be issued.';
  return null;
}

// ── Error translation ────────────────────────────────────────────

// Messages create_quote()/issue_quote() are themselves written to raise —
// already clean, safe to show verbatim. Anything else is unexpected and
// must never be shown verbatim.
const SAFE_MESSAGE_PATTERNS = [
  /^A quote numbered ".*" already exists for your organisation\. Choose a different number\.$/,
  /^Could not allocate a quote number after \d+ attempts? — please try again\.$/,
  /^Quote type \(fixed\/estimate\/cost-plus\) is required before a quote can be issued\.$/,
  /^A valid-until date is required before a quote can be issued\.$/,
  /^Valid-until date cannot be before the quote date\.$/,
  /^Client name is required before a quote can be issued\.$/,
  /^Client email is required before a quote can be issued\.$/,
  /^At least one line item is required before a quote can be issued\.$/,
  /^This quote has been issued and can no longer be changed\. Status: .*\.$/,
  /^Line items cannot be changed once the quote has been issued\.$/
];

export function friendlyQuoteError(error) {
  const message = error?.message || String(error || '');

  if (/Project not found in your organisation/i.test(message)) {
    return 'This project could not be found in your organisation.';
  }
  if (/Quote not found in your organisation/i.test(message)) {
    return 'This quote could not be found in your organisation.';
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

  return 'Something went wrong saving this quote. Please try again.';
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
