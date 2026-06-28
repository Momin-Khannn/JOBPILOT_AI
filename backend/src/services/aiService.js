const skillCatalog = [
  'javascript', 'typescript', 'react', 'node.js', 'node', 'express', 'postgresql', 'mysql', 'sql',
  'mongodb', 'python', 'django', 'flask', 'fastapi', 'pandas', 'scikit-learn', 'machine learning',
  'data science', 'aws', 'azure', 'docker', 'kubernetes', 'redis', 'rest api', 'rest apis',
  'graphql', 'html', 'css', 'tailwind', 'git', 'power bi', 'excel', 'etl', 'authentication',
]

const skillAliases = {
  javascript: ['javascript', 'java script', 'js'],
  typescript: ['typescript', 'type script'],
  'node.js': ['node.js', 'node js', 'nodejs'],
  node: ['node.js', 'node js', 'nodejs'],
  postgresql: ['postgresql', 'postgres', 'postgre sql'],
  mongodb: ['mongodb', 'mongo db'],
  'scikit-learn': ['scikit-learn', 'scikit learn', 'sklearn'],
  'machine learning': ['machine learning', 'ml'],
  'data science': ['data science', 'data analytics'],
  'rest api': ['rest api', 'restful api'],
  'rest apis': ['rest apis', 'restful apis', 'rest api', 'restful api'],
  'power bi': ['power bi', 'powerbi'],
}

const stopWords = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'it', 'of', 'on',
  'or', 'our', 'that', 'the', 'this', 'to', 'we', 'will', 'with', 'you', 'your', 'role', 'work',
])

function tokenize(text = '') {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !stopWords.has(token))
}

function includesSkill(text, skill) {
  const aliases = skillAliases[String(skill).toLowerCase()] || [skill]
  return aliases.some((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text)
  })
}

function uniqueTokens(text) {
  return new Set(tokenize(text))
}

