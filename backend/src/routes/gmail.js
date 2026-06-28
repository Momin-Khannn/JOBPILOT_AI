import express from 'express'
import crypto from 'crypto'
import { addAuditLog, readStore, updateStore } from '../db/store.js'
import { requireAuth } from '../middleware/auth.js'
import { decryptJson, encryptJson } from '../services/cryptoService.js'
import { createFollowUpPlan } from '../services/aiService.js'
import { evaluateResumeIdentity } from '../services/resumeIdentityService.js'
import { exchangeCodeForTokens, getAuthUrl, googleOAuthConfigured, realSendEnabled, sendGmail, verifyGmailConnection } from '../services/gmailService.js'
import { isJobClosed, refreshJobDeadlines } from '../services/jobProviderService.js'
import { assertApprovedApplication, assertDailyLimit, incrementDailyUsage } from '../services/sendPolicy.js'
import { publicFrontendUrl } from '../config/publicUrls.js'
import { validateRequest } from '../middleware/validate.js'
import { workflowSendBodySchema } from '../validation/schemas.js'

const router = express.Router()

router.get('/callback', async (req, res) => {
  try {
    if (req.query.error) return res.redirect(`${publicFrontendUrl()}/gmail?gmail=permission-denied`)
    if (!req.query.code || !req.query.state) return res.redirect(`${publicFrontendUrl()}/gmail?gmail=invalid-callback`)

    const oauthState = String(req.query.state)
    const stateStore = await readStore()
    const stateSession = (stateStore.sessions || []).find(item => item.gmailOAuthState === oauthState)
    const stateUser = stateStore.users.find(item => item.id === stateSession?.userId)
    if (!stateSession || !stateUser) {
      return res.redirect(`${publicFrontendUrl()}/gmail?gmail=session-expired`)
    }

    const { tokens, email } = await exchangeCodeForTokens(req.query.code)
    const connectedEmail = String(email || '').toLowerCase()
    const expectedOwnerEmail = String(process.env.OWNER_EMAIL || '').toLowerCase()
    const ownerConnection = stateUser.role === 'owner'
    if (ownerConnection && connectedEmail !== expectedOwnerEmail) {
      await updateStore((store) => {
        const session = (store.sessions || []).find(item => item.gmailOAuthState === oauthState)
        if (session) session.gmailOAuthState = null
      })
      return res.redirect(`${publicFrontendUrl()}/owner/client-updates?gmail=wrong-account`)
    }

    let redirectPath = ownerConnection ? '/owner/client-updates?gmail=connected' : '/gmail?connected=true'

    await updateStore((store) => {
      const session = (store.sessions || []).find(item => item.gmailOAuthState === oauthState)
      if (!session) return
      session.gmailOAuthState = null
      const user = store.users.find(item => item.id === session.userId)
      if (!user) return
      user.integrations.gmail = {
        connected: true,
        connectedEmail: email,
        encryptedTokens: encryptJson(tokens),
        updatedAt: new Date().toISOString(),
      }
    })

    await addAuditLog('gmail.connected', { email })
    const frontend = publicFrontendUrl()
    res.redirect(`${frontend}${redirectPath}`)
  } catch (err) {
    console.error('[JobPilot Gmail OAuth]', err?.response?.data?.error_description || err.message)
    return res.redirect(`${publicFrontendUrl()}/gmail?gmail=connection-failed`)
  }
})

router.use(requireAuth)

router.get('/status', async (req, res) => {
  const store = await readStore()
  const user = (store.users || []).find(item => item.id === req.auth.userId)
  let connected = Boolean(user?.integrations?.gmail?.connected)
  if (connected) {
    try {
      connected = await verifyGmailConnection(decryptJson(user?.integrations?.gmail?.encryptedTokens))
    } catch {
      connected = false
      await updateStore((nextStore) => {
        const target = (nextStore.users || []).find(item => item.id === req.auth.userId)
        if (target?.integrations?.gmail) target.integrations.gmail.connected = false
      })
    }
  }
  res.json({
    connected,
    email: connected ? user?.integrations?.gmail?.connectedEmail || null : null,
    realSendEnabled: realSendEnabled(),
    credentialReady: googleOAuthConfigured(),
  })
})

router.get('/auth-url', async (req, res, next) => {
  try {
    const state = crypto.randomBytes(24).toString('hex')
    await updateStore((store) => {
      const session = (store.sessions || []).find(item => item.id === req.auth.sessionId)
      if (session) session.gmailOAuthState = state
    })
    res.json({ url: getAuthUrl(state) })
  } catch (err) {
    next(err)
  }
})

router.post('/disconnect', async (req, res) => {
  await updateStore((store) => {
    const user = (store.users || []).find(item => item.id === req.auth.userId)
    if (!user) return
    user.integrations.gmail = {
      connected: false,
      connectedEmail: null,
      encryptedTokens: null,
      updatedAt: new Date().toISOString(),
    }
  })
  await addAuditLog('gmail.disconnected', { userId: req.auth.userId })
  res.json({ success: true })
})

