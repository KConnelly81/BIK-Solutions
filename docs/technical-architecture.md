# Technical Architecture

**Purpose:** Describe the system design, technology stack, and infrastructure decisions for BIK Solutions.
**Last Updated:** 2026-08-02
**Status:** Active
**Owner:** BIK Solutions Pty Ltd

---

## Current Architecture (Phase 1)

### Overview
Static HTML/CSS/JavaScript website hosted on GitHub Pages. No backend, no database, no framework. Deliberately simple — fast to build, free to host, zero maintenance overhead.

### Stack

| Layer | Technology | Rationale |
|---|---|---|
| HTML | HTML5 (semantic, aria attributes) | Accessibility, SEO, simplicity |
| CSS | Vanilla CSS with custom properties | No build step; maintainable; fast |
| JavaScript | Vanilla ES5/ES6 IIFEs | Zero dependencies; no bundler needed |
| Hosting | GitHub Pages | Free; auto-deploys from branch; SSL |
| DNS | GoDaddy | Existing registrar for biksolutions.com.au |
| Forms | Formspree (endpoint: xojonaww) | Zero-backend form handling |
| E-commerce | Gumroad | Digital product sales; no payment infrastructure |
| Analytics | (Planned: Plausible or Fathom) | Privacy-first; no cookie banner needed |

### Supabase Integration (implemented 2026-07-30)

The Phase 2 "Auth" and "Database" rows below moved from planned to
implemented, ahead of the rest of that section (Stripe, PDF generation,
hosting migration) — this was scoped narrowly to one thing: a disposable
authenticated user can sign up, create one organisation, and manage
projects, isolated from every other organisation by Postgres Row Level
Security. Hosting, framework choice, and every other Phase 2 item below
remain as-planned, not yet built.

- **Backend:** Supabase project `hpcqncghvdrlvufxfdnd` — `organisations`,
  `profiles`, `customers`, `projects` tables (Phase 1), plus, as of Sprint 3/5b,
  `variation_notices`, `quotes`/`quote_line_items`, and `progress_claims`/
  `progress_claim_line_items`, each with RLS, organisation/project-scoped
  concurrency-safe numbering, and an RPC-only issue workflow (`create_*()`/
  `issue_*()`) — no client role has a plain `UPDATE` grant reaching any
  lifecycle or server-computed-total column on any of them. `Progress Claims`
  issuing (`issue_progress_claim()`) remains unconditionally `BLOCKED` at the
  database level pending accountant/contract confirmation of GST/retention
  treatment — drafts are fully usable. See `supabase/migrations/`,
  `docs/PHASE_1_DATABASE_REVIEW.md`, `docs/PHASE_1_DEPLOYMENT_RUNBOOK.md`, and
  `docs/RELEASE_v0.5.0_SPRINT5.md` for the current production state.
- **Frontend:** still static HTML + native ES modules, no framework/bundler
  — `js/supabase/client.js` (one shared client, publishable key only),
  `js/supabase/session.js` (auth/session helpers), `signup.html`,
  `signin.html`, `app-dashboard.html`, `project-hub.html`. The Supabase JS SDK
  is vendored at `js/vendor/supabase-js.min.js` (official npm build, loaded
  via a plain `<script>` tag) rather than pulled from a CDN at runtime.
- **Live on the authenticated Supabase model** (as of the full-platform
  migration, 2026-08-04): every tool is now reached from `project-hub.html`,
  gated on session + a valid organisation-scoped project — Variation Notice,
  Quote Builder, Progress Claim (each its own dedicated table), Site
  Attendance (its own dedicated tables plus `SECURITY DEFINER` RPCs for the
  anonymous worker check-in/out flow — see `supabase/migrations/018_create_
  attendance.sql`), and the 17 simple document tools (Contract Termination,
  Defect Report, Delay Notice, EOT Claim, Handover Checklist, Incident
  Report, Inspection Checklist, Instruction to Proceed, Non-Conformance
  Report, Notice to Show Cause, Payment Reminder, Practical Completion,
  Scope of Works, Site Diary, Subcontractor Agreement, SWMS, Toolbox Talk),
  which share one table, `public.project_documents` (`019_create_project_
  documents.sql`) — see that migration's header for why one shared table,
  not seventeen dedicated ones, was the right call for this category of
  tool. See "Two project systems" below for the shared integration pattern.
