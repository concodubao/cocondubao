import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.png'],
      manifest: {
        name: 'Cò Con Dự báo',
        short_name: 'CòCon',
        description: 'Trợ lý nông nghiệp thông minh',
        theme_color: '#4B230A',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon.png', sizes: 'any', type: 'image/png', purpose: 'maskable any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,png}'],
        // Nạp push/notificationclick handlers vào SW production (workbox generateSW
        // không tự có). Trước đây handler chỉ nằm ở public/sw.js → bị ghi đè khi
        // build → production không hiện thông báo đẩy.
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            // API: NetworkFirst — online lấy mới; offline/sóng yếu rơi về bản cache
            // gần nhất sau 4s thay vì treo. Giữ 1 ngày để nông dân đọc lại offline.
            urlPattern: /^https:\/\/.*\.railway\.app\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            }
          },
          {
            // Ảnh trên Supabase Storage (sâu bệnh, cộng đồng, thông báo) — bất biến
            // theo tên file nên CacheFirst, giữ 30 ngày để xem offline.
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            }
          },
          {
            // Google Fonts (Material Symbols + Noto Sans) để icon/chữ không vỡ offline
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    // Proxy để tránh CORS khi dev
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})