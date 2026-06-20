self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const options = {
    body:  data.body || '',
    // Icon chuẩn thương hiệu (cò trong vòng tròn nâu); payload có thể override.
    icon:  data.icon  || '/cocon-icon-bg.png',
    badge: data.badge || '/cocon-icon-bg.png',
    data:  { url: data.url || '/' },
  }
  // badge/image/actions chỉ thêm nếu trình duyệt hỗ trợ (Android cũ bỏ qua)
  if (data.image)   options.image   = data.image
  if (data.actions) options.actions = data.actions
  if (data.tag)     options.tag     = data.tag
  if (data.renotify) options.renotify = data.renotify
  event.waitUntil(
    self.registration.showNotification(data.title || 'Cò Con Dự Báo!', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  // Nút "Bỏ qua" chỉ đóng thông báo, không mở app
  if (event.action === 'dismiss') return
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) {
        // Điều hướng cửa sổ đang mở tới đúng trang rồi focus (trước đây chỉ focus,
        // bấm thông báo về 1 trang cụ thể không nhảy tới được).
        if ('navigate' in existing) existing.navigate(url).catch(() => {})
        return existing.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
