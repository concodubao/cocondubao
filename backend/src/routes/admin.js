// backend/src/routes/admin.js
// POST /api/v1/admin/engineers       — Tạo tài khoản kỹ sư mới
// GET  /api/v1/admin/stats           — Dashboard stats
// GET  /api/v1/admin/users           — Danh sách user
// PATCH /api/v1/admin/users/:id      — Cập nhật user (approve kỹ sư, khóa/mở)
// GET  /api/v1/admin/ai-errors       — Danh sách báo lỗi AI
// PATCH /api/v1/admin/ai-errors/:id  — Review báo lỗi

import express from 'express'
import bcrypt  from 'bcrypt'
import { verifyJWT, requireRole } from '../middleware/auth.js'
import { supabase } from '../services/supabase.js'

const router = express.Router()

// ── POST /admin/engineers — admin tạo tài khoản kỹ sư hoặc admin ─────────────
router.post('/engineers', verifyJWT, requireRole('admin'), async (req, res) => {
  const { email, password, name, role: reqRole } = req.body
  const role = ['engineer', 'admin'].includes(reqRole) ? reqRole : 'engineer'

  if (!email?.trim() || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Mật khẩu tối thiểu 8 ký tự.' })
  }

  const { data: existing } = await supabase
    .from('users').select('id').eq('email', email.trim().toLowerCase()).single()
  if (existing) return res.status(400).json({ error: 'Email này đã được sử dụng.' })

  try {
    const password_hash = await bcrypt.hash(password, 10)
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email:         email.trim().toLowerCase(),
        password_hash,
        role,
        is_active:     true,
        name:          name?.trim() || null,
      })
      .select('id, email, name, role, is_active, created_at')
      .single()

    if (error) throw error
    res.json({ success: true, user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /admin/stats ─────────────────────────────────────────────────────────
router.get('/stats', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const [
      { count: totalUsers },
      { count: totalSessions },
      { count: totalMessages },
      { count: pendingQueue },
      { count: totalNotifs },
      { count: errorReports },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('chat_sessions').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('engineer_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('notifications').select('*', { count: 'exact', head: true }),
      supabase.from('ai_error_reports').select('*', { count: 'exact', head: true }),
    ])

    const { data: confData } = await supabase
      .from('messages')
      .select('confidence')
      .eq('role', 'assistant')
      .not('confidence', 'is', null)
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())

    const ragAnswered = (confData || []).filter(m => m.confidence >= 0.7).length
    const ragTotal    = (confData || []).length
    const ragRate     = ragTotal > 0 ? Math.round(ragAnswered / ragTotal * 100) : 0

    const { data: sessionsByDay } = await supabase
      .from('chat_sessions')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .order('created_at', { ascending: true })

    const dayMap = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const key = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
      dayMap[key] = 0
    }
    ;(sessionsByDay || []).forEach(s => {
      const key = new Date(s.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
      if (dayMap[key] !== undefined) dayMap[key]++
    })

    res.json({
      totalUsers,
      totalSessions,
      totalMessages,
      pendingQueue,
      totalNotifs,
      errorReports,
      ragRate,
      sessionsByDay: Object.entries(dayMap).map(([date, count]) => ({ date, count })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /admin/users ──────────────────────────────────────────────────────────
router.get('/users', verifyJWT, requireRole('admin'), async (req, res) => {
  const { role, search, limit = 50, offset = 0 } = req.query

  let query = supabase
    .from('users')
    .select('id, phone, email, role, name, village, crops, is_active, created_at')
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1)

  if (role)   query = query.eq('role', role)
  if (search) {
    // Bỏ ký tự có ý nghĩa trong cú pháp filter PostgREST để chặn .or() injection
    const safe = String(search).replace(/[,()*]/g, '').trim()
    if (safe) query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`)
  }

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json({ users: data })
})

// ── PATCH /admin/users/:id ────────────────────────────────────────────────────
router.patch('/users/:id', verifyJWT, requireRole('admin'), async (req, res) => {
  const { is_active, role } = req.body
  const updates = {}

  if (is_active !== undefined) updates.is_active = is_active
  if (role && ['farmer','engineer','admin'].includes(role)) updates.role = role

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', req.params.id)
    .select('id, phone, email, role, name, is_active')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true, user: data })
})

// ── PATCH /admin/users/:id/reset-pin — đặt lại mã PIN cho nông dân (quên PIN) ──
router.patch('/users/:id/reset-pin', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const pin  = String(Math.floor(100000 + Math.random() * 900000)) // PIN 6 số ngẫu nhiên
    const hash = await bcrypt.hash(pin, 10)
    const { data, error } = await supabase
      .from('users')
      .update({ password_hash: hash, is_active: true })
      .eq('id', req.params.id)
      .select('id, phone, name, role')
      .single()
    if (error) throw error
    res.json({ success: true, pin, user: data }) // trả PIN để admin báo lại cho nông dân
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /admin/ai-errors ──────────────────────────────────────────────────────
router.get('/ai-errors', verifyJWT, requireRole('admin'), async (req, res) => {
  const { reviewed, limit = 30, offset = 0 } = req.query

  let query = supabase
    .from('ai_error_reports')
    .select(`
      id, error_type, note, created_at, reviewed_by,
      messages ( content, confidence, source ),
      users!ai_error_reports_user_id_fkey ( name, phone )
    `)
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1)

  if (reviewed === 'true')  query = query.not('reviewed_by', 'is', null)
  if (reviewed === 'false') query = query.is('reviewed_by', null)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json({ errors: data })
})

// ── PATCH /admin/ai-errors/:id ────────────────────────────────────────────────
router.patch('/ai-errors/:id', verifyJWT, requireRole('admin'), async (req, res) => {
  const { error } = await supabase
    .from('ai_error_reports')
    .update({ reviewed_by: req.user.userId })
    .eq('id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
