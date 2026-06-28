import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createCaptchaChallenge,
  createTwoFactorChallenge,
  verifyCaptchaChallenge,
  verifyTwoFactorChallenge,
} from '../src/services/authSecurityService.js'

test('captcha challenges are short-lived one-time checks', () => {
  const previous = process.env.LOGIN_CAPTCHA_ENABLED
  process.env.LOGIN_CAPTCHA_ENABLED = 'true'
  try {
    const challenge = createCaptchaChallenge()
    const svg = Buffer.from(challenge.image.split(',')[1], 'base64').toString('utf8')
    const answer = [...svg.matchAll(/<text[^>]*>([^<])<\/text>/g)].map(match => match[1]).join('')

    assert.equal(answer.length, 5)
    assert.equal(verifyCaptchaChallenge(challenge.challengeId, answer.toLowerCase()), true)
    assert.equal(verifyCaptchaChallenge(challenge.challengeId, answer), false)
  } finally {
    if (previous === undefined) delete process.env.LOGIN_CAPTCHA_ENABLED
    else process.env.LOGIN_CAPTCHA_ENABLED = previous
  }
})

test('two-factor codes are bound to one login and can be used once', () => {
  const challenge = createTwoFactorChallenge({
    userId: 'client-1',
    email: 'client@example.com',
    role: 'client',
  })

  assert.equal(challenge.maskedEmail.endsWith('@example.com'), true)
  assert.deepEqual(verifyTwoFactorChallenge(challenge.challengeId, challenge.code), {
    userId: 'client-1',
    email: 'client@example.com',
    role: 'client',
  })
  assert.equal(verifyTwoFactorChallenge(challenge.challengeId, challenge.code), null)
})
