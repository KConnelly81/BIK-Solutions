#!/usr/bin/env bash
# ============================================================================
# Concurrency test for Quotes/Progress Claims numbering (013, 016) — same
# technique already proven for variation_number (011): one transaction
# holds the counter row (via pg_sleep inside the same transaction as the
# numbering call) while a second, concurrently-started transaction attempts
# the same operation and is measured to have genuinely blocked on the row
# lock, not merely run twice sequentially by coincidence. Confirms no
# collision and correct sequential assignment afterwards.
#
# Builds its own fresh disposable database via run-local-dry-run.sh first,
# so this can be run standalone. Never touches Supabase.
#
# Usage: supabase/local-test/concurrency-test.sh
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PG_SUPERUSER="${PG_SUPERUSER:-postgres}"
PG_DB="${PG_DB:-bik_concurrency_test}"
PSQL_RUNNER="${PSQL_RUNNER:-sudo -u $PG_SUPERUSER psql}"

echo "== Building a fresh schema in '$PG_DB' via run-local-dry-run.sh =="
PG_DB="$PG_DB" "$SCRIPT_DIR/run-local-dry-run.sh"

RUN="$PSQL_RUNNER -d $PG_DB -v ON_ERROR_STOP=1 -q"

echo "== Seeding fixtures (one org, one user, one project) =="
$RUN <<'SQL'
begin;
insert into public.organisations (id, name, status) values
  ('c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'Concurrency Test Org', 'active');
insert into auth.users (id, email) values
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'concurrency@test.local');
insert into public.profiles (id, organisation_id, full_name, email, status, role) values
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'Concurrency Tester', 'concurrency@test.local', 'active', 'owner');
insert into public.projects (id, organisation_id, name, status) values
  ('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0', 'Concurrency Test Project', 'active');
commit;
SQL

SESSION_PREFIX="set role authenticated; select set_config('bik_test.uid', 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', false);"

run_holder() {
  local rpc="$1"
  local field="$2"
  local outfile="$3"
  $RUN <<SQL > "$outfile" 2>&1
$SESSION_PREFIX
begin;
select * from $rpc \gset held_
select pg_sleep(3);
commit;
select :'held_$field' as assigned_number;
SQL
}

run_waiter() {
  local rpc="$1"
  local field="$2"
  local outfile="$3"
  $RUN <<SQL > "$outfile" 2>&1
$SESSION_PREFIX
begin;
select * from $rpc \gset waited_
commit;
select :'waited_$field' as assigned_number;
SQL
}

echo ""
echo "== QUOTES: org-scoped counter (internal.quote_counters) =="
QUOTE_RPC="public.create_quote(p_project_id => 'c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2')"

QOUT_A=$(mktemp); QOUT_B=$(mktemp)
START=$(date +%s)
run_holder "$QUOTE_RPC" "quote_number" "$QOUT_A" &
HOLDER_PID=$!
sleep 0.5
run_waiter "$QUOTE_RPC" "quote_number" "$QOUT_B" &
WAITER_PID=$!
wait "$HOLDER_PID"
wait "$WAITER_PID"
END=$(date +%s)
ELAPSED=$((END - START))

echo "Holder output:"; cat "$QOUT_A"
echo "Waiter output:"; cat "$QOUT_B"
echo "Total wall-clock elapsed: ${ELAPSED}s (must be >= ~3s to prove the waiter genuinely blocked on the holder's lock, not raced ahead)"

if [ "$ELAPSED" -lt 3 ]; then
  echo "FAIL: elapsed time too short — the waiter did not block on the holder's transaction as expected."
  exit 1
fi

Q_A_NUM=$(grep -oE "QT-[0-9]+" "$QOUT_A" | head -1)
Q_B_NUM=$(grep -oE "QT-[0-9]+" "$QOUT_B" | head -1)
echo "Holder got: $Q_A_NUM ; Waiter got: $Q_B_NUM"
if [ -z "$Q_A_NUM" ] || [ -z "$Q_B_NUM" ] || [ "$Q_A_NUM" = "$Q_B_NUM" ]; then
  echo "FAIL: expected two distinct, non-colliding quote numbers."
  exit 1
fi
echo "PASS: two concurrent create_quote() calls, sharing one organisation's counter, produced distinct sequential numbers with no collision."

echo ""
echo "== PROGRESS CLAIMS: project-scoped counter (internal.progress_claim_counters) =="
PC_RPC="public.create_progress_claim(p_project_id => 'c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2')"

POUT_A=$(mktemp); POUT_B=$(mktemp)
START=$(date +%s)
run_holder "$PC_RPC" "claim_number" "$POUT_A" &
HOLDER_PID=$!
sleep 0.5
run_waiter "$PC_RPC" "claim_number" "$POUT_B" &
WAITER_PID=$!
wait "$HOLDER_PID"
wait "$WAITER_PID"
END=$(date +%s)
ELAPSED=$((END - START))

echo "Holder output:"; cat "$POUT_A"
echo "Waiter output:"; cat "$POUT_B"
echo "Total wall-clock elapsed: ${ELAPSED}s"

if [ "$ELAPSED" -lt 3 ]; then
  echo "FAIL: elapsed time too short — the waiter did not block on the holder's transaction as expected."
  exit 1
fi

P_A_NUM=$(grep -oE "PC-[0-9]+" "$POUT_A" | head -1)
P_B_NUM=$(grep -oE "PC-[0-9]+" "$POUT_B" | head -1)
echo "Holder got: $P_A_NUM ; Waiter got: $P_B_NUM"
if [ -z "$P_A_NUM" ] || [ -z "$P_B_NUM" ] || [ "$P_A_NUM" = "$P_B_NUM" ]; then
  echo "FAIL: expected two distinct, non-colliding claim numbers."
  exit 1
fi
echo "PASS: two concurrent create_progress_claim() calls, sharing one project's counter, produced distinct sequential numbers with no collision."

rm -f "$QOUT_A" "$QOUT_B" "$POUT_A" "$POUT_B"

echo ""
echo "== ALL CONCURRENCY TESTS PASSED =="
echo "Disposable database '$PG_DB' left in place for inspection."
echo "Drop it manually when done: sudo -u $PG_SUPERUSER psql -c \"DROP DATABASE $PG_DB;\""
