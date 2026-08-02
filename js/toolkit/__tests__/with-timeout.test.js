/**
 * Unit tests for js/toolkit/with-timeout.js's withTimeout().
 * Real (short) timers — no fake-timer mocking needed at these durations.
 *
 * Run with: node --test js/toolkit/__tests__/with-timeout.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { withTimeout } from '../with-timeout.js';

test('withTimeout: resolves with the original value when the promise settles before the timeout', async () => {
  const result = await withTimeout(Promise.resolve('ok'), 200);
  assert.equal(result, 'ok');
});

test('withTimeout: rejects with the original error when the promise rejects before the timeout', async () => {
  const boom = new Error('boom');
  await assert.rejects(() => withTimeout(Promise.reject(boom), 200), boom);
});

test('withTimeout: rejects with a timeout error when the promise never settles within ms', async () => {
  const neverSettles = new Promise(() => {}); // deliberately never resolves or rejects
  await assert.rejects(
    () => withTimeout(neverSettles, 20, 'Request timed out.'),
    /Request timed out\./
  );
});

test('withTimeout: uses the default message when none is given', async () => {
  const neverSettles = new Promise(() => {});
  await assert.rejects(() => withTimeout(neverSettles, 20), /Request timed out\./);
});

test('withTimeout: does not leave a pending timer that fires after the promise already resolved', async () => {
  // Regression guard for the timer-leak class of bug: if the timeout timer
  // is not cleared on the fast path, it would still fire later and could
  // produce an unhandled rejection after this test (and the process) is
  // done. Waiting past the timeout window here proves it was cleared.
  const result = await withTimeout(Promise.resolve('fast'), 20);
  assert.equal(result, 'fast');
  await new Promise((resolve) => setTimeout(resolve, 40));
});
