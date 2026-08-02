/**
 * Unit tests for js/tools/quote-builder/quote-save-logic.js.
 * Pure functions only — no DOM, no network, no live Supabase project.
 * Run with: node --test js/tools/quote-builder/__tests__/quote-save-logic.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCreatePayload,
  buildHeaderPayload,
  mapLineItemToRow,
  validateForSave,
  validateForIssue,
  friendlyQuoteError,
  deriveClientSnapshot
} from '../quote-save-logic.js';

function baseState(overrides = {}) {
  return {
    clientName: 'Jane Smith',
    clientEmail: 'jane@example.com',
    clientPhone: '0400 000 000',
    clientAddress: '1 Test St',
    quoteNumber: '',
    quoteDate: '2026-08-02',
    validUntil: '2026-09-01',
    quoteType: 'fixed',
    scopeOfWorks: 'Kitchen renovation',
    inclusions: '',
    exclusions: '',
    assumptions: '',
    optionalItems: '',
    depositPercent: '10',
    paymentTerms: '14days-invoice',
    additionalTerms: '',
    builderApprovalName: '',
    ...overrides
  };
}

// ── buildCreatePayload ────────────────────────────────────────────

test('buildCreatePayload: blank quote number becomes null (auto-assign), never predicted', () => {
  const params = buildCreatePayload(baseState({ quoteNumber: '' }), 'project-1');
  assert.equal(params.p_quote_number, null);
});

test('buildCreatePayload: whitespace-only quote number also becomes null', () => {
  const params = buildCreatePayload(baseState({ quoteNumber: '   ' }), 'project-1');
  assert.equal(params.p_quote_number, null);
});

test('buildCreatePayload: typed quote number passed through exactly as trimmed, never reformatted', () => {
  const params = buildCreatePayload(baseState({ quoteNumber: '  qt 50  ' }), 'project-1');
  assert.equal(params.p_quote_number, 'qt 50');
});

test('buildCreatePayload: includes project id and client snapshot only (matches create_quote()\'s minimal signature)', () => {
  const params = buildCreatePayload(baseState(), 'project-1');
  assert.deepEqual(Object.keys(params).sort(), [
    'p_client_address', 'p_client_email', 'p_client_phone', 'p_client_name', 'p_project_id', 'p_quote_number'
  ].sort());
  assert.equal(params.p_project_id, 'project-1');
  assert.equal(params.p_client_name, 'Jane Smith');
});

// ── buildHeaderPayload ────────────────────────────────────────────

test('buildHeaderPayload: never includes quote_number (no reassignment-on-UPDATE path)', () => {
  const payload = buildHeaderPayload(baseState());
  assert.equal('quote_number' in payload, false);
});

test('buildHeaderPayload: deposit_percent parsed to an integer', () => {
  const payload = buildHeaderPayload(baseState({ depositPercent: '25' }));
  assert.equal(payload.deposit_percent, 25);
  assert.equal(typeof payload.deposit_percent, 'number');
});

test('buildHeaderPayload: blank deposit_percent becomes null, not NaN or 0', () => {
  const payload = buildHeaderPayload(baseState({ depositPercent: '' }));
  assert.equal(payload.deposit_percent, null);
});

test('buildHeaderPayload: maps quote_type/valid_until/scope_of_works through', () => {
  const payload = buildHeaderPayload(baseState());
  assert.equal(payload.quote_type, 'fixed');
  assert.equal(payload.valid_until, '2026-09-01');
  assert.equal(payload.scope_of_works, 'Kitchen renovation');
});

// ── mapLineItemToRow ──────────────────────────────────────────────

test('mapLineItemToRow: position is 1-based from 0-based index', () => {
  const row = mapLineItemToRow({ description: 'Widget', qty: 2, unit: 'item', unitPrice: 100, gst: true }, 0);
  assert.equal(row.position, 1);
});

test('mapLineItemToRow: unit_price_cents converted from dollars', () => {
  const row = mapLineItemToRow({ description: 'Widget', qty: 1, unit: 'item', unitPrice: 123.45, gst: true }, 0);
  assert.equal(row.unit_price_cents, 12345);
});

test('mapLineItemToRow: never sends line_total_cents/gst_cents — server-computed only', () => {
  const row = mapLineItemToRow({ description: 'Widget', qty: 1, unit: 'item', unitPrice: 100, gst: true }, 0);
  assert.equal('line_total_cents' in row, false);
  assert.equal('gst_cents' in row, false);
});

test('mapLineItemToRow: gst_applicable coerced to boolean', () => {
  assert.equal(mapLineItemToRow({ gst: 'truthy-string' }, 0).gst_applicable, true);
  assert.equal(mapLineItemToRow({ gst: false }, 0).gst_applicable, false);
  assert.equal(mapLineItemToRow({}, 0).gst_applicable, false);
});

// ── validateForSave ───────────────────────────────────────────────

test('validateForSave: valid state passes', () => {
  assert.equal(validateForSave(baseState()), null);
});

test('validateForSave: blank client name rejected', () => {
  assert.match(validateForSave(baseState({ clientName: '' })), /Client name is required/);
});

test('validateForSave: whitespace-only client name rejected', () => {
  assert.match(validateForSave(baseState({ clientName: '   ' })), /Client name is required/);
});

// ── validateForIssue ──────────────────────────────────────────────
// Mirrors 014's enforce_quote_status_transition() requirement chain,
// checked in the same order.

test('validateForIssue: fully valid state with a line item passes', () => {
  assert.equal(validateForIssue(baseState(), 1), null);
});

test('validateForIssue: missing quote_type rejected first', () => {
  const msg = validateForIssue(baseState({ quoteType: '', validUntil: '' }), 0);
  assert.match(msg, /Quote type/);
});

test('validateForIssue: missing valid_until rejected (quote_type present)', () => {
  const msg = validateForIssue(baseState({ validUntil: '' }), 1);
  assert.match(msg, /valid-until date is required/);
});

test('validateForIssue: valid_until before quote_date rejected distinctly', () => {
  const msg = validateForIssue(baseState({ quoteDate: '2026-09-01', validUntil: '2026-08-01' }), 1);
  assert.match(msg, /cannot be before the quote date/);
});

test('validateForIssue: missing client name rejected (dates present)', () => {
  const msg = validateForIssue(baseState({ clientName: '' }), 1);
  assert.match(msg, /Client name is required before a quote can be issued/);
});

test('validateForIssue: missing client email rejected (client name present)', () => {
  const msg = validateForIssue(baseState({ clientEmail: '' }), 1);
  assert.match(msg, /Client email is required/);
});

test('validateForIssue: zero line items rejected last', () => {
  const msg = validateForIssue(baseState(), 0);
  assert.match(msg, /At least one line item is required/);
});

// ── friendlyQuoteError ────────────────────────────────────────────

test('friendlyQuoteError: known-safe RPC messages pass through verbatim', () => {
  const err = { message: 'A quote numbered "QT-0050" already exists for your organisation. Choose a different number.' };
  assert.equal(friendlyQuoteError(err), err.message);
});

test('friendlyQuoteError: post-issue immutability message passes through verbatim', () => {
  const err = { message: 'This quote has been issued and can no longer be changed. Status: issued.' };
  assert.equal(friendlyQuoteError(err), err.message);
});

test('friendlyQuoteError: project-not-found translated to plain language', () => {
  const err = { message: 'Project not found in your organisation.' };
  assert.equal(friendlyQuoteError(err), 'This project could not be found in your organisation.');
});

test('friendlyQuoteError: quote-not-found translated to plain language', () => {
  const err = { message: 'Quote not found in your organisation.' };
  assert.equal(friendlyQuoteError(err), 'This quote could not be found in your organisation.');
});

test('friendlyQuoteError: expired session translated', () => {
  const err = { message: 'JWT expired' };
  assert.equal(friendlyQuoteError(err), 'Your session has expired — please sign in again.');
});

test('friendlyQuoteError: unrecognised raw Postgres error never shown verbatim', () => {
  const err = { message: 'new row for relation "quotes" violates check constraint "quotes_gst_rate_check"' };
  const result = friendlyQuoteError(err);
  assert.equal(result, 'Something went wrong saving this quote. Please try again.');
  assert.doesNotMatch(result, /constraint|relation|quotes_/);
});

// ── deriveClientSnapshot ──────────────────────────────────────────

test('deriveClientSnapshot: business name preferred over first/last name', () => {
  const snapshot = deriveClientSnapshot({
    customers: { business_name: 'Acme Pty Ltd', first_name: 'Jane', last_name: 'Smith', email: 'jane@acme.com' }
  });
  assert.equal(snapshot.clientName, 'Acme Pty Ltd');
  assert.equal(snapshot.clientEmail, 'jane@acme.com');
});

test('deriveClientSnapshot: falls back to first/last name when no business name', () => {
  const snapshot = deriveClientSnapshot({
    customers: { business_name: '', first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com' }
  });
  assert.equal(snapshot.clientName, 'Jane Smith');
});

test('deriveClientSnapshot: no embedded customer returns blanks, never invents a value', () => {
  const snapshot = deriveClientSnapshot({ customers: null });
  assert.equal(snapshot.clientName, '');
  assert.equal(snapshot.clientEmail, '');
});
