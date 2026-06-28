import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFunnelAnalytics, buildSkillGap, evaluateInterviewAnswer, learningResources } from '../src/services/careerService.js'

test('funnel analytics reports real status conversion without inventing responses', () => {
  const analytics = buildFunnelAnalytics([
    { status: 'pending_review', matchScore: 80 },
    { status: 'interview', sentAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-04T00:00:00.000Z', matchScore: 90 },
    { status: 'rejected', sentAt: '2026-06-02T00:00:00.000Z', updatedAt: '2026-06-08T00:00:00.000Z', matchScore: 70 },
  ])

  assert.equal(analytics.totals.tracked, 3)
  assert.equal(analytics.totals.sent, 2)
  assert.equal(analytics.totals.responded, 2)
  assert.equal(analytics.totals.interviews, 1)
  assert.equal(analytics.totals.medianResponseDays, 5)
  assert.deepEqual(analytics.stages.map(stage => stage.count), [3, 2, 2, 1, 0])
})

test('skill gap is weighted by job demand and excludes owned skills', () => {
  const analysis = buildSkillGap({
    resume: { profile: { skills: ['Node.js', 'SQL'] } },
    applications: [
      { job: { tags: ['Node.js', 'Docker', 'AWS'], company: 'Alpha' } },
      { job: { tags: ['Docker', 'SQL'], company: 'Beta' } },
    ],
    roles: ['Backend Engineer'],
  })

  assert.ok(!analysis.gaps.some(gap => gap.skill === 'Node.js'))
  assert.equal(analysis.gaps[0].skill, 'Docker')
  assert.equal(analysis.gaps[0].demand, 2)
  assert.ok(analysis.learningPath.length > 0)
})

test('skill plan includes trusted learning links and saved achievements', () => {
  const before = buildSkillGap({
    resume: { profile: { skills: ['Node.js'] } },
    applications: [{ job: { tags: ['Node.js', 'SQL'], company: 'Alpha' } }],
  })
  const after = buildSkillGap({
    resume: { profile: { skills: ['Node.js'] } },
    applications: [{ job: { tags: ['Node.js', 'SQL'], company: 'Alpha' } }],
    skillAchievements: { SQL: '2026-06-19T00:00:00.000Z' },
  })

  assert.equal(after.gaps.find(gap => gap.skill === 'SQL')?.achieved, true)
  assert.ok(after.coverage > before.coverage)
  assert.ok(learningResources('SQL').some(resource => resource.provider === 'W3Schools'))
  assert.ok(after.learningPath[0].resources.every(resource => resource.url.startsWith('https://')))
})

test('course recommendations compare equivalent CV skills and explain what to study', () => {
  const analysis = buildSkillGap({
    resume: { profile: { skills: ['PostgreSQL', 'Node'] } },
    applications: [{ job: { tags: ['SQL', 'Node.js', 'Docker'], company: 'Alpha' } }],
  })

  assert.ok(!analysis.gaps.some(gap => ['SQL', 'Node.js'].includes(gap.skill)))
  const docker = analysis.gaps.find(gap => gap.skill === 'Docker')
  assert.match(docker.reason, /not evidenced in your CV/i)
  assert.match(docker.goal, /containers/i)
  assert.match(docker.project, /Containerize/i)
})

test('interview feedback rewards evidence and structure', () => {
  const weak = evaluateInterviewAnswer('I worked on a project and it went well for the team.', { focus: ['API'] })
  const strong = evaluateInterviewAnswer(
    'The situation was a slow API affecting 1200 users. I profiled the requests, changed the query plan, and reduced response time by 35 percent. The result was fewer support requests and a more reliable release.',
    { focus: ['API', 'result'] },
  )

  assert.ok(strong.overall > weak.overall)
  assert.ok(strong.scores.evidence >= 70)
  assert.ok(strong.strengths.length > 0)
})
