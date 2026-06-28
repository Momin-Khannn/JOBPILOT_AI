import { api } from '../api/client.js'
import { analyticsAllowed } from './consent.js'

const SESSION_KEY = 'jobpilot_analytics_session'

function sessionId() {
  if (typeof window === 'undefined') return ''
  let value = window.sessionStorage.getItem(SESSION_KEY)
  if (!value) {
    value = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    window.sessionStorage.setItem(SESSION_KEY, value)
  }
  return value
}

function basePayload() {
  if (typeof window === 'undefined') return {}
  return {
    consent: analyticsAllowed(),
    sessionId: sessionId(),
    path: `${window.location.pathname}${window.location.search}`,
    title: document.title,
    referrer: document.referrer,
  }
}

export function trackPageView() {
  if (!analyticsAllowed()) return
  api.trackPage(basePayload()).catch(() => {})
}

export function trackEvent(name, properties = {}) {
  if (!analyticsAllowed()) return
  api.trackEvent({ ...basePayload(), name, properties }).catch(() => {})
}
