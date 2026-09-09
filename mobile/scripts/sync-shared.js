#!/usr/bin/env node
/**
 * Copies a fixed allowlist of files from the main site's ../js/ tree into
 * mobile/www/js/shared/ before every Capacitor sync/build.
 *
 * Why a copy instead of an import path that reaches outside www/: Capacitor
 * bundles whatever is in `webDir` (www/) into the native app — nothing
 * outside that folder exists on-device at runtime, so a relative import
 * like `../../../js/supabase/client.js` would 404 on a real phone even
 * though it resolves fine when this repo is served from its root for the
 * web app. Copying is also how this avoids duplicating the *backend*: the
 * files copied here are the same auth/session/RPC/pure-logic modules the
 * production web app uses, byte-for-byte, from the one real source of
 * truth in ../js/. Nothing under www/js/shared/ is ever hand-edited —
 * it's a build artifact (gitignored, see mobile/.gitignore) regenerated
 * by this script every time.
 *
 * Deliberately NOT copied: js/toolkit/tool-controller.js, any tool's
 * config.js, and supabase-record-panel.js — those are the desktop
 * two-pane form-engine and its declarative field schemas. The mobile app
 * has its own purpose-built, mobile-first screens (mobile-first navigation
 * requirement) that call the same RPCs and pure save-logic functions
 * copied below, so the data model, validation, and RLS story stay
 * identical to the web app without wrapping its desktop UI.
 *
 * Usage: node scripts/sync-shared.js  (or `npm run sync:shared`)
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..'); // BIK-Solutions/
const SRC_JS = path.join(REPO_ROOT, 'js');
const DEST = path.join(__dirname, '..', 'www', 'js', 'shared');

// Relative to SRC_JS. Keep this list as small as the three mobile tools
// genuinely need — every addition here is a file whose production
// behaviour the mobile app now inherits automatically, so it should stay
// that way rather than growing into "copy everything".
const FILES = [
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

function copyFile(relPath) {
  const src = path.join(SRC_JS, relPath);
  const dest = path.join(DEST, relPath);
  if (!fs.existsSync(src)) {
    throw new Error(`sync-shared: expected source file missing: ${src}`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`  copied ${relPath}`);
}

console.log(`Syncing ${FILES.length} shared file(s) from ${SRC_JS} -> ${DEST}`);
fs.rmSync(DEST, { recursive: true, force: true });
FILES.forEach(copyFile);
console.log('sync-shared: done.');
