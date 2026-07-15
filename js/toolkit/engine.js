/**
 * FormEngine — BIK Document Intelligence Engine
 * Renders, validates, and manages state for document generator forms.
 * Each tool supplies its SCHEMA; the engine handles everything else.
 *
 * SUPPORTED FIELD TYPES:
 *   text, number, date, email, tel, textarea, select, radio
 *
 * PROFILE FIELDS:
 *   Fields with `profile: true` are persisted separately under the
 *   `bik-builder-profile` key so they auto-fill across every tool.
 *   Users fill their business details once; they travel with every doc.
 *
 * Usage:
 *   import { FormEngine } from '../../toolkit/engine.js';
 *   const engine = new FormEngine(SCHEMA, { autosaveKey: 'bik-variation', onChange: cb });
 *   engine.mount(document.getElementById('form-container'));
 */
export class FormEngine {
  /**
   * @param {Array}  schema
   * @param {Object} options
   *   @param {string}   options.autosaveKey
   *   @param {number}   [options.autosaveDelay=1200]
   *   @param {Function} [options.onChange]  — (state) => void
   *   @param {Function} [options.onSave]    — () => void
   *   @param {Function} [options.onTrack]   — analytics callback (name, props) => void
   */
  constructor(schema, options = {}) {
    this._schema      = schema;
    this._key         = options.autosaveKey || 'bik-form-draft';
    this._profileKey  = 'bik-builder-profile';
    this._delay       = options.autosaveDelay ?? 1200;
    this._onChange    = options.onChange  || null;
    this._onSave      = options.onSave    || null;
    this._onTrack     = options.onTrack   || null;
    this._state       = {};
    this._container   = null;
    this._saveTimer   = null;
    this._rendered    = false;

    // Seed state from schema defaults
    for (const field of schema) {
      const def = typeof field.defaultValue === 'function'
        ? field.defaultValue()
        : (field.defaultValue ?? '');
      this._state[field.id] = def;
    }

    // Overlay saved builder profile values
    this._applyProfile();
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

      // Group half-width fields into rows
      let i = 0;
      while (i < fields.length) {
        const f    = fields[i];
        const next = fields[i + 1];

        // Radio groups always get a full-width row
        if (f.type === 'radio') {
          const row = document.createElement('div');
          row.className = 'form-row full';
          row.appendChild(this._renderField(f));
          section.appendChild(row);
          i++;
          continue;
        }

        const isHalf      = f.width === 'half';
        const nextIsHalf  = next && next.type !== 'radio' && next.width === 'half';

        const row = document.createElement('div');
        if (isHalf && nextIsHalf) {
          row.className = 'form-row';
          row.appendChild(this._renderField(f));
          row.appendChild(this._renderField(next));
          i += 2;
        } else {
          row.className = 'form-row full';
          row.appendChild(this._renderField(f));
          i++;
        }
        section.appendChild(row);
      }

      container.appendChild(section);
    }

