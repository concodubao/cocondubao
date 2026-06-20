import express  from 'express'
import multer   from 'multer'
import sharp    from 'sharp'
import { verifyJWT }       from '../middleware/auth.js'
import { askRAG }          from '../services/rag.js'
import { notifyEngineer }  from '../services/webpush.js'
import { supabase }        from '../services/supabase.js'

const router = express.Router()

// Nhận diện lỗi quá tải của Gemini (429 quota HOẶC 503 high-demand) để trả 429
function isRateLimit(err) {
  const m = (err?.message || '').toLowerCase()
  return m.includes('429') || m.includes('resource_exhausted') || m.includes('quota')
    || m.includes('503') || m.includes('unavailable') || m.includes('overloaded') || m.includes('high demand')
}
const RATE_LIMIT_MSG = 'Cò Con đang có nhiều người hỏi cùng lúc, bạn chờ khoảng 1 phút rồi hỏi lại nhé.'

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Chỉ hỗ trợ file ảnh'))
  },
})

// Instance riêng cho STT: chấp nhận audio/* (iOS gửi audio/mp4, máy khác audio/webm).
// Cũng nhận application/octet-stream phòng trình duyệt không gắn mimetype chuẩn.
const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') cb(null, true)
    else cb(new Error('Chỉ hỗ trợ file âm thanh'))
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
  const { text, cropType, sessionId, testMode } = req.body
  const userId = req.user.userId

  if (!text?.trim()) return res.status(400).json({ error: 'Vui lòng nhập câu hỏi.' })
  if (text.length > 1000) return res.status(400).json({ error: 'Câu hỏi quá dài (tối đa 1000 ký tự).' })

  // Chế độ test (chỉ kỹ sư/admin, từ màn Test AI): chạy RAG để xem AI trả lời ra
  // sao nhưng KHÔNG lưu session/message, KHÔNG đẩy hàng đợi kỹ sư, KHÔNG push —
  // tránh làm nhiễu dữ liệu thật và spam thông báo cho kỹ sư khác.
  const isTest = testMode === true && (req.user.role === 'engineer' || req.user.role === 'admin')
  if (isTest) {
    try {
      const result = await askRAG(text.trim(), cropType, [])
      return res.json({
        answer:        result.answer,
        confidence:    result.confidence,
        source:        result.source,
        needEngineer:  result.needEngineer,
        sessionId:     null,
        engineerQueued: false,
        messageId:     null,
        testMode:      true,
      })
    } catch (err) {
      console.error('[CHAT] /ask testMode error:', err)
      if (isRateLimit(err)) return res.status(429).json({ error: RATE_LIMIT_MSG })
      return res.status(500).json({ error: 'Cò Con đang bận, bạn thử lại sau nhé.' })
    }
  }

  try {
    // Lấy lịch sử để AI nhớ ngữ cảnh
    const history = await getRecentHistory(sessionId)
    const result = await askRAG(text.trim(), cropType, history)

    const sid = await getOrCreateSession(userId, cropType, sessionId)

    // Lưu câu hỏi của nông dân — PHẢI check lỗi: queue kỹ sư liên kết tới message
    // này, nếu insert thất bại mà bỏ qua thì câu trả lời vẫn ghi nhưng không vào
    // được hàng đợi → nông dân thấy "đã chuyển kỹ sư" mà thực ra không có gì.
    const { data: userMsg, error: userMsgErr } = await supabase.from('messages').insert({
      session_id: sid,
      role:       'user',
      content:    text.trim(),
    }).select('id').single()
    if (userMsgErr || !userMsg) throw userMsgErr || new Error('Không lưu được câu hỏi.')

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
    if (isRateLimit(err)) return res.status(429).json({ error: RATE_LIMIT_MSG })
    res.status(500).json({ error: 'Cò Con đang bận, bạn thử lại sau nhé.' })
  }
})

// Câu trả lời ảnh có dấu hiệu KHÔNG CHẮC → nên để kỹ sư xem ảnh trực tiếp thay vì
// trả lời tự tin có thể sai (đoán sai sâu bệnh = nông dân phun sai thuốc).
function visionLooksUncertain(text) {
  const t = (text || '').toLowerCase()
  return /(không|chẳng|khó)\s*(chắc|rõ|xác định|nhận ra|phân biệt)|không thể xác định|cần (thêm|hỏi).*(kỹ sư|chuyên gia)|chụp.*rõ hơn|ảnh.*(mờ|không rõ|thiếu sáng)/.test(t)
}

