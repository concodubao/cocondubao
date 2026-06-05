import { useEffect, useRef } from 'react'
import { useToastStore } from '../stores/toastStore'

// `toast` helper + store đã chuyển sang stores/toastStore.js để file này
// chỉ export component (yêu cầu của react-refresh / Fast Refresh).

// ─── Config ───────────────────────────────────────────────
const CONFIG = {
  success: { bg: '#fdf6f0', border: '#f5d5b0', color: '#2e1505', dot: '#4B230A' },
  error:   { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', dot: '#ef4444' },
  info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', dot: '#3b82f6' },
  warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', dot: '#f59e0b' },
}

// ─── Single toast item ────────────────────────────────────
function ToastItem({ id, type = 'info', msg, duration = 3500 }) {
  const remove = useToastStore(s => s.remove)
  const ref    = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => {
      if (ref.current) ref.current.style.animation = 'toastOut 0.28s ease forwards'
      setTimeout(() => remove(id), 270)
    }, duration)
    return () => clearTimeout(t)
  }, [id, duration])

  const cfg = CONFIG[type] || CONFIG.info

  return (
    <div ref={ref} role="alert" aria-live="polite" style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 14,
      padding: '12px 16px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
      animation: 'toastIn 0.28s cubic-bezier(0.32,0.72,0,1) both',
      maxWidth: 340,
      width: '100%',
      cursor: 'pointer',
      userSelect: 'none',
    }} onClick={() => remove(id)}>
      {/* Dot indicator */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: cfg.dot, flexShrink: 0, marginTop: 4,
      }} />
      <p style={{ fontSize: 14, color: cfg.color, margin: 0, lineHeight: 1.5, flex: 1, fontWeight: 500 }}>
        {msg}
      </p>
    </div>
  )
}

// ─── Container ────────────────────────────────────────────
export default function ToastContainer() {
  const toasts = useToastStore(s => s.toasts)

  return (
    <div style={{
      position: 'fixed', bottom: 'max(20px, env(safe-area-inset-bottom))',
      right: 16, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
      alignItems: 'flex-end',
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem {...t} />
        </div>
      ))}
    </div>
  )
}
