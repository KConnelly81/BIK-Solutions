# BIK Field — App Store / Google Play Listing Copy (DRAFT)

Status: **DRAFT** — ready to refine and paste into App Store Connect / Play
Console once accounts exist. Word/character limits noted per field.

## App name

**BIK Field** (13 characters — well under both stores' limits)

Rationale: short, matches the app's own `appName` in `capacitor.config.ts`
and `CFBundleDisplayName`, and doesn't overclaim ("Field" signals this is
the on-site companion to the full BIK Solutions platform, not the whole
product). Confirm this name doesn't collide with an existing store listing
before submission — not checked from this session (no store account
access).

## Apple App Store

**Subtitle** (30 characters max):
> Attendance, variations, claims

**Promotional text** (170 characters max, editable without a new review):
> The on-site companion to BIK Solutions. Check in and out with GPS, raise
> variation notices with a photo, and submit progress claims — from your
> phone, on the job.

**Description** (4000 characters max):
> BIK Field is the mobile companion to your BIK Solutions account — the
> three things you actually need on site, not the whole back-office
> platform.
>
> ATTENDANCE
> Check in and out of a project in seconds. Your location is captured at
> the moment you tap, so there's a record of where each check-in and
> check-out happened. See who else is on site right now.
>
> VARIATION NOTICES
> Document a scope change while you're standing in front of it. Attach a
> photo of the site condition, and it saves straight to the project —
> visible to your whole team on the web dashboard immediately.
>
> PROGRESS CLAIMS
> Start or add to a progress claim from site, with a schedule of values
> you can build item by item.
>
> Requires an existing BIK Solutions account. Sign up at
> biksolutions.com.au first, then sign in here.

**Keywords** (100 characters, comma-separated, not shown to users):
> attendance,site,construction,variation,progress claim,builder,trade,timesheet,jobsite

**What's New (v1.0.0)**:
> First release of BIK Field: Attendance with GPS check-in/out, Variation
> Notices with photo attachment, and Progress Claims — all synced with
> your existing BIK Solutions organisation and projects.

## Google Play

**Short description** (80 characters max):
> Site attendance, variation notices and progress claims for BIK Solutions.

**Full description** (4000 characters max) — same content as the Apple
description above; Play does not require different wording, but re-check
Play's current formatting rules (no HTML, plain line breaks) before pasting.

**App category:** Business (primary). Consider Productivity as a secondary
signal if Play's console offers one — not confirmed which reads better for
this audience without competitor research, which wasn't in scope here.

## Screenshot requirements (both stores)

Neither store accepts a wrapped-desktop screenshot — every screenshot must
be an actual on-device (or simulator) capture of the mobile UI at the
required device sizes. Minimum needed, in priority order:

1. **Sign-in screen** — establishes this is a real, branded app.
2. **Dashboard / project list** — shows the org → project selection step.
3. **Attendance screen** — today's register + the check-in flow, ideally
   showing the GPS-captured chip so the location feature is visible, not
   just described.
4. **Variation Notice form** — with the photo-attachment step visible.
5. **Progress Claim form** — schedule-of-values items visible.

Required sizes:
- **Apple**: 6.7" (1290×2796) and 6.5" (1284×2778 or 1242×2688) iPhone
  screenshots are mandatory; iPad screenshots only if the app supports
  iPad (this app is a phone-first Capacitor build — confirm whether to
  submit as iPhone-only or universal before generating iPad shots).
- **Google Play**: minimum 2 screenshots, 16:9 or 9:16, at least 320px on
  the short side, up to 3840px on the long side. Phone screenshots
  mandatory; tablet optional.

None of these exist yet — they can only be captured from a running build
on a simulator/device or from Codemagic's build artifacts, not from this
session. See RELEASE_CHECKLIST.md.

## App icon & splash screen requirements

Not yet supplied — needed from Karen (or a designer) before either store
submission:

- **Source icon**: a single 1024×1024px PNG, no transparency, no rounded
  corners (both stores apply their own mask) — Capacitor's asset
  generator (`@capacitor/assets`) derives every required Android/iOS size
  from this one file.
- **Splash screen**: a 2732×2732px PNG (safe content within the centre
  ~1200px, since it gets cropped differently per device) — or confirm
  using a simple centred logo-on-background-colour design (the current
  `capacitor.config.ts` splash background is set to `#262220`, the BIK
  master-brand ink colour, as a placeholder).
- Suggested direction: reuse the neutral master-brand mark from the
  website redesign (the "B" logotype on `--bik-master` ink, decoupled from
  either business accent) — consistent with the parent-brand identity
  already established for biksolutions.com.au.

## Naming note

Per the earlier product decision to keep "Property Services" / "Business
Toolkit" as the safe functional labels (not "BIK Platform" / "BIK Trade
Services"), this app's copy above avoids naming either business line
directly — it describes the three tools functionally, which also happens
to read fine regardless of which of the two sides of the business a given
user is on.
