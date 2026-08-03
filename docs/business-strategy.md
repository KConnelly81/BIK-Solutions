# Business Strategy

**Purpose:** Define the business model, revenue streams, and competitive positioning for BIK Solutions.
**Last Updated:** 2026-07-15
**Status:** Active
**Owner:** BIK Solutions Pty Ltd

---

## Business Model Overview

BIK Solutions operates two business units that reinforce each other:

### Unit 1 — Trades Services (Current)
A premium trades services business operating across South East Queensland (Gold Coast to Brisbane). Services include make-good and repairs, strip and prep, site protection, and handyman finishing.

**Revenue model:** Project-based quoting. High-margin, relationship-driven. Targets property managers, builders, and homeowners.

### Unit 2 — SaaS Platform (Building)
An AI-powered Business Operating System for Australian construction businesses. Freemium SaaS with tiered subscriptions.

**Revenue model:** Monthly/annual subscriptions + digital product sales.

The two units share a brand but operate independently. Services revenue funds platform development. Platform growth brings inbound leads for services.

---

## Revenue Streams

### Current Revenue
| Stream | Model | Notes |
|---|---|---|
| Trades services | Per-project quotes | Primary income today |
| Digital templates | Gumroad one-time sales | Passive income; in development |

### Planned Revenue (Platform)
| Stream | Model | Target Launch |
|---|---|---|
| Starter plan | $19/month (3 AI tools) | Phase 2 |
| Pro plan | $29/month (all Phase 1 tools) | Phase 2 |
| Business plan | $49/month (Phase 2 tools + teams) | Phase 3 |
| Enterprise plan | $99+/month (custom + API access) | Phase 4 |
| Template bundles | One-time $29–$79 per bundle | Phase 1–2 |
| Affiliate / partner revenue | Referral fees from tool integrations | Phase 3+ |

---

## Target Market

### Primary: Small-to-medium trade businesses (1–20 staff)
- Builders and construction companies
- Project managers and site supervisors
- Trade subcontractors (plumbers, electricians, concreters, painters)

### Secondary: Property professionals
- Property managers (residential and commercial)
- Real estate agencies with large maintenance portfolios
- Strata management companies

### Tertiary: Homeowners undertaking major renovations
- Owner-builders
- Homeowners managing their own trades

### Geography
- Phase 1–2: South East Queensland (local credibility)
- Phase 3: All of Australia
- Phase 4: Australia + New Zealand

---

## Competitive Landscape

**Confirmed strategic direction (2026-08, informed by builder/tradie conversations and
competitor research including Sitemate):** BIK Solutions is **not** trying to replace job
management platforms such as **ServiceM8, Buildxact, or SimPRO**. Those products own scheduling,
job costing, and field-service dispatch — a different, well-served problem. **BIK's strategy is to
become the AI operating layer that sits above or alongside existing systems**, not one more
all-in-one platform competing for the same seat. When an implementation decision could go either
way, **favour integrating with an existing system over replacing it**.

| Competitor | Strength | Weakness | Our Angle |
|---|---|---|---|
| ServiceM8 / Buildxact / SimPRO | Job management, scheduling, costing — the system of record for the job itself | Not document/compliance/contract-protection focused; generic AI, if any | **Complementary, not competing** — BIK sits above/alongside as the AI layer, not a replacement |
| Procore | Enterprise-grade, comprehensive | Expensive, complex, overkill for SME | We're simpler and construction-specific |
| Aconex / Oracle | Large project management | Not for small businesses at all | Different market |
| Sitemate | Configurable forms/checklists platform | Generic form-builder model — understands "collect data," not the business process | We build **dedicated workflows** (Quote, Variation, Progress Claim, Attendance) that understand the process itself, not configurable forms a user has to design |
| Generic AI (ChatGPT) | Flexible | Not construction-specific, no templates, no Australian compliance | We're purpose-built |
| Microsoft Word/Excel | Familiar | No automation, no intelligence | We save 2–4 hours per document |

**Positioning statement:** BIK is the AI Contract Manager for Australian trade businesses — the
layer that reduces admin, protects profit through better documentation, and helps builders get
paid faster, working alongside whatever job-management software a business already uses rather
than asking them to switch.

