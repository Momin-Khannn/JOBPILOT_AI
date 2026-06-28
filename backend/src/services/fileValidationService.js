import path from 'path'
import { fileTypeFromBuffer } from 'file-type'

const resumeTypes = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
}

const imageTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

function uploadError(message) {
  const error = new Error(message)
  error.status = 415
  return error
}

function safeFileName(value = '') {
  return path.basename(String(value)).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180) || 'upload'
}

function looksLikePlainText(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return false
  const sample = buffer.subarray(0, Math.min(buffer.length, 64 * 1024))
  if (sample.includes(0)) return false
  let suspicious = 0
  for (const byte of sample) {
    if (byte < 9 || (byte > 13 && byte < 32)) suspicious += 1
  }
  const decoded = sample.toString('utf8')
  const replacementCount = (decoded.match(/\uFFFD/g) || []).length
  return suspicious / sample.length < 0.01 && replacementCount / Math.max(1, decoded.length) < 0.01
}

async function detect(buffer) {
  try {
    return await fileTypeFromBuffer(buffer)
  } catch {
    throw uploadError('The uploaded file is malformed or its type could not be verified.')
  }
}

export async function validateResumeUpload(file) {
  if (!file?.buffer?.length) {
    const error = new Error('Resume file is required')
    error.status = 400
    throw error
  }

  const fileName = safeFileName(file.originalname)
  const extension = path.extname(fileName).toLowerCase()
  const expectedMime = resumeTypes[extension]
  if (!expectedMime) throw uploadError('Unsupported resume format. Upload a PDF, DOCX, or TXT file.')

  const detected = await detect(file.buffer)
  if (extension === '.txt') {
    if (detected || !looksLikePlainText(file.buffer)) {
      throw uploadError('The TXT upload contains binary data and was rejected.')
    }
  } else if (detected?.mime !== expectedMime) {
    throw uploadError(`The file contents do not match the ${extension.slice(1).toUpperCase()} extension.`)
  }

  return { fileName, extension, mime: expectedMime }
}

export async function validateImageUpload(file) {
  if (!file?.buffer?.length) {
    const error = new Error('Choose a JPG, PNG, WEBP, or GIF image under 3 MB')
    error.status = 400
    throw error
  }

  const fileName = safeFileName(file.originalname)
  const extension = path.extname(fileName).toLowerCase()
  const expectedMime = imageTypes[extension]
  if (!expectedMime) throw uploadError('Choose a JPG, PNG, WEBP, or GIF image.')

  const detected = await detect(file.buffer)
  if (detected?.mime !== expectedMime) {
    throw uploadError('The image contents do not match its file extension.')
  }

  return { fileName, extension, mime: expectedMime }
}