// ─── Helper: phân tích ảnh bằng Gemini Vision ───────────────────────────────
async function analyzeImageWithGemini(imageBuffer, question) {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI  = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
    // gemini-2.0-flash free tier đã về 0 (limit:0) → đổi sang gemini-2.5-flash
    // (đa phương thức, còn free tier). LƯU Ý: model này CHUNG bucket quota với
    // LLM trả lời RAG → bật billing Gemini mới là cách triệt để. maxOutputTokens
    // cao vì 2.5 là model "thinking" (token suy nghĩ tính vào output, để thấp
    // sẽ bị cắt cụt câu trả lời).
    const model  = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { maxOutputTokens: 2048 },
    })

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
    // Vẫn trả null để fallback mềm sang RAG (nông dân vẫn nhận được câu trả lời
    // dựa trên text). Nếu RAG cũng dính quota, handler ngoài sẽ trả 429 thân thiện.
    const rl = isRateLimit(err)
    console.warn(`[VISION] Gemini Vision failed${rl ? ' (rate limit/quota)' : ''}:`, err.message)
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
      if (visionAnswer && !visionLooksUncertain(visionAnswer)) {
        result = {
          answer:       visionAnswer,
          confidence:   0.9,
          needEngineer: false,
          source:       'vision',
          chunksFound:  0,
        }
      } else if (visionAnswer) {
        // Vision không chắc → chuyển kỹ sư (ảnh đã upload, kỹ sư xem được)
        result = {
          answer:       null,
          confidence:   0.4,
          needEngineer: true,
          source:       'vision_low_conf',
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

    const { data: userMsg, error: userMsgErr } = await supabase.from('messages').insert({
      session_id: sid,
      role:       'user',
      content:    question,
      image_url:  imageUrl,
    }).select('id').single()
    if (userMsgErr || !userMsg) throw userMsgErr || new Error('Không lưu được câu hỏi.')

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
    if (isRateLimit(err)) return res.status(429).json({ error: RATE_LIMIT_MSG })
    res.status(500).json({ error: 'Không xử lý được ảnh. Thử lại sau nhé.' })
  }
})

