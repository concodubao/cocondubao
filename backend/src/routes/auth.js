import express    from 'express'
import jwt         from 'jsonwebtoken'
import bcrypt      from 'bcrypt'
import rateLimit   from 'express-rate-limit'
import { createClient } from '@supabase/supabase-js'
import { supabase }     from '../services/supabase.js'
import { verifyJWT, requireRole, setUserRole, markInactive, revokeTokens } from '../middleware/auth.js'
import { lockMinutesLeft, recordFail, clearFail, isWeakPin, WEAK_PIN_MSG } from '../services/loginLockout.js'

const router = express.Router()

// Anon key chỉ dùng để gọi Supabase Auth (signInWithOtp, verifyOtp)
const supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

// Rate limiter: tối đa 5 request OTP / phút / IP
const otpLimiter = rateLimit({
  windowMs:        60_000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Quá nhiều yêu cầu OTP. Vui lòng thử lại sau 1 phút.' },
})

function isValidPhone(normalized) {
  return /^\+84[3-9]\d{8}$/.test(normalized)
}

// Chuẩn độ mạnh bí mật theo vai trò, dùng chung cho set-password & change-password:
//   - nông dân: mã PIN đúng 6 chữ số (khớp register-phone / login-phone)
//   - kỹ sư/admin: mật khẩu ≥ 8 ký tự (khớp lúc tạo tài khoản ở register-email/admin)
// Trước đây cả hai chỉ check ≥ 6 ký tự → staff có thể hạ mật khẩu xuống 6 ký tự qua
// đổi mật khẩu (yếu hơn chuẩn tạo tài khoản), và nông dân có thể đặt "PIN" không phải số.
function validateSecret(secret, role) {
  if (!secret || typeof secret !== 'string') return role === 'farmer' ? 'Vui lòng nhập mã PIN.' : 'Vui lòng nhập mật khẩu.'
  if (role === 'farmer') {
    if (!/^\d{6}$/.test(secret)) return 'Mã PIN phải gồm đúng 6 chữ số.'
    if (isWeakPin(secret)) return WEAK_PIN_MSG
  } else if (secret.length < 8) {
    return 'Mật khẩu cần ít nhất 8 ký tự.'
  }
  return null
}

function normalizePhone(raw) {
  // Body JSON có thể gửi số/mảng/object: không phải chuỗi → trả '' để isValidPhone từ
  // chối (400). Trước đây raw.replace ném TypeError ngoài try → unhandled rejection
  // (Express 4 không bắt) → không có Sentry thì sập cả process.
  if (typeof raw !== 'string') return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('84')) return '+' + digits
  if (digits.startsWith('0'))  return '+84' + digits.slice(1)
  return '+84' + digits
}

// Loại cây trồng hợp lệ — whitelist để chặn dữ liệu rác bị nội suy vào filter
// PostgREST ở chỗ khác (vd push.js lọc thông báo theo crop).
const VALID_CROPS = ['rice', 'veggie', 'fruit', 'other']

// Phản hồi 500 thống nhất: log chi tiết ở server, trả thông báo chung cho client
// (tránh rò rỉ message lỗi DB / cấu trúc bảng).
function serverError(res, where, err) {
  console.error(`[AUTH] ${where}:`, err?.message || err)
  return res.status(500).json({ error: 'Có lỗi xảy ra, vui lòng thử lại sau.' })
}

// Khoá chống dò mật khẩu/PIN + chặn PIN dễ đoán: xem services/loginLockout.js

const MAX_NAME = 100

// OTP qua SMS (Supabase Auth + Twilio) hiện KHÔNG được giao diện dùng (nông dân đăng nhập
// SĐT + PIN). Để mở thì ai cũng bắn được SMS tốn tiền tới số bất kỳ (SMS pumping) và tạo
// phiên Supabase Auth. Giữ nguyên code (sẽ đổi nhà cung cấp sau), chỉ bật khi OTP_ENABLED=true.
function requireOtpEnabled(req, res, next) {
  if (process.env.OTP_ENABLED === 'true') return next()
  return res.status(404).json({ error: 'Đăng nhập bằng mã OTP hiện chưa hỗ trợ. Vui lòng dùng số điện thoại và mã PIN.' })
}

