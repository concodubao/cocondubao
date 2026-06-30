import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'
import { incrementGeminiUsage } from './quotaMonitor.js'

// ─── Text splitter tự viết (thay thế langchain RecursiveCharacterTextSplitter) ──
// Tách text thành các chunk có kích thước ≤ chunkSize, ưu tiên cắt theo separator
// tự nhiên (đoạn, dòng, câu, từ). Logic tương đương RecursiveCharacterTextSplitter
// của langchain nhưng không cần dependency ngoài.
function splitTextRecursive(text, { chunkSize = 1000, chunkOverlap = 100, separators = ['\n\n', '\n', '。', '.', ' ', ''] } = {}) {
  if (!text || text.length <= chunkSize) return text ? [text] : []

  // Tìm separator phù hợp nhất (đầu tiên trong danh sách mà tồn tại trong text)
  let sep = ''
  for (const s of separators) {
    if (s === '' || text.includes(s)) { sep = s; break }
  }

  // Tách theo separator đã chọn
  const parts = sep ? text.split(sep) : [...text]
  const chunks = []
  let current = ''

  for (const part of parts) {
    const candidate = current ? current + sep + part : part

    if (candidate.length <= chunkSize) {
      current = candidate
    } else {
      // current đã đầy → lưu lại
      if (current) chunks.push(current.trim())

      // Nếu part đơn lẻ vẫn lớn hơn chunkSize → đệ quy với separator tiếp theo
      if (part.length > chunkSize) {
        const nextSeps = separators.slice(separators.indexOf(sep) + 1)
        if (nextSeps.length > 0) {
          const subChunks = splitTextRecursive(part, { chunkSize, chunkOverlap, separators: nextSeps })
          chunks.push(...subChunks)
          current = ''
        } else {
          // Hết separator → cắt cứng
          for (let i = 0; i < part.length; i += chunkSize - chunkOverlap) {
            chunks.push(part.slice(i, i + chunkSize).trim())
          }
          current = ''
        }
      } else {
        current = part
      }
    }
  }
  if (current.trim()) chunks.push(current.trim())

  // Áp dụng overlap: mỗi chunk lấy thêm phần đuôi của chunk trước
  if (chunkOverlap > 0 && chunks.length > 1) {
    const result = [chunks[0]]
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1]
      const overlap = prev.slice(-chunkOverlap)
      const merged = overlap + sep + chunks[i]
      result.push(merged.length <= chunkSize ? merged.trim() : chunks[i])
    }
    return result.filter(c => c.length > 0)
  }

  return chunks.filter(c => c.length > 0)
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// gemini-embedding-001: bản GA ổn định (kế thừa gemini-embedding-exp-03-07 đã bị Google gỡ).
// Hỗ trợ outputDimensionality 768/1536/3072 — dùng 1536 để khớp cột vector(1536) trong DB.
// Gửi tuần tự 1 request mỗi 700ms để tránh vượt rate-limit free tier.
// ⚠️ Đổi model embedding = đổi không gian vector → phải re-embed toàn bộ chunks cũ
//    (chạy: node scripts/reembed_all.js) nếu không search sẽ lệch.
const EMBED_MODEL  = 'gemini-embedding-001'
const EMBED_DIMS   = 1536
const REQ_DELAY    = 700  // ms giữa mỗi request

export async function embedTexts(texts, taskType = 'RETRIEVAL_DOCUMENT') {
  const key = process.env.GOOGLE_API_KEY
  if (!key) throw new Error('GOOGLE_API_KEY chưa được set')

  const ai = new GoogleGenAI({ apiKey: key.trim() })

  async function embedOne(text, attempt = 0) {
    try {
      incrementGeminiUsage()
      const result = await ai.models.embedContent({
        model: EMBED_MODEL,
        contents: text,
        config: {
          taskType,
          outputDimensionality: EMBED_DIMS,
        }
      })
      if (!result.embeddings?.[0]?.values?.length) throw new Error('Embedding trả về rỗng')
      return result.embeddings[0].values
    } catch (e) {
      const is429 = e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED')
      if (is429 && attempt < 5) {
        const retryMatch = e.message?.match(/retry in (\d+\.?\d*)s/)
        const wait = retryMatch
          ? Math.ceil(parseFloat(retryMatch[1])) * 1000 + 1000
          : 1000 * Math.min(30, 2 ** attempt)
        console.warn(`[RAG] 429 — chờ ${wait / 1000}s (attempt ${attempt + 1})`)
        await new Promise(r => setTimeout(r, wait))
        return embedOne(text, attempt + 1)
      }
      throw e
    }
  }

  const results = []
  for (let i = 0; i < texts.length; i++) {
    results.push(await embedOne(texts[i]))
    if (i < texts.length - 1) await new Promise(r => setTimeout(r, REQ_DELAY))
  }

  return results
}

