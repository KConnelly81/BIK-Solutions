# Sprint 3 — Variation Generator Frontend Integration: Manual Test Steps

**Purpose:** Manual browser verification for `variation-generator.html`'s integration with the live Supabase project (`hpcqncghvdrlvufxfdnd`) via `public.create_variation_notice()` — the parts an automated unit test cannot cover (a real browser, a real session, real network calls). Same rationale as `docs/PHASE_2_FRONTEND_TEST_CHECKLIST.md`.
**Status:** Passed. Run against the live Supabase project (`hpcqncghvdrlvufxfdnd`) and confirmed by the user before Sprint 3 was approved for merge. Unit tests: `js/tools/variation-notice/__tests__/variation-save-logic.test.js`, 32/32 passing.
**Owner:** BIK Solutions Pty Ltd

---

## Setup

- Two disposable browser profiles/incognito windows recommended: **Org A** (primary test account) and **Org B** (a second, unrelated organisation, for the cross-tenant check).
- At least one project already created in Org A via `app-dashboard.html` before starting.

---

## 1. Entry point and gating

1. Sign in as Org A. On `app-dashboard.html`, confirm each project card now shows a **"New Variation Notice"** link.
2. Click it. Confirm the URL is `variation-generator.html?project=<uuid>`.
3. Confirm a brief loading state appears, then the tool renders with a dark context bar at the top showing your organisation name and the project name.
4. Open `variation-generator.html` **directly, with no `?project=` param**. Confirm a clear "no project" message appears (not a blank page, not the form), with a working link back to the dashboard.
5. Open `variation-generator.html?project=<uuid>` **signed out**. Confirm redirect to `signin.html`.
6. While signed in as Org A, edit the URL to a project id that does not exist (e.g. change one digit). Confirm a "could not be found" message, not a crash or an infinite loading spinner.

## 2. Cross-tenant isolation

7. As **Org B**, take a real project id belonging to **Org A** (from step 2/3 above) and open `variation-generator.html?project=<org-A-project-id>` while signed in as Org B.
8. Confirm the "could not be found" message appears — Org B must not see Org A's project name, address, or any other detail.

## 3. Automatic numbering (blank → authoritative)

9. On a **fresh** project (no variations saved yet), fill in the required fields (Client name, Reason for variation, Description of work, Additional cost) and **leave Variation number blank**.
10. Click **Save to project**. Confirm:
    - The button shows "Saving…" and is disabled while in flight.
    - On success, a green success banner appears naming the saved number, e.g. *"Variation VAR-001 saved."*
    - The **Variation number** field itself updates to show `VAR-001` — confirm it was never shown or guessed before this point.
    - The "Variations for this project" list below now shows one row for `VAR-001`, with a running total matching the cost entered.
11. Click **Save to project** again without changing anything. Confirm this now says *"Variation VAR-001 updated"* (not a second row, not a new number, not a duplicate-number error) — this is the second-save-is-an-update path.
12. Create a **second** variation on the same project (use "Clear" first, or open the tool again from the dashboard). Leave the number blank again. Confirm it saves as `VAR-002`.

## 4. Manual entry and normalisation

13. Start a new variation. Type `010` into Variation number (no prefix). Save. Confirm the field updates to show `VAR-010` after saving (server-normalised), and the success banner names `VAR-010`.
14. Start another new variation on the same project. Type `var-010` (lowercase, hyphen). Attempt to save. Confirm a clear, plain-language duplicate error appears — e.g. *"A variation numbered "VAR-010" already exists for this project. Choose a different number."* — and that no internal schema, table, or constraint name appears anywhere in the message.
15. Start another new variation. Type a genuinely custom reference, e.g. `CLIENT-VO-10`. Save. Confirm it saves and displays exactly as typed (not reformatted).

## 5. Validation and duplicate-submit

16. Start a new variation. Leave **Client name** blank. Click Save. Confirm a clear inline error ("Client name is required.") and that nothing is sent/saved (check the variations list count is unchanged).
17. Fill in required fields, click **Save to project**, and — as fast as possible — click it again before the first request resolves (or use browser devtools' network throttling to slow the request and double-click). Confirm only **one** row is created, not two (check the variations list count and total after both clicks resolve).

## 6. Snapshot behaviour

18. On a project that has a linked customer with a business name, open the tool fresh. Confirm **Client name**, **Client email**, **Site address**, and **Project name** are pre-filled from the project/customer, one time, without you typing anything.
19. Change the pre-filled Client name to something else and save. Reload the page (same project). Confirm the snapshot pre-fill does **not** overwrite your locally-drafted change (the one-time populate only fills fields that are still blank).

## 7. PDF / existing functionality unaffected

20. After saving a variation (so the Variation number field holds the authoritative `VAR-00N` value), click **Generate document**. Confirm the PDF preview shows the correct saved number (not "??", not "VN-VAR-001" — just the plain canonical value), and that Copy/Save PDF/Email/Edit still work exactly as before.
21. Confirm the AI Writer button, document History panel, and autosave indicator all still function unchanged.

## 8. Error wording sanity check

22. Throughout the above, watch the browser console (not the UI) for any raw Postgres/Supabase error text. Confirm the UI **never** shows anything containing `internal.`, `variation_number_counters`, a constraint name, or a SQL keyword — only the plain-language messages this checklist describes above.

---

## Sign-off

Record actual results (pass/fail per numbered step, plus any discrepancy) here or in `docs/changelog.md` before merging this branch to `main`.
