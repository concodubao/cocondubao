self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Cò Con Dự Báo!', {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      image: data.image,
      data: { url: data.url || '/' },
      actions: [
        { action: 'open', title: '📖 Xem chi tiết' },
        { action: 'ask', title: '🐦 Hỏi Cò Con' }
      ]
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.action === 'ask' ? '/chat' : event.notification.data.url
  event.waitUntil(clients.openWindow(url))
})