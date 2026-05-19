const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api'

async function request(path, options = {}) {
  const headers = options.body instanceof FormData
    ? options.headers || {}
    : { 'Content-Type': 'application/json', ...(options.headers || {}) }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`)
  }
  return payload
}

export const api = {
  health: () => request('/health'),
  summary: () => request('/applications/summary'),
  settings: () => request('/settings'),
  saveSettings: (user) => request('/settings', { method: 'PUT', body: JSON.stringify({ user }) }),
  latestResume: () => request('/resume/latest'),
  uploadResume: (file) => {
    const form = new FormData()
    form.append('resume', file)
    return request('/resume/parse', { method: 'POST', body: form })
  },
  searchJobs: (params = {}) => {
    const query = new URLSearchParams(params)
    return request(`/jobs/search?${query}`)
  },
  queueApplications: (jobs, channel = 'gmail') =>
    request('/applications/queue', { method: 'POST', body: JSON.stringify({ jobs, channel }) }),
  applications: () => request('/applications'),
  updateApplication: (id, patch) =>
    request(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  approveApplication: (id) => request(`/applications/${id}/approve`, { method: 'POST' }),
  decisionReport: (applicationId) =>
    request('/ai/decision-report', { method: 'POST', body: JSON.stringify({ applicationId }) }),
  tailorResume: (applicationId) =>
    request('/ai/tailor-resume', { method: 'POST', body: JSON.stringify({ applicationId }) }),
  interviewPrep: (applicationId) =>
    request('/ai/interview-prep', { method: 'POST', body: JSON.stringify({ applicationId }) }),
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
  gmailStatus: () => request('/gmail/status'),
  gmailAuthUrl: () => request('/gmail/auth-url'),
  whatsappStatus: () => request('/whatsapp/status'),
  configureWhatsApp: (provider) =>
    request('/whatsapp/configure', { method: 'POST', body: JSON.stringify({ provider }) }),
  sendWhatsApp: (applicationId) =>
    request('/whatsapp/send', { method: 'POST', body: JSON.stringify({ applicationId }) }),
}
