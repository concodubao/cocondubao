import express  from 'express'
import multer   from 'multer'
import sharp    from 'sharp'
import { verifyJWT }       from '../middleware/auth.js'
import { askRAG }          from '../services/rag.js'
import { notifyEngineer }  from '../services/webpush.js'
import { supabase }        from '../services/supabase.js'

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Chỉ hỗ trợ file ảnh'))
  },
})

// ─── Hàm nội bộ: tạo/lấy session ────────────────────────────────────────────
async function getOrCreateSession(userId, cropType, sessionId) {
  if (sessionId) return sessionId

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ user_id: userId, crop_type: cropType, status: 'active' })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

// ─── Helper: lấy lịch sử hội thoại gần nhất trong session ───────────────────
async function getRecentHistory(sessionId, limit = 10) {
  if (!sessionId) return []
  const { data } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .in('role', ['user', 'assistant', 'engineer'])
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!data?.length) return []
  // Đảo ngược để đúng thứ tự thời gian, chuẩn hóa role 'engineer' → 'assistant'
  return data.reverse().map(m => ({
    role:    m.role === 'engineer' ? 'assistant' : m.role,
    content: m.content,
  }))
}

// ─── POST /chat/ask — hỏi bằng text ─────────────────────────────────────────
router.post('/ask', verifyJWT, async (req, res) => {
  const { text, cropType, sessionId } = req.body
  const userId = req.user.userId

  if (!text?.trim()) return res.status(400).json({ error: 'Vui lòng nhập câu hỏi.' })
  if (text.length > 1000) return res.status(400).json({ error: 'Câu hỏi quá dài (tối đa 1000 ký tự).' })

  try {
    // Lấy lịch sử để AI nhớ ngữ cảnh
    const history = await getRecentHistory(sessionId)
    const result = await askRAG(text.trim(), cropType, history)

    const sid = await getOrCreateSession(userId, cropType, sessionId)

    const { data: userMsg } = await supabase.from('messages').insert({
      session_id: sid,
      role:       'user',
      content:    text.trim(),
    }).select('id').single()

    const answerContent = result.needEngineer
      ? 'Câu hỏi của bạn đã được chuyển cho kỹ sư nông nghiệp. Kỹ sư sẽ trả lời trong vòng 24 giờ.'
      : result.answer

    const { data: answerMsg } = await supabase
      .from('messages')
      .insert({
        session_id: sid,
        role:       result.needEngineer ? 'system' : 'assistant',
        content:    answerContent,
        confidence: result.confidence,
        source:     result.source,
      })
      .select('id')
      .single()

    let engineerQueued = false
    if (result.needEngineer && userMsg) {
      await supabase.from('engineer_queue').insert({
        message_id: userMsg.id,
        status:     'pending',
      })
      notifyEngineer('Có câu hỏi mới từ nông dân', text.trim().slice(0, 100))
        .catch(e => console.warn('[PUSH] notify engineer failed:', e.message))
      engineerQueued = true
    }

    res.json({
      answer:        result.answer,
      confidence:    result.confidence,
      source:        result.source,
      sessionId:     sid,
      engineerQueued,
      needEngineer:  result.needEngineer,
      messageId:     answerMsg?.id,
    })

  } catch (err) {
    console.error('[CHAT] /ask error:', err)
    res.status(500).json({ error: 'Cò Con đang bận, bạn thử lại sau nhé.' })
  }
})

// ─── Helper: phân tích ảnh bằng Gemini Vision ───────────────────────────────
async function analyzeImageWithGemini(imageBuffer, question) {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI  = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
    const model  = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const base64Image = imageBuffer.toString('base64')
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        },
      },
      `Bạn là chuyên gia nông nghiệp. Hãy phân tích ảnh cây trồng này và trả lời câu hỏi sau bằng tiếng Việt miền Nam, ngắn gọn dễ hiểu:\n\n${question}\n\nNếu ảnh không liên quan đến cây trồng, hãy nói rõ.`,
    ])
    return result.response.text().trim()
  } catch (err) {
    console.warn('[VISION] Gemini Vision failed:', err.message)
    return null
  }
}

