import express from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth.js'
import { readStore, updateStore } from '../db/store.js'
import {
  classifyInboxMessage,
  draftOutreach,
  generateDecisionReport,
  generateInterviewPrep,
  scoreJobMatch,
  tailorResumeForJob,
} from '../services/aiService.js'
import { analyzeInterviewRecording, generateGroundedCoverLetter } from '../services/geminiService.js'
import { publicInterviewSession } from '../services/careerService.js'

const router = express.Router()
router.use(requireAuth)
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
})

function latestResumeForUser(store, userId, resumeId) {
  if (resumeId) return (store.resumes || []).find(item => item.id === resumeId && item.userId === userId)
  return (store.resumes || [])
    .filter(item => item.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
}

function applicationForUser(store, userId, applicationId) {
  return (store.applications || []).find(item => item.id === applicationId && item.userId === userId)
}

router.post('/match', async (req, res) => {
  const store = await readStore()
  const resume = latestResumeForUser(store, req.auth.userId, req.body.resumeId)
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
  const resume = latestResumeForUser(store, req.auth.userId, req.body.resumeId)
  const application = req.body.applicationId ? applicationForUser(store, req.auth.userId, req.body.applicationId) : null
  const job = req.body.job || application?.job

  if (!job) return res.status(400).json({ error: 'A job or applicationId is required' })

  const draft = draftOutreach({
    profile: resume?.profile || req.auth.user || {},
    job,
    channel: req.body.channel || application?.channel || 'gmail',
  })

  if (application) {
    await updateStore((nextStore) => {
      const target = nextStore.applications.find(item => item.id === application.id && item.userId === req.auth.userId)
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
  const resume = latestResumeForUser(store, req.auth.userId, req.body.resumeId)
  const application = req.body.applicationId ? applicationForUser(store, req.auth.userId, req.body.applicationId) : null
  const job = req.body.job || application?.job

  if (req.auth.user.tier !== 'pro') return res.status(403).json({ error: 'Upgrade to Pro to access AI Decision Reports.' })
  if (!job) return res.status(400).json({ error: 'A job or applicationId is required' })
  const report = generateDecisionReport(resume?.profile || req.auth.user || {}, job)

  if (application) {
    await updateStore((nextStore) => {
      const target = nextStore.applications.find(item => item.id === application.id && item.userId === req.auth.userId)
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
  const resume = latestResumeForUser(store, req.auth.userId, req.body.resumeId)
  const application = req.body.applicationId ? applicationForUser(store, req.auth.userId, req.body.applicationId) : null
  const job = req.body.job || application?.job

  if (req.auth.user.tier !== 'pro') return res.status(403).json({ error: 'Upgrade to Pro to access AI Resume Tailoring.' })
  if (!job) return res.status(400).json({ error: 'A job or applicationId is required' })
  const tailoring = tailorResumeForJob(resume?.profile || req.auth.user || {}, job)
  res.json({ tailoring })
})

router.post('/interview-prep', async (req, res) => {
  const store = await readStore()
  const resume = latestResumeForUser(store, req.auth.userId, req.body.resumeId)
  const application = req.body.applicationId ? applicationForUser(store, req.auth.userId, req.body.applicationId) : null
  const job = req.body.job || application?.job

  if (req.auth.user.tier !== 'pro') return res.status(403).json({ error: 'Upgrade to Pro to access AI Interview Prep.' })
  if (!job) return res.status(400).json({ error: 'A job or applicationId is required' })
  const prep = generateInterviewPrep(resume?.profile || req.auth.user || {}, job)
  res.json({ prep })
})

router.post('/cover-letter', async (req, res) => {
  if (req.auth.user.tier !== 'pro') return res.status(403).json({ error: 'Upgrade to Pro to generate cover letters.' })
  const store = await readStore()
  const resume = latestResumeForUser(store, req.auth.userId, req.body.resumeId)
  const application = applicationForUser(store, req.auth.userId, req.body.applicationId)
  if (!resume?.profile) return res.status(400).json({ error: 'Upload a resume before generating a cover letter.' })
  if (!application?.job) return res.status(404).json({ error: 'Application not found.' })

  const coverLetter = await generateGroundedCoverLetter(resume.profile, application.job)
  await updateStore((nextStore) => {
    const target = applicationForUser(nextStore, req.auth.userId, req.body.applicationId)
    if (target) {
      target.coverLetter = coverLetter
      target.updatedAt = new Date().toISOString()
    }
  })
  res.json({ coverLetter })
})

router.post('/interview-audio', audioUpload.single('audio'), async (req, res) => {
  if (req.auth.user.tier !== 'pro') return res.status(403).json({ error: 'Upgrade to Pro to use recorded interview coaching.' })
  if (!req.file?.buffer) return res.status(400).json({ error: 'Attach an interview recording.' })

  const store = await readStore()
  const session = (store.interviewSessions || []).find(item => item.id === req.body.sessionId && item.userId === req.auth.userId)
  if (!session) return res.status(404).json({ error: 'Interview session not found.' })
  if (session.status === 'completed') return res.status(409).json({ error: 'This interview is already complete.' })
  const question = session.questions?.[session.currentIndex]
  if (!question) return res.status(409).json({ error: 'No unanswered interview question remains.' })
  const resume = latestResumeForUser(store, req.auth.userId)
  const analysis = await analyzeInterviewRecording({
    audio: { buffer: req.file.buffer, mimeType: req.file.mimetype },
    question: question.prompt,
    profile: resume?.profile || req.auth.user,
    role: session.role,
    company: session.company,
  })

  let updated = null
  await updateStore((nextStore) => {
    const target = (nextStore.interviewSessions || []).find(item => item.id === session.id && item.userId === req.auth.userId)
    if (!target || target.status === 'completed' || target.currentIndex !== session.currentIndex) return
    target.responses.push({
      questionId: question.id,
      question: question.prompt,
      answer: analysis.transcript,
      feedback: analysis.feedback,
      answerMode: 'recorded',
      answeredAt: new Date().toISOString(),
    })
    target.currentIndex += 1
    target.updatedAt = new Date().toISOString()
    if (target.currentIndex >= target.questions.length) {
      target.status = 'completed'
      target.completedAt = target.updatedAt
    }
    updated = target
  })
  if (!updated) return res.status(409).json({ error: 'The interview changed while the recording was being evaluated. Please refresh.' })
  res.json({ transcript: analysis.transcript, feedback: analysis.feedback, session: publicInterviewSession(updated) })
})

router.post('/classify-inbox', async (req, res) => {
  const classification = classifyInboxMessage(req.body)
  res.json({ classification })
})

export default router
