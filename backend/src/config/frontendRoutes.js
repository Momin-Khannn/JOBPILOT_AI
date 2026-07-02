const exactClientRoutes = new Set([
  '/',
  '/login',
  '/signup',
  '/auth/google/callback',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/privacy',
  '/terms',
  '/support',
  '/dashboard',
  '/goal',
  '/jobs',
  '/resume',
  '/profile',
  '/applications',
  '/messages',
  '/career-lab',
  '/followups',
  '/inbox',
  '/gmail',
  '/whatsapp',
  '/settings',
])

export function isKnownClientRoute(pathname) {
  const normalized = pathname !== '/' ? String(pathname || '').replace(/\/+$/, '') : '/'
  return exactClientRoutes.has(normalized) || /^\/cv\/[^/]+$/.test(normalized)
}
