# BIK Field — Privacy & Data Inventory

Status: **DRAFT** — prepared to speed up Apple App Privacy and Google Play Data
Safety declarations, and to give whoever writes/approves the privacy policy a
complete, accurate list to work from. Not a substitute for legal review.

## 1. What data BIK Field collects, and why

| Data | Collected when | Purpose | Shared with | Linked to identity? |
|---|---|---|---|---|
| Email + password | Sign in | Authenticate against the existing BIK Solutions account (Supabase Auth) | Supabase (processor) | Yes |
| Full name, organisation | After sign-in (profile lookup) | Show which organisation/user is signed in | Supabase | Yes |
| Project data (name, address, client) | Browsing projects | Core app function — nothing new vs. the existing web app | Supabase | Yes (via organisation) |
| Attendance record (name, company, trade, time in/out) | Check-in / check-out | Core Attendance function | Supabase, visible to the worker's own organisation | Yes |
| **GPS location (one-off)** | The moment of check-in and the moment of check-out | Attach a location to that attendance record as a record of where it was made | Supabase, visible to the worker's own organisation | Yes (tied to the attendance record) |
| **Photo (site condition)** | Attaching a photo to a Variation Notice | Document the scope change being recorded | Supabase Storage, visible to the project's organisation | Indirectly, via the variation notice |
| Variation Notice / Progress Claim content | Filling in either tool | Core app function — nothing new vs. the existing web app | Supabase | Yes |

## 2. Location data — the specific declaration this needs

- **Type:** Precise location (GPS), foreground only.
- **Frequency:** Once per check-in, once per check-out. Never continuous,
  never in the background, never while the app is closed.
- **Permission requested:** `NSLocationWhenInUseUsageDescription` (iOS),
  `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` (Android). Deliberately
  **no** `NSLocationAlwaysUsageDescription` and **no**
  `ACCESS_BACKGROUND_LOCATION` — the app cannot and does not track location
  outside the moment of the tap.
- **What happens if denied:** Check-in/check-out still completes — see
  `checkin_latitude`/`checkin_longitude`/`checkout_latitude`/
  `checkout_longitude` in `supabase/migrations/024_mobile_attendance_gps_
  DRAFT.sql`, all nullable. Denying location is never a hard stop.
- **Retention:** Stored indefinitely alongside the attendance record it
  belongs to (same retention as the record itself — no separate location
  retention policy exists or is proposed here).
- **Apple App Privacy category:** Location > Precise Location, linked to
  the user, used for "App Functionality" — not used for tracking,
  advertising, or analytics.
- **Google Play Data Safety category:** Location > Approximate/Precise
  location, collected, shared with the organisation (not with a third
  party outside the company), required for the Attendance feature, user
  cannot request deletion of an individual location value separately from
  the record it's on.

## 3. Camera / photo data — the specific declaration this needs

- **Type:** Photos, one at a time, user-initiated (never automatic).
- **Permission requested:** `NSCameraUsageDescription` +
  `NSPhotoLibraryUsageDescription` (iOS), `CAMERA` (Android).
- **Storage:** Uploaded to a private Supabase Storage bucket
  (`variation-notice-photos`, see `supabase/migrations/
  025_mobile_variation_photo_DRAFT.sql`), not the device's public camera
  roll (the app does not save a copy back to the device).
- **Access:** Restricted to members of the same organisation via Storage
  RLS policies — same tenant boundary as every other table in this
  database.
- **Apple App Privacy category:** Photos, linked to the user, "App
  Functionality" only.
- **Google Play Data Safety category:** Photos and videos, collected,
  shared with the organisation, required for the Variation Notice photo
  feature (optional per-record — the field itself is optional).

## 4. What BIK Field does NOT do

- No advertising, no ad SDKs, no analytics/tracking SDKs of any kind in
  this release.
- No background location tracking.
- No data sold to third parties.
- No push notifications in this release (see product decision in
  `RELEASE_CHECKLIST.md`) — nothing to declare there.
- No use of Apple's or Google's advertising identifiers.

## 5. Data deletion

Account and data deletion follows whatever process already exists for the
web app (organisation/account deletion via Supabase) — this release does
not introduce a separate mobile-only deletion path or a separate copy of
any data that would need separate deletion, with the specific exception of
uploaded photos in Storage (deleting the variation notice does not
automatically delete its Storage object in this first pass — see
RELEASE_CHECKLIST.md's "known gaps" list).

## 6. Open items — NEEDS KAREN

- [ ] Confirm the *existing* BIK Solutions privacy policy already covers
      GPS location and photo collection, or update it to. Both stores
      require the privacy policy URL to actually describe what the app
      collects — a generic policy that predates this app likely doesn't
      mention location or camera use yet.
- [ ] Decide the actual data retention/deletion policy for attendance GPS
      coordinates and variation photos (this document describes current
      behaviour, not a policy decision — that's a business/legal call).
- [ ] Confirm who is the "data controller" for Apple/Google's forms
      (BIK Solutions Pty Ltd, presumably) and provide that entity's
      details for both console forms.