function sentenceCase(value) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function parseResumeText(text = '') {
  const clean = text.replace(/\s+/g, ' ').trim()
  const lower = clean.toLowerCase()
  const email = clean.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || ''
  const phone = clean.match(/(\+?\d[\d\s().-]{8,}\d)/)?.[0]?.trim() || ''
  const linkedIn = clean.match(/https?:\/\/(www\.)?linkedin\.com\/[^\s]+/i)?.[0] || ''
  const github = clean.match(/https?:\/\/(www\.)?github\.com\/[^\s]+/i)?.[0] || ''
  const skills = skillCatalog
    .filter(skill => includesSkill(lower, skill))
    .map(skill => skill === 'node' ? 'Node.js' : skill.split(' ').map(sentenceCase).join(' '))

  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const name = lines.find(line =>
    line.length <= 60 &&
    !line.includes('@') &&
    !/\d{3,}/.test(line) &&
    !/resume|curriculum|skills|education|experience/i.test(line)
  ) || ''

  const education = lines
    .filter(line => /bachelor|bs |bsc|master|ms |msc|university|college|degree/i.test(line))
    .slice(0, 4)
    .map(line => ({ degree: line, institution: '', year: line.match(/\b(20\d{2}|19\d{2})\b/)?.[0] || '' }))

  const experienceLines = lines
    .filter(line => /developer|engineer|analyst|intern|manager|assistant|project|built|created|designed|implemented|managed|led|improved/i.test(line))
    .slice(0, 8)
  const hasMetrics = /\b\d+(?:\.\d+)?%|\b\d+\+|\b\d{2,}\b/.test(clean)
  const hasSummarySection = /\b(summary|profile|objective)\b/i.test(text)
  const hasSkillsSection = /\b(skills|technologies|technical skills|tools)\b/i.test(text)
  const hasExperienceSection = /\b(experience|employment|work history|projects)\b/i.test(text)
  const hasEducationSection = /\b(education|academic|university|college|degree)\b/i.test(text)
  const rawScore =
    (email ? 8 : 0) +
    (phone ? 7 : 0) +
    (linkedIn || github ? 5 : 0) +
    (hasSummarySection ? 10 : clean.length >= 250 ? 5 : 0) +
    (hasSkillsSection ? 10 : 0) +
    Math.min(15, skills.length * 2) +
    (hasExperienceSection ? 12 : experienceLines.length ? 6 : 0) +
    (hasEducationSection ? 10 : education.length ? 6 : 0) +
    (hasMetrics ? 8 : 0) +
    (clean.length >= 700 && clean.length <= 9000 ? 10 : clean.length >= 350 ? 5 : 0) +
    (lines.length >= 8 ? 5 : 0)

  const summary = skills.length
    ? `Candidate with experience across ${skills.slice(0, 5).join(', ')} and a profile suitable for software, data, and technical roles.`
    : 'Candidate profile parsed from the uploaded resume. Add more explicit skills and achievements to improve matching.'

  return {
    name,
    email,
    phone,
    linkedIn,
    github,
    summary,
    skills: [...new Set(skills)],
    education,
    experience: experienceLines
      .slice(0, 8)
      .map(line => ({ title: line, company: '', duration: '', bullets: [] })),
    atsScore: Math.min(100, rawScore),
    atsBreakdown: {
      contact: (email ? 8 : 0) + (phone ? 7 : 0),
      links: linkedIn || github ? 5 : 0,
      content: Math.min(45, (hasSummarySection ? 10 : 0) + (hasSkillsSection ? 10 : 0) + skills.length * 2 + (hasExperienceSection ? 12 : 0)),
      education: hasEducationSection ? 10 : education.length ? 6 : 0,
      impact: hasMetrics ? 8 : 0,
      readability: (clean.length >= 700 && clean.length <= 9000 ? 10 : clean.length >= 350 ? 5 : 0) + (lines.length >= 8 ? 5 : 0),
    },
    gaps: [
      ...(skills.length < 6 ? ['Add a dedicated skills section with tools and technologies from target jobs.'] : []),
      ...(!linkedIn ? ['Add a LinkedIn profile link for recruiter trust.'] : []),
      ...(!hasSummarySection ? ['Add a short professional summary tailored to your target role.'] : []),
      ...(!hasExperienceSection ? ['Use a clear experience or projects section with role-relevant achievements.'] : []),
      ...(!hasMetrics ? ['Quantify achievements with metrics where possible.'] : []),
    ].slice(0, 5),
    topMatches: inferTopMatches(skills, clean),
    rawLength: clean.length,
  }
}

function inferTopMatches(skills, text) {
  const lower = text.toLowerCase()
  const picks = []
  if (skills.some(s => /react|javascript|typescript|node/i.test(s))) picks.push('Full Stack Developer')
  if (skills.some(s => /node|express|postgresql|mysql/i.test(s))) picks.push('Backend Engineer')
  if (skills.some(s => /python|pandas|sql|power bi/i.test(s))) picks.push('Data Analyst')
  if (skills.some(s => /machine|scikit|data science/i.test(s))) picks.push('Machine Learning Intern')
  if (lower.includes('database') || skills.some(s => /sql|postgresql|mysql/i.test(s))) picks.push('Database Engineer')
  return [...new Set(picks)].slice(0, 4)
}

