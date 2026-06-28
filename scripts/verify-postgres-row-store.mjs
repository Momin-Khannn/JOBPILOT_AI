if (process.env.DATABASE_PUBLIC_URL) process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL or DATABASE_PUBLIC_URL is required')
}

const { comparePostgresStores } = await import('../backend/src/db/store.js')

const comparison = await comparePostgresStores()
console.log(JSON.stringify({
  equal: comparison.equal,
  differences: comparison.differences,
  counts: Object.fromEntries(
    Object.entries(comparison.rowStore.collections).map(([key, value]) => [key, value.count]),
  ),
}, null, 2))

if (!comparison.equal) process.exitCode = 2
