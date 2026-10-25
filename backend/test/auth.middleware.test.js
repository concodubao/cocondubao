import { describe, it, expect, beforeAll, vi } from 'vitest'
import jwt from 'jsonwebtoken'

// Middleware giờ import services/supabase.js (denylist tài khoản bị khoá) → mock để
// không tạo client thật (thiếu env trong test sẽ throw "supabaseUrl is required").
const sb = vi.hoisted(() => ({ from: () => ({}) }))
vi.mock('../src/services/supabase.js', () => ({ supabase: { from: (...a) => sb.from(...a) } }))

const { verifyJWT, requireRole, markInactive, markActive, refreshInactiveUsers, setUserRole } =
  await import('../src/middleware/auth.js')

const SECRET = 'test-secret-key'

// Helper: tạo req/res/next giả lập Express
function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
  }
}

beforeAll(() => {
  process.env.JWT_SECRET = SECRET
})

describe('verifyJWT', () => {
  it('trả 401 khi không có header Authorization', () => {
    const req = { headers: {} }
    const res = mockRes()
    const next = vi.fn()

    verifyJWT(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('trả 401 khi header không bắt đầu bằng "Bearer "', () => {
    const req = { headers: { authorization: 'Token abc' } }
    const res = mockRes()
    const next = vi.fn()

    verifyJWT(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('trả 401 khi token sai/không verify được', () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' } }
    const res = mockRes()
    const next = vi.fn()

    verifyJWT(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('trả 401 khi token ký bằng secret khác', () => {
    const token = jwt.sign({ userId: 'u1', role: 'farmer' }, 'wrong-secret')
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = mockRes()
    const next = vi.fn()

    verifyJWT(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('gọi next() và gắn req.user khi token hợp lệ', () => {
    const token = jwt.sign({ userId: 'u1', role: 'farmer', phone: '+84901234567' }, SECRET)
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = mockRes()
    const next = vi.fn()

    verifyJWT(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.statusCode).toBeNull()
    expect(req.user.userId).toBe('u1')
    expect(req.user.role).toBe('farmer')
  })

  it('trả 401 khi tài khoản bị khoá dù token còn hạn', () => {
    const token = jwt.sign({ userId: 'banned1', role: 'farmer' }, SECRET)
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = mockRes()
    const next = vi.fn()

    markInactive('banned1')
    verifyJWT(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('cho qua lại sau khi mở khoá (markActive)', () => {
    const token = jwt.sign({ userId: 'banned1', role: 'farmer' }, SECRET)
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = mockRes()
    const next = vi.fn()

    markActive('banned1')
    verifyJWT(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.statusCode).toBeNull()
  })

  it('trả 401 khi token đã hết hạn', () => {
    const token = jwt.sign({ userId: 'u1', role: 'farmer' }, SECRET, { expiresIn: -10 })
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = mockRes()
    const next = vi.fn()

    verifyJWT(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })
})

describe('verifyJWT — vai trò staff đã đổi', () => {
  // DB: eng1 vẫn là engineer; admin1 đã bị hạ xuống farmer (không còn trong danh sách staff)
  beforeAll(async () => {
    const result = (q) => ({ data: q === 'staff' ? [{ id: 'eng1', role: 'engineer' }] : [], error: null })
    sb.from = () => ({
      select: () => ({
        eq: () => Promise.resolve(result('inactive')),
        in: () => Promise.resolve(result('staff')),
      }),
    })
    await refreshInactiveUsers()
  })

  const call = (payload) => {
    const req = { headers: { authorization: `Bearer ${jwt.sign(payload, SECRET)}` } }
    const res = mockRes()
    const next = vi.fn()
    verifyJWT(req, res, next)
    return { res, next }
  }

  it('token admin của người đã bị hạ quyền → 401 (bắt đăng nhập lại)', () => {
    const { res, next } = call({ userId: 'admin1', role: 'admin' })
    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('token engineer khớp vai trò hiện tại → cho qua', () => {
    const { next } = call({ userId: 'eng1', role: 'engineer' })
    expect(next).toHaveBeenCalledOnce()
  })

  it('token farmer không bị ảnh hưởng', () => {
    const { next } = call({ userId: 'f1', role: 'farmer' })
    expect(next).toHaveBeenCalledOnce()
  })

  it('setUserRole (admin vừa tạo/đổi vai trò) có hiệu lực ngay, không chờ poller', () => {
    setUserRole('new1', 'engineer')
    expect(call({ userId: 'new1', role: 'engineer' }).next).toHaveBeenCalledOnce()
    setUserRole('new1', 'farmer')
    expect(call({ userId: 'new1', role: 'engineer' }).res.statusCode).toBe(401)
  })
})

describe('requireRole', () => {
  it('trả 401 khi chưa có req.user', () => {
    const middleware = requireRole('admin')
    const req = {}
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('trả 403 khi role không nằm trong danh sách cho phép', () => {
    const middleware = requireRole('engineer', 'admin')
    const req = { user: { role: 'farmer' } }
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res, next)

    expect(res.statusCode).toBe(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('gọi next() khi role được phép', () => {
    const middleware = requireRole('engineer', 'admin')
    const req = { user: { role: 'engineer' } }
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.statusCode).toBeNull()
  })

  it('admin được phép khi danh sách gồm admin', () => {
    const middleware = requireRole('admin')
    const req = { user: { role: 'admin' } }
    const res = mockRes()
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalledOnce()
  })
})
