const sentStatuses = new Set(['applied', 'sent_demo', 'interview', 'offer', 'rejected', 'follow_up_needed'])
const responseStatuses = new Set(['interview', 'offer', 'rejected', 'follow_up_needed'])

function clean(value) {
  return String(value || '').trim()
}

function key(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').trim()
}

function unique(values) {
  const seen = new Set()
  return values.filter((value) => {
    const normalized = key(value)
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function percent(part, total) {
  return total ? Math.round((part / total) * 100) : 0
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

export function buildFunnelAnalytics(applications = []) {
  const tracked = applications.length
  const sent = applications.filter(app => app.sentAt || sentStatuses.has(app.status)).length
  const responded = applications.filter(app => responseStatuses.has(app.status)).length
  const interviews = applications.filter(app => ['interview', 'offer'].includes(app.status)).length
  const offers = applications.filter(app => app.status === 'offer').length
  const rejected = applications.filter(app => app.status === 'rejected').length
  const responseDays = applications
    .filter(app => app.sentAt && responseStatuses.has(app.status) && app.updatedAt)
    .map(app => Math.max(0, Math.round((new Date(app.updatedAt) - new Date(app.sentAt)) / 86_400_000)))

  const rawStages = [
    { id: 'tracked', label: 'Tracked', count: tracked },
    { id: 'sent', label: 'Sent', count: sent },
    { id: 'responded', label: 'Responded', count: responded },
    { id: 'interview', label: 'Interview', count: interviews },
    { id: 'offer', label: 'Offer', count: offers },
  ]
  let previous = tracked
  const stages = rawStages.map((stage, index) => {
    const count = Math.min(stage.count, previous)
    const conversion = index === 0 ? 100 : percent(count, previous)
    previous = count
    return { ...stage, count, conversion, share: percent(count, tracked) }
  })

  const statusCounts = applications.reduce((counts, app) => {
    counts[app.status || 'unknown'] = (counts[app.status || 'unknown'] || 0) + 1
    return counts
  }, {})
  const averageMatch = applications.length
    ? Math.round(applications.reduce((sum, app) => sum + Number(app.matchScore || 0), 0) / applications.length)
    : 0

  const insights = []
  if (!tracked) insights.push('Track your first application to establish a baseline.')
  else if (!sent) insights.push('Your pipeline is stocked, but no application has been sent yet.')
  else if (percent(responded, sent) < 20) insights.push('Response rate is below 20%. Tighten role targeting and the first third of your resume.')
  else insights.push(`Your ${percent(responded, sent)}% response rate is the strongest signal to preserve.`)
  if (responded && !interviews) insights.push('Responses are not becoming interviews yet. Review recruiter replies and role alignment.')
  if (interviews && !offers) insights.push('You have reached interviews; practice evidence-rich answers to improve offer conversion.')
  if (offers) insights.push('You have offer-stage proof. Compare which roles and skills produced those outcomes.')

  return {
    stages,
    totals: {
      tracked,
      sent,
      responded,
      interviews,
      offers,
      rejected,
      responseRate: percent(responded, sent),
      interviewRate: percent(interviews, sent),
      offerRate: percent(offers, interviews),
      averageMatch,
      medianResponseDays: median(responseDays),
    },
    statusCounts,
    insights,
    dataNote: 'Calculated from your JobPilot application statuses and timestamps.',
  }
}

const roleSkillHints = [
  [/front.?end|react|ui engineer/i, ['JavaScript', 'React', 'TypeScript', 'CSS', 'Accessibility', 'Testing']],
  [/back.?end|api|node/i, ['Node.js', 'APIs', 'SQL', 'Docker', 'Testing', 'Cloud']],
  [/data analyst|business intelligence|bi analyst/i, ['SQL', 'Excel', 'Power BI', 'Python', 'Data visualization', 'Statistics']],
  [/data scien|machine learning|ai engineer/i, ['Python', 'SQL', 'Statistics', 'Machine Learning', 'Data visualization', 'MLOps']],
  [/devops|site reliability|sre|cloud engineer/i, ['Linux', 'Docker', 'CI/CD', 'Cloud', 'Kubernetes', 'Monitoring']],
  [/product manager|product owner/i, ['Product strategy', 'Analytics', 'User research', 'Roadmapping', 'Stakeholder management']],
  [/ux|product design/i, ['User research', 'Figma', 'Prototyping', 'Accessibility', 'Design systems']],
]

const learningResourceCatalog = {
  javascript: [
    ['MDN', 'JavaScript Guide', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide'],
    ['W3Schools', 'JavaScript Tutorial', 'https://www.w3schools.com/js/'],
  ],
  react: [
    ['React', 'Official React Learn course', 'https://react.dev/learn'],
    ['W3Schools', 'React Tutorial', 'https://www.w3schools.com/react/'],
  ],
  typescript: [
    ['TypeScript', 'Official TypeScript Handbook', 'https://www.typescriptlang.org/docs/handbook/intro.html'],
    ['W3Schools', 'TypeScript Tutorial', 'https://www.w3schools.com/typescript/'],
  ],
  css: [
    ['W3Schools', 'CSS Tutorial', 'https://www.w3schools.com/css/'],
    ['GeeksforGeeks', 'CSS Tutorial', 'https://www.geeksforgeeks.org/css/css-tutorial/'],
  ],
  accessibility: [
    ['W3Schools', 'Web Accessibility', 'https://www.w3schools.com/accessibility/'],
    ['GeeksforGeeks', 'Web Accessibility', 'https://www.geeksforgeeks.org/websites-apps/web-accessibility/'],
  ],
  testing: [
    ['GeeksforGeeks', 'Software Testing Tutorial', 'https://www.geeksforgeeks.org/software-testing/software-testing-tutorial/'],
  ],
  'node.js': [
    ['Node.js', 'Official introduction to Node.js', 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs'],
    ['W3Schools', 'Node.js Tutorial', 'https://www.w3schools.com/nodejs/'],
  ],
  apis: [
    ['GeeksforGeeks', 'REST API Introduction', 'https://www.geeksforgeeks.org/rest-api-introduction/'],
  ],
  sql: [
    ['W3Schools', 'SQL Tutorial', 'https://www.w3schools.com/sql/'],
    ['DataCamp', 'Introduction to SQL', 'https://www.datacamp.com/courses/introduction-to-sql'],
  ],
  docker: [
    ['GeeksforGeeks', 'Docker Tutorial', 'https://www.geeksforgeeks.org/devops/docker-tutorial/'],
  ],
  cloud: [
    ['GeeksforGeeks', 'Cloud Computing Tutorial', 'https://www.geeksforgeeks.org/cloud-computing/cloud-computing/'],
  ],
  python: [
    ['W3Schools', 'Python Tutorial', 'https://www.w3schools.com/python/'],
    ['DataCamp', 'Introduction to Python', 'https://www.datacamp.com/courses/intro-to-python-for-data-science'],
  ],
  excel: [
    ['DataCamp', 'Introduction to Excel', 'https://www.datacamp.com/courses/introduction-to-excel'],
    ['GeeksforGeeks', 'Excel Tutorial', 'https://www.geeksforgeeks.org/excel/excel-tutorial/'],
  ],
  'power bi': [
    ['Microsoft Learn', 'Get started building with Power BI', 'https://learn.microsoft.com/en-us/training/powerplatform/power-bi'],
    ['DataCamp', 'Introduction to Power BI', 'https://www.datacamp.com/courses/introduction-to-power-bi'],
  ],
  'data visualization': [
    ['DataCamp', 'Understanding Data Visualization', 'https://www.datacamp.com/courses/understanding-data-visualization'],
  ],
  statistics: [
    ['DataCamp', 'Introduction to Statistics', 'https://www.datacamp.com/courses/introduction-to-statistics'],
    ['GeeksforGeeks', 'Statistics Tutorial', 'https://www.geeksforgeeks.org/maths/statistics/'],
  ],
  'machine learning': [
    ['Google', 'Machine Learning Crash Course', 'https://developers.google.com/machine-learning/crash-course'],
    ['DataCamp', 'Supervised Learning with scikit-learn', 'https://www.datacamp.com/courses/supervised-learning-with-scikit-learn'],
  ],
  mlops: [
    ['GeeksforGeeks', 'MLOps Overview', 'https://www.geeksforgeeks.org/machine-learning/mlops-machine-learning-operations/'],
  ],
  linux: [
    ['GeeksforGeeks', 'Linux Tutorial', 'https://www.geeksforgeeks.org/linux-unix/linux-tutorial/'],
  ],
  'ci cd': [
    ['GeeksforGeeks', 'CI/CD Overview', 'https://www.geeksforgeeks.org/devops/what-is-ci-cd/'],
  ],
  kubernetes: [
    ['GeeksforGeeks', 'Kubernetes Tutorial', 'https://www.geeksforgeeks.org/devops/kubernetes-tutorial/'],
  ],
}

const skillStudyPlans = {
  sql: {
    goal: 'Learn joins, aggregations, window functions, and how to explain query choices.',
    project: 'Build a small hiring-funnel analysis from a CSV and publish five decision-ready SQL queries.',
  },
  python: {
    goal: 'Build confidence with data structures, functions, files, APIs, and testing.',
    project: 'Create a role-relevant automation or analysis tool and document one measurable result.',
  },
  react: {
    goal: 'Study component design, state, forms, data fetching, accessibility, and testing.',
    project: 'Build a responsive dashboard feature with keyboard support and an API-backed workflow.',
  },
  'node.js': {
    goal: 'Learn asynchronous JavaScript, REST APIs, validation, authentication, and database access.',
    project: 'Ship a documented API with authentication, tests, and a deployed PostgreSQL database.',
  },
  'power bi': {
    goal: 'Learn data modelling, DAX, report design, and how to communicate a business decision.',
    project: 'Build a three-page dashboard with a clean model, measures, and an executive summary.',
  },
  'machine learning': {
    goal: 'Study evaluation, leakage, baselines, feature preparation, and responsible model use.',
    project: 'Train a small baseline model, compare metrics, and write a short model card.',
  },
  docker: {
    goal: 'Understand images, containers, volumes, networking, and production-safe configuration.',
    project: 'Containerize one portfolio API and run it with its database using Compose.',
  },
  cloud: {
    goal: 'Learn identity, networking, compute, storage, monitoring, cost, and shared responsibility.',
    project: 'Deploy one small service with logs, health checks, least-privilege access, and a cost note.',
  },
}

const skillAliases = new Map([
  ['node', 'node.js'], ['nodejs', 'node.js'], ['rest', 'apis'], ['rest api', 'apis'], ['restful api', 'apis'],
  ['postgres', 'sql'], ['postgresql', 'sql'], ['mysql', 'sql'], ['js', 'javascript'], ['ts', 'typescript'],
  ['powerbi', 'power bi'], ['continuous integration', 'ci cd'], ['continuous delivery', 'ci cd'],
])

function canonicalSkillKey(skill) {
  const normalized = key(skill)
  return skillAliases.get(normalized) || normalized
}

function studyPlan(skill, demand, applicationsCount) {
  const plan = skillStudyPlans[canonicalSkillKey(skill)] || {
    goal: `Learn the core concepts of ${skill}, then practise the parts used in your target roles.`,
    project: `Build one small ${skill} project that demonstrates a clear problem, your decisions, and a measurable outcome.`,
  }
  return {
    ...plan,
    reason: applicationsCount
      ? `${skill} appears in ${demand} signal${demand === 1 ? '' : 's'} from jobs you are targeting but is not evidenced in your CV.`
      : `${skill} is expected for your selected target role but is not evidenced in your CV.`,
  }
}

export function learningResources(skill) {
  const normalized = key(skill)
  const exact = learningResourceCatalog[normalized]
  const resources = exact || [
    ['GeeksforGeeks', `Find ${clean(skill)} tutorials`, `https://www.geeksforgeeks.org/?s=${encodeURIComponent(clean(skill))}`],
    ['DataCamp', `Find ${clean(skill)} courses`, `https://www.datacamp.com/search?q=${encodeURIComponent(clean(skill))}`],
  ]
  return resources.map(([provider, title, url]) => ({ provider, title, url }))
}

function demandSkills(applications, roles) {
  const counts = new Map()
  for (const app of applications) {
    for (const skill of unique([...(app.job?.tags || []), ...(app.missingSkills || [])])) {
      const normalized = key(skill)
      const current = counts.get(normalized) || { skill: clean(skill), demand: 0, sources: new Set() }
      current.demand += 1
      if (app.job?.company) current.sources.add(app.job.company)
      counts.set(normalized, current)
    }
  }
  for (const role of roles || []) {
    for (const [pattern, skills] of roleSkillHints) {
      if (!pattern.test(role)) continue
      for (const skill of skills) {
        const normalized = key(skill)
        if (!counts.has(normalized)) counts.set(normalized, { skill, demand: 1, sources: new Set(['target role']) })
      }
    }
  }
  return [...counts.values()].map(item => ({ ...item, sources: [...item.sources] }))
}

function learningStep(skill, index, achieved = false) {
  const phase = index < 2 ? 'Learn' : index < 4 ? 'Build' : 'Prove'
  const week = index < 2 ? 'Week 1' : index < 4 ? 'Weeks 2–3' : 'Week 4'
  const action = phase === 'Learn'
    ? `Complete the fundamentals of ${skill} and write a one-page cheat sheet.`
    : phase === 'Build'
      ? `Use ${skill} in one small role-relevant project with a measurable outcome.`
      : `Add ${skill} evidence to your resume, portfolio, and one interview story.`
  return { phase, week, skill, action, achieved, resources: learningResources(skill) }
}

export function buildSkillGap({ applications = [], resume = null, profile = null, roles = [], skillAchievements = {} } = {}) {
  const ownedSkills = unique([...(resume?.profile?.skills || []), ...(profile?.skills || [])])
  const ownedKeys = new Set(ownedSkills.map(canonicalSkillKey))
  const achievedKeys = new Set(Object.entries(skillAchievements || {}).filter(([, value]) => Boolean(value)).map(([skill]) => canonicalSkillKey(skill)))
  const demand = demandSkills(applications, roles).sort((a, b) => b.demand - a.demand || a.skill.localeCompare(b.skill))
  const matched = demand.filter(item => ownedKeys.has(canonicalSkillKey(item.skill)) || achievedKeys.has(canonicalSkillKey(item.skill)))
  const gaps = demand.filter(item => !ownedKeys.has(canonicalSkillKey(item.skill))).slice(0, 8).map((item, index) => ({
    skill: item.skill,
    demand: item.demand,
    priority: index < 2 ? 'High' : index < 5 ? 'Medium' : 'Explore',
    evidence: item.sources.slice(0, 3),
    achieved: achievedKeys.has(canonicalSkillKey(item.skill)),
    resources: learningResources(item.skill),
    ...studyPlan(item.skill, item.demand, applications.length),
  }))
  const coverage = demand.length ? percent(matched.length, demand.length) : 0

  return {
    targetRoles: roles,
    ownedSkills,
    matchedSkills: matched.map(item => item.skill),
    cvSkillCount: ownedSkills.length,
    demandSkillCount: demand.length,
    achievedSkills: gaps.filter(item => item.achieved).map(item => item.skill),
    gaps,
    coverage,
    learningPath: gaps.slice(0, 6).map((gap, index) => learningStep(gap.skill, index, gap.achieved)),
    readiness: coverage >= 75 ? 'Strong' : coverage >= 45 ? 'Developing' : 'Early',
    dataNote: applications.length
      ? `Demand is inferred from ${applications.length} job${applications.length === 1 ? '' : 's'} in your pipeline and your target roles.`
      : 'Demand is inferred from your target roles. Add jobs to make the analysis more specific.',
  }
}

export function buildInterviewQuestions({ job = {}, prep = null } = {}) {
  const title = clean(job.title) || 'your target role'
  const company = clean(job.company) || 'the company'
  const skills = unique(job.tags || []).slice(0, 4)
  const skill = skills[0] || 'a core skill for this role'
  const secondSkill = skills[1] || 'the team’s stack'
  const generated = [
    { type: 'opening', prompt: `Give me your 90-second introduction for the ${title} role at ${company}.`, focus: ['motivation', title] },
    { type: 'behavioral', prompt: 'Tell me about a difficult project. What was your specific responsibility, and what changed because of your work?', focus: ['situation', 'action', 'result'] },
    { type: 'technical', prompt: `Describe a project where you used ${skill}. What trade-off did you make, and why?`, focus: [skill, 'trade-off', 'result'] },
    { type: 'problem-solving', prompt: `A production issue affects users in a system using ${secondSkill}. Walk me through your first 30 minutes.`, focus: [secondSkill, 'diagnosis', 'communication'] },
    { type: 'closing', prompt: `Why this ${title} role, and what would you aim to accomplish in your first 90 days?`, focus: [title, 'impact', '90 days'] },
  ]
  const prepQuestions = [...(prep?.technicalQuestions || []), ...(prep?.behavioralQuestions || [])]
  for (let index = 0; index < Math.min(2, prepQuestions.length); index += 1) {
    generated[2 + index] = { ...generated[2 + index], prompt: prepQuestions[index] }
  }
  return generated.map((question, index) => ({ id: `q${index + 1}`, ...question }))
}

function containsAny(text, values) {
  const normalized = key(text)
  return values.some(value => normalized.includes(key(value)))
}

export function evaluateInterviewAnswer(answer, question = {}) {
  const text = clean(answer)
  const words = text.split(/\s+/).filter(Boolean)
  const hasEvidence = /\b\d+(?:\.\d+)?%?|increased|reduced|saved|improved|grew|delivered|launched|users|customers\b/i.test(text)
  const hasStructure = /\b(situation|task|action|result|first|then|finally|because|so that)\b/i.test(text)
  const focusHits = (question.focus || []).filter(item => containsAny(text, [item])).length

  const clarity = Math.min(100, 30 + Math.min(words.length, 90) * 0.65 + (words.length <= 180 ? 12 : 0))
  const evidence = Math.min(100, 30 + (hasEvidence ? 45 : 0) + (words.length >= 45 ? 15 : 0))
  const relevance = Math.min(100, 35 + focusHits * 22 + (words.length >= 30 ? 12 : 0))
  const structure = Math.min(100, 35 + (hasStructure ? 40 : 0) + (words.length >= 50 ? 15 : 0))
  const scores = {
    clarity: Math.round(clarity),
    evidence: Math.round(evidence),
    relevance: Math.round(relevance),
    structure: Math.round(structure),
  }
  const overall = Math.round(Object.values(scores).reduce((sum, score) => sum + score, 0) / 4)
  const strengths = []
  const improvements = []
  if (words.length >= 45) strengths.push('Enough detail to evaluate your contribution.')
  else improvements.push('Add one concrete example; aim for 45–120 words.')
  if (hasEvidence) strengths.push('Uses evidence or an outcome instead of only describing duties.')
  else improvements.push('Add a number, before/after result, or observable outcome.')
  if (hasStructure) strengths.push('The answer has a visible sequence or cause-and-effect structure.')
  else improvements.push('Use a simple Situation → Action → Result structure.')
  if (focusHits) strengths.push('Connects the answer to the role or question focus.')
  else improvements.push(`Tie the story back to ${(question.focus || []).slice(0, 2).join(' and ') || 'the role'}.`)

  return {
    overall,
    scores,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    coachNote: overall >= 80
      ? 'Strong answer. Make the final sentence explicitly connect your result to this role.'
      : overall >= 60
        ? 'Good raw material. Tighten the structure and make your personal contribution unmistakable.'
        : 'Build this around one real story, then state your action and result in plain language.',
    wordCount: words.length,
  }
}

export function summarizeInterviewSession(session) {
  const scores = (session.responses || []).map(response => response.feedback?.overall).filter(Number.isFinite)
  const averageScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0
  return { ...session, averageScore }
}

export function publicInterviewSession(session) {
  if (!session) return null
  return summarizeInterviewSession({
    id: session.id,
    applicationId: session.applicationId,
    role: session.role,
    company: session.company,
    questions: session.questions,
    responses: session.responses,
    currentIndex: session.currentIndex,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
  })
}
