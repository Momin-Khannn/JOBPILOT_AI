import './env.js'
import express from 'express'
import 'express-async-errors'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import aiRoutes from './routes/ai.js'
import analyticsRoutes from './routes/analytics.js'
import adminRoutes from './routes/admin.js'
import applicationsRoutes from './routes/applications.js'
import authRoutes from './routes/auth.js'
import billingRoutes, { billingWebhook } from './routes/billing.js'
import clientUpdateRoutes from './routes/clientUpdates.js'
import careerRoutes from './routes/career.js'
import followUpsRoutes from './routes/followups.js'
import goalRoutes from './routes/goal.js'
import gmailRoutes from './routes/gmail.js'
import inboxRoutes from './routes/inbox.js'
import jobsRoutes from './routes/jobs.js'
import portalUpdateRoutes from './routes/portalUpdates.js'
import resumeRoutes from './routes/resume.js'
import profileRoutes from './routes/profile.js'
import settingsRoutes from './routes/settings.js'
import supportRoutes from './routes/support.js'
import whatsappRoutes from './routes/whatsapp.js'
import { ensureStore, persistenceMode } from './db/store.js'
import { ownerPortalEnabled } from './services/authService.js'
import { startSoftwareChangeUpdateAgent } from './services/softwareChangeUpdateAgentService.js'
import { startPortalUpdateAgent } from './services/portalUpdateAgentService.js'
import { publicFrontendUrl } from './config/publicUrls.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const PORT = process.env.PORT || 4000
const frontendDist = path.resolve(__dirname, '../../frontend/dist')
const adminDist = path.resolve(__dirname, '../../admin-portal/dist')

app.set('trust proxy', 1)

function allowedOrigins() {
  return [
    publicFrontendUrl(),
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ].filter(Boolean)
}

function isPrivateLanOrigin(origin) {
  try {
    const { hostname, protocol } = new URL(origin)
    if (protocol !== 'http:' && protocol !== 'https:') return false
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
    return false
  } catch {
    return false
  }
}

await ensureStore()
startSoftwareChangeUpdateAgent()
startPortalUpdateAgent()

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins().includes(origin) || isPrivateLanOrigin(origin)) {
      callback(null, true)
      return
    }
    callback(new Error(`CORS blocked for origin: ${origin}`))
  },
  credentials: true,
}))

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
}))

app.post('/api/billing/webhook', express.raw({ type: 'application/json', limit: '1mb' }), billingWebhook)

app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))

app.use('/api/auth/register', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many account creation attempts. Please wait and try again.' },
}))

app.use('/api/auth/google/auth-url', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many Google sign-in attempts. Please wait and try again.' },
}))

app.use(['/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/verify-email', '/api/auth/resend-verification'], rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many account recovery attempts. Please wait and try again.' },
}))

app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
}))

app.use('/api/billing', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many billing attempts. Please wait and try again.' },
}))

app.use('/api/support', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many support submissions. Please wait before sending another message.' },
}))

app.use('/api/analytics', rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
}))

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: process.env.APP_VERSION || '2.0.1',
    mode: process.env.ENABLE_REAL_SEND === 'true' ? 'real-send' : 'setup-required',
    ownerPortal: ownerPortalEnabled ? 'enabled' : 'disabled',
    persistence: persistenceMode(),
    timestamp: new Date().toISOString(),
  })
})

app.get('/robots.txt', (req, res) => {
  const siteUrl = publicFrontendUrl()
  res.type('text/plain').send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /dashboard',
    'Disallow: /goal',
    'Disallow: /jobs',
    'Disallow: /resume',
    'Disallow: /profile',
    'Disallow: /applications',
    'Disallow: /career-lab',
    'Disallow: /followups',
    'Disallow: /inbox',
    'Disallow: /gmail',
    'Disallow: /whatsapp',
    'Disallow: /settings',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n'))
})

app.get('/sitemap.xml', (req, res) => {
  const siteUrl = publicFrontendUrl()
  const lastmod = new Date().toISOString().slice(0, 10)
  const urls = [
    ['/', 'weekly', '1.0'],
    ['/privacy', 'monthly', '0.5'],
    ['/terms', 'monthly', '0.5'],
    ['/support', 'monthly', '0.4'],
  ]
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([pathName, changefreq, priority]) => `  <url>
    <loc>${siteUrl}${pathName}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n')}
</urlset>
`)
})

app.get('/:indexNowKey.txt', (req, res, next) => {
  const key = String(process.env.INDEXNOW_KEY || '').trim()
  if (!key || req.params.indexNowKey !== key) return next()
  res.type('text/plain').send(key)
})

app.use('/api/auth', authRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/billing', billingRoutes)
if (ownerPortalEnabled) app.use('/api/admin', adminRoutes)
if (ownerPortalEnabled) app.use('/api/admin/client-updates', clientUpdateRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/applications', applicationsRoutes)
app.use('/api/career', careerRoutes)
app.use('/api/followups', followUpsRoutes)
app.use('/api/goal', goalRoutes)
app.use('/api/gmail', gmailRoutes)
app.use('/api/inbox', inboxRoutes)
app.use('/api/jobs', jobsRoutes)
app.use('/api/portal-updates', portalUpdateRoutes)
app.use('/api/resume', resumeRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/support', supportRoutes)
app.use('/api/whatsapp', whatsappRoutes)

if (ownerPortalEnabled && fs.existsSync(adminDist)) {
  app.use('/owner', express.static(adminDist))
  app.get(['/owner', '/owner/*'], (req, res) => {
    res.sendFile(path.join(adminDist, 'index.html'))
  })
}

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    if (req.path === '/owner' || req.path.startsWith('/owner/')) return next()
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body contains malformed JSON.' })
  }
  if (err?.type === 'entity.too.large' || err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'The request or uploaded file is too large.' })
  }
  if (err?.name === 'MulterError') {
    return res.status(400).json({ error: 'The uploaded file could not be processed.' })
  }
  if (!err.status || err.status >= 500) console.error('[JobPilot API]', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`JobPilot AI backend running on http://localhost:${PORT}`)
})

export default app
