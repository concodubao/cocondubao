import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

const SECRET = 'test-secret-key'

// Builder Supabase giả kiểu thenable: mỗi await lấy 1 kết quả đã enqueue.
const sb = vi.hoisted(() => {
  const queue = []
  const CHAIN = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'not', 'is', 'single', 'maybeSingle', 'limit', 'order']
  const calls = []
  const makeBuilder = (table) => {
    const b = {}
    for (const m of CHAIN) b[m] = (...args) => { calls.push([table, m, args]); return b }
    b.then = (resolve, reject) => Promise.resolve(queue.length ? queue.shift() : { data: null, error: null }).then(resolve, reject)
    return b
  }
  return {
    supabase: { from: (t) => makeBuilder(t), auth: {} },
    enqueue: (...r) => queue.push(...r),
    reset: () => { queue.length = 0; calls.length = 0 },
    calls,
  }
})

vi.mock('../src/services/supabase.js', () => ({ supabase: sb.supabase }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: {} }) }))

const authRoutes = (await import('../src/routes/auth.js')).default
const { verifyJWT, revokeTokens } = await import('../src/middleware/auth.js')

const app = express()
app.use(express.json())
app.use('/auth', authRoutes)
app.get('/me-check', verifyJWT, (req, res) => res.json({ ok: true }))
app.use((err, req, res, next) => res.status(500).json({ error: 'internal' })) // eslint-disable-line no-unused-vars

beforeAll(() => { process.env.JWT_SECRET = SECRET })
beforeEach(() => { sb.reset() })

describe('POST /auth/register-phone — không cho chiếm tài khoản có sẵn', () => {
  it('409 khi số đã có tài khoản chưa đặt PIN (không ghi đè, không cấp token)', async () => {
    sb.enqueue({ data: { id: 'u-victim', password_hash: null, is_active: true }, error: null })
    const res = await request(app).post('/auth/register-phone').send({ phone: '0912345678', password: '111111' })
    expect(res.status).toBe(409)
    expect(res.body.token).toBeUndefined()
    expect(sb.calls.some(([t, m]) => t === 'users' && m === 'update')).toBe(false)
  })

  it('400 khi số đã có PIN', async () => {
    sb.enqueue({ data: { id: 'u1', password_hash: 'h', is_active: true }, error: null })
    const res = await request(app).post('/auth/register-phone').send({ phone: '0912345678', password: '111111' })
    expect(res.status).toBe(400)
  })

  it('200 tạo tài khoản mới khi số chưa tồn tại', async () => {
    sb.enqueue(
      { data: null, error: null },
      { data: { id: 'u-new', phone: '+84912345678', role: 'farmer', name: null }, error: null },
    )
    const res = await request(app).post('/auth/register-phone').send({ phone: '0912345678', password: '111111' })
    expect(res.status).toBe(200)
    expect(jwt.verify(res.body.token, SECRET).userId).toBe('u-new')
  })
})

describe('phone không phải chuỗi → 400 thay vì unhandled rejection', () => {
  it.each(['/auth/login-phone', '/auth/register-phone'])('%s với phone = số', async (path) => {
    const res = await request(app).post(path).send({ phone: 912345678, password: '111111' })
    expect(res.status).toBe(400)
  })
})

describe('revokeTokens — token cấp trước mốc thu hồi bị từ chối', () => {
  it('token cũ 401, token cấp sau mốc vẫn hợp lệ', async () => {
    const old = jwt.sign({ userId: 'u-rev', role: 'farmer', iat: Math.floor(Date.now() / 1000) - 120 }, SECRET)
    expect((await request(app).get('/me-check').set('Authorization', `Bearer ${old}`)).status).toBe(200)

    sb.enqueue({ data: null, error: null }) // update tokens_valid_after
    await revokeTokens('u-rev')

    expect((await request(app).get('/me-check').set('Authorization', `Bearer ${old}`)).status).toBe(401)
    const fresh = jwt.sign({ userId: 'u-rev', role: 'farmer' }, SECRET)
    expect((await request(app).get('/me-check').set('Authorization', `Bearer ${fresh}`)).status).toBe(200)
  })
})
