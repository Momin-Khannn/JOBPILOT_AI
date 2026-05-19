import express from 'express'
import multer from 'multer'
import { v4 as uuid } from 'uuid'
import { parseResumeUpload } from '../services/resumeService.js'
import { addAuditLog, readStore, updateStore } from '../db/store.js'

const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
})

router.get('/latest', async (req, res) => {
  const store = await readStore()
  res.json({ resume: store.resumes?.[0] || null })
})

router.post('/parse', upload.single('resume'), async (req, res, next) => {
  try {
    const parsed = await parseResumeUpload(req.file)
    const resume = {
      id: uuid(),
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      rawText: parsed.rawText,
      profile: parsed.profile,
      createdAt: new Date().toISOString(),
    }

    await updateStore((store) => {
      store.resumes.unshift(resume)
      store.resumes = store.resumes.slice(0, 10)
      store.users[0].name = resume.profile.name || store.users[0].name
      store.users[0].email = resume.profile.email || store.users[0].email
      store.users[0].phone = resume.profile.phone || store.users[0].phone
    })
    await addAuditLog('resume.parsed', { resumeId: resume.id, fileName: resume.fileName })

    res.json({ resume })
  } catch (err) {
    next(err)
  }
})

export default router
