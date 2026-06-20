// Push + notificationclick handlers cho Cò Con — NGUỒN DUY NHẤT.
// Dùng chung cho:
//   - SW production: workbox (vite-plugin-pwa, generateSW) importScripts file này
//     qua cấu hình workbox.importScripts trong vite.config.js. Workbox đã lo
//     skipWaiting/clientsClaim + precache/offline + runtime caching, nên file này
//     CHỈ chứa logic thông báo đẩy.
//   - SW dev (public/sw.js) importScripts file này.
// ⚠️ Trước đây các handler này nằm trong public/sw.js → bị workbox ghi đè khi build
//    → production không hiện thông báo đẩy. Đặt riêng + importScripts để có hiệu lực.

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const options = {
    body:  data.body || '',
    // Icon chuẩn thương hiệu (cò trong vòng tròn nâu); payload có thể override.
    icon:  data.icon  || '/cocon-icon-bg.png',
    badge: data.badge || '/cocon-icon-bg.png',
    data:  { url: data.url || '/' },
  }
  // image/actions/tag/renotify chỉ thêm nếu payload có (Android cũ tự bỏ qua)
  if (data.image)    options.image    = data.image
  if (data.actions)  options.actions  = data.actions
  if (data.tag)      options.tag      = data.tag
  if (data.renotify) options.renotify = data.renotify
  event.waitUntil(
    self.registration.showNotification(data.title || 'Cò Con Dự Báo!', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Nút "Bỏ qua" chỉ đóng thông báo, không mở app
  if (event.action === 'dismiss') return
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) {
        // Điều hướng cửa sổ đang mở tới đúng trang rồi focus (không chỉ focus)
        if ('navigate' in existing) existing.navigate(url).catch(() => {})
        return existing.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
