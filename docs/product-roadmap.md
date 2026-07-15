# Product Roadmap

**Purpose:** Phase-by-phase delivery plan for the BIK Business Toolkit platform.
**Last Updated:** 2026-07-15
**Status:** Active
**Owner:** BIK Solutions Pty Ltd

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

See [feature-backlog.md](feature-backlog.md) for task-level detail.

**Focus:** Phase 1 website build
- Creating 6 new pages (toolkit, ai-documents, templates, construction-resources, productivity, coming-soon)
- Adding Business Toolkit dropdown to all existing pages
- Adding SaaS component CSS to styles.css
- Testing and deploying to biksolutions.com.au

---

## Related Documents

- [feature-backlog.md](feature-backlog.md) — Task-level backlog
- [ai-tool-catalogue.md](ai-tool-catalogue.md) — Full tool specs
- [release-plan.md](release-plan.md) — Launch checklist
- [pricing-strategy.md](pricing-strategy.md) — Revenue model
