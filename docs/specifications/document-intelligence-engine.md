# BIK Document Intelligence Engine — Specification

**Document ID:** SPEC-001
**Version:** 1.0
**Date:** 2026-07-15
**Status:** Implemented
**Owner:** BIK Solutions Pty Ltd

---

## Purpose

This document specifies the architecture, interfaces, and conventions for the BIK Document Intelligence Engine — the reusable framework that powers all document generators on the BIK platform.

The engine was designed with one principle: **build it once, reuse it everywhere**. Adding a new document type requires only a field schema and a document template. The engine handles form rendering, validation, autosave, preview, export, editing, and future AI integration.

---

## Architecture Overview

```
js/toolkit/
  engine.js         FormEngine class
  renderer.js       DocumentRenderer class
  exporter.js       ExportManager class
  calculator.js     Pure GST/currency/date functions
  analytics.js      Privacy-safe event stubs

js/tools/<tool-name>/
  config.js         SCHEMA array + generateDocument() function
  index.js          Tool wiring (init function)

css/
  toolkit-app.css   App shell + document styles + print CSS

<tool-name>.html    Tool page (imports index.js as ES module)
```

---

## Module Reference

### FormEngine (`engine.js`)

Renders a form from a schema array. Manages state, validation, autosave, and builder profile persistence.

**Constructor:**
```js
new FormEngine(schema, options)
```

| Option | Type | Default | Description |
|---|---|---|---|
| `autosaveKey` | string | `'bik-form-draft'` | localStorage key for draft |
| `autosaveDelay` | number | `1200` | ms before autosave fires |
| `onChange` | function | — | Called with `(state)` after any change |
| `onSave` | function | — | Called after draft saved |
| `onTrack` | function | — | Analytics callback `(name, props) => void` |

**Key methods:**

| Method | Returns | Description |
|---|---|---|
| `mount(container)` | void | Render form into DOM element |
| `getState()` | Object | Current form values |
| `setState(id, value)` | void | Set a field value programmatically |
| `reset()` | void | Reset to schema defaults |
| `validate()` | boolean | Validate all fields; adds error classes |
| `isValid()` | boolean | Quick check, no DOM side effects |
| `completionPct()` | number | 0–100 based on required fields |
| `saveDraft()` | void | Write state to localStorage |
| `hasDraft()` | boolean | True if saved draft exists |
| `restoreDraft()` | number\|null | Restore draft; return timestamp |
| `clearDraft()` | void | Delete draft from localStorage |

**Supported field types:** `text`, `number`, `date`, `email`, `tel`, `textarea`, `select`, `radio`

---

### DocumentRenderer (`renderer.js`)

Bridges form state to HTML document output. The `generateFn` is the only tool-specific input.

**Constructor:**
```js
new DocumentRenderer(generateFn)
// generateFn: (data: Object) => string | Promise<string>
```

**Key methods:**

| Method | Returns | Description |
|---|---|---|
| `render(data)` | Promise\<string\> | Generate HTML from data |
| `update(data, targetEl, opts)` | Promise\<void\> | Render and insert into DOM |
| `setEditMode(targetEl, on)` | void | Enable/disable contenteditable |
| `isEditing` | boolean | Current edit mode state |
| `hasRendered` | boolean | True after first successful render |

**AI Integration Point:**
The `generateFn` is the clean seam for AI. Today it is a local template function. When the AI backend is ready, pass an async function that calls the API instead. No other code changes are required.

```js
// Today (local template):
const renderer = new DocumentRenderer(generateDocument);

// Future (AI API):
const renderer = new DocumentRenderer(async (data) => {
  const res = await fetch('/api/v1/generate/variation-notice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  const { html } = await res.json();
  return html;
});
```

---

### ExportManager (`exporter.js`)

Handles print-to-PDF (via native browser dialog) and clipboard copy.

**Constructor:**
```js
new ExportManager(docSelector, toolTitle, onTrack?)
```

**Methods:** `print()`, `copyText()` → `Promise<boolean>`

---

### Calculator (`calculator.js`)

Pure functions — no side effects, no DOM access.

| Function | Signature | Description |
|---|---|---|
| `calcGST` | `(cost, applicable?) => number` | GST amount (10%) |
| `calcTotal` | `(cost, applicable?) => number` | Total incl. GST |
| `formatAUD` | `(n) => string` | e.g. `$1,250.00` |
| `formatDateLong` | `(iso) => string` | e.g. `15 July 2026` |
| `todayISO` | `() => string` | Today as `YYYY-MM-DD` |
| `addDays` | `(iso, n) => string` | Add N calendar days |

---

### Analytics (`analytics.js`)

Stub event emitter. Logs to console in development. Connect to real analytics by editing the `emit()` function body only.

```js
import { createTracker } from '../../toolkit/analytics.js';
const track = createTracker('variation-notice');
track('document_generated');
```

**Event catalogue:** `tool_opened`, `document_generated`, `pdf_downloaded`, `text_copied`, `draft_saved`, `draft_restored`, `draft_deleted`, `form_cleared`, `validation_error`

---

## Field Schema Reference

Each tool's `config.js` exports a `SCHEMA` array of field definition objects.