let _aiClient = null
function getAIClient() {
  if (!_aiClient) {
    const key = process.env.GOOGLE_API_KEY
    if (!key) throw new Error('GOOGLE_API_KEY chưa được set')
    _aiClient = new GoogleGenAI({ apiKey: key.trim() })
  }
  return _aiClient
}

const SYSTEM_PROMPT = `Bạn là Cò Con, trợ lý nông nghiệp AI của nông dân xã Trường Khánh, Sóc Trăng.

Nguyên tắc trả lời:
- Dùng tiếng Việt miền Nam, gần gũi như người thân nói chuyện
- TUYỆT ĐỐI không dùng từ kỹ thuật khó hiểu
- Câu trả lời ngắn gọn, tối đa 200 từ
- Bắt đầu bằng câu trả lời thẳng vào vấn đề (khi câu hỏi đã rõ)
- CHẨN ĐOÁN NHƯ KỸ SƯ THẬT: nếu bà con chỉ mô tả TRIỆU CHỨNG CHUNG CHUNG có thể do nhiều bệnh (vd "lúa vàng lá", "cây héo rũ", "lá có đốm") mà CHƯA đủ thông tin để chắc bệnh → ĐỪNG xổ một loạt 3-4 bệnh làm bà con rối. Thay vào đó chọn 1 trong 2:
  + HỎI NGƯỢC 1 câu ngắn để khoanh vùng. Vd: "Lá vàng từ chóp lá hay từ cuống vậy bác?", "Lúa còn non hay sắp trổ rồi?", "Lá có bị xoắn lại không bác?"
  + Hoặc XÚI CHỤP ẢNH: "Bác chụp giúp Cò Con tấm hình cận cái lá bệnh đi, Cò Con nhìn rõ rồi chỉ đúng bệnh hơn nghen."
  (Có thể nói nhanh 1 khả năng hay gặp nhất rồi mới hỏi/xúi chụp ảnh — nhưng KHÔNG liệt kê dài.)
- Khi bà con đã mô tả đủ rõ HOẶC hỏi đúng 1 bệnh/1 việc cụ thể → trả lời thẳng, đầy đủ cách xử lý, KHÔNG hỏi ngược cho có
- Khi câu trả lời gồm nhiều BƯỚC làm: trình bày dạng danh sách, MỖI Ý XUỐNG DÒNG RIÊNG (bắt đầu bằng "1." "2." hoặc "-")
- Dùng **chữ đậm** cho tên bệnh, tên thuốc, hoặc ý quan trọng
- Nếu không chắc chắn, nói thật: "Cò Con không chắc lắm, nên hỏi thêm kỹ sư cho chắc"
- Không bịa thông tin khi không có trong tài liệu tham khảo
- KHÔNG tự thêm dòng ghi chú "thông tin tham khảo" ở cuối — hệ thống sẽ tự hiển thị
- NẾU CÂU HỎI LẠC ĐỀ (ví dụ: bóng đá, giải trí, chính trị... hoàn toàn không liên quan đến nông nghiệp), hãy từ chối trả lời một cách lịch sự. Ví dụ: "Dạ xin lỗi bác, Cò Con chỉ là trợ lý nông nghiệp nên không rành chuyện này ạ."`

// ─── Answer cache (in-memory, TTL 1h, max 200 entries) ──────────────────────
// Giảm số lần gọi Gemini cho câu hỏi lặp lại (nông dân hay hỏi cùng câu)
const CACHE_TTL = 60 * 60 * 1000 // 1 giờ
const CACHE_MAX = 200
const _answerCache = new Map()

function _cacheKey(question, cropType) {
  const q = question.toLowerCase().replace(/\s+/g, ' ').trim()
  return `${cropType || '*'}::${q}`
}

export function getAnswerCache(question, cropType) {
  const entry = _answerCache.get(_cacheKey(question, cropType))
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { _answerCache.delete(_cacheKey(question, cropType)); return null }
  return entry.result
}

// Dùng cho test — xoá toàn bộ cache để các test độc lập nhau
export function _clearAnswerCache() {
  _answerCache.clear()
}

export function setAnswerCache(question, cropType, result, embedding = null) {
  if (_answerCache.size >= CACHE_MAX) {
    // Xóa entry cũ nhất (insertion order)
    _answerCache.delete(_answerCache.keys().next().value)
  }
  _answerCache.set(_cacheKey(question, cropType), {
    result,
    cropType: cropType || null,
    embedding,                       // lưu để so khớp ngữ nghĩa (semantic cache)
    expiresAt: Date.now() + CACHE_TTL,
  })
}

