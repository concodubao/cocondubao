import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Mock Supabase (thenable builder) + web-push ─────────────────────────────
const sb = vi.hoisted(() => {
  const queue = []
  const CHAIN = ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order',
                 'range', 'contains', 'is', 'not', 'single', 'limit', 'or', 'lte', 'gte']
  const makeBuilder = () => {
    const b = {}
    for (const m of CHAIN) b[m] = () => b
    b.then = (resolve, reject) => {
      const r = queue.length ? queue.shift() : { data: null, error: null }
      return Promise.resolve(r).then(resolve, reject)
    }
    return b
  }
  return {
    supabase: { from: () => makeBuilder() },
    enqueue:  (...results) => queue.push(...results),
    reset:    () => { queue.length = 0 },
  }
})

const sendNotification = vi.hoisted(() => vi.fn())

vi.mock('../src/services/supabase.js', () => ({ supabase: sb.supabase }))
vi.mock('web-push', () => ({ default: { sendNotification } }))

const { isQuietHour, dispatchNotification, processScheduledNotifications } =
  await import('../src/services/notifications.js')

beforeEach(() => {
  sb.reset()
  sendNotification.mockReset().mockResolvedValue({})
})

// ══════════════════════════════════════════════════════════════════════════════
describe('isQuietHour', () => {
  it('khung trong ngày 08:00-17:00', () => {
    const at = (h) => { vi.setSystemTime(new Date(2026, 0, 1, h, 0, 0)); return isQuietHour('08:00', '17:00') }
    expect(at(10)).toBe(true)
    expect(at(20)).toBe(false)
    vi.useRealTimers()
  })

  it('khung qua nửa đêm 22:00-06:00', () => {
    const at = (h) => { vi.setSystemTime(new Date(2026, 0, 1, h, 0, 0)); return isQuietHour('22:00', '06:00') }
    expect(at(23)).toBe(true)
    expect(at(3)).toBe(true)
    expect(at(12)).toBe(false)
    vi.useRealTimers()
  })

  it('không cấu hình → không phải giờ yên tĩnh', () => {
    expect(isQuietHour(null, null)).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('dispatchNotification', () => {
  it('gửi cho tất cả khi không lọc cây trồng', async () => {
    sb.enqueue({
      data: [
        { endpoint: 'e1', keys: {}, user_id: 'u1', notif_types: ['alert'], quiet_start: null, quiet_end: null },
        { endpoint: 'e2', keys: {}, user_id: 'u2', notif_types: ['alert'], quiet_start: null, quiet_end: null },
      ],
      error: null,
    })

    const stats = await dispatchNotification({ id: 'n1', title: 'T', body: 'B', type: 'alert', crop_tags: [] })

    expect(stats.total).toBe(2)
    expect(stats.sent).toBe(2)
    expect(sendNotification).toHaveBeenCalledTimes(2)
  })

  it('loại subscriber không bật loại thông báo này', async () => {
    sb.enqueue({
      data: [
        { endpoint: 'e1', keys: {}, user_id: 'u1', notif_types: ['promotion'], quiet_start: null, quiet_end: null },
        { endpoint: 'e2', keys: {}, user_id: 'u2', notif_types: ['alert'],     quiet_start: null, quiet_end: null },
      ],
      error: null,
    })

    const stats = await dispatchNotification({ id: 'n1', title: 'T', body: 'B', type: 'alert', crop_tags: [] })

    expect(stats.total).toBe(1)
    expect(sendNotification).toHaveBeenCalledTimes(1)
  })

  it('chỉ gửi cho user có cây trồng khớp khi nhắm theo crop', async () => {
    sb.enqueue(
      { // push_subscriptions
        data: [
          { endpoint: 'e1', keys: {}, user_id: 'u1', notif_types: ['alert'], quiet_start: null, quiet_end: null },
          { endpoint: 'e2', keys: {}, user_id: 'u2', notif_types: ['alert'], quiet_start: null, quiet_end: null },
        ],
        error: null,
      },
      { // users
        data: [{ id: 'u1', crops: ['rice'] }, { id: 'u2', crops: ['fruit'] }],
        error: null,
      },
    )

    const stats = await dispatchNotification({ id: 'n1', title: 'T', body: 'B', type: 'alert', crop_tags: ['rice'] })

    expect(stats.total).toBe(1)
    expect(sendNotification).toHaveBeenCalledTimes(1)
  })

  it('không có subscriber → sent 0, không gọi web-push', async () => {
    sb.enqueue({ data: [], error: null })
    const stats = await dispatchNotification({ id: 'n1', title: 'T', body: 'B', type: 'alert', crop_tags: [] })
    expect(stats).toEqual({ sent: 0, failed: 0, total: 0 })
    expect(sendNotification).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('processScheduledNotifications', () => {
  it('gửi notif tới hạn rồi đánh dấu sent_at', async () => {
    sb.enqueue(
      { data: [{ id: 'n1', title: 'T', body: 'B', type: 'alert', image_url: null, crop_tags: [] }], error: null }, // due
      { data: [{ endpoint: 'e1', keys: {}, user_id: 'u1', notif_types: ['alert'], quiet_start: null, quiet_end: null }], error: null }, // subs
      { error: null }, // update sent_at
    )

    await processScheduledNotifications()

    expect(sendNotification).toHaveBeenCalledTimes(1)
  })

  it('không có notif tới hạn → không gửi gì', async () => {
    sb.enqueue({ data: [], error: null })
    await processScheduledNotifications()
    expect(sendNotification).not.toHaveBeenCalled()
  })
})
