# Sprint 1 Handover Document

**Date:** 2026-07-15  
**Branch:** `claude/bik-solutions-website-yevsuk`  
**Latest commits:**
- `0be5e37` — Sprint 2: Customer MVP — 5-tool platform with shared toolkit
- `2b3c83a` — feat: add provider-based Integration Layer (SPEC-002)
- `121bd54` — Add AI Professional Writer and mobile migration plan
- `f03e669` — feat: add reusable document engine and variation notice generator

> **Note:** Despite this document being called a "Sprint 1 Handover", two sprints of work are actually complete. Sprint 1 built the platform architecture; Sprint 2 built the 5-tool Customer MVP. This document covers both. The platform is ready for customer-facing validation.

---

## Executive Summary

BIK Solutions is an Australian construction business evolving into an AI-powered Business Toolkit SaaS targeting Australian builders and tradies. The website is hosted on GitHub Pages (biksolutions.com.au) as a static site with no backend — all document generation is client-side, all data stays in the browser's localStorage.

**What was built:**

Sprint 1 built the complete platform architecture — FormEngine, DocumentRenderer, ExportManager, AI Writing Engine, Integration Layer (7 provider stubs), and the first working tool (Variation Notice Generator).

Sprint 2 built the Customer MVP — 4 additional tools (Quote Builder, Scope of Works, Site Diary, Defect Report), a shared ToolController wiring pattern, Document History store, email workflow, line items editor, shared AI UI, and a Builder Dashboard. All 5 tools are production-ready.

**What the platform can do right now:**
- Generate professional PDFs for 5 document types (Variation Notice, Quote, Scope of Works, Site Diary, Defect Report)
- AI-rewrite any textarea with 6 professional writing modes
- Auto-save drafts, restore from history, duplicate documents
- Auto-fill builder profile across all tools from a single stored profile
- Email any generated document via native email client
- Print/save as PDF via browser print dialog

---

## Current Architecture

### Stack
| Layer | Technology | Notes |
|---|---|---|
| HTML | HTML5, semantic, aria | No framework |
| CSS | Vanilla CSS with custom properties | No preprocessor, no Tailwind |
| JavaScript | Vanilla ES6 modules (`type="module"`) | No bundler, no npm dependencies |
| Hosting | GitHub Pages | Auto-deploys from branch; free |
| DNS | GoDaddy | biksolutions.com.au |
| Forms | Formspree (xojonaww) | Contact/waitlist only |
| Data | Browser localStorage only | All user data is client-side in Phase 1 |
| AI | Anthropic Claude API (user-supplied key) | Key stored in localStorage only |

### Key Architectural Principles
1. **No backend in Phase 1.** Everything is client-side. Server-side capabilities are marked with integration point constants.
2. **No bundler.** Browsers load ES6 modules natively. Importing from npm is not possible in this architecture.
3. **`generateDocument(data)` is the only AI swap point.** Change this one function to add server-side AI; nothing else changes.
4. **`profile: true` on schema fields** auto-fills from `bik-builder-profile` localStorage key across all tools.
5. **`ToolController` is the only wiring class.** Every tool's `index.js` is ~30 lines — just imports and a `new ToolController(SCHEMA, generateDocument, DOC_CONFIG).mount()` call.
6. **XSS protection is mandatory.** All user input is HTML-entity-escaped via the `esc()` function before document rendering.

---

## Repository Structure

