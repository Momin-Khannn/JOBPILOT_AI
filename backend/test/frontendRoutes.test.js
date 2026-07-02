import test from 'node:test'
import assert from 'node:assert/strict'
import { isKnownClientRoute } from '../src/config/frontendRoutes.js'

test('client route allowlist accepts product pages and rejects invented paths', () => {
  for (const route of ['/', '/login', '/dashboard', '/settings/', '/cv/momin-ahmad']) {
    assert.equal(isKnownClientRoute(route), true, route)
  }

  for (const route of ['/admin', '/anything-else', '/cv', '/cv/name/extra', '/api/health']) {
    assert.equal(isKnownClientRoute(route), false, route)
  }
})
