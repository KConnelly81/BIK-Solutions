# Feature Backlog

**Purpose:** Complete prioritised list of all planned features with status tracking.
**Last Updated:** 2026-07-15
**Status:** Active
**Owner:** BIK Solutions Pty Ltd

---

## Backlog Format

Each item includes: Problem → User Story → Requirements → Priority → Status

**Priority levels:** P0 (blocking) / P1 (this sprint) / P2 (next sprint) / P3 (backlog)
**Status:** Idea / Planned / In Progress / Done / Deferred

---

## P0 — Current Sprint (Phase 1 Website)

### BT-001: Business Toolkit Navigation Dropdown
**Problem:** There is no entry point to the Business Toolkit from any existing page.
**User story:** As a visitor, I want to see a "Business Toolkit" item in the nav so I can explore the platform.
**Requirements:**
- Add "Business Toolkit" as a dropdown in the desktop nav
- Dropdown links: Overview, AI Documents, Templates, Resources, Productivity, Coming Soon
- Mobile drawer: add flat links under "Business Toolkit" heading
- Update all 7 existing pages (index, services, builders, about, shop, resources, contact)
- Accessible: keyboard navigable, aria-expanded, focus-visible states
**Priority:** P0
**Status:** Planned

### BT-002: toolkit.html — Business Toolkit Home
**Problem:** No landing page exists for the Business Toolkit product.
**User story:** As a visitor, I want to understand what the Business Toolkit offers in one page.
**Requirements:**
- Hero: headline, subheadline, CTA to join waitlist
- Tool category cards (6 categories linking to sub-pages)
- "Why BIK Toolkit" value props (3 stats)
- Phase 1 featured tools preview (4–6 tool cards)
- Email capture / waitlist CTA strip
**Priority:** P0
**Status:** Planned

### BT-003: ai-documents.html — AI Document Generator
**Problem:** No page showcases the AI document generation capability.
**User story:** As a builder, I want to see all available document types and try the generator.
**Requirements:**
- Category filter pills (All, Quotes, Safety, Finance, HR, Contracts, Site, Client)
- ~40 document type cards in "Coming Soon" state
- Each card: document name, description, badge (Free/Pro/Coming Soon), CTA
- Phase 1 priority tools clearly marked
- Waitlist CTA for unlaunched tools
**Priority:** P0
**Status:** Planned

### BT-004: templates.html — Template Library
**Problem:** No searchable library of downloadable templates exists.
**User story:** As a trade business, I want to download ready-made templates I can use immediately.
**Requirements:**
- Category filter (All, Quotes, Safety, Finance, HR, Contracts, Checklists)
- Template cards: name, description, format badge (DOCX/XLSX/PDF), price (Free/Paid), download CTA
- Free templates link directly; paid templates link to Gumroad
- Link to resources.html for paid bundles
**Priority:** P0
**Status:** Planned

### BT-005: construction-resources.html — Resource Hub
**Problem:** The existing resources.html page is focused on Gumroad products; there is no general knowledge hub.
**User story:** As a trade business, I want access to guides, checklists, and compliance info specific to Australian construction.
**Requirements:**
- Separate from existing resources.html (Gumroad products page stays)
- Categories: Compliance, Business, Safety, Finance, Templates
- Article/guide cards with "Read" CTA
- Mix of free content and gated content (email capture)
**Priority:** P0
**Status:** Planned

### BT-006: productivity.html — Builder Productivity Hub
**Problem:** No page communicates the time/money savings of the platform.
**User story:** As a business owner, I want to see evidence that the toolkit will save me time and money.
**Requirements:**
- Hero stat: "Save 8+ hours per week on admin"
- Before/after comparison table (manual vs. BIK Toolkit)
- Time-saving calculator (interactive: enter hourly rate → see annual savings)
- Testimonials section (placeholder initially)
- CTA to sign up
**Priority:** P0
**Status:** Planned

### BT-007: coming-soon.html — Roadmap & Waitlist
**Problem:** No place for visitors to see what's coming and register interest.
**User story:** As an early adopter, I want to see the product roadmap and join the waitlist.
**Requirements:**
- Phase roadmap displayed as timeline/cards
- 10+ upcoming feature cards with phase badges
- Email waitlist form (Formspree)
- "You're number X in the queue" feedback (simulated counter)
**Priority:** P0
**Status:** Planned

### BT-008: SaaS Component CSS
**Problem:** styles.css does not include components needed for toolkit pages.
**Priority:** P0
**Status:** Done

---

## P1 — Current Sprint (Phase 2 - AI Document Engine)

