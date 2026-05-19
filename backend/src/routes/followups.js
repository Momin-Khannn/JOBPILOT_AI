import express from 'express'
import { v4 as uuid } from 'uuid'
import { addAuditLog, readStore, updateStore } from '../db/store.js'
import { createFollowUpPlan } from '../services/aiService.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const store = await readStore()
  const followUps = (store.followUps || []).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
  res.json({ followUps })
})

router.post('/schedule', async (req, res) => {
  let followUp = null
  await updateStore((store) => {
    const application = store.applications.find(item => item.id === req.body.applicationId)
    if (!application) return

    followUp = {
      id: uuid(),
      applicationId: application.id,
      company: application.job.company,
      role: application.job.title,
      ...createFollowUpPlan(application, req.body.days || 5),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store.followUps.unshift(followUp)
    application.followUp = followUp
    application.updatedAt = new Date().toISOString()
  })

  if (!followUp) return res.status(404).json({ error: 'Application not found' })
  await addAuditLog('followup.scheduled', { followUpId: followUp.id, applicationId: followUp.applicationId })
  res.status(201).json({ followUp })
})

router.patch('/:id', async (req, res) => {
  let followUp = null
  await updateStore((store) => {
    followUp = store.followUps.find(item => item.id === req.params.id)
    if (!followUp) return
    if (req.body.status) followUp.status = req.body.status
    if (req.body.dueAt) followUp.dueAt = req.body.dueAt
    if (req.body.body) followUp.body = req.body.body
    followUp.updatedAt = new Date().toISOString()
  })

  if (!followUp) return res.status(404).json({ error: 'Follow-up not found' })
  await addAuditLog('followup.updated', { followUpId: followUp.id, status: followUp.status })
  res.json({ followUp })
})

export default router
