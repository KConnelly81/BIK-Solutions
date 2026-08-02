/**
 * Supabase Record Panel (Sprint 4)
 *
 * Generic "Save to project" + "records for this project" list wiring for
 * any Supabase-backed tool — extracted from variation-notice's Sprint 3
 * integration. A tool supplies its own shape (table name, optional RPC,
 * payload builders, validation, row rendering); this module owns the
 * DOM wiring, the create-then-update dispatch, and the duplicate-submit
 * guard, so Sprint 5's tools don't re-implement all of that per tool.
 *
 * Design constraints this module exists to preserve (same reasoning as
 * variation-notice's Sprint 3 work, generalised — see
 * variation-save-logic.js for the worked example):
 *   - No numbering, ids, or other authoritative values are computed here.
 *     Whatever the database/RPC returns is what gets shown; this module
 *     is deliberately dumb about record identity.
 *   - Every error shown to the user goes through the tool's own
 *     `friendlyError()` — never a raw Supabase/Postgres error.
 *   - A second click while a request is in flight is always a no-op.
 *
 * Fixed DOM contract this module expects (same `sb-` convention as
 * supabase-project-context.js):
 *   Save panel:  #sb-save-btn, #sb-save-hint, #sb-save-error, #sb-save-success
 *   List panel:  #sb-list-loading, #sb-list-empty, #sb-list, #sb-list-total
 *
 * refreshRecordList()'s branching (loading -> populated/empty/error) is a
 * thin DOM-applying wrapper around record-list-logic.js's
 * determineListOutcome() — that pure function is what's unit tested
 * (js/toolkit/__tests__/record-list-logic.test.js), this file's own DOM
 * wiring is not (requires a browser — see
 * docs/PHASE_3_SPRINT_3_MANUAL_TEST_STEPS.md for the manual coverage).
 */

import { supabase } from '../supabase/client.js';
import { determineListOutcome } from './record-list-logic.js';
import { withTimeout } from './with-timeout.js';

// A query that never settles at all — not even with a rejection — leaves
// the try/catch below waiting forever, since neither the try nor the catch
// path ever runs. See with-timeout.js's header for why this exists: the
// PR #7 defect fix (the try/catch) only covers a query that rejects.
const LIST_QUERY_TIMEOUT_MS = 15000;

/**
 * Wires the "Save to project" button. First click creates the record
 * (via `rpcName` if given, otherwise a plain authenticated INSERT);
 * later clicks update the same row. Returns nothing — all state (the
 * created row's id, the in-flight guard) is held internally per call,
 * one save panel per page.
 *
 * @param {Object} cfg
 * @param {any}    cfg.engine              — the mounted FormEngine instance
 * @param {Object} cfg.project             — the gated project row (id, organisation_id, ...)
 * @param {string} cfg.table               — table name, e.g. 'variation_notices'
 * @param {string} [cfg.rpcName]           — RPC to call for the first save; omit for a plain INSERT
 * @param {(state: Object, project: Object) => Object} cfg.buildInsertPayload
 *   RPC params (if rpcName set) or the row object to INSERT (if not) —
 *   the caller decides the shape, including organisation_id when needed
 *   for a plain insert (a granted RPC derives it server-side instead).
 * @param {(state: Object) => Object} cfg.buildUpdatePayload — row patch for the UPDATE path
 * @param {(state: Object) => (string|null)} cfg.validate — null if valid, else the message to show
 * @param {(row: Object) => string} cfg.getRecordRef — display reference from a saved row, e.g. row.variation_number
 * @param {string} cfg.recordLabel         — e.g. 'Variation', used in "Variation VAR-001 saved."
 * @param {(error: any) => string} cfg.friendlyError — translates a thrown error to safe, user-facing text
 * @param {(row: Object, engine: any) => void} [cfg.applyResultToEngine] —
 *   called with the saved row immediately after create/update succeeds,
 *   before the success message is shown. This is where a tool writes an
 *   authoritative database value back onto the form (e.g.
 *   `engine.setState('variationNumber', row.variation_number)`), so the
 *   field never shows anything the database didn't actually return.
 * @param {() => Promise<void>} [cfg.onSaved] — called after every successful save (create or update), e.g. to refresh a records list
 */
