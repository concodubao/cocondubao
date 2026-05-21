import { ChatGoogleGenerativeAI }         from '@langchain/google-genai'
import { GoogleGenerativeAI }             from '@google/generative-ai'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Google AI Studio đổi tên: text-embedding-004 → gemini-embedding-001
const EMBED_MODELS = ['gemini-embedding-001', 'gemini-embedding-2']

async function embedTexts(texts, taskType = 'RETRIEVAL_DOCUMENT') {
  const key = process.env.GOOGLE_API_KEY
  if (!key) throw new Error('GOOGLE_API_KEY chưa được set')

  const genAI = new GoogleGenerativeAI(key.trim())

  if (!embedTexts._model) {
    for (const name of EMBED_MODELS) {
      try {
        const m      = genAI.getGenerativeModel({ model: name })
        const result = await m.embedContent({ content: { parts: [{ text: 'test' }] }, taskType: 'RETRIEVAL_DOCUMENT' })
        if (result.embedding?.values?.length > 0) {
          embedTexts._model = name
          console.log(`[RAG] Embedding model: ${name} dim=${result.embedding.values.length}`)
          break
        }
      } catch (e) {
        console.warn(`[RAG] ${name} không dùng được: ${e.message}`)
      }
    }
    if (!embedTexts._model) throw new Error('Không có embedding model nào hoạt động. Kiểm tra GOOGLE_API_KEY.')
  }

  const model   = genAI.getGenerativeModel({ model: embedTexts._model })
  const results = await Promise.all(texts.map(async (text) => {
    const result = await model.embedContent({ content: { parts: [{ text }] }, taskType })
    if (!result.embedding?.values?.length) throw new Error('Embedding trả về rỗng')
    return result.embedding.values
  }))

  return results
}

const llm = new ChatGoogleGenerativeAI({
  model:           'gemini-1.5-flash',
  temperature:     0.2,
  maxOutputTokens: 400,
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
export async function askRAG(question, cropType = null) {
  const startTime = Date.now()

  try {
    // BƯỚC 1: Embed câu hỏi thành vector 768 chiều
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

    // BƯỚC 3: Nếu không đủ tin cậy → chuyển kỹ sư
    if (confidence < 0.7 || !chunks?.length) {
      return {
        answer:       null,
        confidence,
        needEngineer: true,
        source:       'rag',
        chunksFound:  chunks?.length ?? 0,
      }
    }

    // BƯỚC 4: Ghép context từ các chunks tìm được
    const context = chunks
      .map((c, i) => `[Tài liệu ${i+1}]\n${c.chunk_text}`)
      .join('\n\n')

    // BƯỚC 5: Gọi Gemini sinh câu trả lời
    const response = await llm.invoke([
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Thông tin tham khảo từ kho tài liệu:\n\n${context}\n\n---\nCâu hỏi của nông dân: ${question}\n\nHãy trả lời dựa vào tài liệu trên.`,
      },
    ])

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
    chunkSize:    500,
    chunkOverlap: 50,
    separators:   ['\n\n', '\n', '。', '.', ' ', ''],
  })
  const chunks = await splitter.splitText(doc.content)
  if (!chunks.length) throw new Error('Không tách được chunks từ nội dung tài liệu.')

  // Embed tất cả chunks
  let vectors
  try {
    vectors = await embedTexts(chunks)
  } catch (embedErr) {
    throw new Error(`Embedding thất bại (kiểm tra GOOGLE_API_KEY trên Railway): ${embedErr.message}`)
  }

  if (!vectors?.length || vectors.length !== chunks.length) {
    throw new Error(`Embedding trả về ${vectors?.length ?? 0} vector cho ${chunks.length} chunks — kiểm tra GOOGLE_API_KEY.`)
  }

  const invalidIdx = vectors.findIndex(v => !Array.isArray(v) || v.length === 0)
  if (invalidIdx !== -1) {
    throw new Error(`Vector tại chunk ${invalidIdx} rỗng — GOOGLE_API_KEY có thể sai hoặc hết quota.`)
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
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', docId)

  console.log(`[RAG] Embedded doc "${doc.title}" → ${chunks.length} chunks`)
  return { chunksCreated: chunks.length }
}