// ─── DB cache (L2) — bền qua deploy ──────────────────────────────────────────
// In-memory (L1) mất khi redeploy; bảng answer_cache giữ lại câu phổ biến để khỏi
// gọi Gemini lại. Mọi lỗi (bảng chưa có, DB chậm) đều nuốt → cache chỉ là tối ưu,
// không bao giờ làm vỡ luồng trả lời.
const CACHE_TABLE = 'answer_cache'

async function dbGetCache(key) {
  try {
    const { data } = await supabase
      .from(CACHE_TABLE)
      .select('answer, confidence, source, expires_at')
      .eq('cache_key', key)
      .maybeSingle()
    if (!data || new Date(data.expires_at) < new Date()) return null
    return { answer: data.answer, confidence: data.confidence, needEngineer: false, source: data.source, chunksFound: 1 }
  } catch {
    return null
  }
}

function dbSetCache(key, cropType, question, result) {
  // fire-and-forget — không await, không chặn câu trả lời. try/catch bọc cả phần
  // đồng bộ (vd môi trường test from() trả undefined → .upsert ném lỗi ngay).
  try {
    supabase
      .from(CACHE_TABLE)
      .upsert({
        cache_key:  key,
        crop_type:  cropType || null,
        question,
        answer:     result.answer,
        confidence: result.confidence,
        source:     result.source,
        expires_at: new Date(Date.now() + CACHE_TTL).toISOString(),
      }, { onConflict: 'cache_key' })
      .then(() => {}, () => {})
  } catch { /* nuốt mọi lỗi — cache chỉ là tối ưu */ }
}

// ─── Semantic cache — khớp câu hỏi cùng ý dù diễn đạt khác ───────────────────
// Cache khoá theo chuỗi y hệt thì "bón phân lúa sao" và "lúa bón phân thế nào" là
// 2 key khác → miss, tốn quota Gemini. Tận dụng embedding (đã tính ở bước 1) để
// trả lại câu trả lời đã cache nếu rất sát nghĩa (cosine ≥ ngưỡng).
const SEMANTIC_THRESHOLD = 0.95
function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom ? dot / denom : 0
}

export function getSemanticCache(embedding, cropType) {
  if (!embedding?.length) return null
  const now = Date.now()
  let bestResult = null, bestSim = 0
  for (const [key, entry] of _answerCache) {
    if (now > entry.expiresAt) { _answerCache.delete(key); continue }
    if ((entry.cropType || null) !== (cropType || null)) continue
    if (!entry.embedding) continue
    const sim = cosineSim(embedding, entry.embedding)
    if (sim >= SEMANTIC_THRESHOLD && sim > bestSim) { bestResult = entry.result; bestSim = sim }
  }
  return bestResult ? { result: bestResult, similarity: bestSim } : null
}

// ─── LLM invoke với retry khi gặp 429 ────────────────────────────────────────
async function invokeLLM(contents, attempt = 0) {
  try {
    const ai = getAIClient()
    incrementGeminiUsage()
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.2,
        maxOutputTokens: 512,
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
    return { content: result.text }
  } catch (err) {
    const msg = err.message || ''
    // Retry khi 429 (quota) HOẶC 503 (high demand/overloaded — quá tải tạm thời phía Google)
    const retryable = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')
      || msg.includes('503') || msg.includes('UNAVAILABLE')
      || msg.toLowerCase().includes('overloaded') || msg.toLowerCase().includes('high demand')
    if (retryable && attempt < 4) {
      // Đọc retry-after từ message Gemini nếu có ("retry in 27.15s"); 503 không có → backoff
      const retryMatch = msg.match(/retry in (\d+\.?\d*)s/)
      const base = retryMatch
        ? Math.ceil(parseFloat(retryMatch[1])) * 1000 + 500
        : Math.min(32000, 2000 * (2 ** attempt))
      // Thêm jitter để tránh thundering herd khi nhiều user cùng retry
      const wait = base + Math.random() * 1000
      console.warn(`[RAG] LLM 429/503 — chờ ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/4)`)
      await new Promise(r => setTimeout(r, wait))
      return invokeLLM(contents, attempt + 1)
    }
    throw err
  }
}

