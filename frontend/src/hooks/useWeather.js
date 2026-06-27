// frontend/src/hooks/useWeather.js
// Open-Meteo API — miễn phí, không cần key, hỗ trợ Việt Nam

import { useState, useEffect } from 'react'

const DEFAULT_LAT = 9.6027    // Sóc Trăng
const DEFAULT_LON = 105.9740
const CACHE_KEY   = 'cocon-weather-v1'
const CACHE_TTL   = 60 * 60 * 1000 // 60 phút (giảm số lần gọi Open-Meteo, tránh 429)

// WMO Weather Code → nhãn tiếng Việt + Material Symbol icon
export const WMO_MAP = {
  0:  { label: 'Trời quang',    icon: 'wb_sunny',          color: '#f59e0b' },
  1:  { label: 'Ít mây',        icon: 'partly_cloudy_day', color: '#f59e0b' },
  2:  { label: 'Nhiều mây',     icon: 'cloud',             color: '#94a3b8' },
  3:  { label: 'Trời âm u',     icon: 'cloudy',            color: '#64748b' },
  45: { label: 'Sương mù',      icon: 'foggy',             color: '#94a3b8' },
  48: { label: 'Sương mù dày',  icon: 'foggy',             color: '#94a3b8' },
  51: { label: 'Mưa phùn nhẹ',  icon: 'grain',             color: '#60a5fa' },
  53: { label: 'Mưa phùn',      icon: 'grain',             color: '#60a5fa' },
  55: { label: 'Mưa phùn nặng', icon: 'grain',             color: '#3b82f6' },
  61: { label: 'Mưa nhẹ',       icon: 'rainy_light',       color: '#3b82f6' },
  63: { label: 'Mưa vừa',       icon: 'rainy',             color: '#2563eb' },
  65: { label: 'Mưa to',        icon: 'rainy_heavy',       color: '#1d4ed8' },
  80: { label: 'Mưa rào',       icon: 'rainy',             color: '#2563eb' },
  81: { label: 'Mưa rào vừa',   icon: 'rainy',             color: '#2563eb' },
  82: { label: 'Mưa rào lớn',   icon: 'rainy_heavy',       color: '#1d4ed8' },
  95: { label: 'Có giông',       icon: 'thunderstorm',      color: '#7c3aed' },
  96: { label: 'Giông + mưa đá', icon: 'thunderstorm',     color: '#7c3aed' },
  99: { label: 'Giông mạnh',    icon: 'thunderstorm',       color: '#7c3aed' },
}

export function getWMO(code) {
  if (code === null || code === undefined) return WMO_MAP[0]
  return WMO_MAP[code] ?? WMO_MAP[Math.floor(code / 10) * 10] ?? WMO_MAP[0]
}

// ─── Tổng hợp "điều kiện ban ngày đại diện" ─────────────────────────────────
// Open-Meteo trả MÃ THỜI TIẾT NGÀY = giờ KHẮC NGHIỆT NHẤT trong ngày. Ở ĐBSCL mùa
// mưa, một cơn giông chiều (1-2 giờ) khiến CẢ NGÀY hiện "Giông + mưa đá" dù sáng
// trời quang → nông dân nhìn vào tưởng cả ngày mưa, ngại ra đồng. Dữ liệu KHÔNG sai
// (các model bất đồng: ECMWF ẩm, GFS nắng), nên ta không đổi nguồn mà tổng hợp lại
// từ dữ liệu theo giờ để icon/lời khuyên phản ánh đúng phần lớn thời gian ban ngày.
function wmoBucket(code) {
  if (code >= 95) return 'storm'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 2) return 'cloud'
  return 'clear' // 0, 1
}
// Mã đại diện cho từng nhóm → chọn icon/nhãn nhẹ nhàng, đúng mức
const BUCKET_CODE = { clear: 0, cloud: 2, fog: 45, rain: 63, storm: 95 }

// Tóm tắt 1 ngày từ các giờ ban ngày (6h–18h): điều kiện đại diện + thời điểm mưa.
function summarizeDay(hours) {
  const day = (hours || []).filter(x => x.h >= 6 && x.h <= 18)
  if (!day.length) return null

  const counts = {}
  for (const x of day) { const b = wmoBucket(x.code); counts[b] = (counts[b] || 0) + 1 }
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]

  const wet      = day.filter(x => ['rain', 'storm'].includes(wmoBucket(x.code)))
  const hasStorm = day.some(x => wmoBucket(x.code) === 'storm')
  let rainTiming = null
  if (wet.length) {
    const morning   = wet.filter(x => x.h < 12).length
    const afternoon = wet.length - morning
    rainTiming = wet.length >= 9 ? 'cả ngày'
               : afternoon > morning ? 'chiều'
               : morning > afternoon ? 'sáng'
               : 'rải rác'
  }
  return { dayCode: BUCKET_CODE[dominant], hasStorm, rainTiming, wetCount: wet.length }
}

