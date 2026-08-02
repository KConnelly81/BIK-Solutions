# Local migration dry-run harness

Formalises the disposable-Postgres dry-run process used throughout the Quotes/Progress Claims
review rounds (`docs/PHASE_5A_DESIGN_PROPOSAL.md` §9). **Never touches Supabase** — every run
creates and drops a local, disposable database only.

## Usage

```sh
supabase/local-test/run-local-dry-run.sh                                   # apply-only, no functional tests
supabase/local-test/run-local-dry-run.sh supabase/local-test/functional-tests.sql  # apply + run the suite
supabase/local-test/concurrency-test.sh                                    # genuine concurrent-transaction numbering test (own disposable DB)
```

Requires a local `psql` client and a reachable Postgres server (verified against Postgres 16) with
a role that can `CREATE DATABASE`/`CREATE ROLE`. Override `PG_SUPERUSER`, `PG_DB`, or
`PSQL_RUNNER` as environment variables if your local setup differs from the default
`sudo -u postgres psql`.

## Files

- **`auth-stub.sql`** — minimal local stand-in for the parts of the platform Supabase itself
  provides (`auth.users`, `auth.uid()`, the `anon`/`authenticated`/`service_role` roles). Not a
  faithful reproduction of Supabase Auth; exists only so this repo's migrations have something to
  reference locally.
- **`functional-tests.sql`** — the consolidated test suite for `012`-`017` (Quotes, Progress
  Claims): calculation-ownership tamper resistance, the full issue-requirement chain in order,
  post-issue immutability, the permission-boundary re-test (direct `UPDATE` vs. RPC-only
  issuing), the interim overclaiming guard, the Progress Claims temporary issuing gate, numbering
  and manual-override normalisation, and cross-organisation isolation.
- **`run-local-dry-run.sh`** — applies every migration in `supabase/migrations/` in order to a
  disposable database, then optionally runs a functional test file against the result.
- **`concurrency-test.sh`** — genuine concurrent-transaction test for the Quotes/Progress Claims
  numbering counters (`internal.quote_counters`, org-scoped; `internal.progress_claim_counters`,
  project-scoped): one transaction holds its counter row open via `pg_sleep(3)` while a second,
  concurrently-started transaction attempts the same `create_quote()`/`create_progress_claim()`
  call, and the test asserts the second genuinely blocked (measured wall-clock ≥3s, not a
  coincidental sequential run) before receiving the next, non-colliding number. Same technique
  already proven for `variation_number` (`011`) at Sprint 3. Builds its own fresh disposable
  database via `run-local-dry-run.sh` first, so it can be run standalone.

## When to run this

Before presenting any new or amended migration for review — the standing practice this repo has
followed since `010`/`011`, now scripted instead of reconstructed by hand each round. Extend
`functional-tests.sql` alongside any new migration rather than writing a fresh one-off script. Run
`concurrency-test.sh` too whenever a migration adds or changes a counter-based numbering scheme —
sequential-call coverage in `functional-tests.sql` does not exercise the actual row-lock contention
a real concurrent save can hit.

## Known local-only limitation

Migration `009` revokes the `MAINTAIN` table privilege, present on whatever Postgres version
Supabase's own platform runs. If your local Postgres predates that, `run-local-dry-run.sh`
patches that one line out of a scratch copy of `009` for the local run only — the real migration
file on disk is never modified. Harmless no-op if your local Postgres already supports it.
