import jwt from 'jsonwebtoken'
import { supabase } from '../services/supabase.js'
import * as Sentry from '@sentry/node'

// ─── Denylist tài khoản bị khoá (in-memory) ──────────────────────────────────
// JWT sống 7–30 ngày nên không thể chỉ tin payload: admin khoá tài khoản phải có
// hiệu lực sớm. Thay vì query DB mỗi request (tốn + phá vỡ tính đồng bộ), giữ một
// Set userId đang bị khoá:
//   - admin khoá/mở khoá → cập nhật Set tức thì (markInactive/markActive)
//   - poller nền (60s) đồng bộ lại từ DB → bắt được cả khi vừa restart process
// In-memory nên đúng khi 1 replica (giống answer-cache/scheduler trong dự án).
const _inactiveUsers = new Set()

export function markInactive(userId) { _inactiveUsers.add(userId) }
export function markActive(userId)   { _inactiveUsers.delete(userId) }

// ─── Vai trò staff hiện hành (chống JWT mang vai trò cũ) ─────────────────────
// Role nằm trong JWT nên admin hạ quyền (admin→farmer, engineer→farmer) trước đây
// KHÔNG có hiệu lực tới khi token hết hạn (7–30 ngày). Giữ Map userId→role của mọi
// tài khoản engineer/admin; token tự nhận là staff mà role thật khác → bắt đăng
// nhập lại. Chỉ kiểm khi Map đã nạp xong (tránh chặn nhầm lúc vừa boot).
// Token farmer được thăng lên staff thì vẫn chạy quyền farmer (ít quyền hơn) tới
// khi đăng nhập lại — an toàn.
const STAFF_ROLES = ['engineer', 'admin']
const _staffRoles = new Map()
let _staffRolesLoaded = false

// ─── Thu hồi token theo thời điểm (đổi/đặt lại PIN, khoá tài khoản) ───────────
// JWT không có version → đổi PIN/admin đặt lại PIN không làm token cũ (tới 30 ngày)
// mất hiệu lực; mở khoá còn "hồi sinh" mọi token cũ. Lưu users.tokens_valid_after:
// token có iat trước mốc đó bị từ chối. Cột cần migration
// 20261025000000_security_hardening.sql — chưa áp thì poller lỗi êm, bỏ qua kiểm tra.
// Mốc làm tròn xuống giây (iat theo giây) để token cấp lại ngay sau đó vẫn hợp lệ.
const _tokensValidAfter = new Map() // userId → ms

export async function revokeTokens(userId) {
  const at = Math.floor(Date.now() / 1000) * 1000
  _tokensValidAfter.set(userId, at)
  try {
    const { error } = await supabase.from('users')
      .update({ tokens_valid_after: new Date(at).toISOString() }).eq('id', userId)
    if (error) console.warn('[AUTH] revokeTokens chưa lưu DB (thiếu migration?):', error.message)
  } catch (err) {
    console.warn('[AUTH] revokeTokens error:', err.message)
  }
}

export function setUserRole(userId, role) {
  if (STAFF_ROLES.includes(role)) _staffRoles.set(userId, role)
  else _staffRoles.delete(userId)
}

// Nạp lại danh sách userId bị khoá + vai trò staff từ DB (gọi khi boot + định kỳ).
export async function refreshInactiveUsers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('is_active', false)
    // Mỗi khối độc lập: 1 truy vấn lỗi KHÔNG được làm bỏ qua các khối sau.
    if (error) console.warn('[AUTH] refresh inactive users failed:', error.message)
    else {
      _inactiveUsers.clear()
      for (const u of data || []) _inactiveUsers.add(u.id)
    }
  } catch (err) {
    console.warn('[AUTH] refresh inactive users error:', err.message)
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, role')
      .in('role', STAFF_ROLES)
    if (error) console.warn('[AUTH] refresh staff roles failed:', error.message)
    else {
      _staffRoles.clear()
      for (const u of data || []) _staffRoles.set(u.id, u.role)
      _staffRolesLoaded = true
    }
  } catch (err) {
    console.warn('[AUTH] refresh staff roles error:', err.message)
  }

  // Chỉ nạp mốc thu hồi còn có thể có tác dụng (token sống tối đa 30 ngày) và phân
  // trang: PostgREST cắt mặc định 1000 dòng, mà số dòng có mốc chỉ tăng dần.
  try {
    const since = new Date(Date.now() - 31 * 86_400_000).toISOString()
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('users')
        .select('id, tokens_valid_after')
        .gt('tokens_valid_after', since)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) break // cột chưa có (chưa áp migration) → giữ mốc in-memory hiện có
      for (const u of data || []) {
        const at = new Date(u.tokens_valid_after).getTime()
        if (Number.isFinite(at)) _tokensValidAfter.set(u.id, Math.max(at, _tokensValidAfter.get(u.id) || 0))
      }
      if (!data || data.length < PAGE) break
    }
  } catch { /* degrade mềm */ }
}

// Khởi động poller đồng bộ denylist (gọi 1 lần khi boot trong index.js).
export function startUserStatusSync(intervalMs = 60_000) {
  refreshInactiveUsers()
  setInterval(() => { refreshInactiveUsers() }, intervalMs)
  console.log('[AUTH] Đồng bộ tài khoản bị khoá (mỗi ' + intervalMs / 1000 + 's)')
}

export function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập.' })
  }

  try {
    const token = authHeader.split(' ')[1]
    // Ghim thuật toán: chỉ chấp nhận HS256 (token tự ký), chặn alg-confusion.
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
    // Chặn ngay nếu tài khoản đã bị khoá, dù token còn hạn.
    if (_inactiveUsers.has(payload.userId)) {
      return res.status(401).json({ error: 'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.' })
    }
    // Token cấp trước lần đổi/đặt lại PIN hoặc khoá tài khoản → hết hiệu lực.
    const validAfter = _tokensValidAfter.get(payload.userId)
    if (validAfter && (payload.iat || 0) * 1000 < validAfter) {
      return res.status(401).json({ error: 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.' })
    }
    // Token mang quyền staff nhưng vai trò thật đã đổi → bắt đăng nhập lại.
    if (_staffRolesLoaded && STAFF_ROLES.includes(payload.role)
        && _staffRoles.get(payload.userId) !== payload.role) {
      return res.status(401).json({ error: 'Quyền tài khoản đã thay đổi. Vui lòng đăng nhập lại.' })
    }
    req.user = payload
    
    // Gắn user info vào Sentry cho request hiện tại
    Sentry.setUser({ id: payload.userId, role: payload.role })
    
    next()
  } catch {
    res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' })
  }
}

// Dùng: requireRole('engineer', 'admin')
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Chưa đăng nhập.' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này.' })
    }
    next()
  }
}
