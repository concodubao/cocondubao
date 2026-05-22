import express from 'express'
import multer  from 'multer'
import mammoth from 'mammoth'
import { verifyJWT, requireRole } from '../middleware/auth.js'
import { embedAndStoreDoc }       from '../services/rag.js'
import { notifyFarmer }           from '../services/webpush.js'
import { supabase }               from '../services/supabase.js'

const router = express.Router()

// Multer: nhận PDF / DOCX / TXT tối đa 20MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ]
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Chỉ hỗ trợ PDF, DOCX, TXT'))
  },
})

// ─── Helper: trích xuất text từ file ─────────────────────────────────────────
async function extractText(buffer, mimetype) {
  if (mimetype === 'text/plain') {
    return buffer.toString('utf-8')
  }

  if (mimetype === 'application/pdf') {
    const { execFile }           = await import('child_process')
    const { promisify }          = await import('util')
    const { writeFile, unlink }  = await import('fs/promises')
    const { join }               = await import('path')
    const { tmpdir }             = await import('os')
    const execFileAsync          = promisify(execFile)

    const tmpPath = join(tmpdir(), `upload_${Date.now()}.pdf`)
    await writeFile(tmpPath, buffer)
    try {
      const { stdout } = await execFileAsync('pdftotext', [tmpPath, '-'], { maxBuffer: 10 * 1024 * 1024 })
      return stdout
    } finally {
      unlink(tmpPath).catch(() => {})
    }
  }

  if (mimetype.includes('wordprocessingml')) {
    const { value } = await mammoth.extractRawText({ buffer })
    return value
  }

  throw new Error('Định dạng file không hỗ trợ')
}