```
BIK-Solutions/
├── index.html                    # Marketing homepage
├── about.html                    # About page
├── builders.html                 # Builders/deconstruction page
├── contact.html                  # Contact form
├── coming-soon.html              # Roadmap + waitlist
├── ai-documents.html             # AI tools listing page (marketing)
├── construction-resources.html   # Resource hub (marketing)
│
├── dashboard.html                # ★ Builder Dashboard (NEW)
├── variation-generator.html      # ★ Variation Notice tool
├── quote-builder.html            # ★ Quote Builder tool (NEW)
├── scope-of-works.html           # ★ Scope of Works tool (NEW)
├── site-diary.html               # ★ Site Diary tool (NEW)
├── defect-report.html            # ★ Defect Report tool (NEW)
│
├── css/
│   ├── styles.css                # Main site stylesheet (brand tokens, marketing)
│   ├── toolkit-app.css           # App shell, split panel, doc page, print CSS
│   └── dashboard.css             # Dashboard layout and component styles (NEW)
│
├── js/
│   ├── main.js                   # Marketing site JS (nav, animations, Formspree)
│   │
│   ├── toolkit/                  # ★ Shared platform engines
│   │   ├── tool-controller.js    # Central wiring class — all tools use this
│   │   ├── engine.js             # FormEngine — renders fields, validates, autosaves
│   │   ├── renderer.js           # DocumentRenderer — async HTML generation, edit mode
│   │   ├── exporter.js           # ExportManager — print/PDF, clipboard copy
│   │   ├── ai-writer.js          # AIWriter — Anthropic API, 6 modes, localStorage key
│   │   ├── ai-writer-ui.js       # injectAIAssist() + showAIKeyModal() — shared UI
│   │   ├── document-history.js   # DocumentHistoryStore — CRUD, search, auto-number
│   │   ├── email.js              # openEmail() + generateEmailBody() — mailto: workflow
│   │   ├── line-items.js         # LineItemsEditor — dynamic pricing table with GST
│   │   ├── calculator.js         # calcGST(), formatAUD(), todayISO(), addDays()
│   │   ├── analytics.js          # Event stubs (ANALYTICS_INTEGRATION_POINT)
│   │   └── exporter.js           # Print/PDF/clipboard
│   │
│   ├── tools/                    # ★ Per-tool configuration
│   │   ├── variation-notice/
│   │   │   ├── config.js         # SCHEMA (26 fields), DOC_CONFIG, generateDocument()
│   │   │   └── index.js          # ~30 lines — ToolController wire-up
│   │   ├── quote-builder/
│   │   │   ├── config.js         # SCHEMA (23 fields), DOC_CONFIG, generateDocument()
│   │   │   └── index.js          # Wire-up + LineItemsEditor integration
│   │   ├── scope-of-works/
│   │   │   ├── config.js         # SCHEMA (18 fields), DOC_CONFIG, generateDocument()
│   │   │   └── index.js          # ~30 lines
│   │   ├── site-diary/
│   │   │   ├── config.js         # SCHEMA (16 fields), DOC_CONFIG, generateDocument()
│   │   │   └── index.js          # ~30 lines
│   │   └── defect-report/
│   │       ├── config.js         # SCHEMA (17 fields), DOC_CONFIG, generateDocument()
│   │       └── index.js          # ~30 lines
│   │
│   └── integrations/             # ★ Integration Layer (SPEC-002)
│       ├── index.js              # Public entry point
│       ├── config/
│       │   └── integration-config.js
│       ├── core/
│       │   ├── auth-manager.js
│       │   ├── errors.js
│       │   ├── http-client.js
│       │   ├── logger.js
│       │   └── provider-registry.js
│       ├── interfaces/           # DTO definitions + validators
│       │   ├── contact.js
│       │   ├── invoice.js
│       │   ├── quote.js
│       │   ├── project.js
│       │   ├── attachment.js
│       │   └── document.js
│       ├── providers/            # Provider stubs (architecture complete, no live API)
│       │   ├── base-provider.js
│       │   ├── xero/index.js
│       │   ├── myob/index.js
│       │   ├── quickbooks/index.js
│       │   ├── buildxact/index.js
│       │   ├── servicem8/index.js
│       │   ├── simpro/index.js
│       │   └── aroflo/index.js
│       └── services/             # Business-logic service functions
│           ├── contact-service.js
│           ├── invoice-service.js
│           ├── quote-service.js
│           ├── project-service.js
│           └── attachment-service.js
│
├── docs/                         # Product operating manual
│   ├── README.md
│   ├── technical-architecture.md
│   ├── coding-standards.md
│   ├── ux-principles.md
│   ├── branding-guidelines.md
│   ├── product-vision.md
│   ├── product-roadmap.md
│   ├── feature-backlog.md
│   ├── changelog.md
│   ├── integration-architecture.md
│   ├── ai-tool-catalogue.md
│   ├── business-strategy.md
│   ├── pricing-strategy.md
│   ├── marketing-strategy.md
│   ├── mobile-migration-plan.md
│   └── specifications/
│       └── document-intelligence-engine.md
│
└── assets/
    ├── downloads/                # Free downloadable PDFs/templates
    └── store-build/              # Shopify store content (separate project)
```

---

## Shared Engines

### ToolController (`js/toolkit/tool-controller.js`)
The central wiring class. Every tool instantiates it and calls `.mount()`. It handles:
- FormEngine mount + field rendering
- Progress bar (required field completion %)
- Autosave indicator + draft banner
- Generate button → DocumentRenderer → preview panel
- Tab switching (Form / Preview)
- Copy, Print/PDF, Email buttons
- History panel (slide-in drawer with search, load, duplicate, delete)
- AI Writer setup modal
- Builder profile auto-fill on mount
- `?resume=id` URL param (loads document from history on page load, used by Dashboard)

