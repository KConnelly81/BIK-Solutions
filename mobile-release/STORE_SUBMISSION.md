# BIK Field — Store Submission Guide (DRAFT)

Status: **DRAFT**. Written so submission can happen quickly once accounts
and credentials exist — see RELEASE_CHECKLIST.md for what's still needed
from Karen. This file assumes you have both consoles open and a signed
build in hand.

## App identity (placeholder — confirm before first submission)

| Field | Value | Status |
|---|---|---|
| App name shown to users | BIK Field | Draft, see APP_STORE_COPY.md |
| iOS Bundle ID | `au.com.biksolutions.field` | **PLACEHOLDER** |
| Android Application ID | `au.com.biksolutions.field` | **PLACEHOLDER** |
| Version (marketing) | 1.0.0 | Set |
| Build number (iOS) / versionCode (Android) | 1 | Set — bump by 1 every submission, including rejected ones |

Changing the bundle ID/application ID after either store listing exists
means creating a brand new listing — there is no rename path on either
store. Confirm this identifier with Karen before the FIRST submission,
not after.

## Apple App Store Connect — steps

1. Apple Developer Program enrollment must be active (individual or
   BIK Solutions Pty Ltd as an organisation — org enrollment needs a
   D-U-N-S number and takes longer to verify; start this early).
2. In App Store Connect, create a new app:
   - Bundle ID: register `au.com.biksolutions.field` (or the confirmed
     final value) in the Developer Portal first, then select it here.
   - SKU: any internal identifier, e.g. `bik-field-001`.
3. Fill in the listing from APP_STORE_COPY.md (name, subtitle,
   description, keywords, promotional text).
4. Upload screenshots per APP_STORE_COPY.md's size requirements.
5. Complete **App Privacy** using PRIVACY_DATA_INVENTORY.md's tables
   directly — Location (precise, linked, app functionality) and Photos
   (linked, app functionality) are the two declarations that matter here.
6. Add the **App Review Notes** from this file's "Reviewer notes" section
   below, plus the **demo account** credentials.
7. Build and upload the signed `.ipa` (via the `release-signed` Codemagic
   workflow once credentials exist — see codemagic.yaml) using Xcode
   Transporter or `xcrun altool`/Codemagic's own App Store Connect
   publishing step.
8. Submit for review.

## Google Play Console — steps

1. Google Play Console account active. Note: **new personal developer
   accounts** are currently required to run a 14-day closed test with at
   least 12 testers before a production release is allowed — factor this
   into the timeline if the account is new. A verified organisation
   account may have different requirements; confirm current policy at
   submission time, as Google's requirements here change periodically.
2. Create the app, select "App" (not game), "Business" category.
3. Complete the **Data Safety** section using
   PRIVACY_DATA_INVENTORY.md directly.
4. Complete the **Content rating** questionnaire — this is a business
   productivity tool with no user-generated public content, ads, or
   objectionable material; expect the lowest rating tier, but the
   questionnaire itself must still be completed truthfully.
5. Upload the signed `.aab` (Android App Bundle, not a raw `.apk` — Play
   requires `.aab` for new apps) from the `release-signed` Codemagic
   workflow.
6. Set up a release track: start with **Internal testing**, promote to
   **Closed testing** (satisfies the 14-day requirement above if it
   applies), then **Production**.
7. Add screenshots, short/full description from APP_STORE_COPY.md.

## Reviewer notes (both stores)

> BIK Field is a companion app to biksolutions.com.au, an existing
> Australian construction/trades business-management platform. This app
> requires an existing BIK Solutions account — please use the demo
> account below rather than attempting to sign up (there is no in-app
> sign-up flow by design; new accounts are created on the web).
>
> Location permission is used only at the moment the user taps "Check in"
> or "Check out" on the Attendance screen, to record where that action
> took place — never in the background, never continuously.
>
> Camera/Photo Library permission is used only when the user chooses to
> attach a photo to a Variation Notice.

## Reviewer test account

**NEEDS KAREN** — a dedicated demo/reviewer account, in an organisation
with at least one project, so a reviewer can exercise all three tools
without touching real customer/business data. Do not hand reviewers a
real production account or real project. Suggested: a throwaway
organisation named something like "App Review Demo" with one dummy
project, created specifically for this purpose, kept separate from any
real BIK Solutions customer's data.

- Email: _(needs Karen)_
- Password: _(needs Karen — rotate after each review cycle, and never
  paste a live rotation into this file if it's ever made public; keep the
  actual credential in the store console's private reviewer-notes field
  or a password manager, not committed to the repository)_

## Common rejection reasons to pre-empt

- **Apple 4.2 "Minimum Functionality"** (i.e. "this is just a website
  wrapper") — this app is Capacitor-based but does real native work
  (GPS capture, camera), which should satisfy this, but be ready to
  explain that in reviewer notes if queried.
- **Apple 5.1.1 (Data Collection and Storage)** — location and photo
  usage-description strings must clearly explain why (already written
  into Info.plist — see PRIVACY_DATA_INVENTORY.md — but double-check they
  still read naturally rather than boilerplate before submitting).
- **Google Play policy on location permission** — Play requires a
  prominent in-app disclosure before requesting location, beyond just the
  OS permission dialog, for apps requesting `ACCESS_FINE_LOCATION`. The
  current check-in sheet shows a location status chip but does not yet
  show an explicit pre-permission explainer screen — recommended addition
  before submission, tracked in RELEASE_CHECKLIST.md's known gaps.
