# Phase 2 Frontend — Manual Test Checklist

**Purpose:** The exact manual verification for `signup.html` / `signin.html` /
`app-dashboard.html` against the live Supabase project (`hpcqncghvdrlvufxfdnd`),
covering what automated testing in the build session could not: real network
calls to the project's public Auth/REST API. See "Why this is manual" below.
**Status:** Not yet run against the live deployment — code-level and
schema/RLS-level verification only (see the build session's completion notes
in `docs/changelog.md`, Unreleased section).
**Owner:** BIK Solutions Pty Ltd

---

## Why this is manual, not automated

The build session ran in a sandboxed environment whose network policy
blocks outbound connections to `hpcqncghvdrlvufxfdnd.supabase.co` — the
project's own public Auth/REST endpoint, which a real browser must reach
directly. This is a property of that sandbox, not of the code or the
deployed site: it does not affect real users, and does not affect this
checklist run from an ordinary machine/browser. The Supabase MCP tools
used throughout Phase 1 reach the project through a separate, allowed
management channel, which is why schema/RLS work could be fully verified
live while this frontend's actual browser flow could not.

What the build session *did* verify from the sandbox:
- The exact schema (columns, types, defaults, check constraints, FKs) via
  `list_tables`, cross-checked line-by-line against every query and insert
  in `signup.html` / `app-dashboard.html`.
- The exact RLS policies and `bootstrap_organisation()` behaviour (already
  fully live-tested end-to-end in `docs/PHASE_1_DEPLOYMENT_RUNBOOK.md`
  Stages 3–7) against what the frontend code assumes.
- Full manual trace of every code path: session gating, the no-profile
  bootstrap/retry path, error handling, loading/empty states, project
  create/list, logout, and cross-tab sign-out handling.

What it could *not* verify: that a real browser, a real email-confirmation
setting, and real network calls actually behave as the code assumes. That
gap is exactly what this checklist closes.

---

## Prerequisites

- Run this from a machine with ordinary internet access (not the build
  sandbox) — your own laptop, or any CI runner without the sandbox's
  egress restriction.
- Serve the site over HTTP, not `file://` (ES modules require it):
  `npx http-server .` (or any static server) from the repo root, then open
  `http://localhost:8080/signup.html` — or use the real GitHub Pages
  deployment once these files are live there.
- Two disposable email addresses you can actually receive mail at (needed
  only if email confirmation turns out to be required — see step 1).
- Do **not** use the service-role key for any of these steps. Everything
  below should work with exactly what's shipped: the publishable key.

---

## 1. First signup — determine email confirmation behaviour

1. Open `signup.html`. Confirm the form renders with no flash of
   already-authenticated redirect (if you have a stale session, you should
   be bounced to `app-dashboard.html` instead of seeing this form).
2. Submit with a real, receivable disposable email, a full name, a
   password ≥ 8 characters (confirm matches), an organisation name, and
   optionally an ABN (try one, e.g. `12345678901`, and try an invalid one
   like `123` to confirm it's rejected client-side before submission).
3. One of two things should happen:
   - **No email confirmation required:** you land on `app-dashboard.html`
     directly, already showing your new organisation and your name/email
     in the header. ✅ this is the whole bootstrap flow working in one
     pass.
   - **Email confirmation required:** you see a "check your email" banner
     and the form disappears; no redirect happens. Go to your inbox, click
     the confirmation link. Depending on the project's configured
     redirect URL, this may land you on the site's root rather than a
     specific page — if so, navigate to `signin.html` manually, sign in,
     and confirm you land on `app-dashboard.html` showing the **inline
     organisation-setup form** (not the real dashboard yet), pre-filled
     with the organisation name/full name/ABN you entered at signup *if
     the confirmation link opened in the same browser tab* (sessionStorage
     doesn't carry across tabs/devices — if it opened elsewhere, the form
     will be blank and you'll need to re-enter those details, which is
     expected). Submit it and confirm you land on the real dashboard.
4. Record which behaviour you saw — this determines the sign-up UX real
   users will get.

## 2. Duplicate-bootstrap protection

1. While signed in as the user from step 1, open the dashboard and
   double-click "New project" rapidly a few times — confirm only one form
   toggle occurs (no duplicate forms/handlers).
2. More importantly: if you landed on the org-setup step at any point in
   step 1, try submitting it a second time (e.g. reload and resubmit).
   Confirm you do **not** end up with two organisations — you should land
   on the same dashboard either way, and `bootstrap_organisation()`'s own
   guard should prevent a second organisation from being created.

## 3. Create and see a project

1. From the dashboard, click "New project", fill in a name (e.g. "Test
   Project — cleanup me"), leave status at "Active", optionally add a
   site address, submit.
2. Confirm the new project appears in the list immediately, with the
   correct status pill ("Active").
3. Try each status value in a second test project and confirm the pill
   label/colour is correct for all five: Draft, Active, On hold,
   Completed, Archived. Confirm "Completed" is the label used (not
   "Complete").

## 4. Refresh persistence

1. Reload `app-dashboard.html` (hard refresh).
2. Confirm: no flash of the org-setup form or an empty dashboard before
   the real content appears; organisation name, user name, and both test
   projects are still there, fetched fresh (not from any local cache).

## 5. Logout / login persistence

1. Click "Log out". Confirm you land on `signin.html` and that navigating
   directly back to `app-dashboard.html` afterwards redirects you to
   `signin.html` (no protected content visible while signed out).
2. Sign back in with the same credentials on `signin.html`.
3. Confirm you land on `app-dashboard.html` showing the **same**
   organisation and the **same** two test projects from step 3 — this is
   the core "still see it after logout/login" requirement.

## 6. Tenant isolation (second user)

1. Open a private/incognito window (separate session). Sign up a second
   disposable user with a **different** organisation name.
2. Complete that user's bootstrap the same way as step 1.
3. Confirm this second dashboard shows **zero** projects (not the first
   user's projects) and the second organisation's name, not the first's.
4. Create one project as this second user. Confirm it does not appear
   for the first user (switch back to their window/session and reload).
5. This confirms RLS-based tenant isolation from the actual browser flow,
   matching what `docs/PHASE_1_DEPLOYMENT_RUNBOOK.md` Stage 4 already
   proved at the database level.

## 7. Error states (optional but recommended)

- Try signing up with an email already used in step 1 — confirm a clear
  "account already exists" message, not a raw error.
- Try signing in with a wrong password — confirm "that email or password
  is not correct", not a raw error.
- Turn off network (devtools offline mode) and try creating a project —
  confirm an error banner appears rather than a silent failure or a
  localStorage fallback (there should be none — check devtools
  Application → Local Storage to confirm no `bik-projects`-style key was
  written by these pages).

---

## Cleanup after testing

Every account created above is disposable test data in a production
Supabase project — remove it the same way Phase 1 testing did (service
role / SQL, **not** part of any browser-flow test):

```sql
-- Identify the test orgs/users created above, then, per organisation:
delete from projects where organisation_id = '<test org id>';
delete from customers where organisation_id = '<test org id>';
-- If the org's owner is still its sole active owner, suspend the org first
-- (ADR-012 sequence — see docs/PHASE_1_DEPLOYMENT_RUNBOOK.md Stage 7):
update organisations set status = 'suspended' where id = '<test org id>';
delete from auth.users where id = '<test user id>'; -- cascades to profiles
delete from organisations where id = '<test org id>';
```

Repeat for both test users/organisations. Verify zero rows remain for
either in `organisations`, `profiles`, `customers`, `projects`, and
`auth.users`.
