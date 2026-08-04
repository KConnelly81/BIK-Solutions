# BIK Business Toolkit — Closed Beta Readiness Report

**Date:** 4 August 2026
**Scope:** Authentication → Dashboard → Project Hub → Quote Builder → Variation Notice →
Progress Claim → Site Attendance (the "core authenticated platform" as of Completion
Package 2).
**Method:** Full code-level walkthrough of every screen and script in the journey below,
verified against the actual implementation (file paths and line references throughout),
not against documentation or assumption. This session has no live Supabase session or
browser available, so this is a rigorous reading of real code and real database
contracts — not a live click-through. Every fix below was applied to the actual files
and syntax-checked; none are proposals.
**Out of scope, per instruction:** new tools, new document types, a new Supabase
migration (unless a genuine P0/P1 defect demanded one — none did), a public-website
redesign, SEO work, AI Contract Manager work.

---

## 1. Closed Beta Readiness Report

### Overall readiness score: 7.5 / 10 — READY WITH MINOR LIMITATIONS

The core journey (sign up → dashboard → project → quote/variation/progress claim →
attendance → logout/login) is real, coherent, and internally consistent. Every save,
issue, and success message a beta tester will see comes from one shared JS module per
concern (`supabase-record-panel.js`, `supabase-issue-button.js`,
`supabase-project-context.js`), which is why the three document tools already behaved
almost identically before this pass started. The gaps found were narrow and fixable
within the "no new tools, no new migration" constraint, and all the P1s were fixed.

### Top strengths (verified, not assumed)

