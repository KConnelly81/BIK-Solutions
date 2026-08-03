# Product Roadmap

**Purpose:** Phase-by-phase delivery plan for the BIK Business Toolkit platform.
**Last Updated:** 2026-08-02
**Status:** Active
**Owner:** BIK Solutions Pty Ltd

---

## Production status (added 2026-08-02, Sprint 5 close-out)

The phase/tool table below predates the authenticated Supabase build and still describes the
original static-website plan. The actual delivery has run as a separate, sprint-numbered track
since — see `docs/RELEASE_v0.3.0_SPRINT3.md`, `RELEASE_v0.4.0_SPRINT4.md`, and
`RELEASE_v0.5.0_SPRINT5.md` for the authoritative current state. As of Sprint 5 (2026-08-02):

- **Live on the authenticated Supabase model, in production:** Variation Notice, Quote Builder,
  Progress Claim — each with a dedicated table, RLS, organisation/project-scoped concurrency-safe
  numbering, and an RPC-only issue workflow. Progress Claim issuing remains database-blocked
  pending an accountant/contract decision (drafts fully usable).
- **Still legacy localStorage, not yet migrated:** every other tool in the table below (Scope of
  Works, Site Diary, Defect Report, Toolbox Talk, SWMS, Payment Reminder, Site Inspection, and the
  full Phase 2/3 list).
- **Next proposed sprint:** migrate the AI Professional Writer's existing Cloudflare Worker proxy
  (already server-side, holding the Anthropic key — no direct-from-browser key model exists today)
  to a session-authenticated Supabase Edge Function, closing the current gap that the proxy is
  unauthenticated with no per-organisation attribution or rate limiting — see
  `docs/SPRINT_6_PROPOSAL_AI_EDGE_FUNCTION.md`.

**Confirmed product direction (2026-08):** BIK is the AI operating layer that sits above/alongside
job-management platforms (ServiceM8, Buildxact, SimPRO), not a replacement for them — dedicated
workflows over configurable forms, reduce typing/clicks, mobile-first, little-to-no setup, and a
long-term AI Contract Manager vision (proactive issue-flagging, not just document generation on
request). Full detail: `docs/business-strategy.md` ("Competitive Landscape" and "AI Direction").
This does not change current sprint priorities — the core quote-to-cash suite remains the focus.

---

## Roadmap Summary

| Phase | Tools | Subscription | Target Date | Goal |
|---|---|---|---|---|
| Phase 1 | 10 core AI tools | Free / $19–29/mo | Q3 2026 | Launch, list-build, validate |
| Phase 2 | 25 tools | $19–49/mo | Q1 2027 | 500 paying subscribers |
| Phase 3 | 50 tools | $19–99/mo | Q3 2027 | $50K MRR |
| Phase 4 | 100+ tools + AI Agents | $19–199+/mo | 2028 | Category leader |

---

## Phase 1 — Foundation (Q3 2026)

**Theme:** Build the platform shell and launch the 10 highest-value tools.

**Website deliverables (current sprint):**
- [x] Homepage redesign (hero, stories, audience cards)
- [x] Nav updated to include Business Toolkit
- [ ] `toolkit.html` — Toolkit home page
- [ ] `ai-documents.html` — AI Document Generator (UI shell, coming soon states)
- [ ] `templates.html` — Downloadable template library
- [ ] `construction-resources.html` — Resource hub
- [ ] `productivity.html` — Builder Productivity Hub
- [ ] `coming-soon.html` — Roadmap + waitlist page

**Phase 1 Tools (10 tools):**
See [ai-tool-catalogue.md](ai-tool-catalogue.md) for full specs.

| # | Tool | Category | Revenue |
|---|---|---|---|
| 1 | Quote Builder | Sales & BD | Pro |
| 2 | Scope of Works Generator | Project Admin | Pro |
| 3 | Variation Notice | Project Admin | Pro |
| 4 | Progress Claim | Finance | Pro |
| 5 | Site Diary Generator | Project Admin | Free |
| 6 | Defect Report | Project Admin | Pro |
| 7 | Toolbox Talk Generator | Safety | Free |
| 8 | SWMS Generator | Safety | Pro |
| 9 | Payment Reminder | Finance | Free |
| 10 | Site Inspection Report | Project Admin | Pro |

**Phase 1 Success Criteria:**
- 500 email subscribers
- 100 paying users
- $2,000 MRR
- Net Promoter Score > 40

---

## Phase 2 — Growth (Q1 2027)

**Theme:** Expand tool coverage, introduce Business plan, grow to 500 subscribers.

**New tools (15 additional):**
- Subcontractor Agreement
- Contract Variation Log
- Handover Checklist
- Safety Management Plan
- Incident Report
- Client Proposal
- Project Completion Certificate
- Material Schedule
- Tender Response
- Employee Onboarding Pack
- Job Safety Analysis (JSA)
- Hire Contractor Checklist
- Retention Claim Notice
- Build Cost Tracker
- Insurance Certificate of Currency Request

**Infrastructure:**
- User accounts (email/password auth)
- Dashboard with document history
- PDF export with BIK branding
- Formspree → database migration
- Email automation (welcome, nurture, upsell sequences)

**Phase 2 Success Criteria:**
- 500 paying subscribers
- $15,000 MRR
- 25 tools live

---

## Phase 3 — Expansion (Q3 2027)

**Theme:** Become the platform. 50 tools, team plans, industry partnerships.

**New tool categories:**
- Client Communication suite (10 tools)
- HR & People suite (8 tools)
- Subcontractor Management suite (6 tools)

**Infrastructure:**
- Team workspaces (multi-user)
- Role-based access (admin, member, viewer)
- Integration with Xero (invoice import)
- Integration with ServiceM8 (job import)
- API access for Enterprise tier
- iOS/Android app (PWA first)

**Phase 3 Success Criteria:**
- $50,000 MRR
- 50 tools live
- 2 industry partnerships announced

---

## Phase 4 — AI Operating System (2028)

**Theme:** Autonomous AI agents that handle entire workflows end-to-end.

**AI Agent capabilities:**
- Voice-to-site-diary (record audio → formatted diary entry)
- Photo-to-defect-report (upload photos → structured report with AI descriptions)
- Invoice-to-progress-claim (scan invoice → generate claim)
- Auto payment reminder (monitor due dates → send reminders automatically)
- SWMS from job description (describe the job → draft SWMS)
- Contract review (upload contract → flag risks and missing clauses)

**Phase 4 Success Criteria:**
- $200,000 MRR
- 100+ tools and agents live
- Acquisition or investment conversations active

---

## Current Sprint

**Sprint 5 closed 2026-08-02** — Quote Builder and Progress Claim moved to the authenticated
Supabase model, Project Hub extended to all three live tools, live production acceptance testing
passed in full. See `docs/RELEASE_v0.5.0_SPRINT5.md` for the full release record.

**Sprint 6 (proposed, not started):** secure Supabase AI Edge Function — see the proposal
referenced from `docs/RELEASE_v0.5.0_SPRINT5.md`. Not begun automatically; awaiting explicit
go-ahead.

See [feature-backlog.md](feature-backlog.md) for the older, pre-Supabase task-level website
backlog (largely superseded by the sprint track above, not actively maintained).

---

## Related Documents

- [feature-backlog.md](feature-backlog.md) — Task-level backlog
- [ai-tool-catalogue.md](ai-tool-catalogue.md) — Full tool specs
- [release-plan.md](release-plan.md) — Launch checklist
- [pricing-strategy.md](pricing-strategy.md) — Revenue model
