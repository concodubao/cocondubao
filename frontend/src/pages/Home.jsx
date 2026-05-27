import { useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import { pushAPI } from '../services/api'
import { usePush } from '../hooks/usePush'
import BottomNav from '../components/BottomNav'

const ENGINEER_LINKS = [
  { path: '/engineer/queue',     icon: 'assignment',  iconBg: 'bg-[#f0fdf4]', iconColor: 'text-[#006b2c]', title: 'Hàng đợi câu hỏi',   desc: 'Xem và trả lời câu hỏi từ nông dân' },
  { path: '/engineer/knowledge', icon: 'menu_book',   iconBg: 'bg-[#e5eeff]', iconColor: 'text-[#00628d]', title: 'Kiến thức AI',        desc: 'Quản lý tài liệu và cơ sở kiến thức' },
  { path: '/engineer/test-ai',   icon: 'science',     iconBg: 'bg-[#fffbeb]', iconColor: 'text-[#855300]', title: 'Kiểm thử AI',         desc: 'Thử câu hỏi trực tiếp với mô hình AI' },
]

const ADMIN_LINKS = [
  { path: '/admin',                       icon: 'bar_chart',         iconBg: 'bg-[#f0fdf4]', iconColor: 'text-[#006b2c]', title: 'Dashboard quản trị',    desc: 'Thống kê và quản lý hệ thống' },
  { path: '/admin/users',                 icon: 'group',             iconBg: 'bg-[#e5eeff]', iconColor: 'text-[#00628d]', title: 'Quản lý người dùng',    desc: 'Xem và phân quyền tài khoản' },
  { path: '/admin/notifications/send',    icon: 'campaign',          iconBg: 'bg-[#fffbeb]', iconColor: 'text-[#855300]', title: 'Gửi thông báo',         desc: 'Đẩy thông báo đến nông dân' },
  { path: '/admin/ai-errors',             icon: 'bug_report',        iconBg: 'bg-[#fef2f2]', iconColor: 'text-[#ba1a1a]', title: 'Lỗi AI',                desc: 'Xem câu hỏi AI trả lời sai' },
]

function NavCard({ icon, iconBg, iconColor, title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 bg-white border border-[#e5eeff] rounded-3xl px-5 py-4
                 shadow-sm active:scale-[0.98] transition-transform text-left w-full"
    >
      <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <span className={`material-symbols-outlined text-[26px] ${iconColor}`}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[17px] font-bold text-[#0b1c30]">{title}</div>
        <div className="text-[13px] text-[#6e7b6c] mt-0.5">{desc}</div>
      </div>
      <span className="material-symbols-outlined text-[20px] text-[#bdcaba]">chevron_right</span>
    </button>
  )
}

function AlertBanner({ notifications }) {
  const alert = notifications?.find(n => n.type === 'alert' && !n.is_read)
  if (!alert) return null
  return (
    <div
      role="alert"
      aria-live="polite"
      className="fade-up mx-4 mb-3 flex items-start gap-3
                 bg-[#fef2f2] border border-[#fecaca] border-l-[3px] border-l-[#ef4444]
                 rounded-2xl px-4 py-3"
    >
      <div className="w-8 h-8 rounded-xl bg-[#fee2e2] flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="material-symbols-outlined text-[18px] text-[#b91c1c]">warning</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[14px] text-[#7f1d1d] leading-tight">{alert.title}</div>
        <div className="text-[12px] text-[#991b1b] mt-0.5 leading-snug">
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
      <div className="mx-4 mb-3 flex items-center gap-3 bg-[#fef2f2] border border-[#fecaca] rounded-2xl px-4 py-3">
        <span className="material-symbols-outlined text-[20px] text-[#ef4444]">notifications_off</span>
        <p className="flex-1 text-[13px] text-[#0b1c30] m-0 leading-snug">
          Thông báo đang bị chặn — vào Cài đặt trình duyệt để bật lại
        </p>
      </div>
    )
  }

  return (
    <div className="mx-4 mb-3 flex items-center gap-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl px-4 py-3">
      <span className="material-symbols-outlined text-[20px] text-[#006b2c]">notifications</span>
      <p className="flex-1 text-[13px] text-[#0b1c30] m-0 leading-snug">
        {pushError ? pushError : 'Bật thông báo để nhận cảnh báo kịp thời'}
      </p>
      <button
        onClick={subscribe}
        className="px-4 py-1.5 bg-[#006b2c] text-white text-[13px] font-bold rounded-full whitespace-nowrap"
      >
        {pushError ? 'Thử lại' : 'Bật'}
      </button>
    </div>
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
  const isFarmer = user?.role === 'farmer'

  return (
    <div className="min-h-dvh flex flex-col bg-[#f8f9ff] max-w-[480px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00873a] to-[#006b2c]
                          flex items-center justify-center shadow-[0_4px_12px_rgba(0,107,44,0.3)]
                          flex-shrink-0">
            <span className="material-symbols-outlined text-white text-[26px] ms-fill">eco</span>
          </div>
          <div>
            <div className="text-[17px] font-extrabold text-[#0b1c30] leading-tight">Cò Con Dự Báo</div>
            <div className="text-[12px] text-[#6e7b6c] mt-0.5">
              {greeting}{user?.name ? `, ${user.name}` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Bell chỉ hiện cho nông dân */}
          {isFarmer && (
            <button
              onClick={() => navigate('/notifications')}
              aria-label="Thông báo"
              className="relative w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[22px] text-[#6e7b6c]">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-[18px] h-[18px] bg-[#EF4444] rounded-full
                                 flex items-center justify-center text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => navigate('/profile')}
            aria-label="Hồ sơ"
            className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[22px] text-[#006b2c]">person</span>
          </button>
        </div>
      </header>

      {/* ── Banners ─────────────────────────────────────────────── */}
      <AlertBanner notifications={notifications} />
      <PushBanner permission={permission} isSubscribed={isSubscribed} pushError={pushError} subscribe={subscribe} />

      {/* ── Main CTA for farmers ───────────────────────────────── */}
      {isFarmer && (
        <main className="flex-1 flex flex-col items-center justify-center px-5 pb-8 gap-8">
          {/* Hero ask button */}
          <div className="flex flex-col items-center gap-4 w-full">
            <p className="text-[15px] text-[#6e7b6c] font-semibold tracking-wide">
              Hôm nay có điều gì cần hỏi?
            </p>

            {/* Big mic / ask button */}
            <button
              onClick={() => navigate('/chat')}
              aria-label="Hỏi Cò Con"
              className="relative w-36 h-36 rounded-full bg-gradient-to-br from-[#00873a] to-[#006b2c]
                         flex flex-col items-center justify-center gap-1.5
                         shadow-[0_8px_32px_rgba(0,107,44,0.4)]
                         active:scale-95 transition-transform"
            >
              {/* Pulse ring */}
              <span className="absolute inset-0 rounded-full bg-[#006b2c] opacity-30 mic-pulse" />
              <span className="material-symbols-outlined text-white text-[44px] ms-fill">mic</span>
              <span className="text-white text-[13px] font-bold tracking-wide">Hỏi Cò Con</span>
            </button>

            <p className="text-[13px] text-[#6e7b6c] text-center max-w-[200px] leading-snug">
              Hỏi về sâu bệnh, thời vụ và phân bón
            </p>
          </div>

          {/* Quick action cards */}
          <div className="grid grid-cols-2 gap-3 w-full">
            {/* Weather card */}
            <button
              className="flex flex-col items-start gap-2 bg-white rounded-3xl p-4 shadow-sm
                         border border-[#e5eeff] active:scale-95 transition-transform text-left"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#fffbeb] flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px] text-[#855300]">wb_sunny</span>
              </div>
              <div>
                <div className="text-[20px] font-extrabold text-[#0b1c30] leading-none">32°C</div>
                <div className="text-[12px] text-[#6e7b6c] mt-1">Thời tiết hôm nay</div>
              </div>
            </button>

            {/* Rice price card */}
            <button
              className="flex flex-col items-start gap-2 bg-white rounded-3xl p-4 shadow-sm
                         border border-[#e5eeff] active:scale-95 transition-transform text-left"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#f0fdf4] flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px] text-[#006b2c]">payments</span>
              </div>
              <div>
                <div className="text-[20px] font-extrabold text-[#0b1c30] leading-none">9.500đ</div>
                <div className="text-[12px] text-[#6e7b6c] mt-1">Giá lúa/kg hôm nay</div>
              </div>
            </button>
          </div>
        </main>
      )}

      {/* ── Dashboard links for engineer / admin ─────────────────── */}
      {!isFarmer && (
        <main className="flex-1 flex flex-col gap-3 px-5 py-4 overflow-y-auto">
          <p className="text-[12px] text-[#6e7b6c] font-semibold uppercase tracking-wider mb-1">
            Truy cập nhanh
          </p>

          {/* ── Kỹ sư ── */}
          {user?.role === 'engineer' && ENGINEER_LINKS.map(link => (
            <NavCard key={link.path} {...link} onClick={() => navigate(link.path)} />
          ))}

          {/* ── Admin ── */}
          {user?.role === 'admin' && ADMIN_LINKS.map(link => (
            <NavCard key={link.path} {...link} onClick={() => navigate(link.path)} />
          ))}

          <button
            onClick={logout}
            className="mt-2 flex items-center justify-center gap-2
                       text-[13px] text-[#6e7b6c] font-semibold py-3"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Đăng xuất
          </button>
        </main>
      )}

      {/* ── Bottom Nav (farmers only) ──────────────────────────── */}
      {isFarmer && <BottomNav unreadCount={unreadCount} />}
      {isFarmer && <div className="h-20" aria-hidden="true" />}
    </div>
  )
}
