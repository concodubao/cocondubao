// frontend/src/hooks/useWeather.js
// Open-Meteo API — miễn phí, không cần key, hỗ trợ Việt Nam

import { useState, useEffect } from 'react'

const DEFAULT_LAT = 9.6027    // Sóc Trăng
const DEFAULT_LON = 105.9740
const CACHE_KEY   = 'cocon-weather-v1'
const CACHE_TTL   = 30 * 60 * 1000 // 30 phút

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

// Lời khuyên canh tác dựa trên thời tiết hôm nay
export function farmingTip(day) {
  if (!day) return null
  const pp   = day.rainProb ?? 0
  const wc   = day.weathercode ?? 0
  const tmax = day.tmax ?? 30

  if (wc >= 95)         return { type: 'danger',  text: 'Có giông — tuyệt đối không ra đồng, cất máy móc vào nơi an toàn.' }
  if (wc >= 61 || pp >= 70) return { type: 'warning', text: 'Mưa to — không nên phun thuốc hôm nay, chờ trời tạnh.' }
  if (pp >= 40)         return { type: 'info',    text: 'Có khả năng mưa — theo dõi thời tiết trước khi phun thuốc.' }
  if (tmax >= 38)       return { type: 'warning', text: 'Nắng nóng — tưới nước vào sáng sớm hoặc chiều mát, tránh trưa.' }
  if (pp < 20 && wc <= 2) return { type: 'success', text: 'Thời tiết thuận lợi — phù hợp để phun thuốc và bón phân.' }
  return { type: 'info', text: 'Thời tiết ổn định — có thể canh tác bình thường.' }
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
    current_weather: 'true',
    timezone:        'Asia/Ho_Chi_Minh',
    forecast_days:   '7',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) throw new Error('Không lấy được dữ liệu thời tiết.')
  return res.json()
}

function parseDaily(raw) {
  if (!raw?.daily?.time) return []
  return raw.daily.time.map((date, i) => ({
    date,
    weathercode: raw.daily.weathercode[i],
    tmax:        Math.round(raw.daily.temperature_2m_max[i]),
    tmin:        Math.round(raw.daily.temperature_2m_min[i]),
    rain:        Math.round((raw.daily.precipitation_sum[i] ?? 0) * 10) / 10,
    rainProb:    raw.daily.precipitation_probability_max[i] ?? 0,
  }))
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
      } catch {}

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
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const days        = parseDaily(raw)
  const today       = days[0] ?? null
  const currentTemp = raw?.current_weather
    ? Math.round(raw.current_weather.temperature)
    : today?.tmax ?? null

  return { days, today, currentTemp, location, loading, error }
}
