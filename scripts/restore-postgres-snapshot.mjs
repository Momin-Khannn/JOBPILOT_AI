if (process.env.DATABASE_PUBLIC_URL) process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL or DATABASE_PUBLIC_URL is required')
}
if (process.env.CONFIRM_ROW_STORE_RESTORE !== 'true') {
  throw new Error('Set CONFIRM_ROW_STORE_RESTORE=true to confirm this destructive restore')
}

const backupId = process.argv[2]
if (!backupId) throw new Error('Pass the snapshot backup ID as the first argument')

const { restorePostgresSnapshot } = await import('../backend/src/db/store.js')
const restored = await restorePostgresSnapshot(backupId)
console.log(JSON.stringify({ restored: true, backupId, version: Number(restored.version) }, null, 2))
