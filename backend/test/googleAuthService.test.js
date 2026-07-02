import test from 'node:test'
import assert from 'node:assert/strict'
import { googleCallbackUrl } from '../src/services/googleAuthService.js'

test('Google callback sends each role to its app without exposing session tokens', () => {
  const previousFrontend = process.env.FRONTEND_URL
  const previousAdmin = process.env.ADMIN_URL
  process.env.FRONTEND_URL = 'https://jobpilot.example'
  process.env.ADMIN_URL = 'https://jobpilot.example'

  try {
    assert.equal(
      googleCallbackUrl({ token: 'client-token' }),
      'https://jobpilot.example/auth/google/callback'
    )
    assert.equal(
      googleCallbackUrl({ token: 'owner-token', role: 'owner' }),
      'https://jobpilot.example/owner/auth/google/callback'
    )
  } finally {
    if (previousFrontend === undefined) delete process.env.FRONTEND_URL
    else process.env.FRONTEND_URL = previousFrontend
    if (previousAdmin === undefined) delete process.env.ADMIN_URL
    else process.env.ADMIN_URL = previousAdmin
  }
})
