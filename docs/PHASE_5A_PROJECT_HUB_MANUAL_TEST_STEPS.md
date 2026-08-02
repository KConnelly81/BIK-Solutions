# Sprint 5a — Project Hub: Manual Test Steps

**Purpose:** Manual browser verification for `project-hub.html`'s integration with the live
Supabase project (`hpcqncghvdrlvufxfdnd`) — the parts an automated unit test cannot cover (a
real browser, a real session, real network calls, real viewport). Same rationale as
`docs/PHASE_3_SPRINT_3_MANUAL_TEST_STEPS.md`.
**Status:** Not yet run. The prior blocker — PR #7 (Sprint 4 shared modules) needing to merge
first — is resolved: PR #7 merged, three further hotfix rounds (PR #8, #9, #10) fixed an
unrelated production defect found during its own testing (see
`docs/RELEASE_v0.4.0_SPRINT4.md`), and `sprint-5a-quotes-progress-claims-hub` has been merged
with the updated `main` and re-verified compatible. This branch (`feature/project-hub`) is cut
from that updated `main`. The Hub PR has been opened as a **draft** — this checklist still needs
to be run live and passed before it merges. See `docs/PHASE_5A_PROJECT_HUB_PR_NOTES.md` for the
full chain of events.
**Scope:** `project-hub.html` and its one new entry point on `app-dashboard.html`. Quotes and
Progress Claims are not in scope — their tool-launch actions are expected to show as disabled
"Coming soon", not to be tested as working links.
**Owner:** BIK Solutions Pty Ltd

---

## Setup

- Two disposable browser profiles/incognito windows recommended: **Org A** (primary test
  account) and **Org B** (a second, unrelated organisation, for the cross-organisation check).
- Org A needs at least: one project with **zero** variation notices saved to it (for the empty
  state), and one project with **two or more** variation notices already saved to it (from
  Sprint 3 testing, or create fresh ones first).
- A mobile viewport or device for the mobile-layout section (browser devtools responsive mode,
  ~375px width, is sufficient).

---

## 1. Authenticated access

1. Signed out, open `project-hub.html?project=<a-real-Org-A-project-id>` directly. Confirm
   redirect to `signin.html` — the hub itself, including the project name, must never flash on
   screen first.
2. Sign in as Org A. Confirm you land back on a working page (either redirected to the hub, or
   you can navigate there again) — no stuck loading state, no console error.

## 2. Invalid or missing project ID

3. Open `project-hub.html` with **no** `?project=` param at all. Confirm a clear "This project
   could not be found" message (not a blank page, not a stuck spinner), with a working "Back to
   dashboard" link.
4. Open `project-hub.html?project=` (empty value). Confirm the same clear error state.
5. Open `project-hub.html?project=not-a-real-uuid` (malformed value). Confirm the same clear
   error state — no raw Postgres/Supabase error text or stack trace visible anywhere on the page
   or logged in a way a normal user would see.
6. While signed in as Org A, take a real Org A project id and change one character (a
   well-formed but non-existent UUID). Confirm the same "could not be found" message, not a
   crash or infinite spinner.

## 3. Cross-organisation project access

7. As **Org B**, take a real project id belonging to **Org A** (from setup) and open
   `project-hub.html?project=<org-A-project-id>` while signed in as Org B.
8. Confirm the "could not be found" message appears — Org B must not see Org A's project name,
   site address, status, variation notices, or any other detail. Check the Network tab: the
   Supabase response for the project fetch should come back empty/filtered, not a 403 with the
   real data attached.

## 4. Project header details

9. Open the hub for an Org A project that has a site address and a non-default status (e.g.
   `on-hold`). Confirm:
   - The project name is shown prominently and matches `app-dashboard.html`'s project card
     exactly.
   - The site address is shown (or the row is simply absent if the project has none — not a
     literal "null" or "undefined" string).
   - The status pill shows the correct label and colour for that status (`draft`/`active`/
     `on-hold`/`completed`/`archived` — check at least two different statuses across two
     projects if available).
   - The context bar at the very top shows the correct organisation name and project name.

## 5. New Variation Notice launch

10. Click **New Variation Notice** in the tool launch row. Confirm it navigates to
    `variation-generator.html?project=<the-same-project-id>` and that tool loads normally
    (context bar shows the same org/project).
11. Confirm **New Quote** and **New Progress Claim** are visibly disabled ("Coming soon") and
    are not clickable — no navigation occurs, no console error, no dead link to a page that
    doesn't understand the project context.

## 6. Project-scoped variation list

12. Open the hub for the Org A project that already has two or more saved variation notices.
    Confirm the list shows all of them, each with its variation number, client name, status
    pill, and formatted dollar amount, and a running total at the top of the panel matching the
    sum shown when the same project's variations are viewed from inside
    `variation-generator.html` itself.
13. From the hub, click through to **New Variation Notice**, save a new variation, then use
    **Change project** (or navigate back) to return to the hub for the same project. Confirm the
    new variation now appears in the hub's list without a manual page refresh being required (a
    single reload is fine — confirm it does NOT require re-navigating from the dashboard).
14. Confirm a variation belonging to a **different** Org A project does not appear in this
    project's list.

## 7. Empty state

15. Open the hub for the Org A project with **zero** variation notices. Confirm a clear "No
    variation notices saved to this project yet" message appears in the list panel — not a
    blank area, not a loading spinner stuck forever, no "$NaN" or "undefined" total shown.

## 8. Mobile layout

16. At a narrow viewport (~375px), confirm:
    - The project header, status pill, and tool launch buttons remain readable and don't overflow
      horizontally (no horizontal page scroll).
    - The tool launch row wraps its buttons onto multiple lines cleanly rather than clipping or
      overlapping.
    - Each variation list row remains readable (client name may need to truncate — confirm it
      does so with an ellipsis rather than breaking the row layout).
    - The context bar and "All projects" link remain usable (tappable, not overlapping other
      elements).

## 9. Return navigation

17. From the hub, click **All projects** in the context bar. Confirm it returns to
    `app-dashboard.html` showing the full project list (not a filtered or broken view).
18. From the hub, click the **BIK Business Toolkit** logo in the header. Confirm it also returns
    to `app-dashboard.html`.
19. From `variation-generator.html` (reached via the hub), click **Change project** or
    **Dashboard**. Confirm you land back on `app-dashboard.html`, not on a stale hub page for a
    project that's no longer selected.

## 10. `app-dashboard.html` "Open project" links

20. On `app-dashboard.html`, confirm every project card now shows a single **"Open project"**
    action (not "New Variation Notice" directly) and that no project card still links straight
    to `variation-generator.html`.
21. Click "Open project" on two or three different project cards in turn. Confirm each lands on
    `project-hub.html` for the correct project (right name, right status) — not the previously
    opened one (a stale closure/id bug would show this).
22. Create a **brand-new** project from `app-dashboard.html` and immediately click its "Open
    project" link. Confirm the hub loads correctly for a project with no history at all (empty
    variation list, default `active` status pill, tool launch row still renders).

---

## Sign-off

Record actual results (pass/fail per numbered step, plus any discrepancy) here or in
`docs/changelog.md` before merging. Per standing instruction: **do not merge the Project Hub
until this checklist has been run and passed**, and Quotes/Progress Claims launch actions stay
disabled until their own backends exist.