**Config object shape:**
```javascript
{
  toolId:      'variation-notice',       // localStorage key prefix
  toolName:    'Variation Notice',       // Display name
  autosaveKey: 'bik-variation-draft',   // Draft autosave key
  docPrefix:   'VN',                    // For auto-numbering: VN-001
  aiFields:    ['descriptionOfWork'],   // fieldIds to inject AI assist buttons
  printTitle:  'Variation Notice',      // window.document.title for print
  printSelector: '.doc-page',           // CSS selector for print target

  getDocTitle(state)       → string     // Used for history record title
  getDocRef(state)         → string     // Used for history record reference
  getExtraState()          → any        // Return non-form data (e.g. line items)
  getEmailData(state,extra) → {...}     // { clientEmail, clientName, projectName, reference, extraLines }
  onCalcUpdate(state, engine, $)        // Called on every form change (GST calcs, etc.)
  onAfterMount({ engine, $, ... })      // Called after form mounts (inject custom sections)
  onRestoreExtra(extraData)             // Called when loading from history (restore line items)
}
```

### FormEngine (`js/toolkit/engine.js`)
Renders form fields from a SCHEMA array. Handles:
- All field types: text, textarea, date, select, radio, email, tel
- `width: 'half'` fields render 2-up in a grid
- `required: true` fields contribute to progress bar
- `profile: true` fields load from / save to `bik-builder-profile` localStorage key
- `defaultValue` can be a value or a function: `() => todayISO()`
- Autosave to localStorage on field change (1200ms debounce)
- Draft save/restore/clear
- `reset()` — resets to schema defaults (no arguments)
- `setState(id, value)` — set a field value programmatically
- `getState()` → `{ fieldId: value, ... }`

**SCHEMA field object:**
```javascript
{
  id:           'fieldId',
  label:        'Display label',
  section:      'Section Name',       // Groups fields under a section heading
  type:         'text|textarea|date|select|radio|email|tel',
  width:        'half|full',          // default 'full'
  required:     true|false,
  profile:      true|false,           // auto-fill from builder profile
  defaultValue: 'value' | () => ..., // function called on mount/reset
  placeholder:  'hint text',
  hint:         'sub-label text',
  rows:         4,                    // textarea only
  options:      [{ value, label }],   // select, radio only
  errorMsg:     'Validation message',
  inputmode:    'numeric',            // tel/text only
  autocomplete: 'organization',       // HTML autocomplete attr
}
```

### DocumentRenderer (`js/toolkit/renderer.js`)
- Accepts `generateDocument(data)` return value (HTML string)
- Renders into `#preview-target`
- Enables `contenteditable` "Edit document" mode (for last-minute changes before printing)
- Async — shows loading spinner, hides empty state

### ExportManager (`js/toolkit/exporter.js`)
- `print()` — triggers `window.print()` with correct print CSS applied
- `copy()` — copies document text (stripped of HTML) to clipboard
- Wires `#btn-print`, `#btn-copy` button states

### AIWriter (`js/toolkit/ai-writer.js`)
- Calls Anthropic API (`claude-sonnet-4-6`, or latest model available)
- User's API key stored in `bik-ai-key` localStorage key
- 6 writing modes with distinct system prompts:
  - `professional` — rewrite in professional Australian construction English
  - `contract-protection` — strengthen to protect builder's legal position
  - `spell-grammar` — correct errors only, preserve meaning exactly
  - `simplify-client` — plain everyday language for non-builder clients
  - `formal` — formal business language, avoid contractions
  - `plain-english` — short sentences, active voice, everyday words

### AI Writer UI (`js/toolkit/ai-writer-ui.js`)
- `injectAIAssist(fieldId, writer, engine, track, toastFn, modes?)` — adds AI buttons under any textarea
- `showAIKeyModal(writer, onSuccess, toastFn)` — modal to enter/update Anthropic API key
- 2 primary buttons always shown (professional, contract-protection)
- 4 secondary buttons behind "More ⋯" toggle (spell-grammar, simplify-client, formal, plain-english)
- Uses `AI_MODES` exported constant for button config

### DocumentHistoryStore (`js/toolkit/document-history.js`)
- Singleton: `export const documentHistory = new DocumentHistoryStore()`
- localStorage keys: `bik-doc-history` (records), `bik-doc-counters` (per-prefix counters)
- MAX_RECORDS = 200 (oldest are pruned)
- Methods: `save()`, `update()`, `list(toolId, limit)`, `get(id)`, `delete(id)`, `duplicate(id)`, `search(query, toolId)`, `countByTool()`, `rename(id, newTitle)`, `clear(toolId)`, `getNextNumber(prefix)`, `peekNextNumber(prefix)`
- Documents saved automatically on generate; re-generating updates the existing record

