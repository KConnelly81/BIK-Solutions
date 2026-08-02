# Sprint 5b — Quotes / Progress Claims / Project Hub: Manual Test Steps

**Purpose:** Manual browser verification for `quote-builder.html`, `progress-claim.html`, and
`project-hub.html`'s three-list view — the parts an automated unit test cannot cover (a real
browser, a real session, real network calls, real viewport). Same rationale as
`docs/PHASE_3_SPRINT_3_MANUAL_TEST_STEPS.md` and `docs/PHASE_5A_PROJECT_HUB_MANUAL_TEST_STEPS.md`.
**Status:** **PASSED** — live acceptance testing run by the user against production (`main` @
`ad39254`, PR #12) after merge, 2026-08-02. Full scope reported passed: Project Hub (status pill no
longer shows `undefined`, all three list sections render with correct empty/populated states),
Quote Builder (draft create/edit/save/refresh/reopen, logout-login persistence, line item add/
edit/remove with server-authoritative totals, issue workflow, post-issue immutability, issued
snapshot retained, appears correctly in Project Hub), Progress Claim (draft create/edit/save/
refresh/reopen, logout-login persistence, Schedule of Values rows with correct derived totals/
retention/remaining value, Issue button reaching the real server and correctly rejected with the
approved BLOCKED message, appears correctly in Project Hub), and general checks (no permanent
loading states, correct empty/error states, desktop + mobile layouts, no console errors, cross-
organisation isolation confirmed). See `docs/RELEASE_v0.5.0_SPRINT5.md` for the full release
record. Backend (migrations `012`-`017`) has been live on `hpcqncghvdrlvufxfdnd` since before this
checklist ran — see `docs/changelog.md`'s Sprint 5b entry.
**Owner:** BIK Solutions Pty Ltd

---

## Setup

- One test organisation with at least one project (the "BIK test" organisation used for live
  backend verification is suitable — the two live-verification records already created and
  cleaned up there do not interfere with this checklist).
- A second, unrelated organisation for the cross-organisation checks (Section 7).
- A mobile viewport or device for the mobile-layout section (browser devtools responsive mode,
  ~375px width, is sufficient).

---

## 1. Quote Builder — first save (create)

1. From Project Hub, click **New Quote**. Confirm it navigates to
   `quote-builder.html?project=<id>` and the context bar shows the correct org/project.
2. Confirm the **Save to project** panel shows "Not yet saved to this project."
3. Leave **Quote number** blank. Fill in Client name, a Client email, Scope of works, and add at
   least one line item (Pricing — Line Items section) with a description, quantity, and unit
   price.
4. Click **Save to project**. Confirm success, and confirm the **Quote number** field updates to
   `QT-0001` (or the next number in sequence for this organisation) — a value the form never
   typed itself.
5. Confirm the line item's total shown in the editor is correct (qty × unit price, +10% GST if
   the GST checkbox is ticked).
6. Refresh the page (same `?project=` URL). Confirm the saved quote and its line item are
   **not** auto-loaded into the form (this is expected — the form is a fresh draft each visit;
   loading a saved quote for editing is a future capability, not built in this sprint) but **do**
   appear in the "Quotes for this project" list below.

## 2. Quote Builder — later saves (update) and line item sync

7. Change the Client name and add a second line item. Click **Save to project** again. Confirm
   the success message says "updated", not "saved", and confirm **Quote number** is unchanged.
8. Confirm the "Quotes for this project" list (refreshed after save) shows the updated client
   name and both line items reflected in the running total.
9. Remove one line item in the editor and save again. Confirm the removed item no longer appears
   if you reload the quote's totals (indirectly, via the list total decreasing).

## 3. Quote Builder — manual numbering

10. Open a fresh browser tab, navigate to `quote-builder.html?project=<same project>`, type a
    manual quote number (e.g. `"50"`) into **Quote number**, fill the required fields, and save.
    Confirm it's stored as `QT-0050` (normalised), not `"50"` literally.
11. Attempt to save a second new quote with the exact same manual entry (`"50"` or `"QT-0050"` or
    `"qt 50"`). Confirm a friendly error naming `QT-0050`, not a raw database error.

## 4. Quote Builder — issue workflow

12. On a saved draft quote missing **Quote type** and **Valid until**, click **Issue quote**.
    Confirm a clear message about quote type being required (checked first).
13. Set Quote type; retry. Confirm the valid-until message.
14. Set Valid until to a date **before** the quote date; retry. Confirm a distinct "cannot be
    before the quote date" message.
