/**
 * FormEngine — BIK Toolkit
 * Renders, validates, and manages state for document generator forms.
 * Each tool passes its SCHEMA array; the engine handles everything else.
 *
 * Usage:
 *   import { FormEngine } from '../../toolkit/engine.js';
 *   const engine = new FormEngine(SCHEMA, { autosaveKey: 'bik-variation', onChange: update });
 *   engine.mount(document.getElementById('form-container'));
 */
export class FormEngine {
  /**
   * @param {Array}  schema  — array of field definition objects (see config.js)
   * @param {Object} options
   *   @param {string}   options.autosaveKey    — localStorage key for draft
   *   @param {number}   [options.autosaveDelay=1200] — ms debounce before saving
   *   @param {Function} [options.onChange]     — called with (state) after any change
   *   @param {Function} [options.onSave]       — called after draft saved
   */
  constructor(schema, options = {}) {
    this._schema = schema;
    this._key = options.autosaveKey || 'bik-form-draft';
    this._delay = options.autosaveDelay ?? 1200;
    this._onChange = options.onChange || null;
    this._onSave = options.onSave || null;
    this._state = {};
    this._container = null;
    this._saveTimer = null;
    this._rendered = false;

    // Seed defaults from schema
    for (const field of schema) {
      const def = typeof field.defaultValue === 'function'
        ? field.defaultValue()
        : (field.defaultValue ?? '');
      this._state[field.id] = def;
    }
  }

  /** Render the form into container element. */
  mount(container) {
    this._container = container;
    container.innerHTML = '';

    const sections = this._groupBySection();

    for (const [sectionTitle, fields] of sections) {
      const section = document.createElement('div');
      section.className = 'form-section';

      if (sectionTitle) {
        const h = document.createElement('h3');
        h.className = 'form-section-title';
        h.textContent = sectionTitle;
        section.appendChild(h);
      }

      // Group fields into rows
      let i = 0;
      while (i < fields.length) {
        const f = fields[i];
        const nextF = fields[i + 1];
        const isHalf = f.width === 'half';
        const nextIsHalf = nextF && nextF.width === 'half';

        const row = document.createElement('div');

        if (isHalf && nextIsHalf) {
          row.className = 'form-row';
          row.appendChild(this._renderField(f));
          row.appendChild(this._renderField(nextF));
          i += 2;
        } else {
          row.className = 'form-row full';
          row.appendChild(this._renderField(f));
          i += 1;
        }

        section.appendChild(row);
      }

      container.appendChild(section);
    }

    this._populateValues();
    this._rendered = true;
  }

  /** Return current form state as plain object. */
  getState() {
    return { ...this._state };
  }

  /** Programmatically set a field value. */
  setState(id, value) {
    this._state[id] = value;
    if (this._rendered) {
      const el = this._container.querySelector(`[data-id="${id}"]`);
      if (el) el.value = value;
    }
  }

  /** Reset all fields to schema defaults. */
  reset() {
    for (const field of this._schema) {
      const def = typeof field.defaultValue === 'function'
        ? field.defaultValue()
        : (field.defaultValue ?? '');
      this._state[field.id] = def;
    }
    if (this._rendered) this._populateValues();
    this._onChange && this._onChange(this.getState());
  }

  /** Validate all fields. Returns true if all valid. */
  validate() {
    let allValid = true;
    for (const field of this._schema) {
      const el = this._container
        ? this._container.querySelector(`[data-id="${field.id}"]`)
        : null;
      if (!this._validateField(field, el)) allValid = false;
    }
    return allValid;
  }

  /** Returns false if any required field is empty. Lightweight — no DOM. */
  isValid() {
    for (const field of this._schema) {
      if (field.required && !String(this._state[field.id] ?? '').trim()) {
        return false;
      }
    }
    return true;
  }

  /** 0–100 completion percentage based on required fields. */
  completionPct() {
    const required = this._schema.filter(f => f.required);
    if (!required.length) return 100;
    const filled = required.filter(f => String(this._state[f.id] ?? '').trim()).length;
    return Math.round((filled / required.length) * 100);
  }

