import express from 'express'
import jwt     from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'
import { verifyJWT } from '../middleware/auth.js'

const router   = express.Router()
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// ─── OTP store (in-memory) ────────────────────────────────────────────────────
const otpStore = new Map()   // phone → { code, expiresAt, lastSentAt }
const OTP_TTL_MS  = 10 * 60 * 1000   // 10 phút
const OTP_RATE_MS = 60  * 1000       // 60 giây giữa 2 lần gửi

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

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
router.post('/request-otp', async (req, res) => {
  const { phone } = req.body
  if (!phone) return res.status(400).json({ error: 'Vui lòng nhập số điện thoại.' })

  const normalized = normalizePhone(phone)
  if (!isValidPhone(normalized)) {
    return res.status(400).json({ error: 'Số điện thoại không hợp lệ. Vui lòng dùng số di động Việt Nam (09x, 08x, 07x, 03x, 05x, 056...).' })
  }

  // Rate limit
  const prev = otpStore.get(normalized)
  if (prev && Date.now() - prev.lastSentAt < OTP_RATE_MS) {
    const wait = Math.ceil((OTP_RATE_MS - (Date.now() - prev.lastSentAt)) / 1000)
    return res.status(429).json({ error: `Vui lòng chờ ${wait} giây trước khi gửi lại.`, retryAfter: wait })
  }

  const code = generateOTP()
  otpStore.set(normalized, { code, expiresAt: Date.now() + OTP_TTL_MS, lastSentAt: Date.now() })

  // Production: gửi SMS thật tại đây
  console.log(`[AUTH] OTP cho ${normalized}: ${code}`)

  const { data: existingUser } = await supabase
    .from('users').select('id, role').eq('phone', normalized).single()

  res.json({
    success:        true,
    phone:          normalized,
    isExistingUser: !!existingUser,
    existingRole:   existingUser?.role ?? null,
    ...(process.env.NODE_ENV !== 'production' && { devOtp: code }),
  })
})

// ─── POST /auth/verify-otp ────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  const { phone, otp, role } = req.body
  if (!phone || !otp) return res.status(400).json({ error: 'Thiếu số điện thoại hoặc OTP.' })

  const normalized = normalizePhone(phone)
  if (!isValidPhone(normalized)) {
    return res.status(400).json({ error: 'Số điện thoại không hợp lệ.' })
  }

  const stored = otpStore.get(normalized)
  if (!stored) {
    return res.status(400).json({ error: 'OTP chưa được gửi hoặc đã hết hạn. Vui lòng yêu cầu mã mới.' })
  }
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(normalized)
    return res.status(400).json({ error: 'OTP đã hết hạn. Vui lòng yêu cầu mã mới.' })
  }
  if (otp !== stored.code) {
    return res.status(400).json({ error: 'OTP không đúng. Vui lòng kiểm tra lại.' })
  }

  otpStore.delete(normalized)  // dùng 1 lần

  try {
    let { data: user } = await supabase.from('users').select('*').eq('phone', normalized).single()
    if (!user) {
      const newRole = ['farmer', 'engineer', 'admin'].includes(role) ? role : 'farmer'
      const { data: newUser, error } = await supabase.from('users')
        .insert({ phone: normalized, role: newRole, is_active: true }).select().single()
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

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
router.get('/me', verifyJWT, async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('*').eq('id', req.user.userId).single()
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
    if (name)                          updates.name    = name.trim()
    if (village !== undefined)         updates.village = (village ?? '').trim()
    if (Array.isArray(crops))          updates.crops   = crops

    console.log('[PROFILE] userId:', req.user.userId, '| updates:', updates)

    const { data: user, error } = await supabase
      .from('users').update(updates).eq('id', req.user.userId).select().single()

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