- **Deliberately unmigrated:** `dashboard.html`, `project.html`, and
  `js/toolkit/project-store.js` remain, unchanged, as a separate
  localStorage-only catalogue — not because migrating them was skipped, but
  because they are the *old* entry point itself, superseded by
  `app-dashboard.html` → `project-hub.html` (Completion Package 1). Old
  links from that legacy catalogue into a now-migrated tool page degrade
  gracefully (the Supabase gate's "project not found" screen, with a link
  back to the real dashboard) rather than breaking — confirmed, not
  assumed, for every tool migrated this pass.

### Branch reconciliation (2026-07-31)

This work was originally merged onto `claude/bik-solutions-website-yevsuk`,
believed at the time to be the GitHub Pages deployment branch (it was
GitHub's configured repository default branch, and the branch this work
had itself been built on top of). It was not: GitHub Pages actually
deploys from `main`, which had diverged from `yevsuk` by 25 commits of
its own — a full design-system rollout (`css/bik-design-system.css`)
across nearly every tool page, plus dashboard/attendance/checkin/checkout
redesigns — none of which existed on `yevsuk`. `yevsuk` in turn had 36
commits `main` lacked: all of Phase 1/2 above, plus a security fix
(`js/toolkit/ai-writer.js`/`ai-writer-ui.js` routed through a Cloudflare
Worker proxy, removing a client-side-exposed API key) that `main` was
still missing.

Reconciled by merging `yevsuk` into `main` (verified first via a local,
unpushed trial merge): zero conflicts, zero files deleted relative to
either side, `ai-writer.js` confirmed to resolve to the secure proxy
version post-merge. `main` is now the single production branch and the
branch GitHub Pages deploys from; `yevsuk` is kept as a backup, not
deleted or rewritten. See `docs/RELEASE_NOTES_V0.1_PLATFORM.md` for the
full detail and the corrected rollback procedure.

### Repository Structure
```
BIK-Solutions/
├── index.html              # Homepage
├── services.html           # Services page
├── builders.html           # Builders / Deconstruction
├── about.html              # About page
├── shop.html               # Shop (Gumroad products)
├── resources.html          # Resources (Gumroad digital products)
├── contact.html            # Contact form
├── toolkit.html            # Business Toolkit home [Phase 1]
├── ai-documents.html       # AI Document Generator [Phase 1]
├── templates.html          # Template Library [Phase 1]
├── construction-resources.html  # Resource Hub [Phase 1]
├── productivity.html       # Productivity Hub [Phase 1]
├── coming-soon.html        # Roadmap + Waitlist [Phase 1]
├── css/
│   └── styles.css          # Single stylesheet (~2000+ lines)
├── js/
│   └── main.js             # Single JS file (~170 lines)
├── assets/
│   └── downloads/          # Downloadable PDFs/templates
└── docs/                   # Product and business documentation
```

### CSS Architecture
- All styles in `css/styles.css`; no preprocessor
- Design tokens as CSS custom properties on `:root`
- Mobile-first with breakpoints at 900px, 768px, 480px
- BEM-inspired naming (block + modifier pattern)
- Component sections clearly commented

### JavaScript Architecture
- Marketing site: `js/main.js` — IIFE pattern, no modules
- Document tools: ES6 modules (`type="module"`) in `js/toolkit/` and `js/tools/`
- No bundler — browsers load modules natively
- IntersectionObserver for scroll animations and stat counters
- Formspree AJAX for contact/waitlist forms

### Document Intelligence Engine

Added in Phase 1 (2026-07-15) to support the Variation Notice Generator and all future document tools.

```
js/toolkit/
  engine.js         FormEngine — form rendering, validation, autosave, builder profile
  renderer.js       DocumentRenderer — async HTML generation, contenteditable edit mode
  exporter.js       ExportManager — print/PDF, clipboard copy
  calculator.js     Pure GST/currency/date functions
  analytics.js      Privacy-safe event stubs (ANALYTICS_INTEGRATION_POINT)

js/tools/
  variation-notice/
    config.js       SCHEMA (25 fields) + generateDocument() template
    index.js        Tool wiring

css/
  styles.css        Main site stylesheet (unchanged)
  toolkit-app.css   App shell, split panel, document page, print CSS
```

**Key architectural decisions:**
- `generateDocument(data)` is the only AI integration point — swap to async API call, no other changes needed
- `profile: true` fields persist in `bik-builder-profile` (localStorage) — builders enter details once
- All user data is client-side only in Phase 1 (see ADR-006)
- Print-to-PDF via native browser dialog (see ADR-007)
- XSS protection: all user input is HTML-entity-escaped before document rendering

### AI Professional Writer

Added in Phase 1 (2026-07-15). Reusable writing assistant for textarea fields.

