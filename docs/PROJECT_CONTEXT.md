# BIK Solutions — Project Context

> Paste this into a new Claude conversation to restore full project understanding.
> Full detail: `/docs/sprint-1-handover.md`

---

## What This Is

**BIK Solutions** is an Australian construction business evolving into an AI-powered Business Toolkit SaaS for builders and tradies. The platform generates professional construction documents (quotes, variation notices, scope of works, site diaries, defect reports) with AI writing assistance. Everything runs client-side — static HTML/CSS/vanilla ES6 modules on GitHub Pages. No backend, no bundler, no npm.

**Live site:** biksolutions.com.au  
**Repo:** `kconnelly81/bik-solutions`  
**Branch:** `claude/bik-solutions-website-yevsuk`  
**Latest commit:** `0be5e37` — Sprint 2 Customer MVP (5 tools + dashboard complete)

---

## Architecture (non-negotiable constraints)

- **No backend in Phase 1** — all data in `localStorage`, all generation client-side
- **No npm / no bundler** — ES6 modules loaded natively by browser (`type="module"`)
- **No CDN imports** — all code lives in the repo
- **XSS protection mandatory** — all user input rendered to HTML must use `esc()` (HTML entity encode)
- **Australian English** — colour, licence, programme, organisation
- **Australian construction domain** — every field, label, and default reflects AU construction practice

---

## Repository Structure

```
BIK-Solutions/
├── dashboard.html              ← Builder Dashboard (entry point for all tools)
├── variation-generator.html    ← Variation Notice tool
├── quote-builder.html          ← Quote Builder tool
├── scope-of-works.html         ← Scope of Works tool
├── site-diary.html             ← Site Diary tool
├── defect-report.html          ← Defect Report tool
├── index.html                  ← Marketing homepage
├── ai-documents.html           ← Marketing: AI tools listing
│
├── css/
│   ├── styles.css              ← Marketing site + brand tokens
│   ├── toolkit-app.css         ← App shell, split panel, doc CSS, print CSS
│   └── dashboard.css           ← Dashboard layout
│
├── js/
│   ├── main.js                 ← Marketing site only
│   ├── toolkit/                ← SHARED ENGINES (import from here)
│   │   ├── tool-controller.js  ← Central wiring — every tool uses this
│   │   ├── engine.js           ← FormEngine (renders form, validates, autosaves)
│   │   ├── renderer.js         ← DocumentRenderer (HTML → preview, edit mode)
│   │   ├── exporter.js         ← ExportManager (print/PDF, clipboard)
│   │   ├── ai-writer.js        ← AIWriter (Anthropic API, 6 modes)
│   │   ├── ai-writer-ui.js     ← injectAIAssist() + showAIKeyModal()
│   │   ├── document-history.js ← DocumentHistoryStore (localStorage CRUD)
│   │   ├── email.js            ← openEmail(), generateEmailBody()
│   │   ├── line-items.js       ← LineItemsEditor (pricing table)
│   │   ├── calculator.js       ← calcGST, formatAUD, todayISO, addDays, formatDateLong
│   │   └── analytics.js        ← Event stubs (ANALYTICS_INTEGRATION_POINT)
│   ├── tools/                  ← Per-tool config (SCHEMA + DOC_CONFIG + generateDocument)
│   │   ├── variation-notice/   config.js + index.js
│   │   ├── quote-builder/      config.js + index.js
│   │   ├── scope-of-works/     config.js + index.js
│   │   ├── site-diary/         config.js + index.js
│   │   └── defect-report/      config.js + index.js
│   └── integrations/           ← Integration Layer SPEC-002 (stubs, not live)
│       ├── index.js            ← Public entry point
│       ├── core/               auth-manager, errors, http-client, logger, provider-registry
│       ├── interfaces/         DTOs: contact, invoice, quote, project, attachment, document
│       ├── providers/          xero, myob, quickbooks, buildxact, servicem8, simpro, aroflo
│       └── services/           contact-service, invoice-service, quote-service, project-service, attachment-service
└── docs/                       ← Full product documentation
    ├── sprint-1-handover.md    ← Authoritative project state (read this first)
    ├── technical-architecture.md
    ├── coding-standards.md
    ├── ux-principles.md
    ├── branding-guidelines.md
    ├── product-roadmap.md
    └── integration-architecture.md
```

