/**
 * DocumentRenderer — BIK Document Intelligence Engine
 * Bridges form state to HTML document output.
 * Supports read-only preview and inline editing via contenteditable.
 *
 * ═══════════════════════════════════════════════════════════════
 * AI_INTEGRATION_POINT
 * Today: generateFn is the tool's local template (synchronous or async).
 *
 * When the AI backend is ready, pass an async generateFn such as:
 *
 *   async (data) => {
 *     const res = await fetch('/api/v1/generate/variation-notice', {
 *       method: 'POST',
 *       headers: {
 *         'Content-Type': 'application/json',
 *         'Authorization': `Bearer ${token}`
 *       },
 *       body: JSON.stringify(data)
 *     });
 *     if (!res.ok) throw new Error(`Generation failed: ${res.status}`);
 *     const { html } = await res.json();
 *     return html;
 *   }
 *
 * No changes required in FormEngine, ExportManager, or any tool page.
 * ═══════════════════════════════════════════════════════════════
 *
 * Usage:
 *   import { DocumentRenderer } from '../../toolkit/renderer.js';
 *   const renderer = new DocumentRenderer(generateDocument);
 *   await renderer.update(data, previewContainer, { loadingEl, emptyEl });
 */
export class DocumentRenderer {
  /**
   * @param {Function} generateFn — (data: Object) => string | Promise<string>
   */
  constructor(generateFn) {
    this._generate    = generateFn;
    this._lastHtml    = null;
    this._hasRendered = false;
    this._editMode    = false;
  }

  /**
   * Render document HTML from data.
   * @param {Object} data
   * @returns {Promise<string>}
   */
  async render(data) {
    const html = await Promise.resolve(this._generate(data));
    this._lastHtml = html;
    this._hasRendered = true;
    return html;
  }

  /**
   * Render and insert into targetEl.
   * Manages loading state; replaces existing .doc-page if present.
   * @param {Object}      data
   * @param {HTMLElement} targetEl
   * @param {Object}      [opts]
   *   @param {HTMLElement} [opts.loadingEl]
   *   @param {HTMLElement} [opts.emptyEl]
   */
  async update(data, targetEl, opts = {}) {
    const { loadingEl, emptyEl } = opts;

    if (loadingEl) loadingEl.classList.add('visible');
    if (emptyEl)   emptyEl.style.display = 'none';

    try {
      const html = await this.render(data);

      const existing = targetEl.querySelector('.doc-page');
      if (existing) existing.remove();

      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      const docPage = wrapper.firstElementChild;

      if (docPage) {
        if (this._editMode) this._applyEditMode(docPage);
        targetEl.appendChild(docPage);
      }
    } finally {
      if (loadingEl) loadingEl.classList.remove('visible');
    }
  }

  // ── Edit mode ───────────────────────────────────────────────

  /** True if the document is currently in edit mode. */
  get isEditing() { return this._editMode; }

  /**
   * Enable or disable inline editing on the rendered document.
   * When enabled, the user can click into the document to make last-minute edits.
   * Edits persist in the DOM only — they are not saved to localStorage.
   * @param {HTMLElement} targetEl — the preview panel element
   * @param {boolean}     on
   */
  setEditMode(targetEl, on) {
    this._editMode = on;
    const docPage = targetEl.querySelector('.doc-page');
    if (!docPage) return;
    if (on) {
      this._applyEditMode(docPage);
    } else {
      this._removeEditMode(docPage);
    }
  }

  _applyEditMode(docPage) {
    docPage.contentEditable = 'true';
    docPage.classList.add('doc-page--editing');
    docPage.setAttribute('aria-label', 'Editable document — click to make changes');
  }

  _removeEditMode(docPage) {
    docPage.contentEditable = 'false';
    docPage.classList.remove('doc-page--editing');
    docPage.removeAttribute('aria-label');
  }

  // ── Accessors ───────────────────────────────────────────────

  get hasRendered() { return this._hasRendered; }
  get lastHtml()    { return this._lastHtml; }
}
