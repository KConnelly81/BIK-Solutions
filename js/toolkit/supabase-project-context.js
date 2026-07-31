/**
 * Supabase Project Context (Sprint 4)
 *
 * Generic session/project gate for any tool wired to the authenticated
 * Supabase project model — extracted from variation-notice's Sprint 3
 * integration so Sprint 5's tools (Quotes, Progress Claims, ...) don't
 * each re-implement it. A tool using this module owns only its own
 * record-specific logic (field mapping, table/RPC name, validation) —
 * see supabase-record-panel.js for that half.
 *
 * Fixed DOM contract this module expects on the host page (same
 * convention as tool-controller.js's own fixed ids for form-container/
 * preview-target/etc. — a shared controller assumes a shared HTML shape,
 * not a per-tool id mapping):
 *   #sb-loading            — shown until the gate resolves
 *   #sb-project-error            (hidden by default)
 *   #sb-project-error-text
 *   #sb-app-shell           — the tool itself; hidden until gated (no-flash)
 *   #sb-context-org
 *   #sb-context-project
 *
 * Usage (from a tool's own supabase-integration.js):
 *   import { gateOnSupabaseProject } from '../../toolkit/supabase-project-context.js';
 *   gateOnSupabaseProject({
 *     mountTool,                 // (onReady) => void — e.g. index.js's init()
 *     customerFields: 'business_name, first_name, last_name, email', // or null
 *     onGated(project, mountTool) { ... }  // called once the gate passes
 *   });
 */

import { supabase } from '../supabase/client.js';
import { requireSession, friendlyAuthError } from '../supabase/session.js';

/**
 * @param {Object} opts
 * @param {(onReady: (ctx: { engine: any, toast: Function }) => void) => void} opts.mountTool
 *   The tool's own mount function (e.g. js/tools/<tool>/index.js's init()),
 *   which must accept an onReady callback and invoke it once after
 *   ToolController has mounted (see index.js's own JSDoc for why this
 *   indirection exists — ToolController does not expose the engine any
 *   other way).
 * @param {string} [opts.customerFields] — columns to embed from the
 *   linked customer for the one-time snapshot (e.g.
 *   'business_name, first_name, last_name, email'). Omit if the tool has
 *   no client-snapshot concept.
 * @param {(project: Object, mountTool: Function) => void} opts.onGated —
 *   called once session + project are confirmed. Receives the loaded
 *   project row (including organisation_id and, if requested, the
 *   embedded customer) and the same mountTool passed in, so the caller
 *   decides what to do with both (typically: derive a snapshot, mount
 *   the tool, wire its save panel).
 * @param {string} [opts.signInUrl='signin.html']
 */
export async function gateOnSupabaseProject({ mountTool, customerFields, onGated, signInUrl = 'signin.html' }) {
  const $ = (id) => document.getElementById(id);
  const loadingEl = $('sb-loading');
  const errorEl = $('sb-project-error');
  const errorTextEl = $('sb-project-error-text');
  const shellEl = $('sb-app-shell');

  const projectId = new URLSearchParams(location.search).get('project');
  if (!projectId) {
    showGateError(loadingEl, errorEl, errorTextEl, 'No project was specified. Open this tool from a project on your dashboard.');
    return;
  }

  const session = await requireSession(signInUrl);
  if (!session) return; // requireSession already redirected

  const customerEmbed = customerFields ? `, customers ( ${customerFields} )` : '';
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select(`id, name, site_address, organisation_id, organisations ( name )${customerEmbed}`)
    .eq('id', projectId)
    .maybeSingle();

  if (projectError || !project) {
    showGateError(
      loadingEl, errorEl, errorTextEl,
      projectError ? friendlyAuthError(projectError) : 'This project could not be found in your organisation.'
    );
    return;
  }

  loadingEl.hidden = true;
  shellEl.hidden = false;
  const orgEl = $('sb-context-org');
  const projEl = $('sb-context-project');
  if (orgEl) orgEl.textContent = project.organisations?.name || 'Your organisation';
  if (projEl) projEl.textContent = project.name;

  onGated(project, mountTool);
}

function showGateError(loadingEl, errorEl, errorTextEl, message) {
  loadingEl.hidden = true;
  errorTextEl.textContent = message;
  errorEl.hidden = false;
}

/**
 * One-time field snapshot from a loaded project (+ optionally embedded
 * customer) onto a FormEngine instance. Only sets a field that is still
 * blank, so it never overwrites a restored local draft or a document
 * loaded from history. `fieldMap` supplies the actual values (kept as a
 * plain object here, not derived, so this stays a thin DOM-writing
 * helper — each tool's own pure `deriveXSnapshot()` function, tested in
 * isolation, is what computes `fieldMap`; see variation-save-logic.js's
 * deriveClientSnapshot() for the pattern).
 */
export function applySnapshotOnce(engine, fieldMap) {
  const current = engine.getState();
  for (const [field, value] of Object.entries(fieldMap)) {
    if (value && !String(current[field] || '').trim()) {
      engine.setState(field, value);
    }
  }
}