---

## How to Build a New Tool

Every tool is 3 files + follows this exact pattern:

**1. `js/tools/<tool-name>/config.js`** — exports exactly:
```javascript
export const SCHEMA = [ /* field objects */ ];
export const DOC_CONFIG = { toolId, toolName, autosaveKey, docPrefix, aiFields, getDocTitle, getDocRef };
export function generateDocument(data) { /* returns HTML string */ }
```

**2. `js/tools/<tool-name>/index.js`** — ~30 lines:
```javascript
import { ToolController } from '../../toolkit/tool-controller.js';
import { SCHEMA, generateDocument, DOC_CONFIG } from './config.js';
export function init() {
  new ToolController(SCHEMA, generateDocument, DOC_CONFIG).mount();
}
```

**3. `<tool-name>.html`** — copy any existing tool HTML, update the `<script>` import path and text labels. Required IDs must be present: `form-container`, `preview-target`, `preview-empty`, `preview-loading`, `progress-fill`, `progress-label`, `autosave-dot`, `autosave-text`, `draft-banner`, `draft-meta`, `tab-form`, `tab-preview`, `form-panel`, `preview-panel-wrap`, `btn-generate`, `btn-generate-bottom`, `btn-clear`, `btn-copy`, `btn-print`, `btn-email`, `btn-history`, `btn-ai-setup`, `btn-edit-toggle`, `btn-restore-draft`, `btn-discard-draft`, `btn-delete-draft`.

---

## SCHEMA Field Shape

```javascript
{
  id:           'fieldId',               // unique, camelCase
  label:        'Display label',
  section:      'Section Name',          // groups fields under a heading
  type:         'text|textarea|date|select|radio|email|tel',
  width:        'half|full',             // half = 2-up grid
  required:     true|false,
  profile:      true|false,             // auto-fill from bik-builder-profile
  defaultValue: 'value' | () => value,  // function called on mount/reset
  placeholder:  'hint',
  hint:         'sub-label',
  rows:         4,                       // textarea only
  options:      [{ value, label }],      // select, radio only
  errorMsg:     'Validation message',
}
```

---

## DOC_CONFIG Shape

```javascript
{
  toolId:       'kebab-case-id',         // localStorage key prefix
  toolName:     'Display Name',
  autosaveKey:  'bik-xxx-draft',         // draft autosave key
  docPrefix:    'VN',                    // VN-001, Q-001, SOW-001 etc.
  aiFields:     ['fieldId', ...],        // inject AI buttons on these textareas
  printTitle:   'Document Type',         // window.document.title for print

  getDocTitle(state)         → string,   // history record title
  getDocRef(state)           → string,   // history record reference

  // Optional hooks:
  getExtraState()            → any,      // non-form data (e.g. line items)
  getEmailData(state, extra) → { clientEmail, clientName, projectName, reference, extraLines },
  onCalcUpdate(state, engine, $),        // fires on every form change
  onAfterMount({ engine, $, toast, switchTab, track }),  // after form mounts
  onRestoreExtra(extraData),             // called when loading from history
}
```

---

## Brand Tokens

```css
--charcoal: #252320;   /* nav, dark backgrounds */
--coral:    #D85A30;   /* CTAs, accents — never large backgrounds */
--cream:    #F5F0E8;   /* light section backgrounds */
--stone:    #888780;   /* secondary text */
```
App shell background: `#eeece9`. Font: Inter / system sans-serif.

---

## Key localStorage Keys

