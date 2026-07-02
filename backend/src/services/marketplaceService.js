import { v4 as uuid } from 'uuid'

const scamPattern = /\b(gift\s*card|bitcoin|crypto(?:currency)?|wire\s+transfer|western\s+union|moneygram|cash\s*app|zelle|send\s+(?:me\s+)?money|pay\s+(?:an?\s+)?(?:fee|deposit)|bank\s+account|routing\s+number|social\s+security|ssn|cnic|passport|deposit\s+(?:this\s+)?check|buy\s+(?:your\s+)?equipment|reship(?:ping)?)\b/i

export function companyForUser(store, userId) {
  return (store.companies || []).find(company =>
    company.ownerUserId === userId || (company.members || []).some(member => member.userId === userId && member.status === 'active')
  ) || null
}
export function companyMember(company, userId) {
  return (company?.members || []).find(member => member.userId === userId && member.status === 'active') || null
}

export function directJob(job = {}) {
  return job.provider === 'jobpilot' || job.applicationMode === 'in_app'
}

export function publicCompany(company = {}) {
  return {
    id: company.id,
    name: company.name,
    domain: company.domain,
    website: company.website || '',
    status: company.status,
    verifiedAt: company.verifiedAt || null,
    plus: { status: company.plus?.status || 'inactive' },
  }
}

export function safeCandidateSnapshot(resume = {}, user = {}) {
  const profile = resume.profile || {}
  return {
    name: profile.name || user.name || 'Candidate',
    headline: profile.topMatches?.[0] || profile.headline || 'Candidate',
    location: user.location || profile.location || '',
    summary: String(profile.summary || '').slice(0, 1200),
    skills: (profile.skills || []).map(String).slice(0, 30),
    experience: Array.isArray(profile.experience) ? profile.experience.slice(0, 12) : [],
    education: Array.isArray(profile.education) ? profile.education.slice(0, 8) : [],
    resumeFileName: resume.fileName || 'CV',
  }
}

export function conversationForApplication(store, application) {
  let conversation = (store.conversations || []).find(item => item.applicationId === application.id)
  if (conversation) return conversation
  const company = (store.companies || []).find(item => item.id === application.companyId)
  conversation = {
    id: uuid(),
    applicationId: application.id,
    jobId: application.jobId || application.job?.id,
    companyId: application.companyId,
    candidateUserId: application.userId,
    participantIds: [application.userId, ...(company?.members || []).filter(member => member.status === 'active').map(member => member.userId)],
    blockedBy: [],
    lastMessageAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  store.conversations ||= []
  store.conversations.unshift(conversation)
  return conversation
}

export function canAccessConversation(store, conversation, user) {
  if (!conversation || !user) return false
  if (user.role === 'owner') return true
  if (conversation.candidateUserId === user.id) return true
  if (user.role === 'employer') {
    const company = companyForUser(store, user.id)
    return company?.id === conversation.companyId
  }
  return false
}

export function detectUnsafeMarketplaceText(value = '') {
  const text = String(value).trim()
  return scamPattern.test(text)
    ? 'JobPilot blocks requests for money, financial details, identity documents, checks, gift cards, crypto, or paid equipment.'
    : ''
}

export function createNotification({ userId, type, title, detail, href }) {
  return {
    id: uuid(),
    userId,
    type,
    title: String(title || '').slice(0, 180),
    detail: String(detail || '').slice(0, 500),
    href: String(href || '').slice(0, 300),
    readAt: null,
    createdAt: new Date().toISOString(),
  }
}