1. **The document tools were already disciplined about honesty.** Progress Claim's
   "Issue" button is permanently rejected by the database (`017`, pending accountant
   confirmation of GST/retention treatment) — and the UI already says so, in plain
   language, right next to the button, before the user ever clicks it
   (`progress-claim.html`: *"Issuing is not yet available for Progress Claims — see the
   message below if you try"*). This is exactly the standard Phase 6 of this review
   asked for, and it was already met.
2. **One shared save/issue/list vocabulary, not three.** `supabase-record-panel.js`
   and `supabase-issue-button.js` are the single source of every "Saved.", "Issued.",
   and "Not yet saved to this project." message across Quote Builder, Variation
   Notice, and Progress Claim — so a builder who learns the pattern in one tool
   already knows it in the other two.
3. **Every destructive/irreversible action in the document tools was already gated by
   a native `confirm()`** — Clear form, Delete draft, Delete document
   (`tool-controller.js`) — except the newest one, Issue, which this pass fixed (see
   §2 below).
4. **Site Attendance (Completion Package 2) is now the strongest tool in the
   platform for trust**, precisely because it fixes the one thing that would have
   been most embarrassing in front of a real builder: a worker checking in on their
   own phone appearing on the builder's dashboard on a different device, in real
   time (a manual refresh, not live push — see Known Limitations).
5. **Tenant isolation and RLS are not assumed — they're the actual enforced
   boundary**, verified for Attendance with a dedicated local functional-test suite
   this session (`supabase/local-test/attendance-functional-tests.sql`, 15 assertions,
   all passing) and previously for Quotes/Progress Claims/Variations in earlier
   sprints.

### Remaining weaknesses (not fixed this pass — see rationale)

| # | Weakness | Why not fixed now |
|---|---|---|
| 1 | **`toolkit.html`, the public marketing page describing the Business Toolkit, has zero links to `signup.html`, `signin.html`, or `app-dashboard.html`.** A visitor arriving from the real homepage (`index.html` → `toolkit.html`) has no path into the product at all. | Public-website change — explicitly out of scope for this pass ("Do not redesign the public website"). For a closed beta where you personally send five business owners a direct link, this doesn't block them — but fix it before any wider release. |
| 2 | **No "Forgot password?" link anywhere in `signin.html`.** | Building a working reset flow is new UI/pages, not a copy fix — judged out of scope for a "first hour" pass with five personally-onboarded testers who can ask you directly. Real gap for anything beyond closed beta. |
| 3 | **Attendance visibility across devices requires a manual "🔄 Refresh" click, not live push.** The underlying defect (data never reaching the builder at all) is fixed; this is the difference between "fixed" and "real-time," which would need a Supabase Realtime subscription — new functionality, not a bug fix. | Deliberately deferred — not a P1, and adding it now would be scope creep beyond "improve the first hour," not fixing a defect in it. |
| 4 | **No "Safety" tools connected to Project Hub** (SWMS, incident reports, toolbox talks exist as 14 separate legacy, unauthenticated tools, not part of the core platform). | Explicitly out of scope ("do not add new tools"). Project Hub now honestly labels this gap with a disabled "Safety — Soon" tile instead of pretending it doesn't exist (see §3). |
| 5 | **The old, deliberately-untouched localStorage toolkit (`dashboard.html`, `project.html`) links to `attendance.html?p=<id>`, a contract Site Attendance no longer accepts.** | Clicking that link now shows a clear "project not found" screen with a link to the real dashboard, rather than the old (cross-device-broken) view — a graceful degradation, not a crash. Consistent with Completion Package 1's own decision to leave that 17-tool legacy catalogue as separately tracked. |

### Recommended fixes (already applied this pass)

See §2 (First Hour Experience Review) and §3 (Product Consistency Report) for the
full, verified list with file references. Summary:

- Removed a genuinely dead button (**"AI Writer" setup**, `showAIKeyModal()`) from
  every core tool — it called a retired function that did nothing but
  `console.warn`.
- Added a native `confirm()` before **Issue** (Quote/Progress Claim) — the one
  irreversible action in the platform that didn't already have one.
- Fixed a real navigation inconsistency: the context-bar link in Quote Builder,
  Variation Notice, and Progress Claim said **"Change project" → the full dashboard
  project list**; Attendance (built this session) said **"Project Hub" → back to
  this project's hub**. Standardised all four on "Project Hub", centrally, in
  `supabase-project-context.js`, so it can't drift again.
- Standardised **GST summary wording** across all three calculating tools to the
  same `X (excl. GST)` / `GST (10%)` / `Y (incl. GST)` pattern (Variation Notice was
  missing the "(10%)"; Progress Claim and Variation Notice used a different bracket
  style than Quote Builder).
- Rebuilt the **Dashboard** to answer "what needs attention", not just "what am I
  working on" — each project card now shows a live "👷 N on site now" badge sourced
  from the same `attendance_records` table Site Attendance already writes to (no new
  schema).
- Rebuilt **Project Hub** into clearly labelled sections (Attendance / Commercial /
  Site), added a real **Project Information** panel (site address, description,
  dates, project number — data the gate query already had access to, just wasn't
  showing), and added an honest, disabled **"Safety — Soon"** placeholder instead of
  silence.
- Added the **beta feedback banner** to `app-dashboard.html` — it was on every tool
  page and Project Hub, but missing from the single most-visited page in the whole
  product.

### Known limitations (ship with these, documented, not hidden)

- Attendance is refresh-based, not real-time push.
- No password-reset flow.
- `toolkit.html` doesn't lead to signup (direct link only, for this beta).
- Site Diary and Payment Reminder remain intentionally standalone (per the confirmed
  Completion Package 2 scope decision) and are not reachable from Project Hub or the
  Dashboard — this is correct, not a bug, but worth remembering when briefing testers:
  don't expect them to find these two tools on their own.

---

## 2. First Hour Experience Review

Walked in the order given: Landing → Sign up → Email verification → Login →
Dashboard → Create project → Project Hub → Quote → Project Hub → Variation → Project
Hub → Attendance QR → Worker check-in → Builder sees worker → Export → Logout → Login
→ Find everything again.

### Landing page

`index.html` is the real public homepage (a dual-purpose trade-services + SaaS-toolkit
site, canonical `biksolutions.com.au`). Its own nav does not go to sign-up — it goes
to `toolkit.html`, a marketing page, which **has no link at all** to `signup.html`,
`signin.html`, or the dashboard (verified: zero matches for "sign up", "sign in",
"dashboard", "get started" anywhere in that file). **Not fixed** — public-site change,
out of scope. For your five testers, send them the direct `signup.html` link.

### Sign up (`signup.html`)

Clean, single card, four required fields plus optional ABN, client-side password-match
and ABN-format checks before hitting the network. Correctly branches on whether
Supabase Auth requires email confirmation (shows a "check your email" message and
preserves the organisation details for later) or issues a session immediately (in
which case it silently runs `bootstrap_organisation()` and lands the user straight on
the dashboard). **Works well.** Minor, unfixed: no link back to the marketing site, no
password-visibility toggle — cosmetic, not worth the risk of touching for this pass.

### Email verification

Depends entirely on the Supabase Auth project's own configuration (outside this
codebase). The client-side handling of both branches (confirmation required vs. not)
is correct and was verified by reading the actual branching logic, not assumed.

