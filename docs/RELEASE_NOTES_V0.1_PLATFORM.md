# Release Notes — v0.1 Platform

**Purpose:** Summary of the Phase 1 (Supabase backend) + Phase 2 (frontend
integration) work merged into production on 2026-07-30 — the first release
where BIK has a real multi-tenant backend behind any part of the site.
**Status:** Merged to `claude/bik-solutions-website-yevsuk` (production
branch) and pushed. Manual verification against the live deployment is
still outstanding — see "Manual test checklist" below.
**Owner:** BIK Solutions Pty Ltd

---

## 1. New authentication

Real user accounts, for the first time on the platform. `signup.html` and
`signin.html` use Supabase Auth (email + password):

- Sign-up collects full name, email, password, organisation name, and an
  optional ABN, then creates the organisation in the same flow.
- If the project has email confirmation enabled, sign-up shows a "check
  your email" state and defers organisation setup to first sign-in
  instead of failing silently.
- Sessions persist across refresh and browser restarts (Supabase's own
  local storage session, not a BIK-built mechanism); signing out in one
  tab signs the app out in others.
- No password, token, or credential is ever written to `localStorage` by
  this code — only non-sensitive organisation-setup text (name, ABN) is
  temporarily cached, to survive the email-confirmation redirect.

## 2. Supabase backend

- Project: `hpcqncghvdrlvufxfdnd` (non-production Supabase project used
  for this build and validation; see `docs/PHASE_1_DEPLOYMENT_RUNBOOK.md`
  for the exact deployment record).
