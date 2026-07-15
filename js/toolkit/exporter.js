/**
 * ExportManager — BIK Document Intelligence Engine
 * Handles print-to-PDF and clipboard export from the document preview.
 * Accepts an optional analytics callback for event tracking.
 *
 * Usage:
 *   import { ExportManager } from '../../toolkit/exporter.js';
 *   const exporter = new ExportManager('.doc-page', 'Variation Notice', track);
 *   exporter.print();
 *   await exporter.copyText();
 */
export class ExportManager {
  /**
   * @param {string}    docSelector — CSS selector for the doc-page element
   * @param {string}    toolTitle   — used as the print document title
   * @param {Function}  [onTrack]   — optional analytics callback (name, props) => void
   */
  constructor(docSelector, toolTitle, onTrack) {
    this._selector = docSelector;
    this._title    = toolTitle;
    this._onTrack  = onTrack || null;
  }

  /**
   * Trigger browser print dialog. User saves as PDF from there.
   * Sets document.title temporarily for a meaningful default filename.
   */
  print() {
    const prev = document.title;
    document.title = this._title + ' — BIK Solutions';
    window.print();
    // Restore async — Chrome reads the title before the dialog appears
    setTimeout(() => { document.title = prev; }, 1200);
    this._onTrack && this._onTrack('pdf_downloaded');
  }

  /**
   * Copy document text to clipboard.
   * Captures current DOM state, including any inline edits by the user.
   * @returns {Promise<boolean>} true on success
   */
  async copyText() {
    const el = document.querySelector(this._selector);
    if (!el) return false;

    const text = this._extractText(el);
    let ok = false;

    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (_) {
      ok = this._execCommandCopy(text);
    }

    this._onTrack && this._onTrack('text_copied', { success: ok });
    return ok;
  }

  // ── Private ────────────────────────────────────────────────

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
    if (['script','style','svg'].includes(tag)) return;

    const blockTags = ['div','p','h1','h2','h3','h4','td','tr','li','section','article'];
    const breakTags = ['br','hr'];

    if (breakTags.includes(tag)) { lines.push(''); return; }

    const before = blockTags.includes(tag) ? lines.length : -1;
    for (const child of node.childNodes) {
      this._walkNode(child, lines);
    }
    if (before !== -1 && lines.length > before) lines.push('');
  }

  _execCommandCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
    return ok;
  }
}
