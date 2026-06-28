export function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function assertApprovedApplication(application) {
  if (!application) {
    const error = new Error('Application not found')
    error.status = 404
    throw error
  }
  if (!application.approvedAt || application.status !== 'approved') {
    const error = new Error('User approval is required before sending this application')
    error.status = 403
    throw error
  }
  if (!application.approvalSnapshot?.body || application.approvalSnapshot.channel !== application.channel) {
    const error = new Error('The approved message snapshot is missing or no longer matches this application')
    error.status = 409
    throw error
  }
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '')
}

export function assertWhatsappRecipientConsent(application) {
  if (application?.channel !== 'whatsapp') return

  const consent = application.whatsappConsent
  const recipient = application.approvalSnapshot?.recipient || application.job?.recruiterPhone
  const consentPhone = consent?.recipientPhone
  const snapshotConsent = application.approvalSnapshot?.whatsappConsent
  const normalizedRecipient = normalizePhone(recipient)
  const valid = consent?.recipientOptIn === true &&
    consent?.basis === 'recipient_permission' &&
    Boolean(consent?.confirmedAt) &&
    consent?.confirmedByUserId === application.userId &&
    normalizedRecipient.length >= 8 &&
    normalizedRecipient === normalizePhone(consentPhone)

  if (!valid) {
    const error = new Error('WhatsApp delivery requires confirmation that this recipient explicitly permitted contact on this number')
    error.status = 403
    throw error
  }

  if (application.status === 'approved' && (
    snapshotConsent?.confirmedAt !== consent.confirmedAt ||
    normalizePhone(snapshotConsent?.recipientPhone) !== normalizePhone(consentPhone)
  )) {
    const error = new Error('The approved WhatsApp consent snapshot is missing or no longer matches the recipient')
    error.status = 409
    throw error
  }
}

export function assertDailyLimit(store, userId, channel) {
  const user = (store.users || []).find(item => item.id === userId)
  assertSendingWindow(user)
  const limit = Number(user?.preferences?.dailySendLimit || 15)
  const key = todayKey()
  const usage = store.dailyUsage?.[key]?.[userId]?.[channel] || 0
  if (usage >= limit) {
    const error = new Error(`Daily ${channel} send limit reached (${limit})`)
    error.status = 429
    throw error
  }
}

export function assertSendingWindow(user = {}, now = new Date()) {
  const preferences = user.preferences || {}
  if (!preferences.quietHoursEnabled) return
  const start = String(preferences.quietHoursStart || '22:00')
  const end = String(preferences.quietHoursEnd || '08:00')
  const timezone = String(preferences.timezone || 'UTC')
  let current
  try {
    current = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(now)
  } catch {
    current = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(now)
  }
  const insideWindow = start === end
    ? true
    : start < end
      ? current >= start && current < end
      : current >= start || current < end
  if (insideWindow) {
    const error = new Error(`Sending is paused during quiet hours (${start}-${end}, ${timezone})`)
    error.status = 409
    throw error
  }
}

export function incrementDailyUsage(store, userId, channel) {
  const key = todayKey()
  store.dailyUsage[key] ||= {}
  store.dailyUsage[key][userId] ||= {}
  store.dailyUsage[key][userId][channel] = (store.dailyUsage[key][userId][channel] || 0) + 1
}
