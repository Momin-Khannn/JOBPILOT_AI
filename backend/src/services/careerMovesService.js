const DAY_MS = 24 * 60 * 60 * 1000

function cleanText(value = '', limit = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, limit)
}

function validDate(value) {
  const date = new Date(value || 0)
  return Number.isNaN(date.getTime()) ? null : date
}

function latestDate(values = []) {
  return values
    .map(validDate)
    .filter(Boolean)
    .sort((left, right) => right.getTime() - left.getTime())[0] || null
}

function roundMoney(value, interval = 1000) {
  return Math.round(Number(value || 0) / interval) * interval
}

function relevantInboxEvents(application, inboxEvents = []) {
  const company = cleanText(application.job?.company).toLowerCase()
  return inboxEvents
    .filter(event => event.userId === application.userId)
    .filter(event => {
      if (event.id === application.lastInboxEventId) return true
      const classifiedCompany = cleanText(event.classification?.company).toLowerCase()
      const text = `${event.from || ''} ${event.subject || ''}`.toLowerCase()
      return Boolean(company && ((classifiedCompany && (classifiedCompany.includes(company) || company.includes(classifiedCompany))) || text.includes(company)))
    })
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
}

function evidenceFromProfile(profile = {}) {
  const experience = (profile.experience || []).flatMap(item => [
    cleanText(item?.title, 240),
    ...(item?.bullets || []).map(bullet => cleanText(bullet, 300)),
  ]).filter(Boolean)
  const skills = (profile.skills || []).map(skill => cleanText(skill, 80)).filter(Boolean)
  return {
    achievement: experience.find(line => /\d|built|created|improved|reduced|increased|led|delivered/i.test(line)) || experience[0] || '',
    skills: skills.slice(0, 4),
  }
}

export function ghostingSignal(application = {}, inboxEvents = [], now = new Date(), preferences = {}) {
  const interviewStage = application.status === 'interview'
  const configuredThreshold = interviewStage ? preferences.ghostingInterviewDays : preferences.ghostingApplicationDays
  const thresholdDays = Math.min(30, Math.max(3, Number(configuredThreshold || (interviewStage ? 9 : 7))))
  const trackedStatuses = new Set(['applied', 'sent_demo', 'interview', 'follow_up_needed'])
  const events = relevantInboxEvents(application, inboxEvents)
  const latestEvent = events[0]
  const anchor = latestDate([
    application.lastRecruiterActivityAt,
    latestEvent?.createdAt,
    application.lastFollowUpAt,
    application.interviewAt,
    application.sentAt,
    application.statusChangedAt,
    application.createdAt,
  ])
  const daysWaiting = anchor ? Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / DAY_MS)) : 0
  const terminal = ['offer', 'rejected', 'job_closed'].includes(application.status)
  const eligible = trackedStatuses.has(application.status) && !terminal && daysWaiting >= thresholdDays
  const eligibleAt = anchor ? new Date(anchor.getTime() + thresholdDays * DAY_MS).toISOString() : null

  return {
    eligible,
    stage: application.status,
    thresholdDays,
    daysWaiting,
    waitingSince: anchor?.toISOString() || null,
    eligibleAt,
    lastRecruiterEvent: latestEvent ? {
      id: latestEvent.id,
      subject: cleanText(latestEvent.subject, 180),
      intent: latestEvent.classification?.intent || 'other',
      createdAt: latestEvent.createdAt,
    } : null,
    reason: eligible
      ? `${daysWaiting} days have passed without a newer recruiter response.`
      : terminal
        ? 'This application already has an outcome.'
        : `JobPilot will suggest a value-add follow-up after ${thresholdDays} quiet days.`,
  }
}

