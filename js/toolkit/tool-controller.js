/**
 * ToolController — Standard Tool Wiring
 *
 * Mounts and wires a BIK tool: FormEngine, DocumentRenderer, ExportManager,
 * AI Writer, Document History, email workflow, mobile tabs, progress bar,
 * autosave indicator, and draft banner.
 *
 * Every tool uses this. Each tool's index.js is ~30 lines.
 *
 * Usage:
 *   import { ToolController } from '../../toolkit/tool-controller.js';
 *   import { SCHEMA, generateDocument, DOC_CONFIG } from './config.js';
 *   new ToolController(SCHEMA, generateDocument, DOC_CONFIG).mount();
 */

import { FormEngine }        from './engine.js';
import { DocumentRenderer }  from './renderer.js';
import { ExportManager }     from './exporter.js';
import { AIWriter }          from './ai-writer.js';
import { injectAIAssist, showAIKeyModal } from './ai-writer-ui.js';
import { createTracker }     from './analytics.js';
import { documentHistory }   from './document-history.js';
import { openEmail, generateEmailBody, generateEmailSubject } from './email.js';

export class ToolController {

  /**
   * @param {Array}    schema       — FormEngine SCHEMA
   * @param {Function} generateDoc  — (data, extraState?) => HTML string
   * @param {Object}   config
   *   @param {string}     config.toolId          — 'variation-notice' | 'quote-builder' | etc.
   *   @param {string}     config.toolName         — 'Variation Notice' | 'Quote Builder' | etc.
   *   @param {string}     config.autosaveKey      — localStorage key for draft
   *   @param {string}     config.docPrefix        — 'VN' | 'Q' | 'SOW' | 'SD' | 'DR'
   *   @param {string[]}   [config.aiFields]       — field ids for AI assist
   *   @param {Function}   [config.onCalcUpdate]   — (state, engine, el) => void
   *   @param {Function}   [config.onAfterMount]   — (actions) => void
   *   @param {Function}   [config.getExtraState]  — () => any
   *   @param {Function}   [config.getDocTitle]    — (state, extra) => string
   *   @param {Function}   [config.getDocRef]      — (state) => string
   *   @param {Function}   [config.getEmailData]   — (state, extra) => { subject, body, to }
   *   @param {string}     [config.printSelector]  — CSS selector for print (.doc-page default)
   *   @param {string}     [config.printTitle]     — title for print dialog
   */
  constructor(schema, generateDoc, config) {
    this._schema      = schema;
    this._generateDoc = generateDoc;
    this._cfg         = config;

    this._engine      = null;
    this._renderer    = null;
    this._exporter    = null;
    this._writer      = new AIWriter();
    this._track       = createTracker(config.toolId);
    this._currentDocId = null; // history record for current session
  }

