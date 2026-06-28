import crypto from 'crypto'
import { addAuditLog, readStore, updateStore } from '../db/store.js'
import { businessMailStatus, sendBusinessEmail, verifyBusinessMailbox } from './emailService.js'
import { geminiConfigured, personalizeClientUpdateCopy } from './geminiService.js'

const agentName = process.env.CLIENT_UPDATE_AGENT_NAME || 'JobPilot Client Update Agent'

function htmlEscape(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function normalizeChanges(changes = []) {
  if (Array.isArray(changes)) return changes.map(item => String(item).trim()).filter(Boolean)
  return String(changes)
    .split(/\r?\n/)
    .map(item => item.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

function makeUpdateKey({ title, summary, changes, actionUrl }) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ title, summary, changes, actionUrl }))
    .digest('hex')
    .slice(0, 20)
}

function clientDisplayName(user = {}) {
  return user.name || user.email?.split('@')[0] || 'there'
}

function frontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function hasVerifiedGoogleIdentity(user = {}) {
  return Boolean(String(user.googleSub || '').trim()) &&
    user.emailVerified === true
}

export function clientActivityProfile(store, user) {
  const applications = (store.applications || []).filter(item => item.userId === user.id)
  const resumes = (store.resumes || []).filter(item => item.userId === user.id)
  const latestResume = resumes.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null
  const profile = (store.profiles || []).find(item => item.userId === user.id)
  const interviews = (store.interviewSessions || []).filter(item => item.userId === user.id)
  const pendingReview = applications.filter(item => item.status === 'pending_review').length
  const activeApplications = applications.filter(item => !['rejected', 'job_closed'].includes(item.status)).length
  const hasGoal = Boolean(user.preferences?.roles?.length)
  const hasResume = Boolean(latestResume)
  const resumeVerified = Boolean(latestResume?.ownership?.verified)

  let nextAction = { id: 'dashboard', label: 'Open your workspace', path: '/dashboard' }
  if (!hasGoal) nextAction = { id: 'goal', label: 'Set your career goal', path: '/goal' }
  else if (!hasResume) nextAction = { id: 'resume', label: 'Add your CV', path: '/resume' }
  else if (!resumeVerified) nextAction = { id: 'verify_resume', label: 'Verify your CV', path: '/resume' }
  else if (pendingReview) nextAction = { id: 'review', label: 'Review your applications', path: '/applications' }
  else if (activeApplications) nextAction = { id: 'applications', label: 'Open your application pipeline', path: '/applications' }
  else if (interviews.length) nextAction = { id: 'interview', label: 'Continue interview practice', path: '/career-lab' }
  else nextAction = { id: 'jobs', label: 'Discover matching jobs', path: '/jobs' }

  return {
    tier: user.tier === 'pro' ? 'pro' : 'basic',
    hasGoal,
    targetRoleCount: (user.preferences?.roles || []).length,
    hasResume,
    resumeVerified,
    hasPublishedProfile: Boolean(profile?.published),
    applicationCount: applications.length,
    pendingReview,
    activeApplications,
    interviewSessionCount: interviews.length,
    gmailConnected: Boolean(user.integrations?.gmail?.connected),
    whatsappConnected: Boolean(user.integrations?.whatsapp?.connected),
    nextAction,
  }
}