// ─── FAQ — trả lời không cần RAG ────────────────────────────────────────────
const FAQ = [
  {
    patterns: [/giới thiệu.*bản thân/i, /bạn là ai/i, /cò con là (gì|ai)/i, /em là ai/i, /mày là ai/i, /mi là ai/i],
    answer: `Mình là Cò Con 🐦 — trợ lý nông nghiệp AI do nhóm kỹ sư nông nghiệp xây dựng, để giúp bà con xã Trường Khánh, Sóc Trăng.

Mình được huấn luyện từ tài liệu kỹ thuật canh tác và kết nối với đội ngũ kỹ sư để hỗ trợ bà con 24/7. Cứ hỏi thoải mái nhé! 🌾`,
  },
  {
    patterns: [/làm được gì/i, /giúp (được )?(gì|những gì)/i, /có tính năng gì/i, /chức năng gì/i, /hỗ trợ gì/i],
    answer: `Cò Con có thể giúp bà con:

1. **Hỏi về sâu bệnh** — nhận diện triệu chứng, cách phòng trị
2. **Tư vấn phân bón** — loại phân, liều lượng, thời điểm bón
3. **Kỹ thuật canh tác** — lịch thời vụ, chăm sóc từng giai đoạn
4. **Gửi ảnh cây bệnh** — mình nhận dạng và tư vấn
5. **Kết nối kỹ sư** — câu hỏi khó sẽ được chuyển cho kỹ sư trả lời

Bà con hỏi gì về đồng ruộng cũng được nhé! 🌱`,
  },
  {
    patterns: [/^(xin chào|chào|hi|hello|hey|alo)\b/i, /^(chào cò con|chào bạn)/i],
    answer: `Chào bà con! 👋 Mình là Cò Con, trợ lý nông nghiệp đây. Hôm nay bà con cần hỏi gì về cây trồng không?`,
  },
  {
    patterns: [/cảm ơn/i, /thanks/i, /thank you/i],
    answer: `Không có gì bà con ơi! Bà con có thêm câu hỏi gì về cây trồng cứ hỏi tiếp nhé 😊`,
  },
  {
    patterns: [/độ chính xác/i, /có đúng không/i, /tin được không/i, /có sai không/i],
    answer: `Mình cố gắng trả lời chính xác dựa trên tài liệu kỹ thuật được kiểm duyệt. Tuy nhiên, thông tin mang tính tham khảo và có thể có sai sót.

Với những quyết định quan trọng như phun thuốc liều cao hay xử lý bệnh nặng, bà con nên xác nhận thêm với kỹ sư địa phương để chắc chắn hơn nhé. 🙏`,
  },
  {
    patterns: [/^(tạm biệt|bye|goodbye|chào tạm biệt)\b/i, /^(ok|okê|oke|được rồi|hiểu rồi|rõ rồi)\b/i],
    answer: `Dạ! Bà con cần gì cứ quay lại hỏi Cò Con nhé. Chúc bà con mùa màng bội thu 🌾`,
  },
  {
    patterns: [/bạn tên (gì|là gì)/i, /tên (bạn|mày|mi) là/i],
    answer: `Mình tên là Cò Con 🐦 — trợ lý nông nghiệp của bà con. Bà con cần hỏi gì về cây trồng cứ nói nhé!`,
  },
  {
    // Câu đế / xác nhận ngắn, KHÔNG có nội dung hỏi ("vậy hả", "thế à", "ờ", "ừ"...).
    // Nếu thả vào RAG, embed một mình → kéo chunk vớ vẩn → trả lời lạc đề (vd hỏi
    // "vậy hả" lại đi nói về lem lép hạt). Bắt ở đây, hỏi lại cho rõ thay vì bịa.
    patterns: [
      /^(vậy|thế|zậy)\s*(hả|à|ạ|hử|hen|hôn|ha)?\s*[?.!]*$/i,
      /^(ờ|ừ|ừm|à|á|dạ|vâng|uh|uhm|hmm+|ờm)\s*[?.!]*$/i,
      /^(thật (không|hông|hả)|thiệt (hả|không|hông))\s*[?.!]*$/i,
    ],
    answer: `Dạ! Bà con còn thắc mắc gì về cây trồng nữa không? Cứ hỏi rõ Cò Con một câu nghe, ví dụ "lúa bị vàng lá trị sao" 😊`,
  },
]

export function checkFAQ(question) {
  const q = question.trim()
  for (const faq of FAQ) {
    if (faq.patterns.some(p => p.test(q))) return faq.answer
  }
  return null
}