// ─── POST /auth/request-otp ───────────────────────────────────────────────────
router.post('/request-otp', requireOtpEnabled, otpLimiter, async (req, res) => {
  const { phone } = req.body
  if (!phone) return res.status(400).json({ error: 'Vui lòng nhập số điện thoại.' })

  const normalized = normalizePhone(phone)
  if (!isValidPhone(normalized)) {
    return res.status(400).json({ error: 'Số điện thoại không hợp lệ. Vui lòng dùng số di động Việt Nam (09x, 08x, 07x, 03x, 05x, 056...).' })
  }

  const { error } = await supabaseAuth.auth.signInWithOtp({ phone: normalized })
  if (error) {
    console.error('[AUTH] signInWithOtp error:', error.message)
    if (error.message.includes('rate') || error.status === 429) {
      return res.status(429).json({ error: 'Vui lòng chờ trước khi gửi lại OTP.' })
    }
    return res.status(400).json({ error: 'Không gửi được mã OTP. Vui lòng thử lại sau.' })
  }

  console.log(`[AUTH] OTP gửi qua Twilio đến ${normalized}`)

  // Không trả isExistingUser/existingRole: tránh để lộ số nào đã đăng ký và vai
  // trò của số đó (account enumeration). Luồng đăng nhập/đăng ký xác định sau khi
  // verify OTP qua trường isNewUser.
  res.json({
    success: true,
    phone:   normalized,
  })
})

// ─── POST /auth/verify-otp ────────────────────────────────────────────────────
router.post('/verify-otp', requireOtpEnabled, otpLimiter, async (req, res) => {
  const { phone, otp } = req.body
  if (!phone || !otp) return res.status(400).json({ error: 'Thiếu số điện thoại hoặc OTP.' })

  const normalized = normalizePhone(phone)
  if (!isValidPhone(normalized)) {
    return res.status(400).json({ error: 'Số điện thoại không hợp lệ.' })
  }

  const { error: verifyError } = await supabaseAuth.auth.verifyOtp({
    phone: normalized,
    token: otp,
    type:  'sms',
  })
  if (verifyError) {
    console.error('[AUTH] verifyOtp error:', verifyError.message)
    return res.status(400).json({ error: 'OTP không đúng hoặc đã hết hạn. Vui lòng thử lại.' })
  }

  try {
    let { data: user } = await supabase.from('users').select('*').eq('phone', normalized).single()
    if (!user) {
      // OTP chỉ dành cho nông dân — engineer/admin đăng ký qua email
      const { data: newUser, error } = await supabase.from('users')
        .insert({ phone: normalized, role: 'farmer', is_active: true }).select().single()
      if (error) throw error
      user = newUser
    }
    if (!user.is_active) return res.status(403).json({ error: 'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.' })

    const token = jwt.sign(
      { userId: user.id, phone: user.phone, role: user.role, name: user.name },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    )
    res.json({
      success: true,
      token,
      user: { id: user.id, phone: user.phone, role: user.role, name: user.name, village: user.village, crops: user.crops, hasPassword: !!user.password_hash },
      isNewUser: !user.name,
    })
  } catch (err) {
    console.error('[AUTH]', err.message)
    return serverError(res, 'auth', err)
  }
})

// ─── POST /auth/register-email — chỉ admin gọi được (deprecated public path) ──
router.post('/register-email', verifyJWT, requireRole('admin'), async (req, res) => {
  const { email, password, role } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' })
  if (!['engineer', 'admin'].includes(role)) return res.status(400).json({ error: 'Vai trò không hợp lệ.' })
  if (password.length < 8) return res.status(400).json({ error: 'Mật khẩu tối thiểu 8 ký tự.' })

  const normalizedEmail = email.trim().toLowerCase()
  const { data: existing } = await supabase.from('users').select('id').eq('email', normalizedEmail).single()
  if (existing) return res.status(400).json({ error: 'Email đã được sử dụng.' })

  try {
    const password_hash = await bcrypt.hash(password, 10)
    const is_active = role === 'admin'
    const { data: user, error } = await supabase.from('users')
      .insert({ email: normalizedEmail, password_hash, role, is_active }).select().single()
    if (error) throw error
    setUserRole(user.id, role)
    if (!is_active) markInactive(user.id)
    res.json({ success: true, pending: !is_active })
  } catch (err) {
    return serverError(res, 'auth', err)
  }
})

