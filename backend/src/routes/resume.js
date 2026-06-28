import express from 'express'
import multer from 'multer'
import { v4 as uuid } from 'uuid'
import { requireAuth } from '../middleware/auth.js'
import { parseResumeUpload, sanitizeResume } from '../services/resumeService.js'
import { addAuditLog, readStore, updateStore } from '../db/store.js'
import { mergeResumeIntoProfile } from '../services/profileService.js'
import { sendBusinessEmail } from '../services/emailService.js'
import { createResumeVerification, evaluateResumeIdentity, verifyResumeCode } from '../services/resumeIdentityService.js'
import { validateRequest } from '../middleware/validate.js'
import { idParamsSchema, resumeVerificationBodySchema } from '../validation/schemas.js'

const router = express.Router()
router.use(requireAuth)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
})

router.get('/latest', async (req, res) => {
  const store = await readStore()
  const resume = (store.resumes || [])
    .filter(item => item.userId === req.auth.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
  res.json({ resume: sanitizeResume(resume) })
})

router.post('/parse', upload.single('resume'), async (req, res, next) => {
  try {
    const parsed = await parseResumeUpload(req.file)
    const currentStore = await readStore()
    const account = (currentStore.users || []).find(item => item.id === req.auth.userId)
    const resume = {
      id: uuid(),
      userId: req.auth.userId,
      fileName: parsed.file.fileName,
      mimeType: parsed.file.mime,
      size: req.file.size,
      rawText: parsed.rawText,
      fileBase64: req.file.buffer.toString('base64'),
      profile: parsed.profile,
      ownership: evaluateResumeIdentity(parsed.profile, account),
      createdAt: new Date().toISOString(),
    }

    await updateStore((store) => {
      store.resumes.unshift(resume)
      const ownedResumes = store.resumes.filter(item => item.userId === req.auth.userId).slice(0, 10)
      const otherResumes = store.resumes.filter(item => item.userId !== req.auth.userId)
      store.resumes = [...ownedResumes, ...otherResumes]
      const user = store.users.find(item => item.id === req.auth.userId)
      if (user && resume.ownership.verified) {
        user.phone = resume.profile?.phone || user.phone
        const profileIndex = (store.profiles || []).findIndex(item => item.userId === req.auth.userId)
        const existingProfile = profileIndex >= 0 ? store.profiles[profileIndex] : null
        const mergedProfile = mergeResumeIntoProfile(existingProfile, resume, user)
        if (profileIndex >= 0) store.profiles[profileIndex] = mergedProfile
        else store.profiles.push(mergedProfile)
      }
    })
    await addAuditLog('resume.parsed', { resumeId: resume.id, fileName: resume.fileName, userId: req.auth.userId })

    res.json({ resume: sanitizeResume(resume) })
  } catch (err) {
    next(err)
  }
})

router.post('/:id/ownership/start', validateRequest({ params: idParamsSchema }), async (req, res) => {
  const store = await readStore()
  const resume = (store.resumes || []).find(item => item.id === req.params.id && item.userId === req.auth.userId)
  if (!resume) return res.status(404).json({ error: 'Resume not found.' })
  if (resume.ownership?.verified) return res.json({ verified: true })
  const targetEmail = resume.ownership?.resumeEmail || resume.profile?.email
  if (!targetEmail) return res.status(400).json({ error: 'This resume does not contain an email address that can be verified.' })

  const verification = createResumeVerification(resume.id)
  await updateStore((nextStore) => {
    const target = nextStore.resumes.find(item => item.id === resume.id && item.userId === req.auth.userId)
    if (target) {
      target.ownership ||= evaluateResumeIdentity(target.profile, req.auth.user)
      target.ownership.challenge = verification.challenge
    }
  })
  await sendBusinessEmail({
    to: targetEmail,
    subject: 'Verify your CV for JobPilot AI',
    text: `Your JobPilot AI CV verification code is ${verification.code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
    html: `<p>Your JobPilot AI CV verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${verification.code}</p><p>It expires in 10 minutes.</p>`,
  })
  res.json({ sent: true, emailHint: String(targetEmail).replace(/^(.{2}).*(@.*)$/, '$1***$2') })
})

router.post('/:id/ownership/verify', validateRequest({ params: idParamsSchema, body: resumeVerificationBodySchema }), async (req, res) => {
  let verifiedResume = null
  let state = 'invalid'
  await updateStore((store) => {
    const resume = store.resumes.find(item => item.id === req.params.id && item.userId === req.auth.userId)
    if (!resume) {
      state = 'missing'
      return
    }
    resume.ownership ||= evaluateResumeIdentity(resume.profile, req.auth.user)
    resume.ownership.challenge ||= {}
    resume.ownership.challenge.attempts = Number(resume.ownership.challenge.attempts || 0) + 1
    if (!verifyResumeCode(resume, req.body.code)) return
    resume.ownership = {
      ...resume.ownership,
      status: 'verified',
      verified: true,
      method: 'resume-email-otp',
      verifiedAt: new Date().toISOString(),
      challenge: null,
    }
    const user = store.users.find(item => item.id === req.auth.userId)
    if (user) {
      user.phone = resume.profile?.phone || user.phone
      const profileIndex = (store.profiles || []).findIndex(item => item.userId === req.auth.userId)
      const existingProfile = profileIndex >= 0 ? store.profiles[profileIndex] : null
      const merged = mergeResumeIntoProfile(existingProfile, resume, user)
      if (profileIndex >= 0) store.profiles[profileIndex] = merged
      else store.profiles.push(merged)
    }
    verifiedResume = resume
    state = 'verified'
  })
  if (state === 'missing') return res.status(404).json({ error: 'Resume not found.' })
  if (!verifiedResume) return res.status(400).json({ error: 'The verification code is invalid, expired, or has too many attempts.' })
  res.json({ resume: sanitizeResume(verifiedResume) })
})

export default router
