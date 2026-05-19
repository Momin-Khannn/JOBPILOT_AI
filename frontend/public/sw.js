self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('jobpilot-static-v1').then(cache => cache.addAll([
      '/',
      '/dashboard',
      '/manifest.webmanifest',
      '/icon.svg'
    ]))
  )
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  )
})
