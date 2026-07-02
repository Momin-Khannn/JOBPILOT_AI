import test from 'node:test'
import assert from 'node:assert/strict'
import { parseResumeText } from '../src/services/aiService.js'
import { mergeResumeIntoProfile, syncProfileSectionsIntoResume } from '../src/services/profileService.js'

test('resume parsing keeps work experience and projects in their matching sections', () => {
  const parsed = parseResumeText(`
Jamie Taylor
jamie@example.com

EXPERIENCE
Software Engineer
Acme Labs | January 2023 - Present
- Built APIs that reduced processing time by 35%.

PROJECTS
JobPilot AI | React, Node.js, PostgreSQL
- Built a job application workspace with interview practice.
Technologies: React, Node.js, PostgreSQL
https://example.com/jobpilot

EDUCATION
BS Computer Science, Example University, 2022
  `)

  assert.equal(parsed.experience.length, 1)
  assert.equal(parsed.experience[0].title, 'Software Engineer')
  assert.equal(parsed.experience[0].company, 'Acme Labs')
  assert.match(parsed.experience[0].description, /reduced processing time/i)
  assert.equal(parsed.projects.length, 1)
  assert.equal(parsed.projects[0].name, 'JobPilot AI')
  assert.equal(parsed.projects[0].url, 'https://example.com/jobpilot')
  assert.match(parsed.projects[0].technologies, /React/i)
  assert.match(parsed.projects[0].description, /interview practice/i)
})

test('CV uploads merge matching webpage records and preserve webpage-only records', () => {
  const existing = {
    id: 'profile-1',
    userId: 'user-1',
    slug: 'jamie-taylor',
    published: true,
    experience: [
      { title: 'Software Engineer', company: 'Acme Labs', duration: '2022 - 2023', description: 'Older description' },
      { title: 'Volunteer Mentor', company: 'Code Club', duration: '2021', description: 'Webpage-only role' },
    ],
    projects: [
      { name: 'JobPilot AI', url: 'https://saved.example', technologies: '', description: 'Older project copy' },
      { name: 'Community Site', url: '', technologies: 'HTML', description: 'Webpage-only project' },
    ],
  }
  const resume = {
    profile: {
      experience: [{ title: 'Software Engineer', company: 'Acme Labs', duration: '2023 - Present', description: 'Current CV description' }],
      projects: [{ name: 'JobPilot AI', url: '', technologies: 'React, Node.js', description: 'Current CV project copy' }],
    },
  }

  const merged = mergeResumeIntoProfile(existing, resume, { id: 'user-1', name: 'Jamie Taylor' })
  assert.equal(merged.experience.length, 2)
  assert.equal(merged.experience[0].duration, '2023 - Present')
  assert.equal(merged.experience[0].description, 'Current CV description')
  assert.equal(merged.experience[1].title, 'Volunteer Mentor')
  assert.equal(merged.projects.length, 2)
  assert.equal(merged.projects[0].technologies, 'React, Node.js')
  assert.equal(merged.projects[0].url, 'https://saved.example')
  assert.equal(merged.projects[1].name, 'Community Site')
})

test('CV webpage section edits synchronize back into the latest parsed CV', () => {
  const resume = { profile: { experience: [], projects: [] } }
  syncProfileSectionsIntoResume(resume, {
    experience: [{ title: 'Backend Engineer', company: 'JobPilot', duration: '2025 - Present', description: 'Built secure APIs.' }],
    projects: [{ name: 'Career Lab', url: '', technologies: 'React', description: 'Interview coaching workspace.' }],
  })

  assert.equal(resume.profile.experience[0].title, 'Backend Engineer')
  assert.deepEqual(resume.profile.experience[0].bullets, ['Built secure APIs.'])
  assert.equal(resume.profile.projects[0].name, 'Career Lab')
  assert.ok(resume.profile.profileSyncedAt)
})
