import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

const SECRET = 'test-secret-key'

const sb = vi.hoisted(() => {
  const queue = []
  const CHAIN = ['select','insert','update','delete','eq','in','order','range',
                 'contains','is','not','single','maybeSingle','limit','or','gte','lt','lte','gt','ilike']
  const makeBuilder = () => {
    const b = {}
    for (const m of CHAIN) b[m] = () => b
    b.then = (resolve, reject) => {
      const r = queue.length ? queue.shift() : { data: null, error: null }
      return Promise.resolve(r).then(resolve, reject)
    }
    return b
  }
  return { supabase: { from: () => makeBuilder() }, enqueue: (...r) => queue.push(...r), reset: () => { queue.length = 0 } }
})

vi.mock('../src/services/supabase.js', () => ({ supabase: sb.supabase }))
vi.mock('../src/services/notifications.js', () => ({
  sendPush: vi.fn().mockResolvedValue({ ok: true }),
  dispatchNotification: vi.fn().mockResolvedValue({ sent: 0, failed: 0, total: 0 }),
}))

const pushRoutes = (await import('../src/routes/push.js')).default
const app = express()
app.use(express.json())
app.use('/api/v1/push', pushRoutes)

const tok  = (userId, role) => jwt.sign({ userId, role }, SECRET)
const auth = (t) => ({ Authorization: `Bearer ${t}` })
const admin = () => auth(tok('admin1', 'admin'))
const eng   = () => auth(tok('eng1', 'engineer'))

beforeAll(() => { process.env.JWT_SECRET = SECRET })
beforeEach(() => { sb.reset() })

// ══════════════════════════════════════════════════════════════════════════════
describe('GET /push/scheduled — admin xem thông báo đã lên lịch', () => {
  it('403 với kỹ sư', async () => {
    const res = await request(app).get('/api/v1/push/scheduled').set(eng())
    expect(res.status).toBe(403)
  })

  it('200 trả danh sách cho admin', async () => {
    sb.enqueue({ data: [{ id: 'n1', title: 'Cảnh báo rầy', scheduled_at: new Date().toISOString() }], error: null })
    const res = await request(app).get('/api/v1/push/scheduled').set(admin())
    expect(res.status).toBe(200)
    expect(res.body.scheduled).toHaveLength(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('DELETE /push/scheduled/:id — hủy thông báo đã lên lịch', () => {
  it('404 khi không tìm thấy', async () => {
    sb.enqueue({ data: null, error: null })
    const res = await request(app).delete('/api/v1/push/scheduled/nope').set(admin())
    expect(res.status).toBe(404)
  })

  it('400 khi thông báo đã gửi', async () => {
    sb.enqueue({ data: { id: 'n1', sent_at: new Date().toISOString() }, error: null })
    const res = await request(app).delete('/api/v1/push/scheduled/n1').set(admin())
    expect(res.status).toBe(400)
  })

  it('200 hủy thành công khi chưa gửi', async () => {
    sb.enqueue(
      { data: { id: 'n1', sent_at: null }, error: null }, // lookup
      { error: null },                                    // delete
    )
    const res = await request(app).delete('/api/v1/push/scheduled/n1').set(admin())
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('403 với kỹ sư', async () => {
    const res = await request(app).delete('/api/v1/push/scheduled/n1').set(eng())
    expect(res.status).toBe(403)
  })
})
