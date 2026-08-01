/**
 * Unit tests for js/toolkit/record-list-logic.js's determineListOutcome().
 * Pure function only — no DOM, no network.
 *
 * This is the exact branching logic behind the defect PR #7's live
 * testing found: refreshRecordList() (supabase-record-panel.js) awaited
 * its Supabase query with no try/catch, so a rejected promise left the
 * "Variations for this project" panel permanently stuck on "Loading…",
 * with no records, no empty state, and no error ever shown. These tests
 * cover the three terminal outcomes that must always be reachable —
 * populated, empty, and error (both the {error}-shaped kind and the
 * thrown/rejected kind) — so a regression of the same shape fails here,
 * not only in a live browser.
 *
 * Run with: node --test js/toolkit/__tests__/record-list-logic.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { determineListOutcome } from '../record-list-logic.js';

test('determineListOutcome: successful load with rows -> populated', () => {
  const rows = [{ id: '1' }, { id: '2' }];
  const outcome = determineListOutcome({ data: rows, error: undefined, thrown: undefined });
  assert.equal(outcome.state, 'populated');
  assert.deepEqual(outcome.rows, rows);
});

test('determineListOutcome: successful load with zero rows -> empty', () => {
  const outcome = determineListOutcome({ data: [], error: undefined, thrown: undefined });
  assert.equal(outcome.state, 'empty');
  assert.deepEqual(outcome.rows, []);
});

test('determineListOutcome: query resolves with a Supabase/PostgREST error -> error', () => {
  const outcome = determineListOutcome({ data: undefined, error: { message: 'permission denied' }, thrown: undefined });
  assert.equal(outcome.state, 'error');
  assert.deepEqual(outcome.rows, []);
});

test('determineListOutcome: query rejects/throws instead of resolving -> error, not stuck', () => {
  // This is the exact defect shape: a rejected promise, not a resolved
  // {data, error} result. Before the fix, refreshRecordList() had no
  // try/catch, so this case never reached the code that would produce
  // any terminal state at all -- the panel stayed on "Loading…" forever.
  const outcome = determineListOutcome({ data: undefined, error: undefined, thrown: new TypeError('Failed to fetch') });
  assert.equal(outcome.state, 'error');
  assert.deepEqual(outcome.rows, []);
});

test('determineListOutcome: both an error and a thrown value present -> still error, not populated', () => {
  const outcome = determineListOutcome({ data: undefined, error: { message: 'x' }, thrown: new Error('y') });
  assert.equal(outcome.state, 'error');
});

test('determineListOutcome: data present alongside a truthy error -> error wins, never shows stale rows', () => {
  const outcome = determineListOutcome({ data: [{ id: 'stale' }], error: { message: 'x' }, thrown: undefined });
  assert.equal(outcome.state, 'error');
  assert.deepEqual(outcome.rows, []);
});

test('determineListOutcome: called with no arguments does not throw', () => {
  const outcome = determineListOutcome();
  assert.equal(outcome.state, 'empty');
});
