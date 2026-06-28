import { ChatGoogleGenerativeAI }         from '@langchain/google-genai'
import { GoogleGenerativeAI }             from '@google/generative-ai'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { createClient } from '@supabase/supabase-js'

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

  const genAI = new GoogleGenerativeAI(key.trim())
  const model  = genAI.getGenerativeModel({ model: EMBED_MODEL })

  async function embedOne(text, attempt = 0) {
    try {
      const result = await model.embedContent({
        content:              { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBED_DIMS,
      })
      if (!result.embedding?.values?.length) throw new Error('Embedding trả về rỗng')
      return result.embedding.values
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

// ─── LLM: gemini-2.5-flash ────────────────────────────────────────────────────
// Free tier tính quota RIÊNG theo từng model (~5 RPM / ~20 RPD/model cho nhóm
// generate). gemini-2.0-flash & flash-lite cùng cạn nhanh; gemini-2.5-flash có
// bucket quota riêng và chất lượng trả lời cao hơn. Vision (chat.js) vẫn dùng
// gemini-2.0-flash → quota tách biệt. Hết 429 hẳn thì cần bật billing.
const llm = new ChatGoogleGenerativeAI({
  model:           'gemini-2.5-flash',
  temperature:     0.2,
  // 2.5-flash là model "thinking": token suy nghĩ nội bộ TÍNH VÀO maxOutputTokens.
  // Để 500 thì thinking ăn hết → câu trả lời bị cắt cụt. Nâng lên 2048 để chừa đủ
  // chỗ cho cả thinking + câu trả lời (system prompt đã giới hạn ≤200 từ).
  // (langchain 0.1.3 quá cũ, chưa hỗ trợ thinkingConfig để tắt hẳn thinking.)
  maxOutputTokens: 2048,
  apiKey:          process.env.GOOGLE_API_KEY,
})

const SYSTEM_PROMPT = `Bạn là Cò Con, trợ lý nông nghiệp AI của nông dân xã Trường Khánh, Sóc Trăng.

Nguyên tắc trả lời:
- Dùng tiếng Việt miền Nam, gần gũi như người thân nói chuyện
- TUYỆT ĐỐI không dùng từ kỹ thuật khó hiểu
- Câu trả lời ngắn gọn, tối đa 200 từ
- Bắt đầu bằng câu trả lời thẳng vào vấn đề
- Nếu có nhiều nguyên nhân hoặc nhiều bước: trình bày dạng danh sách, MỖI Ý XUỐNG DÒNG RIÊNG (bắt đầu bằng "1." "2." hoặc "-"), KHÔNG gộp hết vào một đoạn dài
- Dùng **chữ đậm** cho tên bệnh, tên thuốc, hoặc ý quan trọng
- Nếu không chắc chắn, nói thật: "Cò Con không chắc lắm, nên hỏi thêm kỹ sư cho chắc"
- Không bịa thông tin khi không có trong tài liệu tham khảo
- KHÔNG tự thêm dòng ghi chú "thông tin tham khảo" ở cuối — hệ thống sẽ tự hiển thị`

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
async function invokeLLM(messages, attempt = 0) {
  try {
    return await llm.invoke(messages)
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
      return invokeLLM(messages, attempt + 1)
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
]

export function checkFAQ(question) {
  const q = question.trim()
  for (const faq of FAQ) {
    if (faq.patterns.some(p => p.test(q))) return faq.answer
  }
  return null
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

    // BƯỚC 1: Embed câu hỏi thành vector 1536 chiều
    const [queryEmbedding] = await embedTexts([question], 'RETRIEVAL_QUERY')

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
      // Không có chunk nào gần → chuyển kỹ sư ngay
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
      const messages = buildMessages(SYSTEM_PROMPT, context, question, history, true)
      const response = await invokeLLM(messages)
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
    const messages = buildMessages(SYSTEM_PROMPT, context, question, history, false)
    const response = await invokeLLM(messages)

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
function buildMessages(systemPrompt, context, question, history, lowConf) {
  const messages = [{ role: 'system', content: systemPrompt }]

  // Thêm lịch sử hội thoại (tối đa 5 lượt gần nhất)
  const recentHistory = history.slice(-10) // 5 lượt = 10 messages
  for (const msg of recentHistory) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  // Câu hỏi hiện tại + context
  const confNote = lowConf
    ? '\n\n⚠️ Lưu ý: tài liệu tham khảo không hoàn toàn khớp câu hỏi. Hãy trả lời thận trọng và gợi ý hỏi thêm kỹ sư nếu cần.'
    : ''

  messages.push({
    role: 'user',
    content: `Thông tin tham khảo từ kho tài liệu:\n\n${context}\n\n---\nCâu hỏi của nông dân: ${question}\n\nHãy trả lời dựa vào tài liệu trên.${confNote}`,
  })

  return messages
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

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize:    1000,
    chunkOverlap: 100,
    separators:   ['\n\n', '\n', '。', '.', ' ', ''],
  })
  const chunks = await splitter.splitText(doc.content)
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
