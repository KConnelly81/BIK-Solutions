/**
 * Unit tests for the pure (DOM-free) functions in ../www/js/app-shell.js.
 * Run with: node --test mobile/test/app-shell-pure.test.js
 *
 * isSessionExpiredError() decides whether a failed Supabase call bounces
 * the user to sign-in or shows a plain retryable error — getting this
 * wrong either strands a user on a dead error screen when they should
 * just re-authenticate, or bounces them to sign-in for an unrelated
 * network blip. Same class of correctness bug this whole app depends on
 * getting right consistently across three screens (dashboard, attendance,
 * variation-notice, progress-claim all call it identically).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSessionExpiredError } from '../www/js/app-shell.js';

test('isSessionExpiredError: recognises a JWT error', () => {
  assert.equal(isSessionExpiredError({ message: 'JWT expired' }), true);
});

test('isSessionExpiredError: recognises a refresh_token error', () => {
  assert.equal(isSessionExpiredError({ message: 'Invalid refresh_token' }), true);
});

test('isSessionExpiredError: recognises "Authentication required" (RPC-raised)', () => {
  assert.equal(isSessionExpiredError({ message: 'Authentication required, or your account has no active organisation.' }), true);
});

test('isSessionExpiredError: recognises "session expired" wording directly', () => {
  assert.equal(isSessionExpiredError({ message: 'Your session has expired — please sign in again.' }), true);
});

test('isSessionExpiredError: is case-insensitive', () => {
  assert.equal(isSessionExpiredError({ message: 'invalid TOKEN supplied' }), true);
});

test('isSessionExpiredError: an unrelated validation error is NOT session-expired', () => {
  assert.equal(isSessionExpiredError({ message: 'Client name is required.' }), false);
});

test('isSessionExpiredError: an unrelated network error is NOT session-expired', () => {
  assert.equal(isSessionExpiredError({ message: 'Failed to fetch' }), false);
});

test('isSessionExpiredError: handles null/undefined without throwing', () => {
  assert.equal(isSessionExpiredError(null), false);
  assert.equal(isSessionExpiredError(undefined), false);
});

test('isSessionExpiredError: handles a plain string error (not an Error object)', () => {
  assert.equal(isSessionExpiredError('JWT malformed'), true);
});

test('isSessionExpiredError: handles an error with no message property', () => {
  assert.equal(isSessionExpiredError({}), false);
});