// ─── POST /auth/login-email ───────────────────────────────────────────────────
router.post('/login-email', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' })

  // Tài khoản tạo ra lưu email dạng lowercase (admin.js) → đăng nhập cũng phải
  // chuẩn hóa, nếu không gõ hoa/thừa khoảng trắng sẽ báo sai mật khẩu oan.
  const normalizedEmail = String(email).trim().toLowerCase()
  const lockKey = `email:${normalizedEmail}`

  const lockMin = lockMinutesLeft(lockKey)
  if (lockMin > 0) return res.status(429).json({ error: `Nhập sai mật khẩu nhiều lần. Thử lại sau ${lockMin} phút.` })

  try {
    const { data: user } = await supabase.from('users').select('*').eq('email', normalizedEmail).single()
    if (!user || !user.password_hash) {
      recordFail(lockKey)
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' })
    }

    const valid = await bcrypt.compare(String(password), user.password_hash)
    if (!valid) {
      recordFail(lockKey)
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' })
    }
    if (!user.is_active) return res.status(403).json({ error: 'Tài khoản đang chờ phê duyệt hoặc đã bị khoá.' })
    clearFail(lockKey)

    const token = jwt.sign(
      { userId: user.id, phone: user.phone, role: user.role, name: user.name },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    )
    res.json({
      success: true, token,
      user: { id: user.id, email: user.email, phone: user.phone, role: user.role, name: user.name, hasPassword: !!user.password_hash },
      isNewUser: !user.name,
    })
  } catch (err) {
    return serverError(res, 'auth', err)
  }
})

// ─── POST /auth/register-phone — đăng ký nông dân bằng SĐT + PIN 6 số ─────────
router.post('/register-phone', async (req, res) => {
  const { phone, password } = req.body
  if (!phone || !password) return res.status(400).json({ error: 'Vui lòng nhập số điện thoại và mã PIN.' })

  const normalized = normalizePhone(phone)
  if (!isValidPhone(normalized))   return res.status(400).json({ error: 'Số điện thoại không hợp lệ.' })
  if (!/^\d{6}$/.test(password))    return res.status(400).json({ error: 'Mã PIN phải gồm đúng 6 chữ số.' })
  if (isWeakPin(password))         return res.status(400).json({ error: WEAK_PIN_MSG })

  try {
    const { data: existing } = await supabase.from('users').select('id, password_hash, is_active').eq('phone', normalized).single()
    if (existing?.password_hash) return res.status(400).json({ error: 'Số điện thoại này đã đăng ký. Vui lòng đăng nhập.' })
    // Đã có tài khoản (tạo qua OTP trước đây) nhưng chưa có PIN → KHÔNG cho tự gán PIN ở
    // đây: route này không chứng minh người gọi sở hữu số điện thoại, nên trước đây ai
    // biết số là chiếm được tài khoản đó (lịch sử chat, ảnh, cả vai trò staff nếu đã được
    // nâng quyền). Chủ thật nhờ admin "Đặt lại PIN" (admin.js reset-pin).
    if (existing) {
      return res.status(409).json({ error: 'Số điện thoại này đã có tài khoản. Vui lòng liên hệ quản trị viên để được cấp mã PIN.' })
    }

    const password_hash = await bcrypt.hash(password, 10)
    const { data: user, error } = await supabase.from('users')
      .insert({ phone: normalized, role: 'farmer', is_active: true, password_hash }).select().single()
    if (error) throw error

    const token = jwt.sign(
      { userId: user.id, phone: user.phone, role: user.role, name: user.name },
      process.env.JWT_SECRET, { expiresIn: '30d' }
    )
    res.json({
      success: true, token,
      user: { id: user.id, phone: user.phone, role: user.role, name: user.name, village: user.village, crops: user.crops, hasPassword: true },
      isNewUser: !user.name,
    })
  } catch (err) {
    console.error('[AUTH] register-phone:', err.message)
    return serverError(res, 'auth', err)
  }
})

