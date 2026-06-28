import test from 'node:test'
import assert from 'node:assert/strict'
import { createSession, hashSessionToken, normalizeStoredSession, sanitizeUser, sessionMatchesToken } from '../src/services/authService.js'
import { buildProfile, ensureShareableProfile, normalizeProfile, publicProfile } from '../src/services/profileService.js'
import { shouldTouchSession } from '../src/middleware/auth.js'

test('sanitized users never expose password hashes or encrypted provider tokens', () => {
  const user = sanitizeUser({
    id: 'user-1',
    email: 'person@example.com',
    passwordHash: 'secret-hash',
    passwordReset: { tokenHash: 'reset-secret', expiresAt: new Date().toISOString() },
    emailVerification: { tokenHash: 'verify-secret', expiresAt: new Date().toISOString() },
    integrations: {
      gmail: { connected: true, connectedEmail: 'person@gmail.com', encryptedTokens: { data: 'secret' } },
      whatsapp: { connected: true, provider: 'twilio' },
    },
  })

  assert.equal(user.passwordHash, undefined)
  assert.equal(user.passwordReset, undefined)
  assert.equal(user.emailVerification, undefined)
  assert.equal(user.integrations.gmail.encryptedTokens, undefined)
  assert.equal(user.integrations.gmail.connectedEmail, 'person@gmail.com')
})

test('session records persist only token hashes and accept legacy tokens during migration', () => {
  const { token, session } = createSession('user-1')

  assert.equal(session.token, undefined)
  assert.equal(session.tokenHash, hashSessionToken(token))
  assert.equal(sessionMatchesToken(session, token), true)
  assert.equal(sessionMatchesToken(session, `${token}x`), false)

  const migrated = normalizeStoredSession({ id: 'legacy-session', token: 'legacy-secret', userId: 'user-1' })
  assert.equal(migrated.token, undefined)
  assert.equal(migrated.tokenHash, hashSessionToken('legacy-secret'))
  assert.equal(sessionMatchesToken(migrated, 'legacy-secret'), true)
})

test('session activity writes are throttled instead of running on every request', () => {
  const now = Date.now()
  assert.equal(shouldTouchSession({ lastSeenAt: new Date(now - 60_000).toISOString() }, now), false)
  assert.equal(shouldTouchSession({ lastSeenAt: new Date(now - 10 * 60_000).toISOString() }, now), true)
})

test('public CV respects contact visibility', () => {
  const profile = buildProfile({ user: { id: 'u1', name: 'Jamie', email: 'private@example.com', phone: '123' } })
  profile.published = true
  profile.visibility.email = false
  profile.visibility.phone = true

  const visible = publicProfile(profile)
  assert.equal(visible.contact.email, '')
  assert.equal(visible.contact.phone, '123')
  assert.equal(publicProfile({ ...profile, published: false }), null)
})

test('profile customization preserves a complete, user-defined section order', () => {
  const base = buildProfile({ user: { id: 'u1', name: 'Jamie', email: 'jamie@example.com' } })
  const normalized = normalizeProfile({
    ...base,
    sectionOrder: ['projects', 'about', 'skills'],
  }, { user: { id: 'u1', name: 'Jamie', email: 'jamie@example.com' }, existing: base })

  assert.deepEqual(normalized.sectionOrder.slice(0, 3), ['projects', 'about', 'skills'])
  assert.equal(new Set(normalized.sectionOrder).size, 7)
})

test('signed up clients get a shareable CV profile without exposing contact by default', () => {
  const store = { profiles: [] }
  const user = { id: 'user-1', role: 'client', name: 'Jamie Example', email: 'jamie@example.com', phone: '123' }
  const profile = ensureShareableProfile(store, user)

  assert.equal(profile.slug, 'jamie-example')
  assert.equal(profile.published, true)
  assert.equal(store.profiles.length, 1)

  const visible = publicProfile(profile)
  assert.equal(visible.contact.email, '')
  assert.equal(visible.contact.phone, '')
})

test('shareable CV slugs stay unique across clients', () => {
  const store = { profiles: [] }
  const first = ensureShareableProfile(store, { id: 'abc123', role: 'client', name: 'Same Name', email: 'first@example.com' })
  const second = ensureShareableProfile(store, { id: 'def456', role: 'client', name: 'Same Name', email: 'second@example.com' })

  assert.equal(first.slug, 'same-name')
  assert.notEqual(second.slug, 'same-name')
  assert.equal(second.published, true)
})
