import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { ClipboardList, BookOpen, BarChart2, Users, Send, AlertTriangle, LogOut, FlaskConical, CloudSun, Menu, X, ShieldCheck } from 'lucide-react'

const ENGINEER_NAV = [
  { path: '/engineer/queue',     Icon: ClipboardList, label: 'Hàng đợi',     short: 'Hàng đợi' },
  { path: '/engineer/knowledge', Icon: BookOpen,      label: 'Kho tri thức', short: 'Tri thức' },
  { path: '/engineer/test-ai',   Icon: FlaskConical,  label: 'Test AI',      short: 'Test AI' },
  { path: '/weather',            Icon: CloudSun,      label: 'Thời tiết',    short: 'Thời tiết' },
  { path: '/admin/ai-review',    Icon: ShieldCheck,   label: 'Soát chất lượng AI', short: 'Soát AI' },
]

const ADMIN_NAV = [
  { path: '/admin',                    Icon: BarChart2,     label: 'Dashboard',     short: 'Tổng quan', exact: true },
  { path: '/admin/users',              Icon: Users,         label: 'Quản lý user',  short: 'Người dùng' },
  { path: '/admin/notifications/send', Icon: Send,          label: 'Gửi thông báo', short: 'Thông báo' },
  { path: '/admin/ai-errors',          Icon: AlertTriangle, label: 'Báo lỗi AI',    short: 'Lỗi AI' },
  { path: '/admin/ai-review',          Icon: ShieldCheck,   label: 'Soát chất lượng AI', short: 'Soát AI' },
  { path: '/engineer/knowledge',       Icon: BookOpen,      label: 'Kho tri thức',  short: 'Tri thức' },
  { path: '/engineer/test-ai',         Icon: FlaskConical,  label: 'Test AI',       short: 'Test AI' },
  { path: '/weather',                  Icon: CloudSun,      label: 'Thời tiết',     short: 'Thời tiết' },
]

// Trang soạn thảo có ô nhập dính đáy → ẩn thanh tab để không bị đè
function isComposerRoute(path) {
  return path.startsWith('/engineer/answer') || path === '/engineer/test-ai'
}

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
        background: active ? '#fdf6f0' : hovered ? '#fdf8f5' : 'transparent',
        color: active ? '#4B230A' : hovered ? '#374151' : '#64748b',
        fontWeight: active ? 700 : 500,
        fontFamily: "'Noto Sans', sans-serif",
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      <item.Icon size={17} strokeWidth={active ? 2.5 : 1.5}
        style={{ flexShrink: 0, color: active ? '#4B230A' : hovered ? '#374151' : '#64748b' }} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {active && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4B230A', flexShrink: 0 }} />}
    </button>
  )
}

// Tab trong thanh điều hướng đáy (mobile)
function BottomTab({ item, active, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={item.short || item.label}
      aria-current={active ? 'page' : undefined}
      style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 3,
        padding: '7px 2px', border: 'none', background: 'transparent', cursor: 'pointer',
        color: active ? '#4B230A' : '#7a6358', fontFamily: "'Noto Sans', sans-serif",
      }}
    >
      <item.Icon size={21} strokeWidth={active ? 2.4 : 1.7} />
      <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, letterSpacing: 0.1, lineHeight: 1, whiteSpace: 'nowrap' }}>
        {item.short || item.label}
      </span>
    </button>
  )
}

export default function DesktopLayout({ children }) {
  const isDesktop = useIsDesktop()
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, logout } = useAuthStore()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const nav = user?.role === 'admin' ? ADMIN_NAV : ENGINEER_NAV

  function isActive(item) {
    if (item.exact) return location.pathname === item.path
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  }

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : (user?.phone || '?').slice(-2)

  const drawer = drawerOpen && (
    <div style={s.drawerOverlay} onClick={e => e.target === e.currentTarget && setDrawerOpen(false)}>
      <aside style={s.drawerPanel}>
        <div style={s.logo}>
          <img src="/cocon-icon-bg.png" alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.logoTitle}>Cò Con</div>
            <div style={s.logoRole}>{user?.role === 'admin' ? 'Quản trị viên' : 'Kỹ sư nông nghiệp'}</div>
          </div>
          <button onClick={() => setDrawerOpen(false)} aria-label="Đóng" style={s.drawerClose}><X size={20} /></button>
        </div>
        <nav style={s.nav}>
          {nav.map(item => (
            <NavButton key={item.path} item={item} active={isActive(item)}
              onClick={() => { navigate(item.path); setDrawerOpen(false) }} />
          ))}
        </nav>
        <div style={s.footer}>
          <div style={s.userRow}>
            <div style={s.userAvatar}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.userName}>{user?.name || 'Người dùng'}</div>
              <div style={s.userSub}>{user?.phone || user?.email || ''}</div>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login') }} style={s.logoutBtn}>
            <LogOut size={13} strokeWidth={2} /> Đăng xuất
          </button>
        </div>
      </aside>
      <style>{`@keyframes drawerIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
    </div>
  )

  // ── Mobile: thanh tab điều hướng cố định ở đáy + drawer "Menu" đầy đủ ──
  if (!isDesktop) {
    const showBar  = !isComposerRoute(location.pathname)
    const barItems = nav.slice(0, 4)
    return (
      <>
        <div style={showBar ? { paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' } : undefined}>
          {children}
        </div>
        {showBar && (
          <nav style={s.bottomBar}>
            {barItems.map(item => (
              <BottomTab key={item.path} item={item} active={isActive(item)} onClick={() => navigate(item.path)} />
            ))}
            <BottomTab item={{ Icon: Menu, label: 'Menu', short: 'Menu' }} active={drawerOpen} onClick={() => setDrawerOpen(true)} />
          </nav>
        )}
        {drawer}
      </>
    )
  }

  return (
    <div style={s.wrapper}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        {/* Logo */}
        <div style={s.logo}>
          <img src="/cocon-icon-bg.png" alt="Cò Con"
               style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
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
  wrapper:   { display: 'flex', minHeight: '100dvh', fontFamily: "'Noto Sans', sans-serif", background: '#fdf8f5' },
  sidebar:   { width: 224, background: '#fff', borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100dvh', flexShrink: 0, boxShadow: '1px 0 12px rgba(0,0,0,0.04)' },
  logo:      { display: 'flex', alignItems: 'center', gap: 10, padding: '18px 16px 16px', borderBottom: '1px solid #f1f5f9' },
  logoTitle: { fontSize: 14, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 },
  logoRole:  { fontSize: 11, color: '#64748b', marginTop: 2 },
  nav:       { flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' },
  footer:    { padding: '12px 14px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 10 },
  userRow:   { display: 'flex', gap: 10, alignItems: 'center' },
  userAvatar:{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#4B230A,#2e1505)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  userName:  { fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userSub:   { fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 },
  logoutBtn: { fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'Noto Sans', sans-serif" },
  main:      { flex: 1, overflow: 'auto', minWidth: 0 },
  bottomBar:     { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 520, height: 64, background: '#fff', display: 'flex', alignItems: 'stretch', paddingBottom: 'env(safe-area-inset-bottom)', borderTop: '1px solid #f1f5f9', borderTopLeftRadius: 16, borderTopRightRadius: 16, boxShadow: '0 -4px 16px rgba(0,0,0,0.06)', zIndex: 40 },
  drawerOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex' },
  drawerPanel:   { width: 260, maxWidth: '82%', background: '#fff', height: '100dvh', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 16px rgba(0,0,0,0.15)', animation: 'drawerIn 0.22s ease' },
  drawerClose:   { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
}
