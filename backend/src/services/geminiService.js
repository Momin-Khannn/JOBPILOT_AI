const supportedAudioTypes = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/aiff',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
])

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY)
}

function configuredModel() {
  return process.env.GEMINI_MODEL || 'gemini-3.5-flash'
}

function apiBase() {
  return String(process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '')
}

function parseJson(text = '') {
  const cleaned = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error('Gemini returned an invalid structured response.')
  }
}

async function generateJson({ prompt, audio }) {
  if (!geminiConfigured()) {
    const error = new Error('Gemini features are not configured yet.')
    error.status = 503
    throw error
  }

  const controller = new globalThis.AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), Math.max(10_000, Number(process.env.GEMINI_TIMEOUT_MS || 60_000)))
  try {
    const parts = [{ text: prompt }]
    if (audio) {
      if (!supportedAudioTypes.has(audio.mimeType)) {
        const error = new Error('Use WAV, MP3, AIFF, AAC, OGG, or FLAC audio.')
        error.status = 415
        throw error
      }
      parts.push({ inlineData: { mimeType: audio.mimeType === 'audio/x-wav' ? 'audio/wav' : audio.mimeType, data: audio.buffer.toString('base64') } })
    }

    const response = await fetch(`${apiBase()}/models/${encodeURIComponent(configuredModel())}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.25 },
      }),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(payload.error?.message || 'Gemini could not complete this request.')
      error.status = response.status === 429 ? 429 : 502
      throw error
    }
    const text = (payload.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('')
    return parseJson(text)
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Gemini took too long to respond. Please try again.')
      timeoutError.status = 504
      throw timeoutError
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

function compactProfile(profile = {}) {
  return {
    name: String(profile.name || '').slice(0, 120),
    summary: String(profile.summary || '').slice(0, 1800),
    skills: (profile.skills || []).map(String).slice(0, 40),
    experience: (profile.experience || []).slice(0, 12).map(item => ({
      title: String(item.title || '').slice(0, 160),
      company: String(item.company || '').slice(0, 160),
      bullets: (item.bullets || []).map(String).slice(0, 8),
    })),
    education: (profile.education || []).map(String).slice(0, 8),
  }
}

function compactJob(job = {}) {
  return {
    title: String(job.title || '').slice(0, 180),
    company: String(job.company || '').slice(0, 180),
    description: String(job.description || '').slice(0, 10_000),
    tags: (job.tags || []).map(String).slice(0, 40),
  }
}

export async function generateGroundedCoverLetter(profile, job) {
  const sourceProfile = compactProfile(profile)
  const sourceJob = compactJob(job)
  const result = await generateJson({
    prompt: `You are JobPilot AI, an evidence-grounded career writing assistant.
Create a concise US-English cover letter using only facts explicitly present in SOURCE_PROFILE. Never invent employers, dates, degrees, skills, metrics, or achievements. If evidence is missing, stay general. Use three short paragraphs and a professional closing. Do not include addresses or a date.

Return JSON exactly in this shape:
{"subject":"string","body":"string","evidenceUsed":["string"],"cautions":["string"]}

SOURCE_PROFILE=${JSON.stringify(sourceProfile)}
TARGET_JOB=${JSON.stringify(sourceJob)}`,
  })

  const body = String(result.body || '').trim().slice(0, 7000)
  if (body.length < 120) throw new Error('Gemini did not produce a usable cover letter.')
  return {
    subject: String(result.subject || `Application for ${sourceJob.title}`).trim().slice(0, 180),
    body,
    evidenceUsed: (result.evidenceUsed || []).map(String).slice(0, 10),
    cautions: (result.cautions || []).map(String).slice(0, 6),
    model: configuredModel(),
    generatedAt: new Date().toISOString(),
  }
}

function score(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
}

export async function analyzeInterviewRecording({ audio, question, profile, role, company }) {
  const result = await generateJson({
    audio,
    prompt: `You are a supportive interview coach. Transcribe the candidate accurately and evaluate the answer, not the person's accent, identity, emotion, disability, or personality. Do not make a hiring prediction. Score clarity, evidence, relevance, and structure. Pace and filler-word observations are coaching signals only.

Return JSON exactly in this shape:
{"transcript":"string","scores":{"clarity":0,"evidence":0,"relevance":0,"structure":0},"strengths":["string"],"improvements":["string"],"coachNote":"string","pace":{"wordsPerMinute":0,"fillerWords":0,"note":"string"}}

QUESTION=${JSON.stringify(question)}
ROLE=${JSON.stringify(role || '')}
COMPANY=${JSON.stringify(company || '')}
VERIFIED_PROFILE_FACTS=${JSON.stringify(compactProfile(profile))}`,
  })

  const transcript = String(result.transcript || '').trim().slice(0, 6000)
  if (transcript.length < 20) {
    const error = new Error('The recording was too short or unclear to evaluate. Please record a fuller answer.')
    error.status = 400
    throw error
  }
  const scores = {
    clarity: score(result.scores?.clarity),
    evidence: score(result.scores?.evidence),
    relevance: score(result.scores?.relevance),
    structure: score(result.scores?.structure),
  }
  return {
    transcript,
    feedback: {
      overall: Math.round(Object.values(scores).reduce((sum, value) => sum + value, 0) / 4),
      scores,
      strengths: (result.strengths || []).map(String).slice(0, 3),
      improvements: (result.improvements || []).map(String).slice(0, 3),
      coachNote: String(result.coachNote || '').slice(0, 800),
      pace: {
        wordsPerMinute: Math.max(0, Math.min(400, Math.round(Number(result.pace?.wordsPerMinute) || 0))),
        fillerWords: Math.max(0, Math.min(200, Math.round(Number(result.pace?.fillerWords) || 0))),
        note: String(result.pace?.note || '').slice(0, 500),
      },
      wordCount: transcript.split(/\s+/).filter(Boolean).length,
      source: 'gemini-audio',
    },
  }
}

export async function personalizeClientUpdateCopy({ firstName, activity, release }) {
  if (!geminiConfigured()) return null
  const result = await generateJson({
    prompt: `You write short, respectful JobPilot AI product emails. Personalize the release update using only the SAFE_ACTIVITY facts below. Do not mention tracking, surveillance, inactivity, private documents, employer names, or inferred personal traits. Do not shame the customer. Never invent activity. Keep the summary under 55 words and return at most three relevant changes.

Return JSON exactly in this shape:
{"summary":"string","changes":["string"]}

FIRST_NAME=${JSON.stringify(String(firstName || '').slice(0, 80))}
SAFE_ACTIVITY=${JSON.stringify(activity)}
RELEASE=${JSON.stringify(release)}`,
  })
  const summary = String(result.summary || '').trim().slice(0, 500)
  if (!summary) return null
  return {
    summary,
    changes: (result.changes || []).map(String).map(item => item.trim()).filter(Boolean).slice(0, 3),
  }
}