// GET /test-embed — kiểm tra Google embedding API
router.get('/test-embed', verifyJWT, requireRole('admin'), async (req, res) => {
  const key = process.env.GOOGLE_API_KEY
  if (!key) return res.json({ error: 'GOOGLE_API_KEY chưa được set' })

  try {
    const listRes  = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=100`)
    const listData = await listRes.json()

    const embeddingModels = (listData.models || [])
      .filter(m => m.supportedGenerationMethods?.includes('embedContent'))
      .map(m => ({ name: m.name, displayName: m.displayName }))

    let embedTest = null
    if (embeddingModels.length > 0) {
      const shortName = embeddingModels[0].name.replace('models/', '')
      const embedRes  = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${shortName}:embedContent?key=${key}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ content: { parts: [{ text: 'test' }] } }),
        }
      )
      const embedData = await embedRes.json()
      embedTest = {
        model:  shortName,
        status: embedRes.status,
        dim:    embedData.embedding?.values?.length ?? null,
        error:  embedData.error?.message ?? null,
      }
    }

    res.json({
      listStatus:      listRes.status,
      totalModels:     listData.models?.length ?? 0,
      embeddingModels,
      embedTest,
      listError:       listData.error?.message ?? null,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// PHẦN 1 — HÀNG ĐỢI KỸ SƯ
// ══════════════════════════════════════════════════════════════════════════════

// GET /engineer/queue — danh sách câu hỏi cần trả lời
router.get('/queue', verifyJWT, requireRole('engineer', 'admin'), async (req, res) => {
  const { status = 'pending', limit = 20, offset = 0 } = req.query

  const { data, error } = await supabase
    .from('engineer_queue')
    .select(`
      id,
      status,
      created_at,
      resolved_at,
      assigned_to,
      answer,
      add_to_knowledge,
      messages (
        id,
        content,
        image_url,
        confidence,
        created_at,
        chat_sessions (
          crop_type,
          users ( name, village, phone )
        )
      )
    `)
    .eq('status', status)
    .order('created_at', { ascending: true })
    .range(Number(offset), Number(offset) + Number(limit) - 1)

  if (error) return res.status(500).json({ error: error.message })

  const queue = (data || []).map(item => ({
    ...item,
    waitMinutes: Math.round((Date.now() - new Date(item.created_at)) / 60000),
  }))

  res.json({ queue, total: queue.length })
})

// PATCH /engineer/queue/:id/take — kỹ sư nhận câu hỏi (atomic, tránh race condition)
router.patch('/queue/:id/take', verifyJWT, requireRole('engineer', 'admin'), async (req, res) => {
  const { id } = req.params

  // UPDATE với điều kiện status=pending — atomic, không cần SELECT trước
  const { data, error } = await supabase
    .from('engineer_queue')
    .update({ status: 'in_progress', assigned_to: req.user.userId })
    .eq('id', id)
    .eq('status', 'pending')
    .select()

  if (error) return res.status(500).json({ error: error.message })

  if (!data?.length) {
    // 0 hàng bị update = không tồn tại hoặc đã bị nhận
    const { data: exists } = await supabase
      .from('engineer_queue').select('status').eq('id', id).single()
    if (!exists) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' })
    return res.status(409).json({ error: 'Câu hỏi này đã được kỹ sư khác nhận.' })
  }

  res.json({ success: true, item: data[0] })
})

// PATCH /engineer/queue/:id/answer — kỹ sư trả lời
router.patch('/queue/:id/answer', verifyJWT, requireRole('engineer', 'admin'), async (req, res) => {
  const { id } = req.params
  const { answer, addToKnowledge = false } = req.body

  if (!answer?.trim()) return res.status(400).json({ error: 'Câu trả lời không được để trống.' })

  try {
    const { data: queueItem } = await supabase
      .from('engineer_queue')
      .select(`
        message_id,
        assigned_to,
        status,
        messages (
          session_id,
          content,
          chat_sessions ( user_id )
        )
      `)
      .eq('id', id)
      .single()

    if (!queueItem) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' })

    // Engineer chỉ trả lời được câu hỏi do mình nhận, admin có thể override
    if (req.user.role !== 'admin' && queueItem.assigned_to && queueItem.assigned_to !== req.user.userId) {
      return res.status(403).json({ error: 'Câu hỏi này đang được kỹ sư khác xử lý.' })
    }

    const sessionId = queueItem.messages?.session_id
    const farmerId  = queueItem.messages?.chat_sessions?.user_id
    const question  = queueItem.messages?.content

    // Lưu câu trả lời vào messages
    await supabase.from('messages').insert({
      session_id: sessionId,
      role:       'engineer',
      content:    answer.trim(),
      source:     'engineer',
    })

    // Cập nhật trạng thái queue → resolved
    await supabase.from('engineer_queue').update({
      status:           'resolved',
      answer:           answer.trim(),
      add_to_knowledge: addToKnowledge,
      resolved_at:      new Date().toISOString(),
    }).eq('id', id)

    // Nếu đánh dấu "Tin cậy" → tự thêm vào kho tri thức và embed luôn
    if (addToKnowledge && question) {
      try {
        const { data: newDoc } = await supabase
          .from('knowledge_docs')
          .insert({
            title:       `QA: ${question.slice(0, 60)}`,
            source:      'engineer_answer',
            content:     `Câu hỏi: ${question}\n\nCâu trả lời: ${answer.trim()}`,
            status:      'embedding',
            uploaded_by: req.user.userId,
          })
          .select('id')
          .single()

        if (newDoc) embedAndStoreDoc(newDoc.id)
          .catch(err => console.warn('[ENGINEER] embed QA failed:', err.message))
      } catch (embedErr) {
        console.warn('[ENGINEER] embed QA failed:', embedErr.message)
      }
    }

    // Push notification đến nông dân
    if (farmerId) {
      notifyFarmer(
        farmerId,
        '🐦 Kỹ sư đã trả lời câu hỏi của bạn!',
        answer.trim().slice(0, 100) + (answer.length > 100 ? '...' : '')
      ).catch(e => console.warn('[PUSH] notify farmer failed:', e.message))
    }

    res.json({ success: true, addedToKnowledge: addToKnowledge })

  } catch (err) {
    console.error('[ENGINEER] answer error:', err)
    res.status(500).json({ error: 'Không lưu được câu trả lời.' })
  }
})

// DELETE /engineer/queue/:id — xóa câu hỏi chưa trả lời
router.delete('/queue/:id', verifyJWT, requireRole('engineer', 'admin'), async (req, res) => {
  const { id } = req.params

  const { data: item } = await supabase
    .from('engineer_queue')
    .select('id, status, assigned_to')
    .eq('id', id)
    .single()

  if (!item) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' })

  if (!['pending', 'in_progress'].includes(item.status)) {
    return res.status(400).json({ error: 'Chỉ có thể xóa câu hỏi chưa được trả lời.' })
  }

  // Engineer chỉ xóa được câu hỏi của mình hoặc chưa ai nhận; admin xóa được tất cả
  if (req.user.role !== 'admin' && item.status === 'in_progress' && item.assigned_to !== req.user.userId) {
    return res.status(403).json({ error: 'Câu hỏi này đang được kỹ sư khác xử lý.' })
  }

  const { error } = await supabase.from('engineer_queue').delete().eq('id', id)
  if (error) return res.status(500).json({ error: error.message })

  res.json({ success: true })
})

// ══════════════════════════════════════════════════════════════════════════════
// PHẦN 2 — KHO TRI THỨC RAG
// ══════════════════════════════════════════════════════════════════════════════

// POST /upload — upload tài liệu
router.post('/upload', verifyJWT, requireRole('engineer', 'admin'),
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: 'Lỗi file: ' + err.message })
      next()
    })
  },
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn file.' })

    const { title, cropTags, source } = req.body
    if (!title?.trim()) return res.status(400).json({ error: 'Vui lòng nhập tên tài liệu.' })

    let content
    try {
      content = await extractText(req.file.buffer, req.file.mimetype)
    } catch (err) {
      console.error('[KNOWLEDGE] extractText error:', err.message)
      return res.status(422).json({ error: 'Không đọc được nội dung file: ' + err.message })
    }

    if (!content?.trim()) {
      return res.status(422).json({ error: 'File không có nội dung text. Thử file khác nhé.' })
    }

    let tags = []
    try { tags = JSON.parse(cropTags || '[]') } catch { tags = [] }

    const { data: doc, error } = await supabase
      .from('knowledge_docs')
      .insert({
        title:       title.trim(),
        source:      source?.trim() || req.file.originalname,
        crop_tags:   tags,
        content:     content.trim(),
        status:      'draft',
        uploaded_by: req.user.userId,
      })
      .select()
      .single()

    if (error) {
      console.error('[KNOWLEDGE] supabase insert error:', error)
      return res.status(500).json({ error: 'Lỗi lưu DB: ' + error.message })
    }

    res.json({
      success: true,
      doc: {
        id:              doc.id,
        title:           doc.title,
        status:          doc.status,
        charCount:       content.length,
        estimatedChunks: Math.ceil(content.length / 500),
      },
    })
  }
)

// GET /docs — danh sách tài liệu
router.get('/docs', verifyJWT, requireRole('engineer', 'admin'), async (req, res) => {
  const { status, crop } = req.query

  let query = supabase
    .from('knowledge_docs')
    .select(`
      id, title, source, crop_tags, status, version,
      created_at, updated_at,
      uploaded_by,
      knowledge_chunks ( count )
    `)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (crop)   query = query.contains('crop_tags', [crop])

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const docs = (data || []).map(d => ({
    ...d,
    chunkCount: d.knowledge_chunks?.[0]?.count ?? 0,
  }))

  res.json({ docs })
})

// PATCH /:id/approve — duyệt + embed nền
router.patch('/:id/approve', verifyJWT, requireRole('engineer', 'admin'), async (req, res) => {
  const { id } = req.params

  try {
    const { data: doc } = await supabase
      .from('knowledge_docs')
      .select('id, title, status, content')
      .eq('id', id)
      .single()

    if (!doc) return res.status(404).json({ error: 'Không tìm thấy tài liệu.' })
    if (!doc.content) return res.status(422).json({ error: 'Tài liệu không có nội dung.' })

    await supabase.from('knowledge_docs')
      .update({ status: 'embedding', updated_at: new Date().toISOString() })
      .eq('id', id)

    res.json({ accepted: true, docId: id, message: 'Đang embed, vui lòng chờ vài phút...' })

    embedAndStoreDoc(id)
      .then(r => console.log(`[KNOWLEDGE] ✅ "${doc.title}" → ${r.chunksCreated} chunks`))
      .catch(err => {
        console.error('[KNOWLEDGE] ❌ background embed error:', err.message)
        supabase.from('knowledge_docs')
          .update({ status: 'draft', updated_at: new Date().toISOString() })
          .eq('id', id)
          .then(() => {})
      })

  } catch (err) {
    console.error('[KNOWLEDGE] approve error:', err)
    res.status(500).json({ error: 'Không thể embed tài liệu: ' + err.message })
  }
})

// PATCH /:id/archive — lưu trữ tài liệu đã duyệt
router.patch('/:id/archive', verifyJWT, requireRole('engineer', 'admin'), async (req, res) => {
  const { error } = await supabase
    .from('knowledge_docs')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq(req.params.id ? 'id' : 'id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

// DELETE /:id — xóa tài liệu chưa duyệt (draft hoặc embedding bị lỗi)
router.delete('/:id', verifyJWT, requireRole('engineer', 'admin'), async (req, res) => {
  const { id } = req.params

  const { data: doc } = await supabase
    .from('knowledge_docs')
    .select('id, status, title')
    .eq('id', id)
    .single()

  if (!doc) return res.status(404).json({ error: 'Không tìm thấy tài liệu.' })

  if (!['draft', 'embedding'].includes(doc.status)) {
    return res.status(400).json({ error: 'Chỉ có thể xóa tài liệu chưa duyệt. Tài liệu đã duyệt cần dùng chức năng Lưu trữ.' })
  }

  // Xóa chunks liên quan trước (nếu có từ lần embed trước)
  await supabase.from('knowledge_chunks').delete().eq('doc_id', id)

  const { error } = await supabase.from('knowledge_docs').delete().eq('id', id)
  if (error) return res.status(500).json({ error: error.message })

  res.json({ success: true })
})

export default router
