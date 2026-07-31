# Release v0.3.0-sprint3 — Variation Generator Frontend Integration

**Release date:** 2026-07-31
**Merge commit SHA:** `9bc1583dba897ed2d2f05305c698180aa443446a`
**PR:** [#5](https://github.com/KConnelly81/BIK-Solutions/pull/5), merged via merge commit
**Tag:** `v0.3.0-sprint3` (annotated, created locally — push blocked by this session's git proxy, see "Known limitations")
**Live project:** `hpcqncghvdrlvufxfdnd`
**Owner:** BIK Solutions Pty Ltd

---

## Features delivered

- **Variation Generator wired to the live backend.** `variation-generator.html` now saves real, authenticated, organisation-scoped Variation Notices via `public.create_variation_notice()` — the only backend entry point used; no direct access to `internal.variation_number_counters` or any other `internal.*` object.
- **Database-authoritative numbering, end to end.** The client never generates, predicts, or reformats a variation number. Leaving the field blank asks the database to auto-assign the next canonical `VAR-NNN`; a typed value is sent through exactly as entered and the database decides whether to normalise it or keep it custom. The form is updated with the authoritative saved value only after a successful save.
- **Safe re-save.** A second "Save to project" click in the same session performs a plain authenticated `UPDATE` on the already-created row rather than calling the RPC again — there is no reassignment-on-`UPDATE` path in the backend, and this does not add one.
- **Session- and project-gated**, the same no-flash pattern as `app-dashboard.html`. Entered via a new "New Variation Notice" link on each project card there — the tool is always opened with real project context, never a freeform pick.
- **Variations-for-this-project list**, with a running total, refreshed after every save.
- **Safe error handling.** All raw database/auth errors are translated to plain-language, non-leaking text; an unrecognised error is never shown to the user verbatim, only logged to the console.

## Database changes

None. This release is frontend-only — zero migration files, zero schema/RLS/grant/trigger changes. The backend (migrations 010/011) shipped in the prior release, `v0.2.0-sprint2`.

## Security changes

- No new backend surface. The frontend uses exactly the grants already approved for `authenticated` in `v0.2.0-sprint2`: `EXECUTE` on `create_variation_notice()`, and ordinary `SELECT`/`UPDATE` on `variation_notices` (already granted since migration 010).
- One shared-code change, reviewed for regression risk: `ToolController` gained an opt-in `disableLegacyProjectUI` flag (default off). It exists so this tool's real, Supabase-backed project context doesn't collide with the pre-existing localStorage `ProjectUI`, which reads the same `?project=` URL param for an unrelated, local-only concept. Confirmed unset on every other tool (~20), zero behavioural change to them.

## Verification summary

- **Code review (this release):** no debug/temp code, no dead code (the old client-side counter was fully removed, not left dangling), no unnecessary complexity, no regression to the other tools sharing `ToolController` (confirmed via grep that the new opt-in flag is unset everywhere else). One legitimate maintainability observation, not a blocker: `buildRpcParams()`/`buildUpdatePayload()` share a lot of parallel field-mapping structure — logged to the maintenance backlog, not fixed in this release.
- **Automated tests:** 32/32 passing (`node --test js/tools/variation-notice/__tests__/variation-save-logic.test.js`), re-run fresh from the actual merged branch content via a disposable git worktree, not just the working copy.
- **Manual browser test checklist** (`docs/PHASE_3_SPRINT_3_MANUAL_TEST_STEPS.md`): run against the live Supabase project and passed, covering entry point/gating, cross-tenant isolation, automatic numbering, manual entry normalisation and duplicate rejection, validation and duplicate-submit prevention, the one-time client/project snapshot, and confirming PDF/Copy/Email/AI Writer/History are unaffected.
- **Merge:** trial-merged against the current `main` before the real merge to confirm no conflicts (main had moved by two docs-only commits since the PR was opened); the real merge via GitHub's merge API succeeded cleanly.
- **Deployment:** GitHub Pages' `pages-build-deployment` workflow completed successfully for the merge commit `9bc1583` (conclusion: `success`).
- **Post-merge backend check:** row counts across `organisations`/`profiles`/`projects`/`variation_notices` unchanged from pre-merge — expected and confirmed, since this release touches zero database files.

## Known limitations

- Direct HTTP verification of the live site was not performed in this session — outbound web-fetch is broadly blocked in this sandbox (same documented limitation as `docs/PHASE_2_FRONTEND_TEST_CHECKLIST.md` and the Sprint 2 release). Site health is established via the successful GitHub Actions deploy run, not a direct page load in this session.
- The `v0.3.0-sprint3` git tag was created locally but could not be pushed — the session's git proxy returned an HTTP 403, the same limitation hit for `v0.1.0` and `v0.2.0-sprint2`. Push it manually: `git push origin v0.3.0-sprint3`.
- The feature branch `sprint-3-variation-notice-frontend` could not be deleted from this session — no `delete_branch` tool is available for GitHub in this session's toolset, and `git push origin --delete` hits the same proxy 403. Delete it manually (GitHub's "Delete branch" button on the merged PR, or `git push origin --delete sprint-3-variation-notice-frontend`). The already-merged `feature/phase-3-documents-schema` branch (from Sprint 2) is also still present remotely and can be cleaned up at the same time.
- `buildRpcParams()`/`buildUpdatePayload()` in `variation-save-logic.js` share substantial parallel field-mapping structure. Low risk (both are simple, tested, 1:1 field reads with no observed divergence) but worth a small future refactor — added to the maintenance backlog (Phase 3 of this review).

## Deferred to future sprints

- Dropping the now-redundant `builderName`/`builderABN`/etc. fields from the Variation Notice form in favour of sourcing them from the organisation join — explicitly out of scope for Sprint 3, still deferred.
- The `internal.prevent_variation_number_counter_decrease()` `search_path` follow-up confirmed in `docs/RELEASE_v0.2.0_SPRINT2.md` — due as the first commit after this release, or a tiny standalone maintenance PR.
- The short integration playbook for Batch 1 tools (quote-builder, progress-claim, payment-reminder, subcontractor-agreement, contract-termination), now that the Variation Generator pattern is fully proven end-to-end.
