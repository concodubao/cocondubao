import { useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import { pushAPI } from '../services/api'
import { usePush } from '../hooks/usePush'
import { MessageCircle, Bell, ClipboardList, BarChart2, User, LogOut, AlertTriangle } from 'lucide-react'

function AlertBanner({ notifications }) {
  const alert = notifications?.find(n => n.type === 'alert' && !n.is_read)
  if (!alert) return null
  return (
    <div style={styles.alertBanner} role="alert" aria-live="polite">
      <AlertTriangle size={20} color="#b91c1c" strokeWidth={2} />
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#7f1d1d' }}>{alert.title}</div>
        <div style={{ fontSize: 13, color: '#991b1b', marginTop: 2 }}>
          {alert.body.slice(0, 80)}{alert.body.length > 80 ? '...' : ''}
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const navigate         = useNavigate()
  const { user, logout } = useAuthStore()
  const { permission, isSubscribed, error: pushError, subscribe } = usePush(user?.id)

  // Tự subscribe nếu user đã cấp quyền từ trước (ví dụ reload trang)
  useEffect(() => {
    if (permission === 'granted' && !isSubscribed && user?.id) {
      subscribe()
    }
  }, [permission, isSubscribed, user?.id])

  const { data } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn:  () => pushAPI.getNotifications(user.id).then(r => r.data.notifications),
    enabled:  !!user?.id,
    staleTime: 60_000,
  })

  if (user?.role === 'farmer' && !user.name) {
    return <Navigate to="/profile?onboard=true" replace />
  }

  const notifications = data || []
  const unreadCount   = notifications.filter(n => !n.is_read).length

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoMark}>C</div>
          <div>
            <div style={styles.appName}>Cò Con Dự Báo</div>
            <div style={styles.greeting}>{greeting}{user?.name ? `, ${user.name}` : ''}</div>
          </div>
        </div>
        <button onClick={() => navigate('/profile')} style={styles.avatarBtn} aria-label="Hồ sơ cá nhân">
          <User size={18} color="#fff" strokeWidth={2} />
        </button>
      </header>

      <AlertBanner notifications={notifications} />

      {permission === 'denied' ? (
        <div style={{ ...styles.pushBanner, background: '#fef2f2', border: '1px solid #fecaca' }}>
          <Bell size={18} color="#ef4444" strokeWidth={2} />
          <p style={styles.pushBannerText}>Thông báo đang bị chặn — vào Cài đặt trình duyệt để bật lại</p>
        </div>
      ) : !isSubscribed ? (
        <div style={styles.pushBanner}>
          <Bell size={18} color="#16a34a" strokeWidth={2} />
          <p style={styles.pushBannerText}>
            {pushError ? pushError : 'Bật thông báo để nhận cảnh báo kịp thời'}
          </p>
          <button onClick={subscribe} style={styles.pushBannerBtn}>
            {pushError ? 'Thử lại' : 'Bật'}
          </button>
        </div>
      ) : null}

      <main style={styles.main}>
        <p style={styles.mainLabel}>Bạn muốn làm gì hôm nay?</p>

        <button onClick={() => navigate('/chat')} style={styles.btnBig} aria-label="Hỏi Cò Con">
          <div style={{ ...styles.btnIconWrap, background: '#f0fdf4' }}>
            <MessageCircle size={28} color="#16a34a" strokeWidth={1.5} />
          </div>
          <div>
            <div style={styles.btnTitle}>Hỏi Cò Con</div>
            <div style={styles.btnDesc}>Hỏi về sâu bệnh, thời vụ, phân bón</div>
          </div>
        </button>

        <button onClick={() => navigate('/notifications')} style={styles.btnBig}
          aria-label={`Thông báo — ${unreadCount} chưa đọc`}>
          <div style={{ ...styles.btnIconWrap, background: '#fffbeb' }}>
            <Bell size={28} color="#f59e0b" strokeWidth={1.5} />
          </div>
          <div style={{ position: 'relative', flex: 1 }}>
            <div style={styles.btnTitle}>
              Thông Báo
              {unreadCount > 0 && (
                <span style={styles.badge} aria-label={`${unreadCount} chưa đọc`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <div style={styles.btnDesc}>Cảnh báo dịch bệnh, khuyến mãi vật tư</div>
          </div>
        </button>
      </main>

      {(user?.role === 'engineer' || user?.role === 'admin') && (
        <nav style={styles.quickNav} aria-label="Menu kỹ sư / admin">
          {user.role === 'engineer' && (
            <button onClick={() => navigate('/engineer/queue')} style={styles.quickBtn}>
              <ClipboardList size={16} color="#16a34a" strokeWidth={2} />
              Hàng đợi câu hỏi
            </button>
          )}
          {user.role === 'admin' && (
            <button onClick={() => navigate('/admin')} style={styles.quickBtn}>
              <BarChart2 size={16} color="#16a34a" strokeWidth={2} />
              Dashboard
            </button>
          )}
        </nav>
      )}

      <footer style={styles.footer}>
        <button onClick={logout} style={styles.logoutBtn}>
          <LogOut size={15} color="#94a3b8" strokeWidth={2} />
          Đăng xuất
        </button>
      </footer>
    </div>
  )
}

const styles = {
  page:      { height: '100dvh', background: '#f8fafc', display: 'flex', flexDirection: 'column', fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: '0 auto' },
  header:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px' },
  headerLeft:{ display: 'flex', alignItems: 'center', gap: 12 },
  logoMark:  { width: 44, height: 44, borderRadius: 12, background: '#16a34a', color: '#fff', fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  appName:   { fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 },
  greeting:  { fontSize: 13, color: '#64748b', marginTop: 2 },
  avatarBtn: { width: 40, height: 40, borderRadius: '50%', background: '#16a34a', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  alertBanner: { margin: '0 16px 8px', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' },
  main:      { padding: '12px 16px 8px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 },
  mainLabel: { fontSize: 15, color: '#64748b', margin: 0, fontWeight: 500 },
  btnBig:    { display: 'flex', alignItems: 'center', gap: 16, padding: '20px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, cursor: 'pointer', minHeight: 88, width: '100%', textAlign: 'left', flex: 1 },
  btnIconWrap:{ width: 60, height: 60, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  btnTitle:  { fontSize: 20, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 },
  btnDesc:   { fontSize: 14, color: '#64748b', marginTop: 5, lineHeight: 1.5 },
  badge:     { background: '#ef4444', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 700, padding: '2px 7px', display: 'inline-block' },
  quickNav:  { padding: '4px 16px 0', display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  quickBtn:  { padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#16a34a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, minHeight: 40 },
  footer:    { padding: '8px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'center' },
  logoutBtn:      { background: 'transparent', border: 'none', fontSize: 14, color: '#94a3b8', cursor: 'pointer', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 },
  pushBanner:     { margin: '8px 16px 0', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 },
  pushBannerText: { flex: 1, fontSize: 13, color: '#0f172a', margin: 0 },
  pushBannerBtn:  { padding: '6px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' },
}
