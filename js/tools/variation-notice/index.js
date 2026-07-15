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
import { AIWriter }           from '../../toolkit/ai-writer.js';
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
  const aiWriter = new AIWriter();

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

  // ── AI Writing buttons ───────────────────────────────────────
  injectAIAssist('descriptionOfWork',     aiWriter, engine, track, toast);
  injectAIAssist('reasonForVariation',    aiWriter, engine, track, toast);
  injectAIAssist('exclusionsAssumptions', aiWriter, engine, track, toast);

  $('btn-ai-setup')?.addEventListener('click', () => showAIKeyModal(aiWriter, null, toast));

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

// ── AI Writing Engine — field injection ──────────────────────
// Module-level so it can be reused by other tools in the future.

/**
 * Inject AI rewrite buttons below a textarea field after engine.mount().
 * The same pattern works for any tool — pass the field id and engine instance.
 *
 * @param {string}     fieldId  — SCHEMA field id (textarea fields only)
 * @param {AIWriter}   writer   — shared AIWriter instance
 * @param {FormEngine} engine   — current form engine
 * @param {Function}   track    — analytics tracker
 * @param {Function}   toastFn  — toast notification function
 */
function injectAIAssist(fieldId, writer, engine, track, toastFn) {
  const container = document.getElementById('form-container');
  const fieldWrap = container?.querySelector(`[data-field-id="${fieldId}"]`);
  if (!fieldWrap) return;

  const textarea = fieldWrap.querySelector('textarea');
  if (!textarea) return;

  // Build button bar
  const bar = document.createElement('div');
  bar.className = 'ai-assist-bar';

  const btn1 = document.createElement('button');
  btn1.type = 'button';
  btn1.className = 'ai-btn ai-btn--writing';
  btn1.setAttribute('aria-label', 'Rewrite professionally using AI');
  btn1.innerHTML = '<span class="ai-btn-icon" aria-hidden="true">✦</span> Rewrite Professionally';

  const btn2 = document.createElement('button');
  btn2.type = 'button';
  btn2.className = 'ai-btn ai-btn--contract';
  btn2.setAttribute('aria-label', 'Strengthen for contract protection using AI');
  btn2.innerHTML = '<span class="ai-btn-icon" aria-hidden="true">⚖</span> Strengthen for Contract';

  bar.appendChild(btn1);
  bar.appendChild(btn2);
  textarea.after(bar);

  // Disclaimer shown after first successful rewrite
  function showDisclaimer() {
    if (fieldWrap.querySelector('.ai-disclaimer')) return;
    const d = document.createElement('p');
    d.className = 'ai-disclaimer';
    d.textContent = 'This content is AI-assisted. Please review and ensure it accurately reflects the work completed before issuing.';
    bar.after(d);
  }

  async function handleAI(mode) {
    const text = textarea.value.trim();
    if (!text) {
      toastFn('Enter some text first, then click the AI button.');
      return;
    }
    if (!writer.hasKey()) {
      showAIKeyModal(writer, () => handleAI(mode), toastFn);
      return;
    }

    setLoading(true, mode);
    try {
      const state = engine.getState();
      const rewritten = await writer.write(text, mode, {
        projectName: state.projectName,
        clientName:  state.clientName
      });

      // Set value and fire input event so FormEngine updates its state
      textarea.value = rewritten;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      showDisclaimer();
      track('ai_text_rewritten', { mode, field: fieldId });
      toastFn(mode === 'professional'
        ? 'Text rewritten professionally.'
        : 'Text strengthened for contract protection.');

    } catch (err) {
      if (err.message === 'NO_KEY') {
        showAIKeyModal(writer, () => handleAI(mode), toastFn);
      } else if (err.message === 'INVALID_KEY') {
        writer.clearKey();
        toastFn('API key invalid — please re-enter it.');
        showAIKeyModal(writer, () => handleAI(mode), toastFn);
      } else {
        toastFn(`AI writing failed: ${err.message}`);
        console.error('[BIK AI]', err);
      }
    } finally {
      setLoading(false, mode);
    }
  }

  function setLoading(on, mode) {
    btn1.disabled = on;
    btn2.disabled = on;
    if (on) {
      const activeBtn = mode === 'professional' ? btn1 : btn2;
      activeBtn.classList.add('loading');
      activeBtn.innerHTML = mode === 'professional'
        ? '<span class="ai-btn-icon" aria-hidden="true">✦</span> Rewriting…'
        : '<span class="ai-btn-icon" aria-hidden="true">⚖</span> Strengthening…';
    } else {
      btn1.classList.remove('loading');
      btn2.classList.remove('loading');
      btn1.innerHTML = '<span class="ai-btn-icon" aria-hidden="true">✦</span> Rewrite Professionally';
      btn2.innerHTML = '<span class="ai-btn-icon" aria-hidden="true">⚖</span> Strengthen for Contract';
    }
  }

  btn1.addEventListener('click', () => handleAI('professional'));
  btn2.addEventListener('click', () => handleAI('contract-protection'));
}

