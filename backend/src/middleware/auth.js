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

// Nạp lại danh sách userId bị khoá từ DB (gọi khi boot + định kỳ).
export async function refreshInactiveUsers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('is_active', false)
    if (error) { console.warn('[AUTH] refresh inactive users failed:', error.message); return }
    _inactiveUsers.clear()
    for (const u of data || []) _inactiveUsers.add(u.id)
  } catch (err) {
    console.warn('[AUTH] refresh inactive users error:', err.message)
  }
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
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    // Chặn ngay nếu tài khoản đã bị khoá, dù token còn hạn.
    if (_inactiveUsers.has(payload.userId)) {
      return res.status(401).json({ error: 'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.' })
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
