import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildClientReleaseNotes,
  clientFileFingerprint,
  isClientVisibleSoftwareFile,
} from '../src/services/softwareChangeUpdateAgentService.js'

test('software update agent watches launch-facing client and owner portal files', () => {
  assert.equal(isClientVisibleSoftwareFile('frontend/src/pages/CareerLab.jsx'), true)
  assert.equal(isClientVisibleSoftwareFile('backend/src/routes/career.js'), true)
  assert.equal(isClientVisibleSoftwareFile('admin-portal/src/pages/ClientUpdatesPage.jsx'), true)
  assert.equal(isClientVisibleSoftwareFile('backend/src/db/postgresRowStore.js'), true)
  assert.equal(isClientVisibleSoftwareFile('backend/src/middleware/validate.js'), true)
  assert.equal(isClientVisibleSoftwareFile('backend/src/services/fileValidationService.js'), true)
  assert.equal(isClientVisibleSoftwareFile('backend/src/services/softwareChangeUpdateAgentService.js'), false)
  assert.equal(isClientVisibleSoftwareFile('backend/data/jobpilot.sqlite'), false)
})

test('security infrastructure changes produce client-safe release notes', () => {
  const notes = buildClientReleaseNotes([
    'backend/src/db/postgresRowStore.js',
    'backend/src/middleware/validate.js',
    'backend/src/services/fileValidationService.js',
  ])

  assert.equal(notes.length, 1)
  assert.equal(notes[0].key, 'security_hardening')
  assert.doesNotMatch(notes[0].detail, /postgresRowStore|middleware|\.js/)
})

test('release notes describe features without exposing source file names', () => {
  const notes = buildClientReleaseNotes([
    'frontend/src/pages/CareerLab.jsx',
    'frontend/src/styles.css',
    'backend/src/routes/career.js',
  ])

  assert.equal(notes.length, 1)
  assert.equal(notes[0].key, 'career_lab')
  assert.match(notes[0].detail, /^New:/)
  assert.doesNotMatch(notes[0].detail, /\.jsx|backend\//)
})

test('known features are described as improvements on later releases', () => {
  const notes = buildClientReleaseNotes(
    ['frontend/src/pages/CareerLab.jsx'],
    new Set(['career_lab']),
  )
  assert.match(notes[0].detail, /^Improved:/)
})

test('content fingerprint ignores timestamps and object insertion order', () => {
  const first = clientFileFingerprint({
    'frontend/src/App.jsx': 'content-a',
    'frontend/src/styles.css': 'content-b',
  })
  const second = clientFileFingerprint({
    'frontend/src/styles.css': 'content-b',
    'frontend/src/App.jsx': 'content-a',
  })

  assert.equal(first, second)
  assert.notEqual(first, clientFileFingerprint({ 'frontend/src/App.jsx': 'changed' }))
})