```
js/toolkit/
  ai-writer.js    AIWriter class — Claude API, two modes, localStorage key storage
```

- Two modes: `'professional'` (plain language) and `'contract-protection'` (liability-aware)
- API key stored in `bik-ai-key` (localStorage); never sent to BIK servers
- `AI_WRITING_ENGINE_INTEGRATION_POINT` — swap `_callAPI()` for backend proxy in Phase 2
- Model: `claude-haiku-4-5-20251001`; max 1024 tokens per rewrite

### Integration Layer

Added in Phase 1 (2026-07-15). Provider-based abstraction for third-party platform integrations. No live API connections yet — architecture and stubs only.

See **[integration-architecture.md](integration-architecture.md)** (SPEC-002) for full details.

```
js/integrations/
  index.js              Public entry point
  core/                 errors, logger, http-client, auth-manager, provider-registry
  interfaces/           Contact, Invoice, Quote, Project, Attachment, Document DTOs
  providers/            Xero, MYOB, QuickBooks, Buildxact, ServiceM8, SimPRO, AroFlo stubs
  services/             contact-, invoice-, quote-, project-, attachment-service
  config/               integration-config (localStorage Phase 1 → Supabase Phase 2)
```

**Key design decisions:**
- Business components never import providers directly — always import from `integrations/index.js`
- All amounts stored as integer cents (no float arithmetic)
- Typed error hierarchy with `BIKIntegrationError` base
- `XERO_IMPLEMENTATION_POINT` / `MYOB_IMPLEMENTATION_POINT` etc. mark every stub method
- Token store uses `StorageAdapter` interface for Phase 2 Supabase swap

### Brand Design Tokens
```css
--charcoal:   #252320   /* Primary dark (nav, hero, dark sections) */
--coral:      #D85A30   /* Accent / CTA colour */
--cream:      #F5F0E8   /* Light section backgrounds */
--stone:      #888780   /* Secondary text / subheadings */
--dark-stone: #3A3835   /* Cards on dark backgrounds */
--radius:     6px        /* Standard border radius */
--transition: 0.2s ease  /* Standard hover transition */
```

---

## Phase 2 Architecture (Planned — Q1 2027)

### New Requirements
- User authentication (accounts, sessions)
- Document generation with AI
- Document history and storage
- PDF export
- Subscription management (Stripe)

### Proposed Stack Changes

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Remain static HTML + JS | Avoid framework lock-in; keep it simple |
| Auth | Supabase Auth | **Implemented 2026-07-30** — see "Supabase Integration" above |
| Database | Supabase (PostgreSQL) | **Implemented 2026-07-30** for organisations/profiles/customers/projects — see "Supabase Integration" above. Document/subscription storage still planned. |
| AI API | Anthropic Claude API | Document generation |
| PDF generation | Puppeteer / Playwright (serverless) | Render HTML → PDF |
| Payments | Stripe | Subscription management |
| Hosting | Vercel or Netlify | Serverless functions for API routes |
| Email | Resend or Postmark | Transactional emails |

### API Design Principles
- REST API, JSON responses
- All endpoints require auth token (except public)
- Document generation is async (queue + webhook)
- Rate limiting on generation endpoints
- See [api-documentation.md](api-documentation.md) for endpoint specs

---

## Phase 3 Architecture (Planned — Q3 2027)

- Team workspaces with role-based access
- Xero OAuth integration (import invoices/clients)
- ServiceM8 integration (import jobs)
- Webhook system for third-party triggers
- Mobile PWA wrapper

---

## Phase 4 Architecture (Planned — 2028)

- AI Agents running on scheduled triggers (cron + event-driven)
- Computer vision pipeline for photo-to-document (Phase 4 only)
- Speech-to-text for voice diary (Whisper API)
- Multi-region hosting for reliability
- Potential white-label API for enterprise customers

---

## Infrastructure Decisions

### Why GitHub Pages (now)?
- Cost: Free
- Simplicity: Push-to-deploy
- Reliability: GitHub's CDN
- SSL: Automatic with custom domain
- Trade-off: No server-side code. Accepted for Phase 1.

### Why static HTML (now)?
- No framework churn
- Fastest possible page loads
- Works everywhere without JS
- Easy for future developers to understand
- Trade-off: Manual repetition in nav/footer across pages. Acceptable at current scale.

### Future: Will we adopt a framework?
At Phase 2, evaluate whether to introduce a lightweight framework (e.g., Alpine.js for reactivity, 11ty for static site generation). Decision will be driven by how much shared component duplication becomes painful. Document the decision in `decisions/` when made.

