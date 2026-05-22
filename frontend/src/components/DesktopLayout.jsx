import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { ClipboardList, BookOpen, BarChart2, Users, Send, AlertTriangle, Home, LogOut, FlaskConical, Leaf, ChevronRight } from 'lucide-react'

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
  { path: '/engineer/test-ai',   Icon: FlaskConical,  label: 'Test AI' },
]

const ADMIN_NAV = [
  { path: '/admin',                    Icon: BarChart2,     label: 'Dashboard',     exact: true },
  { path: '/admin/users',              Icon: Users,         label: 'Quản lý user' },
  { path: '/admin/notifications/send', Icon: Send,          label: 'Gửi thông báo' },
  { path: '/admin/ai-errors',          Icon: AlertTriangle, label: 'Báo lỗi AI' },
  { path: '/engineer/knowledge',       Icon: BookOpen,      label: 'Kho tri thức' },
  { path: '/engineer/test-ai',         Icon: FlaskConical,  label: 'Test AI' },
]

function NavButton({ item, active, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 10, border: 'none',
        fontSize: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
        background: active ? '#f0fdf4' : hovered ? '#f8fafc' : 'transparent',
        color: active ? '#16a34a' : hovered ? '#374151' : '#64748b',
        fontWeight: active ? 700 : 500,
        fontFamily: "'Noto Sans', sans-serif",
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      <item.Icon size={17} strokeWidth={active ? 2.5 : 1.5}
        style={{ flexShrink: 0, color: active ? '#16a34a' : hovered ? '#374151' : '#64748b' }} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {active && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />}
    </button>
  )
}

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

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : (user?.phone || '?').slice(-2)

  return (
    <div style={s.wrapper}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        {/* Logo */}
        <div style={s.logo}>
          <div style={s.logoMark}>
            <Leaf size={16} color="#fff" strokeWidth={1.5} />
          </div>
          <div>
            <div style={s.logoTitle}>Cò Con</div>
            <div style={s.logoRole}>
              {user?.role === 'admin' ? 'Quản trị viên' : 'Kỹ sư nông nghiệp'}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={s.nav}>
          {nav.map(item => (
            <NavButton key={item.path} item={item} active={isActive(item)}
              onClick={() => navigate(item.path)} />
          ))}

          <div style={s.divider} />

          <NavButton
            item={{ path: '/home', Icon: Home, label: 'Trang chủ' }}
            active={false}
            onClick={() => navigate('/home')}
          />
        </nav>

        {/* User footer */}
        <div style={s.footer}>
          <div style={s.userRow}>
            <div style={s.userAvatar}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.userName}>{user?.name || 'Người dùng'}</div>
              <div style={s.userSub}>{user?.phone || user?.email || ''}</div>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login') }} style={s.logoutBtn}>
            <LogOut size={13} strokeWidth={2} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={s.main}>
        {children}
      </main>
    </div>
  )
}

const s = {
  wrapper:   { display: 'flex', minHeight: '100dvh', fontFamily: "'Noto Sans', sans-serif", background: '#f8fafc' },
  sidebar:   { width: 224, background: '#fff', borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100dvh', flexShrink: 0, boxShadow: '1px 0 12px rgba(0,0,0,0.04)' },
  logo:      { display: 'flex', alignItems: 'center', gap: 10, padding: '18px 16px 16px', borderBottom: '1px solid #f1f5f9' },
  logoMark:  { width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(22,163,74,0.3)' },
  logoTitle: { fontSize: 14, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 },
  logoRole:  { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  nav:       { flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' },
  divider:   { height: 1, background: '#f1f5f9', margin: '8px 4px' },
  footer:    { padding: '12px 14px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 10 },
  userRow:   { display: 'flex', gap: 10, alignItems: 'center' },
  userAvatar:{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  userName:  { fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userSub:   { fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 },
  logoutBtn: { fontSize: 12, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'Noto Sans', sans-serif" },
  main:      { flex: 1, overflow: 'auto', minWidth: 0 },
}