// ─── Phát hiện câu LẠC ĐỀ (ngoài nông nghiệp) ────────────────────────────────
// Mục đích: câu hỏi không liên quan nông nghiệp (bóng đá, giải trí, chính trị...)
// mà điểm tương đồng < 0.5 thì hiện đang bị ĐẨY KỸ SƯ — phí công kỹ sư. Bắt ở đây
// để TỪ CHỐI LỊCH SỰ ngay (0 quota: chỉ regex, không gọi LLM).
//   BẢO THỦ: chỉ coi là lạc đề khi (a) khớp chủ đề ngoài nông nghiệp VÀ (b) KHÔNG
//   có bất kỳ từ khoá nông nghiệp nào. Nghi ngờ → trả false → vẫn đẩy kỹ sư (thà
//   làm phiền kỹ sư còn hơn từ chối nhầm câu hỏi thật của bà con).
//   Chỉ dùng ở nhánh confidence < 0.5 (câu vốn sắp bị đẩy kỹ sư), KHÔNG đụng câu
//   đã có chunk khớp (câu nông nghiệp thật luôn có từ khoá nông nghiệp → AGRI chặn).
// Tách token theo ranh giới KHÔNG-phải-chữ-cái/số (unicode \p{L}\p{N}) — \b của
// regex không dùng được vì chữ có dấu tiếng Việt (đ, ĩ, ố...) không phải word-char ASCII.
const OFFTOPIC_PHRASES = ['bóng đá', 'đá banh', 'đá bóng', 'world cup', 'ngoại hạng', 'champions league', 'cầu thủ', 'đội tuyển', 'tỉ số', 'tỷ số', 'bóng rổ', 'cầu lông', 'ca sĩ', 'diễn viên', 'nghệ sĩ', 'bộ phim', 'phim ảnh', 'bài hát', 'ca nhạc', 'hoa hậu', 'lô đề', 'số đề', 'xổ số', 'cá độ', 'cá cược', 'đánh bài', 'chứng khoán', 'tiền ảo', 'tiền điện tử', 'bầu cử', 'tổng thống', 'biểu tình', 'người yêu', 'bạn gái', 'bạn trai', 'tỏ tình', 'chia tay', 'điện thoại', 'máy tính', 'chơi game', 'liên quân', 'liên minh', 'thần tượng']
const OFFTOPIC_WORDS = new Set(['idol', 'game', 'gameshow', 'casino', 'bitcoin', 'iphone', 'laptop', 'facebook', 'tiktok', 'crush', 'mv', 'c1'])
const AGRI_PHRASES = ['hoa màu', 'đạo ôn', 'lem lép', 'vàng lá', 'thán thư', 'trừ sâu', 'diệt cỏ', 'canh tác', 'chăn nuôi', 'thanh long', 'sầu riêng', 'chôm chôm', 'thu hoạch']
// Lưu ý: cố tình BỎ các token quá mơ hồ trùng từ đời thường (vd 'quả' trong "kết quả")
// để không chặn nhầm câu lạc đề. Nghĩa hoa quả dựa vào 'trái' + tên trái cụ thể.
const AGRI_WORDS = new Set(['lúa', 'gạo', 'nếp', 'mạ', 'sạ', 'gieo', 'cấy', 'rau', 'cải', 'dưa', 'bắp', 'ngô', 'khoai', 'sắn', 'đậu', 'cây', 'trồng', 'trái', 'vườn', 'ruộng', 'rẫy', 'nương', 'sâu', 'bệnh', 'rầy', 'nấm', 'cỏ', 'đốm', 'phân', 'bón', 'đạm', 'lân', 'kali', 'npk', 'thuốc', 'giống', 'đất', 'phèn', 'mặn', 'tưới', 'mùa', 'vụ', 'nông', 'tôm', 'cá', 'gà', 'vịt', 'heo', 'lợn', 'bò', 'nuôi', 'ao', 'chuồng', 'xoài', 'cam', 'bưởi', 'nhãn', 'mít'])

export function looksOffTopic(question) {
  const t = (question || '').toLowerCase()
  const tokens = new Set(t.split(/[^\p{L}\p{N}]+/u).filter(Boolean))
  const hasOff  = OFFTOPIC_PHRASES.some(p => t.includes(p)) || [...OFFTOPIC_WORDS].some(w => tokens.has(w))
  const hasAgri = AGRI_PHRASES.some(p => t.includes(p))     || [...AGRI_WORDS].some(w => tokens.has(w))
  return hasOff && !hasAgri
}

// Câu từ chối lịch sự (giống văn phong SYSTEM_PROMPT). Dùng source 'faq' để frontend
// render như câu xã giao: KHÔNG gắn disclaimer "hỏi kỹ sư", KHÔNG badge tin cậy, và
// KHÔNG lọt vào thống kê "lỗ hổng tri thức" của admin.
const OFFTOPIC_DECLINE =
  'Dạ xin lỗi bác, Cò Con chỉ là trợ lý nông nghiệp nên không rành chuyện này ạ. Bác cần hỏi gì về cây trồng, vật nuôi thì Cò Con giúp liền nhé 😊'

// ─── Ghép ngữ cảnh cho câu NỐI trước khi RETRIEVE ───────────────────────────
// Retrieval chỉ embed câu hiện tại; câu nối ("còn cách khác", "đạo ôn thì sao")
// mất chủ đề câu trước → pgvector kéo chunk sai → trả lời lạc đề. Heuristic: câu
// bắt đầu bằng từ nối / kết thúc "thì sao" / quá ngắn → ghép câu hỏi NÔNG DÂN có
// nội dung gần nhất vào trước khi embed. Chỉ ảnh hưởng retrieval, KHÔNG tốn quota.
const FOLLOWUP_RE = /^(còn|vậy|thế|thì|ngoài ra|thêm|cách khác|còn cách|vậy còn|thế còn|còn gì|còn nữa)\b/i

