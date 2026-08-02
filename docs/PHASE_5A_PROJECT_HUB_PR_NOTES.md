# Project Hub — PR Preparation Notes

**Status:** Dependency resolved and confirmed built. PR #7 (Sprint 4 shared modules) merged to
`main`, followed by hotfixes PR #8, #9, and the Sprint 4 close-out (PR #10) — all fixing a live
production defect (permanent "Loading…" on Variation Notice's list panel) found during PR #7's
own testing, unrelated to Project Hub itself. `sprint-5a-quotes-progress-claims-hub` has been
merged with the updated `main` and re-verified compatible (`project.status`, needed for the
header's status pill, is now included in `gateOnSupabaseProject()`'s query). This branch,
`feature/project-hub`, was cut from that updated `main` and carries only the four files below.
Opened as a **draft** PR — not merged automatically; the live manual checklist below still needs
to be run and passed first.

---

## Exact file list (confirmed against `origin/main`)

| File | Change |
|---|---|
| `project-hub.html` | New |
| `css/project-hub.css` | New |
| `app-dashboard.html` | 1 line changed — the project card action link |
| `docs/PHASE_5A_PROJECT_HUB_MANUAL_TEST_STEPS.md` | New — the manual browser checklist |
| `docs/PHASE_5A_PROJECT_HUB_PR_NOTES.md` | New — this document |

Nothing else. No migration files, no `js/tools/quote-builder/` or `js/tools/progress-claim/`
changes, no `docs/PHASE_5A_DESIGN_PROPOSAL.md` or migration review docs (those are
Quotes/Progress-Claims-centric and explicitly excluded per instruction).

## Dependency finding — resolved

`project-hub.html` imports two modules:

```js
import { gateOnSupabaseProject } from './js/toolkit/supabase-project-context.js';
import { refreshRecordList, escapeHtml } from './js/toolkit/supabase-record-panel.js';
```

These are Sprint 4's shared integration modules. At the time this was first flagged, they lived
only on `sprint-4-shared-integration-pattern` (the original PR #6), which had also accumulated
five unrelated Sprint 5a commits. Resolved, in order:

1. PR #6 was closed. A clean branch (`sprint-4-clean`) was cut from the exact original Sprint 4
   commit (`5227b4c`) and opened as **PR #7** — correctly scoped, matching PR #6's original
   stated content exactly.
2. All Sprint 5a work (design doc, migrations `012`-`017`, the Project Hub itself) moved to
   `sprint-5a-quotes-progress-claims-hub`, based on the same Sprint 4 commit — carried the
   toolkit dependency, stayed out of PR #7 entirely.
3. **Option 1 executed**: PR #7 merged to `main` first, then the Hub work branched/refreshed from
   the updated `main` — matches the "rollback is a simple revert" requirement, since a Hub-only
   PR revert removes nothing Variation Notice depends on.
4. Live testing during PR #7 found an unrelated production defect (Variation Notice's list panel
   stuck permanently on "Loading…") — three further hotfix rounds (PR #8, #9) and a close-out
   (PR #10) were needed before the live retest passed and Sprint 4 was tagged `v0.4.0-sprint4`.
   Full account: `docs/RELEASE_v0.4.0_SPRINT4.md`.
5. `sprint-5a-quotes-progress-claims-hub` merged with the resulting `main` (one real conflict in
   `js/toolkit/supabase-project-context.js`, resolved by keeping `main`'s hardened
   `try`/`catch`/`finally`/timeout structure *and* restoring the `status` column to the
   `.select()` — genuinely needed by this Hub's status pill, not scope creep left over from an
   earlier draft). `project-hub.html`'s two imports confirmed to match the merged modules'
   current signatures exactly (`gateOnSupabaseProject({mountTool, onGated})`,
   `refreshRecordList({table, projectId, selectColumns, renderRow, renderTotal, emptyMessage})`).
6. This branch, `feature/project-hub`, cut from that updated `main`, carrying only the Hub files.

## Confirmations

- **Legacy `project.html` remains untouched.** Not in the diff; confirmed via
  `git diff --stat` against `origin/main` scoped to the four files above only.
- **Existing tools remain untouched.** No file under `js/tools/` appears in the Hub diff.
  `variation-generator.html` is unaffected by the Hub PR (it depends on the same Sprint 4
  modules via PR #7, a separate and already-tracked dependency).
- **The hub is additive.** `app-dashboard.html`'s only change is the project card's action link
  (`New Variation Notice` → `Open project`, pointing at the new page); no existing route, id, or
  behaviour is removed or renamed.
- **Rollback is a simple revert** — true in the fullest sense now that the sequencing is
  PR #7-first: reverting the eventual Hub-only PR removes nothing anything else depends on.

## Steps completed

1. ~~`git fetch origin main && git checkout sprint-5a-quotes-progress-claims-hub`~~ — merged (not
   rebased, to preserve the branch's existing commit history unrewritten) with the updated
   `main`; one conflict resolved (see above). Pushed.
2. ~~Confirm `project-hub.html`'s two imports resolve against `main`'s actual content~~ —
   confirmed by direct comparison of the call sites against the merged modules' current
   signatures.
3. ~~Open the Hub-only PR~~ — opened as a **draft** from `feature/project-hub` into `main`,
   containing only the five files listed above.
4. **Outstanding:** the user runs the manual checklist
   (`docs/PHASE_5A_PROJECT_HUB_MANUAL_TEST_STEPS.md`) live on the site and reports results; the
   PR merges only after that passes.
