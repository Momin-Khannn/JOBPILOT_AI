import pg from 'pg'
import crypto from 'crypto'
import { contentHash, compareStoreFingerprints, storeFingerprint, validateStoreForRowMigration } from './storeIntegrity.js'
import { ROW_STORE_SCHEMA_SQL } from './rowStoreSchema.js'

const { Pool } = pg

function sslConfig() {
  if (process.env.PGSSL === 'true') return { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' }
  return undefined
}

function timestamp(...values) {
  for (const value of values) {
    if (!value) continue
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return null
}

function deterministicId(collection, item, index) {
  return `${collection}-${contentHash({ item, index }).slice(0, 24)}`
}

const COLLECTIONS = {
  users: {
    table: 'users',
    columns: ['email', 'role', 'status', 'created_at', 'updated_at'],
    values: item => [
      item.email || null,
      item.role || 'client',
      item.status || 'active',
      timestamp(item.createdAt),
      timestamp(item.updatedAt, item.lastLoginAt, item.createdAt) || new Date().toISOString(),
    ],
    order: 'LOWER(email) ASC, id ASC',
  },
  sessions: {
    table: 'sessions',
    columns: ['token_hash', 'user_id', 'created_at', 'last_seen_at', 'expires_at'],
    values: item => [item.tokenHash || null, item.userId, timestamp(item.createdAt), timestamp(item.lastSeenAt, item.createdAt), timestamp(item.expiresAt)],
    order: 'last_seen_at DESC NULLS LAST, id ASC',
  },
  resumes: {
    table: 'resumes',
    columns: ['user_id', 'created_at'],
    values: item => [item.userId, timestamp(item.createdAt, item.uploadedAt)],
    order: 'created_at DESC NULLS LAST, id ASC',
  },
  profiles: {
    table: 'profiles',
    columns: ['user_id', 'slug', 'published', 'updated_at'],
    values: item => [item.userId, item.slug || null, Boolean(item.published), timestamp(item.updatedAt, item.createdAt)],
    order: 'updated_at DESC NULLS LAST, id ASC',
  },
  jobs: {
    table: 'jobs',
    columns: ['provider', 'external_id', 'deadline_status', 'is_expired', 'last_seen_at'],
    values: item => [item.provider || item.source || 'demo', String(item.externalId || item.id), item.deadlineStatus || 'unknown', Boolean(item.isExpired), timestamp(item.lastSeenAt, item.lastVerifiedAt, item.createdAt)],
    order: 'last_seen_at DESC NULLS LAST, id ASC',
  },
  applications: {
    table: 'applications',
    columns: ['user_id', 'job_id', 'status', 'created_at', 'updated_at'],
    values: item => [item.userId, item.jobId || item.job?.id || null, item.status || null, timestamp(item.createdAt), timestamp(item.updatedAt, item.createdAt)],
    order: 'updated_at DESC NULLS LAST, id ASC',
  },
  messages: {
    table: 'messages',
    columns: ['user_id', 'application_id', 'channel', 'created_at'],
    values: item => [item.userId, item.applicationId || null, item.channel || null, timestamp(item.createdAt)],
    order: 'created_at DESC NULLS LAST, id ASC',
  },
  followUps: {
    table: 'follow_ups',
    columns: ['user_id', 'application_id', 'status', 'due_at'],
    values: item => [item.userId, item.applicationId || null, item.status || null, timestamp(item.dueAt)],
    order: 'due_at ASC NULLS LAST, id ASC',
  },
  inboxEvents: {
    table: 'inbox_events',
    columns: ['user_id', 'created_at'],
    values: item => [item.userId, timestamp(item.createdAt)],
    order: 'created_at DESC NULLS LAST, id ASC',
  },
  auditLogs: {
    table: 'audit_logs',
    columns: ['action', 'created_at'],
    values: item => [item.action || null, timestamp(item.createdAt)],
    order: 'created_at DESC NULLS LAST, id ASC',
    limit: 250,
  },
  supportTickets: {
    table: 'support_tickets',
    columns: ['type', 'status', 'created_at'],
    values: item => [item.type || 'support', item.status || 'new', timestamp(item.createdAt)],
    order: 'created_at DESC NULLS LAST, id ASC',
    limit: 1000,
  },
  analyticsEvents: {
    table: 'analytics_events',
    columns: ['type', 'name', 'session_id', 'created_at'],
    values: item => [item.type || 'event', item.name || '', item.sessionId || null, timestamp(item.createdAt)],
    order: 'created_at DESC NULLS LAST, id ASC',
    limit: 5000,
  },
  jobSyncRuns: {
    table: 'job_sync_runs',
    columns: ['provider', 'created_at'],
    values: item => [item.provider || null, timestamp(item.createdAt, item.startedAt, item.completedAt)],
    order: 'created_at DESC NULLS LAST, id ASC',
    limit: 50,
  },
  interviewSessions: {
    table: 'interview_sessions',
    columns: ['user_id', 'application_id', 'status', 'created_at', 'updated_at'],
    values: item => [item.userId, item.applicationId || null, item.status || null, timestamp(item.createdAt), timestamp(item.updatedAt, item.createdAt)],
    order: 'updated_at DESC NULLS LAST, id ASC',
    limit: 100,
  },
  billingEvents: {
    table: 'billing_events',
    columns: ['user_id', 'type', 'created_at'],
    values: item => [item.userId || null, item.type || null, timestamp(item.createdAt)],
    order: 'created_at DESC NULLS LAST, id ASC',
    limit: 1000,
  },
}

const WRITE_ORDER = [
  'users',
  'jobs',
  'sessions',
  'resumes',
  'profiles',
  'applications',
  'messages',
  'followUps',
  'inboxEvents',
  'auditLogs',
  'supportTickets',
  'analyticsEvents',
  'jobSyncRuns',
  'interviewSessions',
  'billingEvents',
]

const META_KEYS = [
  'integrations',
  'providerStatus',
  'portalUpdateState',
  'companies',
  'employerAccessRequests',
  'conversations',
  'notifications',
  'marketplaceReports',
]

function prepareItems(collection, items = []) {
  const config = COLLECTIONS[collection]
  const source = Array.isArray(items) ? items.slice(0, config.limit || items.length) : []
  return source.map((item, index) => {
    const id = item?.id || deterministicId(collection, item, index)
    const prepared = { ...item, id }
    if (collection === 'sessions' && !prepared.tokenHash) {
      throw new Error(`Session ${id} cannot be stored without a token hash`)
    }
    return prepared
  })
}

function upsertSql(config) {
  const fields = ['id', ...config.columns, 'data']
  const placeholders = fields
    .map((_, index) => index === fields.length - 1 ? `$${index + 1}::jsonb` : `$${index + 1}`)
    .join(', ')
  const updates = [...config.columns, 'data'].map(column => `${column} = EXCLUDED.${column}`).join(', ')
  return `
    INSERT INTO jobpilot_row.${config.table} (${fields.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updates}
  `
}

function postgresType(column) {
  if (['published', 'is_expired'].includes(column)) return 'boolean'
  if (column.endsWith('_at')) return 'timestamptz'
  return 'text'
}

async function bulkUpsertEntities(client, collection, items) {
  if (!items.length) return
  const config = COLLECTIONS[collection]
  const fields = ['id', ...config.columns, 'data']
  const definitions = fields
    .map(field => `${field} ${field === 'data' ? 'jsonb' : field === 'id' ? 'text' : postgresType(field)}`)
    .join(', ')
  const updates = [...config.columns, 'data'].map(column => `${column} = EXCLUDED.${column}`).join(', ')
  const rows = items.map(item => Object.fromEntries([
    ['id', item.id],
    ...config.columns.map((column, index) => [column, config.values(item)[index]]),
    ['data', item],
  ]))

  for (let index = 0; index < rows.length; index += 500) {
    const batch = rows.slice(index, index + 500)
    await client.query(
      `INSERT INTO jobpilot_row.${config.table} (${fields.join(', ')})
       SELECT ${fields.join(', ')}
       FROM jsonb_to_recordset($1::jsonb) AS input(${definitions})
       ON CONFLICT (id) DO UPDATE SET ${updates}`,
      [JSON.stringify(batch)],
    )
  }
}

async function upsertEntity(client, collection, item) {
  const config = COLLECTIONS[collection]
  const values = [item.id, ...config.values(item), JSON.stringify(item)]
  await client.query(upsertSql(config), values)
}

async function loadExistingCollections(client) {
  const unions = Object.entries(COLLECTIONS)
    .map(([collection, config]) => `SELECT '${collection}' AS collection, id, data FROM jobpilot_row.${config.table}`)
    .join(' UNION ALL ')
  const { rows } = await client.query(unions)
  const result = new Map(Object.keys(COLLECTIONS).map(collection => [collection, new Map()]))
  for (const row of rows) result.get(row.collection).set(row.id, row.data)
  return result
}

async function syncCollection(client, collection, rawItems, existingRows) {
  const config = COLLECTIONS[collection]
  const items = prepareItems(collection, rawItems)
  const existing = new Map(existingRows || [])

  const changed = []
  for (const item of items) {
    if (contentHash(existing.get(item.id)) !== contentHash(item)) {
      changed.push(item)
    }
    existing.delete(item.id)
  }

  await bulkUpsertEntities(client, collection, changed)

  const removedIds = [...existing.keys()]
  if (removedIds.length) {
    await client.query(`DELETE FROM jobpilot_row.${config.table} WHERE id = ANY($1::text[])`, [removedIds])
  }
}

function integrationRows(store) {
  const rows = []
  for (const user of store.users || []) {
    for (const [provider, integration] of Object.entries(user.integrations || {})) {
      rows.push({
        userId: user.id,
        provider,
        updatedAt: integration?.updatedAt || null,
        data: { userId: user.id, provider, ...integration },
      })
    }
  }
  return rows
}

async function syncIntegrations(client, store) {
  const desired = new Map(integrationRows(store).map(row => [`${row.userId}\u0000${row.provider}`, row]))
  const { rows } = await client.query('SELECT user_id, provider, data FROM jobpilot_row.integrations')
  const existing = new Map(rows.map(row => [`${row.user_id}\u0000${row.provider}`, row]))

  for (const [key, row] of desired) {
    if (contentHash(existing.get(key)?.data) !== contentHash(row.data)) {
      await client.query(
        `INSERT INTO jobpilot_row.integrations (user_id, provider, updated_at, data)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (user_id, provider) DO UPDATE
         SET updated_at = EXCLUDED.updated_at, data = EXCLUDED.data`,
        [row.userId, row.provider, timestamp(row.updatedAt), JSON.stringify(row.data)],
      )
    }
    existing.delete(key)
  }

  for (const row of existing.values()) {
    await client.query(
      'DELETE FROM jobpilot_row.integrations WHERE user_id = $1 AND provider = $2',
      [row.user_id, row.provider],
    )
  }
}

function dailyUsageRows(dailyUsage = {}) {
  const rows = []
  for (const [dayKey, users] of Object.entries(dailyUsage || {})) {
    if (!users || typeof users !== 'object') continue
    for (const [userId, channels] of Object.entries(users)) {
      if (!channels || typeof channels !== 'object') continue
      for (const [channel, rawCount] of Object.entries(channels)) {
        const count = Math.max(0, Number(rawCount || 0))
        rows.push({ dayKey, userId, channel, count })
      }
    }
  }
  return rows
}

async function syncDailyUsage(client, dailyUsage) {
  const desired = new Map(dailyUsageRows(dailyUsage).map(row => [`${row.dayKey}\u0000${row.userId}\u0000${row.channel}`, row]))
  const { rows } = await client.query('SELECT day_key, user_id, channel, count FROM jobpilot_row.daily_usage')
  const existing = new Map(rows.map(row => [`${row.day_key}\u0000${row.user_id}\u0000${row.channel}`, row]))

  for (const [key, row] of desired) {
    if (Number(existing.get(key)?.count) !== row.count) {
      await client.query(
        `INSERT INTO jobpilot_row.daily_usage (day_key, user_id, channel, count, data)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (day_key, user_id, channel) DO UPDATE
         SET count = EXCLUDED.count, data = EXCLUDED.data`,
        [row.dayKey, row.userId, row.channel, row.count, JSON.stringify(row)],
      )
    }
    existing.delete(key)
  }

  for (const row of existing.values()) {
    await client.query(
      'DELETE FROM jobpilot_row.daily_usage WHERE day_key = $1 AND user_id = $2 AND channel = $3',
      [row.day_key, row.user_id, row.channel],
    )
  }
}

async function syncMeta(client, store) {
  const rows = META_KEYS.map(key => ({ key, data: store[key] ?? null }))
  await client.query(
    `INSERT INTO jobpilot_row.meta (key, data, updated_at)
     SELECT key, data, NOW()
     FROM jsonb_to_recordset($1::jsonb) AS input(key text, data jsonb)
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [JSON.stringify(rows)],
  )
}

async function readCollections(client) {
  const selections = Object.entries(COLLECTIONS).map(([collection, config]) => {
    const limit = config.limit ? ` LIMIT ${config.limit}` : ''
    return `(
      SELECT COALESCE(jsonb_agg(ordered.data), '[]'::jsonb)
      FROM (
        SELECT data FROM jobpilot_row.${config.table}
        ORDER BY ${config.order}${limit}
      ) AS ordered
    ) AS "${collection}"`
  })
  const { rows } = await client.query(`SELECT ${selections.join(', ')}`)
  return rows[0] || {}
}

async function readDailyUsage(client) {
  const usage = {}
  const { rows } = await client.query('SELECT day_key, user_id, channel, count FROM jobpilot_row.daily_usage')
  for (const row of rows) {
    usage[row.day_key] ||= {}
    usage[row.day_key][row.user_id] ||= {}
    usage[row.day_key][row.user_id][row.channel] = Number(row.count)
  }
  return usage
}

async function readMeta(client) {
  const { rows } = await client.query(
    'SELECT key, data FROM jobpilot_row.meta WHERE key = ANY($1::text[])',
    [META_KEYS],
  )
  return Object.fromEntries(rows.map(row => [row.key, row.data]))
}

async function mergeIntegrations(client, users) {
  const { rows } = await client.query('SELECT user_id, provider, data FROM jobpilot_row.integrations')
  const usersById = new Map(users.map(user => [user.id, user]))
  for (const row of rows) {
    const user = usersById.get(row.user_id)
    if (!user) continue
    user.integrations ||= {}
    user.integrations[row.provider] = { ...(row.data || {}) }
    delete user.integrations[row.provider].userId
    delete user.integrations[row.provider].provider
  }
}

export function createPostgresRowStore({ emptyStore, normalizeStore, connectionString = process.env.DATABASE_URL }) {
  const pool = new Pool({
    connectionString,
    max: Math.max(2, Number(process.env.PG_POOL_MAX || 10)),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: sslConfig(),
  })
  let initialization = null

  async function ensure() {
    if (!initialization) {
      initialization = pool.query(ROW_STORE_SCHEMA_SQL).catch((error) => {
        initialization = null
        throw error
      })
    }
    return initialization
  }

  async function readWithClient(client) {
    const collections = await readCollections(client)
    const dailyUsage = await readDailyUsage(client)
    const meta = await readMeta(client)
    await mergeIntegrations(client, collections.users)
    return normalizeStore({ ...emptyStore(), ...collections, ...meta, dailyUsage })
  }

  async function read() {
    await ensure()
    return readWithClient(pool)
  }

  async function syncStore(client, rawStore) {
    const store = normalizeStore(rawStore)
    const existing = await loadExistingCollections(client)
    for (const collection of WRITE_ORDER) {
      await syncCollection(client, collection, store[collection], existing.get(collection))
    }
    await syncIntegrations(client, store)
    await syncDailyUsage(client, store.dailyUsage)
    await syncMeta(client, store)
    await client.query(
      `INSERT INTO jobpilot_row.meta (key, data, updated_at)
       VALUES ('rowStoreState', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [JSON.stringify({ fingerprint: storeFingerprint(store), syncedAt: new Date().toISOString() })],
    )
    return store
  }

  async function transaction(operation) {
    await ensure()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SELECT pg_advisory_xact_lock(hashtext('jobpilot_row_store'))")
      const result = await operation(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async function write(store) {
    return transaction(client => syncStore(client, store))
  }

  async function update(mutator, isStoreSnapshot) {
    return transaction(async (client) => {
      const store = await readWithClient(client)
      const result = await mutator(store)
      const nextStore = isStoreSnapshot(result) ? result : store
      const committedStore = await syncStore(client, nextStore)
      return { result: result === undefined ? committedStore : result, store: committedStore }
    })
  }

  async function compare(snapshot) {
    const rowStore = await read()
    const snapshotFingerprint = storeFingerprint(normalizeStore(snapshot))
    const rowFingerprint = storeFingerprint(rowStore)
    return {
      ...compareStoreFingerprints(snapshotFingerprint, rowFingerprint),
      snapshot: snapshotFingerprint,
      rowStore: rowFingerprint,
    }
  }

  async function backupSnapshot(label = 'row-store-migration') {
    await ensure()
    const id = `${label}-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(4).toString('hex')}`
    const { rows } = await pool.query(
      `INSERT INTO jobpilot_row.snapshot_backups (id, source_version, data)
       SELECT $1, version, data FROM public.jobpilot_state WHERE id = 1
       RETURNING id, source_version, created_at`,
      [id],
    )
    if (!rows[0]) throw new Error('The PostgreSQL snapshot could not be backed up')
    return rows[0]
  }

  async function backfillFromSnapshot(label = 'row-store-migration') {
    return transaction(async (client) => {
      const { rows } = await client.query(
        'SELECT version, data FROM public.jobpilot_state WHERE id = 1 FOR UPDATE',
      )
      if (!rows[0]) throw new Error('The PostgreSQL snapshot is missing')

      const snapshot = normalizeStore(rows[0].data)
      const validation = validateStoreForRowMigration(snapshot)
      if (!validation.valid) {
        const error = new Error('Snapshot data failed normalized row-store validation')
        error.validation = validation
        throw error
      }

      const backupId = `${label}-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(4).toString('hex')}`
      const backupResult = await client.query(
        `INSERT INTO jobpilot_row.snapshot_backups (id, source_version, data)
         VALUES ($1, $2, $3::jsonb)
         RETURNING id, source_version, created_at`,
        [backupId, rows[0].version, JSON.stringify(snapshot)],
      )

      await syncStore(client, snapshot)
      const persisted = await readWithClient(client)
      const snapshotFingerprint = storeFingerprint(snapshot)
      const rowFingerprint = storeFingerprint(persisted)
      const comparison = {
        ...compareStoreFingerprints(snapshotFingerprint, rowFingerprint),
        snapshot: snapshotFingerprint,
        rowStore: rowFingerprint,
      }

      if (!comparison.equal) {
        const error = new Error('Normalized row-store verification failed')
        error.comparison = comparison
        throw error
      }

      return { backup: backupResult.rows[0], validation, comparison }
    })
  }

  async function restoreSnapshot(backupId) {
    return transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE public.jobpilot_state AS state
         SET data = backup.data,
             version = state.version + 1,
             updated_at = NOW()
         FROM jobpilot_row.snapshot_backups AS backup
         WHERE state.id = 1 AND backup.id = $1
         RETURNING state.version, state.updated_at`,
        [backupId],
      )
      if (!rows[0]) throw new Error(`Snapshot backup not found: ${backupId}`)
      return rows[0]
    })
  }

  async function findAuthSession(tokenHash) {
    await ensure()
    const { rows } = await pool.query(
      `SELECT sessions.data AS session, users.data AS user
       FROM jobpilot_row.sessions AS sessions
       INNER JOIN jobpilot_row.users AS users ON users.id = sessions.user_id
       WHERE sessions.token_hash = $1
       LIMIT 1`,
      [tokenHash],
    )
    return rows[0] || null
  }

  async function deleteSession(id) {
    await ensure()
    await pool.query('DELETE FROM jobpilot_row.sessions WHERE id = $1', [id])
  }

  async function touchSession(id, lastSeenAt) {
    await ensure()
    await pool.query(
      `UPDATE jobpilot_row.sessions
       SET last_seen_at = $2,
           data = jsonb_set(data, '{lastSeenAt}', to_jsonb($3::text), TRUE)
       WHERE id = $1`,
      [id, timestamp(lastSeenAt), String(lastSeenAt)],
    )
  }

  async function append(collection, rawItem) {
    const config = COLLECTIONS[collection]
    if (!config) throw new Error(`Unknown row-store collection: ${collection}`)
    const [item] = prepareItems(collection, [rawItem])
    await transaction(async (client) => {
      await upsertEntity(client, collection, item)
      if (config.limit) {
        await client.query(
          `DELETE FROM jobpilot_row.${config.table}
           WHERE id IN (
             SELECT id FROM jobpilot_row.${config.table}
             ORDER BY ${config.order}
             OFFSET $1
           )`,
          [config.limit],
        )
      }
    })
    return item
  }

  async function close() {
    await pool.end()
  }

  return {
    ensure,
    read,
    write,
    update,
    compare,
    backupSnapshot,
    backfillFromSnapshot,
    restoreSnapshot,
    findAuthSession,
    deleteSession,
    touchSession,
    append,
    close,
  }
}

export { COLLECTIONS as rowStoreCollections }