export function scoreJobMatch(profileOrText, job) {
  const profile = (typeof profileOrText === 'string' ? parseResumeText(profileOrText) : profileOrText) || {}
  job ||= {}
  const profileText = [
    profile?.summary,
    ...(profile?.skills || []),
    ...(profile?.topMatches || []),
  ].join(' ')

  const profileTokens = uniqueTokens(profileText)
  const jobTokens = uniqueTokens(`${job.title} ${job.description} ${(job.tags || []).join(' ')}`)
  const jobSkills = [...new Set((job.tags || []).map(tag => String(tag).trim()).filter(Boolean))]
  const matchedSkills = jobSkills.filter(skill => includesSkill(profileText, skill))
  const overlap = [...jobTokens].filter(token => profileTokens.has(token)).length
  const keywordCoverage = jobTokens.size ? overlap / jobTokens.size : 0
  const skillCoverage = jobSkills.length ? matchedSkills.length / jobSkills.length : keywordCoverage
  const titleText = `${profile.summary || ''} ${(profile.topMatches || []).join(' ')}`
  const titleTokens = uniqueTokens(job.title || '')
  const titleOverlap = titleTokens.size
    ? [...titleTokens].filter(token => uniqueTokens(titleText).has(token)).length / titleTokens.size
    : 0
  const profileQuality = Math.min(1, Number(profile.atsScore || 0) / 100)
  const score = Math.min(98, Math.round(skillCoverage * 50 + keywordCoverage * 25 + titleOverlap * 15 + profileQuality * 10))
  const missingSkills = jobSkills.filter(tag => !matchedSkills.includes(tag)).slice(0, 5)

  return {
    matchScore: Math.round(score),
    atsScore: Math.min(98, Math.round(score * 0.7 + profileQuality * 30)),
    missingSkills,
    strengths: matchedSkills.map(sentenceCase).slice(0, 4),
    summary: `${Math.round(score)}% match based on role keywords, required skills, and resume profile signals.`,
  }
}

export function analyzeJobRisk(job = {}) {
  const text = `${job.title || ''} ${job.company || ''} ${job.description || ''} ${job.recruiterEmail || ''} ${job.url || ''}`.toLowerCase()
  const flags = []

  if (!job.company || job.company.length < 2) flags.push('Company name is missing or unclear.')
  if (!job.description || job.description.length < 120) flags.push('Job description is too short to verify responsibilities.')
  if (!job.url || job.url === '#') flags.push('No trustworthy job URL is attached.')
  if (/(gmail|yahoo|hotmail|outlook)\.com/.test(job.recruiterEmail || '')) flags.push('Recruiter email appears to be a personal email address.')
  if (/fee|registration|deposit|training payment|pay.*interview|crypto|investment/.test(text)) flags.push('Description mentions payment, deposits, or money movement.')
  if (/urgent hiring|no experience required|earn from home|daily payout|guaranteed income/.test(text)) flags.push('Description uses high-risk hiring language.')
  if (/whatsapp only|telegram only/.test(text)) flags.push('Recruiter asks to communicate only on chat apps.')

  const riskScore = Math.min(100, flags.length * 18 + (!job.recruiterEmail && !job.recruiterPhone ? 12 : 0))
  const riskLevel = riskScore >= 55 ? 'High' : riskScore >= 25 ? 'Medium' : 'Low'

  return {
    riskScore,
    riskLevel,
    flags,
    safeApplyTips: [
      'Never pay a fee to apply or interview.',
      'Verify the company domain and recruiter identity before sending documents.',
      'Share only resume-level information until the employer is verified.',
    ],
  }
}

export function researchCompany(job = {}) {
  const tags = job.tags || []
  const techStack = tags.filter(tag => /react|node|sql|postgres|python|aws|docker|kubernetes|mysql|redis|power bi/i.test(tag))
  const location = job.location || 'Not specified'
  const isRemote = job.type === 'Remote' || /remote/i.test(location)

  return {
    company: job.company || 'Unknown company',
    summary: `${job.company || 'This employer'} is hiring for ${job.title || 'a role'} with responsibilities around ${(tags.slice(0, 4).join(', ') || 'the listed job requirements')}.`,
    hiringSignals: [
      `${job.type || 'Role type'} role based in ${location}.`,
      job.salary ? `Salary signal available: ${job.salary}.` : 'No salary signal; ask for compensation range before late-stage interviews.',
      isRemote ? 'Remote-friendly role; confirm timezone, equipment, and communication expectations.' : 'Location-bound role; confirm office timing and commute expectations.',
    ],
    likelyTechStack: techStack.length ? techStack : tags.slice(0, 5),
    recruiterQuestions: [
      'What does success look like in the first 90 days?',
      'Which tools and systems does the team use daily?',
      'What is the interview process and expected timeline?',
    ],
    confidence: job.source === 'Demo Board' ? 72 : 62,
  }
}

