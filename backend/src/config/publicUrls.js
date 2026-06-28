function withoutTrailingSlash(value = '') {
  return String(value).trim().replace(/\/$/, '')
}

function railwayPublicUrl() {
  const domain = withoutTrailingSlash(process.env.RAILWAY_PUBLIC_DOMAIN)
  return domain ? `https://${domain}` : ''
}

export function publicFrontendUrl() {
  return withoutTrailingSlash(
    process.env.FRONTEND_URL ||
    process.env.APP_BASE_URL ||
    railwayPublicUrl() ||
    'http://localhost:3000'
  )
}

export function publicBackendUrl() {
  return withoutTrailingSlash(
    process.env.BACKEND_URL ||
    process.env.APP_BASE_URL ||
    railwayPublicUrl() ||
    'http://localhost:4000'
  )
}

export function publicAdminUrl() {
  return withoutTrailingSlash(
    process.env.ADMIN_URL ||
    process.env.APP_BASE_URL ||
    railwayPublicUrl() ||
    'http://localhost:3001'
  )
}
