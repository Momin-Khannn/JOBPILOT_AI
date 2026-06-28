import express from 'express'
import { requireAuth, requireOwner } from '../middleware/auth.js'
import {
  clientUpdateAgentStatus,
  sendClientUpdate,
  testClientUpdateAgentMailbox,
} from '../services/clientUpdateAgentService.js'
import {
  runSoftwareChangeUpdateScan,
  softwareChangeAgentStatus,
} from '../services/softwareChangeUpdateAgentService.js'
import {
  portalUpdateAgentStatus,
  refreshPortalUpdateState,
} from '../services/portalUpdateAgentService.js'
import { validateRequest } from '../middleware/validate.js'
import { clientUpdateBodySchema, forceBodySchema } from '../validation/schemas.js'

const router = express.Router()
router.use(requireAuth, requireOwner)

router.get('/status', async (req, res) => {
  const [agent, softwareChangeAgent, portalUpdateAgent] = await Promise.all([
    clientUpdateAgentStatus(),
    softwareChangeAgentStatus(),
    portalUpdateAgentStatus(),
  ])
  res.json({ ...agent, softwareChangeAgent, portalUpdateAgent })
})

router.post('/test-mailbox', async (req, res) => {
  res.json(await testClientUpdateAgentMailbox())
})

router.post('/send', validateRequest({ body: clientUpdateBodySchema }), async (req, res) => {
  const title = String(req.body.title || '').trim()
  const summary = String(req.body.summary || '').trim()
  const changes = req.body.changes || []
  const actionUrl = String(req.body.actionUrl || '').trim()
  const targetUserIds = Array.isArray(req.body.targetUserIds) ? req.body.targetUserIds : []

  if (!title) return res.status(400).json({ error: 'Update title is required' })
  if (!summary) return res.status(400).json({ error: 'Update summary is required' })

  const result = await sendClientUpdate({
    title,
    summary,
    changes,
    actionUrl,
    targetUserIds,
    activeSessionOnly: Boolean(req.body.activeSessionOnly),
    force: Boolean(req.body.force),
    personalize: req.body.personalize !== false,
  })

  res.json(result)
})

router.post('/scan-software', validateRequest({ body: forceBodySchema }), async (req, res) => {
  const result = await runSoftwareChangeUpdateScan({
    force: Boolean(req.body.force),
  })
  res.json(result)
})

router.post('/refresh-portals', async (req, res) => {
  res.json(await refreshPortalUpdateState({ source: 'owner_manual' }))
})

export default router