export function tailorResumeForJob(profile = {}, job = {}) {
  const match = scoreJobMatch(profile, job)
  const keywords = [...new Set([...(job.tags || []), ...(match.missingSkills || [])])].slice(0, 10)
  const skills = (profile.skills || []).slice(0, 6)
  const applicantName = profile.name || 'Candidate'

  return {
    headline: `${applicantName} - ${job.title || 'Target Role'} Candidate`,
    targetedSummary: `Technical candidate with background in ${(skills.join(', ') || 'relevant tools')} targeting ${job.title || 'this role'} at ${job.company || 'the company'}.`,
    optimizedBullets: [
      `Built and improved projects using ${(skills[0] || keywords[0] || 'core technical skills')} with attention to reliability and maintainability.`,
      `Applied ${(keywords.slice(0, 3).join(', ') || 'role-relevant keywords')} to align project work with ${job.title || 'the target role'} requirements.`,
      `Collaborated through Git, documentation, and structured delivery practices to support production-ready work.`,
      `Analyzed requirements, translated them into implementation tasks, and communicated progress clearly to stakeholders.`,
      `Improved ATS alignment by making required technologies explicit in the skills and experience sections.`,
    ],
    injectedKeywords: keywords,
    atsScoreBefore: match.atsScore,
    atsScoreAfter: Math.min(98, match.atsScore + Math.max(6, keywords.length * 2)),
    cautions: [
      'Only include technologies you can honestly discuss in an interview.',
      'Keep the original resume formatting simple for ATS parsing.',
    ],
  }
}

export function generateInterviewPrep(profile = {}, job = {}) {
  const tags = (job.tags || []).slice(0, 6)
  return {
    elevatorPitch: `I am a strong fit for ${job.title || 'this role'} because my background connects with ${(tags.slice(0, 3).join(', ') || 'the core requirements')} and I can contribute quickly while continuing to learn the company stack.`,
    technicalTopics: tags.length ? tags : ['Role fundamentals', 'Recent projects', 'Problem solving', 'Communication'],
    technicalQuestions: [
      `How would you design a small feature for a ${job.title || 'technical'} workflow from requirements to deployment?`,
      `Explain a project where you used ${(tags[0] || 'a key technology')} and what tradeoffs you made.`,
      `How would you debug a production issue affecting users?`,
      `What would you improve in your current resume project if you had another week?`,
    ],
    behavioralQuestions: [
      'Tell me about a time you learned a new tool quickly.',
      'Describe a disagreement in a team and how you handled it.',
      'How do you prioritize when several tasks are urgent?',
    ],
    questionsToAsk: [
      'What are the biggest challenges for this role right now?',
      'How is performance measured for this position?',
      'What does the team expect from a new hire in the first month?',
    ],
  }
}

export function createFollowUpPlan(application = {}, days = 5) {
  const due = new Date()
  due.setDate(due.getDate() + Number(days || 5))
  const job = application.job || {}
  const name = application.profile?.name || 'Applicant'

  return {
    dueAt: due.toISOString(),
    cadenceDays: Number(days || 5),
    channel: application.channel || 'gmail',
    subject: `Following up on ${job.title || 'my application'}`,
    body: `Dear Hiring Manager,\n\nI wanted to follow up on my application for the ${job.title || 'open'} role at ${job.company || 'your company'}. I remain interested in the opportunity and would be happy to provide any additional information.\n\nBest regards,\n${name}`,
    status: 'scheduled',
  }
}

