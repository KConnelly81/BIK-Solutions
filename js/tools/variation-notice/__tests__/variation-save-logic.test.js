/**
 * Unit tests for js/tools/variation-notice/variation-save-logic.js.
 * Pure functions only — no DOM, no network, no live Supabase project.
 * Run with: node --test js/tools/variation-notice/__tests__/variation-save-logic.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dollarsToCents,
  centsToDollars,
  buildRpcParams,
  buildUpdatePayload,
  validateForSave,
  friendlyVariationError,
  deriveClientSnapshot
} from '../variation-save-logic.js';

// ── dollarsToCents / centsToDollars ─────────────────────────────

test('dollarsToCents: converts a plain dollar amount', () => {
  assert.equal(dollarsToCents('1000'), 100000);
  assert.equal(dollarsToCents(1000), 100000);
});

test('dollarsToCents: rounds fractional cents', () => {
  assert.equal(dollarsToCents('10.005'), 1001); // rounds, doesn't truncate
  assert.equal(dollarsToCents('10.004'), 1000);
});

test('dollarsToCents: rejects negative and non-numeric input as 0', () => {
  assert.equal(dollarsToCents('-5'), 0);
  assert.equal(dollarsToCents('not a number'), 0);
  assert.equal(dollarsToCents(''), 0);
  assert.equal(dollarsToCents(undefined), 0);
});

test('dollarsToCents: zero is a valid, distinct value (nil-cost variation)', () => {
  assert.equal(dollarsToCents('0'), 0);
  assert.equal(dollarsToCents(0), 0);
});

test('centsToDollars: inverse of dollarsToCents for whole and fractional cents', () => {
  assert.equal(centsToDollars(100000), 1000);
  assert.equal(centsToDollars(110000), 1100);
  assert.equal(centsToDollars(0), 0);
});

test('centsToDollars: non-numeric input is treated as 0', () => {
  assert.equal(centsToDollars(undefined), 0);
  assert.equal(centsToDollars(null), 0);
});

// ── buildRpcParams ───────────────────────────────────────────────

function baseState(overrides = {}) {
  return {
    clientName: 'Jane Smith',
    clientEmail: 'jane@example.com',
    projectName: 'Smith Reno',
    siteAddress: '1 Test St',
    contractRef: 'JOB-001',
    requestedBy: 'Client',
    reasonForVariation: 'Client requested change',
    descriptionOfWork: 'Additional bench work',
    exclusionsAssumptions: '',
    materialsRequired: '',
    labourRequired: '',
    additionalCost: '1000',
    gstApplicable: 'yes',
    costType: 'fixed',
    extensionOfTime: '0',
    revisedCompletionDate: '',
    paymentTerms: '14days-approval',
    builderNotes: '',
    builderApprovalName: '',
    clientApprovalName: '',
    variationNumber: '',
    ...overrides
  };
}

test('buildRpcParams: blank variation number becomes null (auto-assign), never predicted', () => {
  const params = buildRpcParams(baseState({ variationNumber: '' }), 'project-1');
  assert.equal(params.p_variation_number, null);
});

test('buildRpcParams: whitespace-only variation number also becomes null', () => {
  const params = buildRpcParams(baseState({ variationNumber: '   ' }), 'project-1');
  assert.equal(params.p_variation_number, null);
});

test('buildRpcParams: a typed manual reference is passed through EXACTLY as trimmed, never reformatted', () => {
  // "010" must reach the RPC as "010", not "VAR-010" -- normalisation is
  // the database's job (011_variation_notice_number_generator.sql), not
  // this function's.
  assert.equal(buildRpcParams(baseState({ variationNumber: '  010  ' }), 'p').p_variation_number, '010');
  assert.equal(buildRpcParams(baseState({ variationNumber: 'var-010' }), 'p').p_variation_number, 'var-010');
  assert.equal(buildRpcParams(baseState({ variationNumber: 'CLIENT-VO-10' }), 'p').p_variation_number, 'CLIENT-VO-10');
});

test('buildRpcParams: maps the project id and cost correctly', () => {
  const params = buildRpcParams(baseState({ additionalCost: '1234.56' }), 'project-xyz');
  assert.equal(params.p_project_id, 'project-xyz');
  assert.equal(params.p_cost_excl_gst_cents, 123456);
});

test('buildRpcParams: gstApplicable "yes"/"no" maps to a real boolean', () => {
  assert.equal(buildRpcParams(baseState({ gstApplicable: 'yes' }), 'p').p_gst_applicable, true);
  assert.equal(buildRpcParams(baseState({ gstApplicable: 'no' }), 'p').p_gst_applicable, false);
});

test('buildRpcParams: optional blank fields become null, not empty strings', () => {
  const params = buildRpcParams(baseState({ clientEmail: '', siteAddress: '', contractRef: '' }), 'p');
  assert.equal(params.p_client_email, null);
  assert.equal(params.p_site_address, null);
  assert.equal(params.p_contract_reference, null);
});

test('buildRpcParams: extensionOfTime and revisedCompletionDate map correctly', () => {
  const params = buildRpcParams(baseState({ extensionOfTime: '5', revisedCompletionDate: '2026-08-01' }), 'p');
  assert.equal(params.p_extension_of_time_days, 5);
  assert.equal(params.p_revised_completion_date, '2026-08-01');
});

// ── buildUpdatePayload ───────────────────────────────────────────

test('buildUpdatePayload: never includes variation_number in any form', () => {
  const payload = buildUpdatePayload(baseState({ variationNumber: 'VAR-010' }));
  assert.equal('variation_number' in payload, false);
  assert.equal('variationNumber' in payload, false);
});

test('buildUpdatePayload: uses snake_case table column names', () => {
  const payload = buildUpdatePayload(baseState());
  assert.equal(payload.client_name, 'Jane Smith');
  assert.equal(payload.cost_excl_gst_cents, 100000);
  assert.equal(payload.gst_applicable, true);
});

// ── validateForSave ──────────────────────────────────────────────

test('validateForSave: valid state returns null', () => {
  assert.equal(validateForSave(baseState()), null);
});

test('validateForSave: missing client name', () => {
  assert.equal(validateForSave(baseState({ clientName: '  ' })), 'Client name is required.');
});

test('validateForSave: missing reason for variation', () => {
  assert.equal(validateForSave(baseState({ reasonForVariation: '' })), 'Reason for variation is required.');
});

test('validateForSave: missing description of work', () => {
  assert.equal(validateForSave(baseState({ descriptionOfWork: '' })), 'Description of work is required.');
});

test('validateForSave: negative or missing cost is rejected, but zero is valid', () => {
  assert.equal(validateForSave(baseState({ additionalCost: '-1' })), 'A valid cost (0 or greater) is required.');
  assert.equal(validateForSave(baseState({ additionalCost: '' })), 'A valid cost (0 or greater) is required.');
  assert.equal(validateForSave(baseState({ additionalCost: '0' })), null);
});

test('validateForSave: does not require builderName/dateIssued/etc — those are PDF-only fields the RPC never receives', () => {
  const state = baseState();
  delete state.builderName; // not present at all
  assert.equal(validateForSave(state), null);
});

// ── friendlyVariationError ───────────────────────────────────────

test('friendlyVariationError: known RPC validation messages pass through unchanged', () => {
  assert.equal(friendlyVariationError({ message: 'Client name is required.' }), 'Client name is required.');
  assert.equal(friendlyVariationError({ message: 'A valid cost (0 or greater) is required.' }), 'A valid cost (0 or greater) is required.');
});

test('friendlyVariationError: known duplicate-number message passes through unchanged', () => {
  const msg = 'A variation numbered "VAR-010" already exists for this project. Choose a different number.';
  assert.equal(friendlyVariationError({ message: msg }), msg);
});

test('friendlyVariationError: cross-organisation project error is reworded to plain language', () => {
  const result = friendlyVariationError({ message: 'Project not found in your organisation.' });
  assert.equal(result, 'This project could not be found in your organisation.');
});

test('friendlyVariationError: auth/session errors are reworded to plain language', () => {
  assert.equal(
    friendlyVariationError({ message: 'Authentication required, or your account has no active organisation.' }),
    'Your session has expired — please sign in again.'
  );
  assert.equal(
    friendlyVariationError({ message: 'JWT expired' }),
    'Your session has expired — please sign in again.'
  );
});

test('friendlyVariationError: an unrecognised raw Postgres error is NEVER shown verbatim', () => {
  const rawPostgresError = {
    message: 'duplicate key value violates unique constraint "variation_notices_test_unrelated_unique"'
  };
  const result = friendlyVariationError(rawPostgresError);
  assert.equal(result, 'Something went wrong saving this variation. Please try again.');
  // Explicitly assert none of the internal details leak into the shown message.
  assert.equal(/constraint|schema|internal|variation_notices_/i.test(result), false);
});

test('friendlyVariationError: an error with no message at all still returns a safe fallback', () => {
  const result = friendlyVariationError(null);
  assert.equal(result, 'Something went wrong saving this variation. Please try again.');
});

test('friendlyVariationError: a plain Error object with an unexpected message falls back safely', () => {
  const result = friendlyVariationError(new Error('relation "internal.variation_number_counters" does not exist'));
  assert.equal(result, 'Something went wrong saving this variation. Please try again.');
});

// ── deriveClientSnapshot ─────────────────────────────────────────

test('deriveClientSnapshot: prefers customer business_name', () => {
  const snapshot = deriveClientSnapshot({
    name: 'Smith Reno',
    site_address: '1 Test St',
    customers: { business_name: 'Smith Pty Ltd', first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com' }
  });
  assert.equal(snapshot.clientName, 'Smith Pty Ltd');
  assert.equal(snapshot.clientEmail, 'jane@example.com');
  assert.equal(snapshot.projectName, 'Smith Reno');
  assert.equal(snapshot.siteAddress, '1 Test St');
});

test('deriveClientSnapshot: falls back to first+last name when no business_name', () => {
  const snapshot = deriveClientSnapshot({
    name: 'Smith Reno',
    customers: { business_name: null, first_name: 'Jane', last_name: 'Smith', email: null }
  });
  assert.equal(snapshot.clientName, 'Jane Smith');
  assert.equal(snapshot.clientEmail, '');
});

test('deriveClientSnapshot: no linked customer at all -> blank client fields, project fields still populate', () => {
  const snapshot = deriveClientSnapshot({ name: 'Smith Reno', site_address: '1 Test St', customers: null });
  assert.equal(snapshot.clientName, '');
  assert.equal(snapshot.clientEmail, '');
  assert.equal(snapshot.projectName, 'Smith Reno');
  assert.equal(snapshot.siteAddress, '1 Test St');
});

test('deriveClientSnapshot: never throws on a completely empty project object', () => {
  assert.doesNotThrow(() => deriveClientSnapshot({}));
  assert.doesNotThrow(() => deriveClientSnapshot(null));
});
