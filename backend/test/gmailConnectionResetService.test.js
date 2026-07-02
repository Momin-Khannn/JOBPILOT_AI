import test from 'node:test'
import assert from 'node:assert/strict'
import { gmailConnectionResetPlan, resetGmailConnections } from '../src/services/gmailConnectionResetService.js'

function fixture() {
  return {
    users: [
      { id: 'owner', role: 'owner', integrations: { gmail: { connected: true, connectedEmail: 'old@example.com', encryptedTokens: 'encrypted' } } },
      { id: 'client', role: 'client', integrations: { gmail: { connected: false, connectedEmail: null, encryptedTokens: null } } },
    ],
    auditLogs: [],
  }
}

test('Gmail reset plan reports affected integrations without exposing identities', () => {
  const plan = gmailConnectionResetPlan(fixture())
  assert.deepEqual(plan, { affectedCount: 1, ownerAffected: true })
  assert.equal('emails' in plan, false)
})

test('Gmail reset clears OAuth tokens, records a count-only audit event, and is idempotent', () => {
  const store = fixture()
  const first = resetGmailConnections(store, { targetEmail: 'jobaipilot@gmail.com', changedAt: '2026-07-02T12:00:00.000Z' })
  assert.equal(first.affectedCount, 1)
  assert.deepEqual(store.users[0].integrations.gmail, {
    connected: false,
    connectedEmail: null,
    encryptedTokens: null,
    updatedAt: '2026-07-02T12:00:00.000Z',
  })
  assert.deepEqual(store.auditLogs[0].details, { affectedCount: 1, targetEmailConfigured: true })
  assert.equal(JSON.stringify(store.auditLogs[0]).includes('old@example.com'), false)

  const second = resetGmailConnections(store, { targetEmail: 'jobaipilot@gmail.com', changedAt: '2026-07-02T12:01:00.000Z' })
  assert.equal(second.affectedCount, 0)
  assert.equal(store.auditLogs.length, 1)
})
