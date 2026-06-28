import test from 'node:test'
import assert from 'node:assert/strict'
import { parseResumeText, scoreJobMatch } from '../src/services/aiService.js'

test('ATS parser rewards real resume structure without a fixed passing score', () => {
  const sparse = parseResumeText('Jamie Example\njamie@example.com\nLooking for work.')
  const complete = parseResumeText(`
    Jamie Example
    jamie@example.com | +1 555 222 3333 | https://linkedin.com/in/jamie
    SUMMARY
    Backend engineer building reliable APIs and data services.
    SKILLS
    Node.js, Express, PostgreSQL, Docker, AWS, Git
    EXPERIENCE
    Backend Engineer - Built an API that reduced processing time by 35% for 1200 users.
    EDUCATION
    BS Computer Science, Example University, 2024
  `)

  assert.ok(sparse.atsScore < 40)
  assert.ok(complete.atsScore > sparse.atsScore)
  assert.ok(complete.atsBreakdown.impact > 0)
})

test('unrelated profiles are not given an artificial minimum match', () => {
  const result = scoreJobMatch({
    summary: 'Illustrator and print designer',
    skills: ['Illustration'],
    topMatches: ['Graphic Designer'],
    atsScore: 80,
  }, {
    title: 'Database Engineer',
    description: 'Optimize PostgreSQL queries and ETL pipelines.',
    tags: ['PostgreSQL', 'SQL', 'ETL'],
  })

  assert.ok(result.matchScore < 25)
  assert.deepEqual(result.missingSkills, ['PostgreSQL', 'SQL', 'ETL'])
})

test('SQL does not match only because it appears inside MySQL', () => {
  const result = scoreJobMatch({ summary: '', skills: ['MySQL'], topMatches: [], atsScore: 60 }, {
    title: 'SQL Analyst',
    description: 'Write SQL reports.',
    tags: ['SQL'],
  })
  assert.deepEqual(result.missingSkills, ['SQL'])
})

test('common skill aliases match canonical resume and job terminology', () => {
  const parsed = parseResumeText(`
    Jamie Example
    jamie@example.com
    SKILLS
    Node JS, Postgres, PowerBI, scikit learn
    EXPERIENCE
    Backend Engineer building data APIs.
  `)

  assert.ok(parsed.skills.includes('Node.js'))
  assert.ok(parsed.skills.includes('Postgresql'))
  assert.ok(parsed.skills.includes('Power Bi'))
  assert.ok(parsed.skills.includes('Scikit-learn'))

  const match = scoreJobMatch({ summary: '', skills: ['Node JS', 'Postgres'], topMatches: [], atsScore: 70 }, {
    title: 'Backend Engineer',
    description: 'Build APIs with Node.js and PostgreSQL.',
    tags: ['Node.js', 'PostgreSQL'],
  })
  assert.deepEqual(match.missingSkills, [])
})