15. Fix the date; ensure Client email is blank; retry. Confirm the client-email message
    specifically (proving client name alone isn't enough).
16. Fill in Client email and confirm at least one line item exists; click **Issue quote**. Confirm
    success — the button becomes "Issued", and the quote's status pill in the project list shows
    "issued".
17. **Post-issue immutability**: attempt to edit any field and click **Save to project** again on
    the now-issued quote. Confirm a clear "this quote has been issued and can no longer be
    changed" message, not a silent success and not a raw permission error.
18. Attempt to add another line item to the issued quote (if the UI allows adding one) and save.
    Confirm the same rejection.
19. Click **Issue quote** again on the already-issued quote. Confirm a clear rejection, not a
    second "issued" success message.

## 5. Progress Claim — create, edit, schedule of values

20. From Project Hub, click **New Progress Claim**. Confirm navigation and context bar.
21. Leave **Claim number** blank, fill in Client name and Client email, and add at least one
    Structured Schedule of Values row with a description, a contract value, and a "This claim %"
    (e.g. 50%). Confirm the row's "This claim $"/"Claimed to date"/"Remaining" columns update live
    as you type.
22. Click **Save to project**. Confirm success and **Claim number** updates to `PC-001` (or next
    in sequence for this project).
23. Confirm the claim appears in "Progress claims for this project" with the correct net payable
    amount.
24. Edit the Retention rate selector to "5% (standard)", save, and confirm the list total updates
    accordingly (retention reduces net payable). Switch to "Custom amount", enter a dollar
    retention figure, and confirm it's accepted without error (the effective rate is derived
    server-side from the amount over this claim's total — not directly visible in the UI, but
    should not error).

## 6. Progress Claim — issuing is genuinely blocked, not hidden

25. On a fully filled-in, valid-looking draft (client name, email, schedule item, sensible
    figures), click **Issue progress claim**. Confirm a clear message referencing GST/retention/
    overclaiming treatment requiring accountant/contract confirmation — **the same message every
    time, regardless of how complete the draft is** (this is the point: the button is real, calls
    the real database RPC, and is unconditionally rejected server-side, not disabled or faked).
26. Confirm the draft itself remains fully editable and saveable after the rejected issue attempt
    — only issuing is blocked, nothing else.
27. Confirm the "Save to project"/"Issue progress claim" panels' hint text and the list's status
    pill never claim or imply the claim is "issued" at any point in this flow.

## 7. Cross-organisation isolation (spot check — full RLS coverage already verified live at the database level)

28. As a second, unrelated organisation, open `quote-builder.html`/`progress-claim.html` for one
    of your own projects and confirm you cannot see any quote/claim numbers from the first
    organisation's testing above, anywhere (form, list, or browser network tab response bodies).

## 8. Project Hub — three lists together

29. Open Project Hub for the project used above. Confirm three separate list panels render:
    Variation Notices, Quotes, Progress Claims — each with its own correct running total and no
    id collisions (each list's loading/empty/populated state transitions independently of the
    other two; e.g. an error in one list must not affect the other two's rendering).
30. Confirm **New Quote** and **New Progress Claim** in the tool launch row are now live links
    (not "Coming soon"), and each navigates to the correct tool with the correct `?project=` id.
31. From the hub, issue or save a new quote, then return to the hub (via "Change project" → same
    project, or browser back). Confirm the Quotes list reflects the change without needing a full
    dashboard re-navigation (a single reload is fine).

## 9. Mobile layout

32. At a narrow viewport (~375px) on `project-hub.html`, confirm all three list panels stack
    cleanly, remain readable, and the page does not scroll horizontally.
33. At the same viewport on `quote-builder.html` and `progress-claim.html`, confirm the Save/Issue
    panels and the structured line-item/schedule tables remain usable (horizontal scroll inside
    the table itself is acceptable; the page as a whole must not scroll horizontally).

---

## Sign-off

**PASSED — 2026-08-02, run by the user against production** (`main` @ `ad39254`, PR #12, merged).
All sections (1-9) reported passing: Quote Builder create/edit/save/refresh/reopen/logout-login/
issue/post-issue-immutability, Progress Claim create/edit/save/refresh/reopen/logout-login/the
Issue action correctly blocked by the live RPC, Project Hub's three list sections (including the
`project.status` "undefined" pill fix), cross-organisation isolation, desktop and mobile layouts,
no permanent loading states, no console errors. No material failures reported. Sprint 5 closed —
see `docs/RELEASE_v0.5.0_SPRINT5.md`.
