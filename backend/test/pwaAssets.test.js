import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const publicDir = path.join(repoRoot, 'frontend/public')

test('PWA manifest and platform icons support standalone installation', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'manifest.webmanifest'), 'utf8'))
  const iconSizes = new Set(manifest.icons.map(icon => icon.sizes))

  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.start_url, '/dashboard')
  assert.equal(iconSizes.has('192x192'), true)
  assert.equal(iconSizes.has('512x512'), true)

  for (const fileName of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
    const bytes = fs.readFileSync(path.join(publicDir, fileName))
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  }
})

test('service worker never intercepts API requests', () => {
  const serviceWorker = fs.readFileSync(path.join(publicDir, 'sw.js'), 'utf8')
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/api'\)/)
})