// ─── POST /chat/stt-fallback — iOS Safari: gửi audio lên, trả về transcript ───
router.post('/stt-fallback', verifyJWT, uploadAudio.single('audio'), async (req, res) => {
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

    // gemini-1.5-flash đã bị Google gỡ (404) → dùng 2.5-flash-lite (nhận audio,
    // không thinking, bucket quota riêng với LLM trả lời).
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
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

// ─── POST /chat/escalate — nông dân chủ động xin kỹ sư tư vấn thêm ───────────
// Dùng khi AI đã trả lời nhưng nông dân muốn kỹ sư xem lại. Tạo entry hàng đợi
// từ câu hỏi (user message) ngay trước câu trả lời được chỉ định.
router.post('/escalate', verifyJWT, async (req, res) => {
  const { messageId } = req.body
  if (!messageId) return res.status(400).json({ error: 'Thiếu messageId.' })

  try {
    const { data: ans } = await supabase
      .from('messages')
      .select('id, session_id, created_at, chat_sessions ( user_id )')
      .eq('id', messageId)
      .single()
    if (!ans) return res.status(404).json({ error: 'Không tìm thấy câu trả lời.' })
    if (ans.chat_sessions?.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Không có quyền với tin nhắn này.' })
    }

    // Câu hỏi của nông dân ngay trước câu trả lời này
    const { data: prev } = await supabase
      .from('messages')
      .select('id, content')
      .eq('session_id', ans.session_id)
      .eq('role', 'user')
      .lte('created_at', ans.created_at)
      .order('created_at', { ascending: false })
      .limit(1)
    const question = prev?.[0]
    if (!question) return res.status(404).json({ error: 'Không tìm thấy câu hỏi gốc.' })

    // Đã có trong hàng đợi rồi thì không tạo trùng
    const { data: existing } = await supabase
      .from('engineer_queue').select('id').eq('message_id', question.id).limit(1)
    if (existing?.length) return res.json({ success: true, already: true })

    await supabase.from('engineer_queue').insert({ message_id: question.id, status: 'pending' })
    notifyEngineer('Nông dân muốn kỹ sư tư vấn thêm', (question.content || '').slice(0, 100))
      .catch(e => console.warn('[PUSH] notify engineer failed:', e.message))

    res.json({ success: true })
  } catch (err) {
    console.error('[CHAT] /escalate error:', err)
    res.status(500).json({ error: 'Không gửi được cho kỹ sư. Thử lại nhé.' })
  }
})

// ─── POST /chat/report-error — nông dân báo lỗi câu trả lời AI ───────────────
router.post('/report-error', verifyJWT, async (req, res) => {
  const { messageId, errorType, note } = req.body
  const VALID_TYPES = ['wrong_info', 'irrelevant', 'hard_to_understand']

  if (!messageId)                        return res.status(400).json({ error: 'Thiếu messageId.' })
  if (!VALID_TYPES.includes(errorType))  return res.status(400).json({ error: 'Loại lỗi không hợp lệ.' })

  try {
    // Chỉ cho báo lỗi trên message thuộc session của chính mình (chặn báo lỗi message bất kỳ)
    const { data: msg } = await supabase
      .from('messages')
      .select('id, chat_sessions ( user_id )')
      .eq('id', messageId)
      .single()
    if (!msg) return res.status(404).json({ error: 'Không tìm thấy câu trả lời.' })
    if (msg.chat_sessions?.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Không có quyền báo lỗi tin nhắn này.' })
    }

    // Chặn spam: 1 nông dân chỉ báo lỗi 1 lần cho mỗi message (idempotent)
    const { data: dup } = await supabase
      .from('ai_error_reports')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', req.user.userId)
      .limit(1)
    if (dup?.length) return res.json({ success: true, already: true })

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

// ─── POST /chat/feedback — nông dân đánh dấu câu trả lời hữu ích (👍) ─────────
// Tín hiệu tích cực bổ sung cho report-error (👎). Câu nhiều 👍 + confidence cao
// về sau có thể gợi ý kỹ sư duyệt thành QA biên soạn.
router.post('/feedback', verifyJWT, async (req, res) => {
  const { messageId, helpful = true } = req.body
  if (!messageId) return res.status(400).json({ error: 'Thiếu messageId.' })

  try {
    // Chỉ phản hồi trên message thuộc session của chính mình
    const { data: msg } = await supabase
      .from('messages')
      .select('id, chat_sessions ( user_id )')
      .eq('id', messageId)
      .single()
    if (!msg) return res.status(404).json({ error: 'Không tìm thấy câu trả lời.' })
    if (msg.chat_sessions?.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Không có quyền phản hồi tin nhắn này.' })
    }

    // upsert → đổi được phản hồi, 1 nông dân 1 lần / 1 câu (unique message_id,user_id)
    const { error } = await supabase.from('answer_feedback').upsert({
      message_id: messageId,
      user_id:    req.user.userId,
      helpful:    helpful !== false,
    }, { onConflict: 'message_id,user_id' })
    if (error) throw error

    res.json({ success: true })
  } catch (err) {
    console.error('[CHAT] /feedback error:', err.message)
    res.status(500).json({ error: 'Không gửi được phản hồi.' })
  }
})

// ─── GET /chat/sessions/:userId — lịch sử phiên chat ─────────────────────────
router.get('/sessions/:userId', verifyJWT, async (req, res) => {
  const targetId = req.params.userId
  // Chỉ xem được lịch sử phiên của chính mình (kể cả staff — staff đọc nội dung
  // câu hỏi escalate qua /messages, không cần liệt kê phiên của nông dân).
  if (req.user.userId !== targetId) {
    return res.status(403).json({ error: 'Không có quyền xem session của người khác.' })
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, crop_type, status, created_at, messages(count)')
    .eq('user_id', targetId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return res.status(500).json({ error: error.message })

  // Lấy câu hỏi đầu tiên của mỗi session làm preview
  const sessionIds = (data || []).map(s => s.id)
  let previews = {}
  if (sessionIds.length > 0) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('session_id, content')
      .in('session_id', sessionIds)
      .eq('role', 'user')
      .order('created_at', { ascending: true })

    for (const m of msgs || []) {
      if (!previews[m.session_id]) previews[m.session_id] = m.content
    }
  }

  const sessions = (data || []).map(s => ({
    id:           s.id,
    crop_type:    s.crop_type,
    status:       s.status,
    created_at:   s.created_at,
    messageCount: s.messages?.[0]?.count ?? 0,
    preview:      previews[s.id] || null,
  }))

  res.json({ sessions })
})

// ─── GET /chat/messages/:sessionId — tin nhắn trong 1 session ─────────────────
router.get('/messages/:sessionId', verifyJWT, async (req, res) => {
  const sessionId = req.params.sessionId

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('user_id')
    .eq('id', sessionId)
    .single()
  if (!session) return res.status(404).json({ error: 'Không tìm thấy session.' })

  const isOwner = session.user_id === req.user.userId
  const isStaff = req.user.role === 'engineer' || req.user.role === 'admin'

  // Chủ phiên xem được. Staff chỉ xem được nếu phiên này từng được chuyển lên
  // hàng đợi kỹ sư (nông dân chủ động escalate) — không cho đọc chat tuỳ ý.
  if (!isOwner) {
    if (!isStaff) {
      return res.status(403).json({ error: 'Không có quyền xem tin nhắn này.' })
    }
    const { data: sMsgs } = await supabase.from('messages').select('id').eq('session_id', sessionId)
    const ids = (sMsgs || []).map(m => m.id)
    let escalated = false
    if (ids.length) {
      const { data: q } = await supabase.from('engineer_queue').select('id').in('message_id', ids).limit(1)
      escalated = (q?.length || 0) > 0
    }
    if (!escalated) {
      return res.status(403).json({ error: 'Chỉ xem được cuộc trò chuyện đã chuyển cho kỹ sư.' })
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
