import '../src/env.js'

const postgresUrl = process.env.DATABASE_URL
if (!postgresUrl) throw new Error('DATABASE_URL is required for the PostgreSQL migration.')

delete process.env.DATABASE_URL
const storeModule = await import('../src/db/store.js')
const snapshot = await storeModule.readStore()

process.env.DATABASE_URL = postgresUrl
await storeModule.ensureStore()
await storeModule.writeStore(snapshot)

console.log(JSON.stringify({
  migrated: true,
  users: snapshot.users?.length || 0,
  resumes: snapshot.resumes?.length || 0,
  applications: snapshot.applications?.length || 0,
  jobs: snapshot.jobs?.length || 0,
}))
