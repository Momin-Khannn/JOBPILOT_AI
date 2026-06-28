import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMetaTextMessage } from '../src/services/whatsappService.js'

test('Meta WhatsApp payloads are text-only and never attach CV documents', () => {
  const payload = buildMetaTextMessage('+92 300 1234567', 'Hello from JobPilot')

  assert.deepEqual(payload, {
    messaging_product: 'whatsapp',
    to: '923001234567',
    type: 'text',
    text: { preview_url: false, body: 'Hello from JobPilot' },
  })
  assert.equal(payload.document, undefined)
  assert.equal(payload.media, undefined)
})
