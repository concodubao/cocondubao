import { describe, it, expect, beforeAll, vi } from 'vitest'
import jwt from 'jsonwebtoken'

// Middleware giờ import services/supabase.js (denylist tài khoản bị khoá) → mock để
// không tạo client thật (thiếu env trong test sẽ throw "supabaseUrl is required").
vi.mock('../src/services/supabase.js', () => ({ supabase: { from: () => ({}) } }))

const { verifyJWT, requireRole, markInactive, markActive } = await import('../src/middleware/auth.js')

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
