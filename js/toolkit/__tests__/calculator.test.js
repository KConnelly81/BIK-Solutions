/**
 * Unit tests for js/toolkit/calculator.js's money-conversion helpers.
 * Pure functions only — no DOM, no network.
 * Run with: node --test js/toolkit/__tests__/calculator.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { dollarsToCents, centsToDollars } from '../calculator.js';

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

test('dollarsToCents: zero is a valid, distinct value (nil-cost documents)', () => {
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
