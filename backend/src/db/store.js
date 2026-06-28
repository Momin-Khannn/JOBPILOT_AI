import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import { v4 as uuid } from 'uuid'
import { seedJobs } from './seed.js'
import { createSeedUsers, defaultIntegrations, ensureUserShape, hashSessionToken, normalizeStoredSession, sanitizeUser, sessionMatchesToken } from '../services/authService.js'
import { createPostgresStore } from './postgresStore.js'
import { createPostgresRowStore } from './postgresRowStore.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = process.env.JOBPILOT_DATA_DIR
  ? path.resolve(process.env.JOBPILOT_DATA_DIR)
  : path.resolve(__dirname, '../../data')
const legacyStorePath = path.join(dataDir, 'store.json')
const corruptBackupPath = path.join(dataDir, 'store.corrupt.backup.json')
const sqlitePath = path.join(dataDir, 'jobpilot.sqlite')

let db = null
let initialized = false
let writeChain = Promise.resolve()
let postgresStore = null
let normalizedPostgresStore = null

const emptyStore = () => ({
  users: createSeedUsers(),
  resumes: [],
  profiles: [],
  jobs: seedJobs,
  applications: [],
  messages: [],
  followUps: [],
  inboxEvents: [],
  auditLogs: [],
  sessions: [],
  integrations: defaultIntegrations(),
  dailyUsage: {},
  providerStatus: {},
  jobSyncRuns: [],
  interviewSessions: [],
  billingEvents: [],
  supportTickets: [],
  analyticsEvents: [],
  portalUpdateState: null,
})

function usePostgres() {
  return Boolean(process.env.DATABASE_URL)
}

function postgres() {
  postgresStore ||= createPostgresStore({ emptyStore, normalizeStore })
  return postgresStore
}

function postgresRows() {
  normalizedPostgresStore ||= createPostgresRowStore({ emptyStore, normalizeStore })
  return normalizedPostgresStore
}

function rowStoreEnabled() {
  return usePostgres() && process.env.POSTGRES_ROW_STORE_ENABLED === 'true'
}

function rowStoreDualWrite() {
  return usePostgres() && process.env.POSTGRES_ROW_STORE_DUAL_WRITE === 'true'
}

function rowStorePrepared() {
  return rowStoreEnabled() || rowStoreDualWrite() || process.env.POSTGRES_ROW_STORE_PREPARE === 'true'
}

