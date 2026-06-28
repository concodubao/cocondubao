import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react"
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Chỉ bật Sentry ở PRODUCTION (khỏi nhiễu lỗi lúc dev). Bỏ Session Replay: nặng
// bundle (~270KB) cho nông dân mạng yếu + lo ngại quay phiên. DSN có thể override
// qua VITE_SENTRY_DSN; sampling 10% cho đỡ cháy quota free tier (lỗi vẫn bắt 100%).
if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN || "https://1cd6b44315e060f307d0f0a79856117a@o4511642897678336.ingest.us.sentry.io/4511642907770880",
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
  })
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err =>
    console.warn('[SW] Đăng ký thất bại:', err)
  )

  // App là SPA: chuyển trang không reload nên session cứ chạy bundle JS CŨ tới khi
  // reload thật → bản vá mới không tới máy người dùng. SW (workbox autoUpdate +
  // skipWaiting + clientsClaim) khi cập nhật sẽ chiếm quyền → 'controllerchange' →
  // reload 1 lần để nạp code mới. Cờ `refreshing` chặn lặp reload.
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
