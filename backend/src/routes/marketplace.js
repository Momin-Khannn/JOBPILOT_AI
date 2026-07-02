import express from 'express'
import { v4 as uuid } from 'uuid'
import { addAuditLog, readStore, updateStore } from '../db/store.js'
import { requireAuth } from '../middleware/auth.js'
import { evaluateResumeIdentity } from '../services/resumeIdentityService.js'
import {
  canAccessConversation,
  companyForUser,
  conversationForApplication,
  createNotification,
  detectUnsafeMarketplaceText,
  directJob,
  publicCompany,
  safeCandidateSnapshot,
} from '../services/marketplaceService.js'

const router = express.Router()
router.use(requireAuth)

router.post('/jobs/:id/apply', async (req, res) => {
  if (req.auth.user.role !== 'client') return res.status(403).json({ error: 'Candidate access required.' })
  let created = null
  let failure = ''
  await updateStore((store) => {
    const job = (store.jobs || []).find(item => item.id === req.params.id)
    const company = (store.companies || []).find(item => item.id === job?.companyId)
    if (!job || !directJob(job) || job.publicationStatus !== 'published' || job.isExpired) { failure = 'This JobPilot Direct role is not accepting applications.'; return }
    if (!company || company.status !== 'verified') { failure = 'This employer is not currently verified.'; return }
    if ((store.applications || []).some(item => item.userId === req.auth.userId && item.jobId === job.id)) { failure = 'You already applied to this role.'; return }
    const resume = req.body.resumeId
      ? (store.resumes || []).find(item => item.id === req.body.resumeId && item.userId === req.auth.userId)
      : (store.resumes || []).filter(item => item.userId === req.auth.userId).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]
    const account = (store.users || []).find(item => item.id === req.auth.userId)
    if (!resume) { failure = 'Upload and verify your CV before applying.'; return }
    if (!(resume.ownership || evaluateResumeIdentity(resume.profile, account)).verified) { failure = 'Verify that this CV belongs to you before applying.'; return }
    const now = new Date().toISOString()
    created = {
      id: uuid(),
      userId: req.auth.userId,
      jobId: job.id,
      companyId: company.id,
      resumeId: resume.id,
      job,
      candidateSnapshot: safeCandidateSnapshot(resume, account),
      candidateNote: String(req.body.note || '').trim().slice(0, 1500),
      channel: 'jobpilot',
      sourceType: 'direct',
      status: 'applied',
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    }
    store.applications.unshift(created)
    const conversation = conversationForApplication(store, created)
    created.conversationId = conversation.id
    for (const member of company.members || []) {
      if (!member.userId || member.status !== 'active') continue
      store.notifications ||= []
      store.notifications.unshift(createNotification({ userId: member.userId, type: 'new_application', title: `New applicant for ${job.title}`, detail: created.candidateSnapshot.name, href: '/employer/applicants' }))
    }
  })
  if (!created) return res.status(400).json({ error: failure || 'Application could not be submitted.' })
  await addAuditLog('marketplace.application_submitted', { applicationId: created.id, jobId: created.jobId, companyId: created.companyId, userId: created.userId })
  res.status(201).json({ application: created })
})

router.get('/conversations', async (req, res) => {
  const store = await readStore()
  const conversations = (store.conversations || []).filter(conversation => canAccessConversation(store, conversation, req.auth.user))
  const applications = store.applications || []
  const companies = store.companies || []
  res.json({
    conversations: conversations.map(conversation => ({
      ...conversation,
      application: applications.find(item => item.id === conversation.applicationId) || null,
      company: publicCompany(companies.find(item => item.id === conversation.companyId) || {}),
    })),
  })
})

router.get('/conversations/:id/messages', async (req, res) => {
  const store = await readStore()
  const conversation = (store.conversations || []).find(item => item.id === req.params.id)
  if (!canAccessConversation(store, conversation, req.auth.user)) return res.status(404).json({ error: 'Conversation not found.' })
  const messages = (store.messages || []).filter(message => message.conversationId === conversation.id && message.channel === 'jobpilot_chat').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  res.json({ conversation, messages })
})

