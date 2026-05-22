import express    from 'express'
import jwt         from 'jsonwebtoken'
import bcrypt      from 'bcrypt'
import rateLimit   from 'express-rate-limit'
import { createClient } from '@supabase/supabase-js'
import { supabase }     from '../services/supabase.js'
import { verifyJWT }    from '../middleware/auth.js'

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

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('84')) return '+' + digits
  if (digits.startsWith('0'))  return '+84' + digits.slice(1)
  return '+84' + digits
}

// ─── POST /auth/request-otp ───────────────────────────────────────────────────
router.post('/request-otp', otpLimiter, async (req, res) => {
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
    return res.status(400).json({ error: 'Không gửi được OTP: ' + error.message })
  }

  const { data: existingUser } = await supabase
    .from('users').select('id, role').eq('phone', normalized).single()

  console.log(`[AUTH] OTP gửi qua Twilio đến ${normalized}`)

  res.json({
    success:        true,
    phone:          normalized,
    isExistingUser: !!existingUser,
    existingRole:   existingUser?.role ?? null,
  })
})

// ─── POST /auth/verify-otp ────────────────────────────────────────────────────
router.post('/verify-otp', otpLimiter, async (req, res) => {
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
      user: { id: user.id, phone: user.phone, role: user.role, name: user.name, village: user.village, crops: user.crops },
      isNewUser: !user.name,
    })
  } catch (err) {
    console.error('[AUTH]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── POST /auth/register-email ────────────────────────────────────────────────
router.post('/register-email', async (req, res) => {
  const { email, password, role } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' })
  if (!['engineer', 'admin'].includes(role)) return res.status(400).json({ error: 'Vai trò không hợp lệ.' })
  if (password.length < 8) return res.status(400).json({ error: 'Mật khẩu tối thiểu 8 ký tự.' })

  const { data: existing } = await supabase.from('users').select('id').eq('email', email).single()
  if (existing) return res.status(400).json({ error: 'Email đã được sử dụng.' })

  try {
    const password_hash = await bcrypt.hash(password, 10)
    const is_active = role === 'admin'
    const { data: user, error } = await supabase.from('users')
      .insert({ email, password_hash, role, is_active }).select().single()
    if (error) throw error
    res.json({ success: true, pending: !is_active })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── POST /auth/login-email ───────────────────────────────────────────────────
router.post('/login-email', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' })

  try {
    const { data: user } = await supabase.from('users').select('*').eq('email', email).single()
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' })
    if (!user.is_active) return res.status(403).json({ error: 'Tài khoản đang chờ phê duyệt hoặc đã bị khoá.' })

    const token = jwt.sign(
      { userId: user.id, phone: user.phone, role: user.role, name: user.name },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    )
    res.json({
      success: true, token,
      user: { id: user.id, email: user.email, phone: user.phone, role: user.role, name: user.name },
      isNewUser: !user.name,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
router.get('/me', verifyJWT, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, phone, email, role, name, village, crops, is_active, created_at')
      .eq('id', req.user.userId)
      .single()
    if (!user) return res.status(404).json({ error: 'Không tìm thấy.' })
    res.json({ user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── PATCH /auth/profile ──────────────────────────────────────────────────────
router.patch('/profile', verifyJWT, async (req, res) => {
  try {
    const { name, village, crops } = req.body
    const updates = {}
    if (name)                 updates.name    = name.trim()
    if (village !== undefined) updates.village = (village ?? '').trim()
    if (Array.isArray(crops)) updates.crops   = crops

    console.log('[PROFILE] userId:', req.user.userId, '| updates:', updates)

    const { data: user, error } = await supabase
      .from('users').update(updates).eq('id', req.user.userId)
      .select('id, phone, email, role, name, village, crops, is_active, created_at')
      .single()

    if (error) {
      console.error('[PROFILE] Supabase error:', error)
      return res.status(500).json({ error: error.message, detail: error.details, hint: error.hint })
    }
    res.json({ success: true, user })
  } catch (err) {
    console.error('[PROFILE] catch:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
