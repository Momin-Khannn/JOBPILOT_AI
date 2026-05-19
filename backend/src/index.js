import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import aiRoutes from './routes/ai.js'
import applicationsRoutes from './routes/applications.js'
import followUpsRoutes from './routes/followups.js'
import gmailRoutes from './routes/gmail.js'
import inboxRoutes from './routes/inbox.js'
import jobsRoutes from './routes/jobs.js'
import resumeRoutes from './routes/resume.js'
import settingsRoutes from './routes/settings.js'
import whatsappRoutes from './routes/whatsapp.js'
import { ensureStore } from './db/store.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const PORT = process.env.PORT || 5000
const frontendDist = path.resolve(__dirname, '../../frontend/dist')

await ensureStore()

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}))

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
}))

app.use(express.json({ limit: '15mb' }))
app.use(express.urlencoded({ extended: true, limit: '15mb' }))

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    mode: process.env.ENABLE_REAL_SEND === 'true' ? 'real-send' : 'demo-send',
    timestamp: new Date().toISOString(),
  })
})

app.use('/api/ai', aiRoutes)
app.use('/api/applications', applicationsRoutes)
app.use('/api/followups', followUpsRoutes)
app.use('/api/gmail', gmailRoutes)
app.use('/api/inbox', inboxRoutes)
app.use('/api/jobs', jobsRoutes)
app.use('/api/resume', resumeRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/whatsapp', whatsappRoutes)

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

app.use((err, req, res, next) => {
  console.error('[JobPilot API]', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
})

app.listen(PORT, () => {
  console.log(`JobPilot AI backend running on http://localhost:${PORT}`)
})

export default app
