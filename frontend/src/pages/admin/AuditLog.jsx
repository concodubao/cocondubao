import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminAPI } from '../../services/api'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { ChevronLeft, Lock, Unlock, UserCog, KeyRound, UserPlus, FileText } from 'lucide-react'

const ACTION = {
  lock_user:    { label: 'Khóa tài khoản', Icon: Lock,     color: '#ef4444', bg: '#fef2f2' },
  unlock_user:  { label: 'Mở khóa',         Icon: Unlock,   color: '#16a34a', bg: '#f0fdf4' },
  change_role:  { label: 'Đổi vai trò',     Icon: UserCog,  color: '#7c3aed', bg: '#f5f3ff' },
  reset_pin:    { label: 'Đặt lại PIN',     Icon: KeyRound, color: '#d97706', bg: '#fffbeb' },
  create_staff: { label: 'Tạo nhân sự',     Icon: UserPlus, color: '#0369a1', bg: '#eff6ff' },
  update_user:  { label: 'Cập nhật',        Icon: FileText, color: '#64748b', bg: '#f1f5f9' },
}

export default function AuditLog() {
  const navigate  = useNavigate()
  const isDesktop = useIsDesktop()
  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit'],
    queryFn:  () => adminAPI.getAudit().then(r => r.data),
    refetchInterval: 30_000,
  })

  const logs  = data?.logs || []
  const ready = data?.ready !== false

  return (
    <div style={s.page}>
      <header style={s.header}>
        {!isDesktop && (
          <button onClick={() => navigate('/admin')} style={s.iconBtn} aria-label="Quay lại">
            <ChevronLeft size={22} />
          </button>
        )}
        <h1 style={s.title}>Nhật ký thao tác</h1>
      </header>

      <main style={s.main} aria-live="polite" aria-busy={isLoading}>
        {!ready && (
          <div style={s.notice}>
            Bảng nhật ký chưa được tạo. Hãy chạy migration <b>20260615000000_admin_audit_log.sql</b> rồi tải lại.
          </div>
        )}

        {isLoading ? (
          <p style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>Đang tải...</p>
        ) : logs.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>
            {ready ? 'Chưa có thao tác nào được ghi lại.' : ''}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {logs.map(log => {
              const cfg = ACTION[log.action] || ACTION.update_user
              const { Icon } = cfg
              return (
                <div key={log.id} style={s.row}>
                  <div style={{ ...s.iconWrap, background: cfg.bg }}>
                    <Icon size={16} color={cfg.color} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, color: '#0f172a', margin: 0 }}>
                      <b>{log.admin_name || 'Admin'}</b> · <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                      {log.target_name ? <> → {log.target_name}</> : null}
                    </p>
                    {log.detail && <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>{log.detail}</p>}
                  </div>
                  <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>
                    {new Date(log.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

const s = {
  page:     { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fdf8f5', fontFamily: "'Noto Sans', sans-serif", maxWidth: 880, margin: '0 auto', width: '100%' },
  header:   { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' },
  iconBtn:  { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title:    { fontSize: 18, fontWeight: 800, color: '#0b1c30', margin: 0 },
  main:     { flex: 1, padding: '14px' },
  notice:   { fontSize: 13, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px', marginBottom: 12, lineHeight: 1.5 },
  row:      { display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px' },
  iconWrap: { width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
}