export function wireSaveButton(cfg) {
  const $ = (id) => document.getElementById(id);
  const saveBtn = $('sb-save-btn');
  const hintEl = $('sb-save-hint');
  const errorEl = $('sb-save-error');
  const successEl = $('sb-save-success');

  let savedRowId = null;
  let saving = false;

  saveBtn.addEventListener('click', async () => {
    if (saving) return; // duplicate-submit guard

    const state = cfg.engine.getState();
    const validationError = cfg.validate(state);
    if (validationError) {
      errorEl.textContent = validationError;
      errorEl.hidden = false;
      successEl.hidden = true;
      return;
    }

    saving = true;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    errorEl.hidden = true;
    successEl.hidden = true;

    try {
      let row;
      let created = false;

      if (!savedRowId) {
        created = true;
        const payload = cfg.buildInsertPayload(state, cfg.project);
        if (cfg.rpcName) {
          const { data, error } = await supabase.rpc(cfg.rpcName, payload);
          if (error) throw error;
          row = data;
        } else {
          const { data, error } = await supabase.from(cfg.table).insert(payload).select().single();
          if (error) throw error;
          row = data;
        }
        savedRowId = row.id;
      } else {
        const { data, error } = await supabase
          .from(cfg.table)
          .update(cfg.buildUpdatePayload(state))
          .eq('id', savedRowId)
          .select()
          .single();
        if (error) throw error;
        row = data;
      }

      cfg.applyResultToEngine?.(row, cfg.engine);

      const ref = cfg.getRecordRef(row);
      successEl.textContent = `${cfg.recordLabel} ${ref} ${created ? 'saved' : 'updated'}.`;
      successEl.hidden = false;
      hintEl.textContent = `Last saved ${new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}.`;

      await cfg.onSaved?.();
    } catch (err) {
      console.error(`[BIK] ${cfg.recordLabel} save error:`, err);
      errorEl.textContent = cfg.friendlyError(err);
      errorEl.hidden = false;
    } finally {
      saving = false;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save to project';
    }
  });
}

/**
 * Loads and renders a project's existing records for a table, with an
 * optional running total.
 *
 * @param {Object} cfg
 * @param {string} cfg.table
 * @param {string} cfg.projectId
 * @param {string} cfg.selectColumns        — e.g. 'id, variation_number, client_name, status, total_cents'
 * @param {(row: Object) => string} cfg.renderRow — HTML for one `<li class="sb-list-item">...`
 * @param {(rows: Object[]) => (string|null)} [cfg.renderTotal] — text for #sb-list-total, or null to leave it blank
 * @param {string} [cfg.emptyMessage]
 * @param {string} [cfg.errorMessage] — shown in #sb-list-empty when the query fails, for either
 *   reason (a resolved {error} result or a thrown/rejected promise — see the try/catch below,
 *   added after PR #7's live testing found that a rejected query left this function exiting
 *   before `loadingEl.hidden = true` was ever reached, so the panel stayed on "Loading…"
 *   permanently with no error surfaced at all)
 */
export async function refreshRecordList(cfg) {
  const $ = (id) => document.getElementById(id);
  const loadingEl = $('sb-list-loading');
  const emptyEl = $('sb-list-empty');
  const listEl = $('sb-list');
  const totalEl = $('sb-list-total');

  loadingEl.hidden = false;
  emptyEl.hidden = true;
  listEl.hidden = true;

  // try/catch is deliberate, not defensive boilerplate: a query that
  // rejects (network failure, a thrown exception inside the client
  // library) rather than resolving with {data, error} must still reach
  // `loadingEl.hidden = true` below — otherwise the panel is stuck on its
  // initial "Loading…" state forever, with no error ever shown. This is
  // the exact defect PR #7's live testing found.
  let data, error, thrown;
  try {
    ({ data, error } = await withTimeout(
      supabase
        .from(cfg.table)
        .select(cfg.selectColumns)
        .eq('project_id', cfg.projectId)
        .order('created_at', { ascending: false }),
      LIST_QUERY_TIMEOUT_MS,
      'Loading this list is taking longer than expected.'
    ));
  } catch (err) {
    thrown = err;
  }

  loadingEl.hidden = true;

  const outcome = determineListOutcome({ data, error, thrown });

  if (outcome.state === 'error') {
    // Non-fatal for the page as a whole — the save panel above is the
    // primary flow. Keep this quiet rather than stacking a second error
    // banner on top of whatever the save panel already shows.
    console.error(`[BIK] Failed to load project records from ${cfg.table}:`, error || thrown);
    emptyEl.textContent = cfg.errorMessage || 'Could not load this list. Refresh the page to try again.';
    emptyEl.hidden = false;
    if (totalEl) totalEl.textContent = '';
    return;
  }

  if (outcome.state === 'empty') {
    emptyEl.textContent = cfg.emptyMessage || 'Nothing saved to this project yet.';
    emptyEl.hidden = false;
    if (totalEl) totalEl.textContent = '';
    return;
  }

  if (totalEl) totalEl.textContent = cfg.renderTotal ? (cfg.renderTotal(outcome.rows) || '') : '';
  listEl.innerHTML = outcome.rows.map(cfg.renderRow).join('');
  listEl.hidden = false;
}

/** Minimal HTML entity escaping for row renderers built on top of this module. */
export function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}
