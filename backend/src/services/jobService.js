import { seedJobs } from '../db/seed.js'
import { analyzeJobRisk, generateDecisionReport, scoreJobMatch } from './aiService.js'

export function normalizeJob(job) {
  return {
    id: job.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: job.title || '',
    company: job.company || '',
    location: job.location || 'Remote',
    type: job.type || 'Remote',
    salary: job.salary || '',
    salaryMin: Number(job.salaryMin || 0),
    source: job.source || 'Manual',
    posted: job.posted || 'Recently',
    url: job.url || '#',
    recruiterEmail: job.recruiterEmail || '',
    recruiterPhone: job.recruiterPhone || '',
    description: job.description || '',
    tags: job.tags || [],
  }
}

export function searchJobs({ store, query = '', location = '', type = 'All', minSalary = 0, experience = '' }) {
  const jobs = [...(store.jobs?.length ? store.jobs : seedJobs)].map(normalizeJob)
  const blacklist = new Set((store.users?.[0]?.preferences?.blacklist || []).map(item => item.toLowerCase()))
  const q = query.toLowerCase().trim()
  const loc = location.toLowerCase().trim()
  const selectedType = type.toLowerCase()

  return jobs.filter(job => {
    const blob = `${job.title} ${job.company} ${job.description} ${job.tags.join(' ')}`.toLowerCase()
    const blacklisted = blacklist.has(job.company.toLowerCase()) || blacklist.has(job.title.toLowerCase())
    const queryOk = !q || blob.includes(q)
    const locationOk = !loc || job.location.toLowerCase().includes(loc) || (loc === 'remote' && job.type === 'Remote')
    const typeOk = selectedType === 'all' || !selectedType || job.type.toLowerCase() === selectedType
    const salaryOk = Number(job.salaryMin || 0) >= Number(minSalary || 0)
    const experienceOk = !experience || blob.includes(experience.toLowerCase()) || job.title.toLowerCase().includes(experience.toLowerCase())
    return !blacklisted && queryOk && locationOk && typeOk && salaryOk && experienceOk
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
