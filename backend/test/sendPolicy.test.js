import test from 'node:test'
import assert from 'node:assert/strict'
import { assertSendingWindow, assertWhatsappRecipientConsent } from '../src/services/sendPolicy.js'

const quietUser = {
  preferences: {
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    timezone: 'UTC',
  },
}

test('quiet hours block overnight sends and allow daytime sends', () => {
  assert.throws(
    () => assertSendingWindow(quietUser, new Date('2026-06-28T23:30:00.000Z')),
    error => error.status === 409 && /quiet hours/i.test(error.message),
  )
  assert.doesNotThrow(() => assertSendingWindow(quietUser, new Date('2026-06-28T12:00:00.000Z')))
  assert.doesNotThrow(() => assertSendingWindow({ preferences: { quietHoursEnabled: false } }, new Date('2026-06-28T23:30:00.000Z')))
})

test('same start and end pauses the full day', () => {
  assert.throws(() => assertSendingWindow({
    preferences: { quietHoursEnabled: true, quietHoursStart: '00:00', quietHoursEnd: '00:00', timezone: 'UTC' },
  }, new Date('2026-06-28T12:00:00.000Z')))
})

const consentedWhatsappApplication = {
  id: 'application-1',
  userId: 'user-1',
  channel: 'whatsapp',
  status: 'pending_review',
  job: { recruiterPhone: '+92 300 1234567' },
  whatsappConsent: {
    recipientOptIn: true,
    basis: 'recipient_permission',
    recipientPhone: '+92 300 1234567',
    confirmedAt: '2026-06-28T12:00:00.000Z',
    confirmedByUserId: 'user-1',
  },
}

test('WhatsApp sending requires recipient permission bound to the same phone number', () => {
  assert.doesNotThrow(() => assertWhatsappRecipientConsent(consentedWhatsappApplication))
  assert.throws(
    () => assertWhatsappRecipientConsent({ ...consentedWhatsappApplication, whatsappConsent: null }),
    error => error.status === 403 && /explicitly permitted/i.test(error.message),
  )
  assert.throws(
    () => assertWhatsappRecipientConsent({
      ...consentedWhatsappApplication,
      job: { recruiterPhone: '+92 311 7654321' },
    }),
    error => error.status === 403,
  )
})

test('approved WhatsApp messages keep the consent record in the approval snapshot', () => {
  assert.doesNotThrow(() => assertWhatsappRecipientConsent({
    ...consentedWhatsappApplication,
    status: 'approved',
    approvalSnapshot: {
      recipient: '+92 300 1234567',
      whatsappConsent: { ...consentedWhatsappApplication.whatsappConsent },
    },
  }))
  assert.throws(() => assertWhatsappRecipientConsent({
    ...consentedWhatsappApplication,
    status: 'approved',
    approvalSnapshot: { recipient: '+92 300 1234567' },
  }), error => error.status === 409)
})
