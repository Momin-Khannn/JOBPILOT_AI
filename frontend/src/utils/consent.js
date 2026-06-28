const CONSENT_KEY = 'jobpilot_cookie_consent'

export function readConsent() {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(window.localStorage.getItem(CONSENT_KEY) || 'null')
  } catch {
    return null
  }
}

export function writeConsent(value) {
  if (typeof window === 'undefined') return
  const consent = {
    necessary: true,
    analytics: Boolean(value?.analytics),
    decidedAt: new Date().toISOString(),
  }
  window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
  window.dispatchEvent(new CustomEvent('jobpilot-consent-change', { detail: consent }))
}

export function analyticsAllowed() {
  return readConsent()?.analytics === true
}
