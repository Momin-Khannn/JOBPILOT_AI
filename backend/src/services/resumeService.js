import { parseResumeText } from './aiService.js'
import { validateResumeUpload } from './fileValidationService.js'

export async function extractText(buffer, mimetype = '', originalName = '') {
  const type = mimetype.toLowerCase()
  const name = originalName.toLowerCase()

  if (type.includes('pdf') || name.endsWith('.pdf')) {
    const pdfParse = (await import('pdf-parse')).default
    const data = await pdfParse(buffer)
    return data.text
  }

  if (type.includes('word') || name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  if (type.startsWith('text/') || name.endsWith('.txt')) return buffer.toString('utf8')

  const error = new Error('Unsupported resume format. Upload a PDF, DOCX, or TXT file.')
  error.status = 415
  throw error
}

export async function parseResumeUpload(file) {
  if (!file) {
    const error = new Error('Resume file is required')
    error.status = 400
    throw error
  }

  const verifiedFile = await validateResumeUpload(file)
  const rawText = await extractText(file.buffer, verifiedFile.mime, verifiedFile.fileName)
  if (!rawText || rawText.trim().length < 40) {
    const error = new Error('Could not extract enough text. Please upload a text-based PDF, DOCX, or TXT resume.')
    error.status = 422
    throw error
  }

  return {
    rawText,
    profile: parseResumeText(rawText),
    file: verifiedFile,
  }
}

export function sanitizeResume(resume) {
  if (!resume) return null
  const { rawText, fileBase64, ...safeResume } = resume
  return safeResume
}
