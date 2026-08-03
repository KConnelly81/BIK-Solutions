# BIK Solutions — MVP Readiness Assessment

**Date:** 2026-08-03
**Branch:** `release/mvp-user-testing`
**Method:** Direct source inspection (repository code, not documentation) — every status below is backed by a specific file/line finding, not an assumption. Live database/RLS status is drawn from the already-verified Sprint 5 production acceptance (`docs/RELEASE_v0.5.0_SPRINT5.md`) rather than re-run in this pass, since that record is recent and specific to the same live project (`hpcqncghvdrlvufxfdnd`).

---

## 0. The one finding that reframes everything else

**BIK currently has two disconnected products living in the same repository, not one platform with some incomplete tools.**

1. **The real product**: `signup.html` / `signin.html` → real Supabase Auth → `app-dashboard.html` (session-gated, redirects to `signin.html` if not authenticated — verified at `app-dashboard.html:335,340`) → `project-hub.html` (real, org-scoped, RLS-protected Supabase `projects` table) → exactly **three** tools: Variation Notice, Quote Builder, Progress Claim. This is the only path with real accounts, real tenant isolation, and real cross-device persistence.

2. **The legacy demo**: `dashboard.html` — **zero authentication** (no Supabase import, no session check — verified by grep, confirms none of `supabase|getSession|redirect|signin` appear anywhere in the file) — reads and writes a browser-local `projectStore` (`js/toolkit/project-store.js`, explicitly `localStorage`-only, comment: *"PROJECT_STORAGE_POINT — swap for Supabase calls in V2"*). It links to all 20 buildable tools, including the 3 real Supabase ones.

3. **The marketing site's own "Open Toolkit" button — on every public page, including the homepage — points at `dashboard.html`, the legacy no-auth demo, not `app-dashboard.html`.** A brand-new visitor who signs up, gets redirected correctly to the real `app-dashboard.html` once — but the instant they navigate back to the marketing site and click "Open Toolkit" again (the obvious, only labelled entry point), they land in the disconnected local-only demo instead of back in their real account. This is a broken primary journey, not a cosmetic issue, and it is fixed as Completion Package 1 below.

4. **`app-dashboard.html` → `project-hub.html` has no link to any of the other 17 tools or to Site Attendance at all.** Even a user who never leaves the real, authenticated flow cannot reach Site Diary, SWMS, Incident Report, etc. from inside their own account today — those tools only exist inside the disconnected legacy demo.

Everything in the matrix below should be read against this fact: "Functional but disconnected" for 17 of the ~20 built tools does not mean "nearly there" — it means the tool has no route into the authenticated, project-associated, multi-device product at all yet.

---

## 1. Existing Tool Readiness Matrix

Status legend: **Connected & test-ready** / **Functional but disconnected** / **Partially implemented** / **Catalogue-only** / **Broken** / **Intentionally excluded from MVP**.

### Commercial and payment tools

| Tool | Status | Persistence | Project connection | Export | Tests | MVP tier | Main gap | Recommended action |
|---|---|---|---|---|---|---|---|---|
| **Quote Builder** | Connected & test-ready | Supabase (`quotes` table, migrations 012-014), RLS-verified live | Real Supabase `projects`, via `project-hub.html?project=<uuid>` | Browser print-to-PDF (shared `exporter.js`) | Yes — `quote-save-logic.test.js` | **Tier 1** | None blocking; verified in Sprint 5 live acceptance | Keep as reference pattern |
| **Variation Notice** | Connected & test-ready | Supabase (`variation_notices`, migrations 010-011) | Real Supabase project | Print-to-PDF | Yes — `variation-save-logic.test.js` | **Tier 1** | None blocking | Keep as reference pattern |
| **Progress Claim** | Connected & test-ready | Supabase (`progress_claims`, migrations 015-017) | Real Supabase project | Print-to-PDF | Yes — `progress-claim-save-logic.test.js` | **Tier 1** | Issue/finalise workflow intentionally deferred (per prior sprint decision log) | Keep as reference pattern |
| **Payment Reminder** | Functional but disconnected | `localStorage` only (`document-history.js`, legacy `project-store.js`) | Legacy project concept only — invisible to real accounts/Project Hub | Print-to-PDF | None | **Tier 1** (per your brief) | No route from `app-dashboard.html`; no Supabase persistence | Needs the Supabase-integration build-out (same pattern as Quote Builder) before it can honestly sit in Tier 1 — see Backlog P1-3 |
| **Retention Claim** | Catalogue-only | N/A | N/A | N/A | N/A | Out of scope | Not built as a standalone tool — retention is a calculated field inside Progress Claim, and `ai-documents.html` lists it under `coming: [...]` | No action needed for MVP; catalogue already labels it correctly as coming soon |

