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
vi.mock('../src/services/rag.js', () => ({
  embedAndStoreDoc: vi.fn().mockResolvedValue({ chunksCreated: 1 }),
}))

const adminRoutes = (await import('../src/routes/admin.js')).default
const app = express()
app.use(express.json())
app.use('/api/v1/admin', adminRoutes)

const tok  = (userId, role) => jwt.sign({ userId, role }, SECRET)
const auth = (t) => ({ Authorization: `Bearer ${t}` })
const admin = () => auth(tok('admin1', 'admin'))
const eng   = () => auth(tok('eng1', 'engineer'))

beforeAll(() => { process.env.JWT_SECRET = SECRET })
beforeEach(() => { sb.reset() })

// ══════════════════════════════════════════════════════════════════════════════
describe('POST /admin/knowledge-qa', () => {
  it('200 cho kỹ sư (được cấp quyền soát chất lượng AI)', async () => {
    sb.enqueue({ data: { id: 'd1' }, error: null }) // insert knowledge_docs
    const res = await request(app).post('/api/v1/admin/knowledge-qa').set(eng())
      .send({ question: 'Lúa vàng lá?', answer: 'Bón đạm cân đối.' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('400 khi thiếu câu hỏi hoặc câu trả lời', async () => {
    const res = await request(app).post('/api/v1/admin/knowledge-qa').set(admin())
      .send({ question: 'q', answer: '   ' })
    expect(res.status).toBe(400)
  })

  it('200 tạo QA thành công', async () => {
    sb.enqueue({ data: { id: 'd1' }, error: null }) // insert knowledge_docs
    const res = await request(app).post('/api/v1/admin/knowledge-qa').set(admin())
      .send({ question: 'Lúa vàng lá?', answer: 'Bón đạm cân đối.' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('GET /admin/ai-review', () => {
  it('200 cho kỹ sư (được cấp quyền soát chất lượng AI)', async () => {
    sb.enqueue({ data: [], error: null }) // không có câu trả lời nào → items rỗng
    const res = await request(app).get('/api/v1/admin/ai-review').set(eng())
    expect(res.status).toBe(200)
    expect(res.body.items).toEqual([])
  })

  it('200 trả câu trả lời AI kèm câu hỏi gốc', async () => {
    const t = new Date().toISOString()
    const earlier = new Date(Date.now() - 60_000).toISOString()
    sb.enqueue(
      { data: [{ content: 'Câu trả lời AI', confidence: 0.4, source: 'rag', session_id: 's1', created_at: t }], error: null },
      { data: [{ session_id: 's1', content: 'Câu hỏi gốc', created_at: earlier }], error: null },
    )
    const res = await request(app).get('/api/v1/admin/ai-review').set(admin())
    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].question).toBe('Câu hỏi gốc')
    expect(res.body.items[0].confidence).toBe(0.4)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('GET /admin/knowledge-gaps', () => {
  it('403 với kỹ sư', async () => {
    const res = await request(app).get('/api/v1/admin/knowledge-gaps').set(eng())
    expect(res.status).toBe(403)
  })

  it('200 trả câu hỏi confidence thấp', async () => {
    const t = new Date().toISOString()
    const earlier = new Date(Date.now() - 60_000).toISOString()
    sb.enqueue(
      { data: [{ content: 'a', confidence: 0.3, session_id: 's1', created_at: t }], error: null },
      { data: [{ session_id: 's1', content: 'Câu hỏi khó', created_at: earlier }], error: null },
    )
    const res = await request(app).get('/api/v1/admin/knowledge-gaps').set(admin())
    expect(res.status).toBe(200)
    expect(res.body.gaps).toHaveLength(1)
    expect(res.body.gaps[0].question).toBe('Câu hỏi khó')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('POST /admin/ai-errors/:id/to-knowledge', () => {
  it('403 với kỹ sư', async () => {
    const res = await request(app).post('/api/v1/admin/ai-errors/e1/to-knowledge').set(eng())
      .send({ question: 'q', answer: 'a' })
    expect(res.status).toBe(403)
  })

  it('400 khi thiếu nội dung', async () => {
    const res = await request(app).post('/api/v1/admin/ai-errors/e1/to-knowledge').set(admin())
      .send({ question: '', answer: 'a' })
    expect(res.status).toBe(400)
  })

  it('200 tạo QA + đánh dấu báo lỗi đã xử lý', async () => {
    sb.enqueue(
      { data: { id: 'd1' }, error: null }, // insert knowledge_docs
      { error: null },                     // update ai_error_reports
    )
    const res = await request(app).post('/api/v1/admin/ai-errors/e1/to-knowledge').set(admin())
      .send({ question: 'Rầy nâu?', answer: 'Phun thuốc đúng liều.' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('PATCH /admin/users/:id — chống admin tự khóa/đổi vai trò mình', () => {
  it('400 khi admin sửa chính tài khoản của mình', async () => {
    const res = await request(app).patch('/api/v1/admin/users/admin1').set(admin())
      .send({ is_active: false })
    expect(res.status).toBe(400)
  })

  it('200 khi sửa tài khoản người khác', async () => {
    sb.enqueue({ data: { id: 'u2', role: 'engineer', is_active: true }, error: null }) // update result
    const res = await request(app).patch('/api/v1/admin/users/u2').set(admin())
      .send({ is_active: true })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('403 với kỹ sư (không phải admin)', async () => {
    const res = await request(app).patch('/api/v1/admin/users/u2').set(eng()).send({ is_active: true })
    expect(res.status).toBe(403)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('PATCH /admin/users/:id/reset-pin — chỉ cho nông dân', () => {
  it('404 khi không tìm thấy người dùng', async () => {
    sb.enqueue({ data: null, error: null }) // target lookup
    const res = await request(app).patch('/api/v1/admin/users/nope/reset-pin').set(admin())
    expect(res.status).toBe(404)
  })

  it('400 khi target không phải nông dân', async () => {
    sb.enqueue({ data: { role: 'engineer' }, error: null }) // target lookup
    const res = await request(app).patch('/api/v1/admin/users/u2/reset-pin').set(admin())
    expect(res.status).toBe(400)
  })

  it('200 + trả PIN 6 số cho nông dân', async () => {
    sb.enqueue(
      { data: { role: 'farmer' }, error: null },                              // target lookup
      { data: { id: 'f1', phone: '+84900000000', name: 'Chú Ba', role: 'farmer' }, error: null }, // update result
    )
    const res = await request(app).patch('/api/v1/admin/users/f1/reset-pin').set(admin())
    expect(res.status).toBe(200)
    expect(res.body.pin).toMatch(/^\d{6}$/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('GET /admin/users/export — xuất CSV', () => {
  it('403 với kỹ sư', async () => {
    const res = await request(app).get('/api/v1/admin/users/export').set(eng())
    expect(res.status).toBe(403)
  })

  it('200 trả CSV (có BOM + tiêu đề + dữ liệu) cho admin', async () => {
    sb.enqueue({ data: [{ name: 'Chú Ba', phone: '+84900000000', role: 'farmer', village: 'Ấp 1', crops: ['rice'], is_active: true, created_at: new Date().toISOString() }], error: null })
    const res = await request(app).get('/api/v1/admin/users/export').set(admin())
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.text).toContain('Tên')
    expect(res.text).toContain('Chú Ba')
    expect(res.text).toContain('Nông dân')
  })
})
