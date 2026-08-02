# Release v0.5.0-sprint5 — Quotes, Progress Claims, Project Hub (live)

**Release date:** 2026-08-02
**Feature merge commit SHA:** `ad392545c348d8552d4eaeffbddbb23517caef16` (PR #12, merged into `main`)
**Preceding backend work:** migrations `012`-`017` applied directly to `hpcqncghvdrlvufxfdnd`
(2026-08-02, same day, ahead of the PR)
**Tag recommendation:** `v0.5.0-sprint5` (annotated, cut at `main` HEAD = `ad39254`)
**Live project:** `hpcqncghvdrlvufxfdnd`
**Live acceptance:** **PASSED** — full manual checklist run by the user against production,
2026-08-02. See `docs/PHASE_5B_QUOTES_PROGRESS_CLAIMS_MANUAL_TEST_STEPS.md` for the signed-off
checklist.
**Owner:** BIK Solutions Pty Ltd

---

## Features delivered

- **Quote Builder** moved from a legacy localStorage document generator to the authenticated
  Supabase model: session- and project-gated, drafts created via `create_quote()` (organisation-
  scoped, concurrency-safe canonical `QT-0001` numbering, or a manual override normalised
  server-side), line items entered via the existing `LineItemsEditor` and synced to
  `quote_line_items` on every save, every total (line, subtotal, GST, grand total) server-computed
  and never trusted from the client. `issue_quote()` is the sole path to `issued`; once issued, the
  header and every line item are permanently frozen — no exceptions, verified live.
- **Progress Claim** moved the same way: `create_progress_claim()` (project-scoped canonical
  `PC-001` numbering), a new structured **Schedule of Values editor**
  (`js/toolkit/schedule-of-values.js`) replacing the old freeform textarea, synced to
  `progress_claim_line_items`, with claimed-to-date/remaining/retention/net-payable all
  server-derived. **Issuing remains unconditionally blocked** at the database level
  (`issue_progress_claim()`'s gate, `017`) pending accountant/contract confirmation of GST and
  retention treatment — the frontend's "Issue" button is real, calls the real RPC, and surfaces the
  real rejection every time; it does not simulate a working feature that isn't ready.
- **Project Hub** extended from one list (Variation Notices) to three (Variation Notices, Quotes,
  Progress Claims) on the same page, plus a fix to a pre-existing live bug where the project status
  pill rendered "undefined" (the deployed project-query helper was never actually selecting
  `status`, despite `project-hub.html` reading it since PR #11 — corrected as part of this release).
- **Two new shared toolkit modules**, reusable by any future Supabase-backed tool with its own
  child line-item table: `js/toolkit/supabase-line-items.js` (delete-then-reinsert sync, naturally
  inheriting each table's own draft-only immutability trigger with no special-casing) and
  `js/toolkit/supabase-issue-button.js` (generic issue-RPC wiring — duplicate-submit guard, the
  same safe-error-message contract as the save button).
- **`supabase-record-panel.js`/`supabase-project-context.js` extended, not replaced**: an optional
  `idPrefix` on `refreshRecordList()` (lets multiple lists share one page — the mechanism Project
  Hub's three sections now use) and an optional `buildCreateFollowUpPayload` on `wireSaveButton()`
  (for a create RPC that only accepts a minimal header on first save, unlike Variation Notice's).
  Both are opt-in; every existing caller with neither set is byte-identical to before.

## Production architecture

Unchanged in shape from the pattern Sprint 3/4 established — see
`docs/technical-architecture.md` ("Two project systems") for the full description. In summary:
static HTML + native ES modules, no framework/bundler, no build step. Every Supabase-backed tool
(now three: Variation Notice, Quote Builder, Progress Claim) shares the same integration layer
(`js/toolkit/supabase-project-context.js` for session/project gating,
`js/toolkit/supabase-record-panel.js` for save/list wiring, plus this release's two additions for
line-item sync and issuing) and supplies only its own field mapping, validation, and display copy
in a small `<tool>-save-logic.js` + `supabase-integration.js` pair. Every other tool in the toolkit
remains entirely on the legacy localStorage model — migrated tool-by-tool, not in a cutover.
GitHub Pages continues to deploy directly from `main` on every push, no Actions workflow, no build
artifacts to publish.

## Production database state

Live on `hpcqncghvdrlvufxfdnd`:

| Table | Purpose | Numbering scope | Issue workflow |
|---|---|---|---|
| `organisations`/`profiles`/`customers`/`projects` | Phase 1 tenancy model | — | — |
| `variation_notices` | Variation Notice records | per-project (`VAR-NNN`) | live (`issue_variation_notice` equivalent, Sprint 3) |
| `quotes`/`quote_line_items` | Quote Builder records | per-organisation (`QT-0001`) | live (`issue_quote()`) |
| `progress_claims`/`progress_claim_line_items` | Progress Claim records | per-project (`PC-001`) | **blocked** (`issue_progress_claim()`'s unconditional gate) |

All tenant tables have Row Level Security enabled with no exceptions; every client-facing write
path is either a column-scoped grant (excluding every lifecycle and server-computed-total column)
or a `SECURITY DEFINER` RPC that independently re-checks organisation ownership rather than
trusting RLS alone. `internal.*` counter tables (`quote_counters`, `progress_claim_counters`,
plus `variation_number_counters` from Sprint 3) have zero grants to any client role — reachable
only via their own trigger.

One disposable test record remains live, deliberately: `quotes` row `QT-0001`
(`973e7ae1-4792-4d62-bd64-ce8329f45569`), status `issued`, in the account's own "BIK test"
organisation, clearly labelled (`client_name = "LIVE TEST DELETE ME"`). Left in place because the
immutability trigger correctly refuses to let anyone — including direct database administration —
alter or delete an issued record's line items, and disabling that trigger to force a delete was
explicitly rejected as an unsafe workaround. A dedicated, separately-reviewable admin-purge
function was proposed in PR #12's description; not built.

## Migrations now live

`001` through `017`, applied in order, all confirmed via `list_migrations` against
`hpcqncghvdrlvufxfdnd`:

```
001_create_organisations              009_revoke_dangerous_table_privileges
002_create_profiles                   010_create_variation_notices
003_create_customers                  011_variation_notice_number_generator
004_create_projects                   012_create_quotes
005_phase1_rls                        013_create_quote_numbering
006_create_organisation_bootstrap     014_create_quote_issue_workflow
007_protect_last_owner                015_create_progress_claims
008_grant_authenticated_table_privileges  016_create_progress_claim_numbering
                                       017_create_progress_claim_issue_workflow (BLOCKED gate live)
```

`get_advisors` (security + performance) shows only already-accepted finding patterns for the six
new-this-sprint objects (`SECURITY DEFINER` on `issue_quote()`/`issue_progress_claim()`,
`rls_enabled_no_policy` on the two new counter tables) — identical shape to `bootstrap_organisation()`
and `variation_number_counters`, not new risk classes. No unexpected findings.

## Manual testing completed

Full checklist (`docs/PHASE_5B_QUOTES_PROGRESS_CLAIMS_MANUAL_TEST_STEPS.md`, 33 steps) run by the
user against production (`main` @ `ad39254`) and **passed in full**:

- **Project Hub:** status pill no longer shows `undefined`; Variation Notices/Quotes/Progress
  Claims render as three independent sections with correct empty and populated states.
- **Quote Builder:** draft create → line items added/edited/removed with server-authoritative
  totals → save → refresh/reopen → logout/login persistence → issue → issued snapshot retained →
  issued content and line items confirmed uneditable → appears correctly in Project Hub.
- **Progress Claim:** draft create → Schedule of Values rows added/edited with correct derived
  totals/retention/remaining value → save → refresh/reopen → logout/login persistence → Issue
  clicked and correctly rejected by the live server with the approved temporary message → draft
  still appears correctly in Project Hub.
- **General:** no permanent loading states, visible empty/error states, desktop and mobile layouts
  both confirmed, no BIK application console errors, a second organisation confirmed unable to
  access the new records.

No material failures reported.

## Known limitations

- **`quotes.status`/`progress_claims.status` enum values `accepted`/`declined`/`expired`/`void`/
  `approved`/`disputed`/`paid`/`archived` are declared but unreachable** — no RPC exists yet to
  reach any of them. Styled in CSS ahead of need; not a functional gap for this release's scope.
- **Progress Claims cannot be issued** — by design, pending an accountant/contract decision on
  GST/retention treatment (five open questions recorded in
  `docs/PHASE_5A_PROGRESS_CLAIMS_MIGRATION_REVIEW.md`). Drafts are fully usable.
- **One admin-only trigger edge case, zero client exposure**: cascade-deleting a *draft*
  quote/claim's parent row (only reachable via direct database administration — no client has a
  `DELETE` grant on either table) mislabels the rejection as "already issued" because the child
  trigger's status lookup sees the parent as already gone mid-cascade. Documented, not fixed.
- **One disposable test record intentionally left live** (see "Production database state" above).
- **No PR-preview deployment exists for this repository** — GitHub Pages deploys only `main` on
  push, no Actions workflow. All pre-merge testing of this release was necessarily either
  automated (107 tests) or run locally against the live backend, not against a hosted preview.

## Technical debt

- **`js/toolkit/project-store.js`/`project-ui.js` (the legacy localStorage project model) still
  serves every tool other than Variation Notice/Quote Builder/Progress Claim** — a real duplicate
  system, not yet retired, by design (tool-by-tool migration, not a cutover). Each future migration
  repeats the same retrofit shape now proven three times.
- **The admin-purge-test-record function proposed in PR #12 remains unbuilt** — needed the next
  time a disposable issued record needs removing from a live environment; currently no safe path
  exists other than "leave it in place."
- **`assets/fonts/Inter-SemiBold.woff2` still 404s in production** — cosmetic, noted since Sprint 4,
  not addressed in any release since.
- **Progress Claims' full lifecycle (accept/decline/dispute/pay/archive) and Quotes' equivalent
  (`accepted`/`declined`/`expired`/`void`/`archived`) have no RPCs at all** — the enum values exist,
  nothing can reach them. Deferred, not forgotten.

## Remaining risks

- **Progress Claims' GST/retention/overclaiming/contract-value questions are still unresolved** —
  `017` cannot be safely unblocked until an accountant/contract-policy decision is recorded; issuing
  a real payment claim with the wrong GST-before-or-after-retention order has real compliance
  consequences in Australian security-of-payment jurisdictions. Tracked as the explicit gate on any
  future work in this area.
- **No automated E2E/browser test suite exists for any Supabase-backed tool** — every release to
  date (Sprint 3 through 5) has relied on a human running a manual checklist against production
  after merge. This has worked, but scales linearly with the number of live tools and carries the
  risk of an untested regression shipping between the automated-test gate and the manual pass.
- **The AI Professional Writer still calls the Anthropic API directly from the browser** with a
  user-supplied API key stored in `localStorage` — a known, previously-accepted risk, unrelated to
  this release, and the explicit subject of the proposed Sprint 6 below.

## Lessons learned

- **Retrofitting an existing legacy tool onto the Supabase pattern is now a known-cost operation**,
  proven three times (Variation Notice, Quote Builder, Progress Claim) with a consistent shape:
  gate the page, wire save/list via the two shared toolkit modules, add a small tool-specific
  `<tool>-save-logic.js` with its own unit tests. Quote Builder and Progress Claim both landed with
  zero live-testing rework this time, unlike Variation Notice's three-round hotfix chain in
  Sprint 3/4 — the shared modules built specifically to prevent a repeat of that did.
- **A create RPC that only accepts a minimal header on first save (this sprint's `create_quote()`/
  `create_progress_claim()`) is a real, recurring shape**, not a one-off — `wireSaveButton()`'s new
  `buildCreateFollowUpPayload` generalises the fix once rather than requiring each future tool to
  reinvent a two-step save.
- **A live bug can hide behind a passing automated suite for an entire sprint boundary** — the
  `project.status` "undefined" pill shipped with PR #11 and was only caught during this release's
  pre-merge diff review, not by any test (there was none covering it, and the symptom is purely a
  rendering one). Worth a standing reminder: a shared query helper's selected-columns list is a
  contract every consumer depends on silently: enabling it is why grepping the actual diff, not
  trusting the changelog's own prior claim about it, is what caught this.
- **Deleting disposable live test data is not always safe, even for an administrator** — the same
  immutability guarantee that protects real customer data from tampering applies uniformly, with no
  built-in escape hatch. This is the correct trade-off (a database that trusts its own
  administrator to bypass its core guarantees isn't actually enforcing them), but it means test-data
  hygiene needs its own deliberately-designed tooling, not an assumption that cleanup is always
  possible after the fact.

## Rollback status

- **Frontend:** this release's entire diff (PR #12) is isolated to Quotes/Progress Claims/Project
  Hub/the two new shared modules — `git revert` of the merge commit (`ad39254`) removes exactly
  this scope and nothing else, cleanly, with no known entanglement with any other tool.
- **Backend:** migrations `012`-`017` remain live and are not proposed for rollback — no real
  customer data depends on them yet (only the one disposable test record above), so the actual risk
  of leaving them live is negligible, and no down-migration has been drafted. If a rollback of the
  backend were ever needed, it would require an explicit down-migration (dropping the six new
  tables/functions) — not attempted in this release and not currently planned.
- **No rollback was needed this release** — live acceptance passed on the first attempt.

## Release tag recommendation

**`v0.5.0-sprint5`**, annotated, cut at `main` HEAD (`ad39254`) — following the existing
`v0.3.0-sprint3`/`v0.4.0-sprint4` convention. Tag push is a manual step per this repo's standing
practice (see the outstanding "push release tags manually" item carried from earlier sprints);
not pushed automatically by this report.

---

## Related documents

- `docs/PHASE_5B_QUOTES_PROGRESS_CLAIMS_MANUAL_TEST_STEPS.md` — signed-off manual checklist
- `docs/PHASE_5A_QUOTES_MIGRATION_REVIEW.md` / `PHASE_5A_PROGRESS_CLAIMS_MIGRATION_REVIEW.md` — backend design/review record
- `docs/technical-architecture.md` — updated production architecture
- `docs/product-roadmap.md` — updated production status
- `docs/changelog.md` — full chronological record
- `docs/SPRINT_6_PROPOSAL_AI_EDGE_FUNCTION.md` — the proposed next sprint (design only, not started)