```js
{
  id:            string,      // unique — becomes the key in form state
  label:         string,      // display label in the form
  section:       string,      // groups fields under a heading
  type:          string,      // text | number | date | email | tel | textarea | select | radio
  width:         string,      // 'half' | 'full' (default: full)
  required:      boolean,
  profile:       boolean,     // if true, persisted in bik-builder-profile (cross-tool)
  defaultValue:  any | Function,
  placeholder:   string,
  hint:          string,      // small helper text below input
  errorMsg:      string,      // custom validation message
  rows:          number,      // textarea only
  options:       [{value, label}],  // select or radio
  min:           number,      // number input
  max:           number,
  step:          number,
  inputmode:     string,      // HTML inputmode attribute
  autocomplete:  string       // HTML autocomplete attribute
}
```

**Profile fields:**
Fields with `profile: true` are persisted under `bik-builder-profile` in localStorage and auto-filled on every tool. This allows builders to enter their business name, ABN, and contact details once.

---

## Document Template Reference

Each `config.js` exports a `generateDocument(data)` function.

**Rules:**
1. Must return a single HTML string rooted in `<div class="doc-page">`.
2. Must be pure — no DOM access, no side effects, no async (unless using AI integration point).
3. Must escape all user input with `esc(str)` before inserting into HTML to prevent XSS.
4. Should use only CSS classes defined in `toolkit-app.css`.
5. Should include the standard disclaimer block.
6. May include conditional sections using JS template literal conditionals.

**Minimum document structure:**
```html
<div class="doc-page">
  <div class="doc-header">…</div>
  <div class="doc-accent-bar"></div>
  <!-- content sections -->
  <div class="doc-disclaimer">…</div>
  <div class="doc-footer">…</div>
</div>
```

---

## Adding a New Tool

To add a new document generator (e.g. Quote Builder):

1. Create `js/tools/quote-builder/config.js`
   - Export `SCHEMA` array
   - Export `generateDocument(data)` function

2. Create `js/tools/quote-builder/index.js`
   - Import engine modules + your config
   - Call `new FormEngine(SCHEMA, options)` and `new DocumentRenderer(generateDocument)`
   - Export `init()`

3. Create `quote-builder.html`
   - Copy `variation-generator.html` structure
   - Update title, meta, back link
   - Change the module import to `./js/tools/quote-builder/index.js`

4. Add a card to `ai-documents.html` linking to the new tool.

**Estimated time for a new tool: 2–4 hours** (schema + template), not days.

---

## Privacy and Security

### Data handling
- All form data is processed client-side only.
- Drafts are written to `localStorage` on the user's device.
- Nothing is transmitted to BIK servers, third parties, or any analytics system in Phase 1.
- Profile data (`bik-builder-profile`) persists across sessions on the same device.

### XSS protection
- All user-entered strings passed to `generateDocument()` must be processed through `esc()`.
- `esc()` encodes: `&`, `<`, `>`, `"`, and newlines.
- Do not use `innerHTML` with unescaped user input anywhere in the engine.

### Inline edit safety
- `contenteditable` is applied to the `.doc-page` element only, not the app shell.
- Edits in contenteditable mode are DOM-only — they are not persisted to localStorage.
- This is a deliberate design choice: the form is the source of truth.

### localStorage limits
- Typical browser limit: 5–10 MB per origin. Drafts are small (< 10 KB).
- localStorage can be cleared by the browser (private browsing, storage pressure, user action).
- The UI tells users explicitly that drafts are device-local and may be lost.

---

## Legal and Compliance

### Disclaimer requirement
Every generated document must include the standard disclaimer (see `config.js`). It must:
- State the document is generated from user-supplied information
- State it must be reviewed before issue
- State it is not legal advice and not certified as compliant
- State the builder/licence holder remains responsible for regulatory obligations
- Note that GST calculations are indicative only

### What not to say
Do not describe any generated document as:
- Legally approved
- Certified compliant
- Guaranteed to meet any regulation or standard
- Tax advice

### Australian Consumer Law
BIK must not make misleading representations about the capability or legal status of generated documents. The disclaimer and UI copy must be consistent with this obligation.

---

## Testing Checklist

For each new tool, test:

- [ ] Required field validation — missing fields show error messages
- [ ] Optional fields — blank optional fields are handled gracefully in the document
- [ ] $0 / nil cost — zero-dollar variations generate cleanly
- [ ] Long text — 1000+ character descriptions do not break layout
- [ ] Special characters — `&`, `<`, `>`, `"`, `'`, emoji in inputs
- [ ] Autosave — draft is persisted after 1.2s of inactivity
- [ ] Draft restore — refresh page, restore draft, verify values match
- [ ] Draft delete — delete option removes draft from localStorage
- [ ] Profile persistence — builder details persist across page loads
- [ ] Mobile layout (375px) — form is usable, tabs work
- [ ] Tablet layout (768px) — comfortable single-column experience
- [ ] Desktop layout (1200px+) — split panel, both panels visible
- [ ] Print output — header/toolbar hidden, document fills page
- [ ] PDF output — generated via print dialog, content is complete
- [ ] Copy to clipboard — text is readable and complete
- [ ] Keyboard navigation — Tab through all fields, generate with Enter
- [ ] Edit mode — document becomes editable; prints with edits
- [ ] Clear form — fields reset to defaults, draft deleted
- [ ] GST calculation — 10% is applied correctly; $0 cost → $0 GST

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-07-15 | Initial implementation — FormEngine, DocumentRenderer, ExportManager, Calculator, Analytics |
