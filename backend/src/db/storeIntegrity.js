import crypto from 'crypto'

export const STORE_COLLECTIONS = [
  'users',
  'sessions',
  'resumes',
  'profiles',
  'jobs',
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

export const STORE_OBJECTS = [
  'dailyUsage',
  'integrations',
  'providerStatus',
  'portalUpdateState',
]

export function stableStringify(value) {
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function canonicalCollection(items = []) {
  return [...items].sort((left, right) => {
    const leftKey = String(left?.id || stableStringify(left))
    const rightKey = String(right?.id || stableStringify(right))
    return leftKey.localeCompare(rightKey)
  })
}

export function contentHash(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex')
}

export function storeFingerprint(store = {}) {
  const collections = Object.fromEntries(
    STORE_COLLECTIONS.map((key) => {
      const items = Array.isArray(store[key]) ? store[key] : []
      return [key, { count: items.length, hash: contentHash(canonicalCollection(items)) }]
    }),
  )
  const objects = Object.fromEntries(
    STORE_OBJECTS.map((key) => [key, { hash: contentHash(store[key] ?? null) }]),
  )
  return { collections, objects }
}

export function compareStoreFingerprints(left, right) {
  const differences = []
  for (const key of STORE_COLLECTIONS) {
    const leftValue = left.collections[key]
    const rightValue = right.collections[key]
    if (leftValue.count !== rightValue.count || leftValue.hash !== rightValue.hash) {
      differences.push({ key, left: leftValue, right: rightValue })
    }
  }
  for (const key of STORE_OBJECTS) {
    const leftValue = left.objects[key]
    const rightValue = right.objects[key]
    if (leftValue.hash !== rightValue.hash) differences.push({ key, left: leftValue, right: rightValue })
  }
  return { equal: differences.length === 0, differences }
}

function duplicates(values) {
  const seen = new Set()
  const repeated = new Set()
  for (const value of values.filter(Boolean)) {
    const key = String(value).toLowerCase()
    if (seen.has(key)) repeated.add(key)
    seen.add(key)
  }
  return [...repeated]
}

export function validateStoreForRowMigration(store = {}) {
  const issues = []
  const userIds = new Set((store.users || []).map(user => user.id))
  const applicationIds = new Set((store.applications || []).map(application => application.id))

  for (const collection of STORE_COLLECTIONS) {
    const repeatedIds = duplicates((store[collection] || []).map(item => item?.id))
    if (repeatedIds.length) issues.push({ collection, type: 'duplicate_ids', values: repeatedIds })
  }

  const repeatedEmails = duplicates((store.users || []).map(user => user.email))
  if (repeatedEmails.length) issues.push({ collection: 'users', type: 'duplicate_emails', values: repeatedEmails })

  const repeatedProfileUsers = duplicates((store.profiles || []).map(profile => profile.userId))
  if (repeatedProfileUsers.length) issues.push({ collection: 'profiles', type: 'duplicate_user_ids', values: repeatedProfileUsers })
  const repeatedSlugs = duplicates((store.profiles || []).map(profile => profile.slug))
  if (repeatedSlugs.length) issues.push({ collection: 'profiles', type: 'duplicate_slugs', values: repeatedSlugs })

  const repeatedJobs = duplicates((store.jobs || []).map(job => `${job.provider || job.source || 'demo'}\u0000${job.externalId || job.id}`))
  if (repeatedJobs.length) issues.push({ collection: 'jobs', type: 'duplicate_provider_ids', values: repeatedJobs })

  const userReferences = [
    ['sessions', store.sessions],
    ['resumes', store.resumes],
    ['profiles', store.profiles],
    ['applications', store.applications],
    ['messages', store.messages],
    ['followUps', store.followUps],
    ['inboxEvents', store.inboxEvents],
    ['interviewSessions', store.interviewSessions],
  ]
  for (const [collection, items = []] of userReferences) {
    const orphans = items.filter(item => !item?.userId || !userIds.has(item.userId)).map(item => item?.id || '(missing id)')
    if (orphans.length) issues.push({ collection, type: 'orphan_user_references', values: orphans })
  }

  const applicationReferences = [
    ['messages', store.messages],
    ['followUps', store.followUps],
    ['interviewSessions', store.interviewSessions],
  ]
  for (const [collection, items = []] of applicationReferences) {
    const orphans = items
      .filter(item => item?.applicationId && !applicationIds.has(item.applicationId))
      .map(item => item?.id || '(missing id)')
    if (orphans.length) issues.push({ collection, type: 'orphan_application_references', values: orphans })
  }

  const unhashedSessions = (store.sessions || []).filter(session => !session?.tokenHash).map(session => session?.id || '(missing id)')
  if (unhashedSessions.length) issues.push({ collection: 'sessions', type: 'missing_token_hashes', values: unhashedSessions })

  for (const [dayKey, users] of Object.entries(store.dailyUsage || {})) {
    for (const userId of Object.keys(users || {})) {
      if (!userIds.has(userId)) issues.push({ collection: 'dailyUsage', type: 'orphan_user_reference', values: [`${dayKey}:${userId}`] })
    }
  }

  return { valid: issues.length === 0, issues }
}
