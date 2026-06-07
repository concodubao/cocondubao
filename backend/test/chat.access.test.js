import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

const SECRET = 'test-secret-key'

// ─── Mock Supabase chainable (giống engineer.queue.test.js) ───
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
vi.mock('../src/services/webpush.js', () => ({
  notifyFarmer: vi.fn().mockResolvedValue(undefined),
  notifyEngineer: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/services/rag.js', () => ({
  askRAG: vi.fn().mockResolvedValue({ answer: 'x', confidence: 0.9, source: 'rag', needEngineer: false }),
  embedAndStoreDoc: vi.fn().mockResolvedValue({ chunksCreated: 1 }),
}))

const chatRoutes = (await import('../src/routes/chat.js')).default
const app = express()
app.use(express.json())
app.use('/api/v1/chat', chatRoutes)

const tok  = (userId, role) => jwt.sign({ userId, role }, SECRET)
const auth = (t) => ({ Authorization: `Bearer ${t}` })

beforeAll(() => { process.env.JWT_SECRET = SECRET })
beforeEach(() => { sb.reset() })

// ══════════════════════════════════════════════════════════════════════════════
describe('POST /chat/report-error — chỉ báo lỗi message của chính mình', () => {
  it('400 khi thiếu messageId', async () => {
    const res = await request(app).post('/api/v1/chat/report-error')
      .set(auth(tok('farmer1', 'farmer'))).send({ errorType: 'wrong_info' })
    expect(res.status).toBe(400)
  })

  it('400 khi errorType không hợp lệ', async () => {
    const res = await request(app).post('/api/v1/chat/report-error')
      .set(auth(tok('farmer1', 'farmer'))).send({ messageId: 'm1', errorType: 'xxx' })
    expect(res.status).toBe(400)
  })

  it('404 khi message không tồn tại', async () => {
    sb.enqueue({ data: null, error: null })
    const res = await request(app).post('/api/v1/chat/report-error')
      .set(auth(tok('farmer1', 'farmer'))).send({ messageId: 'm1', errorType: 'wrong_info' })
    expect(res.status).toBe(404)
  })

  it('403 khi message thuộc về nông dân khác', async () => {
    sb.enqueue({ data: { id: 'm1', chat_sessions: { user_id: 'other' } }, error: null })
    const res = await request(app).post('/api/v1/chat/report-error')
      .set(auth(tok('farmer1', 'farmer'))).send({ messageId: 'm1', errorType: 'wrong_info' })
    expect(res.status).toBe(403)
  })

  it('200 khi message thuộc về chính mình', async () => {
    sb.enqueue(
      { data: { id: 'm1', chat_sessions: { user_id: 'farmer1' } }, error: null }, // lookup
      { data: null, error: null },                                                // insert report
    )
    const res = await request(app).post('/api/v1/chat/report-error')
      .set(auth(tok('farmer1', 'farmer'))).send({ messageId: 'm1', errorType: 'wrong_info' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('GET /chat/sessions/:userId — chỉ chủ phiên', () => {
  it('403 khi xem lịch sử của người khác (kể cả staff)', async () => {
    const res = await request(app).get('/api/v1/chat/sessions/farmer2').set(auth(tok('eng1', 'engineer')))
    expect(res.status).toBe(403)
  })

  it('200 khi xem lịch sử của chính mình', async () => {
    sb.enqueue(
      { data: [{ id: 's1', crop_type: 'rice', status: 'active', created_at: new Date().toISOString(), messages: [{ count: 2 }] }], error: null },
      { data: [{ session_id: 's1', content: 'Lúa bị gì?' }], error: null },
    )
    const res = await request(app).get('/api/v1/chat/sessions/farmer1').set(auth(tok('farmer1', 'farmer')))
    expect(res.status).toBe(200)
    expect(res.body.sessions).toHaveLength(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('GET /chat/messages/:sessionId — staff chỉ đọc phiên đã escalate', () => {
  it('404 khi session không tồn tại', async () => {
    sb.enqueue({ data: null, error: null })
    const res = await request(app).get('/api/v1/chat/messages/s1').set(auth(tok('farmer1', 'farmer')))
    expect(res.status).toBe(404)
  })

  it('200 cho chủ phiên', async () => {
    sb.enqueue(
      { data: { user_id: 'farmer1' }, error: null },        // session
      { data: [{ id: 'm1', content: 'hi' }], error: null }, // messages
    )
    const res = await request(app).get('/api/v1/chat/messages/s1').set(auth(tok('farmer1', 'farmer')))
    expect(res.status).toBe(200)
    expect(res.body.messages).toHaveLength(1)
  })

  it('403 khi nông dân khác (không phải chủ, không phải staff)', async () => {
    sb.enqueue({ data: { user_id: 'farmer1' }, error: null }) // session
    const res = await request(app).get('/api/v1/chat/messages/s1').set(auth(tok('farmer2', 'farmer')))
    expect(res.status).toBe(403)
  })

  it('403 cho staff khi phiên CHƯA escalate', async () => {
    sb.enqueue(
      { data: { user_id: 'farmer1' }, error: null }, // session (không phải chủ)
      { data: [{ id: 'm1' }], error: null },         // messages của phiên
      { data: [], error: null },                     // engineer_queue: rỗng → chưa escalate
    )
    const res = await request(app).get('/api/v1/chat/messages/s1').set(auth(tok('eng1', 'engineer')))
    expect(res.status).toBe(403)
  })

  it('200 cho staff khi phiên ĐÃ escalate', async () => {
    sb.enqueue(
      { data: { user_id: 'farmer1' }, error: null },        // session
      { data: [{ id: 'm1' }], error: null },                // messages của phiên
      { data: [{ id: 'q1' }], error: null },                // engineer_queue có item → escalate
      { data: [{ id: 'm1', content: 'hi' }], error: null }, // messages trả về
    )
    const res = await request(app).get('/api/v1/chat/messages/s1').set(auth(tok('eng1', 'engineer')))
    expect(res.status).toBe(200)
    expect(res.body.messages).toHaveLength(1)
  })
})
