import { z } from 'zod'

const cleanString = (max) => z.string().trim().max(max)
const requiredString = (max) => cleanString(max).min(1)
const email = z.string().trim().email().max(254).transform(value => value.toLowerCase())
const password = z.string().min(8).max(128)
const identifier = requiredString(160)
const optionalEmail = z.union([z.literal(''), email]).default('')
const optionalHttpUrl = cleanString(500).refine((value) => {
  if (!value) return true
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}, 'Enter a valid HTTP or HTTPS URL')

export const registerBodySchema = z.object({
  name: requiredString(120),
  email,
  password,
  acceptedTerms: z.literal(true),
  role: z.preprocess(value => ['client', 'employer'].includes(value) ? value : undefined, z.enum(['client', 'employer']).optional()),
  companyName: cleanString(160).optional().default(''),
  companyWebsite: optionalHttpUrl.optional().default(''),
})

export const loginBodySchema = z.object({
  email,
  password: z.string().min(1).max(128),
  role: z.enum(['client', 'employer', 'owner']).default('client'),
  captchaChallengeId: cleanString(160).optional().default(''),
  captchaAnswer: cleanString(40).optional().default(''),
})

export const twoFactorBodySchema = z.object({
  challengeId: identifier,
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the six-digit verification code'),
})

export const tokenBodySchema = z.object({
  token: z.string().trim().min(20).max(512),
})

export const emailBodySchema = z.object({ email })

export const resetPasswordBodySchema = z.object({
  token: z.string().trim().min(20).max(512),
  password,
})

export const supportBodySchema = z.object({
  type: z.enum(['support', 'bug', 'billing', 'privacy']).default('support'),
  name: cleanString(120).optional().default(''),
  email: optionalEmail,
  subject: cleanString(180).optional().default(''),
  message: cleanString(5000).min(10),
  pageUrl: optionalHttpUrl.optional().default(''),
})

export const clientUpdateBodySchema = z.object({
  title: requiredString(180),
  summary: requiredString(3000),
  changes: z.union([
    z.array(cleanString(600)).max(20),
    cleanString(10_000),
  ]).default([]),
  actionUrl: optionalHttpUrl.optional().default(''),
  targetUserIds: z.array(identifier).max(500).default([]),
  activeSessionOnly: z.boolean().default(false),
  force: z.boolean().default(false),
  personalize: z.boolean().default(true),
})

export const forceBodySchema = z.object({ force: z.boolean().default(false) })

const shortList = z.array(cleanString(120).min(1)).max(50)

export const settingsBodySchema = z.object({
  user: z.object({
    name: cleanString(120).optional(),
    email: email.optional(),
    phone: cleanString(40).optional(),
    location: cleanString(160).optional(),
    preferences: z.object({
      roles: shortList.optional(),
      locations: shortList.optional(),
      jobTypes: shortList.optional(),
      minSalary: z.number().finite().min(0).max(10_000_000).optional(),
      experienceLevel: cleanString(120).optional(),
      remotePreference: z.enum(['any', 'remote', 'hybrid', 'onsite']).optional(),
      salaryCurrency: cleanString(5).regex(/^[A-Za-z]{3,5}$/).transform(value => value.toUpperCase()).optional(),
      dailySendLimit: z.number().int().min(1).max(100).optional(),
      quietHoursEnabled: z.boolean().optional(),
      quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      timezone: cleanString(80).optional(),
      ghostingApplicationDays: z.number().int().min(3).max(30).optional(),
      ghostingInterviewDays: z.number().int().min(3).max(30).optional(),
      aiTone: z.enum(['concise', 'balanced', 'warm']).optional(),
      density: z.enum(['comfortable', 'compact']).optional(),
      reducedMotion: z.boolean().optional(),
      productUpdatesOptIn: z.boolean().optional(),
      blacklist: shortList.optional(),
    }).optional(),
  }),
})

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
}).refine(value => value.currentPassword !== value.newPassword, {
  message: 'Choose a new password that is different from the current password',
  path: ['newPassword'],
})

export const deleteAccountBodySchema = z.object({ confirmation: z.literal('DELETE') })

export const idParamsSchema = z.object({ id: identifier })

export const resumeVerificationBodySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the six-digit CV verification code'),
})

export const profileImageBodySchema = z.object({
  kind: z.enum(['avatar', 'cover']).default('avatar'),
})

export const ghostingPrepareBodySchema = z.object({
  companySignal: cleanString(320).optional().default(''),
  sourceUrl: optionalHttpUrl.optional().default(''),
})

export const workflowDraftBodySchema = z.object({
  subject: requiredString(180),
  body: requiredString(6000).min(40),
})

const compensation = z.number().finite().min(0).max(100_000_000)

export const negotiationPrepareBodySchema = z.object({
  currency: cleanString(8).regex(/^[A-Za-z]{3,5}$/, 'Use a currency code such as USD or PKR').transform(value => value.toUpperCase()),
  payPeriod: z.enum(['annual', 'monthly', 'hourly']).default('annual'),
  baseSalary: compensation.positive(),
  annualBonus: compensation.optional().default(0),
  signOnBonus: compensation.optional().default(0),
  equity: cleanString(300).optional().default(''),
  benefits: cleanString(800).optional().default(''),
  deadline: cleanString(120).optional().default(''),
  notes: cleanString(1200).optional().default(''),
  marketMin: compensation.optional().default(0),
  marketMedian: compensation.optional().default(0),
  marketMax: compensation.optional().default(0),
  sourceUrl: optionalHttpUrl.optional().default(''),
}).refine(value => !value.marketMin || !value.marketMax || value.marketMin <= value.marketMax, {
  message: 'Market minimum must not exceed the market maximum',
  path: ['marketMax'],
})

export const workflowSendBodySchema = z.object({
  applicationId: identifier,
  workflow: z.enum(['ghosting', 'negotiation']),
})