// ── AI Key Setup Modal ────────────────────────────────────────

/**
 * Show the API key setup modal. Created once; reused on subsequent calls.
 *
 * @param {AIWriter}      writer    — AIWriter instance
 * @param {Function|null} onSuccess — called after key is saved (retry the AI action)
 * @param {Function}      toastFn   — toast notification function
 */
function showAIKeyModal(writer, onSuccess, toastFn) {
  let modal = document.getElementById('ai-key-modal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ai-key-modal';
    modal.className = 'ai-key-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'ai-modal-title');
    modal.innerHTML = `
      <div class="ai-key-modal-inner">
        <div class="ai-modal-header">
          <span class="ai-modal-icon" aria-hidden="true">&#10022;</span>
          <h2 class="ai-modal-title" id="ai-modal-title">AI Professional Writer Setup</h2>
        </div>
        <p class="ai-modal-body">
          The AI Writer uses Anthropic Claude to rewrite your variation text into professional,
          contract-ready Australian construction language. You supply your own Anthropic API key
          &mdash; it is stored only in this browser and never sent to BIK servers.
        </p>
        <div class="ai-modal-field">
          <label class="form-label" for="ai-key-input">Anthropic API key</label>
          <input type="password" class="form-input" id="ai-key-input"
            placeholder="sk-ant-api03-&hellip;"
            autocomplete="off" spellcheck="false" />
          <span class="field-hint">
            Get a key at
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
              console.anthropic.com/settings/keys</a>
            &mdash; typical cost is a few cents per rewrite.
          </span>
        </div>
        <div class="ai-modal-security">
          <span aria-hidden="true">&#128274;</span>
          Your key is stored only in this browser&rsquo;s local storage on this device.
          It is never transmitted to BIK Solutions servers.
        </div>
        <div class="ai-modal-actions">
          <button class="app-btn app-btn--ghost-dark" id="ai-modal-cancel" type="button">Cancel</button>
          <button class="app-btn app-btn--coral" id="ai-modal-save" type="button">Save key</button>
        </div>
        <div id="ai-modal-clear-wrap" class="ai-modal-clear-wrap" style="display:none">
          <button class="ai-modal-clear-btn" id="ai-modal-clear" type="button">
            Remove saved key from this device
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });
  }

  const keyInput  = document.getElementById('ai-key-input');
  const saveBtn   = document.getElementById('ai-modal-save');
  const cancelBtn = document.getElementById('ai-modal-cancel');
  const clearBtn  = document.getElementById('ai-modal-clear');
  const clearWrap = document.getElementById('ai-modal-clear-wrap');

  clearWrap.style.display = writer.hasKey() ? '' : 'none';
  keyInput.value = '';

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  // Replace nodes to clear stale listeners from previous open
  const newSave = saveBtn.cloneNode(true);
  saveBtn.replaceWith(newSave);
  newSave.addEventListener('click', () => {
    const k = keyInput.value.trim();
    if (!k.startsWith('sk-ant-')) {
      toastFn('That doesn\'t look right — Anthropic keys start with sk-ant-');
      keyInput.focus();
      return;
    }
    writer.setKey(k);
    closeModal();
    toastFn('API key saved. AI writing is ready to use.');
    onSuccess?.();
  });

  const newCancel = cancelBtn.cloneNode(true);
  cancelBtn.replaceWith(newCancel);
  newCancel.addEventListener('click', closeModal);

  const newClear = clearBtn.cloneNode(true);
  clearBtn.replaceWith(newClear);
  newClear.addEventListener('click', () => {
    writer.clearKey();
    closeModal();
    toastFn('API key removed from this device.');
  });

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => keyInput.focus(), 50);
}