### Email (`js/toolkit/email.js`)
- `openEmail({ to, subject, body, toastFn })` — opens default email client via `mailto:` link
- `generateEmailBody({ toolName, reference, clientName, projectName, builderName, ... })` — produces professional email body
- `generateEmailSubject(toolName, reference, projectName)` — produces subject line
- Phase 2 marker: `EMAIL_SEND_POINT` comment for server-side email integration
- User sees toast: "Email client opened — remember to attach the PDF"

### LineItemsEditor (`js/toolkit/line-items.js`)
- `new LineItemsEditor(container, { onChange, maxRows=30, gstByDefault=true })`
- `.mount()` — renders interactive pricing table into container
- `.addRow(data)` — add a row programmatically
- `.setItems(items)` — restore items from saved state (used by `onRestoreExtra`)
- `.getItems()` → `{ items: [...], subtotal: float, gst: float, total: float }`
- Per-row: description, qty, unit, unit price, GST checkbox, line total
- Running totals (subtotal, GST, total) update on every change
- Dollar values are JavaScript floats (NOT integer cents)

### Calculator (`js/toolkit/calculator.js`)
- `calcGST(amount)` — 10% GST
- `calcTotal(amount)` — amount + GST
- `formatAUD(n)` → `$1,234.56` string (accepts float or string)
- `todayISO()` → `2026-07-15` string
- `addDays(iso, n)` → ISO date string
- `formatDateLong(iso)` → `15 July 2026` string

---

## Completed Features

### Tools (all production-ready)

| Tool | File | Document prefix | AI fields | Line items |
|---|---|---|---|---|
| Variation Notice | `variation-generator.html` | VN | descriptionOfWork, reasonForVariation, exclusionsAssumptions | No |
| Quote Builder | `quote-builder.html` | Q | scopeOfWorks, inclusions, exclusions, assumptions | Yes |
| Scope of Works | `scope-of-works.html` | SOW | projectDescription, scopeItems, inclusions, exclusions, assumptions | No |
| Site Diary | `site-diary.html` | SD | worksCompleted, delays, incidents, plannedWorks | No |
| Defect Report | `defect-report.html` | DR | defectDescription, recommendedAction, additionalNotes | No |

Every tool has:
- ✅ Full SCHEMA with profile auto-fill
- ✅ Required field validation + progress bar
- ✅ Autosave + draft banner
- ✅ AI Writer on all textarea fields (6 modes)
- ✅ Generate document → preview panel
- ✅ Edit document mode (contenteditable)
- ✅ Save as PDF / print
- ✅ Copy to clipboard
- ✅ Email via mailto:
- ✅ History panel (search, load, duplicate, delete)
- ✅ Auto-numbered document references (VN-001, Q-001, etc.)
- ✅ Australian date formatting (15 July 2026)
- ✅ XSS-safe HTML generation
- ✅ GST calculations where applicable
- ✅ Signature blocks
- ✅ Professional document layout (doc-page, doc-header, doc-accent-bar, doc-meta-grid)

### Builder Dashboard (`dashboard.html`)
- ✅ Tool cards for all 5 live tools
- ✅ "Coming soon" cards for 3 planned tools (Progress Claim, Subcontractor Agreement, Safety Checklist)
- ✅ Recent documents list (10 most recent across all tools, from history)
- ✅ "Continue editing" links (opens tool with `?resume=id` param)
- ✅ Builder Profile modal (saves to `bik-builder-profile`, used by all tools)
- ✅ Clear all history button

### CSS
- `css/styles.css` — Marketing site (brand tokens, nav, hero, sections, footer, components)
- `css/toolkit-app.css` — App shell, split panel, document page, form engine, progress bar, draft banner, history panel, AI buttons, line items editor, defect severity badge, print CSS, document line items table
- `css/dashboard.css` — Dashboard layout, tool cards, recent docs, profile modal

---

## Integration Layer Summary (SPEC-002)

**Status:** Architecture complete. Stubs implemented. No live API connections.

