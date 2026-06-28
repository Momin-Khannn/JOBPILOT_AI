import express from 'express'
import { requireAuth, requireOwner } from '../middleware/auth.js'
import { readStore, updateStore } from '../db/store.js'
import { normalizeJob, scoreJobsForResume, searchJobs } from '../services/jobService.js'
import { refreshJobDeadlines, syncJobsIntoStore } from '../services/jobProviderService.js'

const router = express.Router()
router.use(requireAuth)

router.get('/search', async (req, res) => {
  const syncResult = await updateStore((store) => syncJobsIntoStore(store, req.query, { force: req.query.refresh === 'true' }))
  const store = await readStore()
  const latestResume = (store.resumes || [])
    .filter(item => item.userId === req.auth.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
  const jobs = searchJobs({
    store,
    userId: req.auth.userId,
    query: req.query.query || '',
    location: req.query.location || '',
    type: req.query.type || 'All',
    minSalary: req.query.minSalary || 0,
    experience: req.query.experience || '',
    deadline: req.query.deadline || 'open',
  })
  const scored = scoreJobsForResume(jobs, latestResume)
  res.json({
    jobs: scored,
    resumeId: latestResume?.id || null,
    sync: syncResult,
    providerStatus: store.providerStatus || {},
  })
})

router.post('/sync', requireOwner, async (req, res) => {
  const sync = await updateStore((store) => syncJobsIntoStore(store, req.body || {}, { force: true }))
  const store = await readStore()
  res.json({
    sync,
    providerStatus: store.providerStatus || {},
    jobs: {
      total: store.jobs.length,
      open: store.jobs.filter(job => !job.isExpired && !job.closedAt).length,
      expired: store.jobs.filter(job => job.isExpired || job.closedAt).length,
    },
  })
})

router.post('/:id/refresh', async (req, res) => {
  const current = (await readStore()).jobs.find(job => job.id === req.params.id)
  const sync = await updateStore((store) => {
    const job = store.jobs.find(item => item.id === req.params.id) || current
    return syncJobsIntoStore(store, {
      query: job?.title || req.query.query || '',
      location: job?.location || req.query.location || '',
    }, { force: true })
  })
  const store = await readStore()
  refreshJobDeadlines(store)
  const job = store.jobs.find(item => item.id === req.params.id)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json({ job, sync })
})

router.post('/manual', async (req, res) => {
  const job = normalizeJob(req.body)
  await updateStore((store) => {
    const exists = store.jobs.some(existing =>
      existing.title.toLowerCase() === job.title.toLowerCase() &&
      existing.company.toLowerCase() === job.company.toLowerCase()
    )
    if (!exists) store.jobs.unshift(job)
  })
  res.status(201).json({ job })
})

export default router
