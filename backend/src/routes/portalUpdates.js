import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import { portalUpdateAgentStatus } from '../services/portalUpdateAgentService.js'

const router = express.Router()
router.use(requireAuth)

router.get('/status', async (req, res) => {
  const status = await portalUpdateAgentStatus()
  const portal = status.portalUpdateState
  res.json({
    agentName: status.agentName,
    updatedAt: portal.updatedAt,
    version: portal.version,
    clientPortal: portal.clientPortal,
    links: portal.links,
  })
})

export default router
