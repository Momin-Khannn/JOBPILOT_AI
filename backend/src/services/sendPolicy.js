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
}

export function assertDailyLimit(store, channel) {
  const limit = Number(store.users?.[0]?.preferences?.dailySendLimit || 15)
  const key = todayKey()
  const usage = store.dailyUsage?.[key]?.[channel] || 0
  if (usage >= limit) {
    const error = new Error(`Daily ${channel} send limit reached (${limit})`)
    error.status = 429
    throw error
  }
}

export function incrementDailyUsage(store, channel) {
  const key = todayKey()
  store.dailyUsage[key] ||= {}
  store.dailyUsage[key][channel] = (store.dailyUsage[key][channel] || 0) + 1
}
