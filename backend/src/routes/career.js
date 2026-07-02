import express from 'express'
import { v4 as uuid } from 'uuid'
import { addAuditLog, readStore, updateStore } from '../db/store.js'
import { requireAuth } from '../middleware/auth.js'
import {
  buildFunnelAnalytics,
  buildInterviewQuestions,
  buildSkillGap,
  evaluateInterviewAnswer,
  publicInterviewSession,
} from '../services/careerService.js'
import { analyzeInterviewAnswer, geminiConfigured } from '../services/geminiService.js'

const router = express.Router()
router.use(requireAuth)

function userContext(store, userId) {
  const user = (store.users || []).find(item => item.id === userId)
  const applications = (store.applications || [])
    .filter(item => item.userId === userId)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  const resume = (store.resumes || [])
    .filter(item => item.userId === userId)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null
  const profile = (store.profiles || []).find(item => item.userId === userId) || null
  return { user, applications, resume, profile }
}

router.get('/overview', async (req, res) => {
  const store = await readStore()
  const { user, applications, resume, profile } = userContext(store, req.auth.userId)
  const roles = user?.preferences?.roles || []
  const sessions = (store.interviewSessions || [])
    .filter(item => item.userId === req.auth.userId)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, 8)
    .map(publicInterviewSession)

  res.json({
    analytics: buildFunnelAnalytics(applications),
    skillGap: buildSkillGap({ applications, resume, profile, roles, skillAchievements: user?.skillAchievements }),
    applications: applications.map(app => ({
      id: app.id,
      role: app.job?.title || 'Untitled role',
      company: app.job?.company || 'Unknown company',
      status: app.status,
      matchScore: app.matchScore,
    })),
    sessions,
    interviewCoach: {
      aiEnabled: geminiConfigured(),
      typedAnswers: geminiConfigured() ? 'ai' : 'structured',
      recordedAnswers: geminiConfigured(),
    },
  })
})

router.patch('/skills/:skill', async (req, res) => {
  const requestedSkill = String(req.params.skill || '').trim().slice(0, 100)
  if (!requestedSkill) return res.status(400).json({ error: 'Choose a skill to update.' })
  if (typeof req.body.achieved !== 'boolean') return res.status(400).json({ error: 'Achieved must be true or false.' })

  let skillGap = null
  let canonicalSkill = ''
  await updateStore((store) => {
    const { user, applications, resume, profile } = userContext(store, req.auth.userId)
    if (!user) return
    const roles = user.preferences?.roles || []
    const current = buildSkillGap({ applications, resume, profile, roles, skillAchievements: user.skillAchievements })
    canonicalSkill = current.gaps.find(item => item.skill.toLowerCase() === requestedSkill.toLowerCase())?.skill || ''
    if (!canonicalSkill) return

    user.skillAchievements ||= {}
    if (req.body.achieved) user.skillAchievements[canonicalSkill] = new Date().toISOString()
    else delete user.skillAchievements[canonicalSkill]
    skillGap = buildSkillGap({ applications, resume, profile, roles, skillAchievements: user.skillAchievements })
  })

  if (!canonicalSkill) return res.status(404).json({ error: 'That skill is not in your current CV learning plan.' })
  await addAuditLog('career.skill.updated', { userId: req.auth.userId, skill: canonicalSkill, achieved: req.body.achieved })
  res.json({ skill: canonicalSkill, achieved: req.body.achieved, skillGap })
})

router.post('/interviews', async (req, res) => {
  if (req.auth.user.tier !== 'pro') return res.status(403).json({ error: 'Upgrade to Pro to access the Interview Coach.' })

  let created = null
  await updateStore((store) => {
    const { user, applications } = userContext(store, req.auth.userId)
    const application = req.body.applicationId
      ? applications.find(item => item.id === req.body.applicationId)
      : null
    const fallbackRole = String(req.body.role || user?.preferences?.roles?.[0] || 'your target role').trim().slice(0, 120)
    const job = application?.job || { title: fallbackRole, company: 'your target company', tags: [] }
    const now = new Date().toISOString()
    created = {
      id: uuid(),
      userId: req.auth.userId,
      applicationId: application?.id || null,
      role: job.title || fallbackRole,
      company: job.company || 'your target company',
      questions: buildInterviewQuestions({ job, prep: application?.interviewPrep }),
      responses: [],
      currentIndex: 0,
      status: 'in_progress',
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    }
    store.interviewSessions ||= []
    store.interviewSessions.unshift(created)
    store.interviewSessions = store.interviewSessions.slice(0, 100)
  })
  await addAuditLog('career.interview.started', { userId: req.auth.userId, sessionId: created.id, applicationId: created.applicationId })
  res.status(201).json({ session: publicInterviewSession(created) })
})

router.post('/interviews/:id/answer', async (req, res) => {
  const answer = String(req.body.answer || '').trim().slice(0, 6000)
  if (answer.length < 20) return res.status(400).json({ error: 'Give a fuller answer so the coach has enough evidence to evaluate.' })

  const store = await readStore()
  const context = userContext(store, req.auth.userId)
  const snapshot = (store.interviewSessions || []).find(item => item.id === req.params.id && item.userId === req.auth.userId)
  if (!snapshot) return res.status(404).json({ error: 'Interview session not found' })
  if (snapshot.status === 'completed') return res.status(409).json({ error: 'This interview is already complete.' })
  const question = snapshot.questions?.[snapshot.currentIndex]
  if (!question) return res.status(409).json({ error: 'No unanswered interview question remains.' })

  let feedback = evaluateInterviewAnswer(answer, question)
  feedback.source = 'structured-fallback'
  if (geminiConfigured()) {
    try {
      feedback = await analyzeInterviewAnswer({
        answer,
        question,
        profile: context.resume?.profile || context.profile || req.auth.user,
        role: snapshot.role,
        company: snapshot.company,
      })
    } catch (error) {
      console.warn('Interview AI coaching fell back to structured scoring:', error.message)
    }
  }

  let updated = null
  let conflict = ''
  await updateStore((nextStore) => {
    const session = (nextStore.interviewSessions || []).find(item => item.id === req.params.id && item.userId === req.auth.userId)
    if (!session) return
    if (session.status === 'completed') {
      conflict = 'This interview is already complete.'
      return
    }
    if (session.currentIndex !== snapshot.currentIndex || session.questions?.[session.currentIndex]?.id !== question.id) {
      conflict = 'This interview changed while your answer was being coached. Refresh and try again.'
      return
    }
    session.responses.push({
      questionId: question.id,
      question: question.prompt,
      answer,
      feedback,
      answerMode: 'typed',
      answeredAt: new Date().toISOString(),
    })
    session.currentIndex += 1
    session.updatedAt = new Date().toISOString()
    if (session.currentIndex >= session.questions.length) {
      session.status = 'completed'
      session.completedAt = session.updatedAt
    }
    updated = session
  })

  if (conflict) return res.status(409).json({ error: conflict })
  if (!updated) return res.status(404).json({ error: 'Interview session not found' })
  res.json({
    feedback: updated.responses.at(-1)?.feedback || null,
    session: publicInterviewSession(updated),
  })
})

export default router
