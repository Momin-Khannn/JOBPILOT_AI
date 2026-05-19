import express from 'express'
import { readStore, updateStore } from '../db/store.js'
import {
  classifyInboxMessage,
  draftOutreach,
  generateDecisionReport,
  generateInterviewPrep,
  scoreJobMatch,
  tailorResumeForJob,
} from '../services/aiService.js'

const router = express.Router()

router.post('/match', async (req, res) => {
  const store = await readStore()
  const resume = req.body.resumeId
    ? store.resumes.find(item => item.id === req.body.resumeId)
    : store.resumes?.[0]
  const jobs = req.body.jobs || []

  if (!resume?.profile) {
    return res.status(400).json({ error: 'Upload and parse a resume before matching jobs' })
  }

  res.json({
    jobs: jobs.map(job => ({ ...job, ...scoreJobMatch(resume.profile, job) })),
  })
})

router.post('/draft', async (req, res) => {
  const store = await readStore()
  const resume = req.body.resumeId
    ? store.resumes.find(item => item.id === req.body.resumeId)
    : store.resumes?.[0]
  const application = req.body.applicationId
    ? store.applications.find(item => item.id === req.body.applicationId)
    : null
  const job = req.body.job || application?.job

  if (!job) return res.status(400).json({ error: 'A job or applicationId is required' })

  const draft = draftOutreach({
    profile: resume?.profile || store.users?.[0] || {},
    job,
    channel: req.body.channel || application?.channel || 'gmail',
  })

  if (application) {
    await updateStore((nextStore) => {
      const target = nextStore.applications.find(item => item.id === application.id)
      if (target) {
        target.draft = draft
        target.updatedAt = new Date().toISOString()
      }
    })
  }

  res.json({ draft })
})

router.post('/decision-report', async (req, res) => {
  const store = await readStore()
  const resume = req.body.resumeId
    ? store.resumes.find(item => item.id === req.body.resumeId)
    : store.resumes?.[0]
  const application = req.body.applicationId
    ? store.applications.find(item => item.id === req.body.applicationId)
    : null
  const job = req.body.job || application?.job

  if (!job) return res.status(400).json({ error: 'A job or applicationId is required' })
  const report = generateDecisionReport(resume?.profile || store.users?.[0] || {}, job)

  if (application) {
    await updateStore((nextStore) => {
      const target = nextStore.applications.find(item => item.id === application.id)
      if (target) {
        target.decisionReport = report
        target.recommendation = report.recommendation
        target.risk = report.risk
        target.companyResearch = report.research
        target.resumeTailoring = report.resumeTailoring
        target.interviewPrep = report.interviewPrep
        target.updatedAt = new Date().toISOString()
      }
    })
  }

  res.json({ report })
})

router.post('/tailor-resume', async (req, res) => {
  const store = await readStore()
  const resume = req.body.resumeId
    ? store.resumes.find(item => item.id === req.body.resumeId)
    : store.resumes?.[0]
  const application = req.body.applicationId
    ? store.applications.find(item => item.id === req.body.applicationId)
    : null
  const job = req.body.job || application?.job

  if (!job) return res.status(400).json({ error: 'A job or applicationId is required' })
  const tailoring = tailorResumeForJob(resume?.profile || store.users?.[0] || {}, job)
  res.json({ tailoring })
})

router.post('/interview-prep', async (req, res) => {
  const store = await readStore()
  const resume = req.body.resumeId
    ? store.resumes.find(item => item.id === req.body.resumeId)
    : store.resumes?.[0]
  const application = req.body.applicationId
    ? store.applications.find(item => item.id === req.body.applicationId)
    : null
  const job = req.body.job || application?.job

  if (!job) return res.status(400).json({ error: 'A job or applicationId is required' })
  const prep = generateInterviewPrep(resume?.profile || store.users?.[0] || {}, job)
  res.json({ prep })
})

router.post('/classify-inbox', async (req, res) => {
  const classification = classifyInboxMessage(req.body)
  res.json({ classification })
})

export default router
