import * as Sentry from '@sentry/node'

// Đếm số lần gọi Gemini THEO TỪNG MODEL (quota free tier tính riêng mỗi model) và cảnh
// báo Sentry khi chạm 80%. Trước đây 1 bộ đếm chung cho mọi model với ngưỡng 1500/ngày,
// không đếm vision/STT → không bao giờ cảnh báo đúng lúc. In-memory: reset khi restart.
// Ngưỡng chỉnh qua env (mặc định khớp .env.example); embedding có ngưỡng ngày riêng.
const LIMITS = {
  rpm:      parseInt(process.env.GEMINI_RPM_LIMIT || '15', 10),
  rpd:      parseInt(process.env.GEMINI_RPD_LIMIT || '200', 10),
  embedRpd: parseInt(process.env.GEMINI_EMBED_RPD_LIMIT || '1000', 10),
}
const MIN = 60 * 1000
const DAY = 24 * 60 * 60 * 1000

const _usage = new Map() // model → { rpm, rpd, minStart, dayStart, alertMin, alertDay }

export function incrementGeminiUsage(model = 'unknown') {
  const now = Date.now()
  let u = _usage.get(model)
  if (!u) { u = { rpm: 0, rpd: 0, minStart: now, dayStart: now, alertMin: false, alertDay: false }; _usage.set(model, u) }
  if (now - u.minStart > MIN) { u.rpm = 0; u.minStart = now; u.alertMin = false }
  if (now - u.dayStart > DAY) { u.rpd = 0; u.dayStart = now; u.alertDay = false }
  u.rpm++
  u.rpd++

  const rpdLimit = model.includes('embedding') ? LIMITS.embedRpd : LIMITS.rpd
  if (u.rpm >= LIMITS.rpm * 0.8 && !u.alertMin) {
    u.alertMin = true
    alert(`[QUOTA ALERT] ${model}: ${u.rpm}/${LIMITS.rpm} request/phút (>= 80%)`)
  }
  if (u.rpd >= rpdLimit * 0.8 && !u.alertDay) {
    u.alertDay = true
    alert(`[QUOTA ALERT] ${model}: ${u.rpd}/${rpdLimit} request/ngày (>= 80%)`)
  }
}

function alert(msg) {
  console.warn(msg)
  try { Sentry.captureMessage(msg, 'warning') } catch { /* Sentry tắt ở dev */ }
}

export function getQuotaStatus() {
  const out = {}
  for (const [model, u] of _usage) out[model] = { rpm: u.rpm, rpd: u.rpd }
  return { limits: LIMITS, models: out }
}
