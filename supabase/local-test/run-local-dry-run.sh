#!/usr/bin/env bash
# ============================================================================
# Local dry-run harness for supabase/migrations/*.sql.
#
# Applies every migration in order to a disposable local Postgres database
# (never Supabase — this never touches a live project), then optionally
# runs a functional test script against the result. This formalises the
# ad-hoc process used throughout Sprint 5a's review rounds so it doesn't
# need reconstructing by hand each time.
#
# Requirements: a local `psql` client and a reachable Postgres server
# (tested against Postgres 16). Needs a role that can CREATE DATABASE and
# CREATE ROLE — typically the `postgres` superuser.
#
# Usage:
#   supabase/local-test/run-local-dry-run.sh [functional-test-file.sql]
#
# Example (this repo's own functional test suite):
#   supabase/local-test/run-local-dry-run.sh supabase/local-test/functional-tests.sql
#
# Environment overrides:
#   PG_SUPERUSER   defaults to "postgres"
#   PG_DB          defaults to "bik_migration_test"
#   PSQL_RUNNER    defaults to "sudo -u postgres psql" — override for
#                  environments where the Postgres superuser is reached
#                  differently (e.g. just "psql" if already connected as
#                  postgres, or a docker exec wrapper).
#
# KNOWN LOCAL-ONLY LIMITATION: migration 009 revokes the MAINTAIN privilege,
# which was added to Postgres in a version newer than some local dev
# environments may have (this repo targets whatever Supabase's own Postgres
# version provides). This script patches that one line out of a scratch
# copy of 009 for the local run only — the real migration file is never
# modified. If your local Postgres already supports MAINTAIN, this is a
# harmless no-op.
# ============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
AUTH_STUB="$REPO_ROOT/supabase/local-test/auth-stub.sql"

PG_SUPERUSER="${PG_SUPERUSER:-postgres}"
PG_DB="${PG_DB:-bik_migration_test}"
PSQL_RUNNER="${PSQL_RUNNER:-sudo -u postgres psql}"

SCRATCH_DIR="$(mktemp -d)"
trap 'rm -rf "$SCRATCH_DIR"' EXIT
# mktemp -d defaults to 700 — the PSQL_RUNNER may run as a different OS
# user (e.g. `sudo -u postgres`) that needs to traverse into this
# directory to read the files copied into it below.
chmod 755 "$SCRATCH_DIR"

echo "== Preparing disposable database: $PG_DB =="
$PSQL_RUNNER -c "DROP DATABASE IF EXISTS $PG_DB;"
$PSQL_RUNNER -c "CREATE DATABASE $PG_DB;"

echo "== Applying auth stub =="
cp "$AUTH_STUB" "$SCRATCH_DIR/000_auth_stub.sql"
chmod 644 "$SCRATCH_DIR/000_auth_stub.sql"
$PSQL_RUNNER -d "$PG_DB" -v ON_ERROR_STOP=1 -f "$SCRATCH_DIR/000_auth_stub.sql"

echo "== Copying migrations to a scratch dir (readable by the psql runner) =="
cp "$MIGRATIONS_DIR"/*.sql "$SCRATCH_DIR/"
chmod 644 "$SCRATCH_DIR"/*.sql

if grep -q "revoke maintain, references, trigger, truncate" "$SCRATCH_DIR/009_revoke_dangerous_table_privileges.sql" 2>/dev/null; then
  echo "   (patching 009's MAINTAIN revoke for local Postgres compatibility — see script header)"
  sed -i 's/revoke maintain, references, trigger, truncate/revoke references, trigger, truncate/g' \
    "$SCRATCH_DIR/009_revoke_dangerous_table_privileges.sql"
fi

echo "== Applying migrations in order =="
for f in "$SCRATCH_DIR"/[0-9][0-9][0-9]_*.sql; do
  name="$(basename "$f")"
  echo "   -> $name"
  $PSQL_RUNNER -d "$PG_DB" -v ON_ERROR_STOP=1 -f "$f"
done

echo "== Granting the local auth stub's schema/function access =="
$PSQL_RUNNER -d "$PG_DB" -c \
  "grant usage on schema auth to anon, authenticated, service_role; grant execute on function auth.uid() to anon, authenticated, service_role;"

echo "== All migrations applied cleanly =="

if [ "${1:-}" != "" ]; then
  TEST_FILE="$1"
  echo "== Running functional tests: $TEST_FILE =="
  cp "$TEST_FILE" "$SCRATCH_DIR/functional-tests.sql"
  chmod 644 "$SCRATCH_DIR/functional-tests.sql"
  $PSQL_RUNNER -d "$PG_DB" -f "$SCRATCH_DIR/functional-tests.sql"
  echo "== Functional tests completed =="
fi

echo
echo "Disposable database '$PG_DB' left in place for inspection."
echo "Drop it manually when done: $PSQL_RUNNER -c \"DROP DATABASE $PG_DB;\""
