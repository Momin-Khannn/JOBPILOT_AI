import test from 'node:test'
import assert from 'node:assert/strict'
import { billingSnapshot } from '../src/services/billingService.js'
import { behaviorAwareUpdate, clientActivityProfile } from '../src/services/clientUpdateAgentService.js'
import { analyzeInterviewAnswer, generateGroundedCoverLetter } from '../src/services/geminiService.js'
import { createResumeVerification, evaluateResumeIdentity, verifyResumeCode } from '../src/services/resumeIdentityService.js'

test('resume identity allows matching accounts and blocks unrelated CV identities', () => {
  const verified = evaluateResumeIdentity(
    { name: 'Alex Rivera', email: 'alex@example.com', phone: '+1 555 111 2222' },
    { name: 'Alex Rivera', email: 'alex@example.com', phone: '' }
  )
  assert.equal(verified.verified, true)
  assert.equal(verified.method, 'account-email')

  const mismatch = evaluateResumeIdentity(
    { name: 'Taylor Smith', email: 'taylor@example.com', phone: '+1 555 999 0000' },
    { name: 'Alex Rivera', email: 'alex@example.com', phone: '+1 555 111 2222' }
  )
  assert.equal(mismatch.verified, false)
  assert.equal(mismatch.status, 'verification_required')
})

test('resume ownership verification codes are bound to one resume', () => {
  const generated = createResumeVerification('resume-1')
  const resume = { id: 'resume-1', ownership: { challenge: generated.challenge } }
  assert.equal(verifyResumeCode(resume, generated.code), true)
  assert.equal(verifyResumeCode({ ...resume, id: 'resume-2' }, generated.code), false)
})

test('Stripe subscription snapshot produces a minimal access state', () => {
  const snapshot = billingSnapshot({
    id: 'sub_test',
    customer: 'cus_test',
    status: 'active',
    cancel_at_period_end: false,
    items: { data: [{ price: { id: 'price_test' }, current_period_end: 1_800_000_000 }] },
  })
  assert.equal(snapshot.status, 'active')
  assert.equal(snapshot.subscriptionId, 'sub_test')
  assert.equal(snapshot.priceId, 'price_test')
  assert.ok(snapshot.currentPeriodEnd)
})

test('client update agent chooses a useful next action without exposing private content', () => {
  const user = {
    id: 'client-1',
    name: 'Alex Rivera',
    email: 'alex@example.com',
    role: 'client',
    tier: 'basic',
    preferences: { roles: ['Backend Engineer'] },
    integrations: {},
  }
  const store = { users: [user], resumes: [], profiles: [], applications: [], interviewSessions: [] }
  const activity = clientActivityProfile(store, user)
  assert.equal(activity.nextAction.id, 'resume')
  const update = behaviorAwareUpdate({
    user,
    activity,
    title: 'v2.0.1',
    summary: 'Release available',
    changes: ['Recorded interview analysis', 'CV identity verification'],
  })
  assert.match(update.actionUrl, /\/resume$/)
  assert.match(update.summary, /Add your CV/i)
  assert.equal(update.summary.includes('Backend Engineer'), false)
})

test('Gemini generative features fail closed when no private key is configured', async () => {
  const previous = process.env.GEMINI_API_KEY
  delete process.env.GEMINI_API_KEY
  await assert.rejects(
    () => generateGroundedCoverLetter({ name: 'Alex' }, { title: 'Engineer' }),
    error => error.status === 503
  )
  if (previous) process.env.GEMINI_API_KEY = previous
})

test('Gemini evaluates typed interview answers with bounded coaching output', async () => {
  const previousKey = process.env.GEMINI_API_KEY
  const previousFetch = globalThis.fetch
  process.env.GEMINI_API_KEY = 'test-key'
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        scores: { clarity: 82, evidence: 91, relevance: 86, structure: 79 },
        strengths: ['Specific outcome', 'Clear ownership'],
        improvements: ['Tighten the opening'],
        coachNote: 'Lead with the situation, then preserve the measurable result.',
        spokenReply: 'That process improvement gives me a useful picture of how you approach operational problems.',
      }) }] } }],
    }),
  })
  try {
    const feedback = await analyzeInterviewAnswer({
      answer: 'I rebuilt our intake workflow and reduced processing time by 35 percent for 1,200 users.',
      question: { prompt: 'Tell me about a process you improved.', focus: ['process', 'result'] },
      profile: { name: 'Alex', skills: ['Operations'] },
      role: 'Accounts Payable Assistant',
      company: 'Example Company',
    })
    assert.equal(feedback.source, 'gemini-text')
    assert.equal(feedback.overall, 85)
    assert.equal(feedback.scores.evidence, 91)
    assert.equal(feedback.wordCount, 15)
    assert.match(feedback.spokenReply, /process improvement/i)
  } finally {
    globalThis.fetch = previousFetch
    if (previousKey) process.env.GEMINI_API_KEY = previousKey
    else delete process.env.GEMINI_API_KEY
  }
})
