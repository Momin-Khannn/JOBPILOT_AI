import test from 'node:test'
import assert from 'node:assert/strict'
import { validateImageUpload, validateResumeUpload } from '../src/services/fileValidationService.js'

function upload(originalname, mimetype, content) {
  return { originalname, mimetype, buffer: Buffer.from(content) }
}

test('resume uploads use file signatures instead of client MIME claims', async () => {
  const pdf = upload('resume.pdf', 'application/octet-stream', '%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF')
  const verified = await validateResumeUpload(pdf)
  assert.equal(verified.mime, 'application/pdf')

  const disguisedExecutable = upload('resume.pdf', 'application/pdf', Buffer.from('MZ\u0090\u0000fake executable'))
  await assert.rejects(() => validateResumeUpload(disguisedExecutable), /contents do not match/i)
})

test('plain text resumes reject binary payloads', async () => {
  const text = await validateResumeUpload(upload('resume.txt', 'text/plain', 'Jamie Example\nSkills: Node JS, SQL\nExperience building APIs.'))
  assert.equal(text.mime, 'text/plain')

  await assert.rejects(
    () => validateResumeUpload(upload('resume.txt', 'text/plain', Buffer.from([0x00, 0x01, 0x02, 0x03]))),
    /binary data/i
  )
})

test('profile images must match their extension', async () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52])
  assert.equal((await validateImageUpload(upload('photo.png', 'image/jpeg', pngHeader))).mime, 'image/png')
  await assert.rejects(() => validateImageUpload(upload('photo.jpg', 'image/jpeg', pngHeader)), /do not match/i)
})
