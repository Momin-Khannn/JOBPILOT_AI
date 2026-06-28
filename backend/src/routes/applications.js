import express from 'express'
import { v4 as uuid } from 'uuid'
import { addAuditLog, publicSummary, readStore, updateStore } from '../db/store.js'
import { requireAuth } from '../middleware/auth.js'
import { createFollowUpPlan, draftOutreach, generateDecisionReport, scoreJobMatch } from '../services/aiService.js'
import { normalizeJob } from '../services/jobService.js'
import { isJobClosed, refreshJobDeadlines } from '../services/jobProviderService.js'
import { evaluateResumeIdentity } from '../services/resumeIdentityService.js'
import { buildGhostingResolution, buildNegotiationPlan, ghostingSignal } from '../services/careerMovesService.js'
import { assertWhatsappRecipientConsent } from '../services/sendPolicy.js'
import { validateRequest } from '../middleware/validate.js'
import {
  ghostingPrepareBodySchema,
  idParamsSchema,
  negotiationPrepareBodySchema,
  workflowDraftBodySchema,
} from '../validation/schemas.js'

const router = express.Router()
router.use(requireAuth)
const validStatuses = new Set(['pending_review', 'approved', 'applied', 'sent_demo', 'interview', 'offer', 'rejected', 'follow_up_needed', 'job_closed'])

function profileForApplication(store, application, userId) {
  const resume = (store.resumes || []).find(item => item.id === application.resumeId && item.userId === userId)
  const user = (store.users || []).find(item => item.id === userId)
  return resume?.profile || user || {}
}

function requirePro(req, res) {
  if (req.auth.user.tier !== 'pro') {
    res.status(403).json({ error: 'Upgrade to Pro to use autonomous career moves.' })
    return false
  }
  return true
}

router.get('/', async (req, res) => {
  await updateStore((store) => refreshJobDeadlines(store))
  const store = await readStore()
  const preferences = (store.users || []).find(item => item.id === req.auth.userId)?.preferences || {}
  res.json({
    applications: (store.applications || [])
      .filter(item => item.userId === req.auth.userId)
      .map(item => ({
        ...item,
        agentSignals: {
          ghosting: ghostingSignal(item, store.inboxEvents || [], new Date(), preferences),
          negotiationAvailable: item.status === 'offer',
        },
      }))
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)),
    summary: publicSummary(store, req.auth.userId),
  })
})

router.get('/summary', async (req, res) => {
  await updateStore((store) => refreshJobDeadlines(store))
  const store = await readStore()
  res.json(publicSummary(store, req.auth.userId))
})

