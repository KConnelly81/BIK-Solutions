# Project Hub — PR Preparation Notes

**Status:** Dependency decision made and executed (option 1, below, confirmed by the user). PR
not yet opened — **blocked on PR #7 merging first**. Once PR #7 merges, refresh
`sprint-5a-quotes-progress-claims-hub` from the new `main`, confirm `project-hub.html` runs with
no remaining branch-only dependencies, then open the Hub-only PR into `main` — reviewed live on
the site, not merged automatically.

---

## Exact file list (confirmed against `origin/main`)

| File | Change |
|---|---|
| `project-hub.html` | New (164 lines) |
| `css/project-hub.css` | New (104 lines) |
| `app-dashboard.html` | 1 line changed — the project card action link |
| `docs/PHASE_5A_PROJECT_HUB_MANUAL_TEST_STEPS.md` | New (141 lines) — the manual browser checklist |

Nothing else. No migration files, no `js/tools/quote-builder/` or `js/tools/progress-claim/`
changes, no `docs/PHASE_5A_DESIGN_PROPOSAL.md` or migration review docs (those are
Quotes/Progress-Claims-centric and explicitly excluded per instruction).

## Dependency finding — resolved

`project-hub.html` imports two modules that do not exist on `main`:

```js
import { gateOnSupabaseProject } from './js/toolkit/supabase-project-context.js';
import { refreshRecordList, escapeHtml } from './js/toolkit/supabase-record-panel.js';
```

These are Sprint 4's shared integration modules. At the time this was first flagged, they lived
only on `sprint-4-shared-integration-pattern` (the original PR #6), which had also accumulated
five unrelated Sprint 5a commits. **Resolved**, in order:

1. PR #6 was closed. A clean branch (`sprint-4-clean`) was cut from the exact original Sprint 4
   commit (`5227b4c`) and opened as **PR #7** — correctly scoped, 14 files, matching PR #6's
   original stated content exactly.
2. All Sprint 5a work (design doc, migrations `012`-`017`, the Project Hub itself) moved to
   `sprint-5a-quotes-progress-claims-hub`, based on the same Sprint 4 commit — carries the
   toolkit dependency, stays out of PR #7 entirely.
3. **Decision confirmed: option 1** (merge PR #7 first, then branch/refresh the Hub work from the
   updated `main`) — matches the "rollback is a simple revert" requirement exactly, since a
   Hub-only PR revert then removes nothing Variation Notice depends on.

**Current blocker: PR #7 itself**, not the dependency question — it needs the live manual
browser check (`docs/PHASE_3_SPRINT_3_MANUAL_TEST_STEPS.md`) before it can merge. That gate is
being watched separately (PR #7 subscribed to activity, periodic re-checks scheduled).

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

## Exact steps once PR #7 merges

1. `git fetch origin main && git checkout sprint-5a-quotes-progress-claims-hub && git rebase origin/main`
   (or merge, whichever leaves a cleaner history — rebase preferred since this branch hasn't been
   built on by anything else yet).
2. Confirm `project-hub.html`'s two imports now resolve against `main`'s actual content (a quick
   local static-server load, or just confirming the two files exist at those paths post-rebase).
3. Open the Hub-only PR (title: "Add Project Hub — single navigation point for a project's
   tools"; body: the four-file list above, linking
   `docs/PHASE_5A_PROJECT_HUB_MANUAL_TEST_STEPS.md`). Draft, not auto-merged.
4. User runs the manual checklist live on the site; reports results; PR merges only after that.
