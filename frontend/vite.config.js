import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',      // Dùng custom SW
      srcDir: 'public',
      filename: 'sw-push.js',
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Cò Con Dự Báo!',
        short_name: 'CòCon',
        description: 'Trợ lý nông nghiệp thông minh',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        // Cache trang tĩnh
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        // NetworkFirst cho API calls
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api-cocon\.railway\.app\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 }
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