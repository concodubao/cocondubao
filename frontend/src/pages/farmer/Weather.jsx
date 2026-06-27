import { useNavigate } from 'react-router-dom'
import { useWeather, getWMO, farmingTip, rainTimingLabel, weatherTheme } from '../../hooks/useWeather'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { useAuthStore } from '../../stores/authStore'

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function formatDate(dateStr, index) {
  if (index === 0) return 'Hôm nay'
  if (index === 1) return 'Ngày mai'
  const d = new Date(dateStr)
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`
}

function TipBanner({ tip }) {
  if (!tip) return null
  const cfg = {
    danger:  { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', icon: 'warning',      iconColor: '#ef4444' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: 'info',          iconColor: '#f59e0b' },
    info:    { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: 'info',          iconColor: '#3b82f6' },
    success: { bg: '#fdf6f0', border: '#f5d5b0', text: '#2e1505', icon: 'check_circle',  iconColor: '#4B230A' },
  }
  const c = cfg[tip.type] || cfg.info
  return (
    <div className="flex items-start gap-3 rounded-2xl px-4 py-3 border"
         style={{ background: c.bg, borderColor: c.border }}>
      <span className="material-symbols-outlined text-[20px] mt-0.5 ms-fill flex-shrink-0"
            style={{ color: c.iconColor }}>{c.icon}</span>
      <p className="text-[14px] leading-snug m-0 font-medium" style={{ color: c.text }}>{tip.text}</p>
    </div>
  )
}

function DayCard({ day, index }) {
  const wmo = getWMO(day.weathercode)
  const timing = rainTimingLabel(day)
  const isToday = index === 0
  const theme = weatherTheme(day.weathercode)

  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 border shadow-sm
                     ${isToday ? '' : 'bg-white border-[#f0e0d0]'}`}
         style={isToday ? { background: theme.gradient, borderColor: theme.to } : undefined}>
      {/* Ngày */}
      <div className={`w-16 flex-shrink-0 text-[13px] font-bold ${isToday ? 'text-white/90' : 'text-[#7a6358]'}`}>
        {formatDate(day.date, index)}
      </div>

      {/* Icon */}
      <span className="material-symbols-outlined text-[26px] ms-fill flex-shrink-0"
            style={{ color: isToday ? '#fff' : wmo.color }}>
        {wmo.icon}
      </span>

      {/* Tình trạng */}
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-semibold truncate ${isToday ? 'text-white' : 'text-[#0b1c30]'}`}>
          {wmo.label}
          {/* Thời điểm mưa/giông để bà con biết lúc nào tạnh mà tranh thủ làm đồng */}
          {timing && (
            <span className={`ml-1.5 font-medium ${isToday ? 'text-white/75' : 'text-[#94a3b8]'}`}>· {timing}</span>
          )}
        </div>
        {/* Xác suất mưa */}
        <div className={`text-[12px] mt-0.5 flex items-center gap-1 ${isToday ? 'text-white/80' : 'text-[#7a6358]'}`}>
          <span className="material-symbols-outlined text-[13px]">water_drop</span>
          {day.rainProb}%
          {day.rain > 0 && <span className="ml-1">· {day.rain}mm</span>}
        </div>
      </div>

      {/* Nhiệt độ */}
      <div className="text-right flex-shrink-0">
        <div className={`text-[17px] font-extrabold ${isToday ? 'text-white' : 'text-[#0b1c30]'}`}>
          {day.tmax}°
        </div>
        <div className={`text-[12px] ${isToday ? 'text-white/70' : 'text-[#64748b]'}`}>
          {day.tmin}°
        </div>
      </div>
    </div>
  )
}

export default function Weather() {
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const { user } = useAuthStore()
  const isStaff = user?.role === 'engineer' || user?.role === 'admin'
  // Staff trên desktop đã có sidebar điều hướng → nút Back thừa. Farmer/khách
  // (không có sidebar) vẫn giữ Back để còn lối quay lại.
  const hideBack = isDesktop && isStaff
  const { days, today, current, hourly, currentTemp, location, loading, error } = useWeather()

  const wmo = getWMO(today?.weathercode)
  const tip = farmingTip(today)
  const todayTiming = rainTimingLabel(today)
  const heroTheme = weatherTheme(today?.weathercode)

  return (
    <div className="min-h-dvh flex flex-col bg-[#fdf8f5] w-full max-w-[480px] md:max-w-[920px] mx-auto overflow-x-hidden">

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3
                         bg-white border-b border-[#f1f5f9] shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
        {!hideBack && (
          <button onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')} aria-label="Quay lại"
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#7a6358]">
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
        )}
        <h1 className="flex-1 text-[18px] font-extrabold text-[#0b1c30] m-0">Dự báo thời tiết</h1>
      </header>

      <main className="flex-1 flex flex-col gap-4 px-4 py-4 md:px-6">

        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 pt-16 text-[#64748b]">
            <span className="material-symbols-outlined text-[48px] animate-spin">refresh</span>
            <p className="text-[14px]">Đang lấy dữ liệu thời tiết...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 pt-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-[#ef4444]">cloud_off</span>
            <p className="text-[15px] text-[#0b1c30] font-semibold">Không lấy được thời tiết</p>
            <p className="text-[13px] text-[#7a6358]">{error}</p>
          </div>
        )}

        {!loading && !error && today && (
          <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-5 md:items-start">
            {/* Cột trái: hôm nay + lời khuyên */}
            <div className="flex flex-col gap-4">
            {/* Hero card hôm nay */}
            <div className="rounded-3xl px-6 py-6 text-white shadow-lg"
                 style={{ background: heroTheme.gradient }}>
              {/* Vị trí */}
              <div className="flex items-center gap-1.5 text-white/80 text-[13px] mb-4">
                <span className="material-symbols-outlined text-[15px]">location_on</span>
                {location ?? 'Sóc Trăng'}
              </div>

              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-black leading-none text-[clamp(3.25rem,17vw,4.5rem)]">{currentTemp}°</div>
                  <div className="font-bold mt-1 text-[clamp(15px,4.5vw,18px)]">
                    {wmo.label}{todayTiming && <span className="font-medium text-white/80"> · {todayTiming}</span>}
                  </div>
                  <div className="text-white/75 text-[13px] mt-1">
                    {today.tmin}° – {today.tmax}°  ·  Mưa {today.rainProb}%
                    {current && <>{'  '}·  Cảm giác {current.feelsLike}°</>}
                  </div>
                </div>
                <span className="material-symbols-outlined ms-fill flex-shrink-0"
                      style={{ fontSize: 'clamp(56px, 16vw, 80px)', color: 'rgba(255,255,255,0.9)' }}>
                  {wmo.icon}
                </span>
              </div>

              {/* Chỉ số nhanh: mưa · gió · độ ẩm */}
              {(current || today.rain > 0) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {today.rain > 0 && (
                    <div className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-2">
                      <span className="material-symbols-outlined text-[16px]">water_drop</span>
                      <span className="text-[13px] font-semibold">{today.rain}mm</span>
                    </div>
                  )}
                  {current && (
                    <div className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-2">
                      <span className="material-symbols-outlined text-[16px]">air</span>
                      <span className="text-[13px] font-semibold">{current.wind} km/h</span>
                    </div>
                  )}
                  {current && (
                    <div className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-2">
                      <span className="material-symbols-outlined text-[16px]">humidity_percentage</span>
                      <span className="text-[13px] font-semibold">Độ ẩm {current.humidity}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Lời khuyên canh tác */}
            {tip && <TipBanner tip={tip} />}
            </div>

            {/* Cột phải: theo giờ + 7 ngày */}
            <div className="flex flex-col gap-4">
            {/* Dự báo theo giờ */}
            {hourly.length > 0 && (
              <div>
                <p className="text-[12px] font-bold text-[#7a6358] uppercase tracking-wider mb-2 px-1">
                  Theo giờ
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {hourly.map((h, i) => {
                    const w = getWMO(h.weathercode)
                    return (
                      <div key={h.time}
                        className="flex flex-col items-center gap-1 bg-white border border-[#f0e0d0]
                                   rounded-2xl px-3 py-2.5 flex-shrink-0 min-w-[62px] shadow-sm">
                        <span className="text-[12px] font-semibold text-[#7a6358]">
                          {i === 0 ? 'Giờ này' : `${h.hour}h`}
                        </span>
                        <span className="material-symbols-outlined text-[22px] ms-fill" style={{ color: w.color }}>
                          {w.icon}
                        </span>
                        <span className="text-[15px] font-bold text-[#0b1c30]">{h.temp}°</span>
                        <span className="text-[11px] text-[#3b82f6] flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[12px]">water_drop</span>{h.rainProb}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Dự báo 7 ngày */}
            <div>
              <p className="text-[12px] font-bold text-[#7a6358] uppercase tracking-wider mb-2 px-1">
                Dự báo 7 ngày
              </p>
              <div className="flex flex-col gap-2">
                {days.map((day, i) => (
                  <DayCard key={day.date} day={day} index={i} />
                ))}
              </div>
            </div>

            </div>

            {/* Footer */}
            <p className="md:col-span-2 text-center text-[11px] text-[#64748b] pb-2">
              Nguồn: Open-Meteo · Cập nhật mỗi 30 phút
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