**Primary customer, stated plainly:** a small-to-medium trade business owner who dislikes
software but values anything that visibly saves time or prevents lost revenue. Every feature
decision should be tested against that bar, not against what a bigger, more configurable platform
would offer.

**Product principles this implies** (full detail: `docs/ux-principles.md`) — favour features that:
reduce typing, reduce clicks, work well on mobile, require little or no setup, and let a user
complete a task in under a minute. Build dedicated workflows (the business process is known and
modelled in the product) rather than configurable forms (the user has to tell the product what the
process is) — Quote, Variation Notice, and Progress Claim already work this way; Attendance is the
next workflow this applies to.

## AI Direction — AI Contract Manager

The long-term AI vision is broader than text generation. AI should move from **reactive** (rewrite
this text on request) to **proactive** (surface what needs attention before being asked) —
identifying pending approvals, overdue variations, missing paperwork, projects at financial risk,
workers still signed on, and contracts requiring follow-up, and **recommending an action**, not
just reporting a status. This is a multi-sprint direction, not a single feature — the current AI
Professional Writer (text rewriting) is the reactive foundation; proactive insight generation is
future work building on the same authenticated, organisation-scoped data model Sprints 3-5
established (it requires real data to reason over — quotes, variations, and claims with real
statuses and dates — which is exactly what's now live). See
`docs/SPRINT_6_PROPOSAL_AI_EDGE_FUNCTION.md` for the immediate next step (a session-authenticated
AI backend, a prerequisite for any proactive feature that needs to reason over one organisation's
private data) and treat any future proactive-AI proposal as needing this same direction as its
starting brief.

## Future opportunities (lower priority — noted, not scheduled)

Kept in view for extensibility, not current sprint priorities: trade-specific starter packs,
client portals, a project timeline view, better dashboards, accounting integrations, read-only
links for builders to share with clients, digital worker profiles. Current priority remains the
core quote-to-cash suite (Quote → Variation → Progress Claim, now live) and the project-management
foundation under it. When making architecture decisions now, prefer designs that don't foreclose
these later — e.g. this sprint's shared Supabase-tool integration pattern is deliberately generic
enough that a future client-portal read-only view could reuse the same RLS-scoped query shape
rather than needing a parallel access model built from scratch.

---

## Go-to-Market Strategy

See [marketing-strategy.md](marketing-strategy.md) for full detail.

**Summary:**
1. Build authority through free tools and content (toolkit.html, resources.html)
2. Capture email via gated downloads and free tool usage
3. Convert email list to paid subscribers at Phase 2 launch
4. Grow via word of mouth in tight-knit trade communities (Facebook groups, industry associations)
5. Partner with industry bodies (Master Builders, HIA, QBCC) in Phase 3

---

## Pricing Philosophy

- **Free tools** generate trust and list growth
- **Starter tier** removes friction for first payment (low price point, low commitment)
- **Pro tier** is the target (most common subscription; full tool access)
- **Annual discount** of ~17% drives cash flow and reduces churn
- **No lock-in** — documents are always downloadable as PDFs

Price anchored against the value of the time saved:
> A builder earning $80/hour who saves 2 hours per week on admin saves $640/month. A $29/month subscription is an obvious ROI.

---

## Key Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Slow adoption by non-tech-savvy trades | High | High | Extremely simple UX; phone support; video walkthroughs |
| AI output quality issues | Medium | High | Human review step built into all document flows; clear disclaimers |
| Competitor (established player) enters AI-first | Medium | Medium | Move fast; build brand loyalty early; niche deeper |
| Services business distraction | Low | Medium | Clear separation of units; platform development is primary growth driver |
| Regulatory changes (WHS, QBCC) | Low | High | Maintain compliance library; build update workflow into roadmap |

---

## Related Documents

- [product-vision.md](product-vision.md) — Vision and phased evolution
- [pricing-strategy.md](pricing-strategy.md) — Detailed pricing tiers and rationale
- [marketing-strategy.md](marketing-strategy.md) — Channels, messaging, campaigns
- [product-roadmap.md](product-roadmap.md) — Phased delivery plan
