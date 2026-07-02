import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(error => error ? reject(error) : resolve(port))
    })
  })
}

async function waitForHealth(baseUrl, child) {
  const deadline = Date.now() + 35_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Backend exited with code ${child.exitCode}`)
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return response.json()
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw new Error('Timed out waiting for backend health')
}

async function request(baseUrl, route, { cookie, method = 'GET', body, form } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(!form && body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: form || (body !== undefined ? JSON.stringify(body) : undefined),
  })
  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

test('production client journey works while owner routes remain unavailable', { timeout: 60_000 }, async (t) => {
  const port = await freePort()
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jobpilot-journey-'))
  const baseUrl = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: backendRoot,
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      JOBPILOT_DATA_DIR: dataDir,
      ENCRYPTION_SECRET: crypto.randomBytes(32).toString('hex'),
      ENABLE_OWNER_PORTAL: 'false',
      ENABLE_REAL_SEND: 'false',
      CLIENT_UPDATE_SOFTWARE_AUTO_ENABLED: 'false',
      ENABLE_PASSWORD_RESET_TOKEN_RESPONSE: 'true',
      ENABLE_EMAIL_VERIFICATION_TOKEN_RESPONSE: 'true',
      JOB_PROVIDER_TIMEOUT_MS: '5',
      BILLING_TEST_MODE: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr.on('data', chunk => { stderr += chunk })
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill()
      await once(child, 'exit')
    }
    await fs.rm(dataDir, { recursive: true, force: true })
  })

  const health = await waitForHealth(baseUrl, child)
  assert.deepEqual(health, { status: 'ok' })

  const registration = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: { name: 'Journey User', email: 'journey@example.com', password: 'strongpass123', acceptedTerms: true },
  })
  assert.equal(registration.response.status, 201)
  assert.equal(registration.payload.emailVerification.required, true)
  assert.ok(registration.payload.emailVerification.verificationToken)

  const verification = await request(baseUrl, '/api/auth/verify-email', {
    method: 'POST',
    body: { token: registration.payload.emailVerification.verificationToken },
  })
  assert.equal(verification.response.status, 200)

  const verifiedLogin = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email: 'journey@example.com', password: 'strongpass123', role: 'client' },
  })
  assert.equal(verifiedLogin.response.status, 200)
  assert.equal(verifiedLogin.payload.token, undefined)
  const sessionCookie = verifiedLogin.response.headers.getSetCookie?.()[0] || verifiedLogin.response.headers.get('set-cookie') || ''
  assert.match(sessionCookie, /jobpilot_client_session=/)
  assert.match(sessionCookie, /HttpOnly/i)
  assert.match(sessionCookie, /Secure/i)
  assert.match(sessionCookie, /SameSite=Lax/i)
  const cookie = sessionCookie.split(';')[0]

  const cookieMe = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie },
  })
  assert.equal(cookieMe.status, 200)

  const ownerLogin = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email: 'owner@jobpilot.ai', password: 'owner12345', role: 'owner' },
  })
  assert.equal(ownerLogin.response.status, 404)

  const admin = await request(baseUrl, '/api/admin/overview', { cookie })
  assert.equal(admin.response.status, 404)

  const goal = await request(baseUrl, '/api/goal', {
    cookie,
    method: 'PUT',
    body: { goal: { roles: ['Backend Engineer'], locations: ['Remote'], jobTypes: ['Remote'], experienceLevel: 'Entry', minSalary: 1000 } },
  })
  assert.equal(goal.response.status, 200)
  assert.deepEqual(goal.payload.goal.roles, ['Backend Engineer'])

  const resumeForm = new FormData()
  resumeForm.append('resume', new Blob([`
Journey User
journey@example.com | +1 555 222 3333 | https://linkedin.com/in/journey
SUMMARY
Backend engineer building reliable APIs and data systems.
SKILLS
Node.js, Express, PostgreSQL, Docker, AWS, Git
EXPERIENCE
Backend Engineer - Improved processing speed by 35% for 1200 users.
EDUCATION
BS Computer Science, Example University, 2025
  `], { type: 'text/plain' }), 'resume.txt')
  const resume = await request(baseUrl, '/api/resume/parse', { cookie, method: 'POST', form: resumeForm })
  assert.equal(resume.response.status, 200)
  assert.ok(resume.payload.resume.profile.atsScore >= 60)
  assert.equal(resume.payload.resume.rawText, undefined)

  const me = await request(baseUrl, '/api/auth/me', { cookie })
  assert.equal(me.payload.user.email, 'journey@example.com')

  const settings = await request(baseUrl, '/api/settings', { cookie })
  assert.equal(settings.response.status, 200)
  assert.equal(settings.payload.sessions.some(session => session.current), true)
  assert.equal(settings.payload.authentication.passwordChangeAvailable, true)

  const savedSettings = await request(baseUrl, '/api/settings', {
    cookie,
    method: 'PUT',
    body: {
      user: {
        name: 'Journey User',
        email: 'journey@example.com',
        tier: 'pro',
        preferences: {
          roles: ['Backend Engineer'],
          locations: ['Remote'],
          dailySendLimit: 12,
          quietHoursEnabled: true,
          quietHoursStart: '23:00',
          quietHoursEnd: '07:00',
          timezone: 'UTC',
          ghostingApplicationDays: 6,
          ghostingInterviewDays: 10,
          aiTone: 'concise',
          density: 'compact',
          reducedMotion: true,
        },
      },
    },
  })
  assert.equal(savedSettings.response.status, 200)
  assert.equal(savedSettings.payload.user.tier, 'basic')
  assert.equal(savedSettings.payload.user.preferences.ghostingInterviewDays, 10)
  assert.equal(savedSettings.payload.user.preferences.density, 'compact')

  const wrongPassword = await request(baseUrl, '/api/settings/security/password', {
    cookie,
    method: 'PUT',
    body: { currentPassword: 'incorrect-password', newPassword: 'newstrongpass123' },
  })
  assert.equal(wrongPassword.response.status, 403)

  const changedPassword = await request(baseUrl, '/api/settings/security/password', {
    cookie,
    method: 'PUT',
    body: { currentPassword: 'strongpass123', newPassword: 'newstrongpass123' },
  })
  assert.equal(changedPassword.response.status, 200)

  const signedOutOthers = await request(baseUrl, '/api/settings/security/sign-out-others', { cookie, method: 'POST' })
  assert.equal(signedOutOthers.response.status, 200)
  assert.equal(signedOutOthers.payload.revoked, 0)

  const disconnectedGmail = await request(baseUrl, '/api/gmail/disconnect', { cookie, method: 'POST' })
  assert.equal(disconnectedGmail.response.status, 200)
  const disconnectedWhatsapp = await request(baseUrl, '/api/whatsapp/disconnect', { cookie, method: 'POST' })
  assert.equal(disconnectedWhatsapp.response.status, 200)

  const profileDraft = await request(baseUrl, '/api/profile/me', { cookie })
  const profile = {
    ...profileDraft.payload.profile,
    slug: 'journey-user',
    published: true,
    headline: 'Backend Engineer',
    sectionOrder: ['projects', 'about', 'skills', 'experience', 'education', 'certifications', 'languages'],
    visibility: { ...profileDraft.payload.profile.visibility, email: false, phone: false },
    projects: [{ name: 'JobPilot AI', description: 'A safe job application assistant.', technologies: 'React, Node.js', url: '' }],
  }
  const savedProfile = await request(baseUrl, '/api/profile/me', { cookie, method: 'PUT', body: { profile } })
  assert.equal(savedProfile.response.status, 200)
  assert.equal(savedProfile.payload.profile.sectionOrder[0], 'projects')

  const publicPage = await request(baseUrl, '/api/profile/public/journey-user')
  assert.equal(publicPage.response.status, 200)
  assert.equal(publicPage.payload.profile.contact.email, '')
  assert.equal(publicPage.payload.profile.userId, undefined)

  const manualJob = {
    title: 'Backend Engineer',
    company: 'Example Company',
    location: 'Remote',
    type: 'Remote',
    description: 'Build Node.js APIs with PostgreSQL and Docker for a production software platform.',
    tags: ['Node.js', 'PostgreSQL', 'Docker'],
    recruiterEmail: 'jobs@example.test',
    url: 'https://example.test/jobs/backend',
  }
  const queued = await request(baseUrl, '/api/applications/queue', { cookie, method: 'POST', body: { jobs: [manualJob], channel: 'gmail' } })
  assert.equal(queued.response.status, 201)
  const applicationId = queued.payload.queued[0].id
  assert.ok(queued.payload.queued[0].matchScore > 0)

  const careerOverview = await request(baseUrl, '/api/career/overview', { cookie })
  assert.equal(careerOverview.response.status, 200)
  assert.equal(careerOverview.payload.analytics.totals.tracked, 1)
  assert.ok(Array.isArray(careerOverview.payload.skillGap.learningPath))

  const suggestedSkill = careerOverview.payload.skillGap.gaps[0]?.skill
  assert.ok(suggestedSkill)
  const achievedSkill = await request(baseUrl, `/api/career/skills/${encodeURIComponent(suggestedSkill)}`, {
    cookie,
    method: 'PATCH',
    body: { achieved: true },
  })
  assert.equal(achievedSkill.response.status, 200)
  assert.equal(achievedSkill.payload.skillGap.gaps.find(item => item.skill === suggestedSkill)?.achieved, true)
  assert.ok(achievedSkill.payload.skillGap.gaps.find(item => item.skill === suggestedSkill)?.resources.length > 0)

  const persistedCareer = await request(baseUrl, '/api/career/overview', { cookie })
  assert.equal(persistedCareer.payload.skillGap.gaps.find(item => item.skill === suggestedSkill)?.achieved, true)

  const upgrade = await request(baseUrl, '/api/auth/upgrade', { cookie, method: 'POST' })
  assert.equal(upgrade.response.status, 200)

  const earlyGhosting = await request(baseUrl, `/api/applications/${applicationId}/ghosting/prepare`, {
    cookie,
    method: 'POST',
    body: {},
  })
  assert.equal(earlyGhosting.response.status, 409)
  assert.equal(earlyGhosting.payload.signal.eligible, false)

  const offerStage = await request(baseUrl, `/api/applications/${applicationId}`, {
    cookie,
    method: 'PATCH',
    body: { status: 'offer' },
  })
  assert.equal(offerStage.payload.application.status, 'offer')

  const negotiation = await request(baseUrl, `/api/applications/${applicationId}/negotiation/prepare`, {
    cookie,
    method: 'POST',
    body: {
      currency: 'USD',
      payPeriod: 'annual',
      baseSalary: 100000,
      marketMedian: 115000,
      marketMax: 120000,
      sourceUrl: 'https://example.test/salary-report',
    },
  })
  assert.equal(negotiation.response.status, 201)
  assert.equal(negotiation.payload.negotiation.status, 'draft')
  assert.equal(negotiation.payload.negotiation.recommendation.targetBase, 115000)

  const editedNegotiation = await request(baseUrl, `/api/applications/${applicationId}/negotiation/draft`, {
    cookie,
    method: 'PATCH',
    body: {
      subject: 'Compensation discussion',
      body: 'Thank you for the offer. Based on the role scope and the evidence reviewed, I would like to discuss a base salary of USD 120,000.',
    },
  })
  assert.equal(editedNegotiation.response.status, 200)
  assert.equal(editedNegotiation.payload.negotiation.approvalSnapshot, null)

  const approvedNegotiation = await request(baseUrl, `/api/applications/${applicationId}/negotiation/approve`, {
    cookie,
    method: 'POST',
  })
  assert.equal(approvedNegotiation.response.status, 200)
  assert.equal(approvedNegotiation.payload.negotiation.status, 'approved')
  assert.equal(approvedNegotiation.payload.negotiation.approvalSnapshot.subject, 'Compensation discussion')

  const revisedNegotiation = await request(baseUrl, `/api/applications/${applicationId}/negotiation/draft`, {
    cookie,
    method: 'PATCH',
    body: {
      subject: 'Revised compensation discussion',
      body: 'Thank you again for the offer. I revised the message after approval, so JobPilot must require a fresh approval before any send.',
    },
  })
  assert.equal(revisedNegotiation.payload.negotiation.status, 'draft')
  assert.equal(revisedNegotiation.payload.negotiation.approvalSnapshot, null)

  const blockedCareerMoveSend = await request(baseUrl, '/api/gmail/send-workflow', {
    cookie,
    method: 'POST',
    body: { applicationId, workflow: 'negotiation' },
  })
  assert.equal(blockedCareerMoveSend.response.status, 409)

  const interview = await request(baseUrl, '/api/career/interviews', {
    cookie,
    method: 'POST',
    body: { applicationId },
  })
  assert.equal(interview.response.status, 201)
  assert.equal(interview.payload.session.questions.length, 5)

  const interviewAnswer = await request(baseUrl, `/api/career/interviews/${interview.payload.session.id}/answer`, {
    cookie,
    method: 'POST',
    body: { answer: 'I built a Node.js API for 1200 users, reduced response time by 35 percent, and explained the result to the team.' },
  })
  assert.equal(interviewAnswer.response.status, 200)
  assert.ok(interviewAnswer.payload.feedback.overall > 0)
  assert.match(interviewAnswer.payload.feedback.source, /^(gemini-text|structured-fallback)$/)
  assert.equal(interviewAnswer.payload.session.currentIndex, 1)

  const approved = await request(baseUrl, `/api/applications/${applicationId}/approve`, { cookie, method: 'POST' })
  assert.equal(approved.payload.application.status, 'approved')

  const edited = await request(baseUrl, `/api/applications/${applicationId}`, {
    cookie,
    method: 'PATCH',
    body: { draft: { subject: 'Changed', body: 'Changed after approval' } },
  })
  assert.equal(edited.payload.application.status, 'pending_review')

  const blockedSend = await request(baseUrl, '/api/gmail/send', { cookie, method: 'POST', body: { applicationId } })
  assert.equal(blockedSend.response.status, 403)

  const resetRegistration = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: { name: 'Reset User', email: 'reset@example.com', password: 'oldpass123', acceptedTerms: true },
  })
  assert.equal(resetRegistration.response.status, 201)

  const forgot = await request(baseUrl, '/api/auth/forgot-password', {
    method: 'POST',
    body: { email: 'reset@example.com' },
  })
  assert.equal(forgot.response.status, 200)
  assert.ok(forgot.payload.resetUrl.includes('/reset-password?token='))
  assert.ok(forgot.payload.resetToken)

  const reset = await request(baseUrl, '/api/auth/reset-password', {
    method: 'POST',
    body: { token: forgot.payload.resetToken, password: 'newpass123' },
  })
  assert.equal(reset.response.status, 200)

  const oldLogin = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email: 'reset@example.com', password: 'oldpass123', role: 'client' },
  })
  assert.equal(oldLogin.response.status, 401)

  const newLogin = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email: 'reset@example.com', password: 'newpass123', role: 'client' },
  })
  assert.equal(newLogin.response.status, 200)

  const reusedReset = await request(baseUrl, '/api/auth/reset-password', {
    method: 'POST',
    body: { token: forgot.payload.resetToken, password: 'anotherpass123' },
  })
  assert.equal(reusedReset.response.status, 400)
  assert.equal(stderr, '')
})
