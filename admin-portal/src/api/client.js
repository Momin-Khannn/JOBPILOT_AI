const defaultApiBase =
  typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://127.0.0.1:4000/api'

const API_BASE = import.meta.env.VITE_API_URL || defaultApiBase
const SESSION_KEY = 'jobpilot_owner_session'
let sessionToken = typeof window !== 'undefined' ? window.localStorage.getItem(SESSION_KEY) || '' : ''

export function setSessionToken(token) {
  sessionToken = token || ''
  if (typeof window !== 'undefined') {
    if (sessionToken) window.localStorage.setItem(SESSION_KEY, sessionToken)
    else window.localStorage.removeItem(SESSION_KEY)
  }
}

async function request(path, options = {}) {
  const headers = options.body instanceof FormData
    ? options.headers || {}
    : { 'Content-Type': 'application/json', ...(options.headers || {}) }

  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    })
  } catch {
    throw new Error('Unable to reach the JobPilot API. Check that the backend is running and exposed to the admin portal.')
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`)
  }
  return payload
}

export const api = {
  setSessionToken,
  securityConfig: () => request('/auth/security-config'),
  captcha: () => request('/auth/captcha'),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  verifyTwoFactor: (payload) => request('/auth/login/verify-2fa', { method: 'POST', body: JSON.stringify(payload) }),
  ownerGoogleAuthUrl: () => request('/auth/google/auth-url?role=owner'),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  adminOverview: () => request('/admin/overview'),
  adminUpdateUser: (id, patch) => request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  clientUpdateStatus: () => request('/admin/client-updates/status'),
  testClientUpdateMailbox: () => request('/admin/client-updates/test-mailbox', { method: 'POST' }),
  gmailAuthUrl: () => request('/gmail/auth-url'),
  sendClientUpdate: (payload) => request('/admin/client-updates/send', { method: 'POST', body: JSON.stringify(payload) }),
  scanSoftwareUpdates: (payload = {}) => request('/admin/client-updates/scan-software', { method: 'POST', body: JSON.stringify(payload) }),
  refreshPortals: () => request('/admin/client-updates/refresh-portals', { method: 'POST' }),
  syncJobs: (payload = {}) => request('/jobs/sync', { method: 'POST', body: JSON.stringify(payload) }),
}
