# Release v0.2.0-sprint2 — Sprint 2 Production Baseline

**Release date:** 2026-07-31
**Commit SHA:** `c128001e3709178e6acd79a62131a1a79e59a424`
**Tag:** `v0.2.0-sprint2` (annotated, created locally — push blocked by this session's git proxy, see "Known limitations")
**Related PR:** None — Sprint 2 was merged directly to `main` via a fast-forward (`6d58636..c128001`), not via a pull request. (`PR #5` is Sprint 3 frontend work and is unrelated to this release; left in Draft, not merged.)
**Live project:** `hpcqncghvdrlvufxfdnd`
**Owner:** BIK Solutions Pty Ltd

---

## Major features delivered

- **`public.variation_notices`** — a dedicated, strongly typed table (not a generic documents table, per ADR-016) backing the Variation Notices pilot: the first tool moved onto the authenticated, RLS-scoped project model. Money stored as integer cents with `GENERATED ALWAYS AS STORED` GST/total columns; `variation_number` uniqueness scoped per-project; `issued_snapshot` captured by a dedicated trigger only on the transition to `issued`, never on an ordinary draft edit.
- **Concurrency-safe, canonical variation numbering** — `internal.variation_number_counters` plus an atomic `INSERT ... ON CONFLICT DO UPDATE` trigger generate collision-free, canonical `VAR-001`, `VAR-002`, ..., `VAR-999`, `VAR-1000` references. No client-side number generation is possible: the only supported entry point, `public.create_variation_notice()`, allocates the number, validates the caller and project, and inserts the row as a single atomic transaction.
- **Manual-reference normalisation** — a manually entered standard-equivalent reference (bare digits, `"var-010"`, `"VAR 010"`, `"VAR-010"`) is normalised to the one canonical string before storage; a genuinely custom reference (e.g. `"CLIENT-VO-10"`) is kept exactly as entered. Two semantically equivalent standard references cannot coexist in the same project.

## Database migrations included

| Migration | Purpose |
|---|---|
| `010_create_variation_notices.sql` | The `variation_notices` table, RLS, grants, cross-tenant integrity trigger, `issued_snapshot` capture trigger. |
| `011_variation_notice_number_generator.sql` | `internal.variation_number_counters`, the counter-decrease guard, `internal.format_variation_number()` / `internal.normalize_variation_number()`, the `assign_variation_notice_number()` trigger, and the `public.create_variation_notice()` RPC. |

Both applied live to `hpcqncghvdrlvufxfdnd` and confirmed present via `list_migrations` as part of this release check.

## Security changes

- `public.create_variation_notice()`: `SECURITY INVOKER`, fixed `search_path = ''`. `REVOKE ALL FROM public, anon`; `EXECUTE` granted only to `authenticated`.
- `internal.normalize_variation_number()`: the one `internal.*` helper `authenticated` is granted `EXECUTE` on (needed so the RPC can report a collision against the canonical value); every other `internal.*` object in this release has zero grants to `anon`/`authenticated`.
- `internal.variation_number_counters`: RLS enabled, zero policies, zero table grants of any kind for any client role — reachable only through the `SECURITY DEFINER` trigger.
- A real bug was caught and fixed during review, before ever reaching production: `lpad()` truncates rather than passing a value through once it's wider than the target width, which would have silently corrupted a project's 1000th variation number (`"1000"` → `"100"`, colliding with the real `"100"`). Fixed with an explicit width check; re-verified live.

## Verification summary

- **Live catalog checks (this release):** all five functions/objects present; `search_path = ''` fixed on all four functions that need it; `authenticated`/`anon` grants exactly as designed (confirmed via `has_function_privilege`); RLS enabled with zero policies on the counters table; both triggers present and enabled; zero client-role grants on the counters table. No schema drift from the previously-verified state.
- **Live data integrity (this release):** row counts across `organisations`/`profiles`/`projects`/`variation_notices`/`variation_number_counters`/`auth.users` are identical to the pre-existing baseline — the one real production organisation/profile/project is untouched, and no disposable test data was left behind by any earlier verification round.
- **Functional live verification (prior rounds, both migrations):** canonical numbering (`VAR-001` → `VAR-1000`), manual-entry normalisation and collision rejection, cross-organisation rejection, counter non-decrease, project-deletion cascade cleanup of the counter row, and the RPC's bounded retry catching only the variation-number uniqueness conflict (never concealing an unrelated constraint failure) — all confirmed live with disposable data, fully cleaned up afterward. Full detail: `docs/PHASE_3_VARIATION_NOTICES_SCHEMA.md`.
- **Concurrency:** proven locally with a genuine overlapping-transaction test (not just sequential calls) — a transaction holding the counter row for 5 seconds correctly blocked a second, concurrently-started transaction for the full duration before it received the next, non-colliding number. Not re-proven live in this release check: the tooling used for live verification cannot hold a transaction open across separate calls the way a local session can; the guarantee rests on the identical, already-proven code now running live, not on an unproven assumption.
- **Deployment:** GitHub Pages' `pages-build-deployment` workflow completed successfully for commit `c128001` (run `30612515607`, conclusion `success`). This commit changed only documentation and SQL migration files — zero `.html`/`.css`/`.js` files — so the live frontend is byte-for-byte identical to before this release; there is no code path by which this release could have introduced a console error, missing asset, or broken existing functionality.

## Known limitations

- A direct HTTP fetch of the live site (`biksolutions.com.au`) could not be performed from this session — the sandbox's outbound web-fetch is blocked broadly (confirmed by testing an unrelated, always-reachable URL, which also returned 403). This is the same documented limitation as `docs/PHASE_2_FRONTEND_TEST_CHECKLIST.md`, not a production issue. Site health for this release is established via the successful deploy-workflow run plus the fact that no frontend file changed, not via a direct page load in this session.
- The `v0.2.0-sprint2` git tag was created locally but could not be pushed — the session's git proxy returned an HTTP 403 on `git push origin v0.2.0-sprint2` (the same limitation previously hit for `v0.1.0`). Push it manually: `git push origin v0.2.0-sprint2`.
- One pre-existing, low-severity advisory finding, not introduced or worsened by this release: `internal.prevent_variation_number_counter_decrease()` does not set `search_path = ''`. Not exploitable — the function references nothing unqualified — but inconsistent with this migration's own stated convention of setting it everywhere. Flagged as a candidate for a small follow-up migration, not applied in this release.

## Deferred to Sprint 3

- Frontend integration of the Variation Generator (`variation-generator.html`) with `public.create_variation_notice()` — implemented on branch `sprint-3-variation-notice-frontend`, draft PR `#5`, **not merged**. Requires the manual browser test checklist (`docs/PHASE_3_SPRINT_3_MANUAL_TEST_STEPS.md`) to run and pass against the live project before merge.
- Dropping the now-redundant `builderName`/`builderABN`/etc. fields from the Variation Notice form in favour of sourcing them from the organisation join — explicitly out of scope for Sprint 3, deferred further.
- The short integration playbook for Batch 1 tools (quote-builder, progress-claim, payment-reminder, subcontractor-agreement, contract-termination), to be written once the Variation Generator pattern is fully proven end-to-end.
