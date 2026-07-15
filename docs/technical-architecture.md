# Technical Architecture

**Purpose:** Describe the system design, technology stack, and infrastructure decisions for BIK Solutions.
**Last Updated:** 2026-07-15
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
- All JS in `js/main.js`; no modules
- IIFE pattern for encapsulation (no globals)
- IntersectionObserver for scroll animations and stat counters
- Formspree AJAX for all forms

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
| Auth | Supabase Auth | Simple, free tier generous |
| Database | Supabase (PostgreSQL) | Stores users, documents, subscriptions |
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
