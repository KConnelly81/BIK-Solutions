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
