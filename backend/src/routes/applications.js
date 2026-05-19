import express from 'express'
import { v4 as uuid } from 'uuid'
import { addAuditLog, publicSummary, readStore, updateStore } from '../db/store.js'
import { createFollowUpPlan, draftOutreach, generateDecisionReport, scoreJobMatch } from '../services/aiService.js'
import { normalizeJob } from '../services/jobService.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const store = await readStore()
  res.json({
    applications: store.applications || [],
    summary: publicSummary(store),
  })
})

router.get('/summary', async (req, res) => {
  const store = await readStore()
  res.json(publicSummary(store))
})

router.post('/queue', async (req, res) => {
  const store = await readStore()
  const resume = req.body.resumeId
    ? store.resumes.find(item => item.id === req.body.resumeId)
    : store.resumes?.[0]
  const inputJobs = req.body.jobs || []
  const channel = req.body.channel || 'gmail'

  if (!inputJobs.length) return res.status(400).json({ error: 'At least one job is required' })

  const queued = []
  const skipped = []

  await updateStore((nextStore) => {
    for (const inputJob of inputJobs) {
      const job = normalizeJob(inputJob)
      const duplicate = nextStore.applications.find(app =>
        app.job.company.toLowerCase() === job.company.toLowerCase() &&
        app.job.title.toLowerCase() === job.title.toLowerCase()
      )

      if (duplicate) {
        skipped.push({ job, reason: 'duplicate' })
        continue
      }

      const score = resume?.profile ? scoreJobMatch(resume.profile, job) : {}
      const decisionReport = resume?.profile ? generateDecisionReport(resume.profile, job) : null
      const draft = draftOutreach({ profile: resume?.profile || nextStore.users[0], job, channel })
      const application = {
        id: uuid(),
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
        followUp: null,
        approvedAt: null,
        sentAt: null,
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      application.followUp = createFollowUpPlan({ ...application, profile: resume?.profile || nextStore.users[0] }, 5)
      nextStore.applications.unshift(application)
      queued.push(application)
    }
  })

  await addAuditLog('applications.queued', { count: queued.length, skipped: skipped.length, channel })
  res.status(201).json({ queued, skipped })
})

router.patch('/:id', async (req, res) => {
  let updated = null
  await updateStore((store) => {
    const application = store.applications.find(item => item.id === req.params.id)
    if (!application) return
    const allowed = ['status', 'notes', 'channel', 'draft']
    for (const key of allowed) {
      if (req.body[key] !== undefined) application[key] = req.body[key]
    }
    application.updatedAt = new Date().toISOString()
    updated = application
  })

  if (!updated) return res.status(404).json({ error: 'Application not found' })
  await addAuditLog('applications.updated', { applicationId: updated.id, status: updated.status })
  res.json({ application: updated })
})

router.post('/:id/approve', async (req, res) => {
  let approved = null
  await updateStore((store) => {
    const application = store.applications.find(item => item.id === req.params.id)
    if (!application) return
    application.status = 'approved'
    application.approvedAt = new Date().toISOString()
    application.approvalSnapshot = {
      subject: application.draft?.subject || '',
      body: application.draft?.body || '',
      channel: application.channel,
      job: application.job,
    }
    application.updatedAt = new Date().toISOString()
    approved = application
  })

  if (!approved) return res.status(404).json({ error: 'Application not found' })
  await addAuditLog('applications.approved', { applicationId: approved.id, channel: approved.channel })
  res.json({ application: approved })
})

export default router