// Nhãn ngắn về mưa/giông để hiển thị cạnh icon (vd "giông chiều", "mưa sáng").
export function rainTimingLabel(day) {
  if (!day?.rainTiming) return null
  return `${day.hasStorm ? 'giông' : 'mưa'} ${day.rainTiming}`
}

// ─── Màu thẻ theo điều kiện thời tiết ───────────────────────────────────────
// Thẻ trước đây luôn 1 màu xanh dù trời nắng hay mưa. Cho màu đổi theo điều kiện
// để đỡ đơn điệu và bà con nhìn màu đoán được trời: nắng=cam, ít mây=xanh nhạt,
// âm u=xám, mưa=xanh, giông=tím.
const WEATHER_THEME = {
  clear: ['#f59e0b', '#d97706'], // nắng
  cloud: ['#38bdf8', '#0284c7'], // ít mây
  fog:   ['#94a3b8', '#475569'], // âm u / sương mù
  rain:  ['#3b82f6', '#1d4ed8'], // mưa
  storm: ['#6366f1', '#4338ca'], // giông
}
export function weatherTheme(code) {
  const c = code ?? 0
  let key = 'cloud'
  if (c >= 95)                                          key = 'storm'
  else if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) key = 'rain'
  else if (c === 3 || c === 45 || c === 48)             key = 'fog'
  else if (c <= 1)                                      key = 'clear'
  const [from, to] = WEATHER_THEME[key]
  return { from, to, gradient: `linear-gradient(135deg, ${from}, ${to})` }
}

// Lời khuyên canh tác — theo THỜI ĐIỂM mưa, không "cấm cả ngày" khi chỉ mưa chiều.
export function farmingTip(day) {
  if (!day) return null
  const pp     = day.rainProb ?? 0
  const tmax   = day.tmax ?? 30
  // Tương thích cả dữ liệu cache cũ (chưa có tóm tắt theo giờ): suy ra từ mã ngày.
  const storm  = day.hasStorm ?? ((day.weathercode ?? 0) >= 95)
  const timing = day.rainTiming ?? null
  const wet    = day.wetCount ?? 0

  if (storm) {
    if (timing === 'chiều') return { type: 'warning', text: 'Chiều có giông — tranh thủ làm đồng buổi sáng, đầu giờ chiều nên nghỉ và cất máy móc.' }
    if (timing === 'sáng')  return { type: 'warning', text: 'Sáng có giông — nên ra đồng vào buổi chiều khi trời đã tạnh.' }
    return { type: 'danger', text: 'Trong ngày có giông — hạn chế ra đồng, cất máy móc nơi an toàn, không trú dưới cây hay cột điện.' }
  }
  if (wet > 0 || pp >= 60) {
    if (timing === 'chiều')   return { type: 'info',    text: 'Chiều có mưa — tranh thủ phun thuốc, bón phân vào buổi sáng cho kịp.' }
    if (timing === 'sáng')    return { type: 'info',    text: 'Sáng có mưa — chờ buổi chiều trời tạnh hãy phun thuốc, bón phân.' }
    if (timing === 'cả ngày') return { type: 'warning', text: 'Mưa nhiều trong ngày — nên hoãn phun thuốc và bón phân, tránh bị rửa trôi.' }
    return { type: 'info', text: 'Có thể có mưa — theo dõi trời trước khi phun thuốc.' }
  }
  if (tmax >= 35) return { type: 'warning', text: 'Nắng nóng — tưới nước sáng sớm hoặc chiều mát, tránh phun thuốc giữa trưa.' }
  if (tmax >= 33) return { type: 'info',    text: 'Trời nắng — nên làm đồng lúc sáng sớm hoặc chiều mát cho đỡ mệt.' }
  return { type: 'success', text: 'Thời tiết thuận lợi — phù hợp để phun thuốc và bón phân.' }
}

async function getGPS() {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      ()  => resolve(null),
      { timeout: 5000, maximumAge: 300_000 }
    )
  })
}

async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude:        lat,
    longitude:       lon,
    daily:           'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode',
    hourly:          'temperature_2m,precipitation_probability,weather_code',
    current:         'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation',
    timezone:        'Asia/Ho_Chi_Minh',
    forecast_days:   '7',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) throw new Error('Không lấy được dữ liệu thời tiết.')
  return res.json()
}

