# BIK Field — Release Checklist

Status: **DRAFT**, first pass. Three categories throughout, per the brief:
- **READY** — done in this development pass.
- **NEEDS KAREN** — legal identity, account creation, payment, business
  verification, a brand/product decision, or a credential only Karen can
  provide.
- **BLOCKED** — genuinely impossible to continue without an external
  dependency (none currently — see note at the bottom).

## Architecture & scaffolding

- [x] **READY** — Repo audited; Capacitor chosen over React Native/Flutter
      (reuses the existing vanilla-JS/Supabase stack almost entirely).
- [x] **READY** — Isolated `claude/mobile-app-mvp` branch, isolated
      `mobile/` directory — the production static site (GitHub Pages,
      served from repo root on `main`) is completely untouched.
- [x] **READY** — Capacitor Android + iOS platforms scaffolded
      (`mobile/android/`, `mobile/ios/`).
- [x] **READY** — Shared-code sync mechanism (`mobile/scripts/
      sync-shared.js`) — the mobile app imports the exact same auth/
      session/RPC/pure-logic modules as the production web app, copied
      (not reimplemented) from `../js/`, regenerated before every build.
      Regression-tested (`mobile/test/sync-shared.test.js`).

## The three tools

- [x] **READY** — Sign-in reuses the existing Supabase Auth flow exactly
      (`js/supabase/session.js`, unmodified).
- [x] **READY** — Organisation/project selection (`dashboard.html`,
      `project.html`) reuses the same queries as `app-dashboard.html`.
- [x] **READY** — Attendance screen: today's register + check-in
      (bottom-sheet form) + check-out, mobile-first (not a wrapped
      desktop page).
- [x] **READY** — Variation Notice screen: mobile-first form using the
      exact same validation/RPC/error-translation logic as the desktop
      tool (`variation-save-logic.js`, imported unmodified).
- [x] **READY** — Progress Claim screen: mobile-first form + schedule-of-
      values repeater, same pure logic as desktop
      (`progress-claim-save-logic.js`, imported unmodified).
- [x] **READY** — GPS capture on Attendance check-in/check-out, with
      graceful denied/unavailable states — check-in/out never blocks on
      location.
- [x] **READY** — Camera/photo attachment on Variation Notice, with
      graceful denied-permission state.

## Backend changes (draft, NOT applied)

- [x] **READY** (as a draft) — `supabase/migrations/
      024_mobile_attendance_gps_DRAFT.sql` — adds nullable GPS columns +
      new (additive, non-breaking) RPC overloads for check-in/check-out.
      Existing web app callers are completely unaffected whether or not
      this is applied.
- [x] **READY** (as a draft) — `supabase/migrations/
      025_mobile_variation_photo_DRAFT.sql` — adds nullable photo columns
      + a new private Storage bucket + RLS policies. No existing RPC
      signature changes at all.
- [ ] **NEEDS KAREN** — Review and apply both migrations. Recommendation:
      create a staging Supabase project first (this repo currently has
      only one project, which is production) — see TEST_PLAN.md's
      "Required before merging the draft migrations" section. This is a
      genuine judgement call between "test properly first" and "move
      fast" — flagging it rather than deciding it unilaterally, per your
      instruction to flag before touching production security/data
      behaviour.
- [ ] **NEEDS KAREN** — After the migrations are confirmed working in
      production, schedule a follow-up migration dropping the old
      (pre-GPS) RPC overloads, per each draft migration's own header note
      — not urgent, but shouldn't be forgotten indefinitely either.

## Native configuration

- [x] **READY** — Android permissions declared: `ACCESS_FINE_LOCATION`,
      `ACCESS_COARSE_LOCATION`, `CAMERA`, each with a comment explaining
      why (`AndroidManifest.xml`).
- [x] **READY** — iOS usage-description strings for location and camera/
      photo library (`Info.plist`), written in plain language explaining
      the specific feature, not generic boilerplate.
- [x] **READY** — Foreground-only location — no background permission
      requested on either platform.
- [x] **READY** — App version 1.0.0 / build 1, consistent across Android
      (`versionCode`/`versionName`) and iOS (`CURRENT_PROJECT_VERSION`/
      `MARKETING_VERSION`).
- [x] **READY** — Production/staging config handling: `capacitor.config.ts`
      loads a dev-server override only via an explicit env var
      (`BIK_MOBILE_DEV_SERVER`), never accidentally shipped in a release
      build; the app otherwise always talks to the same production
      Supabase project the web app uses (there being no staging Supabase
      project — see above).
