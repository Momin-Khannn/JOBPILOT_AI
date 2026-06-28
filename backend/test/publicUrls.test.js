import test from 'node:test'
import assert from 'node:assert/strict'
import { publicAdminUrl, publicBackendUrl, publicFrontendUrl } from '../src/config/publicUrls.js'

const keys = ['FRONTEND_URL', 'ADMIN_URL', 'BACKEND_URL', 'APP_BASE_URL', 'RAILWAY_PUBLIC_DOMAIN']

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  for (const key of keys) delete process.env[key]
  Object.assign(process.env, values)

  try {
    callback()
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

test('Railway public domain becomes the single-domain frontend and API URL', () => {
  withEnvironment({ RAILWAY_PUBLIC_DOMAIN: 'jobpilot-production.up.railway.app' }, () => {
    assert.equal(publicFrontendUrl(), 'https://jobpilot-production.up.railway.app')
    assert.equal(publicBackendUrl(), 'https://jobpilot-production.up.railway.app')
    assert.equal(publicAdminUrl(), 'https://jobpilot-production.up.railway.app')
  })
})

test('explicit split frontend and backend URLs take precedence', () => {
  withEnvironment({
    FRONTEND_URL: 'https://app.example.com/',
    ADMIN_URL: 'https://owner.example.com/',
    BACKEND_URL: 'https://api.example.com/',
    RAILWAY_PUBLIC_DOMAIN: 'ignored.up.railway.app',
  }, () => {
    assert.equal(publicFrontendUrl(), 'https://app.example.com')
    assert.equal(publicBackendUrl(), 'https://api.example.com')
    assert.equal(publicAdminUrl(), 'https://owner.example.com')
  })
})