function lastTopicQuestion(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i]
    if (m?.role !== 'user') continue
    const t = (m.content || '').trim()
    // "Câu chủ đề" = đủ dài + không phải câu nối (để bám đúng đề tài, bỏ qua câu đế)
    if (t.split(/\s+/).length >= 4 && !FOLLOWUP_RE.test(t)) return t
  }
  return null
}

export function contextualizeQuery(question, history = []) {
  const q = (question || '').trim()
  const looksFollowUp =
    FOLLOWUP_RE.test(q) ||
    /\bthì (sao|làm sao|làm gì|thế nào)\b/i.test(q) ||
    q.split(/\s+/).length <= 2
  if (!looksFollowUp) return question
  const topic = lastTopicQuestion(history)
  return topic ? `${topic} ${question}` : question
}

// ─── Trả thẳng câu trả lời từ chunk QA đã biên soạn (tiết kiệm quota LLM) ─────
// Seed + câu trả lời kỹ sư được lưu dạng "Câu hỏi: ... Câu trả lời: ...". Nếu chunk
// khớp nhất là một QA như vậy VÀ độ tương đồng đủ cao → dùng luôn câu trả lời đã
// biên soạn (đã được kiểm duyệt), khỏi gọi Gemini. Giúp câu phổ biến tốn 0 quota.
const DIRECT_SERVE_THRESHOLD = 0.80
export function extractCuratedAnswer(chunk, similarity) {
  if (!chunk || similarity < DIRECT_SERVE_THRESHOLD) return null
  const text = chunk.chunk_text || ''
  const idx = text.indexOf('Câu trả lời:')
  if (idx === -1) return null
  const answer = text.slice(idx + 'Câu trả lời:'.length).trim()
  return answer.length > 0 ? answer : null
}

