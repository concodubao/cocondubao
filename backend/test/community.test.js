import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

const SECRET = 'test-secret-key'

// ─── Mock Supabase chainable (giống các test khác) ───
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
// sharp là native module — mock để test không phụ thuộc binary theo nền tảng
vi.mock('sharp', () => ({ default: vi.fn() }))

const communityRoutes = (await import('../src/routes/community.js')).default
const app = express()
app.use(express.json())
app.use('/api/v1/community', communityRoutes)

const tok  = (userId, role = 'farmer') => jwt.sign({ userId, role }, SECRET)
const auth = (t) => ({ Authorization: `Bearer ${t}` })

beforeAll(() => { process.env.JWT_SECRET = SECRET })
beforeEach(() => { sb.reset() })

// ══════════════════════════════════════════════════════════════════════════════
describe('GET /community/posts/:id — lấy 1 bài (deep-link / F5)', () => {
  it('401 khi chưa đăng nhập', async () => {
    const res = await request(app).get('/api/v1/community/posts/p1')
    expect(res.status).toBe(401)
  })

  it('404 khi bài không tồn tại', async () => {
    sb.enqueue({ data: null, error: { message: 'not found' } })
    const res = await request(app).get('/api/v1/community/posts/nope').set(auth(tok('f1')))
    expect(res.status).toBe(404)
  })

  it('200 trả bài kèm likeCount/commentCount/likedByMe', async () => {
    sb.enqueue(
      { // post
        data: {
          id: 'p1', content: 'Trúng mùa!', image_url: null, crop_tags: ['rice'], created_at: new Date().toISOString(),
          users: { id: 'f2', name: 'Chú Ba', village: 'Ấp 1', role: 'farmer' },
          post_likes: [{ count: 3 }],
          comments:   [{ count: 2 }],
        },
        error: null,
      },
      { data: { post_id: 'p1' }, error: null }, // myLike → đã like
    )
    const res = await request(app).get('/api/v1/community/posts/p1').set(auth(tok('f1')))
    expect(res.status).toBe(200)
    expect(res.body.post.likeCount).toBe(3)
    expect(res.body.post.commentCount).toBe(2)
    expect(res.body.post.likedByMe).toBe(true)
    expect(res.body.post.post_likes).toBeUndefined()
  })

  it('likedByMe=false khi chưa like', async () => {
    sb.enqueue(
      { data: { id: 'p1', post_likes: [{ count: 0 }], comments: [{ count: 0 }], users: {} }, error: null },
      { data: null, error: null }, // myLike → chưa like
    )
    const res = await request(app).get('/api/v1/community/posts/p1').set(auth(tok('f1')))
    expect(res.status).toBe(200)
    expect(res.body.post.likedByMe).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('POST /community/posts/:id/report — báo cáo nội dung', () => {
  it('200 khi báo cáo bài tồn tại', async () => {
    sb.enqueue(
      { data: { id: 'p1' }, error: null }, // select target
      { error: null },                      // insert content_reports
    )
    const res = await request(app).post('/api/v1/community/posts/p1/report')
      .send({ reason: 'spam' }).set(auth(tok('f1')))
    expect(res.status).toBe(200)
    expect(res.body.already).toBeFalsy()
  })

  it('idempotent khi đã báo cáo (unique 23505) → already', async () => {
    sb.enqueue(
      { data: { id: 'p1' }, error: null },
      { error: { code: '23505' } },
    )
    const res = await request(app).post('/api/v1/community/posts/p1/report')
      .send({}).set(auth(tok('f1')))
    expect(res.status).toBe(200)
    expect(res.body.already).toBe(true)
  })

  it('404 khi nội dung không tồn tại', async () => {
    sb.enqueue({ data: null, error: null })
    const res = await request(app).post('/api/v1/community/comments/c9/report')
      .send({}).set(auth(tok('f1')))
    expect(res.status).toBe(404)
  })
})

describe('PATCH /community/reports/dismiss — admin bỏ qua', () => {
  it('403 với nông dân', async () => {
    const res = await request(app).patch('/api/v1/community/reports/dismiss')
      .send({ targetType: 'post', targetId: 'p1' }).set(auth(tok('f1', 'farmer')))
    expect(res.status).toBe(403)
  })

  it('200 với admin', async () => {
    sb.enqueue({ error: null })
    const res = await request(app).patch('/api/v1/community/reports/dismiss')
      .send({ targetType: 'post', targetId: 'p1' }).set(auth(tok('a1', 'admin')))
    expect(res.status).toBe(200)
  })

  it('400 khi thiếu tham số', async () => {
    const res = await request(app).patch('/api/v1/community/reports/dismiss')
      .send({ targetType: 'invalid' }).set(auth(tok('a1', 'admin')))
    expect(res.status).toBe(400)
  })
})
