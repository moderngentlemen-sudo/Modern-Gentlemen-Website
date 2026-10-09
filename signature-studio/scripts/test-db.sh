#!/usr/bin/env bash
# Tests the Supabase migrations on a throwaway local Postgres:
#  1. applies every migration twice (they must be re-runnable),
#  2. runs the row-level security tests in supabase/tests/rls.sql.
# Needs Postgres server binaries (pg_ctl, initdb) on PATH or in /usr/lib/postgresql/*/bin.
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(dirname "$(command -v pg_ctl 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")
DIR=$(mktemp -d)
PORT=${PGTEST_PORT:-55439}
trap '"$BIN/pg_ctl" -D "$DIR/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
if [ "$(id -u)" = 0 ]; then RUN="runuser -u postgres --"; chown postgres "$DIR"; else RUN=""; fi
$RUN "$BIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
$RUN "$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" start >/dev/null
PSQL="env PGOPTIONS=-cclient_min_messages=warning psql -h $DIR -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
$PSQL -f supabase/tests/supabase-stub.sql
for pass in 1 2; do
  for f in supabase/migrations/*.sql; do $PSQL -f "$f"; done
done
echo "Migrations applied twice"
$PSQL -f supabase/tests/rls.sql