router.post('/send', async (req, res, next) => {
  try {
    const store = await readStore()
    const application = store.applications.find(item => item.id === req.body.applicationId && item.userId === req.auth.userId)
    if (isJobClosed(application?.job)) return res.status(409).json({ error: 'This job is closed or expired and cannot be sent' })
    assertApprovedApplication(application)
    assertDailyLimit(store, req.auth.userId, 'gmail')

    const user = (store.users || []).find(item => item.id === req.auth.userId)
    const tokens = decryptJson(user?.integrations?.gmail?.encryptedTokens)
    const resume = (store.resumes || []).find(item => item.id === application.resumeId && item.userId === req.auth.userId)
    if (!resume || !(resume.ownership || evaluateResumeIdentity(resume.profile, user)).verified) {
      return res.status(403).json({ error: 'Verify the CV attached to this application before sending.' })
    }
    const draft = application.approvalSnapshot
    const to = application.approvalSnapshot?.recipient || application.approvalSnapshot?.job?.recruiterEmail
    if (!to) return res.status(400).json({ error: 'Recipient email is required' })
    if (!draft?.subject || !draft?.body) return res.status(400).json({ error: 'Email draft with subject and body is required' })
    if (process.env.ENABLE_REAL_SEND === 'true' && !resume?.fileBase64) {
      return res.status(400).json({ error: 'Upload the resume again before real sending so the original file can be attached' })
    }

    const result = await sendGmail(tokens, {
      to,
      subject: draft.subject,
      body: draft.body,
      attachmentBase64: resume?.fileBase64 || null,
      attachmentName: resume?.fileName || 'resume.pdf',
      attachmentMimeType: resume?.mimeType || 'application/pdf',
    })

    let updated = null
    await updateStore((nextStore) => {
      refreshJobDeadlines(nextStore)
      const target = nextStore.applications.find(item => item.id === application.id && item.userId === req.auth.userId)
      if (!target) return
      if (isJobClosed(target.job)) {
        target.status = 'job_closed'
        target.updatedAt = new Date().toISOString()
        updated = target
        return
      }
      target.status = result.demo ? 'sent_demo' : 'applied'
      target.sentAt = new Date().toISOString()
      target.updatedAt = new Date().toISOString()
      incrementDailyUsage(nextStore, req.auth.userId, 'gmail')
      nextStore.messages.unshift({
        id: result.id,
        userId: req.auth.userId,
        applicationId: target.id,
        channel: 'gmail',
        to,
        subject: draft.subject,
        body: draft.body,
        demo: result.demo,
        status: target.status,
        createdAt: new Date().toISOString(),
      })
      const existingFollowUp = nextStore.followUps.some(item => item.userId === req.auth.userId && item.applicationId === target.id && item.status !== 'completed')
      if (!existingFollowUp) {
        const followUp = {
          id: `followup-${Date.now()}`,
          userId: req.auth.userId,
          applicationId: target.id,
          company: target.job.company,
          role: target.job.title,
          ...createFollowUpPlan(target, 5),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        nextStore.followUps.unshift(followUp)
        target.followUp = followUp
      }
      updated = target
    })

    await addAuditLog('gmail.sent', { applicationId: application.id, demo: result.demo, userId: req.auth.userId })
    res.json({ success: true, result, application: updated })
  } catch (err) {
    next(err)
  }
})

router.post('/send-workflow', validateRequest({ body: workflowSendBodySchema }), async (req, res, next) => {
  try {
    if (req.auth.user.tier !== 'pro') {
      return res.status(403).json({ error: 'Upgrade to Pro to send autonomous career moves.' })
    }
    const store = await readStore()
    const application = (store.applications || []).find(item => item.id === req.body.applicationId && item.userId === req.auth.userId)
    if (!application) return res.status(404).json({ error: 'Application not found' })
    const key = req.body.workflow === 'ghosting' ? 'ghostingResolution' : 'negotiation'
    const workflow = application[key]
    if (!workflow?.approvalSnapshot || workflow.status !== 'approved') {
      return res.status(409).json({ error: 'Review and approve this message before sending.' })
    }
    assertDailyLimit(store, req.auth.userId, 'gmail')

    const user = (store.users || []).find(item => item.id === req.auth.userId)
    const tokens = decryptJson(user?.integrations?.gmail?.encryptedTokens)
    const message = workflow.approvalSnapshot
    const to = message.recipient || application.job?.recruiterEmail || ''
    if (!to) return res.status(400).json({ error: 'Add a recruiter email to this application before sending.' })

    const result = await sendGmail(tokens, {
      to,
      subject: message.subject,
      body: message.body,
    })

    let updated = null
    await updateStore((nextStore) => {
      const target = (nextStore.applications || []).find(item => item.id === application.id && item.userId === req.auth.userId)
      const targetWorkflow = target?.[key]
      if (!targetWorkflow || targetWorkflow.status !== 'approved') return
      const sentAt = new Date().toISOString()
      targetWorkflow.status = result.demo ? 'sent_demo' : 'sent'
      targetWorkflow.sentAt = sentAt
      targetWorkflow.providerMessageId = result.id
      target.updatedAt = sentAt
      if (req.body.workflow === 'ghosting') target.lastFollowUpAt = sentAt
      else target.negotiationSentAt = sentAt
      incrementDailyUsage(nextStore, req.auth.userId, 'gmail')
      nextStore.messages.unshift({
        id: result.id,
        userId: req.auth.userId,
        applicationId: target.id,
        channel: 'gmail',
        kind: req.body.workflow,
        to,
        subject: message.subject,
        body: message.body,
        demo: result.demo,
        status: targetWorkflow.status,
        createdAt: sentAt,
      })
      updated = target
    })

    await addAuditLog(`career_move.${req.body.workflow}.sent`, {
      applicationId: application.id,
      demo: result.demo,
      userId: req.auth.userId,
    })
    res.json({ success: true, result, application: updated })
  } catch (err) {
    next(err)
  }
})

export default router
