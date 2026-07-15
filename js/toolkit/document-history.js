/**
 * DocumentHistory — Shared Document Storage
 *
 * Saves, retrieves, and manages document records for all BIK tools.
 * Phase 1: localStorage only. Phase 2: Supabase backend.
 *
 * DOCUMENT_HISTORY_STORAGE_POINT — swap _load/_save for server calls.
 */

const HISTORY_KEY   = 'bik-doc-history';
const COUNTERS_KEY  = 'bik-doc-counters';
const MAX_RECORDS   = 200;

/**
 * @typedef {Object} DocRecord
 * @property {string} id          — UUID
 * @property {string} toolId      — 'variation-notice' | 'quote-builder' | etc.
 * @property {string} title       — human-readable title
 * @property {string} reference   — short code e.g. 'VN-001'
 * @property {string} createdAt   — ISO 8601
 * @property {string} updatedAt   — ISO 8601
 * @property {Object} formData    — full form state at generation time
 * @property {Object} [extraData] — optional tool-specific extras (e.g. lineItems)
 */

class DocumentHistoryStore {

  // ── Internal load/save ────────────────────────────────────────

  _load() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  _save(records) {
    try {
      // Trim to MAX_RECORDS newest
      const trimmed = records.slice(0, MAX_RECORDS);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('[BIK History] Storage full:', e.message);
    }
  }

  _loadCounters() {
    try {
      const raw = localStorage.getItem(COUNTERS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  _saveCounters(counters) {
    try {
      localStorage.setItem(COUNTERS_KEY, JSON.stringify(counters));
    } catch {}
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * Return the next sequential reference number for a given prefix.
   * Increments and persists the counter.
   * e.g. getNextNumber('VN') → 'VN-001'
   */
  getNextNumber(prefix) {
    const counters = this._loadCounters();
    const n = (counters[prefix] || 0) + 1;
    counters[prefix] = n;
    this._saveCounters(counters);
    return `${prefix}-${String(n).padStart(3, '0')}`;
  }

  /**
   * Peek at the current counter without incrementing.
   * e.g. peekNextNumber('Q') → 'Q-001'
   */
  peekNextNumber(prefix) {
    const counters = this._loadCounters();
    const n = (counters[prefix] || 0) + 1;
    return `${prefix}-${String(n).padStart(3, '0')}`;
  }

  /**
   * Save a new document to history.
   * @param {{ toolId, title, reference, formData, extraData? }} doc
   * @returns {string} the new document id
   */
  save({ toolId, title, reference, formData, extraData = null }) {
    const id  = this._uuid();
    const now = new Date().toISOString();
    const record = { id, toolId, title, reference, createdAt: now, updatedAt: now, formData };
    if (extraData) record.extraData = extraData;

    const records = this._load();
    records.unshift(record); // newest first
    this._save(records);
    return id;
  }

  /**
   * Update an existing document (e.g. when the user re-generates).
   * @param {string} id
   * @param {{ title?, reference?, formData?, extraData? }} updates
   */
  update(id, updates) {
    const records = this._load();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return false;
    const rec = records[idx];
    if (updates.title)     rec.title     = updates.title;
    if (updates.reference) rec.reference = updates.reference;
    if (updates.formData)  rec.formData  = updates.formData;
    if (updates.extraData !== undefined) rec.extraData = updates.extraData;
    rec.updatedAt = new Date().toISOString();
    // Move to top
    records.splice(idx, 1);
    records.unshift(rec);
    this._save(records);
    return true;
  }

  /**
   * List all documents, optionally filtered by toolId.
   * Returns newest first.
   * @param {string} [toolId]
   * @param {number} [limit=50]
   * @returns {DocRecord[]}
   */
  list(toolId, limit = 50) {
    const records = this._load();
    const filtered = toolId ? records.filter(r => r.toolId === toolId) : records;
    return filtered.slice(0, limit);
  }

  /**
   * Get a single document by id.
   * @param {string} id
   * @returns {DocRecord|null}
   */
  get(id) {
    return this._load().find(r => r.id === id) || null;
  }

  /**
   * Delete a document.
   * @param {string} id
   */
  delete(id) {
    const records = this._load().filter(r => r.id !== id);
    this._save(records);
  }

  /**
   * Duplicate a document.
   * @param {string} id
   * @returns {string|null} new document id
   */
  duplicate(id) {
    const rec = this.get(id);
    if (!rec) return null;
    return this.save({
      toolId:    rec.toolId,
      title:     `${rec.title} (copy)`,
      reference: rec.reference,
      formData:  { ...rec.formData },
      extraData: rec.extraData ? { ...rec.extraData } : undefined
    });
  }

  /**
   * Simple keyword search across title and reference.
   * @param {string} query
   * @param {string} [toolId]
   * @returns {DocRecord[]}
   */
  search(query, toolId) {
    const q = query.toLowerCase().trim();
    if (!q) return this.list(toolId);
    return this.list(toolId, 200).filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.reference.toLowerCase().includes(q)
    );
  }

  /**
   * Return total document count per tool for dashboard display.
   * @returns {Object} e.g. { 'variation-notice': 3, 'quote-builder': 1 }
   */
  countByTool() {
    const records = this._load();
    const counts  = {};
    for (const r of records) {
      counts[r.toolId] = (counts[r.toolId] || 0) + 1;
    }
    return counts;
  }

  /**
   * Rename a document.
   * @param {string} id
   * @param {string} newTitle
   */
  rename(id, newTitle) {
    this.update(id, { title: newTitle.trim() });
  }

  /**
   * Update the approval sub-object on a document record.
   * Merges approvalData into existing record.approval.
   * V1+V2 compatible — V2 portal fields default to null.
   * @param {string} id
   * @param {Object} approvalData  — partial approval fields to merge
   * @returns {boolean}
   */
  updateApproval(id, approvalData) {
    const records = this._load();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return false;
    const rec = records[idx];
    rec.approval = {
      // V1 defaults on first write
      status:              'draft',
      statusUpdatedAt:     null,
      sentAt:              null,
      sentTo:              null,
      sentBy:              null,
      approvedAt:          null,
      rejectedAt:          null,
      notes:               null,
      // V2 portal fields (null in V1)
      portalToken:         null,
      portalUrl:           null,
      portalRequestedAt:   null,
      portalRespondedAt:   null,
      clientIp:            null,
      clientUserAgent:     null,
      clientSignature:     null,
      pdfHash:             null,
      pdfLockedAt:         null,
      auditLog:            [],
      xeroInvoiceId:       null,
      // Merge existing + incoming
      ...(rec.approval || {}),
      ...approvalData
    };
    rec.updatedAt = new Date().toISOString();
    records.splice(idx, 1);
    records.unshift(rec);
    this._save(records);
    return true;
  }

  /** Clear all history for a specific tool (or all if no toolId). */
  clear(toolId) {
    if (!toolId) {
      this._save([]);
    } else {
      const records = this._load().filter(r => r.toolId !== toolId);
      this._save(records);
    }
  }

  // ── Private ───────────────────────────────────────────────────

  _uuid() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
}

export const documentHistory = new DocumentHistoryStore();
