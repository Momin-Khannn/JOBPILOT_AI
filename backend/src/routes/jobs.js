import express from 'express'
import { readStore, updateStore } from '../db/store.js'
import { normalizeJob, scoreJobsForResume, searchJobs } from '../services/jobService.js'

const router = express.Router()

router.get('/search', async (req, res) => {
  const store = await readStore()
  const latestResume = store.resumes?.[0] || null
  const jobs = searchJobs({
    store,
    query: req.query.query || '',
    location: req.query.location || '',
    type: req.query.type || 'All',
    minSalary: req.query.minSalary || 0,
    experience: req.query.experience || '',
  })
  const scored = scoreJobsForResume(jobs, latestResume)
  res.json({ jobs: scored, resumeId: latestResume?.id || null })
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
