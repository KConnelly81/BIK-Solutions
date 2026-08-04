/**
 * Supabase Issue Button (Sprint 5a)
 *
 * Generic "issue this record" wiring for any Supabase-backed tool with an
 * RPC-only draft -> issued transition (issue_quote(), issue_progress_claim()
 * — see 014/017). Mirrors wireSaveButton()'s shape (supabase-record-panel.js):
 * duplicate-submit guard, safe-error-message contract, DOM-applying wrapper
 * around the RPC call. Not merged into wireSaveButton() itself — issuing is
 * a distinct, irreversible action with its own button, its own pre-flight
 * validation (the full requirement chain, checked client-side first so the
 * user sees one clear message instead of a round-trip failure), and no
 * "created vs updated" branching to share.
 *
 * This button is a convenience, not the security boundary: authenticated
 * has no UPDATE grant on any lifecycle column at any layer (012/014,
 * 015/017), so a client cannot force an issue transition by any path this
 * module doesn't also go through. If `validate()` is skipped or wrong, the
 * RPC's own server-side checks (enforce_*_status_transition()) still hold.
 *
 * Fixed DOM contract: #sb-issue-btn, #sb-issue-error, #sb-issue-success.
 */

import { supabase } from '../supabase/client.js';

/**
 * @param {Object} cfg
 * @param {string} cfg.rpcName — 'issue_quote' | 'issue_progress_claim'
 * @param {() => (string|null)} cfg.getRecordId — current saved row id, or null if nothing saved yet
 * @param {(id: string) => Object} cfg.buildParams — RPC params, e.g. (id) => ({ p_quote_id: id })
 * @param {() => (string|null)} [cfg.validate] — pre-flight check (the full issue-requirement chain);
 *   null if ready to issue, else the message to show without calling the RPC at all
 * @param {string} cfg.recordLabel — e.g. 'Quote', used in "Quote issued."
 * @param {(error: any) => string} cfg.friendlyError
 * @param {(row: Object) => void} [cfg.onIssued] — called with the now-issued row after success
 * @param {string} [cfg.unsavedMessage]
 */
export function wireIssueButton(cfg) {
  const $ = (id) => document.getElementById(id);
  const btn = $('sb-issue-btn');
  const errorEl = $('sb-issue-error');
  const successEl = $('sb-issue-success');
  if (!btn) return; // tool page has no issue action (e.g. not yet built) — nothing to wire

  let issuing = false;
  const idleLabel = btn.textContent;

  btn.addEventListener('click', async () => {
    if (issuing) return;

    const recordId = cfg.getRecordId();
    if (!recordId) {
      showMessage(errorEl, successEl, cfg.unsavedMessage || `Save this ${cfg.recordLabel.toLowerCase()} to the project first.`);
      return;
    }

    const validationError = cfg.validate?.();
    if (validationError) {
      showMessage(errorEl, successEl, validationError);
      return;
    }

    // Issuing is permanent and database-enforced (no undo, by anyone) —
    // a single accidental click must not be enough to lock a real
    // document. One native confirm(), same as every other irreversible
    // action in the platform should get.
    const confirmed = window.confirm(
      cfg.confirmMessage || `Issue this ${cfg.recordLabel.toLowerCase()}? This locks it permanently — no further edits, by anyone.`
    );
    if (!confirmed) return;

    issuing = true;
    btn.disabled = true;
    btn.textContent = 'Issuing…';
    errorEl.hidden = true;
    successEl.hidden = true;

    try {
      const { data, error } = await supabase.rpc(cfg.rpcName, cfg.buildParams(recordId));
      if (error) throw error;

      successEl.textContent = `${cfg.recordLabel} issued.`;
      successEl.hidden = false;
      btn.textContent = 'Issued';
      cfg.onIssued?.(data);
    } catch (err) {
      console.error(`[BIK] ${cfg.recordLabel} issue error:`, err);
      errorEl.textContent = cfg.friendlyError(err);
      errorEl.hidden = false;
      issuing = false;
      btn.disabled = false;
      btn.textContent = idleLabel;
    }
  });
}

function showMessage(errorEl, successEl, message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
  successEl.hidden = true;
}