export function behaviorAwareUpdate({ user, activity, title, changes = [], actionUrl = '' }) {
  const firstName = clientDisplayName(user).split(/\s+/)[0]
  const configuredVersion = process.env.APP_VERSION || '2.0.1'
  const versionLabel = configuredVersion.startsWith('v') ? configuredVersion : `v${configuredVersion}`
  const normalizedChanges = normalizeChanges(changes)
  const relevantChanges = normalizedChanges.filter(item => {
    const text = item.toLowerCase()
    if (/interview|voice|audio/.test(text)) return activity.tier === 'pro' || activity.interviewSessionCount > 0
    if (/stripe|billing|subscription|pro/.test(text)) return true
    if (/cv|resume/.test(text)) return activity.hasResume || activity.nextAction.id === 'resume' || activity.nextAction.id === 'verify_resume'
    if (/gmail|email/.test(text)) return activity.gmailConnected || activity.applicationCount > 0
    if (/application|job|detail/.test(text)) return activity.applicationCount > 0 || activity.nextAction.id === 'jobs'
    return true
  }).slice(0, 4)

  const lead = activity.nextAction.id === 'goal'
    ? `${firstName}, JobPilot AI ${versionLabel} is ready. Start by setting your target role so your workspace can make its recommendations more relevant.`
    : activity.nextAction.id === 'resume'
      ? `${firstName}, your workspace is ready for the new release. Add your CV to unlock job matching, evidence-grounded writing, and role-specific guidance.`
      : activity.nextAction.id === 'verify_resume'
        ? `${firstName}, the new release is available. Verify your CV email to enable applications while keeping your identity protected.`
        : activity.nextAction.id === 'review'
          ? `${firstName}, you have ${activity.pendingReview} application${activity.pendingReview === 1 ? '' : 's'} waiting for review. The new release makes that review and preparation flow safer and more useful.`
          : activity.interviewSessionCount > 0
            ? `${firstName}, your interview practice workspace has been upgraded with stronger coaching and recorded-answer analysis.`
            : `${firstName}, JobPilot AI ${versionLabel} is available with safer CV verification, clearer job details, and improved career tools.`

  return {
    title,
    summary: lead,
    changes: relevantChanges.length ? relevantChanges : normalizedChanges.slice(0, 3),
    actionUrl: actionUrl || `${frontendUrl()}${activity.nextAction.path}`,
    actionLabel: activity.nextAction.label,
  }
}

export function eligibleUpdateClients(store, { activeSessionOnly = false, targetUserIds = [] } = {}) {
  const activeSessionUserIds = new Set((store.sessions || []).map(session => session.userId))
  const targetSet = new Set(targetUserIds.filter(Boolean))

  return (store.users || [])
    .filter(user => user.role === 'client')
    .filter(user => user.id !== 'seed-demo-user')
    .filter(user => user.status === 'active')
    .filter(hasVerifiedGoogleIdentity)
    .filter(user => user.email && /^\S+@\S+\.\S+$/.test(user.email))
    .filter(user => user.preferences?.productUpdatesOptIn !== false)
    .filter(user => !activeSessionOnly || activeSessionUserIds.has(user.id))
    .filter(user => !targetSet.size || targetSet.has(user.id))
}

