import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { execFile } from 'child_process'
import { fileURLToPath } from 'url'
import { readStore } from '../db/store.js'
import { businessMailReady } from './emailService.js'
import { sendClientUpdate } from './clientUpdateAgentService.js'
import { currentClientRelease } from '../releases/currentClientRelease.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '../../..')

const state = {
  started: false,
  timer: null,
  pending: null,
  running: false,
  lastScanAt: null,
  lastResult: null,
  lastError: null,
}

function envFlag(name, fallback = false) {
  const value = process.env[name]
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

function envNumber(name, fallback, min = 0) {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? Math.max(min, value) : fallback
}

function frontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function appName() {
  return process.env.APP_NAME || 'JobPilot AI'
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24)
}

export function clientFileFingerprint(fileHashes = {}) {
  const clientFileHashes = Object.fromEntries(Object.entries(fileHashes).sort(([left], [right]) => left.localeCompare(right)))
  return hash({ clientFileHashes })
}

function command(name, args, { timeout = 8000 } = {}) {
  return new Promise((resolve) => {
    execFile(name, args, {
      cwd: repoRoot,
      windowsHide: true,
      timeout,
      maxBuffer: 2 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: String(stdout || '').trim(),
        stderr: String(stderr || '').trim(),
        error: error?.message || '',
      })
    })
  })
}

function normalizePath(file = '') {
  return String(file).replace(/\\/g, '/').replace(/^"|"$/g, '').trim()
}

function statusFile(line = '') {
  const value = line.slice(3).trim()
  if (value.includes(' -> ')) return normalizePath(value.split(' -> ').pop())
  return normalizePath(value)
}

