import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import { pushAPI } from '../services/api'
import { usePush } from '../hooks/usePush'
import { MessageCircle, Bell, ClipboardList, BarChart2, User, LogOut, AlertTriangle, Leaf, ChevronRight } from 'lucide-react'

function AlertBanner({ notifications }) {
  const alert = notifications?.find(n => n.type === 'alert' && !n.is_read)
  if (!alert) return null
  return (
    <div style={styles.alertBanner} role="alert" aria-live="polite" className="fade-up">
      <div style={styles.alertIcon}>
        <AlertTriangle size={16} color="#b91c1c" strokeWidth={2.5} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#7f1d1d', lineHeight: 1.3 }}>{alert.title}</div>
        <div style={{ fontSize: 12, color: '#991b1b', marginTop: 2, lineHeight: 1.4 }}>
          {alert.body.slice(0, 90)}{alert.body.length > 90 ? '...' : ''}
        </div>
      </div>
    </div>
  )
}

function PushBanner({ permission, isSubscribed, pushError, subscribe }) {
  if (permission === 'granted' && isSubscribed) return null

  if (permission === 'denied') {
    return (
      <div style={{ ...styles.pushBanner, background: '#fef2f2', borderColor: '#fecaca' }}>
        <Bell size={16} color="#ef4444" strokeWidth={2} />
        <p style={styles.pushBannerText}>Thông báo đang bị chặn — vào Cài đặt trình duyệt để bật lại</p>
      </div>
    )
  }

  return (
    <div style={styles.pushBanner}>
      <Bell size={16} color="#16a34a" strokeWidth={2} />
      <p style={styles.pushBannerText}>
        {pushError ? pushError : 'Bật thông báo để nhận cảnh báo kịp thời'}
      </p>
      <button onClick={subscribe} style={styles.pushBannerBtn}>
        {pushError ? 'Thử lại' : 'Bật'}
      </button>
    </div>
  )
}

function ActionCard({ icon, title, desc, badge, onClick, delay = 0 }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.btnBig,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.10)' : styles.btnBig.boxShadow,
        animationDelay: `${delay}s`,
      }}
      className="fade-up"
    >
      <div style={icon.wrap}>
        {icon.node}
      </div>
      <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
        <div style={styles.btnTitle}>
          {title}
          {badge != null && badge > 0 && (
            <span style={styles.badge} aria-label={`${badge} chưa đọc`}>
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        <div style={styles.btnDesc}>{desc}</div>
      </div>
      <ChevronRight size={18} color="#cbd5e1" strokeWidth={2} flexShrink={0} />
    </button>
  )
}

export default function Home() {
  const navigate         = useNavigate()
  const { user, logout } = useAuthStore()
  const { permission, isSubscribed, error: pushError, subscribe } = usePush(user?.id)

  useEffect(() => {
    if (permission === 'granted' && !isSubscribed && user?.id) subscribe()
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
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoMark}>
            <Leaf size={22} color="#fff" strokeWidth={1.5} />
          </div>
          <div>
            <div style={styles.appName}>Cò Con Dự Báo</div>
            <div style={styles.greeting}>{greeting}{user?.name ? `, ${user.name}` : ''}</div>
          </div>
        </div>
        <button onClick={() => navigate('/profile')} style={styles.avatarBtn} aria-label="Hồ sơ cá nhân">
          <User size={17} color="#fff" strokeWidth={2} />
        </button>
      </header>

      <AlertBanner notifications={notifications} />
      <PushBanner
        permission={permission} isSubscribed={isSubscribed}
        pushError={pushError} subscribe={subscribe}
      />

      {/* Main actions */}
      <main style={styles.main}>
        <p style={styles.mainLabel}>Bạn muốn làm gì hôm nay?</p>

        <ActionCard
          delay={0.05}
          onClick={() => navigate('/chat')}
          icon={{
            wrap: { ...styles.btnIconWrap, background: '#f0fdf4' },
            node: <MessageCircle size={28} color="#16a34a" strokeWidth={1.5} />,
          }}
          title="Hỏi Cò Con"
          desc="Hỏi về sâu bệnh, thời vụ, phân bón"
        />

        <ActionCard
          delay={0.1}
          onClick={() => navigate('/notifications')}
          icon={{
            wrap: { ...styles.btnIconWrap, background: '#fffbeb' },
            node: <Bell size={28} color="#f59e0b" strokeWidth={1.5} />,
          }}
          title="Thông Báo"
          desc="Cảnh báo dịch bệnh, khuyến mãi vật tư"
          badge={unreadCount}
        />
      </main>

      {/* Quick nav for engineer / admin */}
      {(user?.role === 'engineer' || user?.role === 'admin') && (
        <nav style={styles.quickNav} aria-label="Menu kỹ sư / admin">
          {user.role === 'engineer' && (
            <button onClick={() => navigate('/engineer/queue')} style={styles.quickBtn}>
              <ClipboardList size={15} color="#16a34a" strokeWidth={2} />
              Hàng đợi câu hỏi
            </button>
          )}
          {user.role === 'admin' && (
            <button onClick={() => navigate('/admin')} style={styles.quickBtn}>
              <BarChart2 size={15} color="#16a34a" strokeWidth={2} />
              Dashboard quản trị
            </button>
          )}
        </nav>
      )}

      {/* Footer */}
      <footer style={styles.footer}>
        <button onClick={logout} style={styles.logoutBtn}>
          <LogOut size={14} color="#94a3b8" strokeWidth={2} />
          Đăng xuất
        </button>
      </footer>
    </div>
  )
}

const styles = {
  page:       { height: '100dvh', background: '#f8fafc', display: 'flex', flexDirection: 'column', fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: '0 auto' },
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  logoMark:   { width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(22,163,74,0.3)', flexShrink: 0 },
  appName:    { fontSize: 17, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 },
  greeting:   { fontSize: 12, color: '#64748b', marginTop: 2 },
  avatarBtn:  { width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#16a34a,#15803d)', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(22,163,74,0.25)' },
  alertBanner:{ margin: '0 16px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', borderLeft: '3px solid #ef4444' },
  alertIcon:  { width: 30, height: 30, borderRadius: 8, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  main:       { padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 },
  mainLabel:  { fontSize: 13, color: '#94a3b8', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' },
  btnBig:     { display: 'flex', alignItems: 'center', gap: 16, padding: '20px 18px', background: '#fff', border: '1px solid #f1f5f9', borderRadius: 20, cursor: 'pointer', minHeight: 88, width: '100%', textAlign: 'left', flex: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.15s ease' },
  btnIconWrap:{ width: 60, height: 60, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  btnTitle:   { fontSize: 19, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  btnDesc:    { fontSize: 13, color: '#64748b', lineHeight: 1.5 },
  badge:      { background: '#ef4444', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 700, padding: '2px 7px', display: 'inline-block' },
  quickNav:   { padding: '0 16px 8px', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  quickBtn:   { padding: '10px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#16a34a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, minHeight: 38 },
  footer:     { padding: '8px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'center' },
  logoutBtn:  { background: 'transparent', border: 'none', fontSize: 13, color: '#94a3b8', cursor: 'pointer', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Noto Sans', sans-serif" },
  pushBanner: { margin: '0 16px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 },
  pushBannerText: { flex: 1, fontSize: 13, color: '#0f172a', margin: 0 },
  pushBannerBtn:  { padding: '6px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' },
}