function database() {
  if (!db) {
    fsSync.mkdirSync(dataDir, { recursive: true })
    db = new Database(sqlitePath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

function parseJson(value, fallback = null) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function createSchema() {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      role TEXT,
      status TEXT,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_email_role ON users(email, role);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE,
      user_id TEXT,
      last_seen_at TEXT,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      created_at TEXT,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id, created_at);

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE,
      slug TEXT UNIQUE,
      published INTEGER DEFAULT 0,
      updated_at TEXT,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_profiles_slug ON profiles(slug, published);

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      provider TEXT,
      external_id TEXT,
      deadline_status TEXT,
      is_expired INTEGER DEFAULT 0,
      last_seen_at TEXT,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_provider_external ON jobs(provider, external_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_deadline ON jobs(deadline_status, is_expired);

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      status TEXT,
      created_at TEXT,
      updated_at TEXT,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id, status);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      application_id TEXT,
      channel TEXT,
      created_at TEXT,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, created_at);

    CREATE TABLE IF NOT EXISTS integrations (
      user_id TEXT,
      provider TEXT,
      data TEXT NOT NULL,
      updated_at TEXT,
      PRIMARY KEY (user_id, provider)
    );
    CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider, updated_at);

    CREATE TABLE IF NOT EXISTS follow_ups (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      application_id TEXT,
      status TEXT,
      due_at TEXT,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_follow_ups_user ON follow_ups(user_id, status, due_at);

    CREATE TABLE IF NOT EXISTS inbox_events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      created_at TEXT,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_inbox_events_user ON inbox_events(user_id, created_at);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT,
      created_at TEXT,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      type TEXT,
      status TEXT,
      created_at TEXT,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets(created_at);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, type);

    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      type TEXT,
      name TEXT,
      created_at TEXT,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(type, name);

    CREATE TABLE IF NOT EXISTS daily_usage (
      day_key TEXT,
      user_id TEXT,
      channel TEXT,
      count INTEGER DEFAULT 0,
      data TEXT,
      PRIMARY KEY (day_key, user_id, channel)
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
  `
  database().exec(sql)
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeStore(input = {}) {
  const defaults = emptyStore()
  const store = {
    ...defaults,
    ...input,
    users: normalizeArray(input.users),
    resumes: normalizeArray(input.resumes),
    profiles: normalizeArray(input.profiles),
    jobs: normalizeArray(input.jobs || defaults.jobs),
    applications: normalizeArray(input.applications),
    messages: normalizeArray(input.messages),
    followUps: normalizeArray(input.followUps),
    inboxEvents: normalizeArray(input.inboxEvents),
    auditLogs: normalizeArray(input.auditLogs),
    sessions: normalizeArray(input.sessions).map(normalizeStoredSession),
    integrations: {
      ...defaultIntegrations(),
      ...(input.integrations || {}),
    },
    dailyUsage: input.dailyUsage && typeof input.dailyUsage === 'object' ? input.dailyUsage : {},
    providerStatus: input.providerStatus && typeof input.providerStatus === 'object' ? input.providerStatus : {},
    jobSyncRuns: normalizeArray(input.jobSyncRuns),
    interviewSessions: normalizeArray(input.interviewSessions),
    billingEvents: normalizeArray(input.billingEvents),
    supportTickets: normalizeArray(input.supportTickets),
    analyticsEvents: normalizeArray(input.analyticsEvents),
    portalUpdateState: input.portalUpdateState && typeof input.portalUpdateState === 'object' ? input.portalUpdateState : null,
  }

  for (const seedUser of createSeedUsers()) {
    const exists = store.users.some(user =>
      user.id === seedUser.id ||
      user.email === seedUser.email ||
      (seedUser.role === 'owner' && user.role === 'owner')
    )
    if (!exists) store.users.push(seedUser)
  }

  const seenIds = new Set()
  store.users = store.users.map(ensureUserShape).map((user) => {
    if (!seenIds.has(user.id)) {
      seenIds.add(user.id)
      return user
    }
    return { ...user, id: uuid() }
  })

  const fallbackUserId = store.users.find(user => user.role === 'client')?.id || store.users[0]?.id
  if (fallbackUserId) {
    for (const resume of store.resumes) resume.userId ||= fallbackUserId
    for (const application of store.applications) application.userId ||= fallbackUserId
    for (const message of store.messages) message.userId ||= fallbackUserId
    for (const followUp of store.followUps) followUp.userId ||= fallbackUserId
    for (const event of store.inboxEvents) event.userId ||= fallbackUserId
  }

  store.jobs = store.jobs.map((job) => ({
    ...job,
    id: job.id || `${job.provider || 'job'}-${job.externalId || uuid()}`,
  }))

  return store
}

async function readLegacyStore() {
  try {
    const raw = await fs.readFile(legacyStorePath, 'utf8')
    if (!raw.trim()) throw new Error('Legacy store is empty')
    return JSON.parse(raw)
  } catch {
    try {
      await fs.access(legacyStorePath)
      try {
        await fs.access(corruptBackupPath)
      } catch {
        await fs.copyFile(legacyStorePath, corruptBackupPath)
      }
    } catch {}
    return null
  }
}

function tableData(table, orderBy = '') {
  const rows = database().prepare(`SELECT data FROM ${table} ${orderBy}`).all()
  return rows.map(row => parseJson(row.data, {})).filter(Boolean)
}

function readDailyUsage() {
  const usage = {}
  const rows = database().prepare('SELECT day_key, user_id, channel, count FROM daily_usage').all()
  for (const row of rows) {
    usage[row.day_key] ||= {}
    usage[row.day_key][row.user_id] ||= {}
    usage[row.day_key][row.user_id][row.channel] = row.count
  }
  return usage
}

function meta(key, fallback) {
  const row = database().prepare('SELECT data FROM meta WHERE key = ?').get(key)
  return parseJson(row?.data, fallback)
}

function readStoreFromDb() {
  return normalizeStore({
    users: tableData('users', 'ORDER BY email ASC'),
    resumes: tableData('resumes', 'ORDER BY datetime(created_at) DESC'),
    profiles: tableData('profiles', 'ORDER BY datetime(updated_at) DESC'),
    jobs: tableData('jobs', 'ORDER BY datetime(last_seen_at) DESC'),
    applications: tableData('applications', 'ORDER BY datetime(updated_at) DESC'),
    messages: tableData('messages', 'ORDER BY datetime(created_at) DESC'),
    followUps: tableData('follow_ups', 'ORDER BY datetime(due_at) ASC'),
    inboxEvents: tableData('inbox_events', 'ORDER BY datetime(created_at) DESC'),
    auditLogs: tableData('audit_logs', 'ORDER BY datetime(created_at) DESC LIMIT 250'),
    supportTickets: tableData('support_tickets', 'ORDER BY datetime(created_at) DESC LIMIT 1000'),
    analyticsEvents: tableData('analytics_events', 'ORDER BY datetime(created_at) DESC LIMIT 5000'),
    sessions: tableData('sessions', 'ORDER BY datetime(last_seen_at) DESC'),
    integrations: meta('integrations', defaultIntegrations()),
    dailyUsage: readDailyUsage(),
    providerStatus: meta('providerStatus', {}),
    jobSyncRuns: meta('jobSyncRuns', []),
    interviewSessions: meta('interviewSessions', []),
    billingEvents: meta('billingEvents', []),
    portalUpdateState: meta('portalUpdateState', null),
  })
}

function insertJson(table, fields, values) {
  const placeholders = fields.map(() => '?').join(', ')
  const sql = `INSERT OR REPLACE INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`
  database().prepare(sql).run(...values)
}

function writeStoreToDb(rawStore) {
  return database().transaction((storeInput) => {
  const store = normalizeStore(storeInput)
  const tables = [
    'users',
    'sessions',
    'resumes',
    'profiles',
    'jobs',
    'applications',
    'messages',
    'integrations',
    'follow_ups',
    'inbox_events',
    'audit_logs',
    'support_tickets',
    'analytics_events',
    'daily_usage',
  ]
  for (const table of tables) database().prepare(`DELETE FROM ${table}`).run()

  for (const user of store.users) {
    insertJson('users', ['id', 'email', 'role', 'status', 'data'], [
      user.id,
      user.email,
      user.role,
      user.status,
      JSON.stringify(user),
    ])
  }

  for (const session of store.sessions) {
    insertJson('sessions', ['id', 'token', 'user_id', 'last_seen_at', 'data'], [
      session.id,
      session.tokenHash || null,
      session.userId,
      session.lastSeenAt || session.createdAt || new Date().toISOString(),
      JSON.stringify(session),
    ])
  }

  for (const resume of store.resumes) {
    insertJson('resumes', ['id', 'user_id', 'created_at', 'data'], [
      resume.id,
      resume.userId,
      resume.createdAt || resume.uploadedAt || new Date().toISOString(),
      JSON.stringify(resume),
    ])
  }

  for (const profile of store.profiles) {
    insertJson('profiles', ['id', 'user_id', 'slug', 'published', 'updated_at', 'data'], [
      profile.id,
      profile.userId,
      profile.slug,
      profile.published ? 1 : 0,
      profile.updatedAt || profile.createdAt || new Date().toISOString(),
      JSON.stringify(profile),
    ])
  }

  for (const job of store.jobs) {
    insertJson('jobs', ['id', 'provider', 'external_id', 'deadline_status', 'is_expired', 'last_seen_at', 'data'], [
      job.id,
      job.provider || job.source || 'demo',
      String(job.externalId || job.id),
      job.deadlineStatus || 'unknown',
      job.isExpired ? 1 : 0,
      job.lastSeenAt || job.lastVerifiedAt || new Date().toISOString(),
      JSON.stringify(job),
    ])
  }

  for (const application of store.applications) {
    insertJson('applications', ['id', 'user_id', 'status', 'created_at', 'updated_at', 'data'], [
      application.id,
      application.userId,
      application.status,
      application.createdAt || new Date().toISOString(),
      application.updatedAt || application.createdAt || new Date().toISOString(),
      JSON.stringify(application),
    ])
  }

  for (const message of store.messages) {
    insertJson('messages', ['id', 'user_id', 'application_id', 'channel', 'created_at', 'data'], [
      message.id,
      message.userId,
      message.applicationId,
      message.channel,
      message.createdAt || new Date().toISOString(),
      JSON.stringify(message),
    ])
  }

  for (const user of store.users) {
    for (const [provider, integration] of Object.entries(user.integrations || {})) {
      insertJson('integrations', ['user_id', 'provider', 'data', 'updated_at'], [
        user.id,
        provider,
        JSON.stringify({ userId: user.id, provider, ...integration }),
        integration?.updatedAt || null,
      ])
    }
  }

  for (const followUp of store.followUps) {
    insertJson('follow_ups', ['id', 'user_id', 'application_id', 'status', 'due_at', 'data'], [
      followUp.id,
      followUp.userId,
      followUp.applicationId,
      followUp.status,
      followUp.dueAt,
      JSON.stringify(followUp),
    ])
  }

  for (const event of store.inboxEvents) {
    insertJson('inbox_events', ['id', 'user_id', 'created_at', 'data'], [
      event.id,
      event.userId,
      event.createdAt || new Date().toISOString(),
      JSON.stringify(event),
    ])
  }

  for (const log of store.auditLogs.slice(0, 250)) {
    insertJson('audit_logs', ['id', 'action', 'created_at', 'data'], [
      log.id,
      log.action,
      log.createdAt || new Date().toISOString(),
      JSON.stringify(log),
    ])
  }

  for (const ticket of store.supportTickets.slice(0, 1000)) {
    insertJson('support_tickets', ['id', 'type', 'status', 'created_at', 'data'], [
      ticket.id,
      ticket.type || 'support',
      ticket.status || 'new',
      ticket.createdAt || new Date().toISOString(),
      JSON.stringify(ticket),
    ])
  }

  for (const event of store.analyticsEvents.slice(0, 5000)) {
    insertJson('analytics_events', ['id', 'type', 'name', 'created_at', 'data'], [
      event.id,
      event.type || 'event',
      event.name || '',
      event.createdAt || new Date().toISOString(),
      JSON.stringify(event),
    ])
  }

  for (const [dayKey, users] of Object.entries(store.dailyUsage || {})) {
    if (!users || typeof users !== 'object') continue
    for (const [userId, channels] of Object.entries(users)) {
      if (!channels || typeof channels !== 'object') continue
      for (const [channel, count] of Object.entries(channels)) {
        insertJson('daily_usage', ['day_key', 'user_id', 'channel', 'count', 'data'], [
          dayKey,
          userId,
          channel,
          Number(count || 0),
          JSON.stringify({ dayKey, userId, channel, count: Number(count || 0) }),
        ])
      }
    }
  }

  insertJson('meta', ['key', 'data'], ['integrations', JSON.stringify(store.integrations || defaultIntegrations())])
  insertJson('meta', ['key', 'data'], ['providerStatus', JSON.stringify(store.providerStatus || {})])
  insertJson('meta', ['key', 'data'], ['jobSyncRuns', JSON.stringify((store.jobSyncRuns || []).slice(0, 50))])
  insertJson('meta', ['key', 'data'], ['interviewSessions', JSON.stringify((store.interviewSessions || []).slice(0, 100))])
  insertJson('meta', ['key', 'data'], ['billingEvents', JSON.stringify((store.billingEvents || []).slice(0, 1000))])
  insertJson('meta', ['key', 'data'], ['portalUpdateState', JSON.stringify(store.portalUpdateState || null)])
  })(rawStore)
}

export async function ensureStore() {
  if (usePostgres()) {
    await fs.mkdir(dataDir, { recursive: true })
    createSchema()
    const sqliteSnapshot = readStoreFromDb()
    await postgres().ensure(sqliteSnapshot)
    if (rowStorePrepared()) await postgresRows().ensure()
    return
  }
  await fs.mkdir(dataDir, { recursive: true })
  createSchema()
  if (initialized) return

  const userCount = database().prepare('SELECT COUNT(*) AS count FROM users').get().count
  if (!userCount) {
    const legacy = await readLegacyStore()
    writeStoreToDb(normalizeStore(legacy || emptyStore()))
  }

  initialized = true
}

export async function readStore() {
  if (rowStoreEnabled()) return postgresRows().read()
  if (usePostgres()) return postgres().read()
  await ensureStore()
  return readStoreFromDb()
}

export async function writeStore(store) {
  if (rowStoreEnabled()) {
    const normalized = await postgresRows().write(store)
    if (rowStoreDualWrite()) await postgres().write(normalized)
    return normalized
  }
  if (usePostgres()) {
    await postgres().write(store)
    if (rowStoreDualWrite()) await postgresRows().write(store)
    return
  }
  await ensureStore()
  writeStoreToDb(store)
}

function isStoreSnapshot(value) {
  return Boolean(value && typeof value === 'object' && Array.isArray(value.users) && Array.isArray(value.jobs))
}

export async function updateStore(mutator) {
  if (rowStoreEnabled()) {
    const committed = await postgresRows().update(mutator, isStoreSnapshot)
    if (rowStoreDualWrite()) await postgres().write(committed.store)
    return committed.result
  }
  if (usePostgres()) {
    const result = await postgres().update(mutator, isStoreSnapshot)
    if (rowStoreDualWrite()) await postgresRows().write(await postgres().read())
    return result
  }
  const operation = writeChain.then(async () => {
    const store = await readStore()
    const result = await mutator(store)
    await writeStore(isStoreSnapshot(result) ? result : store)
    return result === undefined ? store : result
  })
  writeChain = operation.catch(() => {})
  return operation
}

export function persistenceMode() {
  if (rowStoreEnabled()) return 'postgresql-row-store'
  return usePostgres() ? 'postgresql-snapshot' : 'sqlite'
}

export async function addAuditLog(action, details = {}) {
  const entry = {
    id: uuid(),
    action,
    details,
    createdAt: new Date().toISOString(),
  }
  if (rowStoreEnabled()) {
    await postgresRows().append('auditLogs', entry)
    if (rowStoreDualWrite()) {
      await postgres().update((store) => {
        store.auditLogs.unshift(entry)
        store.auditLogs = store.auditLogs.slice(0, 250)
      }, isStoreSnapshot)
    }
    return entry
  }
  if (usePostgres() && rowStoreDualWrite()) {
    await postgres().update((store) => {
      store.auditLogs.unshift(entry)
      store.auditLogs = store.auditLogs.slice(0, 250)
    }, isStoreSnapshot)
    await postgresRows().append('auditLogs', entry)
    return entry
  }
  return updateStore((store) => {
    store.auditLogs.unshift(entry)
    store.auditLogs = store.auditLogs.slice(0, 250)
    return entry
  })
}

export async function findAuthSession(token) {
  if (rowStoreEnabled()) {
    return postgresRows().findAuthSession(hashSessionToken(token))
  }
  const store = await readStore()
  const session = (store.sessions || []).find(item => sessionMatchesToken(item, token))
  if (!session) return null
  const user = (store.users || []).find(item => item.id === session.userId)
  return user ? { session, user } : null
}

export async function deleteSessionRecord(sessionId) {
  if (rowStoreEnabled()) {
    await postgresRows().deleteSession(sessionId)
    if (rowStoreDualWrite()) {
      await postgres().update((store) => {
        store.sessions = (store.sessions || []).filter(item => item.id !== sessionId)
      }, isStoreSnapshot)
    }
    return
  }
  if (usePostgres() && rowStoreDualWrite()) {
    await postgres().update((store) => {
      store.sessions = (store.sessions || []).filter(item => item.id !== sessionId)
    }, isStoreSnapshot)
    await postgresRows().deleteSession(sessionId)
    return
  }
  await updateStore((store) => {
    store.sessions = (store.sessions || []).filter(item => item.id !== sessionId)
  })
}

export async function touchSessionRecord(sessionId, lastSeenAt = new Date().toISOString()) {
  if (rowStoreEnabled()) {
    await postgresRows().touchSession(sessionId, lastSeenAt)
    if (rowStoreDualWrite()) {
      await postgres().update((store) => {
        const session = (store.sessions || []).find(item => item.id === sessionId)
        if (session) session.lastSeenAt = lastSeenAt
      }, isStoreSnapshot)
    }
    return
  }
  if (usePostgres() && rowStoreDualWrite()) {
    await postgres().update((store) => {
      const session = (store.sessions || []).find(item => item.id === sessionId)
      if (session) session.lastSeenAt = lastSeenAt
    }, isStoreSnapshot)
    await postgresRows().touchSession(sessionId, lastSeenAt)
    return
  }
  await updateStore((store) => {
    const session = (store.sessions || []).find(item => item.id === sessionId)
    if (session) session.lastSeenAt = lastSeenAt
  })
}

async function appendLimitedCollection(collection, item, limit) {
  if (rowStoreEnabled()) {
    const appended = await postgresRows().append(collection, item)
    if (rowStoreDualWrite()) {
      await postgres().update((store) => {
        store[collection] ||= []
        store[collection].unshift(appended)
        store[collection] = store[collection].slice(0, limit)
      }, isStoreSnapshot)
    }
    return appended
  }
  if (usePostgres() && rowStoreDualWrite()) {
    await postgres().update((store) => {
      store[collection] ||= []
      store[collection].unshift(item)
      store[collection] = store[collection].slice(0, limit)
    }, isStoreSnapshot)
    return postgresRows().append(collection, item)
  }
  await updateStore((store) => {
    store[collection] ||= []
    store[collection].unshift(item)
    store[collection] = store[collection].slice(0, limit)
  })
  return item
}

export function appendAnalyticsEvent(event) {
  return appendLimitedCollection('analyticsEvents', event, 5000)
}

export function appendSupportTicket(ticket) {
  return appendLimitedCollection('supportTickets', ticket, 1000)
}

export async function backfillPostgresRowStore() {
  if (!usePostgres()) throw new Error('DATABASE_URL is required for the PostgreSQL row-store migration')
  await postgres().ensure()
  return postgresRows().backfillFromSnapshot()
}

export async function comparePostgresStores() {
  if (!usePostgres()) throw new Error('DATABASE_URL is required for the PostgreSQL row-store comparison')
  return postgresRows().compare(await postgres().read())
}

export async function restorePostgresSnapshot(backupId) {
  if (!usePostgres()) throw new Error('DATABASE_URL is required to restore a PostgreSQL snapshot')
  return postgresRows().restoreSnapshot(backupId)
}

export function publicSummary(store, userId) {
  const applications = (store.applications || []).filter(app => !userId || app.userId === userId)
  const resumes = (store.resumes || []).filter(item => !userId || item.userId === userId)
  const user = userId ? (store.users || []).find(item => item.id === userId) : null
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
    followUps: (store.followUps || []).filter(item => (!userId || item.userId === userId) && item.status !== 'completed').length,
    inboxEvents: (store.inboxEvents || []).filter(item => !userId || item.userId === userId).length,
    averageMatch,
    latestResume: resumes[0]
      ? Object.fromEntries(Object.entries(resumes[0]).filter(([key]) => !['rawText', 'fileBase64'].includes(key)))
      : null,
    gmailConnected: Boolean(user?.integrations?.gmail?.connected),
    whatsappConnected: Boolean(user?.integrations?.whatsapp?.connected),
    realSendEnabled: process.env.ENABLE_REAL_SEND === 'true',
  }
}

export function ownerSummary(store) {
  const safeUsers = (store.users || []).map(sanitizeUser)
  const jobs = store.jobs || []
  return {
    totalUsers: safeUsers.filter(user => user.role === 'client').length,
    activeUsers: safeUsers.filter(user => user.role === 'client' && user.status === 'active').length,
    suspendedUsers: safeUsers.filter(user => user.role === 'client' && user.status !== 'active').length,
    totalApplications: (store.applications || []).length,
    totalResumes: (store.resumes || []).length,
    publishedProfiles: (store.profiles || []).filter(profile => profile.published).length,
    totalFollowUps: (store.followUps || []).length,
    totalSupportTickets: (store.supportTickets || []).length,
    totalAnalyticsEvents: (store.analyticsEvents || []).length,
    portalUpdatedAt: store.portalUpdateState?.updatedAt || null,
    totalJobs: jobs.length,
    openJobs: jobs.filter(job => !job.isExpired && !job.closedAt).length,
    expiredJobs: jobs.filter(job => job.isExpired || job.closedAt).length,
    activeSessions: (store.sessions || []).length,
    recentUsers: safeUsers
      .filter(user => user.role === 'client')
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 8),
  }
}
