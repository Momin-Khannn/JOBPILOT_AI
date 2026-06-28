import test from 'node:test'
import assert from 'node:assert/strict'
import {
  changePasswordBodySchema,
  clientUpdateBodySchema,
  ghostingPrepareBodySchema,
  negotiationPrepareBodySchema,
  registerBodySchema,
  settingsBodySchema,
  supportBodySchema,
  workflowDraftBodySchema,
  workflowSendBodySchema,
} from '../src/validation/schemas.js'

test('registration validation normalizes email and rejects malformed payloads', () => {
  const valid = registerBodySchema.safeParse({
    name: ' Jamie ',
    email: 'JAMIE@EXAMPLE.COM',
    password: 'correct-horse',
    acceptedTerms: true,
    role: 'owner',
  })
  assert.equal(valid.success, true)
  assert.equal(valid.data.email, 'jamie@example.com')
  assert.equal(valid.data.role, undefined)

  assert.equal(registerBodySchema.safeParse({ name: [], email: 'bad', password: 'short', acceptedTerms: false }).success, false)
})

test('public and owner schemas bound untrusted text and URLs', () => {
  assert.equal(supportBodySchema.safeParse({ message: 'short' }).success, false)
  assert.equal(supportBodySchema.safeParse({ message: 'Enough detail for support', pageUrl: 'javascript:alert(1)' }).success, false)
  assert.equal(clientUpdateBodySchema.safeParse({ title: 'Release', summary: 'Ready', actionUrl: 'javascript:alert(1)' }).success, false)
  assert.equal(clientUpdateBodySchema.safeParse({ title: 'Release', summary: 'Ready', changes: Array(21).fill('x') }).success, false)
})

test('settings validation strips fields clients are not allowed to update', () => {
  const result = settingsBodySchema.safeParse({
    user: {
      name: 'Jamie',
      tier: 'pro',
      role: 'owner',
      preferences: {
        dailySendLimit: 15,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        ghostingInterviewDays: 10,
        aiTone: 'concise',
        density: 'compact',
      },
    },
  })
  assert.equal(result.success, true)
  assert.equal(result.data.user.tier, undefined)
  assert.equal(result.data.user.role, undefined)
  assert.equal(result.data.user.preferences.quietHoursStart, '22:00')
  assert.equal(result.data.user.preferences.aiTone, 'concise')
  assert.equal(settingsBodySchema.safeParse({ user: { preferences: { quietHoursStart: 'night' } } }).success, false)
  assert.equal(settingsBodySchema.safeParse({ user: { preferences: { ghostingInterviewDays: 31 } } }).success, false)
  assert.equal(changePasswordBodySchema.safeParse({ currentPassword: 'samepass1', newPassword: 'samepass1' }).success, false)
  assert.equal(changePasswordBodySchema.safeParse({ currentPassword: 'oldpass1', newPassword: 'newpass123' }).success, true)
})

test('career move schemas bound evidence, compensation, drafts, and workflow sends', () => {
  const ghosting = ghostingPrepareBodySchema.parse({
    companySignal: 'The company launched a new developer platform.',
    sourceUrl: 'https://example.com/company-news',
    force: true,
  })
  assert.equal(ghosting.force, undefined)

  const negotiation = negotiationPrepareBodySchema.safeParse({
    currency: 'usd',
    payPeriod: 'annual',
    baseSalary: 100_000,
    marketMin: 130_000,
    marketMax: 120_000,
  })
  assert.equal(negotiation.success, false)
  assert.equal(negotiationPrepareBodySchema.safeParse({ currency: 'USD', baseSalary: -1 }).success, false)
  assert.equal(workflowDraftBodySchema.safeParse({ subject: 'Counter offer', body: 'Too short' }).success, false)
  assert.equal(workflowSendBodySchema.safeParse({ applicationId: 'app-1', workflow: 'unknown' }).success, false)
})
