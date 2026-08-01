# Local migration dry-run harness

Formalises the disposable-Postgres dry-run process used throughout the Quotes/Progress Claims
review rounds (`docs/PHASE_5A_DESIGN_PROPOSAL.md` §9). **Never touches Supabase** — every run
creates and drops a local, disposable database only.

## Usage

```sh
supabase/local-test/run-local-dry-run.sh                                   # apply-only, no functional tests
supabase/local-test/run-local-dry-run.sh supabase/local-test/functional-tests.sql  # apply + run the suite
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

## When to run this

Before presenting any new or amended migration for review — the standing practice this repo has
followed since `010`/`011`, now scripted instead of reconstructed by hand each round. Extend
`functional-tests.sql` alongside any new migration rather than writing a fresh one-off script.

## Known local-only limitation

Migration `009` revokes the `MAINTAIN` table privilege, present on whatever Postgres version
Supabase's own platform runs. If your local Postgres predates that, `run-local-dry-run.sh`
patches that one line out of a scratch copy of `009` for the local run only — the real migration
file on disk is never modified. Harmless no-op if your local Postgres already supports it.
