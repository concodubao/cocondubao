import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

const SECRET = 'test-secret-key'

// ─── Mock Supabase chainable (giống engineer.queue.test.js) ───
const sb = vi.hoisted(() => {
  const queue = []
  const inserts = []
  const CHAIN = ['select','insert','update','delete','eq','in','order','range',
                 'contains','is','not','single','maybeSingle','limit','or','gte','lt','lte','gt','ilike']
  const makeBuilder = table => {
    const b = {}
    for (const m of CHAIN) b[m] = () => b
    b.insert = row => { inserts.push({ table, row }); return b }
    b.then = (resolve, reject) => {
      const r = queue.length ? queue.shift() : { data: null, error: null }
      return Promise.resolve(r).then(resolve, reject)
    }
    return b
  }
  return { supabase: { from: makeBuilder }, inserts, enqueue: (...r) => queue.push(...r),
    reset: () => { queue.length = 0; inserts.length = 0 } }
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
// sharp là native module — không cần thật trong test access (không xử lý ảnh),
// mock để khỏi phụ thuộc binary theo nền tảng (CI linux vs dev win32).
vi.mock('sharp', () => ({ default: vi.fn() }))

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
describe('POST /chat/ask — testMode (Test AI của kỹ sư) không lưu dữ liệu', () => {
  it('kỹ sư testMode → 200, không tạo session, testMode=true', async () => {
    // Không enqueue kết quả supabase nào: nếu handler lỡ ghi DB, mock trả null
    // nhưng test khẳng định response không có sessionId (không tạo phiên thật).
    const res = await request(app).post('/api/v1/chat/ask')
      .set(auth(tok('eng1', 'engineer')))
      .send({ text: 'Lúa bị vàng lá?', testMode: true })
    expect(res.status).toBe(200)
    expect(res.body.testMode).toBe(true)
    expect(res.body.sessionId).toBeNull()
    expect(res.body.engineerQueued).toBe(false)
  })

  it('nông dân gửi testMode vẫn đi luồng thật (lưu session, không có cờ testMode)', async () => {
    sb.enqueue(
      { data: { id: 's1' }, error: null },  // getOrCreateSession insert
      { data: { id: 'um1' }, error: null }, // insert user message
      { data: { id: 'am1' }, error: null }, // insert answer message
    )
    const res = await request(app).post('/api/v1/chat/ask')
      .set(auth(tok('farmer1', 'farmer')))
      .send({ text: 'Lúa bị vàng lá?', testMode: true })
    expect(res.status).toBe(200)
    expect(res.body.testMode).toBeUndefined()
    expect(res.body.sessionId).toBe('s1')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe.each(['/ask', '/ask-with-image'])('Engineer handoff through %s', path => {
  it.each([true, false])('records the queue outcome (queued=%s)', async queued => {
    const { askRAG } = await import('../src/services/rag.js')
    askRAG.mockResolvedValueOnce({ answer: null, confidence: 0.1, source: 'rag', needEngineer: true })
    sb.enqueue({ data: { id: 's1' } }, { data: { id: 'question' } },
      { error: queued ? null : { message: 'unavailable' } }, { data: { id: 'reply' } })
    const res = await request(app).post('/api/v1/chat' + path)
      .set(auth(tok('farmer1', 'farmer'))).send({ text: 'Lúa bị vàng lá?' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ engineerQueued: queued, needEngineer: true, messageId: 'reply' })
    expect(sb.inserts.map(i => i.table)).toEqual(['chat_sessions', 'messages', 'engineer_queue', 'messages'])
    expect(sb.inserts.at(-1).row.content).toContain(queued ? 'đã được chuyển' : 'Chưa gửi được')
  })
})

describe('POST /chat/escalate — nông dân xin kỹ sư xem lại', () => {
  const farmer = () => auth(tok('farmer1', 'farmer'))
  const ansMsg = (userId) => ({ id: 'm1', session_id: 's1', created_at: new Date().toISOString(), chat_sessions: { user_id: userId } })

  it('400 khi thiếu messageId', async () => {
    const res = await request(app).post('/api/v1/chat/escalate').set(farmer()).send({})
    expect(res.status).toBe(400)
  })

  it('404 khi không tìm thấy câu trả lời', async () => {
    sb.enqueue({ data: null, error: null })
    const res = await request(app).post('/api/v1/chat/escalate').set(farmer()).send({ messageId: 'm1' })
    expect(res.status).toBe(404)
  })

  it('403 khi tin nhắn thuộc nông dân khác', async () => {
    sb.enqueue({ data: ansMsg('other'), error: null })
    const res = await request(app).post('/api/v1/chat/escalate').set(farmer()).send({ messageId: 'm1' })
    expect(res.status).toBe(403)
  })

  it('200 tạo hàng đợi khi chưa có', async () => {
    sb.enqueue(
      { data: ansMsg('farmer1'), error: null },
      { data: [{ id: 'uq1', content: 'Lúa bị gì?' }], error: null }, // câu hỏi gốc
      { data: [], error: null },                                     // chưa có trong queue
      { data: null, error: null },                                   // insert queue
    )
    const res = await request(app).post('/api/v1/chat/escalate').set(farmer()).send({ messageId: 'm1' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.already).toBeUndefined()
  })

  it('200 already=true khi câu hỏi đã trong hàng đợi', async () => {
    sb.enqueue(
      { data: ansMsg('farmer1'), error: null },
      { data: [{ id: 'uq1', content: 'Lúa bị gì?' }], error: null },
      { data: [{ id: 'q1' }], error: null }, // đã có trong queue
    )
    const res = await request(app).post('/api/v1/chat/escalate').set(farmer()).send({ messageId: 'm1' })
    expect(res.status).toBe(200)
    expect(res.body.already).toBe(true)
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

// ══════════════════════════════════════════════════════════════════════════════
// Bug 2026-11-13: CHECK messages_source_check cũ chặn 'qa_direct', 'faq', '*_cached'…
// → câu trả lời không được lưu (mất lịch sử, hỏng "Hỏi lại kỹ sư").
describe('insertAnswerMessage — không làm mất câu trả lời khi DB chặn source', () => {
  const row = { session_id: 's1', role: 'assistant', content: 'đáp', confidence: 0.9, source: 'qa_direct_semcached' }

  it('lưu bình thường → trả id', async () => {
    const { insertAnswerMessage } = await import('../src/routes/chat.js')
    sb.enqueue({ data: { id: 'a1' }, error: null })
    expect(await insertAnswerMessage(row)).toEqual({ id: 'a1' })
  })

  it('vi phạm CHECK (23514) → lưu lại với source=null, vẫn trả id', async () => {
    const { insertAnswerMessage } = await import('../src/routes/chat.js')
    sb.enqueue(
      { data: null, error: { code: '23514', message: 'violates check constraint "messages_source_check"' } },
      { data: { id: 'a2' }, error: null },
    )
    expect(await insertAnswerMessage(row)).toEqual({ id: 'a2' })
  })

  it('lỗi khác → null (không ném)', async () => {
    const { insertAnswerMessage } = await import('../src/routes/chat.js')
    sb.enqueue({ data: null, error: { code: '08006', message: 'connection failure' } })
    expect(await insertAnswerMessage(row)).toBeNull()
  })

  it('/ask trả messageId kể cả khi lần lưu đầu bị CHECK chặn', async () => {
    sb.enqueue(
      { data: { id: 'sess1' }, error: null },                                   // tạo session
      { data: { id: 'u1' }, error: null },                                      // lưu câu hỏi
      { data: null, error: { code: '23514', message: 'check' } },               // lưu đáp: bị chặn
      { data: { id: 'a3' }, error: null },                                      // lưu lại source=null
    )
    const res = await request(app).post('/api/v1/chat/ask')
      .set(auth(tok('farmer1', 'farmer'))).send({ text: 'Lúa bị đạo ôn lá?' })
    expect(res.status).toBe(200)
    expect(res.body.messageId).toBe('a3')
  })
})
