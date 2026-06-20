// backend/src/services/weatherAlerts.js
// Tự động phát hiện điều kiện thời tiết đáng lưu ý (mưa to, nắng nóng, gió mạnh,
// rét) cho xã Trường Khánh và TẠO BẢN NHÁP thông báo để ADMIN DUYỆT rồi mới gửi —
// không tự gửi thẳng (tránh spam/cảnh báo sai cho nông dân lớn tuổi).
//
// Draft được lưu trong bảng notifications với quy ước (KHÔNG cần migration):
//   type='weather', created_by=NULL, sent_at=NULL, scheduled_at=NULL,
//   region='wx:<kind>' (khoá dedup — region không dùng khi dispatch, không hiện cho nông dân).
// → scheduler gửi-đặt-lịch bỏ qua (scheduled_at NULL); admin xem ở danh sách draft riêng.

import { supabase } from './supabase.js'

// Toạ độ Trường Khánh, Sóc Trăng (khớp DEFAULT trong frontend useWeather.js)
const LAT = 9.6027
const LON = 105.9740

// Ngưỡng cảnh báo — chỉnh ở đây nếu cần
const TH = {
  rainSum:   20,  // mm/ngày → mưa to
  rainProb:  70,  // % xác suất mưa
  heatMax:   35,  // °C → nắng nóng
  windMax:   40,  // km/h → gió mạnh
  coldMin:   18,  // °C → rét (hiếm ở Sóc Trăng)
}

async function fetchDailyForecast() {
  const params = new URLSearchParams({
    latitude:   LAT,
    longitude:  LON,
    daily:      'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
    timezone:   'Asia/Ho_Chi_Minh',
    forecast_days: '2',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  const data = await res.json()
  return data.daily
}

// Đánh giá dự báo NGÀY MAI (index 1) — đủ sớm để nông dân chủ động.
// Trả về mảng alert { kind, title, body }.
export function evaluateWeather(daily) {
  if (!daily?.time?.length) return []
  const i = daily.time.length > 1 ? 1 : 0 // ưu tiên ngày mai, fallback hôm nay
  const d = daily.time[i]
  const [, mm, dd] = (d || '').split('-')
  const ngay = mm && dd ? `${dd}/${mm}` : 'ngày mai'

  const rainSum = daily.precipitation_sum?.[i] ?? 0
  const rainPb  = daily.precipitation_probability_max?.[i] ?? 0
  const tMax    = daily.temperature_2m_max?.[i] ?? null
  const tMin    = daily.temperature_2m_min?.[i] ?? null
  const wind    = daily.wind_speed_10m_max?.[i] ?? 0

  const alerts = []
  if (rainSum >= TH.rainSum || rainPb >= TH.rainProb) {
    alerts.push({
      kind:  'rain',
      title: `🌧️ Cảnh báo mưa to ngày ${ngay}`,
      body:  `Dự báo ${ngay} có mưa to (khoảng ${Math.round(rainSum)}mm). Bà con nên HOÃN phun thuốc và bón phân để tránh bị rửa trôi, che chắn nông sản đã thu hoạch.`,
    })
  }
  if (tMax !== null && tMax >= TH.heatMax) {
    alerts.push({
      kind:  'heat',
      title: `☀️ Cảnh báo nắng nóng ngày ${ngay}`,
      body:  `Dự báo ${ngay} nắng nóng gay gắt (tới ${Math.round(tMax)}°C). Bà con nhớ tưới đủ nước cho cây, tránh phun thuốc vào giữa trưa nắng.`,
    })
  }
  if (wind >= TH.windMax) {
    alerts.push({
      kind:  'wind',
      title: `💨 Cảnh báo gió mạnh ngày ${ngay}`,
      body:  `Dự báo ${ngay} có gió mạnh (tới ${Math.round(wind)} km/h). Bà con chằng chống cây, giàn leo; cân nhắc thu hoạch sớm nếu cây sắp tới kỳ.`,
    })
  }
  if (tMin !== null && tMin <= TH.coldMin) {
    alerts.push({
      kind:  'cold',
      title: `🥶 Cảnh báo trời lạnh ngày ${ngay}`,
      body:  `Dự báo ${ngay} nhiệt độ xuống thấp (khoảng ${Math.round(tMin)}°C). Bà con che chắn cho mạ non và cây con kẻo bị ảnh hưởng.`,
    })
  }
  return alerts
}

// Tạo draft cho 1 alert nếu chưa có draft cùng loại đang chờ duyệt (dedup theo region).
async function createDraftIfAbsent(alert) {
  const regionKey = `wx:${alert.kind}`
  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('type', 'weather')
    .eq('region', regionKey)
    .is('created_by', null)
    .is('sent_at', null)
    .is('scheduled_at', null)
    .limit(1)
  if (existing?.length) return false // đã có draft cùng loại đang chờ → bỏ qua

  const { error } = await supabase.from('notifications').insert({
    title:      alert.title,
    body:       alert.body,
    type:       'weather',
    region:     regionKey,
    crop_tags:  [],      // cảnh báo thời tiết áp dụng chung cho mọi cây trồng
    created_by: null,    // null = do hệ thống tạo (draft chờ admin duyệt)
  })
  if (error) { console.warn('[WX] tạo draft lỗi:', error.message); return false }
  return true
}

export async function runWeatherAlertCheck() {
  try {
    const daily  = await fetchDailyForecast()
    const alerts = evaluateWeather(daily)
    let created = 0
    for (const a of alerts) {
      if (await createDraftIfAbsent(a)) created++
    }
    if (created) console.log(`[WX] tạo ${created} bản nháp cảnh báo thời tiết (chờ admin duyệt)`)
    return created
  } catch (err) {
    console.warn('[WX] kiểm tra thời tiết lỗi:', err.message)
    return 0
  }
}

// Khởi động: quét lúc boot + mỗi 6 giờ. In-process (đúng khi 1 replica — như các
// scheduler khác trong dự án).
export function startWeatherAlertScheduler(intervalMs = 6 * 60 * 60 * 1000) {
  runWeatherAlertCheck()
  setInterval(() => { runWeatherAlertCheck() }, intervalMs)
  console.log(`[WX] Scheduler cảnh báo thời tiết đã chạy (mỗi ${intervalMs / 3600000}h)`)
}
