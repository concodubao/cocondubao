import { useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import { pushAPI } from '../services/api'
import { usePush } from '../hooks/usePush'
import { useWeather, getWMO } from '../hooks/useWeather'
import BottomNav from '../components/BottomNav'

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
    <div className="mx-4 mb-3 flex items-center gap-3 bg-[#fdf6f0] border border-[#f5d5b0] rounded-2xl px-4 py-3">
      <span className="material-symbols-outlined text-[20px] text-[#4B230A]">notifications</span>
      <p className="flex-1 text-[13px] text-[#0b1c30] m-0 leading-snug">
        {pushError ? pushError : 'Bật thông báo để nhận cảnh báo kịp thời'}
      </p>
      <button
        onClick={subscribe}
        className="px-4 py-1.5 bg-[#4B230A] text-white text-[13px] font-bold rounded-full whitespace-nowrap"
      >
        {pushError ? 'Thử lại' : 'Bật'}
      </button>
    </div>
  )
}

export default function Home() {
  const navigate         = useNavigate()
  const { user } = useAuthStore()
  const { permission, isSubscribed, error: pushError, subscribe } = usePush(user?.id)

  useEffect(() => {
    if (permission === 'granted' && !isSubscribed && user?.id) subscribe()
  }, [permission, isSubscribed, user?.id])

  const { today, currentTemp, loading: weatherLoading } = useWeather()
  const wmo = getWMO(today?.weathercode)

  const { data } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn:  () => pushAPI.getNotifications(user.id).then(r => r.data.notifications),
    enabled:  !!user?.id,
    staleTime: 60_000,
  })

  // Admin/kỹ sư vào thẳng khu làm việc, không qua trang chủ nông dân
  if (user?.role === 'admin')    return <Navigate to="/admin" replace />
  if (user?.role === 'engineer') return <Navigate to="/engineer/queue" replace />
  if (user?.role === 'farmer' && !user.name) {
    return <Navigate to="/profile?onboard=true" replace />
  }

  const notifications = data || []
  const unreadCount   = notifications.filter(n => !n.is_read).length

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  const isFarmer = user?.role === 'farmer'

  return (
    <div className="min-h-dvh flex flex-col bg-[#fdf8f5] max-w-[480px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#4B230A]
                          flex items-center justify-center shadow-[0_4px_12px_rgba(75,35,10,0.3)]
                          flex-shrink-0 overflow-hidden">
            <img src="/cocon-icon-bg.png" alt="Cò Con" className="w-10 h-10 object-contain" />
          </div>
          <div>
            <div className="text-[17px] font-extrabold text-[#0b1c30] leading-tight">Cò Con Dự Báo</div>
            <div className="text-[12px] text-[#7a6358] mt-0.5">Trợ lý nông nghiệp</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/profile')}
            aria-label="Hồ sơ"
            className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[22px] text-[#4B230A]">person</span>
          </button>
        </div>
      </header>

      {/* ── Banners ─────────────────────────────────────────────── */}
      <AlertBanner notifications={notifications} />
      <PushBanner permission={permission} isSubscribed={isSubscribed} pushError={pushError} subscribe={subscribe} />

      {/* ── Main CTA for farmers ───────────────────────────────── */}
      {isFarmer && (
        <main className="flex-1 flex flex-col px-5 pb-8 gap-4 pt-2">

          {/* ── Lời chào ───────────────────────────────────────── */}
          <div className="px-1">
            <div className="text-[22px] font-extrabold text-[#0b1c30] leading-tight">
              {greeting}{user?.name ? `, ${user.name}` : ''}!
            </div>
            <div className="text-[14px] text-[#7a6358] mt-1">Hôm nay đồng mình có gì mới không ạ?</div>
          </div>

          {/* ── Hero "Hỏi Cò Con" — full width, mic lớn ───────────── */}
          <button
            onClick={() => navigate('/chat')}
            aria-label="Hỏi Cò Con"
            className="relative flex flex-col items-center justify-center gap-3 overflow-hidden w-full
                       bg-gradient-to-br from-[#6b3410] to-[#4B230A]
                       rounded-[28px] py-8 px-4
                       shadow-[0_8px_24px_rgba(75,35,10,0.35)]
                       active:scale-[0.98] transition-transform"
          >
            <span className="absolute w-32 h-32 rounded-full bg-white/10 mic-pulse pointer-events-none" />
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center z-10">
              <span className="material-symbols-outlined text-white text-[44px] ms-fill">mic</span>
            </div>
            <div className="text-center z-10">
              <div className="text-white text-[20px] font-extrabold leading-tight">Hỏi Cò Con</div>
              <div className="text-white/80 text-[13px] mt-1">Bấm để nói chuyện hoặc gõ câu hỏi</div>
            </div>
          </button>

          {/* ── Thông báo (hàng) ──────────────────────────────────── */}
          <button
            onClick={() => navigate('/notifications')}
            aria-label="Thông báo"
            className="flex items-center gap-4 bg-white rounded-[20px] px-5 py-4 shadow-sm border border-[#f0e0d0]
                       active:scale-[0.98] transition-transform text-left w-full"
          >
            <div className="relative w-12 h-12 rounded-2xl bg-[#fdf6f0] flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[26px] text-[#4B230A] ms-fill">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-[#EF4444] rounded-full
                                 flex items-center justify-center text-[10px] font-extrabold text-white px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-bold text-[#0b1c30]">Thông báo</div>
              <div className="text-[13px] text-[#7a6358] mt-0.5">
                {unreadCount > 0 ? `${unreadCount} tin chưa đọc` : 'Xem tin mới về mùa vụ'}
              </div>
            </div>
            <span className="material-symbols-outlined text-[20px] text-[#d4b8a8]">chevron_right</span>
          </button>

          {/* ── Theo dõi mùa vụ: Thời tiết + Giá nông sản ─────────── */}
          <div>
            <p className="text-[12px] font-bold text-[#7a6358] uppercase tracking-wider mb-2 px-1">
              Theo dõi mùa vụ
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* Thời tiết */}
              <button
                onClick={() => navigate('/weather')}
                className="flex flex-col gap-2 bg-white rounded-[20px] p-4 shadow-sm border border-[#f0e0d0]
                           active:scale-95 transition-transform text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-[#e0f2fe] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px] ms-fill" style={{ color: wmo.color }}>
                    {weatherLoading ? 'wb_sunny' : wmo.icon}
                  </span>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-[#7a6358] uppercase tracking-wide">Thời tiết</div>
                  <div className="text-[20px] font-extrabold text-[#0b1c30] leading-none mt-1">
                    {weatherLoading ? '...' : `${currentTemp}°C`}
                  </div>
                  <div className="text-[12px] text-[#7a6358] mt-0.5 truncate">
                    {weatherLoading ? 'Đang tải...' : wmo.label}
                  </div>
                </div>
              </button>

              {/* Giá nông sản — placeholder (chưa có nguồn dữ liệu) */}
              <div className="flex flex-col gap-2 bg-white rounded-[20px] p-4 shadow-sm border border-[#f0e0d0]">
                <div className="w-10 h-10 rounded-xl bg-[#fff8e8] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px] text-[#855300] ms-fill">payments</span>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-[#7a6358] uppercase tracking-wide">Giá nông sản</div>
                  <div className="text-[15px] font-extrabold text-[#0b1c30] leading-tight mt-1">Sắp có</div>
                  <div className="text-[12px] text-[#7a6358] mt-0.5">Giá lúa, rau theo ngày</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Mẹo hôm nay ───────────────────────────────────────── */}
          <div className="flex items-start gap-3 bg-[#fff8e8] border border-[#fde68a] rounded-[20px] p-4">
            <div className="w-11 h-11 rounded-2xl bg-[#fef3c7] flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[22px] text-[#92400e] ms-fill">lightbulb</span>
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-bold text-[#92400e] uppercase tracking-wide mb-1">Mẹo hôm nay</div>
              <p className="text-[14px] text-[#78350f] leading-snug m-0">
                Vụ hè thu nên bón phân đợt 2 sau khi cấy 20–25 ngày để lúa đẻ nhánh đều.
              </p>
            </div>
          </div>
        </main>
      )}

      {/* ── Bottom Nav (farmers only) ──────────────────────────── */}
      {isFarmer && <BottomNav unreadCount={unreadCount} />}
      {isFarmer && <div className="h-20" aria-hidden="true" />}
    </div>
  )
}
