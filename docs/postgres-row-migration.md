# PostgreSQL Row Store

## Production Status

JobPilot production uses normalized tables in the `jobpilot_row` PostgreSQL schema. The legacy `public.jobpilot_state` JSONB snapshot remains synchronized as a rollback source for one stable release.

Current rollout flags:

```env
POSTGRES_ROW_STORE_PREPARE=true
POSTGRES_ROW_STORE_DUAL_WRITE=true
POSTGRES_ROW_STORE_ENABLED=true
```

The health endpoint must report `"persistence":"postgresql-row-store"`.

## Data Model

The schema contains separate tables for users, sessions, resumes, profiles, jobs, applications, messages, follow-ups, inbox events, integrations, audit logs, support tickets, analytics events, job sync runs, interview sessions, billing events, daily usage, and metadata.

User-owned rows have foreign keys with explicit delete behavior. Emails, session hashes, profile slugs, provider job IDs, statuses, timestamps, and common relationship fields are indexed.

## Verification

Run these commands from the repository root with the Railway project linked:

```powershell
railway run --service Postgres --environment production -- npm run db:rows:verify
```

The command compares stable content hashes and counts for every collection and exits non-zero if anything differs.

To verify indexed authentication with a temporary session that is automatically deleted:

```powershell
$dbVariables = railway variables --service Postgres --environment production --json | ConvertFrom-Json
$env:DATABASE_PUBLIC_URL = $dbVariables.DATABASE_PUBLIC_URL
try {
  railway run --service jobpilot-web --environment production -- npm run db:rows:verify-auth
} finally {
  Remove-Item Env:DATABASE_PUBLIC_URL -ErrorAction SilentlyContinue
}
```

## Backfill

The backfill locks the snapshot row, validates references and uniqueness, creates a database-resident backup, writes normalized rows transactionally, and verifies hashes before committing:

```powershell
railway run --service Postgres --environment production -- npm run db:rows:migrate
```

The production cutover backup is `row-store-migration-2026-06-27T18-02-00-541Z-cc2f79d3` from snapshot version `474`.

## Rollback

For an application-level rollback, switch reads and primary writes back to the current mirrored snapshot:

```powershell
railway variable set --service jobpilot-web --environment production POSTGRES_ROW_STORE_ENABLED=false
```

Keep `POSTGRES_ROW_STORE_DUAL_WRITE=true` so normalized rows continue receiving changes while the issue is investigated. Verify `/api/health` reports `postgresql-snapshot` and run the deployment smoke suite.

Do not restore an old backup during a normal flag rollback. The mirrored snapshot is current. Restoring a backup intentionally discards all changes made after that backup and should only happen during a controlled maintenance window after writes are stopped:

```powershell
$env:CONFIRM_ROW_STORE_RESTORE = 'true'
railway run --service Postgres --environment production -- npm run db:rows:restore -- <backup-id>
Remove-Item Env:CONFIRM_ROW_STORE_RESTORE
```

## Snapshot Retirement

Keep snapshot mirroring enabled through at least one stable production release. Before removing it:

1. Review error rate, query latency, connection-pool saturation, and lock waits.
2. Run the row-store comparison again.
3. Perform a backup and restore drill in a non-production database.
4. Disable dual writes while retaining the snapshot table read-only.
5. Remove snapshot code and data only in a later release.