    this._populateValues();
    this._rendered = true;
  }

  /** Current form state as plain object. */
  getState() {
    return { ...this._state };
  }

  /** Programmatically set a single field value. */
  setState(id, value) {
    this._state[id] = value;
    if (!this._rendered) return;
    const field = this._schema.find(f => f.id === id);
    if (field && field.type === 'radio') {
      const radios = this._container.querySelectorAll(`[name="radio-${id}"]`);
      radios.forEach(r => { r.checked = r.value === value; });
    } else {
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

  /** Validate all fields. Adds error classes. Returns true if all valid. */
  validate() {
    let allValid = true;
    for (const field of this._schema) {
      const errEl = this._container
        ? this._container.querySelector(`#err-${field.id}`)
        : null;
      if (!this._validateField(field, errEl)) allValid = false;
    }
    if (!allValid) {
      this._onTrack && this._onTrack('validation_error', {
        missing: this._schema
          .filter(f => f.required && !String(this._state[f.id] ?? '').trim())
          .map(f => f.id)
          .join(',')
      });
    }
    return allValid;
  }

  /** Returns false if any required field is empty. Lightweight — no DOM. */
  isValid() {
    return this._schema
      .filter(f => f.required)
      .every(f => String(this._state[f.id] ?? '').trim());
  }

  /** 0–100 completion percentage based on required fields. */
  completionPct() {
    const required = this._schema.filter(f => f.required);
    if (!required.length) return 100;
    const filled = required.filter(f => String(this._state[f.id] ?? '').trim()).length;
    return Math.round((filled / required.length) * 100);
  }

  // ── Draft management ────────────────────────────────────────

  saveDraft() {
    try {
      localStorage.setItem(this._key, JSON.stringify({
        v: 1,
        ts: Date.now(),
        data: this._state
      }));
      // Persist profile fields separately
      this._saveProfile();
      this._onSave && this._onSave();
      this._onTrack && this._onTrack('draft_saved');
      this._container && this._container.dispatchEvent(
        new CustomEvent('bik:saved', { bubbles: true, detail: { key: this._key } })
      );
    } catch (_) { /* storage quota exceeded — silent */ }
  }

  hasDraft() {
    return !!this._readDraft();
  }

  /**
   * Return public metadata about the saved draft.
   * @returns {{ ts: number, fieldCount: number } | null}
   */
  draftInfo() {
    const d = this._readDraft();
    if (!d) return null;
    return {
      ts:         d.ts || 0,
      fieldCount: d.data ? Object.keys(d.data).length : 0
    };
  }

  /** Restore saved draft. Returns timestamp (ms) or null. */
  restoreDraft() {
    const draft = this._readDraft();
    if (!draft) return null;
    for (const [id, val] of Object.entries(draft.data)) {
      if (id in this._state) this._state[id] = val;
    }
    if (this._rendered) this._populateValues();
    this._onChange && this._onChange(this.getState());
    this._onTrack && this._onTrack('draft_restored');
    return draft.ts;
  }

  clearDraft() {
    try {
      localStorage.removeItem(this._key);
      this._onTrack && this._onTrack('draft_deleted');
    } catch (_) {}
  }

  // ── Private ────────────────────────────────────────────────

  _readDraft() {
    try {
      const raw = localStorage.getItem(this._key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  _saveProfile() {
    try {
      const profileFields = this._schema.filter(f => f.profile);
      if (!profileFields.length) return;
      const profile = {};
      for (const f of profileFields) {
        if (this._state[f.id]) profile[f.id] = this._state[f.id];
      }
      localStorage.setItem(this._profileKey, JSON.stringify(profile));
    } catch (_) {}
  }

  _applyProfile() {
    try {
      const raw = localStorage.getItem(this._profileKey);
      if (!raw) return;
      const profile = JSON.parse(raw);
      for (const field of this._schema) {
        if (field.profile && profile[field.id]) {
          this._state[field.id] = profile[field.id];
        }
      }
    } catch (_) {}
  }

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

    if (field.type !== 'radio') {
      const label = document.createElement('label');
      label.className = 'form-label';
      label.htmlFor = `field-${field.id}`;
      label.innerHTML = escLabel(field.label) +
        (field.required ? ' <span class="required" aria-hidden="true">*</span>' : '');
      wrap.appendChild(label);
    }

    const input = this._renderInput(field);
    if (Array.isArray(input)) {
      input.forEach(el => wrap.appendChild(el));
    } else {
      wrap.appendChild(input);
    }

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
    if (field.type === 'radio') return this._renderRadioGroup(field);
    if (field.type === 'textarea') return this._renderTextarea(field);
    if (field.type === 'select')   return this._renderSelect(field);
    return this._renderSingleInput(field);
  }

  _renderSingleInput(field) {
    const el = document.createElement('input');
    el.className = 'form-input';
    el.type = field.type || 'text';
    el.id = `field-${field.id}`;
    el.dataset.id = field.id;
    if (field.required)      el.required = true;
    if (field.placeholder)   el.placeholder = field.placeholder;
    if (field.autocomplete)  el.autocomplete = field.autocomplete;
    if (field.min !== undefined) el.min = field.min;
    if (field.max !== undefined) el.max = field.max;
    if (field.step !== undefined) el.step = field.step;
    if (field.inputmode)     el.inputMode = field.inputmode;
    el.addEventListener('input', () => this._handleChange(field, el));
    el.addEventListener('blur',  () => this._validateField(field, this._container?.querySelector(`#err-${field.id}`)));
    return el;
  }

  _renderTextarea(field) {
    const el = document.createElement('textarea');
    el.className = 'form-textarea';
    el.id = `field-${field.id}`;
    el.dataset.id = field.id;
    el.rows = field.rows || 4;
    if (field.required)    el.required = true;
    if (field.placeholder) el.placeholder = field.placeholder;
    el.addEventListener('input', () => this._handleChange(field, el));
    el.addEventListener('blur',  () => this._validateField(field, this._container?.querySelector(`#err-${field.id}`)));
    return el;
  }

  _renderSelect(field) {
    const el = document.createElement('select');
    el.className = 'form-select';
    el.id = `field-${field.id}`;
    el.dataset.id = field.id;
    if (field.required) el.required = true;
    // Blank option only when not required or no default
    if (!field.required || !field.defaultValue) {
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = field.placeholder || 'Select…';
      el.appendChild(blank);
    }
    for (const opt of (field.options || [])) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      el.appendChild(o);
    }
    el.addEventListener('change', () => this._handleChange(field, el));
    el.addEventListener('blur',   () => this._validateField(field, this._container?.querySelector(`#err-${field.id}`)));
    return el;
  }

  _renderRadioGroup(field) {
    const groupLabel = document.createElement('span');
    groupLabel.className = 'form-label';
    groupLabel.id = `label-${field.id}`;
    groupLabel.innerHTML = escLabel(field.label) +
      (field.required ? ' <span class="required" aria-hidden="true">*</span>' : '');

    const group = document.createElement('div');
    group.className = 'radio-group';
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-labelledby', `label-${field.id}`);

    for (const opt of (field.options || [])) {
      const pill = document.createElement('label');
      pill.className = 'radio-pill';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `radio-${field.id}`;
      radio.value = opt.value;
      radio.dataset.id = field.id;
      if (field.required) radio.required = true;

      radio.addEventListener('change', () => {
        this._state[field.id] = radio.value;
        this._onChange && this._onChange(this.getState());
        this._scheduleAutosave();
        const errEl = this._container?.querySelector(`#err-${field.id}`);
        if (errEl) errEl.classList.remove('visible');
      });

      pill.appendChild(radio);
      pill.appendChild(document.createTextNode(opt.label));
      group.appendChild(pill);
    }

    return [groupLabel, group];
  }

  _populateValues() {
    for (const field of this._schema) {
      if (field.type === 'radio') {
        const radios = this._container.querySelectorAll(`[name="radio-${field.id}"]`);
        radios.forEach(r => { r.checked = r.value === String(this._state[field.id]); });
      } else {
        const el = this._container.querySelector(`[data-id="${field.id}"]`);
        if (el && this._state[field.id] !== undefined) {
          el.value = this._state[field.id];
        }
      }
    }
  }

  _handleChange(field, el) {
    this._state[field.id] = el.value;
    const errEl = this._container?.querySelector(`#err-${field.id}`);
    if (errEl) errEl.classList.remove('visible');
    el.classList.remove('error');
    this._onChange && this._onChange(this.getState());
    this._scheduleAutosave();
  }

  _validateField(field, errEl) {
    const val = String(this._state[field.id] ?? '').trim();
    const invalid = field.required && !val;
    if (this._rendered) {
      if (field.type === 'radio') {
        // no class to toggle on radios — error message is enough
      } else {
        const el = this._container?.querySelector(`[data-id="${field.id}"]`);
        if (el) el.classList.toggle('error', invalid);
      }
    }
    if (errEl) errEl.classList.toggle('visible', invalid);
    return !invalid;
  }

  _scheduleAutosave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.saveDraft(), this._delay);
  }
}

function escLabel(str) {
  return String(str ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
