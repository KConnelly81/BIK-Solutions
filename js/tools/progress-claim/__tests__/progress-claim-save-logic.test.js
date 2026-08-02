/**
 * Unit tests for js/tools/progress-claim/progress-claim-save-logic.js.
 * Pure functions only — no DOM, no network, no live Supabase project.
 * Run with: node --test js/tools/progress-claim/__tests__/progress-claim-save-logic.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCreatePayload,
  deriveRetentionRate,
  buildHeaderPayload,
  mapScheduleItemToRow,
  validateForSave,
  friendlyProgressClaimError,
  deriveClientSnapshot
} from '../progress-claim-save-logic.js';

function baseState(overrides = {}) {
  return {
    clientName: 'Jane Smith',
    clientEmail: 'jane@example.com',
    contractRef: 'JOB-001',
    claimNumber: '',
    claimDate: '2026-08-02',
    claimPeriodFrom: '',
    claimPeriodTo: '',
    contractValue: '100000',
    previouslyClaimed: '20000',
    thisClaimAmount: '30000',
    percentComplete: '50',
    retentionRate: '5',
    retentionCustom: '',
    descriptionOfWork: 'Framing complete',
    specialConditions: '',
    builderApprovalName: '',
    clientApprovalName: '',
    ...overrides
  };
}

// ── buildCreatePayload ────────────────────────────────────────────

test('buildCreatePayload: blank claim number becomes null (auto-assign), never predicted', () => {
  const params = buildCreatePayload(baseState({ claimNumber: '' }), 'project-1');
  assert.equal(params.p_claim_number, null);
});

test('buildCreatePayload: typed claim number passed through exactly as trimmed', () => {
  const params = buildCreatePayload(baseState({ claimNumber: '  pc 3  ' }), 'project-1');
  assert.equal(params.p_claim_number, 'pc 3');
});

test('buildCreatePayload: includes project id and client snapshot only (matches create_progress_claim()\'s minimal signature)', () => {
  const params = buildCreatePayload(baseState(), 'project-1');
  assert.deepEqual(Object.keys(params).sort(), [
    'p_claim_number', 'p_client_email', 'p_client_name', 'p_contract_ref', 'p_project_id'
  ].sort());
});

// ── deriveRetentionRate ───────────────────────────────────────────

test('deriveRetentionRate: percent select converted to a fraction', () => {
  assert.equal(deriveRetentionRate(baseState({ retentionRate: '5' })), 0.05);
  assert.equal(deriveRetentionRate(baseState({ retentionRate: '10' })), 0.1);
  assert.equal(deriveRetentionRate(baseState({ retentionRate: '0' })), 0);
});

test('deriveRetentionRate: custom dollar amount back-computed as an effective rate', () => {
  const rate = deriveRetentionRate(baseState({ retentionRate: 'custom', retentionCustom: '1500', thisClaimAmount: '30000' }));
  assert.equal(rate, 0.05);
});

test('deriveRetentionRate: custom with zero claim amount is 0, not a division error', () => {
  const rate = deriveRetentionRate(baseState({ retentionRate: 'custom', retentionCustom: '1500', thisClaimAmount: '0' }));
  assert.equal(rate, 0);
});

test('deriveRetentionRate: clamped below the database\'s < 1 constraint even for an absurd custom entry', () => {
  const rate = deriveRetentionRate(baseState({ retentionRate: 'custom', retentionCustom: '999999', thisClaimAmount: '100' }));
  assert.ok(rate < 1);
  assert.equal(rate, 0.9999);
});

// ── buildHeaderPayload ────────────────────────────────────────────

test('buildHeaderPayload: never includes claim_number (no reassignment-on-UPDATE path)', () => {
  const payload = buildHeaderPayload(baseState());
  assert.equal('claim_number' in payload, false);
});

test('buildHeaderPayload: previously_claimed_cents converted from dollars', () => {
  const payload = buildHeaderPayload(baseState({ previouslyClaimed: '200.50' }));
  assert.equal(payload.previously_claimed_cents, 20050);
});

test('buildHeaderPayload: retention_rate is a fraction, derived via deriveRetentionRate', () => {
  const payload = buildHeaderPayload(baseState({ retentionRate: '10' }));
  assert.equal(payload.retention_rate, 0.1);
});

test('buildHeaderPayload: blank percent_complete becomes null, not NaN', () => {
  const payload = buildHeaderPayload(baseState({ percentComplete: '' }));
  assert.equal(payload.percent_complete, null);
});

// ── mapScheduleItemToRow ──────────────────────────────────────────

test('mapScheduleItemToRow: position is 1-based from 0-based index', () => {
  const row = mapScheduleItemToRow({ description: 'Foundations', contractValue: 25000, previouslyClaimed: 0, thisClaimPercent: 50 }, 0);
  assert.equal(row.position, 1);
});

test('mapScheduleItemToRow: contract_value_cents/previously_claimed_cents converted from dollars', () => {
  const row = mapScheduleItemToRow({ description: 'Foundations', contractValue: '250.50', previouslyClaimed: '10.25', thisClaimPercent: 50 }, 0);
  assert.equal(row.contract_value_cents, 25050);
  assert.equal(row.previously_claimed_cents, 1025);
});

test('mapScheduleItemToRow: never sends this_claim_cents/claimed_to_date_cents/remaining_value_cents — server-computed only', () => {
  const row = mapScheduleItemToRow({ description: 'Foundations', contractValue: 25000, previouslyClaimed: 0, thisClaimPercent: 50 }, 0);
  assert.equal('this_claim_cents' in row, false);
  assert.equal('claimed_to_date_cents' in row, false);
  assert.equal('remaining_value_cents' in row, false);
});

test('mapScheduleItemToRow: blank this_claim_percent becomes null, not NaN', () => {
  const row = mapScheduleItemToRow({ description: 'Foundations', contractValue: 25000, previouslyClaimed: 0, thisClaimPercent: '' }, 0);
  assert.equal(row.this_claim_percent, null);
});

// ── validateForSave ───────────────────────────────────────────────

test('validateForSave: valid state passes', () => {
  assert.equal(validateForSave(baseState()), null);
});

test('validateForSave: blank client name rejected', () => {
  assert.match(validateForSave(baseState({ clientName: '' })), /Client name is required/);
});

// ── friendlyProgressClaimError ────────────────────────────────────

test('friendlyProgressClaimError: the BLOCKED gate message passes through verbatim — the real server text, not a client-side approximation', () => {
  const err = { message: 'Progress Claims cannot be issued yet — GST, retention, and overclaiming treatment require accountant/contract confirmation before this goes live. Drafts remain fully usable for testing. See docs/PHASE_5A_PROGRESS_CLAIMS_MIGRATION_REVIEW.md.' };
  assert.equal(friendlyProgressClaimError(err), err.message);
});

test('friendlyProgressClaimError: post-issue immutability message passes through verbatim', () => {
  const err = { message: 'This progress claim has been issued and can no longer be changed. Status: issued.' };
  assert.equal(friendlyProgressClaimError(err), err.message);
});

test('friendlyProgressClaimError: overclaiming constraint violation translated to plain language, not shown as a raw constraint name', () => {
  const err = { message: 'new row for relation "progress_claims" violates check constraint "progress_claims_totals_non_negative_check"' };
  const result = friendlyProgressClaimError(err);
  assert.doesNotMatch(result, /constraint|relation|progress_claims_/);
  assert.match(result, /more than the recognised contract value/);
});

test('friendlyProgressClaimError: project-not-found translated to plain language', () => {
  const err = { message: 'Project not found in your organisation.' };
  assert.equal(friendlyProgressClaimError(err), 'This project could not be found in your organisation.');
});

test('friendlyProgressClaimError: claim-not-found translated to plain language', () => {
  const err = { message: 'Progress claim not found in your organisation.' };
  assert.equal(friendlyProgressClaimError(err), 'This progress claim could not be found in your organisation.');
});

test('friendlyProgressClaimError: unrecognised raw Postgres error never shown verbatim', () => {
  const err = { message: 'new row for relation "progress_claims" violates check constraint "progress_claims_gst_method_check"' };
  const result = friendlyProgressClaimError(err);
  assert.equal(result, 'Something went wrong saving this progress claim. Please try again.');
});

// ── deriveClientSnapshot ──────────────────────────────────────────

test('deriveClientSnapshot: business name preferred over first/last name', () => {
  const snapshot = deriveClientSnapshot({
    customers: { business_name: 'Acme Pty Ltd', first_name: 'Jane', last_name: 'Smith', email: 'jane@acme.com' }
  });
  assert.equal(snapshot.clientName, 'Acme Pty Ltd');
});

test('deriveClientSnapshot: no embedded customer returns blanks, never invents a value', () => {
  const snapshot = deriveClientSnapshot({ customers: null });
  assert.equal(snapshot.clientName, '');
  assert.equal(snapshot.clientEmail, '');
});