### Login (`signin.html`)

Same card pattern as sign-up, same clean error banner. **Real gap, not fixed:** no
"Forgot password?" link exists anywhere on the page — see Known Limitations.

### Dashboard (`app-dashboard.html`)

Before this pass: answered "what am I working on" (project cards: name, address,
status) and, weakly, "what should I do next" (a "New project" button, and a proper
"Create your first project" empty state for a zero-project org). It answered
**nothing** about "what needs attention" — every project card looked the same
regardless of what was actually happening on site.

**Fixed:** each project card now shows a live "👷 N on site now" badge, pulled from
`attendance_records` with one extra query (no new schema, no new migration) — a
project with three workers checked in right now visibly differs from one with zero.
Also added the beta feedback banner, previously missing from this page alone among the
core screens.

### Create first project

Inline form on the dashboard itself (name, status, address, description), with a
working Cancel that resets the form rather than leaving stale values behind next time
it's opened. No friction found here.

### Project Hub (`project-hub.html`)

Before this pass: a flat stack of panels (tool-launch row, then Attendance summary,
then three record lists) with no section structure, and no general "project
information" anywhere beyond the header's name/address/status pill.

**Fixed:** grouped into labelled sections — **Attendance**, **Commercial** (Quotes +
Progress Claims), **Site** (Variation Notices) — plus a new **Project Information**
panel (project number, description, start/completion dates — fields the page's own
gate query already had access to, simply widened the `SELECT` to include them) and an
honest, disabled **"Safety — Soon"** tile in the tool-launch row rather than silently
having no Safety story at all.

### Create first quote (`quote-builder.html`)

Consistent with the shared pattern: draft autosaves locally as you type, a privacy
notice explains exactly when the quote actually leaves the browser ("nothing is saved
to this project until you click Save to project"), then Save and Issue are two
separate, clearly-labelled steps.

**Fixed here:**
- Removed the dead "AI Writer" setup button (see below — applies to all five core
  tool pages).
- Fixed the context-bar link ("Change project" → "Project Hub").
- Added a `confirm()` before Issue — previously a single accidental click
  **permanently locked the quote**, database-enforced, with zero confirmation step.

### Return to Project Hub

Now works as a genuine "back to this project" action (previously routed to the full,
unfiltered dashboard project list — a real regression risk once a builder has more
than a couple of projects).

### Create variation (`variation-generator.html`)

Same shared pattern as Quote Builder; correctly has no "Issue" workflow at all (by
design — variation notices have no lock/issue concept in this platform, verified
against the migrations, not assumed missing).

**Fixed here:** dead AI Writer button removed; GST summary row brought in line with
Quote Builder's wording (`Cost (excl. GST)` / `GST (10%)` / `Total (incl. GST)` — was
missing the "(10%)" entirely); context-bar link fixed.

### Return to Project Hub

Same fix as above, consistent now.

### Generate attendance QR / Worker checks in / Builder sees worker

This is Completion Package 2's own delivery, re-verified in this pass rather than
re-built: `attendance.html` is now Project-Hub-gated like the other three tools
(previously a standalone project `<select>`), `checkin.html`/`checkout.html` write
directly to Supabase via `SECURITY DEFINER` RPCs. A worker's check-in from their own
phone is visible in the builder's dashboard on any device — the actual P1 this
package existed to fix — confirmed by the schema's design and the 15-assertion local
functional test suite, not by assumption. The builder does need to click "🔄 Refresh"
to see it (no live push) — see Known Limitations, not treated as a blocker.

### Export document

PDF/print export (`ExportManager`, shared across all document tools) and Attendance's
CSV exports are both real, working code paths verified by reading the export
functions directly — not stubs, not demo data.

### Logout → Login again → Find everything again

`signOut()` clears the Supabase session and redirects cleanly to `signin.html`.
Session persistence (`persistSession`/`autoRefreshToken` in `js/supabase/client.js`) is
the standard Supabase pattern — a returning user's dashboard, Project Hub, and every
saved quote/variation/claim/attendance record are all ordinary RLS-scoped reads
against the same organisation, so "finding everything again" is not a separate code
path to break — it's the same query every other load already uses.

---

## 3. Product Consistency Report

Every item below was a **real, verified inconsistency**, not a stylistic preference —
each has a before/after and a file reference.