- Four tables: `organisations`, `profiles`, `customers`, `projects`.
- One RPC, `bootstrap_organisation()`, is the *only* path that creates an
  organisation — not a table INSERT policy. It derives every identity
  field (`created_by`, the caller's `profiles.id`) from the caller's own
  verified session; nothing about who's creating the org is trusted from
  request parameters.
- Frontend talks to Supabase via one shared client
  (`js/supabase/client.js`), configured with only the project URL and the
  **publishable** key. The service-role key is not present anywhere in
  `js/` and must never be added to browser-shipped code.

## 3. Multi-tenancy

Every organisation's data is isolated from every other organisation's,
enforced at the database layer (Postgres Row Level Security), not in
application code:

- A user's `organisation_id` is derived server-side from their own
  `profiles` row on every request — never accepted as a value the browser
  supplies.
- Reading or writing `customers`/`projects` outside your own organisation
  is not merely hidden by the UI — the database itself returns zero rows
  or rejects the write, regardless of what the client asks for.
- Tenant isolation was proven live at the database level across two
  disposable test organisations (`docs/PHASE_1_DEPLOYMENT_RUNBOOK.md`,
  Stage 4) before any frontend code existed. The frontend adds a UI on
  top of that boundary; it does not implement a new one.

## 4. Security improvements

- **RLS on all four tables**, with policies scoped to `to authenticated`
  only — `anon` has no policy match on anything.
- **Two defects found and corrected during Phase 1 validation, before any
  frontend was built:**
  - **C2:** the `authenticated` role had no baseline table grant at all
    (every request failed, including on the caller's own data) — corrected
    by `008_grant_authenticated_table_privileges.sql`.
  - **C3 (critical):** `anon` and `authenticated` both held inherited
    `TRUNCATE`/`MAINTAIN`/`REFERENCES`/`TRIGGER` privileges from a
    platform-level default ACL — `TRUNCATE` bypasses RLS entirely, and an
    unauthenticated live exploit was confirmed and immediately corrected by
    `009_revoke_dangerous_table_privileges.sql`. Full detail in
    `docs/PHASE_1_DATABASE_REVIEW.md` and ADR-015.
- **Last-owner invariant**: an organisation can never be left with zero
  active owners, enforced by a deferred database trigger
  (`007_protect_last_owner.sql`) that cannot be bypassed by a member
  self-demoting, self-suspending, or even by a direct privileged-connection
  UPDATE/DELETE.
- **No client-supplied trust anywhere in the new frontend code**:
  organisation IDs, roles, and audit fields are either derived server-side
  or independently re-validated by RLS `WITH CHECK` regardless of what the
  browser sends.
- The existing `dashboard.html`/`project.html`/localStorage toolkit is
  completely unmodified and carries none of this — this release adds a
  new, separate, opt-in path, not a change to the existing tools' security
  posture (positive or negative).

## 5. Database migrations 001–009

| # | Migration | What it does |
|---|---|---|
| 001 | `create_organisations` | Tenant root table; RLS enabled, no policies yet |
| 002 | `create_profiles` | Per-user identity + org/role assignment; RLS enabled, no policies yet |
| 003 | `create_customers` | Client records, scoped to an organisation |
| 004 | `create_projects` | The primary business object; scoped to an organisation, optionally linked to a customer |
| 005 | `phase1_rls` | All RLS policies for the four tables above — the migration that actually turns on tenant isolation |
| 006 | `create_organisation_bootstrap` | `bootstrap_organisation()` RPC — the only way to create an organisation |
| 007 | `protect_last_owner` | Deferred trigger enforcing the last-owner invariant |
| 008 | `grant_authenticated_table_privileges` | Fixes C2 — baseline table grants for `authenticated` |
| 009 | `revoke_dangerous_table_privileges` | Fixes C3 — removes inherited `TRUNCATE`/etc. from `anon`/`authenticated` |

Full detail, verification queries, and results for each: see
`docs/PHASE_1_DEPLOYMENT_RUNBOOK.md` (Results Record) and
`docs/PHASE_1_DATABASE_REVIEW.md`.

## 6. Known limitations

- **Live browser testing not performed during the build session** — that
  sandbox blocks outbound access to the Supabase project's public API host,
  so all Phase 2 frontend work there was verified by schema/RLS cross-check
  and full manual code-path review only. **Live testing against the real
  deployment has since started** and already found one real defect (email
  confirmation redirect — see below, fixed); the manual checklist should
  still be run in full before treating this release as proven.
- ~~Email-confirmation landing page unconfirmed~~ — **found and fixed.**
  Live signup testing showed the confirmation link redirecting to
  `http://localhost:3000` (the Supabase Auth project's Site URL was still
  the development default; `signup.html` also didn't specify
  `emailRedirectTo`). Fixed on both sides: `signup.html` now passes
  `emailRedirectTo: \`${window.location.origin}/signin.html\`` explicitly
  (derived from origin, not hard-coded — see `docs/changelog.md`), and
  Supabase Auth → URL Configuration's Site URL / allowed redirect URLs were
  updated to `https://biksolutions.com.au`. Confirmed users now land on
  `signin.html`, which processes the session and routes to organisation
  setup or `app-dashboard.html`. **Not yet retested end-to-end** — awaiting
  a fresh confirmation email against the corrected configuration.
- **No public navigation link** points at `signup.html`/`signin.html` yet
  — reachable only by direct URL. Intentional for this release.
- **No customer-linking UI** on the new project-create form (the schema
  supports it; the UI doesn't expose it yet).
- **Stage 7 step 3** (the concurrent-transaction last-owner race test) was
  not independently executed during Phase 1 validation — see
  `docs/PHASE_1_DEPLOYMENT_RUNBOOK.md` for detail.
- `dashboard.html`, `project.html`, and every existing tool remain
  entirely on `localStorage`, untouched and unconnected to this backend.

## 7. Manual test checklist

Full step-by-step checklist: **`docs/PHASE_2_FRONTEND_TEST_CHECKLIST.md`**.
Summary of what it covers:

- Sign up → determine actual email-confirmation behaviour on the live
  project
- Duplicate-bootstrap protection
- Create and see a project
- Refresh persistence
- Logout / login persistence
- Tenant isolation with a second disposable user
- Error states (bad login, offline, duplicate email)
- Test-data cleanup afterward (SQL, not part of the browser flow itself)

## 8. Rollback instructions

Nothing in this release touches `dashboard.html`, `project.html`,
`js/toolkit/project-store.js`, or any other existing tool, and no public
link points at the new pages — so the practical blast radius of leaving
this in place, even if a problem is found, is limited to the three new
pages themselves being reachable by direct URL.

**Frontend rollback (safe, non-destructive — recommended):**
```bash
git checkout claude/bik-solutions-website-yevsuk
git pull origin claude/bik-solutions-website-yevsuk
# Revert the merged commit range (fd5701f..e0eb4c1) as new commits,
# rather than resetting/force-pushing:
git revert --no-commit fd5701f..e0eb4c1
git commit -m "Revert v0.1 Platform: Supabase frontend integration"
git push origin claude/bik-solutions-website-yevsuk
```
This removes the new pages/files from production history going forward
while preserving the full record of what was tried. Prefer this over
`git reset --hard` + force-push, which rewrites shared history and can
discard anyone else's work that landed on top of it in the meantime.

**Backend rollback (only if a genuine defect is found in the schema —
more disruptive, do not do this reflexively):**
All four Phase 1 tables are currently empty in production (no real user
has signed up through this flow yet as of this release). If migrations
001–009 ever need to be undone entirely:
1. Confirm no real organisation/profile/project data exists yet (`select
   count(*) from organisations`, etc. — if any of these are non-zero,
   stop and treat this as a data-loss decision, not a routine rollback).
2. Drop in reverse dependency order: RLS policies and the
   `bootstrap_organisation()`/trigger functions (005–009), then the four
   tables (004→001).
3. This is destructive and irreversible for any data created in the
   meantime — require explicit sign-off before running it, and prefer
   disabling/suspending over dropping if the goal is just to stop new
   signups (e.g. remove the public path to `signup.html`, which achieves
   the same practical outcome without touching the database at all).

In practice: for anything short of a confirmed security defect, disabling
access to the three new pages (or reverting the frontend commits above)
is sufficient — dropping the backend should be a deliberate, separately
authorised decision, not a default rollback step.
