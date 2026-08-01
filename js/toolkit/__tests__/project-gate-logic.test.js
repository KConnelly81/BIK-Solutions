/**
 * Unit tests for js/toolkit/project-gate-logic.js's determineGateOutcome().
 * Pure function only — no DOM, no network.
 *
 * Same defect class as record-list-logic.test.js covers, found in the
 * sibling gate function during PR #7's live-testing investigation:
 * gateOnSupabaseProject() also awaited its Supabase query with no
 * try/catch. The gate itself worked during that specific live test (the
 * rest of the page loaded correctly), but the same missing-try/catch
 * shape was present and would have produced the identical permanently-
 * stuck-loading symptom on a genuine query rejection. Fixed alongside the
 * confirmed defect for consistency, and covered here.
 *
 * Run with: node --test js/toolkit/__tests__/project-gate-logic.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { determineGateOutcome } from '../project-gate-logic.js';

test('determineGateOutcome: missing project id -> missing-project-id, before any query runs', () => {
  const outcome = determineGateOutcome({ projectId: null, project: undefined, error: undefined, thrown: undefined });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, 'missing-project-id');
});

test('determineGateOutcome: empty-string project id treated the same as missing', () => {
  const outcome = determineGateOutcome({ projectId: '', project: undefined, error: undefined, thrown: undefined });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, 'missing-project-id');
});

test('determineGateOutcome: valid project id, query resolves with a real project -> ok', () => {
  const outcome = determineGateOutcome({
    projectId: 'a-real-id',
    project: { id: 'a-real-id', name: 'Test Project' },
    error: undefined,
    thrown: undefined
  });
  assert.equal(outcome.ok, true);
});

test('determineGateOutcome: valid project id, query resolves with no matching row -> not-found', () => {
  const outcome = determineGateOutcome({ projectId: 'a-real-id', project: null, error: undefined, thrown: undefined });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, 'not-found');
});

test('determineGateOutcome: query resolves with a {error} result (e.g. cross-organisation access denied by RLS) -> query-failed', () => {
  const outcome = determineGateOutcome({
    projectId: 'a-real-id',
    project: undefined,
    error: { message: 'permission denied' },
    thrown: undefined
  });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, 'query-failed');
  assert.deepEqual(outcome.detail, { message: 'permission denied' });
});

test('determineGateOutcome: query rejects/throws instead of resolving (initialisation failure) -> query-failed, not stuck', () => {
  // The exact defect shape: a rejected promise, not a resolved
  // {data, error} result. Before the fix, gateOnSupabaseProject() had no
  // try/catch around this query, so this case never reached the code
  // that clears the loading state -- the page would have stayed on its
  // initial loading screen forever.
  const thrown = new TypeError('Failed to fetch');
  const outcome = determineGateOutcome({ projectId: 'a-real-id', project: undefined, error: undefined, thrown });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, 'query-failed');
  assert.equal(outcome.detail, thrown);
});

test('determineGateOutcome: thrown takes priority over a stale/partial project value', () => {
  const thrown = new Error('network error');
  const outcome = determineGateOutcome({ projectId: 'a-real-id', project: { id: 'stale' }, error: undefined, thrown });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, 'query-failed');
});