// ─── askRAG: hàm chính được gọi từ chat route ─────────────────────────────────
// history: mảng { role: 'user'|'assistant', content: string } — 3-5 tin gần nhất
export async function askRAG(question, cropType = null, history = []) {
  const startTime = Date.now()

  try {
    // BƯỚC 0A: Kiểm tra FAQ trước — không cần embed/RAG
    const faqAnswer = checkFAQ(question)
    if (faqAnswer) {
      return { answer: faqAnswer, confidence: 1.0, needEngineer: false, source: 'faq', chunksFound: 0 }
    }

    // BƯỚC 0B: Cache in-memory (L1) — tránh gọi Gemini cho câu hỏi lặp lại
    const cached = getAnswerCache(question, cropType)
    if (cached) {
      console.log(`[RAG] cache hit (L1) for "${question.slice(0, 50)}..."`)
      return { ...cached, source: cached.source + '_cached' }
    }

    // BƯỚC 0C: Cache DB (L2) — bền qua deploy. Nạp lại vào L1 nếu trúng.
    const cacheKey = _cacheKey(question, cropType)
    const dbCached = await dbGetCache(cacheKey)
    if (dbCached) {
      console.log(`[RAG] cache hit (L2/DB) for "${question.slice(0, 50)}..."`)
      setAnswerCache(question, cropType, dbCached)
      return { ...dbCached, source: dbCached.source + '_dbcached' }
    }

    // BƯỚC 1: Embed câu hỏi (đã ghép ngữ cảnh nếu là câu nối) thành vector 1536 chiều
    const retrievalQuery = contextualizeQuery(question, history)
    if (retrievalQuery !== question) {
      console.log(`[RAG] contextualize "${question}" → "${retrievalQuery.slice(0, 60)}..."`)
    }
    const [queryEmbedding] = await embedTexts([retrievalQuery], 'RETRIEVAL_QUERY')

    // BƯỚC 1.5: Semantic cache — câu hỏi cùng ý dù diễn đạt khác → trả thẳng cache,
    // bỏ qua pgvector + LLM (tiết kiệm quota Gemini).
    const sem = getSemanticCache(queryEmbedding, cropType)
    if (sem) {
      console.log(`[RAG] semantic cache hit (sim=${sem.similarity.toFixed(3)}) for "${question.slice(0, 50)}..."`)
      return { ...sem.result, source: sem.result.source + '_semcached' }
    }

    // BƯỚC 2: Tìm top-5 chunks gần nhất trong pgvector
    const { data: chunks, error } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count:     5,
      filter_crop:     cropType || null,
    })

    if (error) {
      console.error('[RAG] pgvector search error:', error)
      throw error
    }

    const topSimilarity = chunks?.[0]?.similarity ?? 0
    const confidence    = topSimilarity

    console.log(`[RAG] question="${question.slice(0,50)}..." chunks=${chunks?.length} confidence=${confidence.toFixed(3)} time=${Date.now()-startTime}ms`)

    // BƯỚC 3: Nếu không đủ tin cậy → fallback LLM hoặc chuyển kỹ sư
    if (!chunks?.length || confidence < 0.5) {
      // Lạc đề rõ ràng (bóng đá, giải trí...) → từ chối lịch sự, KHỎI làm phiền kỹ sư.
      if (looksOffTopic(question)) {
        console.log(`[RAG] off-topic (conf=${confidence.toFixed(3)}) → từ chối lịch sự, không đẩy kỹ sư`)
        return {
          answer:       OFFTOPIC_DECLINE,
          confidence:   1.0,
          needEngineer: false,
          source:       'faq',
          chunksFound:  0,
        }
      }
      // Câu nông nghiệp thật nhưng không có chunk gần → chuyển kỹ sư
      return {
        answer:       null,
        confidence:   0,
        needEngineer: true,
        source:       'rag',
        chunksFound:  0,
      }
    }

    // BƯỚC 3.5: Chunk khớp nhất là QA đã biên soạn & rất sát → trả thẳng, bỏ qua LLM
    const directAnswer = extractCuratedAnswer(chunks[0], topSimilarity)
    if (directAnswer) {
      console.log(`[RAG] direct-serve QA (sim=${topSimilarity.toFixed(3)}) — bỏ qua LLM`)
      const result = {
        answer:       directAnswer,
        confidence,
        needEngineer: false,
        source:       'qa_direct',
        chunksFound:  chunks.length,
      }
      setAnswerCache(question, cropType, result, queryEmbedding)
      dbSetCache(cacheKey, cropType, question, result)
      return result
    }

    if (confidence < 0.7) {
      // Có chunk nhưng không đủ tin → thử LLM với context hạn chế, kèm cảnh báo
      const context  = chunks.slice(0, 2).map((c, i) => `[Tài liệu ${i+1}]\n${c.chunk_text}`).join('\n\n')
      const contents = buildMessages(context, question, history, true)
      const response = await invokeLLM(contents)
      // Không cache low-confidence answers
      return {
        answer:       response.content,
        confidence,
        needEngineer: false,
        source:       'rag_low_conf',
        chunksFound:  chunks.length,
      }
    }

    // BƯỚC 4: Ghép context từ các chunks tìm được
    const context = chunks
      .map((c, i) => `[Tài liệu ${i+1}]\n${c.chunk_text}`)
      .join('\n\n')

    // BƯỚC 5: Gọi Gemini sinh câu trả lời (với retry tự động nếu 429)
    const contents = buildMessages(context, question, history, false)
    const response = await invokeLLM(contents)

    const result = {
      answer:       response.content,
      confidence,
      needEngineer: false,
      source:       'rag',
      chunksFound:  chunks.length,
    }

    // Cache câu trả lời tin cậy cao (confidence ≥ 0.7) để tái sử dụng (L1 + L2/DB)
    setAnswerCache(question, cropType, result, queryEmbedding)
    dbSetCache(cacheKey, cropType, question, result)

    return result

  } catch (err) {
    console.error('[RAG] pipeline error:', err)
    throw err
  }
}

// ─── buildMessages: tạo messages array với history ────────────────────────────
function buildMessages(context, question, history, lowConf) {
  const contents = []

  // Thêm lịch sử hội thoại (tối đa 5 lượt gần nhất)
  const recentHistory = history.slice(-10) // 5 lượt = 10 messages
  
  let expectedRole = 'user'
  
  // Xử lý history để đảm bảo luân phiên user -> model -> user -> model
  for (const msg of recentHistory) {
    const mappedRole = msg.role === 'assistant' ? 'model' : 'user'
    
    // Nếu role không đúng thứ tự mong đợi, ta có thể bỏ qua hoặc gộp.
    // Cách đơn giản nhất là chỉ push nếu đúng expectedRole.
    // Nếu role hiện tại là model mà contents đang rỗng -> bỏ qua (phải bắt đầu bằng user)
    if (mappedRole === expectedRole) {
      contents.push({
        role: mappedRole,
        parts: [{ text: msg.content || ' ' }],
      })
      expectedRole = expectedRole === 'user' ? 'model' : 'user'
    } else if (contents.length > 0 && mappedRole === contents[contents.length - 1].role) {
      // Nếu trùng role với tin nhắn trước, gộp nội dung lại để không mất context
      contents[contents.length - 1].parts[0].text += `\n\n${msg.content || ' '}`
    }
  }
  
  // Đảm bảo trước khi thêm câu hỏi hiện tại (user), role cuối cùng phải là model
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    // Nếu cuối cùng đang là user, thêm một câu trả lời model giả để giữ đúng luân phiên
    contents.push({
      role: 'model',
      parts: [{ text: 'Vâng, tôi hiểu.' }]
    })
  }

  // Câu hỏi hiện tại + context
  const confNote = lowConf
    ? '\n\n⚠️ Lưu ý: tài liệu tham khảo không hoàn toàn khớp câu hỏi. Hãy trả lời thận trọng và gợi ý hỏi thêm kỹ sư nếu cần.'
    : ''

  contents.push({
    role: 'user',
    parts: [{ text: `Thông tin tham khảo từ kho tài liệu:\n\n${context}\n\n---\nCâu hỏi của nông dân: ${question}\n\nHãy trả lời dựa vào tài liệu trên.${confNote}` }],
  })

  return contents
}