router.post('/conversations/:id/messages', async (req, res) => {
  const body = String(req.body.body || '').trim().slice(0, 4000)
  if (!body) return res.status(400).json({ error: 'Write a message before sending.' })
  const unsafe = detectUnsafeMarketplaceText(body)
  if (unsafe) return res.status(422).json({ error: unsafe })
  let created = null
  let recipients = []
  await updateStore((store) => {
    const conversation = (store.conversations || []).find(item => item.id === req.params.id)
    if (!canAccessConversation(store, conversation, req.auth.user)) return
    if ((conversation.blockedBy || []).length) return
    created = {
      id: uuid(),
      userId: req.auth.userId,
      applicationId: conversation.applicationId,
      conversationId: conversation.id,
      channel: 'jobpilot_chat',
      body,
      readBy: [req.auth.userId],
      createdAt: new Date().toISOString(),
    }
    store.messages.unshift(created)
    conversation.lastMessageAt = created.createdAt
    conversation.updatedAt = created.createdAt
    const company = (store.companies || []).find(item => item.id === conversation.companyId)
    recipients = req.auth.user.role === 'client'
      ? (company?.members || []).filter(member => member.status === 'active').map(member => member.userId).filter(Boolean)
      : [conversation.candidateUserId]
    store.notifications ||= []
    for (const userId of recipients) store.notifications.unshift(createNotification({ userId, type: 'message', title: 'New JobPilot message', detail: 'Open the private application conversation to reply.', href: req.auth.user.role === 'client' ? '/employer/messages' : '/applications' }))
  })
  if (!created) return res.status(404).json({ error: 'Conversation is unavailable or blocked.' })
  const io = req.app.get('io')
  io?.to(`conversation:${created.conversationId}`).emit('message:new', created)
  await addAuditLog('marketplace.message_sent', { messageId: created.id, conversationId: created.conversationId, senderId: created.userId })
  res.status(201).json({ message: created })
})

router.post('/conversations/:id/read', async (req, res) => {
  let found = false
  await updateStore((store) => {
    const conversation = (store.conversations || []).find(item => item.id === req.params.id)
    if (!canAccessConversation(store, conversation, req.auth.user)) return
    found = true
    for (const message of store.messages || []) {
      if (message.conversationId !== conversation.id) continue
      message.readBy ||= []
      if (!message.readBy.includes(req.auth.userId)) message.readBy.push(req.auth.userId)
    }
  })
  if (!found) return res.status(404).json({ error: 'Conversation not found.' })
  res.json({ success: true })
})

router.post('/conversations/:id/report', async (req, res) => {
  let report = null
  await updateStore((store) => {
    const conversation = (store.conversations || []).find(item => item.id === req.params.id)
    if (!canAccessConversation(store, conversation, req.auth.user)) return
    report = { id: uuid(), conversationId: conversation.id, reporterId: req.auth.userId, reason: String(req.body.reason || 'suspicious').slice(0, 120), detail: String(req.body.detail || '').slice(0, 1200), status: 'open', createdAt: new Date().toISOString() }
    store.marketplaceReports ||= []
    store.marketplaceReports.unshift(report)
  })
  if (!report) return res.status(404).json({ error: 'Conversation not found.' })
  await addAuditLog('marketplace.conversation_reported', { reportId: report.id, conversationId: report.conversationId })
  res.status(201).json({ report })
})

router.post('/conversations/:id/block', async (req, res) => {
  let conversation = null
  await updateStore((store) => {
    const target = (store.conversations || []).find(item => item.id === req.params.id)
    if (!canAccessConversation(store, target, req.auth.user)) return
    target.blockedBy ||= []
    if (!target.blockedBy.includes(req.auth.userId)) target.blockedBy.push(req.auth.userId)
    target.updatedAt = new Date().toISOString()
    conversation = target
  })
  if (!conversation) return res.status(404).json({ error: 'Conversation not found.' })
  res.json({ conversation })
})

router.get('/notifications', async (req, res) => {
  const store = await readStore()
  res.json({ notifications: (store.notifications || []).filter(item => item.userId === req.auth.userId).slice(0, 100) })
})

router.post('/notifications/read', async (req, res) => {
  await updateStore((store) => {
    for (const notification of store.notifications || []) {
      if (notification.userId === req.auth.userId && !notification.readAt) notification.readAt = new Date().toISOString()
    }
  })
  res.json({ success: true })
})

export default router
