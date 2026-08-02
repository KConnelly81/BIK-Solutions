# Sprint 4 — Shared Supabase-Tool Integration Pattern: Manual Test Steps

**Purpose:** Manual browser verification that Sprint 4's shared integration pattern (`js/toolkit/supabase-project-context.js`, `js/toolkit/supabase-record-panel.js`) works correctly in production, using `variation-generator.html` as the retrofit-and-proof tool. Sprint 4 shipped no new customer-facing capability of its own — this checklist exists because the retrofit introduced (and, across three hotfixes, fixed) a real production defect. Same rationale as `docs/PHASE_3_SPRINT_3_MANUAL_TEST_STEPS.md`.
**Status:** Passed. Run against the live production site (`biksolutions.com.au`, `main` @ `0f55d33`) and confirmed by the user.
**Owner:** BIK Solutions Pty Ltd

---

## Background: the defect this checklist confirms is fixed

Live testing during PR #7 found the "Variations for this project" panel on `variation-generator.html` got stuck on "Loading…" permanently — never reaching a populated, empty, or error state. Three rounds of investigation and hotfix were needed before the live retest passed:

1. **PR #7** — `refreshRecordList()` and `gateOnSupabaseProject()` awaited their Supabase queries with no `try`/`catch`; a rejected promise skipped past the code that would have cleared the loading state. Fixed with `try`/`catch` in both functions.
2. **PR #8** — the fix from #7 didn't resolve the live symptom. Found and fixed two further gaps: (a) `onGated()` called `mount()` (builds the whole form) and `refreshVariationsList()` as unguarded back-to-back statements, so any exception during form mounting — unrelated to Supabase — would abort before the list ever loaded; wrapped in `try`/`catch`. (b) the PR #7 `try`/`catch` only helped if the query *rejected* — it did nothing if the query never settled at all (a hang); added `js/toolkit/with-timeout.js` (15s) to both functions.
3. **PR #9** — the fix from #8 still didn't resolve the live symptom, with no `[BIK]` error and no uncaught exception ever appearing (ruling out both a mount exception and a rejected query as the live cause). Added numbered `[BIK-DIAG]` checkpoint logging across the full path to pinpoint the exact stopping statement, restructured the loading-state cleanup into an explicit `try`/`catch`/`finally`, and made every DOM write in `refreshRecordList()` defensive (`if (el) ...`) instead of assuming the record-panel ids are correct.

The live retest after PR #9 passed. The `[BIK-DIAG]` checkpoint logging has been removed (`hotfix/sprint4-close-out`) now that the fix is confirmed — the underlying `try`/`catch`/`finally` structure, the timeout guard, and the defensive DOM checks all remain.

---

## Checklist

1. Open `app-dashboard.html`, sign in, open a project with **existing** saved variations via its "New Variation Notice" link (or `variation-generator.html?project=<uuid>` directly).
2. Confirm the page reaches a final state within a few seconds: project context bar shows organisation/project name, the form renders, and the **"Variations for this project"** panel shows the existing rows with a running total — **never** stuck on "Loading…".
3. Open the same URL for a project with **zero** saved variations. Confirm the panel shows the empty-state message ("No variations saved to this project yet.") — not stuck loading, not blank.
4. Save a new variation. Confirm the list panel refreshes to include it without a page reload.
5. Reload the page several times in a row (hard refresh). Confirm the list panel reaches a terminal state every time, not just most of the time.
6. Open the browser console throughout. Confirm no `[BIK-DIAG ...]` messages appear (removed), no `[BIK] Variation Notice failed to mount` error appears (no mount failure), and no uncaught exception appears.

---

## Sign-off

Passed — confirmed live by the user against `main` @ `0f55d33` (the diagnostic build), with the `[BIK-DIAG]` cleanup in `hotfix/sprint4-close-out` verified via the automated test suite (51/51 passing) since it changes no observable behaviour, only removes logging. See `docs/changelog.md` and `docs/RELEASE_v0.4.0_SPRINT4.md` for the full record.
