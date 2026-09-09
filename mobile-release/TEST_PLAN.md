# BIK Field — Test Plan

Status: **DRAFT**. Covers what has been tested from this development
session (no store/device access), and what a live device/TestFlight/
Internal Testing pass still needs to cover.

## What's been tested already (this session, no live Supabase access)

This sandbox cannot reach `biksolutions.com.au`, `*.supabase.co`, or
Apple/Google's build tooling (confirmed via the sandbox's own outbound
proxy logs — a hard environment limit, not a choice). Everything below was
verified against a local static server serving `mobile/www/` directly,
using a headless browser (no native shell, no Capacitor plugins — the
web-fallback code paths in `app-shell.js`).

| Check | Result |
|---|---|
| All 6 screens load with zero JS errors | ✅ Pass |
| Every protected screen (dashboard/project/attendance/variation-notice/progress-claim) redirects to sign-in with no session, preserving `?redirect=` | ✅ Pass |
| `index.html` correctly routes to sign-in when signed out | ✅ Pass |
| Offline banner appears when the network goes offline | ❌ Found broken (dead, unwired duplicate banner element in `signin.html`) → ✅ Fixed |
| Offline banner is actually visible, not off-screen | ❌ Found broken (not fixed-positioned, rendered below the fold) → ✅ Fixed |
| Offline banner clears when back online | ✅ Pass (after the above fixes) |
| Existing repo test suite (107 tests across calculator, project-gate, variation-notice, progress-claim, quote-builder pure logic) | ✅ All 107 pass, unaffected by mobile changes |
| New `isSessionExpiredError()` unit tests (10 cases) | ✅ All pass |
| `sync-shared.js` copies every file every screen actually imports | ✅ Pass (regression-tested — this exact class of bug was caught once already: the Supabase vendor SDK was initially missing from the sync list, found and fixed before this test existed) |
| Android platform added, `applicationId`/version set | ✅ (`cap add android` succeeded) |
| iOS platform added, bundle ID/version set | ✅ (`cap add ios` succeeded — pod install/xcodebuild steps were skipped, as expected: no macOS in this sandbox, handled by Codemagic instead) |

## What could NOT be tested from this session

- **Real sign-in** — no live Supabase reachability here. The sign-in
  form's happy path (successful auth → redirect to dashboard) has not
  been exercised against a real account.
- **Dashboard project list, on-site counts** — needs a live session +
  real project data.
- **Attendance check-in/check-out end to end** — additionally blocked on
  `024_mobile_attendance_gps_DRAFT.sql` not being applied yet (see
  RELEASE_CHECKLIST.md). Until it's applied, the GPS-capturing RPC calls
  from `attendance.html` will fail against the live database (the new
  9/5/4-arg overloads don't exist there yet).
- **Variation Notice photo upload end to end** — blocked on
  `025_mobile_variation_photo_DRAFT.sql` not being applied yet (no
  Storage bucket exists yet).
- **Progress Claim schedule-of-values save** — needs a live session;
  logic itself reuses the same tested pure functions as the desktop tool,
  but the mobile-specific insert/update sequencing has not been run
  against a real database.
- **Actual native GPS/camera permission prompts and behaviour** — only
  testable on a real device or simulator, neither available here.
- **Native build success** — Android's `assembleDebug` and iOS's
  simulator build have not actually been run in this session (no Android
  SDK / no Xcode here); Codemagic's `android-unsigned` and
  `ios-unsigned-simulator` workflows (see `codemagic.yaml`) are the first
  place these will actually compile.

## Required before merging the draft migrations (024, 025)

**Recommendation: do not apply either DRAFT migration directly to
production without testing it somewhere first.** This repository
currently has exactly one Supabase project (production) — there is no
staging project. Two options, in order of preference:

1. **Create a staging Supabase project** (a NEEDS KAREN item — cost/plan
   decision) and apply both migrations there first, then run the manual
   test steps below against it.
2. If a staging project is not created, apply directly to production but
   only after a human has read both migration files closely (they're
   deliberately verbose about exactly what they change) and accepts that
   risk — both are additive/non-breaking by design (see each file's own
   header), but "additive by design" and "verified" are not the same
   thing until actually run once.

## Manual test steps (run once a build + backend are both ready)

### Sign-in / session
1. Sign in with a valid BIK Solutions account. → Lands on dashboard.
2. Force-quit and reopen the app. → Still signed in (session persisted).
3. Manually expire the session (or wait out token expiry) and perform any
   action. → Redirected to sign-in, not a stuck error screen.
4. Enter wrong password. → Friendly inline error, not a raw Supabase error.
5. Go offline, attempt sign-in. → Offline banner visible; inline error
   explains it's a connection issue.

### Dashboard / project selection
6. Sign in to an organisation with 0 projects. → "No projects yet" state,
   not a blank screen or crash.
7. Sign in to an organisation with 1+ projects. → Project cards render,
   including "on site now" count where applicable.
8. Tap a project. → Lands on that project's tool tiles (project.html).

### Attendance
9. Tap "Check in", grant location permission. → GPS chip shows "Location
   captured" before submitting.
10. Deny location permission (device Settings → deny, or dismiss the
    prompt). → Chip shows "Location permission denied — check-in will
    save without a location"; check-in still succeeds.
11. Submit check-in with a valid name. → New row appears in today's
    register immediately.
12. Submit check-in with a 1-character name. → Inline validation error,
    no network call made.
13. Tap "Check out" on an open record. → Row moves to "Done" state with a
    checkout time.
14. Go offline mid-check-in. → Offline banner visible; submission fails
    with a friendly error, not a silent hang.
15. **Verify in the web dashboard** (attendance.html) that a mobile
    check-in/check-out appears identically, including the new location
    columns being populated when granted.

### Variation Notice
16. Fill in required fields only (no photo), save. → Variation number
    returned and shown; appears in "Recent variations" list.
17. Attempt to save with a blank required field. → Inline validation
    error naming the exact field, matching the desktop tool's wording.
18. Attach a photo via camera, save. → Success banner; **verify in the
    web dashboard** that the photo is visible against that variation
    (requires web-side UI to actually render `photo_path` — not built in
    this pass, see "Known gaps" in RELEASE_CHECKLIST.md).
19. Attach a photo via "choose from library" path, save. → Same as above.
20. Deny camera permission, tap "Add photo". → Friendly error, does not
    crash the form; the rest of the form is still usable and saveable
    without a photo.

### Progress Claim
21. Create a claim with client name only, no schedule items. → Saves
    successfully with a claim number.
22. Add 2+ schedule items with description/value/percent, save. →
    Appears correctly in the web dashboard's progress claim view with
    matching line items.
23. Remove an added item before saving. → Removed item is not submitted.
24. Attempt to save with client name blank. → Inline validation error.

### Cross-cutting
25. Rotate the device (where applicable) mid-form. → No data loss (not
    explicitly engineered for in this pass — confirm behaviour, note as a
    gap if state is lost).
26. Background the app mid check-in GPS lookup, then foreground it. →
    Either completes normally or fails gracefully — should not hang
    indefinitely.
27. Test on the smallest supported screen size and the largest, both
    platforms, to confirm the mobile-first layout (bottom tab bar, sheet,
    forms) doesn't clip or overflow.