### Site and project records

| Tool | Status | Persistence | Project connection | Export | Tests | MVP tier | Main gap | Recommended action |
|---|---|---|---|---|---|---|---|---|
| **Site Attendance (QR check-in)** | **Broken** (not merely disconnected) | `localStorage` (`attendance-store.js`, `checkin-token.js`) | Legacy `project-store` only | N/A (register view, no PDF) | None | **Tier 1** (per your brief) | **Cross-device failure by design**: `checkin.html` resolves the QR token via a `localStorage` lookup (`checkin-token.js`) that only exists on the device that generated the QR code. On the worker's own phone that lookup returns nothing, so the code falls back to using the raw token as a fake project ID and shows the generic label "Site" (verified `checkin.html:301-334`) — the check-in is then saved to the **worker's own device's** local storage, which the builder's dashboard can never read. The core promise of the feature (worker scans on their phone, builder sees it) cannot work today, for anyone, on any two separate devices. | Do not ship as Tier 1 in its current form — see Backlog P1-1. This is the single most severe functional finding in this audit. |
| **Site Diary** | Functional but disconnected | `localStorage` only | Legacy project concept only | Print-to-PDF | None | **Tier 1** (per your brief) | Same disconnection pattern as Payment Reminder | Backlog P1-2 |
| **Site Instructions** | Catalogue-only | N/A | N/A | N/A | N/A | Out of scope | No page, no tool folder — listed as `coming` in `ai-documents.html` | No action needed |
| **Delivery Register** | Catalogue-only | N/A | N/A | N/A | N/A | Out of scope | No page, no tool folder — listed as `coming` | No action needed |

### Safety and compliance

| Tool | Status | Persistence | Project connection | Export | Tests | MVP tier | Main gap | Recommended action |
|---|---|---|---|---|---|---|---|---|
| **SWMS Generator** | Functional but disconnected | `localStorage` only | Legacy only | Print-to-PDF | None | Tier 2 candidate | Same disconnection pattern | Label Beta / connect later |
| **Toolbox Talk** | Functional but disconnected | `localStorage` only | Legacy only | Print-to-PDF | None | Tier 2 candidate | Same pattern | Label Beta |
| **Incident Report** | Functional but disconnected | `localStorage` only | Legacy only | Print-to-PDF | None | Tier 2 candidate | Same pattern | Label Beta |
| **Inspection Checklist** | Functional but disconnected | `localStorage` only | Legacy only | Print-to-PDF | None | Tier 2 candidate | Same pattern | Label Beta |
| **Induction Register** | Catalogue-only | N/A | N/A | N/A | N/A | Out of scope | Listed as `coming` in `ai-documents.html` | No action needed |

### Contract notices and change management

| Tool | Status | Persistence | Project connection | Export | Tests | MVP tier | Main gap | Recommended action |
|---|---|---|---|---|---|---|---|---|
| **EOT Claim** | Functional but disconnected | `localStorage` only | Legacy only | Print-to-PDF | None | Tier 2 candidate | Same pattern. **No duplicate catalogue listing found in current source** — `ai-documents.html` lists it exactly once, under one category (`tools:['eot-claim','delay-notice','instruction-to-proceed']`); if you saw a duplicate, it was in pasted/older content, not the live repo. | Label Beta |
| **Delay Notice** | Functional but disconnected | `localStorage` only | Legacy only | Print-to-PDF | None | Tier 2 candidate | Same pattern | Label Beta |
| **Instruction to Proceed** | Functional but disconnected | `localStorage` only | Legacy only | Print-to-PDF | None | Tier 3 | Same pattern, lower usage priority | Label Beta / Preview |

### Defects and subcontractor management

