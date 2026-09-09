/**
 * Smoke test for scripts/sync-shared.js — the mechanism that keeps the
 * mobile app on the exact same auth/RPC/pure-logic code as the production
 * web app (see that script's header for why a copy is necessary at all).
 * Run with: node --test mobile/test/sync-shared.test.js
 *
 * This does not re-test the shared modules' own behaviour (their real
 * source in ../../js/ already has its own test suite — see
 * js/toolkit/__tests__/, js/tools/*\/__tests__/) — only that the sync
 * mechanism itself does what it claims: every file it says it copies
 * actually lands where every mobile screen's <script> imports expect it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHARED_DIR = path.join(MOBILE_ROOT, 'www', 'js', 'shared');

// Every one of these is imported by at least one mobile/www/*.html screen —
// if sync-shared.js's FILES list ever drops one, that screen 404s on its
// very first import and fails silently (a blank white screen), so this
// list is deliberately kept in lockstep with what the HTML files actually
// import, not just with sync-shared.js's own FILES array.
const EXPECTED_FILES = [
  'vendor/supabase-js.min.js',
  'supabase/client.js',
  'supabase/session.js',
  'toolkit/calculator.js',
  'toolkit/with-timeout.js',
  'toolkit/attendance-rpc.js',
  'toolkit/variation-photo-upload.js',
  'tools/variation-notice/variation-save-logic.js',
  'tools/progress-claim/progress-claim-save-logic.js',
];

test('sync-shared.js copies every file the mobile screens import', () => {
  execFileSync('node', [path.join(MOBILE_ROOT, 'scripts', 'sync-shared.js')], { stdio: 'pipe' });
  for (const relPath of EXPECTED_FILES) {
    const dest = path.join(SHARED_DIR, relPath);
    assert.ok(fs.existsSync(dest), `expected synced file missing: www/js/shared/${relPath}`);
    assert.ok(fs.statSync(dest).size > 0, `synced file is empty: www/js/shared/${relPath}`);
  }
});

test('every HTML screen only imports shared files that actually get synced', () => {
  const wwwDir = path.join(MOBILE_ROOT, 'www');
  const htmlFiles = fs.readdirSync(wwwDir).filter(f => f.endsWith('.html'));
  const importPattern = /(?:from|src=")\.\/js\/shared\/([^"'\s]+\.js)/g;

  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(wwwDir, file), 'utf8');
    for (const match of html.matchAll(importPattern)) {
      const relPath = match[1];
      assert.ok(
        EXPECTED_FILES.includes(relPath),
        `${file} imports js/shared/${relPath}, which is not in sync-shared.js's FILES list (or this test's EXPECTED_FILES) — it will 404 on a real device.`
      );
    }
  }
});
