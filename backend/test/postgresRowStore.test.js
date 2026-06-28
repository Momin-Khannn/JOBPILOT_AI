import test from 'node:test'
import assert from 'node:assert/strict'
import { compareStoreFingerprints, storeFingerprint, validateStoreForRowMigration } from '../src/db/storeIntegrity.js'
import { ROW_STORE_SCHEMA_SQL } from '../src/db/rowStoreSchema.js'

function validStore() {
  return {
    users: [{ id: 'user-1', email: 'user@example.com' }],
    sessions: [{ id: 'session-1', userId: 'user-1', tokenHash: 'hashed' }],
    resumes: [{ id: 'resume-1', userId: 'user-1' }],
    profiles: [{ id: 'profile-1', userId: 'user-1', slug: 'user' }],
    jobs: [{ id: 'job-1', provider: 'manual', externalId: 'job-1' }],
    applications: [{ id: 'application-1', userId: 'user-1' }],
    messages: [{ id: 'message-1', userId: 'user-1', applicationId: 'application-1' }],
    followUps: [{ id: 'follow-up-1', userId: 'user-1', applicationId: 'application-1' }],
    inboxEvents: [{ id: 'inbox-1', userId: 'user-1' }],
    auditLogs: [],
    supportTickets: [],
    analyticsEvents: [],
    jobSyncRuns: [],
    interviewSessions: [{ id: 'interview-1', userId: 'user-1', applicationId: 'application-1' }],
    billingEvents: [],
    dailyUsage: { '2026-06-27': { 'user-1': { gmail: 1 } } },
    integrations: {},
    providerStatus: {},
    portalUpdateState: null,
  }
}

test('row-store preflight accepts consistent data and rejects unsafe references', () => {
  const store = validStore()
  assert.deepEqual(validateStoreForRowMigration(store), { valid: true, issues: [] })

  store.sessions[0].tokenHash = ''
  store.messages[0].userId = 'missing-user'
  store.followUps[0].applicationId = 'missing-application'

  const result = validateStoreForRowMigration(store)
  assert.equal(result.valid, false)
  assert.ok(result.issues.some(issue => issue.type === 'missing_token_hashes'))
  assert.ok(result.issues.some(issue => issue.type === 'orphan_user_references'))
  assert.ok(result.issues.some(issue => issue.type === 'orphan_application_references'))
})

test('row-store comparison ignores collection order but detects content changes', () => {
  const left = validStore()
  const right = structuredClone(left)
  right.users.reverse()
  right.messages.reverse()
  assert.equal(compareStoreFingerprints(storeFingerprint(left), storeFingerprint(right)).equal, true)

  right.users[0].email = 'changed@example.com'
  const comparison = compareStoreFingerprints(storeFingerprint(left), storeFingerprint(right))
  assert.equal(comparison.equal, false)
  assert.equal(comparison.differences[0].key, 'users')
})

test('normalized schema includes identity constraints, indexed sessions, and rollback backups', () => {
  assert.match(ROW_STORE_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS jobpilot_row\.users/)
  assert.match(ROW_STORE_SCHEMA_SQL, /REFERENCES jobpilot_row\.users\(id\) ON DELETE CASCADE/)
  assert.match(ROW_STORE_SCHEMA_SQL, /token_hash TEXT NOT NULL UNIQUE/)
  assert.match(ROW_STORE_SCHEMA_SQL, /snapshot_backups/)
  assert.match(ROW_STORE_SCHEMA_SQL, /LOWER\(email\)/)
})
