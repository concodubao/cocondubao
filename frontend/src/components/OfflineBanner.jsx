import { useState, useEffect } from 'react'

// Banner cố định trên cùng khi mất mạng — vùng quê sóng yếu, nông dân cần biết
// vì sao gửi câu hỏi không được.
export default function OfflineBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)

  useEffect(() => {
    const goOnline  = () => setOffline(false)
    const goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (!offline) return null

  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: '#7f1d1d', color: '#fff', fontFamily: "'Noto Sans', sans-serif",
      fontSize: 13, fontWeight: 600, textAlign: 'center',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      padding: '7px 12px', paddingTop: 'max(7px, env(safe-area-inset-top))',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 17 }}>wifi_off</span>
      Đang mất mạng — kiểm tra kết nối Internet
    </div>
  )
}