// Gom các giờ theo ngày (YYYY-MM-DD) để tổng hợp điều kiện ban ngày đại diện.
function hourlyByDate(raw) {
  const map = {}
  if (!raw?.hourly?.time) return map
  raw.hourly.time.forEach((t, i) => {
    const date = t.slice(0, 10)
    ;(map[date] ||= []).push({
      h:    Number(t.slice(11, 13)),
      code: raw.hourly.weather_code?.[i] ?? 0,
      prob: raw.hourly.precipitation_probability?.[i] ?? 0,
    })
  })
  return map
}

function parseDaily(raw) {
  if (!raw?.daily?.time) return []
  const byDate = hourlyByDate(raw)
  return raw.daily.time.map((date, i) => {
    const s = summarizeDay(byDate[date])
    const peakCode = raw.daily.weathercode[i]
    return {
      date,
      // Icon/nhãn dùng điều kiện ĐẠI DIỆN ban ngày (đỡ giật mình), không phải giờ
      // khắc nghiệt nhất. peakCode giữ lại để tham chiếu nếu cần.
      weathercode: s?.dayCode ?? peakCode,
      peakCode,
      hasStorm:    s?.hasStorm   ?? (peakCode >= 95),
      rainTiming:  s?.rainTiming ?? null,
      wetCount:    s?.wetCount   ?? 0,
      tmax:        Math.round(raw.daily.temperature_2m_max[i]),
      tmin:        Math.round(raw.daily.temperature_2m_min[i]),
      rain:        Math.round((raw.daily.precipitation_sum[i] ?? 0) * 10) / 10,
      rainProb:    raw.daily.precipitation_probability_max[i] ?? 0,
    }
  })
}

// Thời tiết hiện tại chi tiết (cảm giác như, độ ẩm, gió)
function parseCurrent(raw) {
  const c = raw?.current
  if (!c) return null
  return {
    temp:        Math.round(c.temperature_2m),
    feelsLike:   Math.round(c.apparent_temperature),
    humidity:    Math.round(c.relative_humidity_2m),
    wind:        Math.round(c.wind_speed_10m),
    weathercode: c.weather_code,
  }
}

// Dự báo theo giờ — lấy ~12 giờ tới tính từ bây giờ
function parseHourly(raw) {
  if (!raw?.hourly?.time) return []
  const now = Date.now()
  const all = raw.hourly.time.map((t, i) => ({
    time:        t,
    ts:          new Date(t).getTime(),
    hour:        new Date(t).getHours(),
    temp:        Math.round(raw.hourly.temperature_2m[i]),
    rainProb:    raw.hourly.precipitation_probability?.[i] ?? 0,
    weathercode: raw.hourly.weather_code?.[i] ?? 0,
  }))
  const startIdx = all.findIndex(h => h.ts >= now - 3600_000) // gồm cả giờ hiện tại
  return all.slice(Math.max(0, startIdx), Math.max(0, startIdx) + 12)
}

export function useWeather() {
  const [raw,      setRaw]      = useState(null)
  const [location, setLocation] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Dùng cache nếu còn mới
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
          if (!cancelled) { setRaw(cached.data); setLocation(cached.location); setLoading(false) }
          return
        }
      } catch { /* cache hỏng → bỏ qua, tải mới */ }

      setLoading(true)
      try {
        const pos = await getGPS()
        const lat = pos?.lat ?? DEFAULT_LAT
        const lon = pos?.lon ?? DEFAULT_LON
        const loc = pos ? 'Vị trí của bạn' : 'Sóc Trăng'
        const data = await fetchWeather(lat, lon)

        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data, location: loc }))
        if (!cancelled) { setRaw(data); setLocation(loc); setError(null) }
      } catch (err) {
        // Lỗi mạng / 429 Open-Meteo → ưu tiên dùng dữ liệu cũ đã cache (kể cả hết hạn)
        let usedStale = false
        try {
          const stale = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
          if (stale?.data && !cancelled) {
            setRaw(stale.data); setLocation(stale.location); setError(null)
            usedStale = true
          }
        } catch { /* cache hỏng → để rơi xuống nhánh báo lỗi */ }
        if (!usedStale && !cancelled) {
          const is429 = /429|too many/i.test(err.message || '')
          setError(is429
            ? 'Thời tiết đang tải lại quá nhiều lần, bạn chờ chút rồi thử lại nhé.'
            : err.message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const days        = parseDaily(raw)
  const today       = days[0] ?? null
  const current     = parseCurrent(raw)
  const hourly      = parseHourly(raw)
  const currentTemp = current?.temp ?? today?.tmax ?? null

  return { days, today, current, hourly, currentTemp, location, loading, error }
}
