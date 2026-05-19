import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuid } from 'uuid'
import { demoUser, seedJobs } from './seed.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.resolve(__dirname, '../../data')
const storePath = path.join(dataDir, 'store.json')

const emptyStore = () => ({
  users: [demoUser],
  resumes: [],
  jobs: seedJobs,
  applications: [],
  messages: [],
  followUps: [],
  inboxEvents: [],
  auditLogs: [],
  integrations: {
    gmail: { connected: false, encryptedTokens: null, connectedEmail: null, updatedAt: null },
    whatsapp: { provider: 'twilio', connected: false, updatedAt: null },
  },
  dailyUsage: {},
})

export async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true })
  try {
    await fs.access(storePath)
  } catch {
    await writeStore(emptyStore())
  }
}

export async function readStore() {
  await ensureStore()
  const raw = await fs.readFile(storePath, 'utf8')
  const store = JSON.parse(raw)
  const defaults = emptyStore()
  for (const [key, value] of Object.entries(defaults)) {
    if (store[key] === undefined) store[key] = value
  }
  store.integrations ||= defaults.integrations
  store.integrations.gmail ||= defaults.integrations.gmail
  store.integrations.whatsapp ||= defaults.integrations.whatsapp
  return store
}

export async function writeStore(store) {
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(storePath, JSON.stringify(store, null, 2))
}

export async function updateStore(mutator) {
  const store = await readStore()
  const result = await mutator(store)
  await writeStore(store)
  return result
}

export async function addAuditLog(action, details = {}) {
  return updateStore((store) => {
    const entry = {
      id: uuid(),
      action,
      details,
      createdAt: new Date().toISOString(),
    }
    store.auditLogs.unshift(entry)
    store.auditLogs = store.auditLogs.slice(0, 250)
    return entry
  })
}

export function publicSummary(store) {
  const applications = store.applications || []
  const sent = applications.filter(app => ['applied', 'sent_demo'].includes(app.status)).length
  const interviews = applications.filter(app => app.status === 'interview').length
  const offers = applications.filter(app => app.status === 'offer').length
  const review = applications.filter(app => app.status === 'pending_review').length
  const matchScores = applications.map(app => app.matchScore || 0).filter(Boolean)
  const averageMatch = matchScores.length
    ? Math.round(matchScores.reduce((sum, score) => sum + score, 0) / matchScores.length)
    : 0

  return {
    totalApplications: applications.length,
    sent,
    interviews,
    offers,
    review,
    followUps: (store.followUps || []).filter(item => item.status !== 'completed').length,
    inboxEvents: (store.inboxEvents || []).length,
    averageMatch,
    latestResume: store.resumes?.[0] || null,
    gmailConnected: Boolean(store.integrations?.gmail?.connected),
    whatsappConnected: Boolean(store.integrations?.whatsapp?.connected),
    demoSend: process.env.ENABLE_REAL_SEND !== 'true',
  }
}
