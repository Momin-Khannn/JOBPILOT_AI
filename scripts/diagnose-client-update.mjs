if (process.env.DATABASE_PUBLIC_URL) process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL

const email = String(process.argv[2] || '').trim().toLowerCase()
if (!email) throw new Error('Pass the client email address as the first argument')
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL or DATABASE_PUBLIC_URL is required')

const { readStore } = await import('../backend/src/db/store.js')
const { eligibleUpdateClients } = await import('../backend/src/services/clientUpdateAgentService.js')
const { businessMailReady } = await import('../backend/src/services/emailService.js')

const store = await readStore()
const user = (store.users || []).find(item => String(item.email || '').toLowerCase() === email)
if (!user) throw new Error(`Client account not found: ${email}`)

const eligible = eligibleUpdateClients(store, { targetUserIds: [user.id] }).some(item => item.id === user.id)
const recentMessages = (store.messages || [])
  .filter(message => message.userId === user.id && message.channel === 'client_update')
  .slice(0, 10)
  .map(message => ({
    subject: message.subject,
    status: message.status,
    createdAt: message.createdAt,
    source: message.metadata?.source || null,
    releaseVersion: message.metadata?.releaseVersion || null,
  }))

console.log(JSON.stringify({
  account: {
    id: user.id,
    role: user.role,
    status: user.status,
    authProvider: user.authProvider,
    emailVerified: user.emailVerified === true,
    hasGoogleIdentity: Boolean(String(user.googleSub || '').trim()),
    productUpdatesOptIn: user.preferences?.productUpdatesOptIn !== false,
    eligible,
  },
  mail: {
    ready: await businessMailReady(),
    agentEnabled: process.env.CLIENT_UPDATE_AGENT_ENABLED === 'true',
    softwareAgentEnabled: process.env.CLIENT_UPDATE_SOFTWARE_AUTO_ENABLED === 'true',
  },
  recentMessages,
}, null, 2))