| Tool | Status | Persistence | Project connection | Export | Tests | MVP tier | Main gap | Recommended action |
|---|---|---|---|---|---|---|---|---|
| **Defect Report** | Functional but disconnected | `localStorage` only | Legacy only | Print-to-PDF | None | Tier 2 candidate | Same pattern | Label Beta |
| **Non-Conformance Report** | Functional but disconnected | `localStorage` only | Legacy only | Print-to-PDF | None | Tier 3 | Same pattern, lower usage priority | Label Beta / Preview |
| **Subcontractor Agreement** | Functional but disconnected | `localStorage` only | Legacy only | Print-to-PDF | None | Tier 3 | Same pattern | Label Preview / Document generator |
| **Notice to Show Cause** | Functional but disconnected | `localStorage` only | Legacy only | Print-to-PDF | None | Tier 3 | Same pattern | Label Preview / Document generator |
| **Contract Termination** | Functional but disconnected | `localStorage` only | Legacy only | Print-to-PDF | None | Tier 3 | Same pattern; also highest-consequence document to issue without any audit trail | Label Preview / Document generator |

### Project definition and completion

| Tool | Status | Persistence | Project connection | Export | Tests | MVP tier | Main gap | Recommended action |
|---|---|---|---|---|---|---|---|---|
| **Scope of Works** | Functional but disconnected | `localStorage` only | Legacy only | Print-to-PDF | None | Tier 2 candidate | Same pattern | Label Beta |
| **Practical Completion** | Functional but disconnected | `localStorage` only | Legacy only | Print-to-PDF | None | Tier 2 candidate | Same pattern | Label Beta |
| **Handover Checklist** | Functional but disconnected | `localStorage` only | Legacy only | Print-to-PDF | None | Tier 2 candidate | Same pattern | Label Beta |

### Platform / connective tissue (not in your named list, but load-bearing)

| Component | Status | Notes |
|---|---|---|
| **Sign up / Sign in** | Connected & test-ready | Real `supabase.auth.signUp` / `signInWithPassword` (`signup.html:125`, `signin.html:82`), correct redirects to `app-dashboard.html`, correct `emailRedirectTo` handling |
| **app-dashboard.html** | Connected & test-ready, but shallow | Session-gated correctly; shows projects and create-project action; has **no links out to any tool** except via Project Hub, and Project Hub only surfaces 3 tools |
| **project-hub.html** | Functional but incomplete | Shows Variation Notices, Quotes, Progress Claims sections only (verified: exactly three `sb-list-*-panel` sections exist). No Site Diary, no Attendance, no safety/contract-notice records — because none of those tools write to Supabase yet |
| **dashboard.html (legacy)** | Functional but disconnected from real accounts | The actual home of all 17 non-migrated tools; no auth; is still the site-wide "Open Toolkit" destination (see Finding 0) |
| **Catalogue (`ai-documents.html`, `toolkit.html`)** | Mostly accurate | No duplicate tool entries found in current source. Card copy does not currently claim cloud persistence for the disconnected tools, so it is not actively misleading — but it also does not disclose that most tools save locally-only, which is a Phase 7 gap (see Backlog P2) |
| **Tenant isolation / RLS (Supabase tables)** | Verified (for the 3 connected tools only) | `organisations`, `profiles`, `customers`, `projects`, `variation_notices`, `quotes`, `progress_claims` — RLS policies applied and live-verified during Sprint 5 acceptance testing (`docs/RELEASE_v0.5.0_SPRINT5.md`). Not re-run in this pass; no schema changes since then. **Does not apply** to any of the 17 legacy tools or Attendance — they have no server-side boundary at all because they have no server-side storage at all |
| **Automated test suite** | 107 tests, all passing | Coverage is concentrated in the 3 Supabase-migrated tools plus shared core modules (`calculator`, `project-gate-logic`, `record-list-logic`, `with-timeout`). **Zero tests** exist for any of the 17 legacy tools or for Attendance/check-in |

---

## 2. MVP Completion Backlog

### P0 — none currently open
No security defect, tenant-data exposure, data-loss bug, broken authentication, or public access to private records was found in this pass. Auth and RLS on the 3 connected tools were live-verified in Sprint 5. This is a genuinely clean P0 slate — it does not mean the product is done, it means the *connected* surface is secure. Recheck this line if any package below touches auth or RLS.

### P1 — blocks closed testing on Tier 1 tools
1. **P1-1 — Site Attendance QR flow is non-functional across devices.** (Detailed above.) A worker's own-device check-in never reaches the builder. This must not ship as-is if Site Attendance stays in Tier 1; either rebuild it on the real Supabase project model before testing, or drop it to Tier 4 (hidden) for this round and say so plainly to testers.
2. **P1-2 — Site Diary has no path into the real, authenticated product.** No Supabase table, no Project Hub section, unreachable from `app-dashboard.html`. Blocks the "use tools within a project, records survive login" journey for this Tier 1 tool.
3. **P1-3 — Payment Reminder has no path into the real, authenticated product.** Same gap as Site Diary.
4. **P1-4 — Marketing site's "Open Toolkit" entry point sends users to the disconnected legacy demo, not the real signed-in product.** Confirmed on every marketing page (verified during the recent SEO audit's footer sweep) plus `dashboard.html` itself. This is the reason a fresh signed-up user cannot reliably find their way back into their own account. **Fixed in Completion Package 1 below — zero schema risk, pure navigation fix.**

