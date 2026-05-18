import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { ClipboardList, BookOpen, BarChart2, Users, Send, AlertTriangle, Home, LogOut } from 'lucide-react'

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768)
  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return isDesktop
}

const ENGINEER_NAV = [
  { path: '/engineer/queue',     Icon: ClipboardList, label: 'Hàng đợi' },
  { path: '/engineer/knowledge', Icon: BookOpen,      label: 'Kho tri thức' },
]

const ADMIN_NAV = [
  { path: '/admin',                    Icon: BarChart2,     label: 'Dashboard',    exact: true },
  { path: '/admin/users',              Icon: Users,         label: 'Quản lý user' },
  { path: '/admin/notifications/send', Icon: Send,          label: 'Gửi thông báo' },
  { path: '/admin/ai-errors',          Icon: AlertTriangle, label: 'Báo lỗi AI' },
]

export default function DesktopLayout({ children }) {
  const isDesktop = useIsDesktop()
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, logout } = useAuthStore()

  if (!isDesktop) return children

  const nav = user?.role === 'admin' ? ADMIN_NAV : ENGINEER_NAV

  function isActive(item) {
    if (item.exact) return location.pathname === item.path
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  }

  return (
    <div style={s.wrapper}>
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <div style={s.logoMark}>C</div>
          <div>
            <div style={s.logoTitle}>Cò Con</div>
            <div style={s.logoRole}>
              {user?.role === 'admin' ? 'Quản trị viên' : 'Kỹ sư nông nghiệp'}
            </div>
          </div>
        </div>

        <nav style={s.nav}>
          {nav.map(item => {
            const active = isActive(item)
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                style={{ ...s.navBtn, background: active ? '#f0fdf4' : 'transparent', color: active ? '#16a34a' : '#64748b', fontWeight: active ? 700 : 400 }}>
                <item.Icon size={18} strokeWidth={active ? 2.5 : 1.5} />
                {item.label}
              </button>
            )
          })}

          <div style={s.divider} />

          <button onClick={() => navigate('/home')} style={{ ...s.navBtn, color: '#94a3b8' }}>
            <Home size={18} strokeWidth={1.5} />
            Trang chủ
          </button>
        </nav>

        <div style={s.footer}>
          <div style={s.footerName}>{user?.name || user?.phone}</div>
          <button onClick={() => { logout(); navigate('/login') }} style={s.logoutBtn}>
            <LogOut size={13} strokeWidth={2} />
            Đăng xuất
          </button>
        </div>
      </aside>

      <main style={s.main}>
        {children}
      </main>
    </div>
  )
}

const s = {
  wrapper:   { display: 'flex', minHeight: '100dvh', fontFamily: "'Noto Sans', sans-serif", background: '#f8fafc' },
  sidebar:   { width: 220, background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100dvh', flexShrink: 0 },
  logo:      { display: 'flex', alignItems: 'center', gap: 10, padding: '18px 16px 16px', borderBottom: '1px solid #e2e8f0' },
  logoMark:  { width: 36, height: 36, borderRadius: 10, background: '#16a34a', color: '#fff', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logoTitle: { fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 },
  logoRole:  { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  nav:       { flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 },
  navBtn:    { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', fontSize: 14, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s' },
  divider:   { height: 1, background: '#e2e8f0', margin: '8px 4px' },
  footer:    { padding: '12px 16px', borderTop: '1px solid #e2e8f0' },
  footerName:{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  logoutBtn: { fontSize: 13, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5 },
  main:      { flex: 1, overflow: 'auto', minWidth: 0 },
}
