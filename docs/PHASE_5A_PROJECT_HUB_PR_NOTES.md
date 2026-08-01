# Project Hub — PR Preparation Notes

**Status:** PR not yet opened — one blocking dependency finding needs a decision first (below).
Once resolved, this becomes a standalone PR into `main`, reviewed live on the site, not merged
automatically.

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

## Blocking dependency finding — needs a decision before the PR can be opened

`project-hub.html` imports two modules that **do not exist on `main`**:

```js
import { gateOnSupabaseProject } from './js/toolkit/supabase-project-context.js';
import { refreshRecordList, escapeHtml } from './js/toolkit/supabase-record-panel.js';
```

Checked directly (`git ls-tree -r origin/main --name-only`): `main` has neither
`js/toolkit/supabase-project-context.js` nor `js/toolkit/supabase-record-panel.js` nor
`css/supabase-tool-panel.css`. These are Sprint 4's shared integration modules — they currently
live only on the still-open, still-draft `sprint-4-shared-integration-pattern` branch (**PR #6**,
confirmed open via the GitHub API just now, `merged: false`), which is exactly the same
"pending manual browser check" PR already tracked on the task list. The Project Hub was built on
top of these modules deliberately (per your own earlier instruction to reuse them, not write
bespoke gating code) — but that means **a PR containing only the four files above, opened against
current `main`, would not run**: the page would fail to load with a module-resolution error the
moment it's opened in a browser.

**This isn't a Quotes/Progress-Claims entanglement** — Sprint 4's modules were built generically,
before either of those tools existed, specifically so future tools (including the Hub) wouldn't
each write their own gating code. But it does mean the Hub genuinely cannot be tested standalone
against `main` as it stands today.

**Three ways to resolve this, none of which I've acted on without your decision:**

1. **Merge PR #6 first, then branch the Hub PR from the updated `main`.** PR #6 is already fully
   unit-tested (32/32 passing) and has no schema/migration dependency at all — it only needs the
   same live manual-browser verification already owed for Variation Notice
   (`docs/PHASE_3_SPRINT_3_MANUAL_TEST_STEPS.md`-equivalent). This keeps the eventual Hub PR
   genuinely minimal and exactly matches your stated requirement that "rollback is a simple revert
   of the Project Hub PR" — reverting a Hub-only PR would not remove infrastructure Variation
   Notice already depends on. **Recommended**, but merging PR #6 is a real action outside what was
   asked this round, so I'm not doing it without confirmation.
2. **Include Sprint 4's two modules (plus `css/supabase-tool-panel.css`) in the Hub PR.** Keeps
   everything in one PR, but then PR #6 and the Hub PR both introduce the same new files —
   whichever merges second will conflict, and a Hub-PR revert would also remove infrastructure
   Variation Notice needs. Not recommended, but possible if you'd rather not sequence two PRs.
3. **Base the Hub PR on the `sprint-4-shared-integration-pattern` branch instead of `main`,** and
   merge that combined branch to `main` as one PR. Simplest mechanically, but reintroduces exactly
   the mixing you asked me to avoid ("Do not include migrations 012/013 or any Quotes/Progress
   Claims work in this PR" — that branch currently carries all of it, even though the *files* are
   separable within it).

I've prepared the Hub-only diff (the four files above, cleanly separable) so whichever option you
choose, opening the actual PR is immediate — no further extraction work needed.

## Confirmations

- **Legacy `project.html` remains untouched.** Not in the diff; confirmed via
  `git diff --stat` against `origin/main` scoped to the four files above only.
- **Existing tools remain untouched.** No file under `js/tools/` appears in the Hub diff.
  `variation-generator.html` is unchanged by this PR (it already depends on the same Sprint 4
  modules, which is exactly why the dependency above needs resolving the same way for both).
- **The hub is additive.** `app-dashboard.html`'s only change is the project card's action link
  (`New Variation Notice` → `Open project`, pointing at the new page); no existing route, id, or
  behaviour is removed or renamed.
- **Rollback is a simple revert** — true for the four files themselves regardless of which
  dependency option is chosen; true in the fullest sense (no shared-infrastructure entanglement)
  only under option 1 above.

## After this is resolved

1. Open the PR (title: "Add Project Hub — single navigation point for a project's tools"; body
   summarising the four files, linking `docs/PHASE_5A_PROJECT_HUB_MANUAL_TEST_STEPS.md`, and
   noting the dependency on PR #6 if sequenced that way).
2. **Not merged automatically** — you test on the live site via the manual checklist once it's
   open, and report results before it merges.
