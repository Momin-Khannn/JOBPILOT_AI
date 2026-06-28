if (process.env.DATABASE_PUBLIC_URL) process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL or DATABASE_PUBLIC_URL is required')
}

const { backfillPostgresRowStore } = await import('../backend/src/db/store.js')

try {
  const result = await backfillPostgresRowStore()
  const output = {
    backupId: result.backup.id,
    sourceVersion: Number(result.backup.source_version),
    valid: result.validation.valid,
    equal: result.comparison.equal,
    differences: result.comparison.differences,
    counts: Object.fromEntries(
      Object.entries(result.comparison.rowStore.collections).map(([key, value]) => [key, value.count]),
    ),
  }
  console.log(JSON.stringify(output, null, 2))
  if (!result.comparison.equal) process.exitCode = 2
} catch (error) {
  console.error(JSON.stringify({
    error: error.message,
    validation: error.validation || null,
  }, null, 2))
  process.exitCode = 1
}
