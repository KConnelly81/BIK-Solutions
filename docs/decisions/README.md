# Architecture Decision Records (ADRs)

**Purpose:** Record significant architectural and product decisions with their context and rationale.
**Last Updated:** 2026-07-15
**Status:** Active
**Owner:** BIK Solutions Pty Ltd

---

## ADR Format

```markdown
# ADR-NNN: Title

**Date:** YYYY-MM-DD
**Status:** Proposed / Accepted / Superseded / Deprecated
**Deciders:** [names or roles]

## Context
What situation prompted this decision?

## Decision
What was decided?

## Rationale
Why was this chosen over alternatives?

## Consequences
What are the positive and negative outcomes of this decision?

## Alternatives Considered
What else was evaluated?
```

---

## Decision Log

| ADR | Title | Date | Status |
|---|---|---|---|
| ADR-001 | Static HTML over framework for Phase 1 | 2026-07 | Accepted |
| ADR-002 | GitHub Pages for hosting | 2026-07 | Accepted |
| ADR-003 | Formspree for form handling | 2026-07 | Accepted |
| ADR-004 | Gumroad for digital product sales | 2026-07 | Accepted |
| ADR-005 | Document Intelligence Engine architecture | 2026-07-15 | Accepted |
| ADR-006 | Client-side only storage for Phase 1 document tools | 2026-07-15 | Accepted |
| ADR-007 | Native browser print-to-PDF over server-side PDF generation | 2026-07-15 | Accepted |

---

## ADR-001: Static HTML over framework for Phase 1

**Date:** 2026-07
**Status:** Accepted

**Context:** Needed a website to launch quickly with minimal infrastructure.

**Decision:** Use plain HTML/CSS/JavaScript. No React, Vue, Next.js, or similar framework.

**Rationale:**
- Fastest time to first deployment
- Zero build step, zero dependencies
- GitHub Pages hosting for free
- Future developers can read it without knowing a specific framework
- Performance is exceptional (no JS bundle)

**Consequences (+):** Simple, fast, maintainable, cheap.
**Consequences (-):** Nav and footer must be manually copied across all pages. Acceptable at 7–13 pages.

**Alternatives:** Next.js (overkill for Phase 1), 11ty (adds build step complexity without enough benefit at this scale).

---

## ADR-002: GitHub Pages for hosting

**Date:** 2026-07
**Status:** Accepted

**Context:** Needed reliable, low-cost hosting with SSL for biksolutions.com.au.

**Decision:** Host on GitHub Pages using a feature branch.

**Rationale:** Free tier sufficient for Phase 1 traffic. Automatic SSL. Push-to-deploy. No server to manage.

**Consequences (-):** Requires repository to be public. No server-side code. Will need to migrate at Phase 2 (Vercel or Netlify for serverless functions).

---

## ADR-003: Formspree for form handling

**Date:** 2026-07
**Status:** Accepted

**Context:** Needed a contact form and email capture without a backend.

**Decision:** Use Formspree (endpoint xojonaww) for all form submissions.

**Rationale:** Free tier handles Phase 1 volume. Simple AJAX integration. No server required.

**Consequences (-):** Form data stored third-party. Limited automation. Will migrate to own database at Phase 2.

---

## ADR-004: Gumroad for digital product sales

**Date:** 2026-07
**Status:** Accepted

**Context:** Needed to sell digital templates (PDF/DOCX) without building payment infrastructure.

**Decision:** Use Gumroad as the digital storefront; link from BIK website.

**Rationale:** Zero setup cost. Handles payments, tax, and delivery. Trusted by Australian buyers.

**Consequences (-):** Gumroad takes a transaction fee. Brand continuity disrupted (redirects off site). Migrate to own store at Phase 3 when volume justifies it.

---

## ADR-005: Document Intelligence Engine Architecture

**Date:** 2026-07-15
**Status:** Accepted

**Context:** Multiple document generators are planned. Building each as a standalone one-off creates duplicated validation, rendering, export, and autosave logic. The first tool (Variation Notice) needed to establish the reusable pattern.

**Decision:** Build a module-based Document Intelligence Engine with a clear separation of: FormEngine (rendering/state/validation), DocumentRenderer (output), ExportManager (print/copy), Calculator (pure functions), and Analytics (stubs). Each tool supplies only a SCHEMA and a generateDocument() function.

**Rationale:**
- Adding a new tool takes 2–4 hours, not days
- Engine improvements benefit all tools immediately
- AI can be swapped in at the DocumentRenderer level without touching any tool file
- Pure calculator functions are testable in isolation
- Analytics stubs allow future tracking without rebuilding

**Consequences (+):** Highly reusable. Clean AI integration seam. Easy to test.
**Consequences (-):** Requires team to understand the engine API before contributing a new tool. Mitigated by SPEC-001 and the "Adding a New Tool" section.

**Alternatives:** Standalone per-tool implementations (rejected — duplicated logic), React/Vue component library (rejected — adds build step, breaks existing GitHub Pages deploy).

---

## ADR-006: Client-Side Only Storage for Phase 1 Document Tools

**Date:** 2026-07-15
**Status:** Accepted

**Context:** The document generators collect project-specific data (client names, project details, costs). Transmitting this to a server before user authentication and a privacy policy are in place creates compliance risk under the Privacy Act 1988.

**Decision:** All form data in Phase 1 is processed and stored client-side only. Drafts are written to localStorage on the user's device. Nothing is transmitted to BIK servers or third parties.

**Rationale:**
- Eliminates Privacy Act obligations for Phase 1
- No backend infrastructure required
- Simpler security posture — no data at rest on servers
- Consistent with the static GitHub Pages hosting model

**Consequences (+):** No privacy policy required for Phase 1. No server costs. No data breach exposure.
**Consequences (-):** Drafts can be lost if the user clears browser data. No cross-device access. Must migrate to server storage when accounts are introduced (Phase 2). The UI clearly communicates this limitation.

**User communication:** A privacy notice in the form panel explicitly states that data stays on the device. A visible "Delete saved draft" option is provided.

---

## ADR-007: Native Browser Print-to-PDF over Server-Side PDF Generation

**Date:** 2026-07-15
**Status:** Accepted

**Context:** Generated documents need to be available as PDFs for builders to share and file.

**Decision:** Use the native browser print dialog (window.print() with @media print CSS) as the PDF export mechanism for Phase 1. No server-side PDF library (Puppeteer, wkhtmltopdf, PDFKit) is introduced.

**Rationale:**
- Zero dependencies — works in all modern browsers
- No server required — consistent with static hosting
- No cost
- Print CSS gives full control over page layout and A4 formatting
- Quality is production-acceptable for business documents

**Consequences (+):** Simple, reliable, cost-free, no maintenance.
**Consequences (-):** User must select "Save as PDF" in the print dialog — one extra click. Header/toolbar content requires explicit hiding via print CSS (implemented). Cannot generate PDFs programmatically or email them automatically. Will migrate to server-side generation (e.g. Puppeteer/Playwright or a PDF API) in Phase 2 when automated delivery is required.