  /** Save current state to localStorage. */
  saveDraft() {
    try {
      localStorage.setItem(this._key, JSON.stringify({
        ts: Date.now(),
        data: this._state
      }));
      this._onSave && this._onSave();
      this._container && this._container.dispatchEvent(
        new CustomEvent('bik:saved', { bubbles: true, detail: { key: this._key } })
      );
    } catch (_) { /* storage quota exceeded — silent fail */ }
  }

  /** Returns saved draft object { ts, data } or null. */
  _loadDraft() {
    try {
      const raw = localStorage.getItem(this._key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  /** True if a saved draft exists. */
  hasDraft() {
    return !!this._loadDraft();
  }

  /** Restore saved draft into form state. Returns draft timestamp or null. */
  restoreDraft() {
    const draft = this._loadDraft();
    if (!draft) return null;
    for (const [id, val] of Object.entries(draft.data)) {
      this._state[id] = val;
    }
    if (this._rendered) this._populateValues();
    this._onChange && this._onChange(this.getState());
    return draft.ts;
  }

  /** Remove saved draft from localStorage. */
  clearDraft() {
    try { localStorage.removeItem(this._key); } catch (_) {}
  }

  // ── Private ────────────────────────────────────────────────

  _groupBySection() {
    const map = new Map();
    for (const field of this._schema) {
      const s = field.section || '';
      if (!map.has(s)) map.set(s, []);
      map.get(s).push(field);
    }
    return map;
  }

  _renderField(field) {
    const wrap = document.createElement('div');
    wrap.className = 'form-field';
    wrap.dataset.fieldId = field.id;

    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = `field-${field.id}`;
    label.innerHTML = field.label + (field.required ? ' <span class="required" aria-hidden="true">*</span>' : '');
    wrap.appendChild(label);

    const input = this._renderInput(field);
    wrap.appendChild(input);

    if (field.hint) {
      const hint = document.createElement('span');
      hint.className = 'field-hint';
      hint.textContent = field.hint;
      wrap.appendChild(hint);
    }

    const err = document.createElement('span');
    err.className = 'field-error';
    err.id = `err-${field.id}`;
    err.setAttribute('aria-live', 'polite');
    err.textContent = field.errorMsg || 'This field is required';
    wrap.appendChild(err);

    return wrap;
  }

  _renderInput(field) {
    let el;

    if (field.type === 'textarea') {
      el = document.createElement('textarea');
      el.className = 'form-textarea';
      el.rows = field.rows || 4;
    } else if (field.type === 'select') {
      el = document.createElement('select');
      el.className = 'form-select';
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = field.placeholder || 'Select…';
      el.appendChild(blank);
      for (const opt of (field.options || [])) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        el.appendChild(o);
      }
    } else {
      el = document.createElement('input');
      el.className = 'form-input';
      el.type = field.type || 'text';
      if (field.placeholder) el.placeholder = field.placeholder;
      if (field.min !== undefined) el.min = field.min;
      if (field.max !== undefined) el.max = field.max;
      if (field.step !== undefined) el.step = field.step;
    }

    el.id = `field-${field.id}`;
    el.dataset.id = field.id;
    if (field.required) el.required = true;
    if (field.autocomplete) el.autocomplete = field.autocomplete;

    el.addEventListener('input', () => this._handleChange(field, el));
    el.addEventListener('blur', () => this._validateField(field, el));

    return el;
  }

  _populateValues() {
    for (const field of this._schema) {
      const el = this._container.querySelector(`[data-id="${field.id}"]`);
      if (el && this._state[field.id] !== undefined) {
        el.value = this._state[field.id];
      }
    }
  }

  _handleChange(field, el) {
    this._state[field.id] = el.value;
    // Clear error state on change
    const errEl = this._container.querySelector(`#err-${field.id}`);
    if (errEl) errEl.classList.remove('visible');
    el.classList.remove('error');

    this._onChange && this._onChange(this.getState());
    this._scheduleAutosave();
  }

  _validateField(field, el) {
    if (!el) return true;
    const val = String(el.value ?? '').trim();
    const errEl = this._container
      ? this._container.querySelector(`#err-${field.id}`)
      : null;

    const isEmpty = !val;
    const invalid = field.required && isEmpty;

    if (el) el.classList.toggle('error', invalid);
    if (errEl) errEl.classList.toggle('visible', invalid);

    return !invalid;
  }

  _scheduleAutosave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.saveDraft(), this._delay);
  }
}
