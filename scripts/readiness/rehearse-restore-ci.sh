#!/usr/bin/env bash
set -euo pipefail
# Only the disposable container and known synthetic database are permitted.
test "${ORKTO_MIGRATION_TARGET:-}" = ci
test "${PGDATABASE:-}" = orkto_migration_ci
test "${PGHOST:-}" = 127.0.0.1
container="$1"
evidence="$ORKTO_MIGRATION_EVIDENCE_DIR/restore"
mkdir -p "$evidence"
began="$(date +%s)"
counts="select schemaname,relname,n_live_tup from pg_stat_user_tables order by 1,2;"
# Exact counts rather than estimates. Capture no customer content.
inventory="select format('select %L as table_name, count(*) from %I.%I;', table_schema||'.'||table_name,table_schema,table_name) from information_schema.tables where table_schema in ('public','auth') and table_type='BASE TABLE' order by 1;"
psql --no-psqlrc -Atc "$inventory" > "$evidence/counts.sql"
psql --no-psqlrc -Atf "$evidence/counts.sql" > "$evidence/source-counts.txt"
docker exec "$container" pg_dump -U postgres -d orkto_migration_ci --format=custom > "$evidence/disposable-backup.dump"
test -s "$evidence/disposable-backup.dump"
sha256sum "$evidence/disposable-backup.dump" > "$evidence/backup.sha256"
docker exec "$container" createdb -U postgres orkto_restore_rehearsal
docker exec -i "$container" pg_restore -U postgres -d orkto_restore_rehearsal --exit-on-error < "$evidence/disposable-backup.dump"
PGDATABASE=orkto_restore_rehearsal psql --no-psqlrc -Atf "$evidence/counts.sql" > "$evidence/restored-counts.txt"
diff -u "$evidence/source-counts.txt" "$evidence/restored-counts.txt"
PGDATABASE=orkto_restore_rehearsal psql --no-psqlrc --set=ON_ERROR_STOP=1 --file supabase/tests/assert_restored_integrity.sql > "$evidence/restored-security.txt"
PGDATABASE=orkto_restore_rehearsal psql --no-psqlrc --set=ON_ERROR_STOP=1 --file supabase/tests/assert_commercial_billing.sql > "$evidence/restored-billing.txt"
printf '{"scope":"disposable_synthetic_postgresql17","status":"PASS","rpoSnapshotRowsLost":0,"restoreSeconds":%s,"managedStagingRestore":"NOT_TESTED","production":"UNTOUCHED"}\n' "$(( $(date +%s) - began ))" > "$evidence/result.json"
# Dump contains synthetic fixtures only; artifact includes checksum/counts/result, not the dump.
rm -- "$evidence/disposable-backup.dump"
