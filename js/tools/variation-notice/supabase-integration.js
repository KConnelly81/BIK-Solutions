/**
 * Variation Notice — Supabase Integration
 *
 * Tool-specific wiring only, as of Sprint 4 — the generic session/project
 * gating, save-panel dispatch, and list rendering all now live in
 * js/toolkit/supabase-project-context.js and
 * js/toolkit/supabase-record-panel.js, proven here first before Sprint 5
 * builds Quotes/Progress Claims on top of them. This file supplies the
 * one thing those modules can't know on their own: what a variation
 * notice actually looks like (table name, RPC name, field mapping,
 * validation, display copy).
 *
 * Wires variation-generator.html to the approved backend
 * (supabase/migrations/010_create_variation_notices.sql,
 * 011_variation_notice_number_generator.sql) via public.create_variation_notice()
 * only — never a direct call to internal.variation_number_counters or any
 * other internal.* helper; only the grants already approved for the
 * `authenticated` role are used (the RPC, plus plain SELECT/INSERT/UPDATE
 * on variation_notices, both already granted since migration 010).
 *
 * All pure logic (payload shaping, error translation, validation, the
 * project snapshot) lives in variation-save-logic.js and is unit tested
 * there directly. This file is not unit tested — it requires a browser
 * and a live Supabase project; see docs/PHASE_3_SPRINT_3_MANUAL_TEST_STEPS.md.
 */

// ?v= cache-busts these two specific files across a GitHub Pages release —
// both were modified by the PR #7 hotfix, and ES module imports are cached
// by exact URL with no build-time content hashing on this static site.
// Bump the version token whenever either file changes again.
import { gateOnSupabaseProject, applySnapshotOnce } from '../../toolkit/supabase-project-context.js?v=20260802b';
import { wireSaveButton, refreshRecordList, escapeHtml } from '../../toolkit/supabase-record-panel.js?v=20260802b';
import { formatAUD, centsToDollars } from '../../toolkit/calculator.js';
import {
  buildRpcParams,
  buildUpdatePayload,
  validateForSave,
  friendlyVariationError,
  deriveClientSnapshot
} from './variation-save-logic.js';

const TABLE = 'variation_notices';
const RPC_CREATE = 'create_variation_notice';

// Temporary diagnostic instrumentation (hotfix/sprint4-variation-list-
// diagnostics) — see js/toolkit/supabase-record-panel.js's matching
// comment for why this exists. Numbered so the live console trace reads
// as one ordered sequence across both files; checkpoints 8+ are in
// supabase-record-panel.js's refreshRecordList(). Remove once the live
// cause is confirmed and fixed.
function diag(n, label, extra) {
  if (extra !== undefined) {
    console.log(`[BIK-DIAG ${n}] ${label}`, extra);
  } else {
    console.log(`[BIK-DIAG ${n}] ${label}`);
  }
}

diag(1, 'supabase-integration.js module loaded');

/**
 * Gates variation-generator.html on an authenticated session and a valid
 * `?project=` id, then mounts the tool (mountTool = js/tools/variation-
 * notice/index.js's init, which accepts an onReady({ engine, toast })
 * callback) and wires the Save-to-project panel and the project's
 * variations list. No part of the tool is shown before the gate resolves.
 */
export async function initVariationSupabaseIntegration(mountTool) {
  diag(2, 'initVariationSupabaseIntegration() called');
  await gateOnSupabaseProject({
    mountTool,
    customerFields: 'business_name, first_name, last_name, email',
    onGated(project, mount) {
      diag(3, 'onGated() entered', { projectId: project?.id });

      // The list panel below has nothing to do with whether the form
      // itself mounts successfully — it only needs project.id, already in
      // hand. Without this try/catch, any exception anywhere in mounting
      // the (large) variation-notice form — completely unrelated to
      // Supabase — would abort this function before refreshVariationsList()
      // ever ran, leaving the list stuck on its default static "Loading…"
      // with nothing to explain why. See docs/changelog.md's hotfix entry.
      try {
        diag(4, 'mount() call starting');
        mount(({ engine }) => {
          diag(5, 'mount() onReady callback fired — form mounted, wiring save button');
          applySnapshotOnce(engine, deriveClientSnapshot(project));

          wireSaveButton({
            engine,
            project,
            table: TABLE,
            rpcName: RPC_CREATE,
            buildInsertPayload: (state, proj) => buildRpcParams(state, proj.id),
            buildUpdatePayload,
            validate: validateForSave,
            getRecordRef: (row) => row.variation_number,
            recordLabel: 'Variation',
            friendlyError: friendlyVariationError,
            // The database is the sole source of the canonical number —
            // write back exactly what it returned, never anything computed
            // client-side. See variation-save-logic.js's header comment.
            applyResultToEngine: (row, eng) => eng.setState('variationNumber', row.variation_number),
            onSaved: () => refreshVariationsList(project.id)
          });
        });
        diag(6, 'mount() call returned without throwing');
      } catch (err) {
        diag(6, 'mount() threw', err);
        console.error('[BIK] Variation Notice failed to mount:', err);
      }

      diag(7, 'calling refreshVariationsList()', { projectId: project.id });
      refreshVariationsList(project.id);
    }
  });
}

function refreshVariationsList(projectId) {
  return refreshRecordList({
    table: TABLE,
    projectId,
    selectColumns: 'id, variation_number, client_name, status, total_cents',
    emptyMessage: 'No variations saved to this project yet.',
    renderTotal: (rows) => {
      const totalCents = rows.reduce((sum, row) => sum + (row.total_cents || 0), 0);
      return `Total ${formatAUD(centsToDollars(totalCents))}`;
    },
    renderRow: (row) => `
      <li class="sb-list-item">
        <span class="sb-list-item-number">${escapeHtml(row.variation_number)}</span>
        <span class="sb-list-item-client">${escapeHtml(row.client_name)}</span>
        <span class="status-pill status-pill--${escapeHtml(row.status)}">${escapeHtml(row.status)}</span>
        <span class="sb-list-item-amount">${formatAUD(centsToDollars(row.total_cents))}</span>
      </li>
    `
  });
}
