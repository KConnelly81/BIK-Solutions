/**
 * ExportManager — BIK Toolkit
 * Handles print-to-PDF and clipboard export from the document preview.
 *
 * Usage:
 *   import { ExportManager } from '../../toolkit/exporter.js';
 *   const exporter = new ExportManager('.doc-page', 'Variation Notice');
 *   exporter.print();
 *   await exporter.copyText();
 */
export class ExportManager {
  /**
   * @param {string} docSelector — CSS selector for the doc-page element
   * @param {string} toolTitle   — used as the document title on print
   */
  constructor(docSelector, toolTitle) {
    this._selector = docSelector;
    this._title = toolTitle;
  }

  /**
   * Trigger browser print dialog (user saves as PDF).
   * Temporarily sets document.title so the default filename is meaningful.
   */
  print() {
    const prev = document.title;
    document.title = this._title + ' — BIK Solutions';
    window.print();
    // Restore async so Chrome has time to read the title
    setTimeout(() => { document.title = prev; }, 1000);
  }

  /**
   * Copy document text content to clipboard.
   * Returns true on success, false on failure.
   * @returns {Promise<boolean>}
   */
  async copyText() {
    const el = document.querySelector(this._selector);
    if (!el) return false;

    const text = this._extractText(el);

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      // execCommand fallback for older browsers / restricted contexts
      return this._execCommandCopy(text);
    }
  }

  // ── Private ────────────────────────────────────────────────

  /** Walk the doc and produce clean readable text. */
  _extractText(el) {
    const lines = [];
    this._walkNode(el, lines);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  _walkNode(node, lines) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent.trim();
      if (t) lines.push(t);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();
    const blockTags = ['div','p','h1','h2','h3','h4','td','tr','li','section'];
    const breakTags = ['br','hr'];

    if (breakTags.includes(tag)) { lines.push(''); return; }

    const before = blockTags.includes(tag) ? lines.length : -1;

    for (const child of node.childNodes) {
      this._walkNode(child, lines);
    }

    if (before !== -1 && lines.length > before) {
      lines.push('');
    }
  }

  _execCommandCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
    return ok;
  }
}