export function isClientVisibleSoftwareFile(file = '') {
  const normalized = normalizePath(file)
  if (!normalized) return false
  if (/^frontend\/src\//.test(normalized)) return true
  if (/^frontend\/public\/(manifest\.webmanifest|sw\.js|icon\.)/.test(normalized)) return true
  if (/^admin-portal\/src\//.test(normalized)) return true
  if (/^admin-portal\/public\/(manifest\.webmanifest|owner-icon\.|jobpilot-owner\.ico)/.test(normalized)) return true
  if (/^employer-portal\/src\//.test(normalized)) return true
  if (/^backend\/src\/routes\/(applications|ai|auth|billing|career|employer|followups|gmail|goal|inbox|jobs|marketplace|profile|resume|settings|whatsapp)\.js$/.test(normalized)) return true
  if (/^backend\/src\/services\/(aiService|authService|billingService|careerService|geminiService|gmailService|googleAuthService|jobProviderService|jobService|marketplaceService|marketplaceSocketService|profileService|resumeIdentityService|resumeService|sendPolicy|whatsappService)\.js$/.test(normalized)) return true
  if (/^backend\/src\/db\/(store|postgresRowStore|rowStoreSchema|storeIntegrity)\.js$/.test(normalized)) return true
  if (/^backend\/src\/middleware\/(auth|validate)\.js$/.test(normalized)) return true
  if (/^backend\/src\/services\/fileValidationService\.js$/.test(normalized)) return true
  if (/^backend\/src\/validation\/schemas\.js$/.test(normalized)) return true
  return false
}

async function fileSignature(file) {
  try {
    const absolutePath = path.join(repoRoot, file)
    const [stat, content] = await Promise.all([fs.stat(absolutePath), fs.readFile(absolutePath)])
    return {
      file,
      size: stat.size,
      modifiedAt: Math.round(stat.mtimeMs),
      contentHash: crypto.createHash('sha256').update(content).digest('hex').slice(0, 20),
    }
  } catch {
    return { file, missing: true }
  }
}

function uniqueStatusFiles(lines = []) {
  return [...new Set(lines.map(statusFile).filter(isClientVisibleSoftwareFile))].sort()
}

function fileList(output = '') {
  return [...new Set(String(output).split(/\r?\n/).map(normalizePath).filter(isClientVisibleSoftwareFile))].sort()
}

const featureRules = [
  {
    key: 'security_hardening',
    pattern: /db\/(store|postgresRowStore|rowStoreSchema|storeIntegrity)|middleware\/(auth|validate)|fileValidationService|validation\/schemas/i,
    name: 'security and data protection',
    detail: 'Account requests, session credentials, file uploads, and production data storage now use stronger validation and protection controls.',
  },
  {
    key: 'pro_billing',
    pattern: /routes\/billing|billingService|pages\/Settings/i,
    name: 'JobPilot Pro subscriptions',
    detail: 'JobPilot Pro now uses secure Stripe checkout, verified subscription events, and self-service subscription management.',
  },
  {
    key: 'gemini_coaching',
    pattern: /geminiService|routes\/ai/i,
    name: 'Gemini career coaching',
    detail: 'Pro clients can generate evidence-grounded cover letters and receive recorded-answer interview coaching without JobPilot storing the audio file.',
  },
  {
    key: 'identity_privacy',
    pattern: /resumeIdentityService|routes\/resume|LegalPage|routes\/settings/i,
    name: 'CV identity and privacy controls',
    detail: 'CV ownership verification, account export, deletion controls, and clearer privacy information now protect each workspace.',
  },
  {
    key: 'career_lab',
    pattern: /CareerLab|careerService|routes\/career/i,
    name: 'Career Lab',
    detail: 'Career Lab now brings application analytics, skill-gap learning paths, and role-specific interview practice into one workspace.',
  },
  {
    key: 'application_pipeline',
    pattern: /pages\/Applications|components\/ApplicationInsight|routes\/applications|FollowUps|followups/i,
    name: 'application pipeline',
    detail: 'Application tracking and follow-up guidance have been improved so progress and next actions are easier to understand.',
  },
  {
    key: 'job_discovery',
    pattern: /pages\/JobFeed|components\/JobCard|routes\/jobs|jobProviderService|jobService/i,
    name: 'job discovery',
    detail: 'Job discovery and role details have been improved to make relevant opportunities easier to evaluate.',
  },
  {
    key: 'resume_tools',
    pattern: /ResumeManager|routes\/resume|resumeService|aiService/i,
    name: 'resume tools',
    detail: 'Resume analysis and role-specific guidance have been improved to make each application stronger.',
  },
  {
    key: 'cv_profile',
    pattern: /ProfileBuilder|PublicCvPage|CvProfileView|routes\/profile|profileService/i,
    name: 'public CV',
    detail: 'The public CV and profile-building experience have been improved for clearer, more polished presentation.',
  },
  {
    key: 'inbox_delivery',
    pattern: /GmailSetup|WhatsAppSetup|InboxMonitor|routes\/(gmail|whatsapp|inbox)|gmailService|whatsappService|sendPolicy/i,
    name: 'inbox and delivery tools',
    detail: 'Inbox monitoring and approved Gmail or WhatsApp delivery flows have been improved.',
  },
  {
    key: 'account_access',
    pattern: /LoginPage|SignupPage|ForgotPassword|ResetPassword|GoogleAuth|routes\/auth|authService|googleAuthService/i,
    name: 'account access',
    detail: 'Sign-in and account access have been improved for a smoother, safer workspace experience.',
  },
  {
    key: 'goals_settings',
    pattern: /GoalPage|Settings|routes\/(goal|settings)/i,
    name: 'career goals and settings',
    detail: 'Career-goal and account settings are now easier to manage.',
  },
  {
    key: 'dashboard',
    pattern: /pages\/Dashboard|components\/MetricCard/i,
    name: 'dashboard',
    detail: 'The dashboard has been refined to surface the most useful job-search progress and next actions.',
  },
  {
    key: 'owner_portal',
    pattern: /admin-portal|routes\/admin|clientUpdates|portalUpdateAgent/i,
    name: 'owner portal',
    detail: 'Owner portal monitoring and client-update controls have been improved for launch operations.',
  },
]

function featureForFile(file) {
  return featureRules.find(rule => rule.pattern.test(file)) || null
}

function inferredFeatureKeys(message = {}) {
  const text = `${message.subject || ''} ${message.body || ''}`.toLowerCase()
  const keys = []
  if (/career lab|skill gap|interview practice|funnel analytics/.test(text)) keys.push('career_lab')
  if (/application tracking|application pipeline|follow-up/.test(text)) keys.push('application_pipeline')
  if (/job discovery|job feed/.test(text)) keys.push('job_discovery')
  if (/resume analysis|resume tool|ats/.test(text)) keys.push('resume_tools')
  if (/public cv|cv profile|profile build/.test(text)) keys.push('cv_profile')
  if (/gmail|whatsapp|inbox/.test(text)) keys.push('inbox_delivery')
  return keys
}

export function buildClientReleaseNotes(files = [], previouslyAnnounced = new Set()) {
  const matched = new Map()
  let hasUnclassifiedUi = false

  for (const file of files) {
    const feature = featureForFile(file)
    if (feature) matched.set(feature.key, feature)
    else if (/^frontend\/src\/.+\.(jsx|css)$/.test(file)) hasUnclassifiedUi = true
  }

  const notes = [...matched.values()].map(feature => ({
    key: feature.key,
    name: feature.name,
    detail: `${previouslyAnnounced.has(feature.key) ? 'Improved' : 'New'}: ${feature.detail}`,
  }))

  if (hasUnclassifiedUi && !notes.length) {
    notes.push({
      key: 'interface_polish',
      name: 'interface',
      detail: 'Improved: The client interface and responsive layout have been polished for a clearer experience.',
    })
  }

  return notes
}

function launchProgress() {
  const percent = Math.min(100, Math.max(0, envNumber('CLIENT_UPDATE_LAUNCH_PROGRESS_PERCENT', 80)))
  const note = String(process.env.CLIENT_UPDATE_LAUNCH_STATUS || 'Core client features, Gmail delivery, Google sign-in, CV webpages, and owner update tools are being finalized for launch.').trim()
  return { percent, note }
}

export function softwareChangeAgentConfigured() {
  return {
    enabled: envFlag('CLIENT_UPDATE_SOFTWARE_AUTO_ENABLED', false),
    scanIntervalMs: envNumber('CLIENT_UPDATE_SOFTWARE_SCAN_INTERVAL_MS', 60_000, 10_000),
    quietMs: envNumber('CLIENT_UPDATE_SOFTWARE_QUIET_MS', 120_000, 0),
    minDigestIntervalMs: envNumber('CLIENT_UPDATE_SOFTWARE_MIN_DIGEST_INTERVAL_MS', 1_800_000, 0),
    launchProgress: launchProgress(),
  }
}

export async function getSoftwareSnapshot() {
  const [headResult, branchResult, subjectResult, statusResult, trackedResult, commitFilesResult] = await Promise.all([
    command('git', ['rev-parse', '--short', 'HEAD']),
    command('git', ['rev-parse', '--abbrev-ref', 'HEAD']),
    command('git', ['log', '-1', '--pretty=%s']),
    command('git', ['status', '--porcelain=v1', '--untracked-files=all']),
    command('git', ['ls-files', '--cached', '--others', '--exclude-standard']),
    command('git', ['diff', '--name-only', 'HEAD^', 'HEAD']),
  ])

  const releaseVersion = process.env.APP_VERSION || process.env.RELEASE_VERSION || (headResult.ok ? headResult.stdout : appName())
  const statusLines = statusResult.ok ? statusResult.stdout.split(/\r?\n/).filter(Boolean) : []
  const dirtyClientFiles = uniqueStatusFiles(statusLines)
  const lastCommitClientFiles = commitFilesResult.ok ? fileList(commitFilesResult.stdout) : []
  const candidateFiles = dirtyClientFiles.length ? dirtyClientFiles : lastCommitClientFiles
  const allClientFiles = trackedResult.ok ? fileList(trackedResult.stdout) : candidateFiles
  const fileSignatures = await Promise.all(allClientFiles.map(fileSignature))
  const clientFileHashes = Object.fromEntries(
    fileSignatures.filter(item => item.contentHash).map(item => [item.file, item.contentHash])
  )
  const fingerprint = clientFileFingerprint({
    ...clientFileHashes,
    [`release:${currentClientRelease.id}`]: hash(currentClientRelease),
  })

  return {
    fingerprint,
    releaseVersion,
    gitAvailable: headResult.ok,
    head: headResult.stdout || '',
    branch: branchResult.stdout || '',
    commitSubject: subjectResult.stdout || '',
    candidateFiles,
    clientFileHashes,
    fileSignatures,
    clientFileCount: Object.keys(clientFileHashes).length,
    clientRelease: currentClientRelease,
    scannedAt: new Date().toISOString(),
  }
}

async function fingerprintAlreadySent(fingerprint) {
  const store = await readStore()
  return (store.messages || []).some(message =>
    message.channel === 'client_update' &&
    message.status === 'sent' &&
    message.metadata?.source === 'software_change_agent' &&
    message.metadata?.softwareFingerprint === fingerprint
  )
}

function latestClientUpdate(store) {
  return (store.messages || [])
    .filter(message => message.channel === 'client_update' && message.status === 'sent')
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null
}

function latestSoftwareUpdate(store) {
  return (store.messages || [])
    .filter(message => message.channel === 'client_update' && message.metadata?.source === 'software_change_agent')
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null
}

function changedFilesSinceBaseline(snapshot, store) {
  const previousSoftware = latestSoftwareUpdate(store)
  const previousHashes = previousSoftware?.metadata?.clientFileHashes
  if (previousHashes && typeof previousHashes === 'object') {
    const files = new Set([...Object.keys(previousHashes), ...Object.keys(snapshot.clientFileHashes || {})])
    return [...files].filter(file => previousHashes[file] !== snapshot.clientFileHashes?.[file] && isClientVisibleSoftwareFile(file)).sort()
  }

  const previousUpdate = latestClientUpdate(store)
  if (!previousUpdate?.createdAt) return snapshot.candidateFiles || []
  const cutoff = new Date(previousUpdate.createdAt).getTime()
  const signatures = new Map((snapshot.fileSignatures || []).map(item => [item.file, item]))
  return (snapshot.candidateFiles || []).filter(file => Number(signatures.get(file)?.modifiedAt || 0) > cutoff)
}

function previouslyAnnouncedFeatures(store) {
  const keys = new Set()
  for (const message of (store.messages || []).filter(item => item.channel === 'client_update')) {
    for (const key of message.metadata?.announcedFeatures || []) keys.add(key)
    for (const key of inferredFeatureKeys(message)) keys.add(key)
  }
  return keys
}

function updatePayload(snapshot, notes) {
  if (snapshot.clientRelease) {
    return {
      title: snapshot.clientRelease.title,
      summary: snapshot.clientRelease.summary,
      changes: snapshot.clientRelease.changes,
      actionUrl: frontendUrl(),
    }
  }
  const names = notes.map(note => note.name)
  const title = snapshot.releaseVersion === '2.0.1'
    ? 'JobPilot AI v2.0.1 is now available'
    : names.length === 1
      ? `${notes[0].detail.startsWith('New:') ? 'New' : 'Improved'} ${names[0]} now available`
      : `${names.length} JobPilot improvements now available`
  return {
    title,
    summary: `${appName()} has a new client-facing update. Here is what changed and how it helps your job search.`,
    changes: notes.map(note => note.detail),
    actionUrl: frontendUrl(),
  }
}

export async function runSoftwareChangeUpdateScan({ force = false } = {}) {
  if (state.running) {
    return { status: 'busy', message: 'Software change scan is already running.' }
  }

  state.running = true
  state.lastScanAt = new Date().toISOString()
  try {
    if (!(await businessMailReady())) {
      state.lastResult = { status: 'blocked', reason: 'business_mail_not_configured' }
      return state.lastResult
    }

    const snapshot = await getSoftwareSnapshot()
    const alreadySent = await fingerprintAlreadySent(snapshot.fingerprint)
    if (alreadySent && !force) {
      state.pending = null
      state.lastResult = { status: 'skipped', reason: 'already_sent', snapshot }
      return state.lastResult
    }

    const store = await readStore()
    const changedFiles = force ? snapshot.candidateFiles : changedFilesSinceBaseline(snapshot, store)
    const manifestNotes = (snapshot.clientRelease?.changes || []).map((detail, index) => ({
      key: `${snapshot.clientRelease.id}:${index + 1}`,
      name: snapshot.clientRelease.name,
      detail,
    }))
    const notes = [
      ...manifestNotes,
      ...buildClientReleaseNotes(changedFiles, previouslyAnnouncedFeatures(store)),
    ]
    if (!notes.length) {
      state.pending = null
      state.lastResult = {
        status: 'skipped',
        reason: 'no_client_facing_changes',
        snapshot: { ...snapshot, changedFiles, changedFileCount: changedFiles.length },
      }
      return state.lastResult
    }

    const now = Date.now()
    const config = softwareChangeAgentConfigured()
    const quietMs = config.quietMs
    const releaseSnapshot = { ...snapshot, changedFiles, changedFileCount: changedFiles.length, notes }
    if (!force) {
      if (!state.pending || state.pending.fingerprint !== snapshot.fingerprint) {
        state.pending = {
          fingerprint: snapshot.fingerprint,
          firstSeenAt: now,
          snapshot: releaseSnapshot,
        }
        state.lastResult = { status: 'pending', reason: 'waiting_for_quiet_period', quietMs, snapshot: releaseSnapshot }
        return state.lastResult
      }

      if (now - state.pending.firstSeenAt < quietMs) {
        state.pending.snapshot = releaseSnapshot
        state.lastResult = { status: 'pending', reason: 'waiting_for_quiet_period', quietMs, snapshot: releaseSnapshot }
        return state.lastResult
      }

      const lastUpdate = latestClientUpdate(store)
      const lastUpdateAt = new Date(lastUpdate?.createdAt || 0).getTime()
      const nextAllowedAt = lastUpdateAt + config.minDigestIntervalMs
      if (lastUpdateAt && now < nextAllowedAt) {
        state.pending.snapshot = releaseSnapshot
        state.lastResult = {
          status: 'pending',
          reason: 'waiting_for_digest_window',
          nextAllowedAt: new Date(nextAllowedAt).toISOString(),
          snapshot: releaseSnapshot,
        }
        return state.lastResult
      }
    }

    const payload = updatePayload(snapshot, notes)
    const result = await sendClientUpdate({
      ...payload,
      force,
      activeSessionOnly: false,
      metadata: {
        source: 'software_change_agent',
        softwareFingerprint: snapshot.fingerprint,
        releaseVersion: snapshot.releaseVersion,
        releaseId: snapshot.clientRelease?.id || null,
        head: snapshot.head,
        branch: snapshot.branch,
        changedFileCount: changedFiles.length,
        changedFiles,
        announcedFeatures: notes.map(note => note.key),
        clientFileHashes: snapshot.clientFileHashes,
        scannedAt: snapshot.scannedAt,
      },
    })

    state.pending = null
    state.lastResult = { status: 'sent', result, snapshot: releaseSnapshot }
    return state.lastResult
  } catch (err) {
    state.lastError = err.message
    state.lastResult = { status: 'error', error: err.message }
    return state.lastResult
  } finally {
    state.running = false
  }
}

export async function softwareChangeAgentStatus() {
  const config = softwareChangeAgentConfigured()
  const store = await readStore()
  const softwareMessages = (store.messages || [])
    .filter(message => message.channel === 'client_update' && message.metadata?.source === 'software_change_agent')

  return {
    ...config,
    started: state.started,
    running: state.running,
    lastScanAt: state.lastScanAt,
    lastResult: state.lastResult,
    lastError: state.lastError,
    pending: state.pending
      ? {
          fingerprint: state.pending.fingerprint,
          firstSeenAt: new Date(state.pending.firstSeenAt).toISOString(),
          changedFileCount: state.pending.snapshot?.changedFileCount || 0,
          features: (state.pending.snapshot?.notes || []).map(note => note.name),
        }
      : null,
    totalSoftwareUpdatesSent: softwareMessages.length,
    lastSoftwareUpdateAt: softwareMessages[0]?.createdAt || null,
  }
}

export function startSoftwareChangeUpdateAgent() {
  const config = softwareChangeAgentConfigured()
  if (state.started || !config.enabled || process.env.NODE_ENV === 'test') return config

  state.started = true
  const intervalMs = config.scanIntervalMs
  const scan = () => {
    runSoftwareChangeUpdateScan().catch((err) => {
      state.lastError = err.message
    })
  }

  setTimeout(scan, Math.min(15_000, intervalMs))
  state.timer = setInterval(scan, intervalMs)
  state.timer.unref?.()
  return { ...config, started: true }
}
