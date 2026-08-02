# Release v0.4.0-sprint4 — Shared Supabase-Tool Integration Pattern

**Release date:** 2026-08-02
**Feature merge commit SHA:** `2c2f6b8823ee9497dc92ed6d147f77a2194135bf` (PR #7)
**Hotfix chain:** PR #8 (`07ee86cffa27b2abcc2fdff5b3b5abe9ad089999`), PR #9 (`0f55d33d76f50350ef2a101f011ece7ccdce0624`), Sprint 4 close-out (this PR)
**Tag:** `v0.4.0-sprint4` (annotated, cut at `main` HEAD immediately after the close-out PR merges)
**Live project:** `hpcqncghvdrlvufxfdnd`
**Owner:** BIK Solutions Pty Ltd

---

## Features delivered

- **Shared Supabase-tool integration pattern**, extracted from Sprint 3's one-off `variation-generator.html` wiring so Sprint 5's tool migrations (Quotes, Progress Claims) are cheap instead of each repeating that work: `js/toolkit/supabase-project-context.js` (session/project gating, one-time snapshot, no-flash reveal) and `js/toolkit/supabase-record-panel.js` (generic "Save to project" dispatch and "records for this project" list wiring). No new tables, no new customer-facing capability of its own — pure infrastructure, validated by retrofitting Variation Notice onto it with (eventually, after three hotfix rounds) no behavioural change.
- `ToolController`'s project-context handling generalised to a positive `projectMode: 'supabase'` switch, `dollarsToCents()`/`centsToDollars()` moved to the shared `js/toolkit/calculator.js`, and CSS/id conventions unified to the `sb-*` prefix so Sprint 5's tools reuse the same file and classes.
- `js/toolkit/with-timeout.js` (new) — races a promise against a timeout so a Supabase query that never settles (not just one that rejects) still lets its caller continue, instead of hanging indefinitely. Wired into both `refreshRecordList()` and `gateOnSupabaseProject()` (15s each).

## Database changes

None. This release is frontend-only.

## Security changes

No new backend surface — this release only changes how existing, already-granted operations are called from the frontend, not what `authenticated` can do against Postgres.

## The production defect and how it was resolved

Live testing during PR #7 found the "Variations for this project" panel on `variation-generator.html` got stuck on "Loading…" permanently. Full account in `docs/PHASE_4_SPRINT_4_MANUAL_TEST_STEPS.md` and `docs/changelog.md`; summary:

1. **PR #7** — no `try`/`catch` around the Supabase query in `refreshRecordList()`/`gateOnSupabaseProject()`; a rejected promise skipped the loading-state cleanup. Fixed.
2. **PR #8** — live retest still failed. Found `onGated()` called `mount()` and `refreshVariationsList()` with no exception isolation between them (any form-mount exception would block the list load), and that PR #7's `try`/`catch` didn't cover a query that hangs rather than rejects. Fixed both; added `with-timeout.js`.
3. **PR #9** — live retest still failed, with no error of any kind appearing — ruling out both prior theories as the live cause. Added numbered `[BIK-DIAG]` checkpoint logging to pinpoint the exact stopping statement, restructured loading-state cleanup into an explicit `try`/`catch`/`finally`, made every DOM write defensive.
4. **Live retest passed** after PR #9. Root cause was resolved by the combination of the PR #8/#9 fixes and the cache-busting `?v=` token added in PR #8 (ruling out stale-cache as a standalone explanation was never conclusively isolated from the code fixes, since both landed together before the passing retest — recorded honestly rather than claiming a single isolated cause).
5. **This release (close-out)** — removed the `[BIK-DIAG]` checkpoint logging now that the fix is confirmed; the underlying `try`/`catch`/`finally` structure, defensive DOM checks, and timeout guard all remain in production.

## Verification summary

- **Automated tests:** 51/51 passing (`node --test "js/**/*.test.js"`) — 32 from Sprint 3, 6 relocated calculator tests, 14 covering the extracted `determineListOutcome()`/`determineGateOutcome()` pure logic, 5 covering `withTimeout()`.
- **Manual browser test:** `docs/PHASE_4_SPRINT_4_MANUAL_TEST_STEPS.md` — passed against live production (`main` @ `0f55d33`, the diagnostic build) and reconfirmed conceptually unaffected by the close-out's log-only removal.
- **Deployment:** GitHub Pages deploys from `main` on every push (classic branch-deploy, no Actions workflow); confirmed serving fresh content via a direct fetch of the deployed `supabase-integration.js` after each hotfix merge.

## Known limitations

- This sandbox has no live browser access and outbound fetches to `biksolutions.com.au` return HTTP 403 — every live verification in this release was performed by the user directly, not independently confirmed by this session. The `[BIK-DIAG]` checkpoint logging exists specifically because of this constraint.
- The root cause was not isolated to a single fix in complete isolation — PR #8 and PR #9's changes (and the cache-busting token) landed together before the passing retest, so it is not proven which specific change(s) were necessary versus redundant. All are low-risk, defensible hardening regardless (timeout safety, exception isolation, defensive DOM checks), so none were reverted to isolate the cause after the fact.
- `assets/fonts/Inter-SemiBold.woff2` returns a 404 in production (noted during live console investigation) — cosmetic, unrelated to this release's defect, not fixed here.

## Deferred to Sprint 5a

- Quotes and Progress Claims migrations (012–017) and frontend — designed and locally tested, not yet applied to Supabase.
- Project Hub — built, not yet merged; tracked separately as its own isolated release once this release's shared modules are confirmed live on `main`.