### BT-012: AI Document Engine — Core Architecture
**Problem:** Building document generators tool-by-tool produces duplicated code and prevents reuse.
**User story:** As a developer, I want a reusable engine so every new tool takes hours, not days.
**Components built:**
- `js/toolkit/engine.js` — FormEngine (form rendering, validation, autosave, draft management)
- `js/toolkit/renderer.js` — DocumentRenderer (async generation, AI integration point)
- `js/toolkit/exporter.js` — ExportManager (print/PDF, clipboard)
- `css/toolkit-app.css` — App shell, split panel, document page styles, print CSS
**Priority:** P1
**Status:** Done

### BT-013: Variation Notice Generator (Engine Implementation #1)
**Problem:** Builders lack a fast way to create professional, signed variation notices.
**User story:** As a builder, I want to generate a signed-ready variation notice in under 5 minutes.
**Implemented:**
- 14-field form across 5 sections (Project, Details, Resources, Cost, Notes)
- Auto-incrementing variation number (localStorage counter)
- Cost + GST calculation in document output
- Extension of time section (conditional)
- Client sign-off block with signature lines
- Autosave drafts to localStorage (1.2s debounce)
- Draft restore banner on page load
- Progress bar (required field completion %)
- Live preview re-render after first generation
- Print-to-PDF (native browser, @media print)
- Copy document text to clipboard
- Mobile tab switching (Form / Preview)
- Toast notifications
**Files:** `variation-generator.html`, `js/tools/variation-notice/config.js`, `js/tools/variation-notice/index.js`
**Priority:** P1
**Status:** Done

---

## P2 — Next Sprint

### BT-009: Email Waitlist Integration
**Problem:** Waitlist form needs to capture and store emails.
**Requirements:** Formspree endpoint for waitlist; success state; email confirmation auto-reply
**Priority:** P1
**Status:** Planned

### BT-010: Phase 1 Tool #1 — Quote Builder (UI Shell)
**Problem:** First tool needs a functional UI for testing and demonstration.
**User story:** As a builder, I want to fill in a form and get a professional quote document in under 5 minutes.
**Functional requirements:**
- Input form: client details, job description, line items (labour + materials), terms
- AI generates: professional quote document with itemised breakdown
- Output: downloadable PDF
- Gated: requires Pro subscription or 3 free credits
**Future enhancements:** Pull from Xero contacts, auto-calculate GST, track acceptance
**Priority:** P1
**Status:** Planned

### BT-011: Phase 1 Tool #2 — SWMS Generator (UI Shell)
**User story:** As a site supervisor, I want to generate a compliant SWMS for a new task type in under 10 minutes.
**Functional requirements:**
- Input: task description, hazard selection (dropdown), site details
- AI generates: structured SWMS with hazard descriptions, controls, and sign-off section
- Compliant with Safe Work Australia guidelines
- Output: PDF + editable DOCX
**Priority:** P1
**Status:** Planned

---

## P2 — Backlog (Phase 2 tools listed individually in ai-tool-catalogue.md)

- User authentication (accounts, dashboard, document history)
- Stripe payment integration
- PDF generation engine (Puppeteer or similar)
- Email sequences (welcome, nurture, onboarding)
- Remaining Phase 1 tools (tools 3–10)
- All Phase 2 tools (see ai-tool-catalogue.md)

---

## P3 — Future

- Mobile app (PWA)
- Xero integration
- ServiceM8 integration
- Team workspaces
- API access
- AI Agents (Phase 4)

---

## Done

- [x] BT-001: Business Toolkit nav dropdown across all 7 pages
- [x] BT-002: toolkit.html
- [x] BT-003: ai-documents.html
- [x] BT-004: templates.html
- [x] BT-005: construction-resources.html
- [x] BT-006: productivity.html
- [x] BT-007: coming-soon.html (with Formspree waitlist)
- [x] BT-008: SaaS component CSS
- [x] BT-012: AI Document Engine (FormEngine, DocumentRenderer, ExportManager)
- [x] BT-013: Variation Notice Generator (first engine implementation)
- [x] /docs folder — 22 documentation files
- [x] Homepage hero redesign
- [x] Stories and audience card sections merged into hero block
- [x] Em-dashes removed site-wide
- [x] Hero h1 set to white
- [x] Hero background warmed to #252320 with gradient
- [x] Section spacing tightened
- [x] Scroll animations added
- [x] Stat counter animations added
- [x] Card hover depth added
- [x] DNS Parked record removed (GoDaddy)
- [x] GitHub Pages re-enabled
- [x] Product strategy document created (62 tools, 4-phase roadmap)
- [x] /docs folder and documentation structure created

---

## Related Documents

- [product-roadmap.md](product-roadmap.md) — Phase-level roadmap
- [ai-tool-catalogue.md](ai-tool-catalogue.md) — Full tool specs
