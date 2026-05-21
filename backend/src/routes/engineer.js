import express from 'express'
import multer  from 'multer'
import mammoth from 'mammoth'         // đọc .docx
import { verifyJWT, requireRole } from '../middleware/auth.js'
import { embedAndStoreDoc }        from '../services/rag.js'
import { notifyFarmer }            from '../services/webpush.js'
import { createClient }            from '@supabase/supabase-js'

const router   = express.Router()
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

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
    // Dùng pdftotext (poppler_utils) — không cần browser API như pdfjs-dist
    const { execFile }    = await import('child_process')
    const { promisify }   = await import('util')
    const { writeFile, unlink } = await import('fs/promises')
    const { join }        = await import('path')
    const { tmpdir }      = await import('os')
    const execFileAsync   = promisify(execFile)

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

// GET /test-embed — kiểm tra Google embedding API key có hỗ trợ embedContent không
router.get('/test-embed', verifyJWT, requireRole('admin'), async (req, res) => {
  const key = process.env.GOOGLE_API_KEY
  if (!key) return res.json({ error: 'GOOGLE_API_KEY chưa được set' })

  try {
    // Liệt kê tất cả models có sẵn cho API key này
    const listRes  = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=100`)
    const listData = await listRes.json()

    const embeddingModels = (listData.models || [])
      .filter(m => m.supportedGenerationMethods?.includes('embedContent'))
      .map(m => ({ name: m.name, displayName: m.displayName }))

    // Thử embed 1 chuỗi ngắn với model đầu tiên tìm được
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
// Realtime subscribe ở frontend (Supabase channel), API này để load lần đầu
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
    .order('created_at', { ascending: true })  // Ưu tiên câu hỏi cũ nhất trước
    .range(Number(offset), Number(offset) + Number(limit) - 1)

  if (error) return res.status(500).json({ error: error.message })

  // Tính thời gian chờ để ưu tiên
  const queue = (data || []).map(item => ({
    ...item,
    waitMinutes: Math.round((Date.now() - new Date(item.created_at)) / 60000),
  }))

  res.json({ queue, total: queue.length })
})

// PATCH /engineer/queue/:id/take — kỹ sư nhận câu hỏi (in_progress)
router.patch('/queue/:id/take', verifyJWT, requireRole('engineer', 'admin'), async (req, res) => {
  const { id } = req.params

  // Kiểm tra câu hỏi còn pending không
  const { data: item } = await supabase
    .from('engineer_queue')
    .select('status, assigned_to')
    .eq('id', id)
    .single()

  if (!item) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' })
  if (item.status !== 'pending') {
    return res.status(409).json({ error: 'Câu hỏi này đã được kỹ sư khác nhận.' })
  }

  const { data, error } = await supabase
    .from('engineer_queue')
    .update({ status: 'in_progress', assigned_to: req.user.userId })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true, item: data })
})

// PATCH /engineer/queue/:id/answer — kỹ sư trả lời
router.patch('/queue/:id/answer', verifyJWT, requireRole('engineer', 'admin'), async (req, res) => {
  const { id } = req.params
  const { answer, addToKnowledge = false } = req.body

  if (!answer?.trim()) return res.status(400).json({ error: 'Câu trả lời không được để trống.' })

  try {
    // 1. Lấy thông tin câu hỏi để biết session và farmer
    const { data: queueItem } = await supabase
      .from('engineer_queue')
      .select(`
        message_id,
        messages (
          session_id,
          content,
          chat_sessions ( user_id )
        )
      `)
      .eq('id', id)
      .single()

    if (!queueItem) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' })

    const sessionId = queueItem.messages?.session_id
    const farmerId  = queueItem.messages?.chat_sessions?.user_id
    const question  = queueItem.messages?.content

    // 2. Lưu câu trả lời của kỹ sư vào messages
    await supabase.from('messages').insert({
      session_id: sessionId,
      role:       'engineer',
      content:    answer.trim(),
      source:     'engineer',
    })

    // 3. Cập nhật trạng thái queue → resolved
    await supabase.from('engineer_queue').update({
      status:           'resolved',
      answer:           answer.trim(),
      add_to_knowledge: addToKnowledge,
      resolved_at:      new Date().toISOString(),
    }).eq('id', id)

    // 4. Nếu kỹ sư đánh dấu "Tin cậy" → tự thêm vào kho tri thức
    if (addToKnowledge && question) {
      try {
        // Tạo doc mới từ QA pair
        const { data: newDoc } = await supabase
          .from('knowledge_docs')
          .insert({
            title:       `QA: ${question.slice(0, 60)}`,
            source:      'engineer_answer',
            content:     `Câu hỏi: ${question}\n\nCâu trả lời: ${answer.trim()}`,
            status:      'draft', // Kỹ sư cần vào E-03 để approve
            uploaded_by: req.user.userId,
          })
          .select('id')
          .single()

        // Tự approve + embed luôn vì đã được kỹ sư xác nhận
        if (newDoc) await embedAndStoreDoc(newDoc.id)
      } catch (embedErr) {
        // Lỗi embed không làm fail response
        console.warn('[ENGINEER] embed QA failed:', embedErr.message)
      }
    }

    // 5. Push notification đến nông dân
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

// ══════════════════════════════════════════════════════════════════════════════
// PHẦN 2 — KHO TRI THỨC RAG
// ══════════════════════════════════════════════════════════════════════════════

// POST /upload — upload tài liệu
router.post('/upload', verifyJWT, requireRole('engineer', 'admin'),
  (req, res, next) => {
    // Multer 2.x: phải wrap để bắt lỗi file filter / size limit đúng cách
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: 'Lỗi file: ' + err.message })
      next()
    })
  },
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn file.' })

    const { title, cropTags, source } = req.body
    if (!title?.trim()) return res.status(400).json({ error: 'Vui lòng nhập tên tài liệu.' })

    // Bước 1: Trích xuất text
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

    // Bước 2: Lưu vào Supabase
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

// PATCH /:id/approve — duyệt + tự động embed vào pgvector
router.patch('/:id/approve', verifyJWT, requireRole('engineer', 'admin'), async (req, res) => {
  const { id } = req.params

  try {
    // Kiểm tra doc tồn tại
    const { data: doc } = await supabase
      .from('knowledge_docs')
      .select('id, title, status, content')
      .eq('id', id)
      .single()

    if (!doc) return res.status(404).json({ error: 'Không tìm thấy tài liệu.' })
    if (!doc.content) return res.status(422).json({ error: 'Tài liệu không có nội dung.' })

    // Gọi hàm embed từ rag.js (tự chunk + embed + set status = approved)
    const result = await embedAndStoreDoc(id)

    res.json({
      success: true,
      docId:        id,
      chunksCreated: result.chunksCreated,
      message: `Đã embed ${result.chunksCreated} chunks vào kho tri thức.`,
    })

  } catch (err) {
    console.error('[KNOWLEDGE] approve error:', err)
    res.status(500).json({ error: 'Không thể embed tài liệu: ' + err.message })
  }
})

// PATCH /:id/archive — lưu trữ (không xoá)
router.patch('/:id/archive', verifyJWT, requireRole('engineer', 'admin'), async (req, res) => {
  const { error } = await supabase
    .from('knowledge_docs')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router