- [ ] **NEEDS KAREN** — **App identifier is a placeholder**:
      `au.com.biksolutions.field`. This becomes permanent the moment
      either store listing is created — confirm or change it before the
      first submission, not after.
- [ ] **NEEDS KAREN** — App icon (1024×1024 source) and splash screen
      design — see APP_STORE_COPY.md's asset requirements section.
      Currently using a placeholder solid-colour splash
      (`--bik-master` ink, `#262220`) and no custom icon at all (still
      Capacitor's default icon).

## CI / build pipeline

- [x] **READY** — `codemagic.yaml` at the **repository root** (required by
      Codemagic even though the app itself lives in `mobile/` — each
      workflow sets `working_directory: mobile` so scripts run from
      there): unsigned Android debug build, unsigned iOS simulator build,
      both triggered on push to `claude/mobile-*` branches — runs before
      any Apple/Google credentials exist, exactly as asked.
- [x] **READY** — Signed release workflow present but commented out/
      inactive, with the exact list of Codemagic environment-variable
      groups it will need, so adding real credentials later is a
      config-only change, not a pipeline rewrite.
- [ ] **NEEDS KAREN** — A Codemagic account/team to actually run the
      pipeline (free tier likely sufficient for unsigned builds).
- [ ] **NEEDS KAREN** — Apple Developer Program enrollment ($99/yr).
- [ ] **NEEDS KAREN** — Google Play Console account ($25 one-off).
- [ ] **NEEDS KAREN** — iOS distribution certificate + provisioning
      profile (or Codemagic's automatic signing, once the Apple account
      exists).
- [ ] **NEEDS KAREN** — Android release keystore (generate once, store
      securely — losing it means losing the ability to update the app
      under the same listing, ever).
- [ ] **NEEDS KAREN** — App Store Connect API key + Google Play service
      account, if using Codemagic's automated publishing rather than
      manual upload.

## Documentation

- [x] **READY** — `mobile-release/STORE_SUBMISSION.md`,
      `PRIVACY_DATA_INVENTORY.md`, `TEST_PLAN.md`,
      `APP_STORE_COPY.md`, this file.

## Testing

- [x] **READY** — Full local smoke test (no live backend) — see
      TEST_PLAN.md. Found and fixed two real bugs (dead offline-banner
      element; banner not actually visible on-screen).
- [x] **READY** — Existing 107-test repo suite re-run, confirmed
      unaffected by these changes.
- [x] **READY** — 12 new unit tests (session-expiry detection, shared-file
      sync integrity).
- [ ] **NEEDS KAREN** (indirectly) — Everything in TEST_PLAN.md's manual
      test steps requires a real build + real backend + a real device/
      simulator — none available in this session.

## Known gaps / deliberate scope cuts (lean MVP)

Called out explicitly rather than silently — these are reasonable v1 cuts,
not oversights, but worth a conscious yes/no rather than discovering them
later:

- The web dashboard does not yet render an attached Variation Notice
  photo anywhere (`photo_path` is stored, but no existing desktop page
  displays it). A mobile-created photo is safely stored and not lost, but
  currently only retrievable by querying the database directly, not by
  looking at the project in a browser. Worth a small follow-up on the web
  side once photos are actually in use.
- No org-creation / "set up your organisation" flow in the app — a user
  whose organisation isn't set up yet is told to finish that on the web.
  Reasonable for v1 (org setup is a one-time event, not a field task).
- Progress Claim's mobile form omits several desktop fields (claim
  dates, retention rate, special conditions) — only client name/email and
  the schedule of values are collected. All are still editable later from
  the desktop tool; nothing is lost, just not entered from mobile in v1.
- No self-service "which of my check-ins is mine" on Attendance — checkout
  is a per-row action on the shared register (same as the existing
  desktop supervisor dashboard), not an automatic "check myself out"
  button, because the underlying schema has no per-user link on a
  check-in record (see `attendance_records.checked_in_by`, a fixed
  `'self'`/`'builder'` enum, not a user id). Documented as a real
  architectural constraint, not a bug.
- No push notifications, per your explicit instruction to keep this
  release lean.
- Photo deletion (Storage cleanup) is not wired to variation notice
  deletion/archival in this pass — an orphaned Storage object is a minor
  storage-cost issue, not a security or correctness one.

## Is anything actually BLOCKED?

**No.** Every open item above is a NEEDS KAREN item (an account, a
credential, a design asset, or a decision only you can make) — nothing
here is blocked in the sense of "cannot proceed at all." Everything
achievable without those inputs — architecture, the three tools, native
config, CI, docs, and local testing — is done.