export function composeClientUpdate({ user, title, summary, changes = [], actionUrl = '', actionLabel = 'Open your workspace' }) {
  const safeTitle = String(title || 'JobPilot AI update').trim()
  const safeSummary = String(summary || 'We made an update to your JobPilot AI workspace.').trim()
  const list = normalizeChanges(changes)
  const url = actionUrl || frontendUrl()
  const name = clientDisplayName(user)

  const text = [
    `Hi ${name},`,
    '',
    safeSummary,
    '',
    ...(list.length ? ['What changed:', ...list.map(item => `- ${item}`), ''] : []),
    `${actionLabel}: ${url}`,
    '',
    'You are receiving this because you registered with a verified Google account and product updates are enabled in your JobPilot AI settings.',
    '',
    agentName,
  ].join('\n')

  const htmlChanges = list.length
    ? `<ul>${list.map(item => `<li>${htmlEscape(item)}</li>`).join('')}</ul>`
    : ''

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17202a">
      <p>Hi ${htmlEscape(name)},</p>
      <p>${htmlEscape(safeSummary)}</p>
      ${htmlChanges}
      <p><a href="${htmlEscape(url)}" style="display:inline-block;background:#102019;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:700">${htmlEscape(actionLabel)}</a></p>
      <p style="color:#647067;font-size:13px">You are receiving this because you registered with a verified Google account and product updates are enabled in your JobPilot AI settings.</p>
      <p style="color:#647067;font-size:13px">${htmlEscape(agentName)}</p>
    </div>
  `

  return {
    subject: `${process.env.APP_NAME || 'JobPilot AI'}: ${safeTitle}`,
    text,
    html,
  }
}

export async function clientUpdateAgentStatus() {
  const store = await readStore()
  const sentMessages = (store.messages || []).filter(item => item.channel === 'client_update')
  const eligibleRecipients = eligibleUpdateClients(store).map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    lastLoginAt: user.lastLoginAt || null,
    nextAction: clientActivityProfile(store, user).nextAction,
  }))
  return {
    agentName,
    enabled: process.env.CLIENT_UPDATE_AGENT_ENABLED !== 'false',
    mailbox: await businessMailStatus(),
    eligibleClients: eligibleRecipients.length,
    eligibleRecipients,
    activeEligibleClients: eligibleUpdateClients(store, { activeSessionOnly: true }).length,
    totalSent: sentMessages.length,
    lastSentAt: sentMessages[0]?.createdAt || null,
    personalization: {
      enabled: process.env.CLIENT_UPDATE_PERSONALIZATION_ENABLED !== 'false',
      gemini: geminiConfigured() && process.env.CLIENT_UPDATE_GEMINI_PERSONALIZATION !== 'false',
    },
  }
}

export async function testClientUpdateAgentMailbox() {
  const verified = await verifyBusinessMailbox()
  if (!verified) {
    const error = new Error('Business Gmail SMTP is not configured')
    error.status = 400
    throw error
  }
  return clientUpdateAgentStatus()
}

export async function sendClientUpdate({ title, summary, changes = [], actionUrl = '', targetUserIds = [], activeSessionOnly = false, force = false, personalize = true, metadata = {} }) {
  if (process.env.CLIENT_UPDATE_AGENT_ENABLED === 'false') {
    const error = new Error('Client Update Agent is disabled')
    error.status = 400
    throw error
  }

  const normalizedChanges = normalizeChanges(changes)
  const updateKey = makeUpdateKey({ title, summary, changes: normalizedChanges, actionUrl })
  const store = await readStore()
  const recipients = eligibleUpdateClients(store, { activeSessionOnly, targetUserIds })
  const alreadySent = new Set(
    (store.messages || [])
      .filter(item => item.channel === 'client_update' && item.status === 'sent' && item.updateKey === updateKey && !force)
      .map(item => item.userId)
  )
  const pendingRecipients = recipients.filter(user => !alreadySent.has(user.id))
  const sent = []
  const failed = []

  for (const user of pendingRecipients) {
    try {
      const activity = clientActivityProfile(store, user)
      let content = personalize && process.env.CLIENT_UPDATE_PERSONALIZATION_ENABLED !== 'false'
        ? behaviorAwareUpdate({ user, activity, title, summary, changes: normalizedChanges, actionUrl })
        : { title, summary, changes: normalizedChanges, actionUrl, actionLabel: 'Open your workspace' }
      if (personalize && geminiConfigured() && process.env.CLIENT_UPDATE_GEMINI_PERSONALIZATION !== 'false') {
        try {
          const generated = await personalizeClientUpdateCopy({
            firstName: clientDisplayName(user).split(/\s+/)[0],
            activity: { ...activity, nextAction: activity.nextAction.id },
            release: { title, summary, changes: normalizedChanges },
          })
          if (generated) content = { ...content, summary: generated.summary, changes: generated.changes.length ? generated.changes : content.changes }
        } catch {}
      }
      const draft = composeClientUpdate({ user, ...content })
      const result = await sendBusinessEmail({
        to: user.email,
        subject: draft.subject,
        text: draft.text,
        html: draft.html,
      })
      sent.push({ user, result, draft, activity })
    } catch (err) {
      failed.push({ userId: user.id, email: user.email, error: err.message })
    }
  }

  if (sent.length) {
    await updateStore((nextStore) => {
      const now = new Date().toISOString()
      for (const item of sent) {
        nextStore.messages.unshift({
          id: item.result.id || `client-update-${Date.now()}-${item.user.id}`,
          userId: item.user.id,
          applicationId: null,
          channel: 'client_update',
          to: item.user.email,
          subject: item.draft.subject,
          body: item.draft.text,
          updateKey,
          status: 'sent',
          agent: agentName,
          metadata,
          personalization: {
            nextAction: item.activity.nextAction.id,
            activity: {
              tier: item.activity.tier,
              hasGoal: item.activity.hasGoal,
              hasResume: item.activity.hasResume,
              resumeVerified: item.activity.resumeVerified,
              applicationCount: item.activity.applicationCount,
              pendingReview: item.activity.pendingReview,
              interviewSessionCount: item.activity.interviewSessionCount,
            },
          },
          createdAt: now,
        })
      }
    })
  }

  await addAuditLog('client_update_agent.sent', {
    title,
    updateKey,
    sent: sent.length,
    failed: failed.length,
    skipped: recipients.length - pendingRecipients.length,
    metadata,
  })

  return {
    updateKey,
    requested: recipients.length,
    sent: sent.length,
    skipped: recipients.length - pendingRecipients.length,
    failed,
    personalized: personalize,
  }
}
