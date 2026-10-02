/**
 * Unit tests for js/toolkit/checkin-url.js.
 * Pure function only — no DOM, no network, no live Supabase project.
 * Run with: node --test js/toolkit/__tests__/checkin-url.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCheckinUrl } from '../checkin-url.js';

test('builds a checkin.html URL from the origin, independent of any current page path', () => {
  assert.equal(
    buildCheckinUrl('https://biksolutions.com.au', 'abc123'),
    'https://biksolutions.com.au/checkin.html?t=abc123'
  );
});

test('has no dependency on a global location object', () => {
  // Regression test: the previous implementation built this URL by
  // string-replacing 'attendance.html' with 'checkin.html' in
  // location.pathname, which silently produced the wrong URL (unchanged,
  // still pointing at the admin tool) whenever the admin dashboard was
  // reached at a URL missing that literal extension -- e.g. a host that
  // auto-redirects /attendance.html to /attendance.
  //
  // This test environment (plain Node) has no global `location` at all,
  // so if this implementation were changed back to read
  // location.pathname (or anything else off a global `location`), this
  // call would throw ReferenceError: location is not defined, failing
  // this test immediately rather than silently building the wrong URL
  // again in production.
  assert.doesNotThrow(() => buildCheckinUrl('https://biksolutions.com.au', 'abc123'));
});

test('works with a workers.dev-style temporary deployment origin', () => {
  assert.equal(
    buildCheckinUrl('https://bik-solutions.kconnelly22.workers.dev', 'xyz789'),
    'https://bik-solutions.kconnelly22.workers.dev/checkin.html?t=xyz789'
  );
});

test('passes the token through verbatim, without encoding or altering it', () => {
  const token = '00bec73a1e0d4eaeba50b4e1c12f8c75';
  assert.equal(
    buildCheckinUrl('https://biksolutions.com.au', token),
    `https://biksolutions.com.au/checkin.html?t=${token}`
  );
});
