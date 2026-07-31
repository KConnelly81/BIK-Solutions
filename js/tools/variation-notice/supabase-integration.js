/**
 * Variation Notice — Supabase Integration (Sprint 3)
 *
 * DOM/network orchestration for variation-generator.html. Wires the page
 * to the approved backend (supabase/migrations/010_create_variation_notices.sql,
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

import { supabase } from '../../supabase/client.js';
import { requireSession, friendlyAuthError } from '../../supabase/session.js';
import { formatAUD } from '../../toolkit/calculator.js';
import {
  buildRpcParams,
  buildUpdatePayload,
  validateForSave,
  friendlyVariationError,
  deriveClientSnapshot,
  centsToDollars
} from './variation-save-logic.js';

const VARIATION_TABLE = 'variation_notices';
const RPC_CREATE = 'create_variation_notice';

/**
 * Gates variation-generator.html on an authenticated session and a valid
 * `?project=` id, then mounts the tool (mountTool = js/tools/variation-
 * notice/index.js's init, which accepts an onReady({ engine, toast })
 * callback) and wires the Save-to-project panel and the project's
 * variations list. No part of the tool is shown before the gate resolves.
 */
export async function initVariationSupabaseIntegration(mountTool) {
  const $ = (id) => document.getElementById(id);
  const loadingEl = $('vn-loading');
  const errorEl = $('vn-project-error');
  const errorTextEl = $('vn-project-error-text');
  const shellEl = $('vn-app-shell');

  const projectId = new URLSearchParams(location.search).get('project');
  if (!projectId) {
    loadingEl.hidden = true;
    errorTextEl.textContent = 'No project was specified. Open this tool from a project on your dashboard.';
    errorEl.hidden = false;
    return;
  }

  const session = await requireSession('signin.html');
  if (!session) return; // requireSession already redirected

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, site_address, organisation_id, organisations ( name ), customers ( business_name, first_name, last_name, email )')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError || !project) {
    loadingEl.hidden = true;
    errorTextEl.textContent = projectError
      ? friendlyAuthError(projectError)
      : 'This project could not be found in your organisation.';
    errorEl.hidden = false;
    return;
  }

  // ── Reveal the tool ────────────────────────────────────────────
  loadingEl.hidden = true;
  shellEl.hidden = false;
  $('vn-context-org').textContent = project.organisations?.name || 'Your organisation';
  $('vn-context-project').textContent = project.name;

  mountTool(({ engine }) => {
    // ── One-time client/project snapshot ──────────────────────────
    // Only fills a field that is still blank, so it never overwrites a
    // restored local draft or a document loaded from history — both of
    // those run synchronously inside mountTool() itself, before this
    // callback fires, so they always win if they set a value first.
    const snapshot = deriveClientSnapshot(project);
    const current = engine.getState();
    for (const [field, value] of Object.entries(snapshot)) {
      if (value && !String(current[field] || '').trim()) {
        engine.setState(field, value);
      }
    }

    wireSavePanel({ engine, project });
  });

  await refreshVariationsList(project.id);
}

/** Wires the "Save to project" button: first click INSERTs via the RPC, later clicks UPDATE the same row. */
function wireSavePanel({ engine, project }) {
  const $ = (id) => document.getElementById(id);
  const saveBtn = $('vn-save-btn');
  const hintEl = $('vn-save-hint');
  const errorEl = $('vn-save-error');
  const successEl = $('vn-save-success');

  let savedRowId = null;
  let saving = false;

  saveBtn.addEventListener('click', async () => {
    if (saving) return; // duplicate-submit guard

    const validationError = validateForSave(engine.getState());
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
      const state = engine.getState();

      if (!savedRowId) {
        const { data, error } = await supabase.rpc(RPC_CREATE, buildRpcParams(state, project.id));
        if (error) throw error;
        savedRowId = data.id; // RPC returns the full created row
        engine.setState('variationNumber', data.variation_number);
        successEl.textContent = `Variation ${data.variation_number} saved.`;
      } else {
        const { error } = await supabase
          .from(VARIATION_TABLE)
          .update(buildUpdatePayload(state))
          .eq('id', savedRowId);
        if (error) throw error;
        successEl.textContent = `Variation ${state.variationNumber} updated.`;
      }

      successEl.hidden = false;
      hintEl.textContent = `Last saved ${new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}.`;
      await refreshVariationsList(project.id);
    } catch (err) {
      console.error('[BIK] Variation save error:', err);
      errorEl.textContent = friendlyVariationError(err);
      errorEl.hidden = false;
    } finally {
      saving = false;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save to project';
    }
  });
}

/** Loads and renders the project's existing variation notices, with a running total. */
async function refreshVariationsList(projectId) {
  const $ = (id) => document.getElementById(id);
  const loadingEl = $('vn-list-loading');
  const emptyEl = $('vn-list-empty');
  const listEl = $('vn-list');
  const totalEl = $('vn-list-total');

  loadingEl.hidden = false;
  emptyEl.hidden = true;
  listEl.hidden = true;

  const { data, error } = await supabase
    .from(VARIATION_TABLE)
    .select('id, variation_number, client_name, status, total_cents')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  loadingEl.hidden = true;

  if (error) {
    // Non-fatal for the page as a whole — the save panel above is the
    // primary flow. Keep this quiet rather than stacking a second error
    // banner on top of whatever the save panel already shows.
    console.error('[BIK] Failed to load project variations:', error);
    emptyEl.textContent = 'Could not load the variations list.';
    emptyEl.hidden = false;
    return;
  }

  if (!data.length) {
    emptyEl.hidden = false;
    totalEl.textContent = '';
    return;
  }

  const totalCents = data.reduce((sum, row) => sum + (row.total_cents || 0), 0);
  totalEl.textContent = `Total ${formatAUD(centsToDollars(totalCents))}`;

  listEl.innerHTML = data.map((row) => `
    <li class="vn-list-item">
      <span class="vn-list-item-number">${escapeHtml(row.variation_number)}</span>
      <span class="vn-list-item-client">${escapeHtml(row.client_name)}</span>
      <span class="status-pill status-pill--${escapeHtml(row.status)}">${escapeHtml(row.status)}</span>
      <span class="vn-list-item-amount">${formatAUD(centsToDollars(row.total_cents))}</span>
    </li>
  `).join('');
  listEl.hidden = false;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}