// ─── POST /auth/login-phone — đăng nhập bằng SĐT + mã PIN (có khoá chống dò) ──
router.post('/login-phone', async (req, res) => {
  const { phone, password } = req.body
  if (!phone || !password) return res.status(400).json({ error: 'Vui lòng nhập đầy đủ.' })

  const normalized = normalizePhone(phone)
  if (!isValidPhone(normalized)) return res.status(400).json({ error: 'Số điện thoại không hợp lệ.' })

  const lockKey = `phone:${normalized}`
  const lockMin = lockMinutesLeft(lockKey)
  if (lockMin > 0) return res.status(429).json({ error: `Nhập sai mã PIN nhiều lần. Thử lại sau ${lockMin} phút, hoặc nhờ quản trị viên đặt lại mã PIN.` })

  try {
    const { data: user } = await supabase.from('users').select('*').eq('phone', normalized).single()
    if (!user) return res.status(401).json({ error: 'Số điện thoại chưa đăng ký. Bấm "Đăng ký" để tạo tài khoản.' })
    if (!user.password_hash) return res.status(401).json({ error: 'Tài khoản chưa có mã PIN. Nhờ quản trị viên đặt lại mã PIN giúp bạn.' })

    const valid = await bcrypt.compare(String(password), user.password_hash)
    if (!valid) {
      recordFail(lockKey)
      return res.status(401).json({ error: 'Mã PIN không đúng.' })
    }
    if (!user.is_active) return res.status(403).json({ error: 'Tài khoản đã bị khoá.' })

    clearFail(lockKey)
    // Tài khoản staff (nông dân được nâng quyền) đăng nhập bằng PIN: token ngắn như login-email
    const token = jwt.sign(
      { userId: user.id, phone: user.phone, role: user.role, name: user.name },
      process.env.JWT_SECRET, { expiresIn: user.role === 'farmer' ? '30d' : '7d' }
    )
    res.json({
      success: true, token,
      user: { id: user.id, phone: user.phone, role: user.role, name: user.name, village: user.village, crops: user.crops, hasPassword: true },
      isNewUser: !user.name,
    })
  } catch (err) {
    return serverError(res, 'auth', err)
  }
})

// ─── PATCH /auth/set-password — đặt mật khẩu lần đầu (chưa có password) ─────
router.patch('/set-password', verifyJWT, async (req, res) => {
  const { password } = req.body
  const secretErr = validateSecret(password, req.user.role)
  if (secretErr) return res.status(400).json({ error: secretErr })

  try {
    const { data: existing } = await supabase.from('users').select('password_hash').eq('id', req.user.userId).single()
    if (existing?.password_hash) return res.status(400).json({ error: 'Tài khoản đã có mật khẩu. Dùng đổi mật khẩu thay thế.' })

    const hash = await bcrypt.hash(password, 12)
    const { error } = await supabase.from('users').update({ password_hash: hash }).eq('id', req.user.userId)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    return serverError(res, 'auth', err)
  }
})

// ─── PATCH /auth/change-password — đổi mật khẩu (tất cả role) ───────────────
router.patch('/change-password', verifyJWT, async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Thiếu thông tin.' })
  const secretErr = validateSecret(newPassword, req.user.role)
  if (secretErr) return res.status(400).json({ error: secretErr })
  if (currentPassword === newPassword) return res.status(400).json({ error: 'Mật khẩu mới phải khác mật khẩu cũ.' })

  try {
    const { data: user } = await supabase.from('users')
      .select('id, phone, role, name, password_hash').eq('id', req.user.userId).single()
    if (!user?.password_hash) return res.status(400).json({ error: 'Tài khoản chưa có mật khẩu.' })

    // 400 chứ không 401: interceptor frontend coi mọi 401 là hết phiên → gõ sai mật
    // khẩu cũ trước đây bị đá ra màn đăng nhập.
    const valid = await bcrypt.compare(String(currentPassword), user.password_hash)
    if (!valid) return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng.' })

    const hash = await bcrypt.hash(newPassword, 12)
    const { error } = await supabase.from('users').update({ password_hash: hash }).eq('id', req.user.userId)
    if (error) throw error

    // Mọi phiên cũ (máy khác, kẻ đã biết PIN cũ) hết hiệu lực; thiết bị hiện tại nhận
    // token mới để không bị đăng xuất.
    await revokeTokens(user.id)
    const token = jwt.sign(
      { userId: user.id, phone: user.phone, role: user.role, name: user.name },
      process.env.JWT_SECRET, { expiresIn: user.role === 'farmer' ? '30d' : '7d' }
    )
    res.json({ success: true, token })
  } catch (err) {
    return serverError(res, 'auth', err)
  }
})

