import { seedJobs } from '../db/seed.js'
import { analyzeJobRisk, generateDecisionReport, scoreJobMatch } from './aiService.js'
import { applyDeadlineStatus, isJobClosed, refreshJobDeadlines } from './jobProviderService.js'

function numberOrZero(value) {
  const parsed = Number(String(value || '').replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export function normalizeJob(job) {
  return {
    ...job,
    id: job.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: job.title || '',
    company: job.company || '',
    location: job.location || 'Remote',
    type: job.type || 'Remote',
    salary: job.salary || '',
    salaryMin: numberOrZero(job.salaryMin),
    source: job.source || job.provider || 'Manual',
    provider: job.provider || (job.source === 'Demo Board' ? 'demo' : 'manual'),
    externalId: job.externalId || job.id || '',
    posted: job.posted || 'Recently',
    postedAt: job.postedAt || null,
    expiresAt: job.expiresAt || null,
    deadlineSource: job.deadlineSource || (job.expiresAt ? 'provider' : 'unknown'),
    deadlineStatus: job.deadlineStatus || 'unknown',
    isExpired: Boolean(job.isExpired),
    closedAt: job.closedAt || null,
    lastSeenAt: job.lastSeenAt || null,
    lastVerifiedAt: job.lastVerifiedAt || null,
    applyUrl: job.applyUrl || job.url || '#',
    sourceUrl: job.sourceUrl || job.applyUrl || job.url || '#',
    url: job.applyUrl || job.url || '#',
    recruiterEmail: job.recruiterEmail || '',
    recruiterPhone: job.recruiterPhone || '',
    description: job.description || '',
    tags: job.tags || [],
  }
}

export function searchJobs({ store, userId, query = '', location = '', type = 'All', minSalary = 0, experience = '', deadline = 'open' }) {
  refreshJobDeadlines(store)
  const jobs = [...(store.jobs?.length ? store.jobs : seedJobs)]
    .map(normalizeJob)
    .map(applyDeadlineStatus)
  const user = (store.users || []).find(item => item.id === userId)
  const blacklist = new Set((user?.preferences?.blacklist || []).map(item => item.toLowerCase()))
  const q = query.toLowerCase().trim()
  const loc = location.toLowerCase().trim()
  const selectedType = type.toLowerCase()
  const deadlineFilter = String(deadline || 'open').toLowerCase()

  return jobs.filter(job => {
    if (job.provider === 'jobpilot' && job.publicationStatus !== 'published') return false
    const blob = `${job.title} ${job.company} ${job.description} ${job.tags.join(' ')}`.toLowerCase()
    const blacklisted = blacklist.has(job.company.toLowerCase()) || blacklist.has(job.title.toLowerCase())
    const queryOk = !q || blob.includes(q)
    const locationOk = !loc || job.location.toLowerCase().includes(loc) || (loc === 'remote' && job.type === 'Remote')
    const typeOk = selectedType === 'all' || !selectedType || job.type.toLowerCase() === selectedType
    const salaryOk = Number(job.salaryMin || 0) >= Number(minSalary || 0)
    const experienceOk = !experience || blob.includes(experience.toLowerCase()) || job.title.toLowerCase().includes(experience.toLowerCase())
    const deadlineOk =
      deadlineFilter === 'all' ||
      (deadlineFilter === 'open' && !isJobClosed(job)) ||
      (deadlineFilter === 'closing_soon' && job.deadlineStatus === 'closing_soon') ||
      (deadlineFilter === 'unknown' && job.deadlineStatus === 'unknown') ||
      (deadlineFilter === 'expired' && isJobClosed(job))
    return !blacklisted && queryOk && locationOk && typeOk && salaryOk && experienceOk && deadlineOk
  })
}

export function scoreJobsForResume(jobs, resume) {
  if (!resume?.profile) {
    return jobs.map(job => {
      const risk = analyzeJobRisk(job)
      return { ...job, matchScore: null, atsScore: null, risk, recommendation: risk.riskLevel === 'High' ? 'Skip' : 'Review' }
    })
  }
  return jobs
    .map(job => {
      const match = scoreJobMatch(resume.profile, job)
      const report = generateDecisionReport(resume.profile, job)
      return {
        ...job,
        ...match,
        risk: report.risk,
        recommendation: report.recommendation,
      }
    })
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
}
