import test from 'node:test'
import assert from 'node:assert/strict'
import { eligibleUpdateClients } from '../src/services/clientUpdateAgentService.js'

test('client updates only target active opted-in clients verified through Google', () => {
  const store = {
    users: [
      { id: 'owner-user', role: 'owner', status: 'active', authProvider: 'google', googleSub: 'owner-sub', emailVerified: true, email: 'owner@gmail.com', preferences: {} },
      { id: 'seed-demo-user', role: 'client', status: 'active', authProvider: 'google', googleSub: 'demo-sub', emailVerified: true, email: 'demo@gmail.com', preferences: {} },
      { id: 'google-client', role: 'client', status: 'active', authProvider: 'google', googleSub: 'client-sub', emailVerified: true, email: 'registered@gmail.com', preferences: {} },
      { id: 'password-client', role: 'client', status: 'active', authProvider: 'password', emailVerified: true, email: 'password@example.com', preferences: {} },
      { id: 'linked-google-client', role: 'client', status: 'active', authProvider: 'password', googleSub: 'linked-sub', emailVerified: true, email: 'linked@gmail.com', preferences: {} },
      { id: 'unverified-google', role: 'client', status: 'active', authProvider: 'google', googleSub: 'unverified-sub', emailVerified: false, email: 'unverified@gmail.com', preferences: {} },
      { id: 'google-without-sub', role: 'client', status: 'active', authProvider: 'google', emailVerified: true, email: 'missing-sub@gmail.com', preferences: {} },
      { id: 'suspended-google', role: 'client', status: 'suspended', authProvider: 'google', googleSub: 'suspended-sub', emailVerified: true, email: 'suspended@gmail.com', preferences: {} },
      { id: 'opted-out-google', role: 'client', status: 'active', authProvider: 'google', googleSub: 'opted-out-sub', emailVerified: true, email: 'opted-out@gmail.com', preferences: { productUpdatesOptIn: false } },
    ],
    sessions: [{ userId: 'google-client' }, { userId: 'password-client' }],
  }

  const recipients = eligibleUpdateClients(store)

  assert.deepEqual(recipients.map(user => user.email), ['registered@gmail.com', 'linked@gmail.com'])
  assert.deepEqual(eligibleUpdateClients(store, { activeSessionOnly: true }).map(user => user.id), ['google-client'])
  assert.deepEqual(eligibleUpdateClients(store, { targetUserIds: ['password-client'] }), [])
})
