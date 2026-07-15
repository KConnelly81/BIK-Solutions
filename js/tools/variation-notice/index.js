/**
 * Variation Notice — Tool Entry Point
 * Wires FormEngine + DocumentRenderer + ExportManager + Calculator + Analytics.
 *
 * This is the only file specific to this tool's behaviour.
 * Engine modules are reused without modification.
 */

import { FormEngine }         from '../../toolkit/engine.js';
import { DocumentRenderer }   from '../../toolkit/renderer.js';
import { ExportManager }      from '../../toolkit/exporter.js';
import { createTracker }      from '../../toolkit/analytics.js';
import { calcGST, calcTotal, formatAUD } from '../../toolkit/calculator.js';
import { SCHEMA, generateDocument } from './config.js';

export function init() {

  // ── Analytics ────────────────────────────────────────────────
  const track = createTracker('variation-notice');
  track('tool_opened');

  // ── DOM refs ─────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  const formContainer   = $('form-container');
  const previewTarget   = $('preview-target');
  const emptyState      = $('preview-empty');
  const loadingEl       = $('preview-loading');
  const progressFill    = $('progress-fill');
  const progressLabel   = $('progress-label');
  const autosaveDot     = $('autosave-dot');
  const autosaveText    = $('autosave-text');
  const draftBanner     = $('draft-banner');
  const draftMeta       = $('draft-meta');
  const calcSummary     = $('calc-summary');
  const calcExcl        = $('calc-excl');
  const calcGST_        = $('calc-gst');
  const calcTotal_      = $('calc-total');
  const calcGSTRow      = $('calc-gst-row');
  const btnGenerate     = $('btn-generate');
  const btnClear        = $('btn-clear');
  const btnCopy         = $('btn-copy');
  const btnPrint        = $('btn-print');
  const btnEditToggle   = $('btn-edit-toggle');
  const btnDeleteDraft  = $('btn-delete-draft');
  const tabForm         = $('tab-form');
  const tabPreview      = $('tab-preview');

  // ── Engine ───────────────────────────────────────────────────
  const engine = new FormEngine(SCHEMA, {
    autosaveKey:   'bik-variation-draft',
    autosaveDelay: 1200,
    onChange:      handleChange,
    onSave:        handleSave,
    onTrack:       track
  });

  const renderer = new DocumentRenderer(generateDocument);
  const exporter = new ExportManager('.doc-page', 'Variation Notice', track);

  // ── Mount form ───────────────────────────────────────────────
  engine.mount(formContainer);

  // Inject the live calc summary after the "Cost and Time" section
  if (calcSummary) {
    const sections = formContainer.querySelectorAll('.form-section');
    let costSection = null;
    sections.forEach(s => {
      const title = s.querySelector('.form-section-title');
      if (title && title.textContent.includes('Cost')) costSection = s;
    });
    if (costSection) {
      costSection.after(calcSummary);
      calcSummary.hidden = false;
    }
  }

  updateProgress();
  updateCalcSummary(engine.getState());

  // ── Draft banner ─────────────────────────────────────────────
  if (engine.hasDraft() && draftBanner) {
    const info = engine.draftInfo();
    if (info?.ts && draftMeta) {
      const d = new Date(info.ts);
      draftMeta.textContent = `Saved ${d.toLocaleDateString('en-AU')} at ${d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`;
    }
    draftBanner.hidden = false;

    $('btn-restore-draft')?.addEventListener('click', () => {
      const ts = engine.restoreDraft();
      draftBanner.hidden = true;
      updateProgress();
      updateCalcSummary(engine.getState());
      toast('Draft restored.');
    });

    $('btn-discard-draft')?.addEventListener('click', () => {
      engine.clearDraft();
      draftBanner.hidden = true;
      toast('Draft discarded — form reset to defaults.');
    });
  }

  // ── Delete draft button (always visible when draft exists) ───
  function refreshDeleteButton() {
    if (!btnDeleteDraft) return;
    btnDeleteDraft.style.display = engine.hasDraft() ? '' : 'none';
  }
  refreshDeleteButton();

  btnDeleteDraft?.addEventListener('click', () => {
    if (!confirm('Delete the saved draft? This cannot be undone.')) return;
    engine.clearDraft();
    refreshDeleteButton();
    toast('Saved draft deleted from this device.');
  });

  // ── Generate ─────────────────────────────────────────────────
  btnGenerate?.addEventListener('click', async () => {
    if (!engine.validate()) {
      toast('Please fill in the required fields (marked with *).');
      scrollToFirstError();
      return;
    }

    setGenerating(true);
    try {
      const data = engine.getState();
      await renderer.update(data, previewTarget, {
        loadingEl,
        emptyEl: emptyState
      });
      revealPreviewActions();
      switchTab('preview');
      track('document_generated');
    } catch (err) {
      toast('Document generation failed — please try again.');
      console.error('[BIK] Generation error:', err);
    } finally {
      setGenerating(false);
    }
  });

  function setGenerating(on) {
    if (!btnGenerate) return;
    btnGenerate.disabled = on;
    btnGenerate.textContent = on ? 'Generating…' : 'Generate document';
  }

  // ── Live re-render ───────────────────────────────────────────
  let liveTimer = null;
  function handleChange(state) {
    updateProgress();
    updateCalcSummary(state);
    if (renderer.hasRendered) {
      if (liveTimer) clearTimeout(liveTimer);
      liveTimer = setTimeout(async () => {
        try {
          await renderer.update(state, previewTarget, { loadingEl });
          if (renderer.isEditing) {
            renderer.setEditMode(previewTarget, true);
          }
        } catch (_) {}
      }, 800);
    }
  }

  // ── Autosave status ──────────────────────────────────────────
  function handleSave() {
    if (autosaveDot) autosaveDot.className = 'autosave-dot saved';
    if (autosaveText) autosaveText.textContent = 'Saved';
    refreshDeleteButton();
    setTimeout(() => {
      if (autosaveDot) autosaveDot.className = 'autosave-dot';
      if (autosaveText) autosaveText.textContent = 'Autosave on';
    }, 2500);
  }

  formContainer?.addEventListener('input', () => {
    if (autosaveDot) autosaveDot.className = 'autosave-dot saving';
    if (autosaveText) autosaveText.textContent = 'Saving…';
  });

  // ── Progress ─────────────────────────────────────────────────
  function updateProgress() {
    const pct = engine.completionPct();
    if (progressFill) progressFill.style.width = pct + '%';
    if (progressLabel) {
      progressLabel.textContent = pct === 100
        ? 'All required fields complete'
        : `${pct}% of required fields complete`;
    }
  }

  // ── Live GST calculator in form ───────────────────────────────
  function updateCalcSummary(state) {
    if (!calcSummary) return;
    const cost  = parseFloat(state.additionalCost) || 0;
    const hasGST = state.gstApplicable === 'yes';
    const gst   = calcGST(cost, hasGST);
    const total = calcTotal(cost, hasGST);

    if (calcExcl)   calcExcl.textContent   = formatAUD(cost);
    if (calcGST_)   calcGST_.textContent   = hasGST ? formatAUD(gst) : 'Not applicable';
    if (calcTotal_) calcTotal_.textContent  = formatAUD(total);
    if (calcGSTRow) calcGSTRow.style.display = '';
    calcSummary.hidden = false;
  }

  // ── Clear ─────────────────────────────────────────────────────
  btnClear?.addEventListener('click', () => {
    if (!confirm('Clear all fields and start a new variation?')) return;
    engine.reset();
    engine.clearDraft();
    updateProgress();
    updateCalcSummary(engine.getState());
    refreshDeleteButton();
    track('form_cleared');
    toast('Form cleared — ready for a new variation.');
  });

  // ── Copy ──────────────────────────────────────────────────────
  btnCopy?.addEventListener('click', async () => {
    if (!renderer.hasRendered) { toast('Generate a document first.'); return; }
    const ok = await exporter.copyText();
    toast(ok
      ? 'Document text copied to clipboard.'
      : 'Copy failed — try selecting the document and copying manually.');
  });

  // ── Print / PDF ───────────────────────────────────────────────
  btnPrint?.addEventListener('click', () => {
    if (!renderer.hasRendered) { toast('Generate a document first.'); return; }
    exporter.print();
  });

  // ── Edit mode toggle ──────────────────────────────────────────
  btnEditToggle?.addEventListener('click', () => {
    if (!renderer.hasRendered) { toast('Generate a document first.'); return; }
    const on = !renderer.isEditing;
    renderer.setEditMode(previewTarget, on);
    btnEditToggle.textContent = on ? 'Lock document' : 'Edit document';
    btnEditToggle.classList.toggle('app-btn--active', on);
    toast(on
      ? 'Edit mode on — click anywhere in the document to make changes.'
      : 'Document locked. Changes saved for printing.');
  });

  // ── Mobile tabs ───────────────────────────────────────────────
  tabForm?.addEventListener('click',    () => switchTab('form'));
  tabPreview?.addEventListener('click', () => switchTab('preview'));

  function switchTab(which) {
    const formPanel    = $('form-panel');
    const previewPanel = $('preview-panel-wrap');
    if (which === 'preview') {
      formPanel?.classList.add('hidden-mobile');
      previewPanel?.classList.remove('hidden-mobile');
      tabPreview?.classList.add('active');
      tabPreview?.setAttribute('aria-pressed', 'true');
      tabForm?.classList.remove('active');
      tabForm?.setAttribute('aria-pressed', 'false');
    } else {
      formPanel?.classList.remove('hidden-mobile');
      previewPanel?.classList.add('hidden-mobile');
      tabForm?.classList.add('active');
      tabForm?.setAttribute('aria-pressed', 'true');
      tabPreview?.classList.remove('active');
      tabPreview?.setAttribute('aria-pressed', 'false');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  function revealPreviewActions() {
    if (btnCopy)       btnCopy.disabled = false;
    if (btnPrint)      btnPrint.disabled = false;
    if (btnEditToggle) btnEditToggle.disabled = false;
  }

  function scrollToFirstError() {
    const first = formContainer?.querySelector('.form-input.error, .form-textarea.error, .form-select.error');
    first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function toast(msg, duration = 3500) {
    let el = document.getElementById('bik-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bik-toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), duration);
  }
}
