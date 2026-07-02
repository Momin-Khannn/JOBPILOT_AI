function apiBase() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:4000/api'
  if (['3002', '5173'].includes(window.location.port)) return 'http://127.0.0.1:4000/api'
  return `${window.location.origin}/api`
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase()}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-JobPilot-Portal': 'employer', ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`)
  return payload
}

export const api = {
  security: () => request('/auth/security-config'),
  captcha: () => request('/auth/captcha'),
  register: payload => request('/auth/register', { method: 'POST', body: JSON.stringify({ ...payload, role: 'employer' }) }),
  login: payload => request('/auth/login', { method: 'POST', body: JSON.stringify({ ...payload, role: 'employer' }) }),
  verifyTwoFactor: payload => request('/auth/login/verify-2fa', { method: 'POST', body: JSON.stringify(payload) }),
  verifyEmail: token => request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  inviteInfo: token => request(`/auth/employer-invites/${encodeURIComponent(token)}`),
  acceptInvite: (token, payload) => request(`/auth/employer-invites/${encodeURIComponent(token)}/accept`, { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  overview: () => request('/employer/overview'),
  createJob: payload => request('/employer/jobs', { method: 'POST', body: JSON.stringify(payload) }),
  updateJob: (id, payload) => request(`/employer/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  updateApplication: (id, status) => request(`/employer/applications/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  inviteMember: email => request('/employer/members/invite', { method: 'POST', body: JSON.stringify({ email }) }),
  conversations: () => request('/marketplace/conversations'),
  messages: id => request(`/marketplace/conversations/${id}/messages`),
  sendMessage: (id, body) => request(`/marketplace/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  markRead: id => request(`/marketplace/conversations/${id}/read`, { method: 'POST' }),
  report: (id, reason, detail) => request(`/marketplace/conversations/${id}/report`, { method: 'POST', body: JSON.stringify({ reason, detail }) }),
  block: id => request(`/marketplace/conversations/${id}/block`, { method: 'POST' }),
  billingStatus: () => request('/employer/billing/status'),
  startPlus: () => request('/employer/billing/checkout', { method: 'POST' }),
  billingPortal: () => request('/employer/billing/portal', { method: 'POST' }),
}