// ─── POST /chat/ask-with-image — hỏi kèm ảnh sâu bệnh ───────────────────────
router.post('/ask-with-image', verifyJWT, upload.single('image'), async (req, res) => {
  const { text, cropType, sessionId } = req.body
  const userId = req.user.userId

  try {
    let imageUrl    = null
    let imageBuffer = null

    if (req.file) {
      // Nén ảnh — 2 bước nếu vẫn còn lớn sau lần đầu
      imageBuffer = await sharp(req.file.buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer()

      if (imageBuffer.length > 500 * 1024) {
        imageBuffer = await sharp(imageBuffer)
          .resize(800, 800, { fit: 'inside' })
          .jpeg({ quality: 65 })
          .toBuffer()
      }

      const fileName = `pest-images/${userId}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, imageBuffer, { contentType: 'image/jpeg', upsert: false })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('images').getPublicUrl(fileName)
      imageUrl = data.publicUrl
    }

    const question = text?.trim() || 'Cây bị bệnh gì vậy?'

    let result

    // Nếu có ảnh → dùng Gemini Vision phân tích trực tiếp
    if (imageBuffer) {
      const visionAnswer = await analyzeImageWithGemini(imageBuffer, question)
      if (visionAnswer) {
        result = {
          answer:       visionAnswer,
          confidence:   0.9,
          needEngineer: false,
          source:       'vision',
          chunksFound:  0,
        }
      }
    }

    // Fallback sang RAG nếu Vision thất bại hoặc không có ảnh
    if (!result) {
      const questionWithNote = imageUrl
        ? `[Nông dân gửi ảnh sâu bệnh kèm theo] ${question}`
        : question
      const history = await getRecentHistory(sessionId)
      result = await askRAG(questionWithNote, cropType, history)
    }

    const sid = await getOrCreateSession(userId, cropType, sessionId)

    const { data: userMsg } = await supabase.from('messages').insert({
      session_id: sid,
      role:       'user',
      content:    question,
      image_url:  imageUrl,
    }).select('id').single()

    const answerContent = result.needEngineer
      ? 'Ảnh và câu hỏi của bạn đã được gửi cho kỹ sư. Kỹ sư sẽ xem ảnh và trả lời trong 24 giờ.'
      : result.answer

    const { data: answerMsg } = await supabase
      .from('messages')
      .insert({
        session_id: sid,
        role:       result.needEngineer ? 'system' : 'assistant',
        content:    answerContent,
        confidence: result.confidence,
        source:     result.source,
      })
      .select('id')
      .single()

    if (result.needEngineer && userMsg) {
      await supabase.from('engineer_queue').insert({
        message_id: userMsg.id, status: 'pending',
      })
      notifyEngineer('Nông dân gửi ảnh sâu bệnh cần tư vấn', question.slice(0, 100))
        .catch(e => console.warn('[PUSH]', e.message))
    }

    res.json({
      answer:         result.answer,
      confidence:     result.confidence,
      source:         result.source,
      sessionId:      sid,
      imageUrl,
      engineerQueued: result.needEngineer,
      needEngineer:   result.needEngineer,
      messageId:      answerMsg?.id,
    })

  } catch (err) {
    console.error('[CHAT] /ask-with-image error:', err)
    res.status(500).json({ error: 'Không xử lý được ảnh. Thử lại sau nhé.' })
  }
})

// ─── POST /chat/stt-fallback — iOS Safari: gửi audio lên, trả về transcript ───
router.post('/stt-fallback', verifyJWT, upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không nhận được file audio.' })

  try {
    const { GoogleAIFileManager } = await import('@google/generative-ai/server')
    const { GoogleGenerativeAI }  = await import('@google/generative-ai')

    const fileManager = new GoogleAIFileManager(process.env.GOOGLE_API_KEY)
    const genAI       = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)

    const uploadResult = await fileManager.uploadFile(req.file.buffer, {
      mimeType:    req.file.mimetype || 'audio/webm',
      displayName: 'voice-query',
    })

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent([
      { fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } },
      'Hãy chuyển nội dung giọng nói trong file audio này thành văn bản tiếng Việt. Chỉ trả về văn bản, không giải thích thêm.',
    ])

    const transcript = result.response.text().trim()
    res.json({ transcript })
  } catch (err) {
    console.error('[STT] fallback error:', err.message)
    res.status(500).json({ error: 'Không nhận dạng được giọng nói. Thử gõ câu hỏi nhé.' })
  }
})

// ─── POST /chat/report-error — nông dân báo lỗi câu trả lời AI ───────────────
router.post('/report-error', verifyJWT, async (req, res) => {
  const { messageId, errorType, note } = req.body
  const VALID_TYPES = ['wrong_info', 'irrelevant', 'hard_to_understand']

  if (!messageId)                        return res.status(400).json({ error: 'Thiếu messageId.' })
  if (!VALID_TYPES.includes(errorType))  return res.status(400).json({ error: 'Loại lỗi không hợp lệ.' })

  try {
    await supabase.from('ai_error_reports').insert({
      message_id: messageId,
      user_id:    req.user.userId,
      error_type: errorType,
      note:       note?.trim() || null,
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Không gửi được báo lỗi.' })
  }
})

// ─── GET /chat/sessions/:userId — lịch sử phiên chat ─────────────────────────
router.get('/sessions/:userId', verifyJWT, async (req, res) => {
  const targetId = req.params.userId
  if (req.user.role === 'farmer' && req.user.userId !== targetId) {
    return res.status(403).json({ error: 'Không có quyền xem session của người khác.' })
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*, messages(count)')
    .eq('user_id', targetId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ sessions: data })
})

// ─── GET /chat/messages/:sessionId — tin nhắn trong 1 session ─────────────────
router.get('/messages/:sessionId', verifyJWT, async (req, res) => {
  const sessionId = req.params.sessionId

  // Nông dân chỉ được xem session của mình
  if (req.user.role === 'farmer') {
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single()

    if (!session) return res.status(404).json({ error: 'Không tìm thấy session.' })
    if (session.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Không có quyền xem tin nhắn này.' })
    }
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  res.json({ messages: data })
})

export default router
