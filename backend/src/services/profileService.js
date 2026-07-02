import { v4 as uuid } from 'uuid'

const sectionNames = ['about', 'skills', 'experience', 'projects', 'education', 'certifications', 'languages']
const experienceFields = [['title', 120], ['company', 120], ['duration', 80], ['description', 900]]
const projectFields = [['name', 140], ['url', 300], ['description', 900], ['technologies', 300]]

function text(value, max = 500) {
  return String(value || '').trim().slice(0, max)
}

function textList(value, limit = 30, max = 80) {
  return (Array.isArray(value) ? value : [])
    .map(item => text(item, max))
    .filter(Boolean)
    .slice(0, limit)
}

function objectList(value, fields, limit = 12) {
  return (Array.isArray(value) ? value : [])
    .slice(0, limit)
    .map((item = {}) => Object.fromEntries(fields.map(([field, max]) => [field, text(item[field], max)])))
    .filter(item => Object.values(item).some(Boolean))
}

function importedExperience(source = {}) {
  return objectList((source.experience || []).map(item => ({
    ...item,
    description: item.description || (item.bullets || []).join(' '),
  })), experienceFields)
}

function importedProjects(source = {}) {
  return objectList(source.projects, projectFields)
}

function recordKey(parts = []) {
  return parts.map(part => text(part, 160).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).filter(Boolean).join('|')
}

function mergeLinkedRecords(existing, incoming, fields, keyFor) {
  const saved = objectList(existing, fields)
  const imported = objectList(incoming, fields)
  const savedByKey = new Map(saved.map(item => [keyFor(item), item]).filter(([key]) => key))
  const consumed = new Set()
  const merged = imported.map(item => {
    const key = keyFor(item)
    const previous = savedByKey.get(key)
    if (key) consumed.add(key)
    if (!previous) return item
    return Object.fromEntries(fields.map(([field]) => [field, item[field] || previous[field] || '']))
  })
  for (const item of saved) {
    const key = keyFor(item)
    if (!key || !consumed.has(key)) merged.push(item)
  }
  return merged.slice(0, 12)
}

function imageValue(value, max) {
  const candidate = text(value, max)
  return /^data:image\/(jpeg|png|webp|gif);base64,/i.test(candidate) ? candidate : ''
}

export function slugifyProfile(value, fallback = 'profile') {
  return text(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || fallback
}

function uniqueProfileSlug(store, preferredSlug, userId) {
  const base = slugifyProfile(preferredSlug, `profile-${String(userId || '').slice(0, 8)}`)
  const profiles = store?.profiles || []
  const exists = slug => profiles.some(item => item.userId !== userId && item.slug === slug)
  if (!exists(base)) return base

  const suffix = String(userId || '').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 6)
  const withUser = slugifyProfile(`${base}-${suffix}`, base)
  if (!exists(withUser)) return withUser

  let counter = 2
  while (exists(`${base}-${counter}`)) counter += 1
  return `${base}-${counter}`
}

export function buildProfile({ user = {}, resume = null, existing = null } = {}) {
  const source = resume?.profile || {}
  const base = existing || {}
  const displayName = text(base.displayName || source.name || user.name, 80)
  const slug = slugifyProfile(base.slug || displayName, `profile-${String(user.id || '').slice(0, 8)}`)
  const skills = textList(base.skills?.length ? base.skills : source.skills)

  return {
    id: base.id || uuid(),
    userId: user.id,
    slug,
    published: Boolean(base.published),
    displayName,
    headline: text(base.headline || source.topMatches?.[0] || 'Open to new opportunities', 120),
    about: text(base.about || source.summary, 1200),
    location: text(base.location || user.location, 120),
    contact: {
      email: text(base.contact?.email || source.email || user.email, 160),
      phone: text(base.contact?.phone || source.phone || user.phone, 40),
      website: text(base.contact?.website, 300),
      linkedin: text(base.contact?.linkedin || source.linkedIn, 300),
      github: text(base.contact?.github || source.github, 300),
    },
    images: {
      avatar: imageValue(base.images?.avatar, 4_500_000),
      cover: imageValue(base.images?.cover, 6_500_000),
    },
    skills,
    experience: base.experience?.length ? base.experience : importedExperience(source),
    education: base.education?.length ? base.education : (source.education || []),
    projects: base.projects?.length ? base.projects : importedProjects(source),
    certifications: textList(base.certifications, 20, 160),
    languages: textList(base.languages, 20, 80),
    theme: {
      accent: /^#[0-9a-f]{6}$/i.test(base.theme?.accent || '') ? base.theme.accent : '#176b55',
      template: ['modern', 'classic', 'minimal'].includes(base.theme?.template) ? base.theme.template : 'modern',
    },
    visibility: {
      email: base.visibility?.email !== false,
      phone: Boolean(base.visibility?.phone),
      location: base.visibility?.location !== false,
      website: base.visibility?.website !== false,
      linkedin: base.visibility?.linkedin !== false,
      github: base.visibility?.github !== false,
    },
    sectionOrder: Array.isArray(base.sectionOrder)
      ? [...new Set(base.sectionOrder.filter(item => sectionNames.includes(item))), ...sectionNames.filter(item => !base.sectionOrder.includes(item))]
      : sectionNames,
    sectionVisibility: Object.fromEntries(sectionNames.map(name => [name, base.sectionVisibility?.[name] !== false])),
    createdAt: base.createdAt || new Date().toISOString(),
    updatedAt: base.updatedAt || new Date().toISOString(),
  }
}

