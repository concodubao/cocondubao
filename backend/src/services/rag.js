import { ChatGoogleGenerativeAI }         from '@langchain/google-genai'
import { GoogleGenerativeAI }             from '@google/generative-ai'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// gemini-embedding-exp-03-07: 1500 RPD free — gửi tuần tự 1 request mỗi 700ms
const EMBED_MODEL  = 'gemini-embedding-exp-03-07'
const EMBED_DIMS   = 1536
const REQ_DELAY    = 700  // ms giữa mỗi request

async function embedTexts(texts, taskType = 'RETRIEVAL_DOCUMENT') {
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

// ─── LLM: gemini-2.0-flash ────────────────────────────────────────────────────
const llm = new ChatGoogleGenerativeAI({
  model:           'gemini-2.0-flash',
  temperature:     0.2,
  maxOutputTokens: 500,
  apiKey:          process.env.GOOGLE_API_KEY,
})

const SYSTEM_PROMPT = `Bạn là Cò Con, trợ lý nông nghiệp của nông dân xã Trường Khánh, Sóc Trăng.

Nguyên tắc trả lời:
- Dùng tiếng Việt miền Nam, gần gũi như người thân nói chuyện
- TUYỆT ĐỐI không dùng từ kỹ thuật khó hiểu
- Câu trả lời ngắn gọn, tối đa 200 từ
- Bắt đầu bằng câu trả lời thẳng vào vấn đề
- Nếu có cách phòng trị cụ thể: nêu từng bước rõ ràng (1, 2, 3...)
- Nếu không chắc chắn, nói thật: "Cò Con không chắc lắm, nên hỏi thêm kỹ sư cho chắc"
- Không bịa thông tin khi không có trong tài liệu tham khảo`

// ─── askRAG: hàm chính được gọi từ chat route ─────────────────────────────────
// history: mảng { role: 'user'|'assistant', content: string } — 3-5 tin gần nhất
export async function askRAG(question, cropType = null, history = []) {
  const startTime = Date.now()

  try {
    // BƯỚC 1: Embed câu hỏi thành vector 1536 chiều
    const [queryEmbedding] = await embedTexts([question], 'RETRIEVAL_QUERY')

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

    if (confidence < 0.7) {
      // Có chunk nhưng không đủ tin → thử LLM với context hạn chế, kèm cảnh báo
      const context = chunks.slice(0, 2).map((c, i) => `[Tài liệu ${i+1}]\n${c.chunk_text}`).join('\n\n')
      const messages = buildMessages(SYSTEM_PROMPT, context, question, history, true)
      const response = await llm.invoke(messages)
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

    // BƯỚC 5: Gọi Gemini sinh câu trả lời (kèm lịch sử hội thoại)
    const messages = buildMessages(SYSTEM_PROMPT, context, question, history, false)
    const response = await llm.invoke(messages)

    return {
      answer:       response.content,
      confidence,
      needEngineer: false,
      source:       'rag',
      chunksFound:  chunks.length,
    }

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

  await supabase.from('knowledge_chunks').delete().eq('doc_id', docId)

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

  const { error: insertError } = await supabase
    .from('knowledge_chunks')
    .insert(rows)

  if (insertError) throw insertError

  await supabase
    .from('knowledge_docs')
    .update({
      status:        'approved',
      error_message: null,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', docId)

  console.log(`[RAG] Embedded doc "${doc.title}" → ${chunks.length} chunks`)
  return { chunksCreated: chunks.length }
}