| Key | Content |
|---|---|
| `bik-builder-profile` | `{ businessName, abn, licenceNumber, phone, email, address, approvalName }` |
| `bik-ai-key` | Anthropic API key (user-supplied) |
| `bik-doc-history` | All saved documents (DocumentHistoryStore) |
| `bik-doc-counters` | Per-prefix document counters (VN, Q, SOW, SD, DR) |
| `bik-variation-draft` | Variation Notice autosave |
| `bik-quote-draft` | Quote Builder autosave |
| `bik-scope-draft` | Scope of Works autosave |
| `bik-diary-draft` | Site Diary autosave |
| `bik-defect-draft` | Defect Report autosave |

---

## Document Template Pattern

Every `generateDocument(data)` returns an HTML string with this structure:
```html
<div class="doc-page">
  <div class="doc-header">
    <div class="doc-brand">...</div>
    <div class="doc-title-block"><h1 class="doc-title">...</h1><div class="doc-subtitle">PREFIX–NNN</div></div>
  </div>
  <div class="doc-accent-bar"></div>
  <div class="doc-meta-grid">
    <div class="doc-meta-col">Prepared by...</div>
    <div class="doc-meta-col">Prepared for...</div>
    <div class="doc-meta-col"><table class="doc-ref-table">...</table></div>
  </div>
  <div class="doc-divider"></div>
  <div class="doc-section"><h2 class="doc-section-heading">...</h2><p>...</p></div>
  <!-- more sections -->
  <div class="doc-section doc-section--approval">
    <div class="sig-grid">
      <div class="sig-block">...</div>
      <div class="sig-block">...</div>
    </div>
  </div>
  <div class="doc-footer">Generated with BIK Business Toolkit...</div>
</div>
```
**Always escape user input:** `function esc(str) { return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'<br>'); }`

---

## AI Writing Modes

| Mode key | Label | Purpose |
|---|---|---|
| `professional` | Rewrite Professionally | Formal AU construction English |
| `contract-protection` | Strengthen for Contract | Legally precise, builder-protective |
| `spell-grammar` | Spell & Grammar | Correct errors only, preserve meaning |
| `simplify-client` | Simplify for Client | Plain language, no jargon |
| `formal` | Formal Version | Formal business language |
| `plain-english` | Plain English | Short sentences, active voice |

Primary (always visible): professional, contract-protection  
Secondary (behind "More ⋯"): spell-grammar, simplify-client, formal, plain-english

---

## Integration Layer (Phase 2 — stubs only)

7 provider stubs: Xero, MYOB, QuickBooks, Buildxact, ServiceM8, SimPRO, AroFlo  
5 service modules: contact-service, invoice-service, quote-service, project-service, attachment-service  
Import only from `js/integrations/index.js` (public API surface).  
**Status: architecture complete, no live API connections.**

---

## Outstanding Bugs (fix before demo)

1. Verify `addDays()` is exported from `calculator.js` — used in quote-builder SCHEMA `validUntil` defaultValue
2. Test `?resume=id` flow on all 5 tools from dashboard links
3. Test print/PDF on Quote Builder with line items — may need `page-break-inside: avoid`
4. Defect severity badge colours may not print — may need `print-color-adjust: exact`
5. Builder profile field mapping — verify `profile: true` fields correctly map `businessName→builderName`, `licenceNumber→builderLicence`, `approvalName→builderApprovalName` in FormEngine

---

## Sprint 3 Starting Point

1. **Bug fixes first** (see above, ~2 hours)
2. **Quote Builder GST summary** — add `#calc-summary` block below line items
3. **Marketing site connection** — update `ai-documents.html` to link live tools; add dashboard CTA
4. **Progress Claim tool** — highest commercial priority; "Coming soon" card already on dashboard
5. **Builder profile field mapping audit**

---

## Governance

- Stop and notify before any action that incurs costs (API tokens, third-party services)
- Test in browser before committing
- Ask before architectural decisions
- No backend code in Phase 1
- Update `docs/changelog.md` and `docs/product-roadmap.md` after each sprint
- After committing: `git push -u origin claude/bik-solutions-website-yevsuk`