---

## Two project systems (added 2026-07-31, Sprint 4)

Most of this document predates the actual Supabase build (Phase 2/3) and describes it as planned rather than live — a documentation-currency gap tracked in the maintenance backlog, not fixed here. This section is the one accurate, current exception, because the boundary it describes needs to be followed by every future tool migration.

There are two, deliberately separate "project" concepts on the platform right now, and they must not be conflated:

- **Legacy (`js/toolkit/project-store.js` / `js/toolkit/project-ui.js`)** — localStorage-only, anonymous, no accounts. Every tool that has not yet moved to the authenticated model uses this. `ToolController` mounts it by default (`cfg.projectMode` unset or `'legacy'`).
- **Supabase (`public.projects`, `js/toolkit/supabase-project-context.js`, `js/toolkit/supabase-record-panel.js`)** — real, authenticated, org-scoped. A tool opts in via `cfg.projectMode: 'supabase'` in its `DOC_CONFIG`, which tells `ToolController` **not** to mount the legacy `ProjectUI` (both read the same `?project=` URL param for unrelated things — mounting both is a bug, not a feature).

**Migration boundary going forward:** a tool moving onto the authenticated model uses the Supabase system exclusively, via the two shared modules above — not a bespoke, per-tool integration file (that was Sprint 3's one-off approach for Variation Notice, generalised in Sprint 4 once it was proven). The legacy system is not being deleted; it keeps serving every tool that stays anonymous/free-tier, and is retired tool-by-tool as each one migrates, not in a single cutover. See `docs/PHASE_3_VARIATION_NOTICES_SCHEMA.md` and the Sprint 4 changelog entry for the worked example.

**Migrated so far:** Variation Notice (Sprint 3), Quote Builder and Progress Claim (Sprint 5b — retrofitted onto the Sprint 4 pattern exactly like Variation Notice was, not built from scratch; both tools already existed as legacy localStorage document generators). Quote Builder and Progress Claim also each gained a typed line-items child table synced separately from the header row on every save (`js/toolkit/supabase-line-items.js`'s `syncLineItems()`) — a shape Variation Notice's single-table record didn't need. See `docs/changelog.md`'s Sprint 5b entry for the full detail.

**Migration completed (2026-08-04):** every remaining tool. Site Attendance got its own bespoke schema (`018`) because of its anonymous worker-facing flow — see that migration's own header. The 17 remaining simple document tools (no line items, no server-computed totals — checked against each tool's actual field schema, not assumed) share one table, `public.project_documents` (`019`), with a `document_type` discriminator, rather than seventeen near-identical dedicated tables. Each tool's own `js/tools/<tool>/supabase-integration.js` is a ~15-line call into the one shared `js/toolkit/supabase-document-integration.js` — session gating, the Save-to-project panel, and the project's document list are not reimplemented per tool. `js/toolkit/supabase-record-panel.js`'s `refreshRecordList()` gained one small, additive extension (`cfg.match`, supporting both `.eq()` and `.in()`) to let a single tool's own list (`document_type: 'defect_report'`) and Project Hub's taxonomy-grouped lists (`document_type: [...]`) share the same function — every dedicated-table tool that doesn't pass `cfg.match` is unaffected. The legacy `ProjectUI`/localStorage system (above) is not deleted — it remains available as `cfg.projectMode`'s default/unset value for any future tool that isn't ready to migrate — but every tool that currently exists now uses the Supabase system exclusively.

---

## Security Considerations

- No user data stored Phase 1 (all forms go to Formspree)
- Phase 2: All passwords hashed via Supabase Auth (bcrypt)
- Phase 2: Row Level Security on all database tables
- API keys stored in environment variables (never in code)
- CSP headers configured on Phase 2 hosting platform
- No third-party scripts unless audited (no Google Tag Manager etc.)

---

## Performance Targets

| Metric | Target | Current Status |
|---|---|---|
| Lighthouse Performance | 95+ | ~90 (untested after recent changes) |
| Lighthouse Accessibility | 95+ | ~92 |
| First Contentful Paint | < 1.5s | ~0.8s (static, no JS blocking) |
| Total Blocking Time | < 50ms | Low (minimal JS) |
| CLS | < 0.1 | Stable (no layout shifts) |

---

## Related Documents

- [coding-standards.md](coding-standards.md) — Code style and conventions
- [api-documentation.md](api-documentation.md) — API endpoint specifications
- [decisions/](decisions/) — Architecture Decision Records
