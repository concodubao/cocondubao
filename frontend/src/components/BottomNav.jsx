import { useNavigate, useLocation } from 'react-router-dom'

const TABS = [
  { path: '/home',          icon: 'home',         label: 'Trang chủ' },
  { path: '/chat',          icon: 'chat_bubble',  label: 'Trò chuyện' },
  { path: '/notifications', icon: 'notifications', label: 'Thông báo' },
  { path: '/profile',       icon: 'person',       label: 'Cá nhân' },
]

export default function BottomNav({ unreadCount = 0 }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  function isActive(path) {
    if (path === '/chat') return pathname.startsWith('/chat')
    if (path === '/notifications') return pathname.startsWith('/notifications')
    return pathname === path
  }

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white z-50
                 flex justify-around items-center h-20 px-2
                 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] rounded-t-2xl"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      {TABS.map(tab => {
        const active = isActive(tab.path)
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all
              ${active
                ? 'bg-[#f0fdf4] text-[#006b2c]'
                : 'text-[#6e7b6c] hover:bg-[#f8f9ff]'
              }`}
            style={{ minWidth: 64 }}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
          >
            {/* Notification badge */}
            <div className="relative">
              <span
                className="material-symbols-outlined text-[24px]"
                style={active ? { fontVariationSettings: "'FILL' 1, 'wght' 400" } : {}}
              >
                {tab.icon}
              </span>
              {tab.icon === 'notifications' && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#EF4444] rounded-full
                                 flex items-center justify-center text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span className="text-[11px] font-semibold tracking-wide">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
