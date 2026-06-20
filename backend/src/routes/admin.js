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
import { embedAndStoreDoc } from '../services/rag.js'

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
    const since24h = new Date(Date.now() - 24 * 3600000).toISOString()
    const since30d = new Date(Date.now() - 30 * 86400000).toISOString()

    const [
      { count: totalUsers },
      { count: totalSessions },
      { count: totalMessages },
      { count: pendingQueue },
      { count: totalNotifs },
      { count: errorReports },
      { count: overdueQueue },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('chat_sessions').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('engineer_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('notifications').select('*', { count: 'exact', head: true }),
      supabase.from('ai_error_reports').select('*', { count: 'exact', head: true }),
      // Câu hỏi chờ kỹ sư quá 24h (pending hoặc đang xử lý) — cần ưu tiên
      supabase.from('engineer_queue').select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'in_progress']).lt('created_at', since24h),
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

    // Thời gian phản hồi trung bình của kỹ sư (câu đã trả lời trong 30 ngày)
    const { data: resolved } = await supabase
      .from('engineer_queue')
      .select('created_at, resolved_at')
      .eq('status', 'resolved')
      .not('resolved_at', 'is', null)
      .gte('resolved_at', since30d)

    let avgResponseHours = null
    if (resolved?.length) {
      const totalMs = resolved.reduce((sum, r) => sum + (new Date(r.resolved_at) - new Date(r.created_at)), 0)
      avgResponseHours = Math.round((totalMs / resolved.length) / 3600000 * 10) / 10
    }

    // Top cây trồng được hỏi nhiều nhất (30 ngày)
    const { data: cropRows } = await supabase
      .from('chat_sessions')
      .select('crop_type')
      .gte('created_at', since30d)

    const CROP_LABEL = { rice: 'Lúa', veggie: 'Rau màu', fruit: 'Cây ăn trái', other: 'Khác' }
    const cropCount = {}
    for (const r of cropRows || []) {
      const c = r.crop_type || 'other'
      cropCount[c] = (cropCount[c] || 0) + 1
    }
    const topCrops = Object.entries(cropCount)
      .map(([crop, count]) => ({ crop, label: CROP_LABEL[crop] || crop, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    res.json({
      totalUsers,
      totalSessions,
      totalMessages,
      pendingQueue,
      totalNotifs,
      errorReports,
      overdueQueue,
      avgResponseHours,
      topCrops,
      ragRate,
      sessionsByDay: Object.entries(dayMap).map(([date, count]) => ({ date, count })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /admin/knowledge-gaps — câu hỏi AI tự trả lời nhưng confidence thấp ────
// (Không qua kỹ sư, không bị báo lỗi → "lỗ hổng âm thầm" admin nên bổ sung tài liệu)
router.get('/knowledge-gaps', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const { data: weak } = await supabase
      .from('messages')
      .select('content, confidence, session_id, created_at')
      .eq('role', 'assistant')
      .not('confidence', 'is', null)
      .lt('confidence', 0.5)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(15)

    const answers    = weak || []
    const sessionIds = [...new Set(answers.map(a => a.session_id).filter(Boolean))]
    let userMsgs = []
    if (sessionIds.length) {
      const { data: um } = await supabase
        .from('messages')
        .select('session_id, content, created_at')
        .in('session_id', sessionIds)
        .eq('role', 'user')
        .order('created_at', { ascending: true })
      userMsgs = um || []
    }

    const gaps = answers.map(a => {
      const before = userMsgs.filter(m => m.session_id === a.session_id && m.created_at <= a.created_at)
      return {
        question:   before.length ? before[before.length - 1].content : null,
        confidence: a.confidence,
        created_at: a.created_at,
      }
    }).filter(g => g.question)

    res.json({ gaps })
  } catch (err) {
    console.error('[ADMIN] knowledge-gaps error:', err)
    res.status(500).json({ error: 'Không lấy được dữ liệu.' })
  }
})

// ── GET /admin/ai-review — soát chất lượng: câu trả lời AI gần đây + confidence ──
// Ít PII (không kèm tên/SĐT nông dân) — chỉ để đánh giá AI đúng/sai.
// Mở cho cả kỹ sư: họ là người hiểu chuyên môn để bắt câu AI trả lời sai.
router.get('/ai-review', verifyJWT, requireRole('admin', 'engineer'), async (req, res) => {
  const { filter = 'all', limit = 40 } = req.query
  try {
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    let q = supabase
      .from('messages')
      .select('content, confidence, source, session_id, created_at')
      .eq('role', 'assistant')
      .not('confidence', 'is', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(Number(limit))
    if (filter === 'low')      q = q.lt('confidence', 0.5)
    else if (filter === 'mid') q = q.gte('confidence', 0.5).lt('confidence', 0.7)

    const { data: ans } = await q
    const answers    = ans || []
    const sessionIds = [...new Set(answers.map(a => a.session_id).filter(Boolean))]
    let userMsgs = []
    if (sessionIds.length) {
      const { data: um } = await supabase
        .from('messages')
        .select('session_id, content, created_at')
        .in('session_id', sessionIds)
        .eq('role', 'user')
        .order('created_at', { ascending: true })
      userMsgs = um || []
    }
    const items = answers.map(a => {
      const before = userMsgs.filter(m => m.session_id === a.session_id && m.created_at <= a.created_at)
      return {
        question:   before.length ? before[before.length - 1].content : null,
        answer:     a.content,
        confidence: a.confidence,
        source:     a.source,
        created_at: a.created_at,
      }
    })
    res.json({ items })
  } catch (err) {
    console.error('[ADMIN] ai-review error:', err)
    res.status(500).json({ error: 'Không lấy được dữ liệu.' })
  }
})

// ── POST /admin/knowledge-qa — thêm 1 QA chuẩn vào kho tri thức (từ màn soát) ──
// Kỹ sư cũng được phép: soạn câu trả lời đúng từ màn "Soát chất lượng AI".
router.post('/knowledge-qa', verifyJWT, requireRole('admin', 'engineer'), async (req, res) => {
  const { question, answer } = req.body
  if (!question?.trim() || !answer?.trim()) {
    return res.status(400).json({ error: 'Cần cả câu hỏi và câu trả lời đúng.' })
  }
  try {
    const { data: doc, error } = await supabase
      .from('knowledge_docs')
      .insert({
        title:       `QA: ${question.trim().slice(0, 60)}`,
        source:      'ai_review',
        content:     `Câu hỏi: ${question.trim()}\n\nCâu trả lời: ${answer.trim()}`,
        status:      'embedding',
        uploaded_by: req.user.userId,
      })
      .select('id')
      .single()
    if (error) throw error
    embedAndStoreDoc(doc.id).catch(e => console.warn('[ADMIN] embed QA failed:', e.message))
    res.json({ success: true })
  } catch (err) {
    console.error('[ADMIN] knowledge-qa error:', err)
    res.status(500).json({ error: 'Không thêm được vào kho tri thức.' })
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
  // Chặn admin tự khóa / tự hạ vai trò chính mình (tránh tự nhốt ra khỏi hệ thống).
  // Vì không tự sửa được mình → luôn còn ít nhất 1 admin hoạt động.
  if (req.params.id === req.user.userId) {
    return res.status(400).json({ error: 'Không thể tự khóa hoặc đổi vai trò tài khoản của chính mình.' })
  }

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
    // Chỉ đặt lại PIN cho nông dân (đăng nhập bằng SĐT + PIN). Engineer/admin dùng
    // email + mật khẩu nên reset thành PIN 6 số là sai luồng.
    const { data: target } = await supabase
      .from('users').select('role').eq('id', req.params.id).single()
    if (!target) return res.status(404).json({ error: 'Không tìm thấy người dùng.' })
    if (target.role !== 'farmer') {
      return res.status(400).json({ error: 'Chỉ đặt lại PIN cho tài khoản nông dân.' })
    }

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
      messages ( content, confidence, source, session_id, created_at ),
      users!ai_error_reports_user_id_fkey ( name, phone )
    `)
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1)

  if (reviewed === 'true')  query = query.not('reviewed_by', 'is', null)
  if (reviewed === 'false') query = query.is('reviewed_by', null)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  // Gắn câu hỏi gốc (user message ngay trước câu trả lời bị báo lỗi) để admin có ngữ cảnh khi biên soạn lại
  const errors = data || []
  const sessionIds = [...new Set(errors.map(e => e.messages?.session_id).filter(Boolean))]
  let userMsgs = []
  if (sessionIds.length) {
    const { data: um } = await supabase
      .from('messages')
      .select('session_id, content, created_at')
      .in('session_id', sessionIds)
      .eq('role', 'user')
      .order('created_at', { ascending: true })
    userMsgs = um || []
  }
  const withQuestion = errors.map(e => {
    const ans = e.messages
    let question = null
    if (ans?.session_id) {
      const before = userMsgs.filter(m => m.session_id === ans.session_id && m.created_at <= ans.created_at)
      question = before.length ? before[before.length - 1].content : null
    }
    return { ...e, question }
  })
  res.json({ errors: withQuestion })
})

// ── POST /admin/ai-errors/:id/to-knowledge — biên soạn lại + thêm vào kho tri thức ──
router.post('/ai-errors/:id/to-knowledge', verifyJWT, requireRole('admin'), async (req, res) => {
  const { question, answer } = req.body
  if (!question?.trim() || !answer?.trim()) {
    return res.status(400).json({ error: 'Cần cả câu hỏi và câu trả lời đúng.' })
  }

  try {
    const { data: doc, error } = await supabase
      .from('knowledge_docs')
      .insert({
        title:       `QA: ${question.trim().slice(0, 60)}`,
        source:      'ai_error_fix',
        content:     `Câu hỏi: ${question.trim()}\n\nCâu trả lời: ${answer.trim()}`,
        status:      'embedding',
        uploaded_by: req.user.userId,
      })
      .select('id')
      .single()
    if (error) throw error

    // Đồng thời đánh dấu báo lỗi đã xử lý
    await supabase.from('ai_error_reports').update({ reviewed_by: req.user.userId }).eq('id', req.params.id)

    // Embed nền — không chặn phản hồi
    embedAndStoreDoc(doc.id).catch(e => console.warn('[ADMIN] embed QA fix failed:', e.message))

    res.json({ success: true })
  } catch (err) {
    console.error('[ADMIN] to-knowledge error:', err)
    res.status(500).json({ error: 'Không thêm được vào kho tri thức.' })
  }
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
