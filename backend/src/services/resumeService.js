import { parseResumeText } from './aiService.js'

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

  return buffer.toString('utf8')
}

export async function parseResumeUpload(file) {
  if (!file) {
    const error = new Error('Resume file is required')
    error.status = 400
    throw error
  }

  const rawText = await extractText(file.buffer, file.mimetype, file.originalname)
  if (!rawText || rawText.trim().length < 40) {
    const error = new Error('Could not extract enough text. Please upload a text-based PDF, DOCX, or TXT resume.')
    error.status = 422
    throw error
  }

  return {
    rawText,
    profile: parseResumeText(rawText),
  }
}
