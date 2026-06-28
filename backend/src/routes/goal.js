import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import { readStore, updateStore } from '../db/store.js'

const router = express.Router()
router.use(requireAuth)

function goalFromUser(user = {}) {
  return {
    roles: user.preferences?.roles || [],
    locations: user.preferences?.locations || [],
    jobTypes: user.preferences?.jobTypes || [],
    experienceLevel: user.preferences?.experienceLevel || '',
    minSalary: Number(user.preferences?.minSalary || 0),
    remotePreference: user.preferences?.remotePreference || 'any',
    salaryCurrency: user.preferences?.salaryCurrency || 'USD',
  }
}

router.get('/', async (req, res) => {
  const store = await readStore()
  const user = (store.users || []).find(item => item.id === req.auth.userId)
  res.json({ goal: goalFromUser(user) })
})

router.put('/', async (req, res) => {
  let goal = null
  await updateStore((store) => {
    const user = (store.users || []).find(item => item.id === req.auth.userId)
    if (!user) return
    const incoming = req.body.goal || {}
    user.preferences = {
      ...user.preferences,
      roles: Array.isArray(incoming.roles) ? incoming.roles.map(String).map(v => v.trim()).filter(Boolean).slice(0, 12) : user.preferences.roles,
      locations: Array.isArray(incoming.locations) ? incoming.locations.map(String).map(v => v.trim()).filter(Boolean).slice(0, 12) : user.preferences.locations,
      jobTypes: Array.isArray(incoming.jobTypes) ? incoming.jobTypes.map(String).map(v => v.trim()).filter(Boolean).slice(0, 8) : user.preferences.jobTypes,
      experienceLevel: String(incoming.experienceLevel || user.preferences.experienceLevel || '').trim().slice(0, 80),
      minSalary: Math.max(0, Number(incoming.minSalary || 0)),
      remotePreference: ['any', 'remote', 'hybrid', 'onsite'].includes(incoming.remotePreference) ? incoming.remotePreference : user.preferences.remotePreference || 'any',
      salaryCurrency: /^[A-Za-z]{3,5}$/.test(String(incoming.salaryCurrency || '')) ? String(incoming.salaryCurrency).toUpperCase() : user.preferences.salaryCurrency || 'USD',
    }
    goal = goalFromUser(user)
  })
  if (!goal) return res.status(404).json({ error: 'User not found' })
  res.json({ goal })
})

export default router