  /** Mount the tool. Expects standard DOM ids to be present. */
  mount() {
    const $ = id => document.getElementById(id);
    const cfg = this._cfg;

    // DOM refs
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
    const tabForm         = $('tab-form');
    const tabPreview      = $('tab-preview');
    const btnGenerate     = $('btn-generate');
    const btnGenerateBottom = $('btn-generate-bottom');
    const btnClear        = $('btn-clear');
    const btnCopy         = $('btn-copy');
    const btnPrint        = $('btn-print');
    const btnEmail        = $('btn-email');
    const btnHistory      = $('btn-history');
    const btnEditToggle   = $('btn-edit-toggle');
    const btnDeleteDraft  = $('btn-delete-draft');
    const btnAISetup      = $('btn-ai-setup');

    // ── Engine ────────────────────────────────────────────────
    this._engine = new FormEngine(this._schema, {
      autosaveKey:   cfg.autosaveKey,
      autosaveDelay: 1200,
      onChange:      state => this._handleChange(state),
      onSave:        ()    => this._handleSave(autosaveDot, autosaveText, btnDeleteDraft),
      onTrack:       this._track
    });

    const printSel   = cfg.printSelector || '.doc-page';
    const printTitle = cfg.printTitle    || cfg.toolName || 'Document';
    this._renderer = new DocumentRenderer(this._generateDoc);
    this._exporter = new ExportManager(printSel, printTitle, this._track);

    // ── Mount form ────────────────────────────────────────────
    this._engine.mount(formContainer);

    // ── After-mount hook (e.g. inject custom sections) ────────
    const actions = {
      engine:    this._engine,
      renderer:  this._renderer,
      toast:     msg => this._toast(msg),
      switchTab: w  => switchTab(w),
      track:     this._track
    };
    cfg.onAfterMount?.(actions);

    // ── AI assist ─────────────────────────────────────────────
    for (const fieldId of (cfg.aiFields || [])) {
      injectAIAssist(fieldId, this._writer, this._engine, this._track, msg => this._toast(msg));
    }
    btnAISetup?.addEventListener('click', () => showAIKeyModal(this._writer, null, msg => this._toast(msg)));

    // ── Resume from history (dashboard ?resume=id param) ──────
    const resumeId = new URLSearchParams(location.search).get('resume');
    if (resumeId) {
      const rec = documentHistory.get(resumeId);
      if (rec) {
        this._engine.reset();
        for (const [id, val] of Object.entries(rec.formData || {})) {
          try { this._engine.setState(id, val); } catch (_) {}
        }
        if (cfg.onRestoreExtra && rec.extraData) cfg.onRestoreExtra(rec.extraData);
        this._currentDocId = rec.id;
        history.replaceState(null, '', location.pathname);
      }
    }

    // ── Initial state ─────────────────────────────────────────
    this._updateProgress(progressFill, progressLabel);
    cfg.onCalcUpdate?.(this._engine.getState(), this._engine, $);

    // ── Draft banner ──────────────────────────────────────────
    if (this._engine.hasDraft() && draftBanner) {
      const info = this._engine.draftInfo();
      if (info?.ts && draftMeta) {
        const d = new Date(info.ts);
        draftMeta.textContent = `Saved ${d.toLocaleDateString('en-AU')} at ${d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`;
      }
      draftBanner.hidden = false;
      $('btn-restore-draft')?.addEventListener('click', () => {
        this._engine.restoreDraft();
        draftBanner.hidden = true;
        this._updateProgress(progressFill, progressLabel);
        cfg.onCalcUpdate?.(this._engine.getState(), this._engine, $);
        this._toast('Draft restored.');
      });
      $('btn-discard-draft')?.addEventListener('click', () => {
        this._engine.clearDraft();
        draftBanner.hidden = true;
        this._toast('Draft discarded.');
      });
    }

    const refreshDeleteBtn = () => {
      if (btnDeleteDraft) btnDeleteDraft.style.display = this._engine.hasDraft() ? '' : 'none';
    };
    refreshDeleteBtn();
    btnDeleteDraft?.addEventListener('click', () => {
      if (!confirm('Delete the saved draft? This cannot be undone.')) return;
      this._engine.clearDraft();
      refreshDeleteBtn();
      this._toast('Saved draft deleted.');
    });

    // ── Generate ──────────────────────────────────────────────
    const generateLabel = btnGenerate?.textContent || 'Generate document';
    const doGenerate = async () => {
      if (!this._engine.validate()) {
        this._toast('Please fill in the required fields (marked *).');
        this._scrollToFirstError(formContainer);
        return;
      }
      if (btnGenerate) { btnGenerate.disabled = true; btnGenerate.textContent = 'Generating…'; }
      try {
        const state      = this._engine.getState();
        const extra      = cfg.getExtraState?.() || null;
        const docData    = extra ? { ...state, _extra: extra } : state;

        await this._renderer.update(docData, previewTarget, { loadingEl, emptyEl: emptyState });
        this._revealActions(btnCopy, btnPrint, btnEmail, btnEditToggle);
        switchTab('preview');
        this._track('document_generated');

        // Save to history
        const title = cfg.getDocTitle?.(state, extra) || `${cfg.toolName} — ${state.projectName || state.clientName || 'Untitled'}`;
        const ref   = cfg.getDocRef?.(state) || '';
        if (this._currentDocId) {
          documentHistory.update(this._currentDocId, { title, reference: ref, formData: state, extraData: extra });
        } else {
          this._currentDocId = documentHistory.save({ toolId: cfg.toolId, title, reference: ref, formData: state, extraData: extra });
        }

      } catch (err) {
        this._toast('Document generation failed — please try again.');
        console.error('[BIK] Generation error:', err);
      } finally {
        if (btnGenerate) { btnGenerate.disabled = false; btnGenerate.textContent = generateLabel; }
      }
    };

    btnGenerate?.addEventListener('click', doGenerate);
    btnGenerateBottom?.addEventListener('click', doGenerate);

    // ── Live re-render ─────────────────────────────────────────
    this._liveTimer = null;

    // ── Clear ─────────────────────────────────────────────────
    btnClear?.addEventListener('click', () => {
      if (!confirm('Clear all fields and start a new document?')) return;
      this._engine.reset();
      this._engine.clearDraft();
      this._currentDocId = null;
      this._updateProgress(progressFill, progressLabel);
      cfg.onCalcUpdate?.(this._engine.getState(), this._engine, $);
      refreshDeleteBtn();
      this._track('form_cleared');
      this._toast('Form cleared — ready for a new document.');
    });

    // ── Copy ──────────────────────────────────────────────────
    btnCopy?.addEventListener('click', async () => {
      if (!this._renderer.hasRendered) { this._toast('Generate a document first.'); return; }
      const ok = await this._exporter.copyText();
      this._toast(ok ? 'Document text copied to clipboard.' : 'Copy failed — select the document and copy manually.');
    });

    // ── Print / PDF ───────────────────────────────────────────
    btnPrint?.addEventListener('click', () => {
      if (!this._renderer.hasRendered) { this._toast('Generate a document first.'); return; }
      this._exporter.print();
    });

    // ── Email ─────────────────────────────────────────────────
    btnEmail?.addEventListener('click', () => {
      if (!this._renderer.hasRendered) { this._toast('Generate a document first.'); return; }
      const state = this._engine.getState();
      const extra = cfg.getExtraState?.() || null;

      let emailOpts;
      if (cfg.getEmailData) {
        emailOpts = cfg.getEmailData(state, extra);
      } else {
        const ref  = cfg.getDocRef?.(state) || '';
        emailOpts = {
          to:      state.clientEmail || '',
          subject: generateEmailSubject(cfg.toolName, ref, state.projectName),
          body:    generateEmailBody({
            toolName:     cfg.toolName,
            reference:    ref,
            clientName:   state.clientName,
            projectName:  state.projectName,
            builderName:  state.builderName,
            builderPhone: state.builderPhone,
            builderEmail: state.builderEmail
          })
        };
      }
      openEmail({ ...emailOpts, toastFn: msg => this._toast(msg) });
      this._track('email_opened');
    });

    // ── Edit mode ─────────────────────────────────────────────
    btnEditToggle?.addEventListener('click', () => {
      if (!this._renderer.hasRendered) { this._toast('Generate a document first.'); return; }
      const on = !this._renderer.isEditing;
      this._renderer.setEditMode(previewTarget, on);
      if (btnEditToggle) {
        btnEditToggle.textContent = on ? 'Lock document' : 'Edit document';
        btnEditToggle.classList.toggle('app-btn--active', on);
      }
      this._toast(on ? 'Edit mode on — click anywhere in the document to edit.' : 'Document locked.');
    });

    // ── History panel ─────────────────────────────────────────
    btnHistory?.addEventListener('click', () => this._showHistoryPanel(cfg, actions));

    // ── Mobile tabs ───────────────────────────────────────────
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

    this._track('tool_opened');
  }

