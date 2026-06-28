import express from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth.js'
import { addAuditLog, readStore, updateStore } from '../db/store.js'
import { buildProfile, ensureShareableProfile, normalizeProfile, publicProfile } from '../services/profileService.js'
import { validateImageUpload } from '../services/fileValidationService.js'
import { validateRequest } from '../middleware/validate.js'
import { profileImageBodySchema } from '../validation/schemas.js'

const router = express.Router()
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
})

function latestResume(store, userId) {
  return (store.resumes || [])
    .filter(item => item.userId === userId)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null
}

router.get('/public/:slug', async (req, res) => {
  const store = await readStore()
  const profile = (store.profiles || []).find(item => item.slug === String(req.params.slug).toLowerCase())
  const safeProfile = publicProfile(profile)
  if (!safeProfile) return res.status(404).json({ error: 'CV page not found' })
  res.json({ profile: safeProfile })
})

router.use(requireAuth)

router.get('/me', async (req, res) => {
  let profile = null
  await updateStore((store) => {
    const existing = (store.profiles || []).find(item => item.userId === req.auth.userId)
    profile = existing
      ? buildProfile({ user: req.auth.user, resume: latestResume(store, req.auth.userId), existing })
      : ensureShareableProfile(store, req.auth.user, { resume: latestResume(store, req.auth.userId), publishNew: true })
  })
  res.json({ profile })
})

router.put('/me', async (req, res) => {
  let saved = null
  let slugConflict = false
  await updateStore((store) => {
    const existing = (store.profiles || []).find(item => item.userId === req.auth.userId)
    const resume = latestResume(store, req.auth.userId)
    const profile = normalizeProfile(req.body.profile || {}, { user: req.auth.user, resume, existing })
    slugConflict = (store.profiles || []).some(item => item.userId !== req.auth.userId && item.slug === profile.slug)
    if (slugConflict) return
    const index = (store.profiles || []).findIndex(item => item.userId === req.auth.userId)
    if (index >= 0) store.profiles[index] = profile
    else store.profiles.push(profile)
    saved = profile
  })
  if (slugConflict) return res.status(409).json({ error: 'That public CV address is already in use' })
  await addAuditLog('profile.saved', { userId: req.auth.userId, slug: saved.slug, published: saved.published })
  res.json({ profile: saved })
})

router.post('/image', imageUpload.single('image'), validateRequest({ body: profileImageBodySchema }), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a JPG, PNG, WEBP, or GIF image under 3 MB' })
  const verifiedFile = await validateImageUpload(req.file)
  const kind = req.body.kind
  const dataUri = `data:${verifiedFile.mime};base64,${req.file.buffer.toString('base64')}`
  let saved = null
  await updateStore((store) => {
    const existing = (store.profiles || []).find(item => item.userId === req.auth.userId)
    const profile = buildProfile({ user: req.auth.user, resume: latestResume(store, req.auth.userId), existing })
    profile.images[kind] = dataUri
    profile.updatedAt = new Date().toISOString()
    const index = (store.profiles || []).findIndex(item => item.userId === req.auth.userId)
    if (index >= 0) store.profiles[index] = profile
    else store.profiles.push(profile)
    saved = profile
  })
  res.json({ profile: saved })
})

export default router