// ─── DELETE /auth/account — người dùng tự xoá tài khoản (vô hiệu hoá + xoá PII) ──
// Dùng update (không hard-delete) để không vỡ FK của lịch sử chat/báo lỗi.
// Xoá cả SĐT/email/mật khẩu: (1) SĐT là PII — giữ lại là chưa "xoá" thật; (2) nhả
// unique(phone) để số này đăng ký lại được thành tài khoản MỚI, không kéo lịch sử
// cũ về (nhà mạng có thể cấp lại số cho người khác).
router.delete('/account', verifyJWT, async (req, res) => {
  try {
    // Admin cuối cùng tự xoá = không còn ai quản trị (PATCH /admin/users/:id chặn tự
    // khoá/hạ quyền nhưng đường này trước đây lọt).
    if (req.user.role === 'admin') {
      const { count, error: cErr } = await supabase.from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin').eq('is_active', true).neq('id', req.user.userId)
      if (cErr) throw cErr
      if (!count) return res.status(400).json({ error: 'Bạn là quản trị viên duy nhất. Hãy tạo thêm một quản trị viên khác trước khi xoá tài khoản này.' })
    }
    const { error } = await supabase.from('users')
      .update({ is_active: false, name: null, village: null, crops: [], phone: null, email: null, password_hash: null })
      .eq('id', req.user.userId)
    if (error) throw error
    markInactive(req.user.userId) // token còn hạn bị chặn ngay
    await revokeTokens(req.user.userId) // và không hồi sinh nếu admin kích hoạt lại tài khoản
    await supabase.from('push_subscriptions')
      .update({ active: false })
      .eq('user_id', req.user.userId)

    // Xóa ảnh nông dân đã tải lên (sâu bệnh + cộng đồng) để không còn truy cập
    // được qua URL cũ và khỏi rác bucket. Best-effort — lỗi không chặn xóa account.
    for (const folder of [`pest-images/${req.user.userId}`, `community/${req.user.userId}`]) {
      try {
        // list() mặc định chỉ 100 file → lặp tới khi hết (tối đa 2000 file/thư mục)
        for (let round = 0; round < 20; round++) {
          const { data: files } = await supabase.storage.from('images').list(folder, { limit: 100 })
          if (!files?.length) break
          await supabase.storage.from('images').remove(files.map(f => `${folder}/${f.name}`))
          if (files.length < 100) break
        }
      } catch (e) {
        console.warn('[AUTH] dọn ảnh khi xóa account lỗi:', e.message)
      }
    }

    // File ảnh đã xoá → gỡ đường dẫn khỏi bài đăng/tin nhắn để không hiện ảnh vỡ
    await supabase.from('posts').update({ image_url: null })
      .eq('user_id', req.user.userId).not('image_url', 'is', null)

    res.json({ success: true })
  } catch (err) {
    return serverError(res, 'auth', err)
  }
})

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
router.get('/me', verifyJWT, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, phone, email, role, name, village, crops, is_active, created_at, password_hash')
      .eq('id', req.user.userId)
      .single()
    if (!user) return res.status(404).json({ error: 'Không tìm thấy.' })
    const { password_hash, ...safeUser } = user
    res.json({ user: { ...safeUser, hasPassword: !!password_hash } })
  } catch (err) {
    return serverError(res, 'auth', err)
  }
})

// ─── PATCH /auth/profile ──────────────────────────────────────────────────────
router.patch('/profile', verifyJWT, async (req, res) => {
  try {
    const { name, village, crops } = req.body
    const updates = {}
    if (typeof name === 'string' && name.trim()) updates.name = name.trim().slice(0, MAX_NAME)
    if (village !== undefined) updates.village = String(village ?? '').trim().slice(0, MAX_NAME)
    if (Array.isArray(crops)) updates.crops   = crops.filter(c => VALID_CROPS.includes(c))
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Không có thông tin nào để cập nhật.' })

    const { data: user, error } = await supabase
      .from('users').update(updates).eq('id', req.user.userId)
      .select('id, phone, email, role, name, village, crops, is_active, created_at')
      .single()

    if (error) {
      console.error('[PROFILE] Supabase error:', error)
      return res.status(500).json({ error: 'Không cập nhật được hồ sơ.' })
    }
    res.json({ success: true, user })
  } catch (err) {
    return serverError(res, 'profile', err)
  }
})

export default router
