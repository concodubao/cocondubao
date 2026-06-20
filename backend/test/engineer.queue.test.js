import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

const SECRET = 'test-secret-key'

// ─── Mock Supabase: query builder chainable, mỗi lần await trả về 1 kết quả đã xếp hàng ───
const sb = vi.hoisted(() => {
  const queue = []
  const CHAIN = ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order',
                 'range', 'contains', 'is', 'not', 'single', 'limit', 'or']
  const makeBuilder = () => {
    const b = {}
    for (const m of CHAIN) b[m] = () => b
    // builder là thenable: await sẽ lấy kết quả kế tiếp trong hàng đợi
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

vi.mock('../src/services/supabase.js', () => ({ supabase: sb.supabase }))
vi.mock('../src/services/webpush.js', () => ({
  notifyFarmer:   vi.fn().mockResolvedValue(undefined),
  notifyEngineer: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/services/rag.js', () => ({
  embedAndStoreDoc: vi.fn().mockResolvedValue({ chunksCreated: 1 }),
}))

const engineerRoutes = (await import('../src/routes/engineer.js')).default

// ─── Express app test ─────────────────────────────────────────────────────────
const app = express()
app.use(express.json())
app.use('/api/v1/engineer', engineerRoutes)

const engToken    = () => jwt.sign({ userId: 'eng1', role: 'engineer' }, SECRET)
const farmerToken = () => jwt.sign({ userId: 'farmer1', role: 'farmer' }, SECRET)
const auth        = (t) => ({ Authorization: `Bearer ${t}` })

beforeAll(() => { process.env.JWT_SECRET = SECRET })
beforeEach(() => { sb.reset() })

// ══════════════════════════════════════════════════════════════════════════════
describe('GET /engineer/queue', () => {
  it('chặn nông dân (403)', async () => {
    const res = await request(app).get('/api/v1/engineer/queue').set(auth(farmerToken()))
    expect(res.status).toBe(403)
  })

  it('chặn khi chưa đăng nhập (401)', async () => {
    const res = await request(app).get('/api/v1/engineer/queue')
    expect(res.status).toBe(401)
  })

  it('kỹ sư xem được hàng đợi + tính waitMinutes', async () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString()
    sb.enqueue({
      data: [{ id: 'q1', status: 'pending', created_at: fiveMinAgo, messages: { content: 'Lúa bị gì?' } }],
      error: null,
    })

    const res = await request(app).get('/api/v1/engineer/queue').set(auth(engToken()))

    expect(res.status).toBe(200)
    expect(res.body.queue).toHaveLength(1)
    expect(res.body.queue[0].waitMinutes).toBeGreaterThanOrEqual(4)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('PATCH /engineer/queue/:id/take — atomic, chống race condition', () => {
  it('nhận thành công khi câu hỏi còn pending (200)', async () => {
    sb.enqueue({ data: [{ id: 'q1', status: 'in_progress', assigned_to: 'eng1' }], error: null })

    const res = await request(app).patch('/api/v1/engineer/queue/q1/take').set(auth(engToken()))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('trả 409 khi câu hỏi đã bị kỹ sư khác nhận', async () => {
    // update ảnh hưởng 0 hàng (đã bị nhận) → handler query lại để phân biệt
    sb.enqueue(
      { data: [], error: null },                       // update ... .select() → rỗng
      { data: { status: 'in_progress' }, error: null }, // select status → tồn tại
    )

    const res = await request(app).patch('/api/v1/engineer/queue/q1/take').set(auth(engToken()))

    expect(res.status).toBe(409)
  })

  it('trả 404 khi câu hỏi không tồn tại', async () => {
    sb.enqueue(
      { data: [], error: null },     // update rỗng
      { data: null, error: null },   // select status → không có
    )

    const res = await request(app).patch('/api/v1/engineer/queue/nope/take').set(auth(engToken()))

    expect(res.status).toBe(404)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('PATCH /engineer/queue/:id/answer', () => {
  it('trả 400 khi câu trả lời rỗng', async () => {
    const res = await request(app)
      .patch('/api/v1/engineer/queue/q1/answer')
      .set(auth(engToken()))
      .send({ answer: '   ' })

    expect(res.status).toBe(400)
  })

  it('lưu câu trả lời thành công khi kỹ sư xử lý câu của mình (200)', async () => {
    sb.enqueue(
      { // queueItem
        data: {
          message_id: 'm1', assigned_to: 'eng1', status: 'in_progress',
          messages: { session_id: 's1', content: 'Lúa bị gì?', chat_sessions: { user_id: 'farmer1' } },
        },
        error: null,
      },
      { data: null, error: null }, // insert messages
      { data: null, error: null }, // update engineer_queue
    )

    const res = await request(app)
      .patch('/api/v1/engineer/queue/q1/answer')
      .set(auth(engToken()))
      .send({ answer: 'Bón thêm urê 5kg/công nhé bà con.', addToKnowledge: false })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('trả 403 khi câu hỏi đang do kỹ sư khác xử lý', async () => {
    sb.enqueue({
      data: {
        message_id: 'm1', assigned_to: 'eng2', status: 'in_progress',
        messages: { session_id: 's1', content: 'Lúa bị gì?', chat_sessions: { user_id: 'farmer1' } },
      },
      error: null,
    })

    const res = await request(app)
      .patch('/api/v1/engineer/queue/q1/answer')
      .set(auth(engToken()))
      .send({ answer: 'Câu trả lời chen ngang' })

    expect(res.status).toBe(403)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('DELETE /engineer/queue/:id', () => {
  it('xóa được câu hỏi còn pending (200)', async () => {
    sb.enqueue(
      { data: { id: 'q1', status: 'pending', assigned_to: null }, error: null },
      { error: null },
    )

    const res = await request(app).delete('/api/v1/engineer/queue/q1').set(auth(engToken()))

    expect(res.status).toBe(200)
  })

  it('không cho xóa câu hỏi đã resolved (400)', async () => {
    sb.enqueue({ data: { id: 'q1', status: 'resolved', assigned_to: 'eng1' }, error: null })

    const res = await request(app).delete('/api/v1/engineer/queue/q1').set(auth(engToken()))

    expect(res.status).toBe(400)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('GET /engineer/queue/:id — lấy 1 câu hỏi (deep-link Answer page)', () => {
  it('chặn nông dân (403)', async () => {
    const res = await request(app).get('/api/v1/engineer/queue/q1').set(auth(farmerToken()))
    expect(res.status).toBe(403)
  })

  it('404 khi không tìm thấy', async () => {
    sb.enqueue({ data: null, error: { message: 'not found' } })
    const res = await request(app).get('/api/v1/engineer/queue/nope').set(auth(engToken()))
    expect(res.status).toBe(404)
  })

  it('200 trả item kèm waitMinutes', async () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString()
    sb.enqueue({ data: { id: 'q1', status: 'pending', created_at: tenMinAgo, messages: { content: 'Lúa?' } }, error: null })
    const res = await request(app).get('/api/v1/engineer/queue/q1').set(auth(engToken()))
    expect(res.status).toBe(200)
    expect(res.body.item.id).toBe('q1')
    expect(res.body.item.waitMinutes).toBeGreaterThanOrEqual(9)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('GET /docs/:id — xem nội dung tài liệu trước khi duyệt', () => {
  it('chặn nông dân (403)', async () => {
    const res = await request(app).get('/api/v1/engineer/docs/d1').set(auth(farmerToken()))
    expect(res.status).toBe(403)
  })

  it('404 khi không tìm thấy', async () => {
    sb.enqueue({ data: null, error: { message: 'not found' } })
    const res = await request(app).get('/api/v1/engineer/docs/nope').set(auth(engToken()))
    expect(res.status).toBe(404)
  })

  it('200 trả tài liệu kèm content', async () => {
    sb.enqueue({ data: { id: 'd1', title: 'Bệnh đạo ôn', status: 'draft', content: 'Nội dung tài liệu...' }, error: null })
    const res = await request(app).get('/api/v1/engineer/docs/d1').set(auth(engToken()))
    expect(res.status).toBe(200)
    expect(res.body.doc.content).toContain('Nội dung')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('PATCH /engineer/queue/:id/answer — sửa câu đã trả lời = ghi đè', () => {
  it('ghi đè message engineer cũ thay vì tạo trùng (updated=true)', async () => {
    sb.enqueue(
      { // queueItem đã resolved, có answer cũ
        data: {
          message_id: 'm1', assigned_to: 'eng1', status: 'resolved', answer: 'Câu trả lời cũ',
          messages: { session_id: 's1', content: 'Lúa bị gì?', chat_sessions: { user_id: 'farmer1' } },
        },
        error: null,
      },
      { data: [{ id: 'pm1' }], error: null }, // tìm message engineer cũ theo nội dung
      { data: null, error: null },            // update message (ghi đè)
      { data: null, error: null },            // update engineer_queue
    )

    const res = await request(app)
      .patch('/api/v1/engineer/queue/q1/answer')
      .set(auth(engToken()))
      .send({ answer: 'Câu trả lời đã chỉnh sửa, chi tiết hơn.', addToKnowledge: false })

    expect(res.status).toBe(200)
    expect(res.body.updated).toBe(true)
  })

  it('không tìm thấy message cũ → chèn mới (updated=false)', async () => {
    sb.enqueue(
      {
        data: {
          message_id: 'm1', assigned_to: 'eng1', status: 'resolved', answer: 'Câu cũ',
          messages: { session_id: 's1', content: 'Lúa?', chat_sessions: { user_id: 'farmer1' } },
        },
        error: null,
      },
      { data: [], error: null },   // không tìm thấy message cũ
      { data: null, error: null }, // insert message mới
      { data: null, error: null }, // update engineer_queue
    )

    const res = await request(app)
      .patch('/api/v1/engineer/queue/q1/answer')
      .set(auth(engToken()))
      .send({ answer: 'Câu trả lời thay thế đủ dài.', addToKnowledge: false })

    expect(res.status).toBe(200)
    expect(res.body.updated).toBe(false)
  })
})