  // ── Private helpers ───────────────────────────────────────────

  _handleChange(state) {
    const $ = id => document.getElementById(id);
    const progressFill  = $('progress-fill');
    const progressLabel = $('progress-label');
    this._updateProgress(progressFill, progressLabel);
    this._cfg.onCalcUpdate?.(state, this._engine, $);

    if (this._renderer?.hasRendered) {
      clearTimeout(this._liveTimer);
      this._liveTimer = setTimeout(async () => {
        try {
          const extra  = this._cfg.getExtraState?.() || null;
          const data   = extra ? { ...state, _extra: extra } : state;
          const loadEl = $('preview-loading');
          await this._renderer.update(data, $('preview-target'), { loadingEl: loadEl });
          if (this._renderer.isEditing) {
            this._renderer.setEditMode($('preview-target'), true);
          }
        } catch (_) {}
      }, 900);
    }
  }

  _handleSave(autosaveDot, autosaveText, btnDeleteDraft) {
    if (autosaveDot) autosaveDot.className = 'autosave-dot saved';
    if (autosaveText) autosaveText.textContent = 'Saved';
    if (btnDeleteDraft) btnDeleteDraft.style.display = this._engine.hasDraft() ? '' : 'none';
    setTimeout(() => {
      if (autosaveDot) autosaveDot.className = 'autosave-dot';
      if (autosaveText) autosaveText.textContent = 'Autosave on';
    }, 2500);
  }

  _updateProgress(fill, label) {
    const pct = this._engine?.completionPct() || 0;
    if (fill)  fill.style.width   = pct + '%';
    if (label) label.textContent  = pct === 100
      ? 'All required fields complete'
      : `${pct}% of required fields complete`;
  }

  _revealActions(...btns) {
    for (const btn of btns) {
      if (btn) btn.disabled = false;
    }
  }