### P2 — necessary before confident testing, not launch-blocking on their own
1. Project Hub shows no "recent activity" or cross-tool view beyond the three connected record types — testers will ask "where's everything else" if Tier 2 tools are visible in the catalogue but invisible in their project.
2. Catalogue cards for the 17 disconnected tools do not disclose that saves are local-to-this-browser-only. Not misleading today (no false cloud/sync claim exists), but silence here will surprise a tester who reloads on a different device. Needs a plain label per Phase 7 ("Standalone generator" / "saves on this device only").
3. No automated tests exist for any of the 17 legacy tools — acceptable for a labelled Beta/Preview tier, but should be logged as debt, not silently absent.
4. `dashboard.html`'s continued existence as an unauthenticated, unbranded-as-legacy page is confusing once `app-dashboard.html` is the intended entry point — needs at minimum a "you're viewing the standalone toolkit — sign in for the full connected experience" banner, or a redirect, once Package 1 lands.

### P3 — deferred, not required for closed testing
- Standardising Draft/Issued/Approved/Closed statuses across all 17 legacy tools.
- Full Supabase migration for every Tier 2/3 tool (SWMS, Toolbox Talk, Incident Report, Defect Report, Scope of Works, Delay Notice, EOT Claim, Handover Checklist, etc.) — real, valuable, but each is its own schema-design decision and too large to bundle into this loop without your sign-off per tool.
- Dashboard "items requiring attention" intelligence.
- Any accounting integration, offline support, or trade-specific pack work — explicitly out of scope per your brief.

### Explicitly out of scope for this loop (per your instructions)
New tools, AI Contract Manager automation, major dashboard analytics, new public website content, homepage repositioning, broad visual redesign, offline-first architecture, accounting integrations, trade-specific packs.

---

## 3. Tier Recommendation for First Closed-Testing Release

| Tier | Tools |
|---|---|
| **Tier 1 (Core MVP, connected today)** | Dashboard (`app-dashboard.html`), Project Hub, Quote Builder, Variation Notice, Progress Claim |
| **Tier 1 (named in your brief, not yet connected — recommend holding back until P1-1/2/3 land)** | Site Attendance, Site Diary, Payment Reminder |
| **Tier 2 (visible, label "Beta" — stable generators, no project sync yet)** | SWMS, Toolbox Talk, Incident Report, Defect Report, Scope of Works, Delay Notice, EOT Claim, Handover Checklist, Practical Completion |
| **Tier 3 (visible, label "Preview" / "Standalone document generator")** | Instruction to Proceed, Non-Conformance Report, Subcontractor Agreement, Notice to Show Cause |
| **Tier 4 (recommend hiding or clearly relabeling for this round)** | Contract Termination (highest-consequence document with zero audit trail or connected history — riskiest to hand a real tester with no safety net), Site Attendance QR flow specifically (the check-in link itself, not the register view — it will actively fail in front of a real worker) |

This is a recommendation, not a decision made on your behalf — Phase 2 explicitly asks for a proposal here, and the Site Attendance / Payment Reminder / Site Diary tier calls in particular affect how ambitious this testing round is, so I'd like your steer before I start building new Supabase schema for any of them (see "What I need from you" at the end).

---

## 4. Completion Package 1 (implemented in this pass)

**Package:** Fix the primary entry point — point the site-wide "Open Toolkit" navigation at the real, authenticated `app-dashboard.html` instead of the disconnected, unauthenticated `dashboard.html`.

**Why this one first:** it is P1, it is the smallest possible safe change (a link-target swap, no schema, no new code paths), and it is the single highest-leverage fix in the whole backlog — every other Tier 1 journey step is unreachable until a real user can reliably get back into their own account from the marketing site.

**What it does not do:** it does not delete, hide, or break `dashboard.html` or any of the 17 tools that depend on it — they remain reachable by direct URL, unchanged, exactly as capable (or incapable) as they were before. It only stops presenting the disconnected demo as the default "sign in and use the product" destination.

Implementation, verification, and commit for this package follow below.