router.post('/queue', async (req, res) => {
  const store = await readStore()
  const resume = req.body.resumeId
    ? store.resumes.find(item => item.id === req.body.resumeId && item.userId === req.auth.userId)
    : (store.resumes || [])
      .filter(item => item.userId === req.auth.userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
  const inputJobs = req.body.jobs || []
  const channel = req.body.channel || 'gmail'
  const account = (store.users || []).find(item => item.id === req.auth.userId)
  const whatsappRecipientOptIn = req.body.whatsappRecipientOptIn === true

  if (!inputJobs.length) return res.status(400).json({ error: 'At least one job is required' })
  if (!resume) return res.status(400).json({ error: 'Upload and verify your CV before adding jobs to the application queue.' })
  if (channel === 'whatsapp' && !whatsappRecipientOptIn) {
    return res.status(400).json({ error: 'Confirm that every selected recipient explicitly permitted WhatsApp contact.' })
  }
  if (channel === 'whatsapp' && inputJobs.some(job => !job.recruiterPhone)) {
    return res.status(400).json({ error: 'Every WhatsApp application needs a recruiter phone number.' })
  }
  const ownership = resume.ownership || evaluateResumeIdentity(resume.profile, account)
  if (!ownership.verified) {
    return res.status(403).json({ error: 'Verify that this CV belongs to you before using it for applications.' })
  }

  const queued = []
  const skipped = []

  await updateStore((nextStore) => {
    refreshJobDeadlines(nextStore)
    for (const inputJob of inputJobs) {
      const job = normalizeJob(inputJob)
      if (isJobClosed(job)) {
        skipped.push({ job, reason: 'job_closed' })
        continue
      }
      const duplicate = nextStore.applications.find(app =>
        app.userId === req.auth.userId &&
        app.job?.company?.toLowerCase() === job.company.toLowerCase() &&
        app.job?.title?.toLowerCase() === job.title.toLowerCase()
      )

      if (duplicate) {
        skipped.push({ job, reason: 'duplicate' })
        continue
      }

      const score = resume?.profile ? scoreJobMatch(resume.profile, job) : {}
      const decisionReport = resume?.profile ? generateDecisionReport(resume.profile, job) : null
      const draft = draftOutreach({ profile: resume?.profile || req.auth.user, job, channel })
      const application = {
        id: uuid(),
        userId: req.auth.userId,
        job,
        resumeId: resume?.id || null,
        channel,
        status: 'pending_review',
        matchScore: score.matchScore || null,
        atsScore: score.atsScore || null,
        missingSkills: score.missingSkills || [],
        strengths: score.strengths || [],
        recommendation: decisionReport?.recommendation || 'Review',
        decisionReport,
        resumeTailoring: decisionReport?.resumeTailoring || null,
        companyResearch: decisionReport?.research || null,
        risk: decisionReport?.risk || null,
        interviewPrep: decisionReport?.interviewPrep || null,
        draft,
        whatsappConsent: channel === 'whatsapp' ? {
          recipientOptIn: true,
          basis: 'recipient_permission',
          recipientPhone: job.recruiterPhone,
          confirmedAt: new Date().toISOString(),
          confirmedByUserId: req.auth.userId,
        } : null,
        followUp: null,
        approvedAt: null,
        sentAt: null,
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      application.followUp = createFollowUpPlan({ ...application, profile: resume?.profile || req.auth.user }, 5)
      nextStore.applications.unshift(application)
      queued.push(application)
    }
  })

  await addAuditLog('applications.queued', { count: queued.length, skipped: skipped.length, channel, userId: req.auth.userId })
  res.status(201).json({ queued, skipped })
})

router.patch('/:id', async (req, res) => {
  let updated = null
  await updateStore((store) => {
    refreshJobDeadlines(store)
    const application = store.applications.find(item => item.id === req.params.id && item.userId === req.auth.userId)
    if (!application) return
    const previousStatus = application.status
    const allowed = ['status', 'notes', 'channel', 'draft']
    for (const key of allowed) {
      if (key === 'status' && !validStatuses.has(req.body.status)) continue
      if (req.body[key] !== undefined) application[key] = req.body[key]
    }
    if (req.body.draft !== undefined || req.body.channel !== undefined) {
      application.status = 'pending_review'
      application.approvedAt = null
      application.approvalSnapshot = null
      if (req.body.channel !== undefined) application.whatsappConsent = null
    }
    if (application.status !== previousStatus) {
      application.statusChangedAt = new Date().toISOString()
      if (application.status === 'interview') application.interviewAt = application.statusChangedAt
      if (application.status === 'offer') application.offerAt = application.statusChangedAt
    }
    application.updatedAt = new Date().toISOString()
    updated = application
  })

  if (!updated) return res.status(404).json({ error: 'Application not found' })
  await addAuditLog('applications.updated', { applicationId: updated.id, status: updated.status, userId: req.auth.userId })
  res.json({ application: updated })
})

router.post('/:id/approve', async (req, res) => {
  let approved = null
  let identityBlocked = false
  let whatsappConsentError = null
  await updateStore((store) => {
    refreshJobDeadlines(store)
    const application = store.applications.find(item => item.id === req.params.id && item.userId === req.auth.userId)
    if (!application) return
    const user = store.users.find(item => item.id === req.auth.userId)
    const resume = store.resumes.find(item => item.id === application.resumeId && item.userId === req.auth.userId)
    if (!resume || !(resume.ownership || evaluateResumeIdentity(resume.profile, user)).verified) {
      identityBlocked = true
      return
    }
    if (isJobClosed(application.job)) {
      application.status = 'job_closed'
      application.closedAt = application.job?.closedAt || application.job?.expiresAt || new Date().toISOString()
      application.updatedAt = new Date().toISOString()
      return
    }
    try {
      assertWhatsappRecipientConsent(application)
    } catch (error) {
      whatsappConsentError = error
      return
    }
    application.status = 'approved'
    application.approvedAt = new Date().toISOString()
    application.approvalSnapshot = {
      subject: application.draft?.subject || '',
      body: application.draft?.body || '',
      channel: application.channel,
      recipient: application.channel === 'whatsapp' ? application.job?.recruiterPhone || '' : application.job?.recruiterEmail || '',
      whatsappConsent: application.channel === 'whatsapp' ? { ...application.whatsappConsent } : null,
      job: application.job,
    }
    application.updatedAt = new Date().toISOString()
    approved = application
  })

  if (!approved) {
    if (whatsappConsentError) return res.status(whatsappConsentError.status || 403).json({ error: whatsappConsentError.message })
    if (identityBlocked) return res.status(403).json({ error: 'Verify the CV attached to this application before approval.' })
    const store = await readStore()
    const closed = store.applications.find(item => item.id === req.params.id && item.userId === req.auth.userId && item.status === 'job_closed')
    if (closed) return res.status(409).json({ error: 'This job is closed or expired and cannot be approved', application: closed })
    return res.status(404).json({ error: 'Application not found' })
  }
  await addAuditLog('applications.approved', { applicationId: approved.id, channel: approved.channel, userId: req.auth.userId })
  res.json({ application: approved })
})

router.post('/:id/ghosting/prepare', validateRequest({ params: idParamsSchema, body: ghostingPrepareBodySchema }), async (req, res) => {
  if (!requirePro(req, res)) return
  let resolution = null
  let conflict = null
  await updateStore((store) => {
    const application = (store.applications || []).find(item => item.id === req.params.id && item.userId === req.auth.userId)
    if (!application) return
    const signal = ghostingSignal(application, store.inboxEvents || [])
    if (!signal.eligible) {
      conflict = signal
      return
    }
    resolution = buildGhostingResolution({
      application,
      profile: profileForApplication(store, application, req.auth.userId),
      inboxEvents: store.inboxEvents || [],
      companySignal: req.body.companySignal,
      sourceUrl: req.body.sourceUrl,
      preferences: (store.users || []).find(item => item.id === req.auth.userId)?.preferences || {},
    })
    application.ghostingResolution = resolution
    application.updatedAt = new Date().toISOString()
  })

  if (conflict) return res.status(409).json({ error: conflict.reason, signal: conflict })
  if (!resolution) return res.status(404).json({ error: 'Application not found' })
  await addAuditLog('career_move.ghosting.prepared', { applicationId: req.params.id, userId: req.auth.userId })
  res.status(201).json({ resolution })
})

router.patch('/:id/ghosting/draft', validateRequest({ params: idParamsSchema, body: workflowDraftBodySchema }), async (req, res) => {
  if (!requirePro(req, res)) return
  let resolution = null
  await updateStore((store) => {
    const application = (store.applications || []).find(item => item.id === req.params.id && item.userId === req.auth.userId)
    if (!application?.ghostingResolution) return
    application.ghostingResolution.draft = { subject: req.body.subject, body: req.body.body }
    application.ghostingResolution.status = 'draft'
    application.ghostingResolution.approvedAt = null
    application.ghostingResolution.approvalSnapshot = null
    application.updatedAt = new Date().toISOString()
    resolution = application.ghostingResolution
  })
  if (!resolution) return res.status(404).json({ error: 'Prepare a ghosting-resolution draft first.' })
  await addAuditLog('career_move.ghosting.edited', { applicationId: req.params.id, userId: req.auth.userId })
  res.json({ resolution })
})

router.post('/:id/ghosting/approve', validateRequest({ params: idParamsSchema }), async (req, res) => {
  if (!requirePro(req, res)) return
  let resolution = null
  await updateStore((store) => {
    const application = (store.applications || []).find(item => item.id === req.params.id && item.userId === req.auth.userId)
    if (!application?.ghostingResolution?.draft) return
    const approvedAt = new Date().toISOString()
    application.ghostingResolution.status = 'approved'
    application.ghostingResolution.approvedAt = approvedAt
    application.ghostingResolution.approvalSnapshot = {
      ...application.ghostingResolution.draft,
      recipient: application.job?.recruiterEmail || '',
      approvedAt,
    }
    application.updatedAt = approvedAt
    resolution = application.ghostingResolution
  })
  if (!resolution) return res.status(404).json({ error: 'Prepare a ghosting-resolution draft first.' })
  await addAuditLog('career_move.ghosting.approved', { applicationId: req.params.id, userId: req.auth.userId })
  res.json({ resolution })
})

router.post('/:id/negotiation/prepare', validateRequest({ params: idParamsSchema, body: negotiationPrepareBodySchema }), async (req, res) => {
  if (!requirePro(req, res)) return
  let negotiation = null
  let wrongStage = false
  await updateStore((store) => {
    const application = (store.applications || []).find(item => item.id === req.params.id && item.userId === req.auth.userId)
    if (!application) return
    if (application.status !== 'offer') {
      wrongStage = true
      return
    }
    negotiation = buildNegotiationPlan({
      application,
      profile: profileForApplication(store, application, req.auth.userId),
      offer: req.body,
      preferences: (store.users || []).find(item => item.id === req.auth.userId)?.preferences || {},
    })
    application.negotiation = negotiation
    application.updatedAt = new Date().toISOString()
  })
  if (wrongStage) return res.status(409).json({ error: 'Negotiation Mode unlocks when this application reaches Offer.' })
  if (!negotiation) return res.status(404).json({ error: 'Application not found' })
  await addAuditLog('career_move.negotiation.prepared', { applicationId: req.params.id, userId: req.auth.userId, currency: negotiation.offer.currency })
  res.status(201).json({ negotiation })
})

router.patch('/:id/negotiation/draft', validateRequest({ params: idParamsSchema, body: workflowDraftBodySchema }), async (req, res) => {
  if (!requirePro(req, res)) return
  let negotiation = null
  await updateStore((store) => {
    const application = (store.applications || []).find(item => item.id === req.params.id && item.userId === req.auth.userId)
    if (!application?.negotiation) return
    application.negotiation.draft = { subject: req.body.subject, body: req.body.body }
    application.negotiation.status = 'draft'
    application.negotiation.approvedAt = null
    application.negotiation.approvalSnapshot = null
    application.updatedAt = new Date().toISOString()
    negotiation = application.negotiation
  })
  if (!negotiation) return res.status(404).json({ error: 'Prepare a negotiation plan first.' })
  await addAuditLog('career_move.negotiation.edited', { applicationId: req.params.id, userId: req.auth.userId })
  res.json({ negotiation })
})

router.post('/:id/negotiation/approve', validateRequest({ params: idParamsSchema }), async (req, res) => {
  if (!requirePro(req, res)) return
  let negotiation = null
  await updateStore((store) => {
    const application = (store.applications || []).find(item => item.id === req.params.id && item.userId === req.auth.userId)
    if (!application?.negotiation?.draft) return
    const approvedAt = new Date().toISOString()
    application.negotiation.status = 'approved'
    application.negotiation.approvedAt = approvedAt
    application.negotiation.approvalSnapshot = {
      ...application.negotiation.draft,
      recipient: application.job?.recruiterEmail || '',
      approvedAt,
    }
    application.updatedAt = approvedAt
    negotiation = application.negotiation
  })
  if (!negotiation) return res.status(404).json({ error: 'Prepare a negotiation plan first.' })
  await addAuditLog('career_move.negotiation.approved', { applicationId: req.params.id, userId: req.auth.userId })
  res.json({ negotiation })
})

export default router
