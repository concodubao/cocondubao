import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

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