export function normalizeProfile(input = {}, context = {}) {
  const profile = buildProfile({ ...context, existing: input })
  profile.displayName = text(input.displayName || profile.displayName, 80)
  profile.slug = slugifyProfile(input.slug || profile.slug, profile.slug)
  profile.headline = text(input.headline || profile.headline, 120)
  profile.about = text(input.about, 1200)
  profile.location = text(input.location, 120)
  profile.published = Boolean(input.published)
  profile.contact = {
    email: text(input.contact?.email, 160),
    phone: text(input.contact?.phone, 40),
    website: text(input.contact?.website, 300),
    linkedin: text(input.contact?.linkedin, 300),
    github: text(input.contact?.github, 300),
  }
  profile.images = {
    avatar: imageValue(input.images?.avatar || profile.images.avatar, 4_500_000),
    cover: imageValue(input.images?.cover || profile.images.cover, 6_500_000),
  }
  profile.skills = textList(input.skills)
  profile.experience = objectList(input.experience, experienceFields)
  profile.education = objectList(input.education, [['degree', 160], ['institution', 160], ['year', 40], ['description', 500]])
  profile.projects = objectList(input.projects, projectFields)
  profile.certifications = textList(input.certifications, 20, 160)
  profile.languages = textList(input.languages, 20, 80)
  profile.theme = {
    accent: /^#[0-9a-f]{6}$/i.test(input.theme?.accent || '') ? input.theme.accent : profile.theme.accent,
    template: ['modern', 'classic', 'minimal'].includes(input.theme?.template) ? input.theme.template : profile.theme.template,
  }
  profile.visibility = {
    email: Boolean(input.visibility?.email),
    phone: Boolean(input.visibility?.phone),
    location: Boolean(input.visibility?.location),
    website: Boolean(input.visibility?.website),
    linkedin: Boolean(input.visibility?.linkedin),
    github: Boolean(input.visibility?.github),
  }
  profile.sectionOrder = Array.isArray(input.sectionOrder)
    ? [...new Set(input.sectionOrder.filter(item => sectionNames.includes(item))), ...sectionNames.filter(item => !input.sectionOrder.includes(item))]
    : profile.sectionOrder
  profile.sectionVisibility = Object.fromEntries(sectionNames.map(name => [name, input.sectionVisibility?.[name] !== false]))
  profile.updatedAt = new Date().toISOString()
  return profile
}

export function mergeResumeIntoProfile(profile, resume, user) {
  const imported = buildProfile({ user, resume, existing: profile })
  const source = resume?.profile || {}
  return {
    ...imported,
    published: profile?.published === undefined ? true : Boolean(profile.published),
    displayName: profile?.displayName || source.name || user?.name || '',
    about: profile?.about || source.summary || '',
    skills: [...new Set([...(profile?.skills || []), ...(source.skills || [])])].slice(0, 30),
    experience: mergeLinkedRecords(
      profile?.experience,
      importedExperience(source),
      experienceFields,
      item => recordKey([item.title, item.company]),
    ),
    education: profile?.education?.length ? profile.education : source.education || [],
    projects: mergeLinkedRecords(
      profile?.projects,
      importedProjects(source),
      projectFields,
      item => recordKey([item.name]),
    ),
    visibility: profile?.visibility || { ...imported.visibility, email: false, phone: false },
    updatedAt: new Date().toISOString(),
  }
}

export function syncProfileSectionsIntoResume(resume, profile) {
  if (!resume?.profile || !profile) return resume
  const experience = objectList(profile.experience, experienceFields)
  resume.profile.experience = experience.map(item => ({
    ...item,
    bullets: item.description ? [item.description] : [],
  }))
  resume.profile.projects = objectList(profile.projects, projectFields)
  resume.profile.profileSyncedAt = new Date().toISOString()
  return resume
}

export function ensureShareableProfile(store, user, { resume = null, publishNew = true, publishExisting = false } = {}) {
  if (!store || !user?.id || user.role !== 'client') return null

  store.profiles ||= []
  const index = store.profiles.findIndex(item => item.userId === user.id)
  const existing = index >= 0 ? store.profiles[index] : null
  const profile = buildProfile({ user, resume, existing })
  profile.slug = uniqueProfileSlug(store, existing?.slug || profile.slug || user.name, user.id)
  profile.published = existing ? (publishExisting ? true : Boolean(existing.published)) : Boolean(publishNew)
  profile.visibility = existing?.visibility || { ...profile.visibility, email: false, phone: false }
  profile.updatedAt = new Date().toISOString()

  if (index >= 0) store.profiles[index] = profile
  else store.profiles.push(profile)
  return profile
}

export function publicProfile(profile) {
  if (!profile?.published) return null
  return {
    ...profile,
    userId: undefined,
    contact: {
      email: profile.visibility?.email ? profile.contact?.email : '',
      phone: profile.visibility?.phone ? profile.contact?.phone : '',
      website: profile.visibility?.website ? profile.contact?.website : '',
      linkedin: profile.visibility?.linkedin ? profile.contact?.linkedin : '',
      github: profile.visibility?.github ? profile.contact?.github : '',
    },
    location: profile.visibility?.location ? profile.location : '',
  }
}