| Area | Before | After | Where |
|---|---|---|---|
| Dead button | "AI Writer" header button called a retired `showAIKeyModal()` that only logged a console warning — did nothing on click | Removed from all 5 core tool pages | `quote-builder.html`, `variation-generator.html`, `progress-claim.html`, `site-diary.html`, `payment-reminder.html` |
| Back navigation / project context | Quote/Variation/Progress Claim said **"Change project"** → full dashboard project list; Attendance said **"Project Hub"** → this project's hub | All four now say **"Project Hub"** and return to this project's hub — set centrally so it can't drift again | `js/toolkit/supabase-project-context.js` (single source), plus one HTML `id` added per tool page |
| Confirmation dialogs | Clear / Delete draft / Delete document already confirmed; **Issue (permanent, database-enforced) did not** | Native `confirm()` added before every Issue action | `js/toolkit/supabase-issue-button.js` |
| GST wording | Quote: `Subtotal (excl. GST)` / `GST (10%)` / `Total (incl. GST)`. Progress Claim: `This claim excl. GST` / `GST (10%)` / `Net payable incl. GST` (no brackets). Variation: `Cost excl. GST` / `GST` (no rate!) / `Total incl. GST` | All three now: `X (excl. GST)` / `GST (10%)` / `Y (incl. GST)` | `progress-claim.html`, `variation-generator.html` |
| Dashboard content | Answered "what am I working on", nothing about "what needs attention" | Live "on site now" badge per project card | `app-dashboard.html`, new `.status-pill--onsite` in `css/supabase-app.css` |
| Project Hub structure | Flat stack of panels, no section labels, no general project info | Attendance / Commercial / Site section headings; new Project Information panel; honest "Safety — Soon" placeholder | `project-hub.html`, `css/project-hub.css` |
| Beta feedback | Present on every tool page and Project Hub, absent from the Dashboard | Added to `app-dashboard.html` | one `<script>` tag |
| Standalone-tool honesty (carried over from Completion Package 2, re-verified here) | N/A | Site Diary and Payment Reminder each carry a clear "Standalone tool — saved on this device only" notice | `site-diary.html`, `payment-reminder.html` |

**Reviewed and deliberately left as-is** (a real difference, not an inconsistency worth
forcing): Attendance's date formatting uses short month names (`15 Jul 2026`) for
compact table/card display; Quote/Variation/Progress Claim use long month names
(`15 July 2026`) for formal document output via the shared `formatDateLong()`. Forcing
one style into the other's context would make one of them worse, not more consistent —
this is a legitimate content-density difference, not drift.

**Not touched, correctly:** the 14 legacy standalone document tools (SWMS, incident
report, toolbox talk, etc.) and the localStorage-only `dashboard.html`/`project.html`
catalogue — out of scope for "the core authenticated platform."

---

## 4. Beta Recommendation

# READY WITH MINOR LIMITATIONS

**Evidence for this call, not just an opinion:**

- Every screen in the required walkthrough (landing → ... → find everything again)
  was read against its actual implementation, not assumed. The one genuinely broken
  link in that chain (`toolkit.html` → nowhere) is a public-marketing-site issue that
  doesn't affect a beta where you send testers a direct signup link, and was correctly
  left alone per the explicit "do not redesign the public website" constraint.
- The one defect with real trust consequences found this session — a permanently
  destructive action (**Issue**) reachable by a single accidental click with zero
  confirmation — has been fixed.
- The one genuinely dead, do-nothing button in the core platform (**AI Writer**
  setup) has been removed, not left for a beta tester to discover by clicking it.
- The navigation and wording inconsistencies found were real (verified with exact
  before/after text and file references above), all fixable without new schema or new
  tools, and all fixed.
- The Dashboard and Project Hub now do the job Phases 4–5 of this review asked for:
  the Dashboard shows what needs attention (on-site-now), not just what exists;
  Project Hub is organised into sections a builder would recognise (Attendance,
  Commercial, Site) plus real project information, and is honest about what isn't
  connected yet (Safety) rather than silent about it.
- What's left (marketing-site signup path, password reset, real-time attendance
  push) are genuine, named limitations — not hidden, not misleading UI, and none of
  them block five personally-onboarded business owners from using the product
  correctly in their first hour.

**Before inviting testers:** send them the direct `signup.html` link (don't rely on
the public site's own navigation to get them there), and brief them that Site Diary
and Payment Reminder are separate standalone generators they'll need to find by direct
link, not through Project Hub.
