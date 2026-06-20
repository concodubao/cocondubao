// SW dùng cho DEV (vite-plugin-pwa không bật service worker ở chế độ dev).
// Ở PRODUCTION, vite-plugin-pwa sinh sw.js bằng workbox (precache app shell +
// offline + runtime caching cho API/ảnh/fonts) và importScripts '/push-sw.js' để
// có cùng logic thông báo đẩy. File này chỉ giữ tối thiểu cho dev: nạp push
// handler dùng chung và kích hoạt ngay.
importScripts('/push-sw.js')

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