export function buildGhostingResolution({ application, profile = {}, inboxEvents = [], companySignal = '', sourceUrl = '', preferences = {}, now = new Date() }) {
  const signal = ghostingSignal(application, inboxEvents, now, preferences)
  const job = application.job || {}
  const evidence = evidenceFromProfile(profile)
  const roleNeed = (job.tags || []).slice(0, 3).join(', ') || cleanText(job.description, 160) || 'the priorities described for the role'
  const verifiedSignal = cleanText(companySignal, 320)
  const source = cleanText(sourceUrl, 500)
  const tone = ['concise', 'balanced', 'warm'].includes(preferences.aiTone) ? preferences.aiTone : 'balanced'
  const evidenceLine = evidence.achievement
    ? `One relevant example from my background is ${evidence.achievement.replace(/[.!]+$/, '')}.`
    : evidence.skills.length
      ? `My background in ${evidence.skills.join(', ')} remains closely aligned with the role.`
      : 'My experience remains closely aligned with the role and I would be glad to share more detail.'
  const signalLine = verifiedSignal
    ? `I also noticed ${verifiedSignal.replace(/[.!]+$/, '')}, which made me think again about how the team is approaching ${roleNeed}.`
    : `I have been thinking about the team's work around ${roleNeed}.`
  const interestLine = tone === 'concise'
    ? `I am following up on the ${job.title || 'role'} opportunity at ${job.company || 'your company'}.`
    : tone === 'warm'
      ? `I wanted to follow up on the ${job.title || 'role'} opportunity. Our conversations strengthened my interest in contributing to ${job.company || 'the team'}.`
      : `I wanted to follow up on the ${job.title || 'role'} opportunity. I remain very interested in contributing to ${job.company || 'the team'}.`
  const closingLine = tone === 'concise'
    ? 'If the role is still moving forward, I would welcome an update and can provide anything else you need.'
    : 'If the role is still moving forward, I would welcome the chance to reconnect. I am also happy to provide any additional information that would be useful.'

  return {
    status: 'draft',
    generatedAt: now.toISOString(),
    signal,
    research: {
      company: job.company || 'the company',
      knownRoleNeeds: (job.tags || []).slice(0, 5),
      companySignal: verifiedSignal,
      sourceUrl: source,
      sourceStatus: verifiedSignal && source ? 'user_verified' : 'job_record_only',
      note: verifiedSignal && !source
        ? 'Add a source link before relying on the company update.'
        : 'No external company claim was invented.',
    },
    evidence: {
      achievement: evidence.achievement,
      skills: evidence.skills,
      source: evidence.achievement || evidence.skills.length ? 'verified_resume' : 'application_record',
    },
    draft: {
      subject: `Following up on the ${job.title || 'role'} at ${job.company || 'your company'}`,
      body: [
        `Hi ${job.recruiterName || 'Hiring Manager'},`,
        '',
        interestLine,
        '',
        signalLine,
        evidenceLine,
        '',
        closingLine,
        '',
        `Best regards,\n${profile.name || 'Applicant'}`,
      ].join('\n'),
    },
  }
}

function postedRange(job = {}) {
  const minimum = Number(job.salaryMin || 0)
  const maximum = Number(job.salaryMax || 0)
  if (!minimum && !maximum) return null
  return { minimum: minimum || maximum, maximum: maximum || minimum, source: 'job_posting' }
}

export function extractOfferSignal({ subject = '', body = '' } = {}) {
  const text = `${subject} ${body}`
  const money = [...text.matchAll(/(?:USD|PKR|GBP|EUR|\$|£|€)\s*([\d,]+(?:\.\d+)?)/gi)]
    .map(match => Number(match[1].replace(/,/g, '')))
    .filter(value => Number.isFinite(value) && value > 0)
  return {
    detected: /offer|compensation|salary|base pay|pleased to offer/i.test(text),
    values: money.slice(0, 6),
    deadline: text.match(/(?:respond|reply|accept|decision).{0,30}(\b(?:20\d{2}-\d{2}-\d{2}|\w+\s+\d{1,2}(?:,\s*20\d{2})?)\b)/i)?.[1] || '',
  }
}

