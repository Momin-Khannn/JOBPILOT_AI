import test from 'node:test'
import assert from 'node:assert/strict'
import { assertEmailAccepted, buildEmailVerificationEmail, buildWelcomeEmail } from '../src/services/emailService.js'

test('welcome email links new clients to onboarding and escapes names in HTML', () => {
  const previousFrontendUrl = process.env.FRONTEND_URL
  process.env.FRONTEND_URL = 'https://jobpilot.example'

  try {
    const message = buildWelcomeEmail({ name: '<Alex> Smith' })
    assert.equal(message.subject, 'Welcome to JobPilot AI')
    assert.match(message.text, /https:\/\/jobpilot\.example\/goal/)
    assert.match(message.html, /Hi &lt;Alex&gt;/)
    assert.doesNotMatch(message.html, /Hi <Alex>/)
  } finally {
    if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL
    else process.env.FRONTEND_URL = previousFrontendUrl
  }
})

test('verification email links users to the one-time verification URL', () => {
  const message = buildEmailVerificationEmail({
    name: '<Alex> Smith',
    verificationUrl: 'https://jobpilot.example/verify-email?token=abc',
  })

  assert.equal(message.subject, 'Verify your JobPilot AI email')
  assert.match(message.text, /verify-email\?token=abc/)
  assert.match(message.html, /Hi &lt;Alex&gt;/)
  assert.match(message.html, /Verify email address/)
  assert.doesNotMatch(message.html, /Hi <Alex>/)
})

test('rejected or empty SMTP results fail closed instead of reporting success', () => {
  assert.throws(
    () => assertEmailAccepted({ accepted: [], rejected: ['client@example.com'] }, 'client@example.com'),
    error => error.status === 503,
  )
  assert.equal(
    assertEmailAccepted({ accepted: ['client@example.com'], rejected: [] }, 'client@example.com').accepted[0],
    'client@example.com',
  )
})
