import './env.js'
import express from 'express'
import 'express-async-errors'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import fs from 'fs'
import path from 'path'
import http from 'http'
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
import employerRoutes from './routes/employer.js'
import marketplaceRoutes from './routes/marketplace.js'
import portalUpdateRoutes from './routes/portalUpdates.js'
import resumeRoutes from './routes/resume.js'
import profileRoutes from './routes/profile.js'
import settingsRoutes from './routes/settings.js'
import supportRoutes from './routes/support.js'
import whatsappRoutes from './routes/whatsapp.js'
import { ensureStore } from './db/store.js'
import { ownerPortalEnabled } from './services/authService.js'
import { startSoftwareChangeUpdateAgent } from './services/softwareChangeUpdateAgentService.js'
import { startPortalUpdateAgent } from './services/portalUpdateAgentService.js'
import { publicFrontendUrl } from './config/publicUrls.js'
import { isKnownClientRoute } from './config/frontendRoutes.js'
import { attachMarketplaceSockets } from './services/marketplaceSocketService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 4000
const frontendDist = path.resolve(__dirname, '../../frontend/dist')
const adminDist = path.resolve(__dirname, '../../admin-portal/dist')
const employerDist = path.resolve(__dirname, '../../employer-portal/dist')

app.set('trust proxy', 1)
app.disable('x-powered-by')

function allowedOrigins() {
  const configured = [
    publicFrontendUrl(),
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
    process.env.EMPLOYER_URL,
  ].filter(Boolean)
  const development = process.env.NODE_ENV === 'production'
    ? []
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3002',
      ]

  return [...configured, ...development].flatMap((value) => {
    try {
      return [new URL(value).origin]
    } catch {
      return []
    }
  })
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

function originAllowed(origin) {
  return allowedOrigins().includes(origin) || (process.env.NODE_ENV !== 'production' && isPrivateLanOrigin(origin))
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  frameguard: { action: 'deny' },
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}))

app.use((req, res, next) => {
  res.set('Permissions-Policy', 'camera=(), geolocation=(), usb=()')
  next()
})

app.use(cors({
  origin(origin, callback) {
    if (!origin || originAllowed(origin)) {
      callback(null, true)
      return
    }
    const error = new Error('Request origin is not allowed')
    error.status = 403
    callback(error)
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

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

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

app.use('/api/employer', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many employer workspace requests. Please wait and try again.' },
}))

app.use('/api/marketplace', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many marketplace requests. Please wait and try again.' },
}))

app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store').json({ status: 'ok' })
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
    'Disallow: /messages',
    'Disallow: /career-lab',
    'Disallow: /followups',
    'Disallow: /inbox',
    'Disallow: /gmail',
    'Disallow: /whatsapp',
    'Disallow: /settings',
    'Disallow: /owner',
    'Disallow: /employer',
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
app.use('/api/employer', employerRoutes)
app.use('/api/marketplace', marketplaceRoutes)
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

if (fs.existsSync(employerDist)) {
  app.use('/employer', express.static(employerDist))
  app.get(['/employer', '/employer/*'], (req, res) => {
    res.sendFile(path.join(employerDist, 'index.html'))
  })
}

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    if (req.path === '/owner' || req.path.startsWith('/owner/')) return next()
    if (req.path === '/employer' || req.path.startsWith('/employer/')) return next()
    if (!req.accepts('html')) return next()
    res.status(isKnownClientRoute(req.path) ? 200 : 404).sendFile(path.join(frontendDist, 'index.html'))
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
  const status = err.status || 500
  res.status(status).json({
    error: status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
})

const io = attachMarketplaceSockets(server, allowedOrigins())
app.set('io', io)

server.listen(PORT, '0.0.0.0', () => {
  console.log(`JobPilot AI backend running on http://localhost:${PORT}`)
})

export default app
