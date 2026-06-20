import { describe, it, expect, vi } from 'vitest'

// Mock supabase để import weatherAlerts.js không tạo client thật (thiếu env)
vi.mock('../src/services/supabase.js', () => ({ supabase: { from: () => ({}) } }))

const { evaluateWeather } = await import('../src/services/weatherAlerts.js')

// Helper: tạo daily với giá trị ở NGÀY MAI (index 1) — evaluateWeather ưu tiên ngày mai
function daily({ rainSum = 0, rainProb = 0, tMax = 30, tMin = 25, wind = 10 } = {}) {
  return {
    time: ['2026-06-21', '2026-06-22'],
    precipitation_sum:              [0, rainSum],
    precipitation_probability_max:  [0, rainProb],
    temperature_2m_max:             [30, tMax],
    temperature_2m_min:             [25, tMin],
    wind_speed_10m_max:             [10, wind],
  }
}

const kinds = (alerts) => alerts.map(a => a.kind).sort()

describe('evaluateWeather', () => {
  it('ngày đẹp → không có cảnh báo', () => {
    expect(evaluateWeather(daily())).toEqual([])
  })

  it('mưa to theo lượng mưa (≥20mm)', () => {
    expect(kinds(evaluateWeather(daily({ rainSum: 30 })))).toContain('rain')
  })

  it('mưa to theo xác suất (≥70%)', () => {
    expect(kinds(evaluateWeather(daily({ rainProb: 80 })))).toContain('rain')
  })

  it('nắng nóng (≥35°C)', () => {
    expect(kinds(evaluateWeather(daily({ tMax: 37 })))).toContain('heat')
  })

  it('gió mạnh (≥40 km/h)', () => {
    expect(kinds(evaluateWeather(daily({ wind: 45 })))).toContain('wind')
  })

  it('trời lạnh (≤18°C)', () => {
    expect(kinds(evaluateWeather(daily({ tMin: 15 })))).toContain('cold')
  })

  it('nhiều điều kiện cùng lúc → nhiều cảnh báo', () => {
    expect(kinds(evaluateWeather(daily({ rainSum: 40, wind: 50 })))).toEqual(['rain', 'wind'])
  })

  it('daily rỗng → []', () => {
    expect(evaluateWeather({})).toEqual([])
    expect(evaluateWeather(null)).toEqual([])
  })
})