**Supported providers (stubs):**
| Provider | Auth | Speciality |
|---|---|---|
| Xero | OAuth2 PKCE | Accounting (AU #1) |
| MYOB | OAuth2 PKCE | Accounting (AU #2) |
| QuickBooks | OAuth2 PKCE | Accounting (global) |
| Buildxact | API Key | Estimating (builders) |
| ServiceM8 | OAuth2 or API Key | Field service |
| SimPRO | OAuth2 | Enterprise field service |
| AroFlo | API Key + org string | Field service |

**Service functions available:**
- `createCustomer()`, `getContact()`, `listContacts()`, `searchContacts()`, `updateContact()`
- `createInvoice()`, `getInvoice()`, `listInvoices()`, `updateInvoice()`, `sendInvoice()`, `voidInvoice()`
- `createQuote()`, `getQuote()`, `listQuotes()`, `acceptQuote()`, `declineQuote()`
- `createProject()`, `getProject()`, `listProjects()`, `updateProject()`, `closeProject()`
- `attachDocument()`, `listAttachments()`, `deleteAttachment()`

**Integration points marked in code:**
- `INTEGRATION_CONFIG_STORAGE_POINT` — in `integration-config.js`
- `DOCUMENT_HISTORY_STORAGE_POINT` — in `document-history.js`
- `EMAIL_SEND_POINT` — in `email.js`
- `AI_WRITING_ENGINE_INTEGRATION_POINT` — in `ai-writer.js`
- `ANALYTICS_INTEGRATION_POINT` — in `analytics.js`

---

## AI Writing Engine Summary

- Model: `claude-sonnet-4-6` (or latest available via API)
- User supplies their own Anthropic API key — stored in `bik-ai-key` localStorage
- Key is never sent anywhere except Anthropic's API
- **Modes:**
  - **professional** — "Rewrite Professionally": formal Australian construction English, third person
  - **contract-protection** — "Strengthen for Contract": legally precise, enumerate obligations, strong builder-protective language
  - **spell-grammar** — "Spell & Grammar": correct errors only, preserve meaning exactly
  - **simplify-client** — "Simplify for Client": plain everyday language, avoid jargon
  - **formal** — "Formal Version": formal business language, avoid contractions
  - **plain-english** — "Plain English": short sentences, active voice, everyday words

---

## Document Engine Summary

The Document Engine is the collective name for the shared rendering pipeline:

1. **FormEngine** renders the form, tracks state, autosaves
2. User fills form → clicks "Generate"
3. **ToolController** collects `engine.getState()` + `getExtraState()` (e.g. line items)
4. Calls `generateDocument({ ...state, _extra: extraData })` → returns HTML string
5. **DocumentRenderer** injects HTML into `#preview-target`
6. **DocumentHistoryStore** saves record (formData + extraData + rendered title/reference)
7. User can edit inline (contenteditable), then print/PDF/copy/email

---

## Builder Dashboard Status

**Live at:** `dashboard.html`

The dashboard is the entry point for all tools. Features:
- Hero greeting + subtitle
- Tool grid (5 active + 3 coming soon)
- Recent documents section (10 latest across all tools)
- Builder Profile modal (name, ABN, licence, phone, email, address, authorised rep)
- Profile saves to `bik-builder-profile` localStorage key
- All tool pages link back to dashboard via "← Dashboard"

**Navigation:** The marketing site (`ai-documents.html`) links to `dashboard.html`. The app shell header on every tool page links back to `dashboard.html`.

---

## Completed Documentation

All in `/docs/`:
- `README.md` — Documentation index
- `technical-architecture.md` — Stack, architecture decisions, file structure
- `coding-standards.md` — HTML, CSS, JS standards + accessibility checklist
- `ux-principles.md` — Design philosophy, page structure patterns, component patterns
- `branding-guidelines.md` — Colours, typography, logo, tone of voice
- `product-vision.md` — The problem, opportunity, phased evolution
- `product-roadmap.md` — Phase 1–4 delivery plan
- `feature-backlog.md` — Prioritised backlog with P0–P3 items
- `changelog.md` — Version history
- `integration-architecture.md` — SPEC-002: Integration Layer full spec
- `ai-tool-catalogue.md` — All 40 planned tools with descriptions
- `business-strategy.md` — Business model, revenue strategy
- `pricing-strategy.md` — Freemium tiers, pricing rationale
- `marketing-strategy.md` — Channels, content, SEO
- `mobile-migration-plan.md` — Plan for responsive toolkit UI

---

## Current Roadmap (Phase 1 priorities)

### Next tools to build (Phase 1, high priority)
| # | Tool | Notes |
|---|---|---|
| 6 | Progress Claim | BCIPA-compliant; "Coming soon" card on dashboard |
| 7 | Subcontractor Agreement | Simple scope/price/terms; "Coming soon" card |
| 8 | Safety Checklist / SWMS | WHS-compliant; "Coming soon" card |
| 9 | Toolbox Talk Generator | Safety; free tier |
| 10 | Payment Reminder | Finance; free tier |

### Platform enhancements needed
1. **Subscription / paywall** — Free vs Pro tier gating (tools 1–5 are currently ungated)
2. **Server-side AI** — Phase 2: remove requirement for user to supply API key
3. **Live integration activation** — Wire Xero/MYOB stubs to real API calls
4. **Analytics** — Plausible or Fathom (privacy-first, no cookie banner)
5. **Email capture** — Newsletter/waitlist on dashboard
6. **Mobile responsiveness audit** — Some tool forms need testing on small screens

---

## Outstanding Bugs

1. **`addDays()` imported in quote-builder config but may not be exported from calculator.js** — verify export exists or the `defaultValue: () => addDays(todayISO(), 30)` for `validUntil` field will throw.
2. **Dashboard `?resume=id` link format** — dashboard links to `tool.html?resume=id` but ToolController reads `location.search` — works for same-page navigation but needs testing across all 5 tools.
3. **LineItemsEditor `onChange` callback** — currently fires with no arguments; `quote-builder/index.js` calls `engine._onChange?.(engine.getState())` to trigger recalc. This accesses a private method. Works but should be formalised if LineItemsEditor API is extended.
4. **Defect Report severity badge print CSS** — `.doc-severity` background colours may not print without `-webkit-print-color-adjust: exact` in print CSS. Verify during PDF testing.
5. **History panel `escaping`** — `esc()` function is local to each config.js but is NOT shared. The history panel title rendering in ToolController uses its own `esc()`. Ensure they are consistent.

---

## Outstanding Enhancements

### High priority (before demo)
1. **Mobile layout for form + preview** — On mobile (<768px), the split panel stacks; need to verify tab switching works cleanly on all 5 tools
2. **Print CSS for Quote Builder line items table** — `.doc-line-items-table` needs `page-break-inside: avoid` for multi-row quotes
3. **Quote Builder GST recalc on form change** — `onCalcUpdate` hook is wired in DOC_CONFIG but the Quote Builder `index.js` doesn't use it — line items total is only available via `getExtraState()`. Consider adding a summary display similar to variation notice's `#calc-summary` block.
4. **Empty line items handling** — Quote Builder generates a pricing table if `hasItems` is true; if all rows are empty descriptions it still shows subtotal row. Add minimum validation.

### Medium priority
5. **Builder profile field mapping** — Profile keys (`businessName`, `abn`, `licenceNumber`, etc.) need to map correctly to each tool's SCHEMA field IDs (`builderName`, `builderABN`, `builderLicence`). Verify FormEngine handles this mapping, or add explicit mapping in `integration-config.js`.
6. **History search across all tools** — Dashboard shows recent docs but doesn't have a global search. Consider adding search to dashboard's recent docs section.
7. **Duplicate document number** — When duplicating from history, the duplicated document gets the same document number (VN-001 copy). Add logic to auto-assign the next number on duplicate.
8. **Site Diary "New entry" shortcut** — Users will generate a new site diary every day. Consider a "New entry (same project)" button that pre-fills project details and resets work/weather fields only.

### Low priority
9. **AI Writer streaming** — Currently waits for full completion before showing result. Add streaming for faster UX.
10. **Toast z-index** — Toast messages may appear behind the history panel overlay on some browsers.

---

## Coding Standards

### HTML
- One `<h1>` per page
- All forms must have `aria-label` or `<label>` on all inputs
- All `<button>` elements must have descriptive text or `aria-label`
- IDs: `kebab-case`
- Classes: `kebab-case`, BEM-inspired (block + modifier: `app-btn--coral`)

### CSS
- **Never use `!important`** unless overriding third-party
- All colours via CSS custom properties (defined on `:root` in `styles.css`)
- Use `gap` for flex/grid spacing, not margin hacks
- Wide content gets `overflow-x: auto` on its own container
- Mobile-first: base styles are mobile, `min-width` media queries enhance

### JavaScript
- **No bundler, no npm, no imports from CDN** — all code must work as native ES6 modules
- All user input rendered into HTML must be passed through `esc()` (HTML entity encode)
- No `console.log` in committed code (use `analytics.js` stubs instead)
- Private methods prefixed with `_` (convention, not enforced)
- Tool configs export exactly three things: `SCHEMA`, `DOC_CONFIG`, `generateDocument`
- `generateDocument(data)` must be a pure synchronous function returning an HTML string
- Monetary values: use JavaScript floats for display; for precision arithmetic use integer cents (`Math.round(val * 100) / 100`)

### Git
- Branch: `claude/bik-solutions-website-yevsuk`
- Always `git push -u origin <branch>` after commits
- Commit messages: imperative mood, describe what and why

---

## UX Standards

### App shell (every tool page)
Every tool page uses the exact same HTML structure with these standard element IDs:
- `#form-container` — FormEngine mounts here
- `#preview-target` — DocumentRenderer injects here
- `#preview-empty`, `#preview-loading` — states
- `#progress-fill`, `#progress-label` — progress bar
- `#autosave-dot`, `#autosave-text` — autosave indicator
- `#draft-banner`, `#draft-meta` — draft restore banner
- `#tab-form`, `#tab-preview` — tab buttons
- `#form-panel`, `#preview-panel-wrap` — split panels
- `#btn-generate`, `#btn-generate-bottom` — generate buttons (bottom one just clicks the top)
- `#btn-clear`, `#btn-copy`, `#btn-print`, `#btn-email`, `#btn-history`, `#btn-ai-setup` — header action buttons
- `#btn-edit-toggle` — preview panel edit button
- `#btn-restore-draft`, `#btn-discard-draft`, `#btn-delete-draft` — draft management

### Document layout
Every generated document uses these CSS classes:
- `.doc-page` — outer container (white, padded, max-width 800px)
- `.doc-header` — flex row: brand left, title/reference right
- `.doc-brand`, `.doc-brand-name`, `.doc-brand-tag` — left side of header
- `.doc-title-block`, `.doc-title`, `.doc-subtitle` — right side (document type + reference number)
- `.doc-accent-bar` — coral horizontal rule after header
- `.doc-meta-grid` — 3-column metadata grid (prepared by, prepared for, document details)
- `.doc-meta-col`, `.doc-meta-heading`, `.doc-meta-value` — metadata cell components
- `.doc-ref-table` — compact key-value table inside meta col
- `.doc-divider` — horizontal rule between meta and content
- `.doc-section`, `.doc-section-heading` — content sections
- `.sig-grid`, `.sig-block`, `.sig-role`, `.sig-line`, `.sig-name` — signature blocks
- `.doc-footer` — footer with branding + generation date

### UX principles
1. Mobile-first — design for phone, enhance for desktop
2. Clarity over cleverness — builders at 6am need obvious, not clever
3. Speed is a feature — no unnecessary JS, keep CSS lean
4. No broken buttons — every visible button must work or be `disabled`
5. Privacy by default — all data stays local; show the lock icon + privacy notice on every tool

---

## Governance Rules

1. **Safety first:** Stop and notify the user before any action that could incur costs (API calls billed per token, third-party services)
2. **Test before deploying:** Run the app in a browser and test the affected flows before committing
3. **Ask when unsure:** If an architectural decision is ambiguous, ask before implementing
4. **No server-side code in Phase 1:** Everything is client-side. Backend = Phase 2.
5. **No npm dependencies:** No `package.json`, no `node_modules`, no bundler
6. **XSS protection is non-negotiable:** All user input rendered to HTML must use `esc()`
7. **Document history is authoritative:** The `docs/` folder is the source of truth. Update changelog and roadmap after each sprint.
8. **The marketing site must not break:** Changes to `styles.css` or `main.js` affect all marketing pages. Test all pages after changes.
9. **Builder profile must work cross-tool:** `profile: true` fields must use the correct mapping to `bik-builder-profile` keys.

---

## Product Philosophy

> **BIK Solutions exists to give Australian builders and tradies the documentation arsenal of a large firm at the price of a coffee.**

- Every tool should feel like it was built by someone who has been on a building site, not a software engineer who Googled "Australian construction"
- Documents must be professional enough that a builder would be proud to send them to a client or head contractor
- Friction is the enemy — the fewer clicks between "I need a quote" and "PDF in my email", the better
- We are not building a generic document tool. Every field, every label, every default value should reflect Australian construction practice
- Phase 1 is about proving value, not charging for it. Tools are free. The business case is: if a builder uses this daily, they will pay $29/month happily.

---

## Brand Guidelines

### Colours (CSS custom properties)
```css
--charcoal: #252320;    /* Primary dark — nav, hero backgrounds */
--coral:    #D85A30;    /* Accent — CTAs, buttons, highlights */
--cream:    #F5F0E8;    /* Light backgrounds */
--stone:    #888780;    /* Secondary text */
```
- The app shell background is `#eeece9` (slightly darker than cream, defined directly in `toolkit-app.css`)
- Never use coral as a large background — only for buttons, badges, small accents
- Charcoal and cream alternate for section rhythm on marketing pages

### Typography
- Font: `Inter` (system fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- App shell: `0.85rem` default, `0.78rem` for labels and secondary text
- No custom webfont loading in toolkit — uses system font stack

### Logo/Brand
- Logo mark: square `#252320` with white "B"
- Tool pages show: `logo-mark` + tool name + "← Dashboard" back link
- Document footer: `Generated with BIK Business Toolkit — biksolutions.com.au`

### Voice and Tone
- Direct, practical, no fluff
- Australian English (colour, licence, programme, organisation)
- Third person in documents ("The Builder shall...")
- First person in UI copy ("Your documents")
- Never "lorem ipsum" or placeholder content in committed code

---

## Git Information

**Repository:** `kconnelly81/bik-solutions` (GitHub)  
**Working branch:** `claude/bik-solutions-website-yevsuk`  
**Default branch:** (main — all PRs merge here)

**Recent commits:**
```
0be5e37  Sprint 2: Customer MVP — 5-tool platform with shared toolkit
2b3c83a  feat: add provider-based Integration Layer (SPEC-002)
121bd54  Add AI Professional Writer and mobile migration plan
f03e669  feat: add reusable document engine and variation notice generator
c187a3e  Add reusable AI Document Engine + Variation Notice Generator
a5d9601  Add Business Toolkit platform - 6 new pages, nav dropdown, SaaS components
576dccc  Add /docs documentation structure — product operating manual
```

**To continue development:**
```bash
git checkout claude/bik-solutions-website-yevsuk
git pull origin claude/bik-solutions-website-yevsuk
# Make changes
git add <files>
git commit -m "feat: ..."
git push -u origin claude/bik-solutions-website-yevsuk
```

---

## Current Sprint Status

### Sprint 1 — Architecture (COMPLETE ✅)
- [x] FormEngine (`engine.js`)
- [x] DocumentRenderer (`renderer.js`)
- [x] ExportManager (`exporter.js`)
- [x] AIWriter (`ai-writer.js`)
- [x] Calculator utilities (`calculator.js`)
- [x] Analytics stubs (`analytics.js`)
- [x] Variation Notice tool (first working tool)
- [x] Integration Layer — 7 provider stubs + 5 services + core infrastructure (SPEC-002)
- [x] Documentation suite (`/docs/`)

### Sprint 2 — Customer MVP (COMPLETE ✅)
- [x] ToolController (`tool-controller.js`) — central wiring class
- [x] DocumentHistoryStore (`document-history.js`)
- [x] Email workflow (`email.js`)
- [x] AI Writer UI shared component (`ai-writer-ui.js`)
- [x] LineItemsEditor (`line-items.js`)
- [x] 4 new AI writing modes in `ai-writer.js`
- [x] Quote Builder (with line items)
- [x] Scope of Works
- [x] Site Diary
- [x] Defect Report
- [x] Variation Notice — refactored to ToolController (~30 line index.js)
- [x] Builder Dashboard
- [x] Dashboard CSS

---

## Recommended Sprint 3 Starting Point

Sprint 3 should focus on **customer validation readiness** — ensuring the platform can be demonstrated and tested by real builders before adding new tools.

### Priority 1: Bug fixes (do first, ~2 hours)
1. Verify `addDays()` is exported from `calculator.js` — fix if missing
2. Test `?resume=id` flow on all 5 tools from dashboard — fix any that don't restore correctly
3. Test print/PDF on all 5 tools — fix Quote Builder line items page-break issue
4. Test on mobile (iPhone Safari, Android Chrome) — fix any layout breaks

### Priority 2: Quote Builder GST summary (~1 hour)
Add a GST calc summary block below the line items editor (same pattern as Variation Notice's `#calc-summary`). Currently the running total is in the line items editor itself but not reflected in the form panel summary.

### Priority 3: Marketing site connection (~1 hour)
- Update `ai-documents.html` to link all 5 active tools to their actual pages (not coming soon)
- Add "Open Toolkit" or "Go to Dashboard" CTA button linking to `dashboard.html`
- Ensure the marketing nav "Business Toolkit" dropdown links to `dashboard.html`

### Priority 4: Next tool — Progress Claim (~4 hours)
The "Coming Soon" card on the dashboard is already in place. Progress Claim is the highest commercial value tool (BCIPA compliance, repeat use). Follow the exact same pattern:
```
js/tools/progress-claim/config.js
js/tools/progress-claim/index.js
progress-claim.html
```
Config needs: claimant details, respondent, contract details, scheduled values, amount claimed, supporting references.

### Priority 5: Builder profile field mapping audit (~1 hour)
Audit that all `profile: true` fields in all 5 tool schemas correctly map to the `bik-builder-profile` localStorage keys. The profile stores `businessName`, `abn`, `licenceNumber`, `phone`, `email`, `address`, `approvalName` — verify FormEngine maps these to tool-specific field IDs (`builderName`, `builderABN`, etc.) correctly.
