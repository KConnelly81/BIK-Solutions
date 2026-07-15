# Changelog

**Purpose:** Version history and record of significant changes to the BIK Solutions platform.
**Last Updated:** 2026-07-15
**Status:** Active
**Owner:** BIK Solutions Pty Ltd

---

## Format

```
## [Version] — YYYY-MM-DD
### Added / Changed / Fixed / Removed
- Description
```

---

## [Unreleased] — In Progress

### Added
- **BIK Document Intelligence Engine** (SPEC-001) — production-quality reusable framework
  - `js/toolkit/calculator.js` — Pure GST/currency/date functions (8 tests, all passing)
  - `js/toolkit/analytics.js` — Privacy-safe event stubs with ANALYTICS_INTEGRATION_POINT
  - `js/toolkit/engine.js` — FormEngine: form rendering, validation, autosave, builder profile persistence, radio fields, public draftInfo() API
  - `js/toolkit/renderer.js` — DocumentRenderer: async generation, contenteditable edit mode, AI_INTEGRATION_POINT
  - `js/toolkit/exporter.js` — ExportManager: print-to-PDF, clipboard copy with fallback
  - `css/toolkit-app.css` — App shell, split panel, document page, print CSS
- **Variation Notice Generator** — production-ready tool, first engine implementation
  - 25-field schema across 7 sections including ABN, contact details, exclusions/assumptions, cost type, payment terms, revised completion date, builder/client approval names
  - Builder profile persistence (business name, ABN, contact auto-fill on every return visit)
  - Live GST calculator in form (indicative, not tax advice)
  - Conditional document sections (only rendered when data present)
  - Compliant disclaimer: user-supplied content, review before issue, not legal advice, not certified compliant
  - XSS protection: all user input entity-escaped before document rendering
  - Autosave (1.2s debounce), draft restore banner with timestamp, visible draft delete button
  - Progress bar, variation number auto-increment with localStorage counter
  - Live preview re-render after first generation (800ms debounce)
  - Print-to-PDF (native browser, @media print A4 layout, no dependencies)
  - Clipboard copy with execCommand fallback
  - Mobile tab switching (Form / Preview), large touch targets (42px min), radio pills
  - Inline edit mode (contenteditable) for last-minute changes before print
  - Privacy notice in UI explaining local-only data storage
  - Analytics event hooks: tool_opened, document_generated, pdf_downloaded, text_copied, draft_saved, draft_restored, draft_deleted, form_cleared, validation_error
- **Documentation updates**
  - `docs/specifications/document-intelligence-engine.md` (SPEC-001) — full engine spec
  - ADR-005 (engine architecture), ADR-006 (client-side storage), ADR-007 (print-to-PDF)
  - `docs/technical-architecture.md` — updated with engine module structure
  - `docs/feature-backlog.md` — BT-012, BT-013 marked Done
- Phase 1 website complete: nav, 6 toolkit pages, SaaS CSS

---

## [0.4.0] — 2026-07 (Approximate)

### Added
- Unified hero block: merged hero, "Where we fit in" stories, and "Who we work with" into one `<section class="hero-block">` with Charcoal background and coral accent dividers
- Scroll-in animations: `.animate-on-scroll` with `fadeSlideUp` keyframe, `.delay-1/2/3` staggering, IntersectionObserver trigger
- Stat counter animations: count-up effect on `data-count-to` elements, cubic ease-out, 900ms duration
- Card hover depth: `translateY(-4px)` lift with shadow on service tiles, story cards, audience cards
- Background texture: subtle SVG noise overlay on `.bg-charcoal` sections (opacity 0.04)
- `.audience-grid--dark` and `.audience-card--dark` CSS components

### Changed
- Hero background: warmed from cold `#1C1C1A` to `#252320` (CSS var `--charcoal`)
- Hero: added diagonal gradient `linear-gradient(160deg, #2e2b27 0%, var(--charcoal) 60%)`
- Hero h1: set to `color: #fff` (pure white, previously inherited cream)
- Section padding: reduced from 96px to 64px across all sections
- Card and section padding reduced ~20-30% site-wide to reduce scrolling

### Fixed
- Em-dashes removed site-wide across all 7 HTML files; replaced with ` - `
- DNS: Deleted GoDaddy "Parked" A record that was overriding GitHub Pages
- GitHub Pages: Re-enabled after repository was accidentally set to private; branch re-selected

---

## [0.3.0] — 2026-07 (Earlier)

### Added
- Hero section redesign: new eyebrow, refined h1 copy, hero-sub paragraph
- "Where we fit in" stories grid with 3 story cards
- "Who we work with" audience cards (Property Managers, Builders, Homeowners)
- Stats grid section: GC-BNE, 1× (one call), 0× (zero collateral damage)

---

## [0.2.0] — 2026-06 (Approximate)

### Added
- Formspree AJAX contact form integration
- Free download gate with Formspree + PDF trigger
- Gumroad product integrations on shop.html and resources.html
- Cart placeholder buttons
- builders.html (Builders / Deconstruction specialist page)
- Mobile hamburger nav with drawer

---

## [0.1.0] — 2026-05 (Approximate)

### Added
- Initial static website launch
- index.html, services.html, about.html, contact.html
- css/styles.css with BIK brand tokens
- js/main.js with nav toggle and active link detection
- GitHub Pages deployment on custom domain biksolutions.com.au
- GoDaddy DNS configuration

---

## Related Documents

- [release-plan.md](release-plan.md) — Upcoming releases and deployment process
- [feature-backlog.md](feature-backlog.md) — Current sprint tasks
