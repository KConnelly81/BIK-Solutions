/**
 * DocumentRenderer — BIK Toolkit
 * Bridges form state to HTML document output.
 *
 * Accepts a generateFn: (data) => string | Promise<string>
 * Today: generateFn is the tool's local template function.
 *
 * ═══════════════════════════════════════════════════════════════
 * AI_INTEGRATION_POINT
 * When the AI backend is ready, swap generateFn for:
 *
 *   async (data) => {
 *     const res = await fetch('/api/v1/generate/variation-notice', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
 *       body: JSON.stringify(data)
 *     });
 *     if (!res.ok) throw new Error('Generation failed');
 *     const { html } = await res.json();
 *     return html;
 *   }
 *
 * No changes required to FormEngine, ExportManager, or the tool page.
 * ═══════════════════════════════════════════════════════════════
 *
 * Usage:
 *   import { DocumentRenderer } from '../../toolkit/renderer.js';
 *   const renderer = new DocumentRenderer(generateDocument);
 *   await renderer.update(data, previewContainer);
 */
export class DocumentRenderer {
  /**
   * @param {Function} generateFn — async (data: Object) => htmlString: string
   */
  constructor(generateFn) {
    this._generate = generateFn;
    this._lastHtml = null;
    this._hasRendered = false;
  }

  /**
   * Render document HTML from data. Returns the HTML string.
   * @param {Object} data — form state
   * @returns {Promise<string>}
   */
  async render(data) {
    const html = await Promise.resolve(this._generate(data));
    this._lastHtml = html;
    this._hasRendered = true;
    return html;
  }

  /**
   * Render and insert into targetEl, managing loading state.
   * Replaces inner content; keeps the container element intact.
   * @param {Object}      data     — form state
   * @param {HTMLElement} targetEl — the preview panel inner element
   * @param {Object}      [opts]
   *   @param {HTMLElement} [opts.loadingEl] — element to show while loading
   *   @param {HTMLElement} [opts.emptyEl]   — empty state element to hide
   */
  async update(data, targetEl, opts = {}) {
    const { loadingEl, emptyEl } = opts;

    if (loadingEl) loadingEl.classList.add('visible');
    if (emptyEl) emptyEl.style.display = 'none';

    try {
      const html = await this.render(data);

      // Remove existing doc-page if present
      const existing = targetEl.querySelector('.doc-page');
      if (existing) existing.remove();

      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      const docPage = wrapper.firstElementChild;
      if (docPage) targetEl.appendChild(docPage);

    } finally {
      if (loadingEl) loadingEl.classList.remove('visible');
    }
  }

  /** True after at least one successful render. */
  get hasRendered() { return this._hasRendered; }

  /** Return the last rendered HTML string, or null. */
  get lastHtml() { return this._lastHtml; }
}
