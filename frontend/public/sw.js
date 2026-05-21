self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const options = {
    body: data.body || '',
    icon: '/favicon.svg',
    data: { url: data.url || '/' },
  }
  // badge và actions chỉ thêm nếu trình duyệt hỗ trợ (Android cũ bỏ qua)
  if (data.image) options.image = data.image
  event.waitUntil(
    self.registration.showNotification(data.title || 'Cò Con Dự Báo!', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