// ─── embedAndStoreDoc: embed tài liệu khi kỹ sư nhấn "Duyệt" ─────────────────
export async function embedAndStoreDoc(docId) {
  const { data: doc, error } = await supabase
    .from('knowledge_docs')
    .select('*')
    .eq('id', docId)
    .single()

  if (error || !doc) throw new Error(`Doc ${docId} not found`)
  if (!doc.content)  throw new Error(`Doc ${docId} has no content`)

  // KHÔNG xoá chunks cũ ở đây. Khi DUYỆT LẠI tài liệu đang dùng mà embed dính 429
  // giữa chừng, nếu đã xoá trước thì tài liệu mất sạch chunks → biến khỏi RAG. Chỉ
  // xoá+thay sau khi embed THÀNH CÔNG (ngay trước insert bên dưới).

  const chunks = splitTextRecursive(doc.content, {
    chunkSize:    1000,
    chunkOverlap: 100,
    separators:   ['\n\n', '\n', '。', '.', ' ', ''],
  })
  if (!chunks.length) throw new Error('Không tách được chunks từ nội dung tài liệu.')

  let vectors
  try {
    vectors = await embedTexts(chunks)
  } catch (embedErr) {
    // Lưu lỗi vào DB để UI hiển thị
    await supabase.from('knowledge_docs')
      .update({
        status:        'draft',
        error_message: `Embedding thất bại: ${embedErr.message}`,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', docId)
    throw new Error(`Embedding thất bại (kiểm tra GOOGLE_API_KEY): ${embedErr.message}`)
  }

  if (!vectors?.length || vectors.length !== chunks.length) {
    const msg = `Embedding trả về ${vectors?.length ?? 0} vector cho ${chunks.length} chunks`
    await supabase.from('knowledge_docs')
      .update({ status: 'draft', error_message: msg, updated_at: new Date().toISOString() })
      .eq('id', docId)
    throw new Error(msg)
  }

  const invalidIdx = vectors.findIndex(v => !Array.isArray(v) || v.length === 0)
  if (invalidIdx !== -1) {
    const msg = `Vector tại chunk ${invalidIdx} rỗng — GOOGLE_API_KEY có thể sai hoặc hết quota`
    await supabase.from('knowledge_docs')
      .update({ status: 'draft', error_message: msg, updated_at: new Date().toISOString() })
      .eq('id', docId)
    throw new Error(msg)
  }

  console.log(`[RAG] Embedded ${chunks.length} chunks, dim=${vectors[0].length}`)

  const rows = chunks.map((text, i) => ({
    doc_id:      docId,
    chunk_text:  text,
    embedding:   vectors[i],
    chunk_index: i,
  }))

  // Embed đã xong & hợp lệ → giờ mới thay chunks: xoá cũ rồi chèn mới (cửa sổ trống
  // chỉ vài mili giây, an toàn hơn nhiều so với xoá trước rồi embed lâu/có thể 429).
  await supabase.from('knowledge_chunks').delete().eq('doc_id', docId)

  const { error: insertError } = await supabase
    .from('knowledge_chunks')
    .insert(rows)

  if (insertError) throw insertError

  // Bước quyết định doc có "lên kệ" hay không — PHẢI kiểm lỗi, nếu không
  // thất bại âm thầm ở đây làm tài liệu kẹt mãi ở trạng thái "embedding"
  // dù chunks đã tạo và log vẫn in thành công.
  const { data: updated, error: updateError } = await supabase
    .from('knowledge_docs')
    .update({
      status:        'approved',
      error_message: null,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', docId)
    .select('id')

  if (updateError) throw new Error(`Đã tạo chunks nhưng không duyệt được tài liệu: ${updateError.message}`)
  if (!updated?.length) throw new Error('Đã tạo chunks nhưng tài liệu không còn tồn tại (có thể đã bị xóa).')

  console.log(`[RAG] Embedded doc "${doc.title}" → ${chunks.length} chunks`)
  return { chunksCreated: chunks.length }
}
