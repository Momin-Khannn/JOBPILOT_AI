const CACHE_NAME = 'jobpilot-static-v201-pwa-2'

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([
      '/',
      '/login',
      '/signup',
      '/forgot-password',
      '/verify-email',
      '/support',
      '/privacy',
      '/terms',
      '/robots.txt',
      '/sitemap.xml',
      '/manifest.webmanifest',
      '/icon.svg',
      '/icon-192.png',
      '/icon-512.png',
      '/apple-touch-icon.png'
    ]))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api')) return
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/')))
    return
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()))
        return response
      })
      return cached || network
    })
  )
})
