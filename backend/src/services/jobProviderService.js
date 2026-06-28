import fetch from 'node-fetch'
import { v4 as uuid } from 'uuid'

const SYNC_TTL_MS = Number(process.env.JOB_SYNC_TTL_MINUTES || 30) * 60 * 1000
const CLOSE_AFTER_MISSES = Number(process.env.JOB_CLOSE_AFTER_MISSES || 2)
const DEFAULT_QUERY = process.env.DEFAULT_JOB_QUERY || 'software engineer'

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function dateOrNull(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function inferType(...parts) {
  const text = parts.filter(Boolean).join(' ').toLowerCase()
  if (/intern/.test(text)) return 'Internship'
  if (/hybrid/.test(text)) return 'Hybrid'
  if (/remote|anywhere|worldwide/.test(text)) return 'Remote'
  return 'Office 9-5'
}

function salaryText(min, max, currency = '') {
  if (min && max) return `${currency}${min}-${currency}${max}`.trim()
  if (min) return `${currency}${min}+`.trim()
  if (max) return `Up to ${currency}${max}`.trim()
  return ''
}

function numberOrZero(value) {
  const parsed = Number(String(value || '').replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function deadlineFor(job) {
  const now = Date.now()
  const expiresAt = dateOrNull(job.expiresAt)
  const closedAt = dateOrNull(job.closedAt)
  const source = job.deadlineSource || (expiresAt ? 'provider' : closedAt ? 'last_seen' : 'unknown')

  if (closedAt) {
    return {
      ...job,
      expiresAt,
      closedAt,
      deadlineSource: source,
      deadlineStatus: 'closed',
      isExpired: true,
    }
  }

  if (!expiresAt) {
    return {
      ...job,
      expiresAt: null,
      deadlineSource: source,
      deadlineStatus: 'unknown',
      isExpired: false,
    }
  }

  const diff = new Date(expiresAt).getTime() - now
  if (diff < 0) {
    return {
      ...job,
      expiresAt,
      deadlineSource: source,
      deadlineStatus: 'expired',
      isExpired: true,
    }
  }

  return {
    ...job,
    expiresAt,
    deadlineSource: source,
    deadlineStatus: diff <= 7 * 24 * 60 * 60 * 1000 ? 'closing_soon' : 'open',
    isExpired: false,
  }
}

export function applyDeadlineStatus(job = {}) {
  return deadlineFor(job)
}

export function isJobClosed(job = {}) {
  const checked = applyDeadlineStatus(job)
  return Boolean(checked.isExpired || checked.closedAt || ['closed', 'expired'].includes(checked.deadlineStatus))
}

function jobKey(job) {
  return `${providerName(job)}::${job.externalId || job.id}`
}

function providerName(job = {}) {
  if (job.provider) return job.provider
  if (job.source === 'Demo Board') return 'demo'
  return job.source || 'manual'
}

function normalizeIncoming(job) {
  const normalized = deadlineFor({
    id: job.id || `${job.provider}-${job.externalId || uuid()}`,
    provider: job.provider || 'manual',
    externalId: String(job.externalId || job.id || uuid()),
    title: cleanText(job.title),
    company: cleanText(job.company),
    location: cleanText(job.location || 'Remote'),
    type: job.type || inferType(job.title, job.location, job.description),
    salary: cleanText(job.salary),
    salaryMin: numberOrZero(job.salaryMin),
    source: job.source || job.provider || 'Provider',
    posted: job.posted || (job.postedAt ? new Date(job.postedAt).toLocaleDateString() : 'Recently'),
    postedAt: dateOrNull(job.postedAt),
    expiresAt: dateOrNull(job.expiresAt),
    deadlineSource: job.deadlineSource || (job.expiresAt ? 'provider' : 'unknown'),
    applyUrl: job.applyUrl || job.url || '#',
    sourceUrl: job.sourceUrl || job.applyUrl || job.url || '#',
    url: job.applyUrl || job.url || '#',
    recruiterEmail: job.recruiterEmail || '',
    recruiterPhone: job.recruiterPhone || '',
    description: cleanText(job.description),
    tags: Array.isArray(job.tags) ? job.tags.filter(Boolean).map(cleanText).slice(0, 12) : [],
    lastSeenAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    syncMisses: 0,
  })

  return normalized
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Number(process.env.JOB_PROVIDER_TIMEOUT_MS || 12000))
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

function searchText(params = {}) {
  return cleanText(params.query || params.role || DEFAULT_QUERY) || DEFAULT_QUERY
}

async function fetchJSearch(params = {}) {
  const key = process.env.JSEARCH_API_KEY || process.env.RAPIDAPI_KEY
  if (!key) return { provider: 'jsearch', enabled: false, jobs: [], message: 'JSEARCH_API_KEY or RAPIDAPI_KEY is not configured' }

  const endpoint = process.env.JSEARCH_API_URL || 'https://jsearch.p.rapidapi.com/search'
  const url = new URL(endpoint)
  url.searchParams.set('query', [searchText(params), params.location].filter(Boolean).join(' '))
  url.searchParams.set('page', '1')
  url.searchParams.set('num_pages', process.env.JSEARCH_NUM_PAGES || '1')
  url.searchParams.set('date_posted', process.env.JSEARCH_DATE_POSTED || 'month')

  const headers = {
    'X-RapidAPI-Key': key,
    'X-RapidAPI-Host': process.env.JSEARCH_RAPIDAPI_HOST || 'jsearch.p.rapidapi.com',
  }
  const payload = await fetchJson(url, { headers })
  const data = Array.isArray(payload.data) ? payload.data : []
  return {
    provider: 'jsearch',
    enabled: true,
    jobs: data.map(item => normalizeIncoming({
      provider: 'jsearch',
      externalId: item.job_id,
      title: item.job_title,
      company: item.employer_name,
      location: [item.job_city, item.job_state, item.job_country].filter(Boolean).join(', ') || item.job_location || 'Remote',
      type: inferType(item.job_employment_type, item.job_is_remote ? 'remote' : ''),
      salary: salaryText(item.job_min_salary, item.job_max_salary, item.job_salary_currency ? `${item.job_salary_currency} ` : ''),
      salaryMin: item.job_min_salary,
      source: 'JSearch',
      postedAt: item.job_posted_at_datetime_utc,
      expiresAt: item.job_offer_expiration_datetime_utc,
      deadlineSource: item.job_offer_expiration_datetime_utc ? 'provider' : 'unknown',
      applyUrl: item.job_apply_link,
      sourceUrl: item.job_google_link || item.job_apply_link,
      description: item.job_description,
      tags: item.job_required_skills || [],
    })),
  }
}

async function fetchAdzuna(params = {}) {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) return { provider: 'adzuna', enabled: false, jobs: [], message: 'ADZUNA_APP_ID and ADZUNA_APP_KEY are not configured' }

  const country = (process.env.ADZUNA_COUNTRY || 'gb').toLowerCase()
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`)
  url.searchParams.set('app_id', appId)
  url.searchParams.set('app_key', appKey)
  url.searchParams.set('results_per_page', process.env.ADZUNA_RESULTS_PER_PAGE || '30')
  url.searchParams.set('what', searchText(params))
  if (params.location) url.searchParams.set('where', params.location)
  url.searchParams.set('content-type', 'application/json')

  const payload = await fetchJson(url)
  const results = Array.isArray(payload.results) ? payload.results : []
  return {
    provider: 'adzuna',
    enabled: true,
    jobs: results.map(item => normalizeIncoming({
      provider: 'adzuna',
      externalId: item.id,
      title: item.title,
      company: item.company?.display_name,
      location: item.location?.display_name,
      type: inferType(item.contract_time, item.contract_type, item.title, item.description),
      salary: salaryText(item.salary_min, item.salary_max, item.salary_currency ? `${item.salary_currency} ` : ''),
      salaryMin: item.salary_min,
      source: 'Adzuna',
      postedAt: item.created,
      deadlineSource: 'unknown',
      applyUrl: item.redirect_url,
      sourceUrl: item.redirect_url,
      description: item.description,
      tags: [item.category?.label, item.contract_time, item.contract_type].filter(Boolean),
    })),
  }
}

async function fetchRemotive(params = {}) {
  const url = new URL('https://remotive.com/api/remote-jobs')
  url.searchParams.set('search', searchText(params))
  url.searchParams.set('limit', process.env.REMOTIVE_LIMIT || '30')

  const payload = await fetchJson(url)
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : []
  return {
    provider: 'remotive',
    enabled: true,
    jobs: jobs.map(item => normalizeIncoming({
      provider: 'remotive',
      externalId: item.id,
      title: item.title,
      company: item.company_name,
      location: item.candidate_required_location || 'Remote',
      type: inferType(item.job_type, item.candidate_required_location, 'remote'),
      salary: item.salary,
      source: 'Remotive',
      postedAt: item.publication_date,
      deadlineSource: 'unknown',
      applyUrl: item.url,
      sourceUrl: item.url,
      description: item.description,
      tags: item.tags || [],
    })),
  }
}

async function fetchRemoteOk(params = {}) {
  const payload = await fetchJson('https://remoteok.com/api', {
    headers: { 'User-Agent': 'JobPilot-AI/2.0' },
  })
  const query = searchText(params).toLowerCase()
  const jobs = (Array.isArray(payload) ? payload : [])
    .filter(item => item && typeof item === 'object' && item.id)
    .filter((item) => {
      const searchable = `${item.position || item.title || ''} ${(item.tags || []).join(' ')} ${cleanText(item.description)}`.toLowerCase()
      return !query || query.split(/\s+/).some(token => searchable.includes(token))
    })
    .slice(0, Number(process.env.REMOTEOK_LIMIT || 40))

  return {
    provider: 'remoteok',
    enabled: true,
    jobs: jobs.map(item => normalizeIncoming({
      provider: 'remoteok',
      externalId: item.id,
      title: item.position || item.title,
      company: item.company,
      location: item.location || 'Remote',
      type: 'Remote',
      salary: item.salary_min || item.salary_max ? salaryText(item.salary_min, item.salary_max, '$') : '',
      salaryMin: item.salary_min,
      source: 'Remote OK',
      postedAt: item.date,
      deadlineSource: 'unknown',
      applyUrl: item.apply_url || item.url,
      sourceUrl: item.url,
      description: item.description,
      tags: item.tags || [],
    })),
  }
}

async function fetchArbeitnow(params = {}) {
  const payload = await fetchJson('https://www.arbeitnow.com/api/job-board-api')
  const query = searchText(params).toLowerCase()
  const jobs = (Array.isArray(payload.data) ? payload.data : [])
    .filter((item) => {
      const searchable = `${item.title || ''} ${(item.tags || []).join(' ')} ${cleanText(item.description)}`.toLowerCase()
      return !query || query.split(/\s+/).some(token => searchable.includes(token))
    })
    .slice(0, Number(process.env.ARBEITNOW_LIMIT || 40))

  return {
    provider: 'arbeitnow',
    enabled: true,
    jobs: jobs.map(item => normalizeIncoming({
      provider: 'arbeitnow',
      externalId: item.slug || item.url,
      title: item.title,
      company: item.company_name,
      location: item.location || 'Remote',
      type: inferType(item.remote ? 'remote' : '', item.title, item.description),
      source: 'Arbeitnow',
      postedAt: item.created_at,
      deadlineSource: 'unknown',
      applyUrl: item.url,
      sourceUrl: item.url,
      description: item.description,
      tags: item.tags || [],
    })),
  }
}

async function fetchUsaJobs(params = {}) {
  const key = process.env.USAJOBS_API_KEY
  const userAgent = process.env.USAJOBS_USER_AGENT || process.env.OWNER_EMAIL
  if (!key || !userAgent) return { provider: 'usajobs', enabled: false, jobs: [], message: 'USAJOBS_API_KEY and USAJOBS_USER_AGENT are not configured' }

  const url = new URL('https://data.usajobs.gov/api/Search')
  url.searchParams.set('Keyword', searchText(params))
  if (params.location) url.searchParams.set('LocationName', params.location)
  url.searchParams.set('ResultsPerPage', process.env.USAJOBS_RESULTS_PER_PAGE || '25')
  url.searchParams.set('WhoMayApply', 'public')
  url.searchParams.set('Fields', 'Full')

  const payload = await fetchJson(url, {
    headers: {
      Host: 'data.usajobs.gov',
      'User-Agent': userAgent,
      'Authorization-Key': key,
    },
  })
  const items = Array.isArray(payload.SearchResult?.SearchResultItems) ? payload.SearchResult.SearchResultItems : []
  return {
    provider: 'usajobs',
    enabled: true,
    jobs: items.map((item) => {
      const descriptor = item.MatchedObjectDescriptor || {}
      const details = descriptor.UserArea?.Details || {}
      const salary = descriptor.PositionRemuneration?.[0] || {}
      const duties = Array.isArray(details.MajorDuties) ? details.MajorDuties.join(' ') : details.MajorDuties
      return normalizeIncoming({
        provider: 'usajobs',
        externalId: item.MatchedObjectId,
        title: descriptor.PositionTitle,
        company: descriptor.OrganizationName || descriptor.DepartmentName,
        location: descriptor.PositionLocationDisplay,
        type: inferType(descriptor.PositionSchedule?.[0]?.Name, descriptor.PositionLocationDisplay),
        salary: salary.MinimumRange || salary.MaximumRange
          ? `${salary.MinimumRange || ''}-${salary.MaximumRange || ''} ${salary.RateIntervalDescription || ''}`.trim()
          : '',
        salaryMin: salary.MinimumRange,
        source: 'USAJOBS',
        postedAt: descriptor.PublicationStartDate,
        expiresAt: descriptor.ApplicationCloseDate,
        deadlineSource: descriptor.ApplicationCloseDate ? 'provider' : 'unknown',
        applyUrl: descriptor.ApplyURI?.[0] || descriptor.PositionURI,
        sourceUrl: descriptor.PositionURI,
        description: [details.JobSummary, duties, details.Requirements].filter(Boolean).join(' '),
        tags: [descriptor.JobCategory?.[0]?.Name, descriptor.PositionSchedule?.[0]?.Name].filter(Boolean),
      })
    }),
  }
}

function cacheIsFresh(store, params = {}) {
  const runs = store.jobSyncRuns || []
  const query = searchText(params)
  const location = cleanText(params.location || '')
  const matchingRun = runs.find(run => run.query === query && cleanText(run.location || '') === location)
  const latest = matchingRun?.createdAt ? new Date(matchingRun.createdAt).getTime() : 0
  if (!latest) return false
  return Date.now() - latest < SYNC_TTL_MS
}

export function refreshJobDeadlines(store) {
  const now = new Date().toISOString()
  const jobById = new Map()
  store.jobs = (store.jobs || []).map((job) => {
    const checked = applyDeadlineStatus(job)
    jobById.set(checked.id, checked)
    return checked
  })

  for (const application of store.applications || []) {
    const liveJob = jobById.get(application.job?.id)
    if (liveJob) application.job = { ...application.job, ...liveJob }
    const expired = isJobClosed(application.job)
    if (expired && ['pending_review', 'approved'].includes(application.status)) {
      application.status = 'job_closed'
      application.closedAt = application.job.closedAt || application.job.expiresAt || now
      application.updatedAt = now
    }
  }
}

function shouldHideSeedJobs(store) {
  return (store.jobs || []).some(job => providerName(job) !== 'demo')
}

export async function syncJobsIntoStore(store, params = {}, options = {}) {
  refreshJobDeadlines(store)
  const syncQuery = searchText(params)
  if (!options.force && cacheIsFresh(store, params) && (store.jobs || []).some(job => job.provider && job.provider !== 'demo')) {
    return {
      skipped: true,
      reason: 'cache_fresh',
      providerStatus: store.providerStatus || {},
      jobsImported: 0,
      jobsExpired: (store.jobs || []).filter(isJobClosed).length,
    }
  }

  const providers = [fetchJSearch, fetchAdzuna, fetchRemotive, fetchRemoteOk, fetchArbeitnow, fetchUsaJobs]
  const now = new Date().toISOString()
  const results = await Promise.all(providers.map(async (providerFn) => {
    try {
      return await providerFn(params)
    } catch (err) {
      const provider = providerFn.name.replace(/^fetch/, '').toLowerCase()
      return { provider, enabled: true, jobs: [], error: err.message }
    }
  }))

  store.providerStatus ||= {}
  const existingByKey = new Map((store.jobs || []).map(job => [jobKey(job), job]))
  const seenKeys = new Set()
  const providersRan = new Set()
  let imported = 0

  for (const result of results) {
    const provider = result.provider
    const jobs = result.jobs || []
    if (result.enabled) providersRan.add(provider)

    store.providerStatus[provider] = {
      provider,
      enabled: Boolean(result.enabled),
      ok: Boolean(result.enabled && !result.error),
      message: result.message || '',
      error: result.error || '',
      imported: jobs.length,
      lastSyncAt: now,
      query: searchText(params),
    }

    for (const incoming of jobs) {
      incoming.syncQuery = syncQuery
      const key = jobKey(incoming)
      seenKeys.add(key)
      const existing = existingByKey.get(key)
      const merged = existing
        ? { ...existing, ...incoming, syncMisses: 0, closedAt: null, lastSeenAt: now, lastVerifiedAt: now }
        : { ...incoming, id: incoming.id || `${incoming.provider}-${incoming.externalId}`, lastSeenAt: now, lastVerifiedAt: now }
      existingByKey.set(key, applyDeadlineStatus(merged))
      if (!existing) imported += 1
    }
  }

  const mergedJobs = Array.from(existingByKey.values()).map((job) => {
    const provider = providerName(job)
    if (providersRan.has(provider) && job.syncQuery === syncQuery && !seenKeys.has(jobKey(job)) && provider !== 'demo') {
      const syncMisses = Number(job.syncMisses || 0) + 1
      if (syncMisses >= CLOSE_AFTER_MISSES && !job.expiresAt) {
        return applyDeadlineStatus({
          ...job,
          syncMisses,
          closedAt: job.closedAt || now,
          deadlineSource: 'last_seen',
          lastVerifiedAt: now,
        })
      }
      return applyDeadlineStatus({ ...job, syncMisses, lastVerifiedAt: now })
    }
    return applyDeadlineStatus(job)
  })

  store.jobs = shouldHideSeedJobs({ jobs: mergedJobs })
    ? mergedJobs.filter(job => providerName(job) !== 'demo')
    : mergedJobs

  refreshJobDeadlines(store)

  const run = {
    id: uuid(),
    query: syncQuery,
    location: params.location || '',
    providers: results.map(result => ({
      provider: result.provider,
      enabled: Boolean(result.enabled),
      ok: Boolean(result.enabled && !result.error),
      imported: result.jobs?.length || 0,
      error: result.error || '',
      message: result.message || '',
    })),
    jobsImported: imported,
    jobsExpired: (store.jobs || []).filter(isJobClosed).length,
    createdAt: now,
  }
  store.jobSyncRuns = [run, ...(store.jobSyncRuns || [])].slice(0, 50)

  return {
    skipped: false,
    ...run,
    providerStatus: store.providerStatus,
  }
}
