import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildGhostingResolution,
  buildNegotiationPlan,
  extractOfferSignal,
  ghostingSignal,
} from '../src/services/careerMovesService.js'

const now = new Date('2026-06-28T00:00:00.000Z')

function application(overrides = {}) {
  return {
    id: 'application-1',
    userId: 'user-1',
    status: 'interview',
    matchScore: 91,
    interviewAt: '2026-06-17T00:00:00.000Z',
    job: {
      title: 'Backend Engineer',
      company: 'Example Labs',
      recruiterName: 'Jordan',
      recruiterEmail: 'jordan@example.com',
      tags: ['Node.js', 'PostgreSQL', 'AWS'],
      salaryMin: 110000,
      salaryMax: 140000,
    },
    ...overrides,
  }
}

const profile = {
  name: 'Alex Candidate',
  skills: ['Node.js', 'PostgreSQL', 'AWS'],
  experience: [{ title: 'Backend Engineer', bullets: ['Reduced API response time by 35% for 1,200 users.'] }],
}

test('ghosting resolution waits for the threshold and uses verified evidence', () => {
  const app = application()
  const signal = ghostingSignal(app, [], now)
  assert.equal(signal.eligible, true)
  assert.equal(signal.daysWaiting, 11)

  const recentReply = [{
    id: 'event-1',
    userId: 'user-1',
    from: 'jordan@example.com',
    subject: 'Example Labs update',
    classification: { company: 'Example Labs', intent: 'interview' },
    createdAt: '2026-06-27T00:00:00.000Z',
  }]
  assert.equal(ghostingSignal(app, recentReply, now).eligible, false)

  const resolution = buildGhostingResolution({
    application: app,
    profile,
    companySignal: 'Example Labs launched its new API platform',
    sourceUrl: 'https://example.com/news/api-platform',
    now,
  })
  assert.match(resolution.draft.body, /Reduced API response time by 35%/)
  assert.match(resolution.draft.body, /launched its new API platform/)
  assert.equal(resolution.research.sourceStatus, 'user_verified')
})

test('quiet-day timing ignores ordinary edits and uses the newest recruiter activity', () => {
  const app = application({
    interviewAt: '2026-06-17T00:00:00.000Z',
    updatedAt: '2026-06-27T00:00:00.000Z',
  })

  const withoutReply = ghostingSignal(app, [], now)
  assert.equal(withoutReply.daysWaiting, 11)
  assert.equal(withoutReply.eligible, true)

  const withReply = ghostingSignal(app, [{
    id: 'event-newer',
    userId: 'user-1',
    from: 'jordan@example.com',
    subject: 'Example Labs update',
    classification: { company: 'Example Labs', intent: 'interview' },
    createdAt: '2026-06-24T00:00:00.000Z',
  }], now)
  assert.equal(withReply.daysWaiting, 4)
  assert.equal(withReply.eligible, false)
})

test('career move preferences control silence thresholds and draft tone', () => {
  const app = application({ interviewAt: '2026-06-20T00:00:00.000Z' })
  assert.equal(ghostingSignal(app, [], now, { ghostingInterviewDays: 12 }).eligible, false)
  assert.equal(ghostingSignal(app, [], now, { ghostingInterviewDays: 8 }).eligible, true)

  const concise = buildGhostingResolution({ application: app, profile, preferences: { aiTone: 'concise' }, now })
  assert.match(concise.draft.body, /I am following up on the Backend Engineer opportunity/)
})

test('negotiation plan separates entered market evidence from fallback guidance', () => {
  const plan = buildNegotiationPlan({
    application: application({ status: 'offer' }),
    profile,
    offer: {
      currency: 'USD',
      payPeriod: 'annual',
      baseSalary: 100000,
      marketMin: 115000,
      marketMedian: 125000,
      marketMax: 140000,
      sourceUrl: 'https://example.com/market/backend-engineer',
    },
    now,
  })

  assert.equal(plan.market.source, 'user_supplied_market_source')
  assert.equal(plan.recommendation.targetBase, 125000)
  assert.equal(plan.recommendation.increasePercent, 25)
  assert.match(plan.draft.body, /125,000/)
  assert.ok(plan.recommendation.cautions.some(item => /uncertain/i.test(item)))
})

test('offer signal extracts explicit compensation values without inventing a range', () => {
  const signal = extractOfferSignal({
    subject: 'Your offer',
    body: 'We are pleased to offer USD 120,000 with a USD 10,000 signing bonus.',
  })
  assert.equal(signal.detected, true)
  assert.deepEqual(signal.values, [120000, 10000])
})
