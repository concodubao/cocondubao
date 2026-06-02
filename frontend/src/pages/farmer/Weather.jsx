import { useNavigate } from 'react-router-dom'
import { useWeather, getWMO, farmingTip } from '../../hooks/useWeather'

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
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', icon: 'check_circle',  iconColor: '#16a34a' },
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
  const isToday = index === 0

  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 border
                     ${isToday ? 'bg-[#006b2c] border-[#005a24]' : 'bg-white border-[#e5eeff]'}
                     shadow-sm`}>
      {/* Ngày */}
      <div className={`w-16 flex-shrink-0 text-[13px] font-bold ${isToday ? 'text-white/90' : 'text-[#6e7b6c]'}`}>
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
        </div>
        {/* Xác suất mưa */}
        <div className={`text-[12px] mt-0.5 flex items-center gap-1 ${isToday ? 'text-white/80' : 'text-[#6e7b6c]'}`}>
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
        <div className={`text-[12px] ${isToday ? 'text-white/70' : 'text-[#94a3b8]'}`}>
          {day.tmin}°
        </div>
      </div>
    </div>
  )
}

export default function Weather() {
  const navigate = useNavigate()
  const { days, today, currentTemp, location, loading, error } = useWeather()

  const wmo = getWMO(today?.weathercode)
  const tip = farmingTip(today)

  return (
    <div className="min-h-dvh flex flex-col bg-[#f8f9ff] max-w-[480px] mx-auto">

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3
                         bg-white border-b border-[#f1f5f9] shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/home')} aria-label="Quay lại"
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#6e7b6c]">
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>
        <h1 className="flex-1 text-[18px] font-extrabold text-[#0b1c30] m-0">Dự báo thời tiết</h1>
      </header>

      <main className="flex-1 flex flex-col gap-4 px-4 py-4">

        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 pt-16 text-[#94a3b8]">
            <span className="material-symbols-outlined text-[48px] animate-spin">refresh</span>
            <p className="text-[14px]">Đang lấy dữ liệu thời tiết...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 pt-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-[#ef4444]">cloud_off</span>
            <p className="text-[15px] text-[#0b1c30] font-semibold">Không lấy được thời tiết</p>
            <p className="text-[13px] text-[#6e7b6c]">{error}</p>
          </div>
        )}

        {!loading && !error && today && (
          <>
            {/* Hero card hôm nay */}
            <div className="rounded-3xl px-6 py-6 text-white shadow-lg"
                 style={{ background: 'linear-gradient(135deg, #00873a, #006b2c)' }}>
              {/* Vị trí */}
              <div className="flex items-center gap-1.5 text-white/80 text-[13px] mb-4">
                <span className="material-symbols-outlined text-[15px]">location_on</span>
                {location ?? 'Sóc Trăng'}
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[72px] font-black leading-none">{currentTemp}°</div>
                  <div className="text-[18px] font-bold mt-1">{wmo.label}</div>
                  <div className="text-white/75 text-[13px] mt-1">
                    {today.tmin}° – {today.tmax}°  ·  Mưa {today.rainProb}%
                  </div>
                </div>
                <span className="material-symbols-outlined ms-fill"
                      style={{ fontSize: 80, color: 'rgba(255,255,255,0.9)' }}>
                  {wmo.icon}
                </span>
              </div>

              {/* Lượng mưa */}
              {today.rain > 0 && (
                <div className="mt-4 flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2 w-fit">
                  <span className="material-symbols-outlined text-[16px]">water_drop</span>
                  <span className="text-[13px] font-semibold">{today.rain}mm mưa hôm nay</span>
                </div>
              )}
            </div>

            {/* Lời khuyên canh tác */}
            {tip && <TipBanner tip={tip} />}

            {/* Dự báo 7 ngày */}
            <div>
              <p className="text-[12px] font-bold text-[#6e7b6c] uppercase tracking-wider mb-2 px-1">
                Dự báo 7 ngày
              </p>
              <div className="flex flex-col gap-2">
                {days.map((day, i) => (
                  <DayCard key={day.date} day={day} index={i} />
                ))}
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-[11px] text-[#94a3b8] pb-2">
              Nguồn: Open-Meteo · Cập nhật mỗi 30 phút
            </p>
          </>
        )}
      </main>
    </div>
  )
}
