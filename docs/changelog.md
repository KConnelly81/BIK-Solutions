# Changelog

**Purpose:** Version history and record of significant changes to the BIK Solutions platform.
**Last Updated:** 2026-07-31
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
- **`public.variation_notices`** — dedicated, strongly typed table applied and fully verified live against `hpcqncghvdrlvufxfdnd` (2026-07-31), the schema backing the Variation Notices pilot migration (first tool onto the authenticated project model). Money as integer cents with `GENERATED ALWAYS AS STORED` GST/total columns, `variation_number` uniqueness scoped per-project (`organisation_id, project_id, variation_number`), a DB-enforced trigger guaranteeing `issued_snapshot` is captured only on the transition to `issued` and never altered otherwise. Full design: `docs/PHASE_3_VARIATION_NOTICES_SCHEMA.md` (includes the live verification report) and ADR-016 (`docs/decisions/README.md`). **Merged to `main`** (fast-forward, `main`..`c128001`); frontend integration is Sprint 3, tracked separately below.
- **Concurrency-safe `variation_number` generation** (`011_variation_notice_number_generator.sql`, applied and fully verified live against `hpcqncghvdrlvufxfdnd` on 2026-07-31, commit `d6ac0ed`) — replaces the existing tool's per-browser `localStorage` counter, which would let two people creating a variation at the same moment collide on the same number. A new `internal.variation_number_counters` table plus an atomic `INSERT ... ON CONFLICT DO UPDATE` in a `BEFORE INSERT` trigger, with no advisory lock needed (unlike `bootstrap_organisation()`, 006) since the whole read-and-increment is one atomic statement. Verified under genuine concurrent load locally, not just sequential calls: a transaction holding the counter row for 5 seconds correctly blocked a second, concurrently-started transaction for the full 5 seconds before it received the next (non-colliding) number. **Merged to `main`.**
- **Sprint 3 — Variation Generator frontend integration** (PR #5, merged via commit `9bc1583` — see `docs/RELEASE_v0.3.0_SPRINT3.md`) — wires `variation-generator.html` to `public.create_variation_notice()`, the only backend entry point used (no direct access to `internal.*`). Session- and project-gated the same way as `app-dashboard.html`; entered via a new "New Variation Notice" link on each project card there. Number handling: the client never generates, predicts, or reformats a variation number — a blank field asks for auto-numbering, a typed value is sent through exactly as entered, and the field is updated with the authoritative value the database returns after a successful save. A second "Save to project" click in the same session performs a plain authenticated `UPDATE` on the already-created row rather than calling the RPC again (no reassignment-on-`UPDATE` path exists in `011`, and this does not add one). Added a "Variations for this project" list with a running total, refreshed after each save. All raw database/auth errors are translated to plain-language, non-leaking text (`friendlyVariationError()` — an unrecognised error is never shown verbatim, only logged to the console). Pure logic (`js/tools/variation-notice/variation-save-logic.js`) unit tested — `js/tools/variation-notice/__tests__/variation-save-logic.test.js`, 32/32 passing (`node --test`). Manual browser test checklist (`docs/PHASE_3_SPRINT_3_MANUAL_TEST_STEPS.md`) run against the live project and passed. **Merged to `main`, deployed, tagged `v0.3.0-sprint3`.**
- **Sprint 4 — shared Supabase-tool integration pattern**, built to make Sprint 5's tool migrations (Quotes, Progress Claims, Invoices) cheap instead of each repeating Sprint 3's one-off wiring. No new tables, no new customer-facing capability — pure infrastructure, validated by retrofitting Variation Notice onto it with no behavioural change.
  - **`js/toolkit/supabase-project-context.js`** (new) — generic session/project gating, one-time snapshot application, and no-flash reveal, extracted from Sprint 3's tool-specific integration file.
  - **`js/toolkit/supabase-record-panel.js`** (new) — generic "Save to project" (create via an optional RPC, or a plain authenticated `insert` when a tool doesn't need one — most won't; falls back to `update` on later saves) and "records for this project" list wiring, including the duplicate-submit guard and the safe-error-message contract.
  - **`ToolController`'s `disableLegacyProjectUI` opt-out flag replaced with a positive `projectMode: 'supabase'`** — one documented switch instead of a flag plus a separate ad hoc file. Default (unset) behaviour is byte-identical for every other tool.
  - **`js/tools/variation-notice/supabase-integration.js` retrofitted onto the two new modules** — shrunk to just the tool-specific parts (table/RPC name, field mapping, validation, display copy). Caught and fixed one real bug introduced during the retrofit itself before it shipped: the authoritative saved `variation_number` wasn't being written back to the form field (a missing `applyResultToEngine` wire-up) — found by re-reading the diff, not by a test gap, since the generic module's contract made the omission visible.
  - **`dollarsToCents()`/`centsToDollars()` moved from `variation-save-logic.js` to `js/toolkit/calculator.js`** — every future Supabase-backed tool needs the same cents conversion, not just this one. Tests moved with them (`js/toolkit/__tests__/calculator.test.js`).
  - **CSS generalised**: `css/variation-supabase.css` renamed to `css/supabase-tool-panel.css`, class names `vn-*` → `sb-*` (and the matching element ids in `variation-generator.html`), so Sprint 5's tools reuse the same file and classes instead of copying their own.
  - **Deprecation boundary documented, not a cutover**: `docs/technical-architecture.md` ("Two project systems") records that the legacy localStorage `ProjectUI`/`project-store.js` keeps serving every tool not yet migrated, retired tool-by-tool as each one moves to the Supabase model — not deleted in this sprint.
  - **`docs/BACKEND_MIGRATION_CHECKLIST.md`** (new) — the table/RLS/grants/trigger shape proven by `010`/`011`, written up as a mechanical checklist so Sprint 5's new tables move faster without skipping review.
  - Regression: existing 32 unit tests re-verified passing after the retrofit (26 in `variation-save-logic.test.js` + 6 relocated to `calculator.test.js`).
  - **Second review round, closing two workflow risks:** added `public.create_variation_notice()`, a `SECURITY INVOKER` transactional RPC that validates the caller and project, allocates a number, and inserts the draft row as one atomic unit, so a number can never be consumed separately from row creation. Added a proactive, bounded collision-avoidance loop inside the trigger plus a bounded retry-on-conflict loop in the RPC, so a manual override in the same bare numeric format the generator itself produces (e.g. a user manually saving `"010"`) is skipped past cleanly rather than causing a later collision when the counter naturally reaches it. Added `internal.prevent_variation_number_counter_decrease()` so the counter cannot be moved backwards even via a privileged direct `UPDATE`.
  - **Bug found and fixed by this round's testing:** the original draft's `lpad(v_next::text, 3, '0')` was assumed to pass values through unpadded once they reached 3+ digits; Postgres's `lpad()` actually *truncates* instead, so a project's 1000th variation would have silently become `"100"` — colliding with the real, already-issued `"100"`. Fixed with an explicit width check (pad below 1000, pass through unpadded at/above it); re-verified beyond 999 after the fix.
  - **Third review round — canonical `"VAR-NNN"` format, replacing round two's bare-number output.** Round two's own fix (making `"VAR-010"` and bare `"010"` not collide) was itself flagged as a product-consistency problem — technically correct, but not what a user means by those two entries. Auto-generated references are now always `"VAR-001"`, ..., `"VAR-999"`, `"VAR-1000"`. Added `internal.format_variation_number()` (the round-two 1000-safe padding, factored out) and `internal.normalize_variation_number()`, which recognises a standard-equivalent manual entry — bare digits, `"var-010"`, `"VAR 010"`, `"VAR-010"` — and reduces it to the same canonical form before storage, while leaving a genuinely custom reference (`"CLIENT-VO-10"`) untouched. Because normalisation happens before the row is written, two semantically equivalent standard references can no longer coexist in the same project — they collapse to one string before the existing unique index ever has to decide — and the existing collision-avoidance loop from round two now correctly skips a manually entered higher canonical number (e.g. `"VAR-010"`) with no changes needed to that loop itself. Confirmed the bounded retry in `create_variation_notice()` only ever catches the variation-number uniqueness conflict and never conceals an unrelated constraint failure (tested against a throwaway unique constraint added and dropped for this check only). Re-ran the full concurrency test against the final trigger logic: unchanged, still race-free.
  - Full test checklists for both rounds (manual-override collision handling, pre-existing manual numbers, numbering beyond 999, counter non-decrease, project-deletion cascade cleanup, cross-organisation rejection, `search_path`/grant catalog checks, retry-scope isolation, and concurrency) — see `docs/PHASE_3_VARIATION_NOTICES_SCHEMA.md` for full results.
  - **Live browser testing (PR #7) found a blocking defect: the "Variations for this project" panel got stuck on "Loading…" permanently, with no records, empty state, or error ever shown.** Root cause: `refreshRecordList()` (`supabase-record-panel.js`) awaited its Supabase query with no `try`/`catch` — a rejected promise (rather than a resolved `{data, error}` result) skipped past the line that clears the loading state, so the panel never reached any terminal UI state. The identical missing-`try`/`catch` shape was also present in `gateOnSupabaseProject()` (`supabase-project-context.js`) — not the confirmed defect (the gate worked correctly during that test), but the same defect class in the same file family, fixed alongside it rather than left as a latent duplicate. Both functions now wrap their query in `try`/`catch` and always reach a terminal state (populated/empty/error), never a permanent loading state, regardless of how the query fails. The branching logic itself was extracted into two new pure functions — `determineListOutcome()` (`js/toolkit/record-list-logic.js`) and `determineGateOutcome()` (`js/toolkit/project-gate-logic.js`) — specifically so this exact bug class is unit testable without a browser; 14 new tests cover populated/empty/error/thrown-exception outcomes for both, all passing (46/46 total with the existing suite). Fix scoped to `sprint-4-clean`/PR #7 only — no migrations, Project Hub, or Sprint 5 work touched. **PR #7 merged to `main` (`2c2f6b8`), 2026-08-02.**
- **Production retest after PR #7's merge found the identical "Loading…" symptom still live**, despite the try/catch fix being deployed. Investigated (`hotfix/sprint4-variation-list-loading`, branched from `main` at `2c2f6b8`) rather than assuming the original diagnosis was complete:
  - **Confirmed structural gap, independent of live access:** `js/tools/variation-notice/supabase-integration.js`'s `onGated()` called `mount(...)` (builds the entire form via `ToolController.mount()`) and `refreshVariationsList(project.id)` as two back-to-back synchronous statements with no isolation between them. Any exception anywhere in mounting the form — unrelated to Supabase entirely — would abort execution before the list load was ever reached, leaving it stuck on its default static "Loading…" with nothing to explain why. Fixed by wrapping the `mount(...)` call in its own `try`/`catch` so `refreshVariationsList()` always runs regardless of whether the form mounted successfully.
  - **A hang, not just a rejection, was unaccounted for.** The PR #7 fix's `try`/`catch` only helps when the Supabase query *rejects* — it does nothing if the query never settles at all (a stalled RLS evaluation, an exhausted connection pool, a stuck request with no network-level error). A live console capture during the failed retest showed no `[BIK]`-prefixed error and no browser-level "Uncaught (in promise)" error either — consistent with the query genuinely hanging rather than rejecting, in either the pre-fix or post-fix code. Added `js/toolkit/with-timeout.js` (new, unit tested — 5 new tests) and wired it into both `refreshRecordList()` and `gateOnSupabaseProject()` (15s timeout each), so a query that never settles now surfaces a clear error state instead of hanging indefinitely.
  - **Stale caching could not be ruled out without live browser access** (this environment cannot reach `biksolutions.com.au` to verify which commit is actually being served). As defense-in-depth, added a manually-maintained `?v=` cache-busting query token to `supabase-integration.js`'s imports of the two files PR #7 actually modified (`supabase-project-context.js`, `supabase-record-panel.js`) — ES modules on this static site are cached by exact URL with no build-time content hashing, so a stale intermediate cache could otherwise keep serving the pre-fix code indefinitely regardless of a user hard-refresh.
  - Verified every import path in `variation-generator.html`'s full module graph resolves to a real file (no 404 risk from a path standpoint) and confirmed all `sb-list-*`/`sb-loading`/`sb-app-shell` DOM ids match between the HTML and the JS that queries them — both ruled out as contributing causes.
  - Noted separately, not fixed here (unrelated, cosmetic): a live console capture showed a 404 for `assets/fonts/Inter-SemiBold.woff2` — a missing webfont, not connected to the loading-state defect.
  - 51/51 tests passing (46 existing + 5 new `with-timeout` tests). Pushed to `hotfix/sprint4-variation-list-loading`. **Awaiting live retest before merge** — this environment cannot independently confirm a live fix without browser access.

### Fixed
- **`main`/`claude/bik-solutions-website-yevsuk` branch reconciliation.** All Phase 1/2 Supabase work (this changelog's entries below) had been merged and pushed only to `claude/bik-solutions-website-yevsuk`, believed to be the GitHub Pages deployment branch. It wasn't — GitHub Pages actually deploys from `main`, which had diverged by 25 commits of its own (a full design-system rollout across nearly every tool page) and had none of this work. Reconciled via a verified merge (zero conflicts, zero files lost from either side, confirmed the Cloudflare Worker AI-proxy security fix survived) of `yevsuk` into `main`; `main` is now the actual production branch with everything below live on it, `yevsuk` kept as a backup. Full detail: `docs/technical-architecture.md` ("Branch reconciliation") and `docs/RELEASE_NOTES_V0.1_PLATFORM.md`.
- **Live acceptance-test defect: email confirmation redirected to `localhost:3000`.** First real signup against the live deployment found that Supabase's confirmation email sent users to `http://localhost:3000` instead of the production site, because `signup.html`'s `supabase.auth.signUp()` call never specified `emailRedirectTo` — Supabase fell back to the project's Auth "Site URL", which was still the development default. Fixed by explicitly passing `emailRedirectTo: \`${window.location.origin}/signin.html\`` (`signup.html`), derived from the page's own origin rather than a hard-coded domain, so it can never resolve to `localhost` when actually served from production. Paired with an infrastructure-side fix (Supabase Auth → URL Configuration: Site URL and allowed redirect URLs updated to `https://biksolutions.com.au`). No other email-auth flow exists yet in the codebase (checked: no password-reset/magic-link/OTP calls anywhere) — the same `window.location.origin`-derived pattern must be used if/when one is added.

### Added
- **Supabase frontend integration (Phase 2, separate-page approach)** — first working end-to-end journey against the live Phase 1 backend (`hpcqncghvdrlvufxfdnd`): sign up, confirm email if required, create an organisation via `bootstrap_organisation()`, reach a protected dashboard, create and list projects, survive a refresh, log out, log back in, still see the same organisation and project
  - `js/vendor/supabase-js.min.js` — official `@supabase/supabase-js` 2.111.0 UMD build, vendored (not CDN-loaded) so the app has no runtime dependency on a third-party host for the login path
  - `js/supabase/client.js` — one shared Supabase client for the whole app, configured with only the project URL and publishable key (never service-role)
  - `js/supabase/session.js` — session/auth helpers: protected-page gating with no pre-check flash, profile+organisation lookup, sign-out, friendly error text
  - `signup.html` — full name/email/password/confirm/organisation name/ABN; handles both immediate-session and email-confirmation-required signup, non-sensitive organisation details preserved across the confirmation redirect
  - `signin.html` — email/password sign-in
  - `app-dashboard.html` — protected dashboard: organisation name, signed-in user, project list/create/logout; inline organisation-setup step for an authenticated user with no profile yet (fresh signup or an interrupted bootstrap)
  - `css/supabase-app.css` — shared styles for the three new pages, built on `css/styles.css`'s existing tokens
  - Projects created through this flow use the schema's real status values (`draft`/`active`/`on-hold`/`completed`/`archived` — `completed`, not the legacy toolkit's `complete`) and are scoped entirely by RLS, not by any client-supplied organisation id
  - `dashboard.html`, `project.html`, `js/toolkit/project-store.js`, and every existing localStorage tool are unchanged; no public nav link points at the new pages yet
- **AI Professional Writer** — reusable AI writing engine powering the Variation Generator
  - `js/toolkit/ai-writer.js` — `AIWriter` class: shared service, mode-based system prompts, direct Anthropic API call with `anthropic-dangerous-direct-browser-access` header, API key management in `bik-ai-key` localStorage, typed error codes (`NO_KEY`, `INVALID_KEY`)
  - Two AI writing modes: "Rewrite Professionally" (clear, formal Australian construction language) and "Strengthen for Contract Protection" (defensible, unambiguous, legally grounded)
  - AI assist buttons injected after `descriptionOfWork`, `reasonForVariation`, and `exclusionsAssumptions` textarea fields
  - First-use API key setup modal with privacy notice, key validation, remove-key option
  - AI disclaimer shown inline after each rewrite: "This content is AI-assisted. Please review and ensure it accurately reflects the work completed before issuing."
  - `AI_WRITING_ENGINE_INTEGRATION_POINT` documented in `ai-writer.js` for Phase 2 backend proxy swap
  - Analytics event: `ai_text_rewritten` with `{ mode, field }` props
  - `✦ AI Writer` button in app header for key management access at any time
  - Architecture designed for reuse: same `AIWriter` + `injectAIAssist()` pattern applies to Quotes, Defect Reports, Site Diaries, Emails, etc.
- **Mobile migration plan** (`docs/mobile-migration-plan.md`) — assessment of current architecture against mobile app requirements; component-by-component reusability analysis; fastest path to Android/iOS with maximum code reuse
- **Integration Layer** (SPEC-002) — provider-based abstraction for third-party accounting and field service platforms; no live API connections yet
  - Core infrastructure: typed error hierarchy, structured logger with ring buffer, HTTP client with retry/timeout, OAuth2 PKCE auth manager, provider registry
  - Interface DTOs: Contact, Invoice (cents arithmetic, GST helpers), Quote, Project, Attachment, BIKDocument — all with `validateXxx()` and AU-specific helpers
  - Provider stubs: Xero (5 capabilities including attachments), MYOB, QuickBooks, Buildxact, ServiceM8, SimPRO, AroFlo — each with `IMPLEMENTATION_POINT` comments showing exact API endpoints and body shapes
  - Service layer: `createCustomer()`, `createInvoice()`, `createQuote()`, `createProject()`, `attachDocument()` — business components import these, never providers directly
  - Config: `initIntegrations()` / `configureProvider()` / `setActiveProvider()` with localStorage persistence (Phase 2: Supabase swap)
  - Architecture documented in `docs/integration-architecture.md` (SPEC-002)

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