export function buildNegotiationPlan({ application, profile = {}, offer = {}, preferences = {}, now = new Date() }) {
  const job = application.job || {}
  const currency = cleanText(offer.currency || preferences.salaryCurrency || 'USD', 8).toUpperCase()
  const tone = ['concise', 'balanced', 'warm'].includes(preferences.aiTone) ? preferences.aiTone : 'balanced'
  const payPeriod = ['annual', 'monthly', 'hourly'].includes(offer.payPeriod) ? offer.payPeriod : 'annual'
  const baseSalary = Math.max(0, Number(offer.baseSalary || 0))
  if (!baseSalary) {
    const error = new Error('Enter the base salary from the written offer.')
    error.status = 400
    throw error
  }

  const listed = postedRange(job)
  const market = {
    minimum: Math.max(0, Number(offer.marketMin || listed?.minimum || 0)),
    median: Math.max(0, Number(offer.marketMedian || 0)),
    maximum: Math.max(0, Number(offer.marketMax || listed?.maximum || 0)),
    sourceUrl: cleanText(offer.sourceUrl, 500),
    source: offer.sourceUrl ? 'user_supplied_market_source' : listed ? 'job_posting' : 'no_external_source',
  }
  if (!market.median && market.minimum && market.maximum) market.median = roundMoney((market.minimum + market.maximum) / 2)

  const evidence = evidenceFromProfile(profile)
  const upperEvidence = Math.max(market.median, market.maximum)
  const evidenceBackedTarget = upperEvidence > baseSalary
    ? Math.min(upperEvidence, Math.max(baseSalary * 1.08, market.median || 0))
    : baseSalary * 1.08
  const targetBase = Math.max(baseSalary, roundMoney(evidenceBackedTarget, payPeriod === 'annual' ? 1000 : 100))
  const increasePercent = Math.round(((targetBase - baseSalary) / baseSalary) * 100)
  const leverage = [
    application.matchScore ? `${application.matchScore}% role match recorded by JobPilot` : '',
    evidence.achievement ? `Verified CV evidence: ${evidence.achievement}` : '',
    evidence.skills.length ? `Relevant skills: ${evidence.skills.join(', ')}` : '',
    offer.signOnBonus ? `The offer already includes a ${currency} ${Number(offer.signOnBonus).toLocaleString()} sign-on bonus.` : '',
  ].filter(Boolean).slice(0, 4)
  const alternatives = [
    'A written compensation review after the first 90 days',
    'Additional paid leave or a flexible start date',
    'A signing bonus if base salary cannot move',
    offer.equity ? 'Clarification or improvement of the equity grant and vesting terms' : 'An equity grant with clear vesting terms',
  ]

  const marketSentence = market.median
    ? `The evidence entered for this role centers around ${currency} ${market.median.toLocaleString()} per ${payPeriod.replace('annual', 'year').replace('monthly', 'month')}.`
    : 'I am basing this request on the role scope and the experience I would bring, rather than claiming an external market benchmark.'
  const offerThanks = tone === 'concise'
    ? `Thank you for the offer for the ${job.title || 'role'} position.`
    : tone === 'warm'
      ? `Thank you again for the offer for the ${job.title || 'role'} position. I am genuinely delighted about the opportunity to join ${job.company || 'the team'}.`
      : `Thank you for the offer for the ${job.title || 'role'} position. I am genuinely excited about the opportunity to join ${job.company || 'the team'}.`

  return {
    status: 'draft',
    generatedAt: now.toISOString(),
    offer: {
      currency,
      payPeriod,
      baseSalary,
      annualBonus: Math.max(0, Number(offer.annualBonus || 0)),
      signOnBonus: Math.max(0, Number(offer.signOnBonus || 0)),
      equity: cleanText(offer.equity, 300),
      benefits: cleanText(offer.benefits, 800),
      deadline: cleanText(offer.deadline, 120),
      notes: cleanText(offer.notes, 1200),
    },
    market,
    recommendation: {
      targetBase,
      increasePercent,
      rationale: marketSentence,
      alternatives,
      cautions: [
        market.source === 'no_external_source' ? 'No external salary source is attached; validate the target before sending.' : '',
        'Compensation outcomes are uncertain. Review the complete offer and choose the request you can defend comfortably.',
        'Do not misstate competing offers, market data, or experience.',
      ].filter(Boolean),
    },
    leverage,
    conversationScript: [
      `Thank you again for the offer. I am genuinely excited about the ${job.title || 'role'} and the opportunity to join ${job.company || 'the team'}.`,
      `After reviewing the scope and total package, I would like to discuss a base salary closer to ${currency} ${targetBase.toLocaleString()} per ${payPeriod.replace('annual', 'year').replace('monthly', 'month')}.`,
      leverage[1] || leverage[2] || 'I believe my relevant experience will allow me to contribute quickly.',
      'Is there flexibility to move the base closer to that level? If base salary is fixed, I would be glad to discuss a signing bonus, additional leave, or an early compensation review.',
    ],
    draft: {
      subject: `Offer discussion - ${job.title || 'role'} at ${job.company || 'your company'}`,
      body: [
        `Hi ${job.recruiterName || 'Hiring Manager'},`,
        '',
        offerThanks,
        '',
        `After reviewing the role scope and the complete package, I would like to discuss a base salary of ${currency} ${targetBase.toLocaleString()} per ${payPeriod.replace('annual', 'year').replace('monthly', 'month')}. ${marketSentence}`,
        '',
        evidence.achievement
          ? `I believe this is supported by my relevant experience, including ${evidence.achievement.replace(/[.!]+$/, '')}.`
          : 'I believe this request reflects the role responsibilities and the relevant experience I would bring.',
        '',
        'Is there flexibility to move the base closer to that level? I am happy to discuss the broader package as well.',
        '',
        `Best regards,\n${profile.name || 'Applicant'}`,
      ].join('\n'),
    },
  }
}