  _scrollToFirstError(container) {
    const first = container?.querySelector('.form-input.error, .form-textarea.error, .form-select.error');
    first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  _toast(msg, duration = 3500) {
    let el = document.getElementById('bik-toast');
    if (!el) {
      el = document.createElement('div');
      el.id        = 'bik-toast';
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

  // ── Document History Panel ────────────────────────────────────

  _showHistoryPanel(cfg, actions) {
    let panel = document.getElementById('history-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id        = 'history-panel';
      panel.className = 'history-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Document history');
      panel.innerHTML = `
        <div class="history-panel-inner">
          <div class="history-panel-header">
            <h2 class="history-panel-title">Recent Documents</h2>
            <button type="button" class="history-panel-close" aria-label="Close history panel">✕</button>
          </div>
          <div class="history-search-wrap">
            <input type="search" id="history-search" class="history-search" placeholder="Search documents…" />
          </div>
          <div class="history-list" id="history-list" aria-live="polite"></div>
        </div>`;
      document.body.appendChild(panel);

      const overlay = document.createElement('div');
      overlay.id        = 'history-overlay';
      overlay.className = 'history-overlay';
      document.body.appendChild(overlay);

      panel.querySelector('.history-panel-close').addEventListener('click', closePanel);
      overlay.addEventListener('click', closePanel);
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && panel.classList.contains('is-open')) closePanel();
      });

      panel.querySelector('#history-search').addEventListener('input', e => {
        renderHistory(e.target.value);
      });
    }

    const renderHistory = (query = '') => {
      const list    = document.getElementById('history-list');
      const records = query
        ? documentHistory.search(query, cfg.toolId)
        : documentHistory.list(cfg.toolId, 30);

      if (records.length === 0) {
        list.innerHTML = `<div class="history-empty">
          <p>No documents yet.</p>
          <p class="history-empty-hint">Generated documents appear here automatically.</p>
        </div>`;
        return;
      }

      list.innerHTML = records.map(rec => {
        const d = new Date(rec.updatedAt);
        const dateStr = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
        return `
          <div class="history-item" data-id="${rec.id}">
            <div class="history-item-meta">
              <span class="history-item-ref">${esc(rec.reference || cfg.toolName)}</span>
              <span class="history-item-date">${dateStr}</span>
            </div>
            <div class="history-item-title">${esc(rec.title)}</div>
            <div class="history-item-actions">
              <button type="button" class="hi-btn hi-btn--load" data-id="${rec.id}">Load</button>
              <button type="button" class="hi-btn hi-btn--dup"  data-id="${rec.id}">Duplicate</button>
              <button type="button" class="hi-btn hi-btn--del"  data-id="${rec.id}">Delete</button>
            </div>
          </div>`;
      }).join('');

      list.querySelectorAll('.hi-btn--load').forEach(btn => {
        btn.addEventListener('click', () => {
          const rec = documentHistory.get(btn.dataset.id);
          if (!rec) return;
          this._engine.reset();
          for (const [id, val] of Object.entries(rec.formData || {})) {
            try { this._engine.setState(id, val); } catch (_) {}
          }
          this._engine._onChange?.(this._engine.getState());
          if (this._cfg.onRestoreExtra && rec.extraData) {
            this._cfg.onRestoreExtra(rec.extraData);
          }
          this._currentDocId = rec.id;
          closePanel();
          this._toast(`"${rec.title}" loaded.`);
        });
      });

      list.querySelectorAll('.hi-btn--dup').forEach(btn => {
        btn.addEventListener('click', () => {
          const newId = documentHistory.duplicate(btn.dataset.id);
          renderHistory(query);
          this._toast('Document duplicated.');
        });
      });

      list.querySelectorAll('.hi-btn--del').forEach(btn => {
        btn.addEventListener('click', () => {
          const rec = documentHistory.get(btn.dataset.id);
          if (!rec) return;
          if (!confirm(`Delete "${rec.title}"?`)) return;
          documentHistory.delete(btn.dataset.id);
          if (this._currentDocId === btn.dataset.id) this._currentDocId = null;
          renderHistory(query);
          this._toast('Document deleted.');
        });
      });
    };

    function closePanel() {
      panel.classList.remove('is-open');
      document.getElementById('history-overlay').classList.remove('is-open');
      document.body.style.overflow = '';
    }

    panel.classList.add('is-open');
    document.getElementById('history-overlay').classList.add('is-open');
    document.body.style.overflow = 'hidden';
    document.getElementById('history-search').value = '';
    renderHistory();
  }
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
