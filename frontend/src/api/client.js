function defaultApiBase() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:4000/api'

  const { hostname, port, origin } = window.location
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1'
  const isStandaloneFrontend = isLocalHost && ['3000', '3001', '5173'].includes(port)
  if (isStandaloneFrontend) return 'http://127.0.0.1:4000/api'

  return `${origin}/api`
}

const API_BASE = import.meta.env.VITE_API_URL || defaultApiBase()
const SESSION_KEY = 'jobpilot_client_session'
let legacySessionToken = typeof window !== 'undefined' ? window.localStorage.getItem(SESSION_KEY) || '' : ''

export function setSessionToken(token) {
  legacySessionToken = token || ''
  if (typeof window !== 'undefined') {
    if (legacySessionToken) window.localStorage.setItem(SESSION_KEY, legacySessionToken)
    else window.localStorage.removeItem(SESSION_KEY)
  }
}

async function request(path, options = {}) {
  const headers = options.body instanceof FormData
    ? options.headers || {}
    : { 'Content-Type': 'application/json', ...(options.headers || {}) }

  if (legacySessionToken) headers.Authorization = `Bearer ${legacySessionToken}`

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    })
  } catch {
    throw new Error('Unable to reach the JobPilot server. Check that the backend is running and the API URL is correct.')
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`)
  }
  return payload
}

export const api = {
  setSessionToken,
  health: () => request('/health'),
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  securityConfig: () => request('/auth/security-config'),
  captcha: () => request('/auth/captcha'),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  verifyTwoFactor: (payload) => request('/auth/login/verify-2fa', { method: 'POST', body: JSON.stringify(payload) }),
  googleAuthUrl: (options = {}) => {
    const query = new URLSearchParams(Object.entries(options).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]))
    return request(`/auth/google/auth-url${query.size ? `?${query}` : ''}`)
  },
  forgotPassword: (payload) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify(payload) }),
  resetPassword: (payload) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),
  verifyEmail: (payload) => request('/auth/verify-email', { method: 'POST', body: JSON.stringify(payload) }),
  resendVerification: (payload) => request('/auth/resend-verification', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  billingStatus: () => request('/billing/status'),
  startProCheckout: (interval = 'monthly') => request('/billing/checkout', { method: 'POST', body: JSON.stringify({ interval }) }),
  openBillingPortal: () => request('/billing/portal', { method: 'POST' }),
  summary: () => request('/applications/summary'),
  settings: () => request('/settings'),
  saveSettings: (user) => request('/settings', { method: 'PUT', body: JSON.stringify({ user }) }),
  changePassword: (payload) => request('/settings/security/password', { method: 'PUT', body: JSON.stringify(payload) }),
  signOutOtherSessions: () => request('/settings/security/sign-out-others', { method: 'POST' }),
  exportAccount: () => request('/settings/export'),
  deleteAccount: (confirmation) => request('/settings/account', { method: 'DELETE', body: JSON.stringify({ confirmation }) }),
  goal: () => request('/goal'),
  saveGoal: (goal) => request('/goal', { method: 'PUT', body: JSON.stringify({ goal }) }),
  latestResume: () => request('/resume/latest'),
  uploadResume: (file) => {
    const form = new FormData()
    form.append('resume', file)
    return request('/resume/parse', { method: 'POST', body: form })
  },
  startResumeVerification: (resumeId) => request(`/resume/${resumeId}/ownership/start`, { method: 'POST' }),
  verifyResumeOwnership: (resumeId, code) => request(`/resume/${resumeId}/ownership/verify`, { method: 'POST', body: JSON.stringify({ code }) }),
  profile: () => request('/profile/me'),
  saveProfile: (profile) => request('/profile/me', { method: 'PUT', body: JSON.stringify({ profile }) }),
  publicProfile: (slug) => request(`/profile/public/${encodeURIComponent(slug)}`),
  uploadProfileImage: (file, kind) => {
    const form = new FormData()
    form.append('image', file)
    form.append('kind', kind)
    return request('/profile/image', { method: 'POST', body: form })
  },
  searchJobs: (params = {}) => {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'All')
    )
    const query = new URLSearchParams(filtered)
    return request(`/jobs/search?${query}`)
  },
  portalUpdatesStatus: () => request('/portal-updates/status'),
  refreshJob: (id) => request(`/jobs/${id}/refresh`, { method: 'POST' }),
  queueApplications: (jobs, channel = 'gmail', whatsappRecipientOptIn = false) =>
    request('/applications/queue', { method: 'POST', body: JSON.stringify({ jobs, channel, whatsappRecipientOptIn }) }),
  applyDirectJob: (jobId, payload = {}) =>
    request(`/marketplace/jobs/${jobId}/apply`, { method: 'POST', body: JSON.stringify(payload) }),
  marketplaceConversations: () => request('/marketplace/conversations'),
  marketplaceMessages: (conversationId) => request(`/marketplace/conversations/${conversationId}/messages`),
  sendMarketplaceMessage: (conversationId, body) =>
    request(`/marketplace/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  readMarketplaceConversation: (conversationId) =>
    request(`/marketplace/conversations/${conversationId}/read`, { method: 'POST' }),
  reportMarketplaceConversation: (conversationId, payload) =>
    request(`/marketplace/conversations/${conversationId}/report`, { method: 'POST', body: JSON.stringify(payload) }),
  blockMarketplaceConversation: (conversationId) =>
    request(`/marketplace/conversations/${conversationId}/block`, { method: 'POST' }),
  marketplaceNotifications: () => request('/marketplace/notifications'),
  readMarketplaceNotifications: () => request('/marketplace/notifications/read', { method: 'POST' }),
  applications: () => request('/applications'),
  updateApplication: (id, patch) =>
    request(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  approveApplication: (id) => request(`/applications/${id}/approve`, { method: 'POST' }),
  prepareGhostingResolution: (id, payload = {}) =>
    request(`/applications/${id}/ghosting/prepare`, { method: 'POST', body: JSON.stringify(payload) }),
  updateGhostingDraft: (id, draft) =>
    request(`/applications/${id}/ghosting/draft`, { method: 'PATCH', body: JSON.stringify(draft) }),
  approveGhostingResolution: (id) =>
    request(`/applications/${id}/ghosting/approve`, { method: 'POST' }),
  prepareNegotiation: (id, payload) =>
    request(`/applications/${id}/negotiation/prepare`, { method: 'POST', body: JSON.stringify(payload) }),
  updateNegotiationDraft: (id, draft) =>
    request(`/applications/${id}/negotiation/draft`, { method: 'PATCH', body: JSON.stringify(draft) }),
  approveNegotiation: (id) =>
    request(`/applications/${id}/negotiation/approve`, { method: 'POST' }),
  decisionReport: (applicationId) =>
    request('/ai/decision-report', { method: 'POST', body: JSON.stringify({ applicationId }) }),
  tailorResume: (applicationId) =>
    request('/ai/tailor-resume', { method: 'POST', body: JSON.stringify({ applicationId }) }),
  interviewPrep: (applicationId) =>
    request('/ai/interview-prep', { method: 'POST', body: JSON.stringify({ applicationId }) }),
  coverLetter: (applicationId) =>
    request('/ai/cover-letter', { method: 'POST', body: JSON.stringify({ applicationId }) }),
  answerInterviewAudio: (sessionId, audio) => {
    const form = new FormData()
    form.append('sessionId', sessionId)
    form.append('audio', audio, 'interview-answer.wav')
    return request('/ai/interview-audio', { method: 'POST', body: form })
  },
  careerOverview: () => request('/career/overview'),
  markSkillAchieved: (skill, achieved) =>
    request(`/career/skills/${encodeURIComponent(skill)}`, { method: 'PATCH', body: JSON.stringify({ achieved }) }),
  startInterview: (applicationId) =>
    request('/career/interviews', { method: 'POST', body: JSON.stringify({ applicationId }) }),
  answerInterview: (sessionId, answer) =>
    request(`/career/interviews/${sessionId}/answer`, { method: 'POST', body: JSON.stringify({ answer }) }),
  followUps: () => request('/followups'),
  scheduleFollowUp: (applicationId, days = 5) =>
    request('/followups/schedule', { method: 'POST', body: JSON.stringify({ applicationId, days }) }),
  updateFollowUp: (id, patch) =>
    request(`/followups/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  inboxEvents: () => request('/inbox'),
  classifyInbox: (payload) =>
    request('/inbox/classify', { method: 'POST', body: JSON.stringify(payload) }),
  sendGmail: (applicationId) =>
    request('/gmail/send', { method: 'POST', body: JSON.stringify({ applicationId }) }),
  sendCareerMove: (applicationId, workflow) =>
    request('/gmail/send-workflow', { method: 'POST', body: JSON.stringify({ applicationId, workflow }) }),
  gmailStatus: () => request('/gmail/status'),
  gmailAuthUrl: () => request('/gmail/auth-url'),
  disconnectGmail: () => request('/gmail/disconnect', { method: 'POST' }),
  whatsappStatus: () => request('/whatsapp/status'),
  configureWhatsApp: (provider) =>
    request('/whatsapp/configure', { method: 'POST', body: JSON.stringify({ provider }) }),
  disconnectWhatsApp: () => request('/whatsapp/disconnect', { method: 'POST' }),
  sendWhatsApp: (applicationId) =>
    request('/whatsapp/send', { method: 'POST', body: JSON.stringify({ applicationId }) }),
  supportContact: (payload) => request('/support/contact', { method: 'POST', body: JSON.stringify(payload) }),
  trackPage: (payload) => request('/analytics/page', { method: 'POST', body: JSON.stringify(payload) }),
  trackEvent: (payload) => request('/analytics/event', { method: 'POST', body: JSON.stringify(payload) }),
}