export function generateDecisionReport(profile = {}, job = {}) {
  const match = scoreJobMatch(profile, job)
  const risk = analyzeJobRisk(job)
  const research = researchCompany(job)
  const resumeTailoring = tailorResumeForJob(profile, job)
  const interviewPrep = generateInterviewPrep(profile, job)

  let recommendation = 'Apply'
  if (risk.riskLevel === 'High') recommendation = 'Skip'
  else if (match.matchScore < 65 || risk.riskLevel === 'Medium') recommendation = 'Review'

  return {
    recommendation,
    match,
    risk,
    research,
    resumeTailoring,
    interviewPrep,
    reasons: [
      match.summary,
      risk.riskLevel === 'Low'
        ? 'No major scam or safety signals detected.'
        : `${risk.riskLevel} risk: ${risk.flags[0] || 'verify this employer before applying.'}`,
      resumeTailoring.injectedKeywords.length
        ? `Resume can be improved with keywords: ${resumeTailoring.injectedKeywords.slice(0, 4).join(', ')}.`
        : 'Resume already covers the visible keywords well.',
    ],
    nextActions: recommendation === 'Skip'
      ? ['Verify the employer before sharing your resume.', 'Look for a safer listing from the same company domain.']
      : ['Review the generated outreach.', 'Approve only if the recruiter/contact details look valid.', 'Schedule a follow-up after sending.'],
    generatedAt: new Date().toISOString(),
  }
}

export function classifyInboxMessage({ subject = '', body = '', from = '' } = {}) {
  const text = `${subject} ${body}`.toLowerCase()
  let intent = 'other'
  let confidence = 48
  let recommendedStatus = 'follow_up_needed'

  if (/offer|congratulations|selected|pleased to offer/.test(text)) {
    intent = 'offer'
    confidence = 88
    recommendedStatus = 'offer'
  } else if (/interview|schedule|calendar|availability|shortlisted|assessment/.test(text)) {
    intent = 'interview'
    confidence = 84
    recommendedStatus = 'interview'
  } else if (/unfortunately|not selected|regret|move forward with other candidates/.test(text)) {
    intent = 'rejection'
    confidence = 82
    recommendedStatus = 'rejected'
  } else if (/follow up|additional information|portfolio|resume|cv/.test(text)) {
    intent = 'follow_up_needed'
    confidence = 70
    recommendedStatus = 'follow_up_needed'
  }

  const company = from.split('@')[1]?.split('.')[0] || ''
  return {
    intent,
    confidence,
    company: company ? sentenceCase(company) : null,
    role: subject.match(/for\s+(.+)$/i)?.[1] || null,
    recommendedStatus,
    action: intent === 'interview'
      ? 'Reply with availability and prepare for the interview.'
      : intent === 'offer'
        ? 'Review compensation, start date, and contract terms carefully.'
        : intent === 'rejection'
          ? 'Mark as rejected and keep the employer in your network.'
          : 'Review the message and decide whether a follow-up is needed.',
    replyDraft: `Hi,\n\nThank you for your message. I appreciate the update and will review the details carefully.\n\nBest regards,`,
  }
}

export function draftOutreach({ profile = {}, job = {}, channel = 'gmail' }) {
  const applicantName = profile.name || 'Applicant'
  const skills = (profile.skills || []).slice(0, 4).join(', ') || 'relevant technical skills'

  if (channel === 'whatsapp') {
    return {
      channel,
      subject: '',
      body: `JobPilot message on behalf of ${applicantName}: Hi ${job.recruiterName || 'Hiring Manager'}, thank you for allowing me to contact you here. I am interested in the ${job.title} role at ${job.company}, which matches my background in ${skills}. Would you be open to a brief conversation about the role?`,
    }
  }

  return {
    channel,
    subject: `Application for ${job.title} - ${applicantName}`,
    body: `Dear Hiring Manager,\n\nI am writing to apply for the ${job.title} role at ${job.company}. My background in ${skills} aligns well with the role requirements, especially the work described around ${(job.tags || []).slice(0, 3).join(', ') || 'the listed responsibilities'}.\n\nI have attached my resume for your review. I would welcome the opportunity to discuss how I can contribute to your team.\n\nBest regards,\n${applicantName}`,
  }
}
