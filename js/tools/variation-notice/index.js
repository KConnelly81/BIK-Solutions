/**
 * Variation Notice Tool — Entry Point
 * Wires FormEngine + DocumentRenderer + ExportManager together.
 *
 * This file is the only tool-specific wiring. The engine, renderer, and
 * exporter are fully reusable for every future document generator.
 */

import { FormEngine }       from '../../toolkit/engine.js';
import { DocumentRenderer } from '../../toolkit/renderer.js';
import { ExportManager }    from '../../toolkit/exporter.js';
import { SCHEMA, generateDocument } from './config.js';

export function init() {
  // ── DOM refs ────────────────────────────────────────────────
  const formContainer   = document.getElementById('form-container');
  const previewPanel    = document.getElementById('preview-panel');
  const emptyState      = document.getElementById('preview-empty');
  const loadingEl       = document.getElementById('preview-loading');
  const progressFill    = document.getElementById('progress-fill');
  const progressLabel   = document.getElementById('progress-label');
  const autosaveDot     = document.getElementById('autosave-dot');
  const autosaveText    = document.getElementById('autosave-text');
  const draftBanner     = document.getElementById('draft-banner');
  const btnGenerate     = document.getElementById('btn-generate');
  const btnClear        = document.getElementById('btn-clear');
  const btnCopy         = document.getElementById('btn-copy');
  const btnPrint        = document.getElementById('btn-print');
  const tabForm         = document.getElementById('tab-form');
  const tabPreview      = document.getElementById('tab-preview');

  // ── Engine setup ────────────────────────────────────────────
  const engine = new FormEngine(SCHEMA, {
    autosaveKey:   'bik-variation-draft',
    autosaveDelay: 1200,
    onChange:      handleChange,
    onSave:        handleSave
  });

  const renderer = new DocumentRenderer(generateDocument);
  const exporter = new ExportManager('.doc-page', 'Variation Notice');

  // ── Mount form ──────────────────────────────────────────────
  engine.mount(formContainer);
  updateProgress();

  // ── Draft restoration ────────────────────────────────────────
  if (engine.hasDraft() && draftBanner) {
    draftBanner.hidden = false;

    document.getElementById('btn-restore-draft').addEventListener('click', () => {
      const ts = engine.restoreDraft();
      draftBanner.hidden = true;
      if (ts) toast(`Draft from ${new Date(ts).toLocaleTimeString('en-AU')} restored.`);
      updateProgress();
    });

    document.getElementById('btn-discard-draft').addEventListener('click', () => {
      engine.clearDraft();
      draftBanner.hidden = true;
      toast('Draft discarded.');
    });
  }

  // ── Generate ─────────────────────────────────────────────────
  btnGenerate.addEventListener('click', async () => {
    if (!engine.validate()) {
      toast('Please fill in the required fields.');
      scrollToFirstError();
      return;
    }

    btnGenerate.disabled = true;
    btnGenerate.textContent = 'Generating…';

    try {
      await renderer.update(engine.getState(), previewPanel, {
        loadingEl,
        emptyEl: emptyState
      });
      showPreviewActions();
      switchTab('preview');
    } catch (err) {
      toast('Could not generate document. Please try again.');
      console.error('[BIK] Document generation error:', err);
    } finally {
      btnGenerate.disabled = false;
      btnGenerate.textContent = 'Generate document';
    }
  });

  // ── Live re-render after first generation ────────────────────
  function handleChange(state) {
    updateProgress();
    if (renderer.hasRendered) {
      scheduleLiveUpdate(state);
    }
  }

  let liveTimer = null;
  function scheduleLiveUpdate(state) {
    if (liveTimer) clearTimeout(liveTimer);
    liveTimer = setTimeout(async () => {
      try {
        await renderer.update(state, previewPanel, { loadingEl });
      } catch (_) {}
    }, 600);
  }

  // ── Autosave UI ──────────────────────────────────────────────
  function handleSave() {
    if (!autosaveDot || !autosaveText) return;
    autosaveDot.className = 'autosave-dot saved';
    autosaveText.textContent = 'Saved';
    setTimeout(() => {
      autosaveDot.className = 'autosave-dot';
      autosaveText.textContent = 'Autosave on';
    }, 2500);
  }

  // Pulse dot while typing
  formContainer.addEventListener('input', () => {
    if (!autosaveDot) return;
    autosaveDot.className = 'autosave-dot saving';
    autosaveText && (autosaveText.textContent = 'Saving…');
  });

  // ── Progress bar ─────────────────────────────────────────────
  function updateProgress() {
    const pct = engine.completionPct();
    if (progressFill) progressFill.style.width = pct + '%';
    if (progressLabel) progressLabel.textContent = pct + '% complete';
  }

  // ── Clear form ───────────────────────────────────────────────
  btnClear && btnClear.addEventListener('click', () => {
    if (!confirm('Clear all fields and start again?')) return;
    engine.reset();
    engine.clearDraft();
    updateProgress();
    toast('Form cleared.');
  });

  // ── Copy to clipboard ────────────────────────────────────────
  btnCopy && btnCopy.addEventListener('click', async () => {
    if (!renderer.hasRendered) {
      toast('Generate a document first.');
      return;
    }
    const ok = await exporter.copyText();
    toast(ok ? 'Document copied to clipboard.' : 'Copy failed — try selecting and copying manually.');
  });

  // ── Print / PDF ───────────────────────────────────────────────
  btnPrint && btnPrint.addEventListener('click', () => {
    if (!renderer.hasRendered) {
      toast('Generate a document first.');
      return;
    }
    exporter.print();
  });

  // ── Mobile tabs ───────────────────────────────────────────────
  tabForm && tabForm.addEventListener('click', () => switchTab('form'));
  tabPreview && tabPreview.addEventListener('click', () => switchTab('preview'));

  function switchTab(which) {
    const formPanel = document.getElementById('form-panel');
    const prevPanel = document.getElementById('preview-panel-wrap');

    if (which === 'preview') {
      formPanel && (formPanel.classList.add('hidden-mobile'));
      prevPanel && (prevPanel.classList.remove('hidden-mobile'));
      tabPreview && tabPreview.classList.add('active');
      tabForm && tabForm.classList.remove('active');
    } else {
      formPanel && (formPanel.classList.remove('hidden-mobile'));
      prevPanel && (prevPanel.classList.add('hidden-mobile'));
      tabForm && tabForm.classList.add('active');
      tabPreview && tabPreview.classList.remove('active');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  function showPreviewActions() {
    btnCopy && (btnCopy.disabled = false);
    btnPrint && (btnPrint.disabled = false);
  }

  function scrollToFirstError() {
    const first = formContainer.querySelector('.form-input.error, .form-textarea.error, .form-select.error');
    first && first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function toast(msg, duration = 3000) {
    let el = document.getElementById('bik-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bik-toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), duration);
  }
}
