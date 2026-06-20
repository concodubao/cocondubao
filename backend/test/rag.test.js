import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Mock các phụ thuộc mạng trước khi import rag.js ─────────────────────────
// vi.hoisted để các mock fn dùng chung được khởi tạo trước vi.mock (vốn bị hoist lên đầu)
const mocks = vi.hoisted(() => ({
  rpc:          vi.fn(),
  invoke:       vi.fn(),
  embedContent: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ rpc: mocks.rpc, from: vi.fn() })),
}))

// ChatGoogleGenerativeAI & GoogleGenerativeAI được gọi bằng `new` → mock phải là
// function (arrow function không dùng được làm constructor).
vi.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: vi.fn(function () {
    return { invoke: mocks.invoke }
  }),
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(function () {
    return { getGenerativeModel: () => ({ embedContent: mocks.embedContent }) }
  }),
}))

const { askRAG, checkFAQ, getAnswerCache, setAnswerCache, getSemanticCache, _clearAnswerCache } =
  await import('../src/services/rag.js')

const fakeVector = () => ({ embedding: { values: new Array(1536).fill(0.01) } })

beforeEach(() => {
  process.env.GOOGLE_API_KEY = 'test-key'
  mocks.rpc.mockReset()
  mocks.embedContent.mockReset().mockResolvedValue(fakeVector())
  mocks.invoke.mockReset().mockResolvedValue({ content: 'Trả lời mẫu từ Cò Con' })
  _clearAnswerCache()
})

// ══════════════════════════════════════════════════════════════════════════════
describe('checkFAQ', () => {
  it('khớp câu hỏi "bạn là ai" → trả lời giới thiệu', () => {
    const ans = checkFAQ('bạn là ai vậy?')
    expect(ans).toBeTypeOf('string')
    expect(ans).toContain('Cò Con')
  })

  it('khớp lời chào', () => {
    expect(checkFAQ('chào cò con')).toBeTypeOf('string')
  })

  it('câu hỏi kỹ thuật KHÔNG khớp FAQ → null', () => {
    expect(checkFAQ('lúa bị vàng lá là bệnh gì?')).toBeNull()
  })

  it('khớp lời tạm biệt', () => {
    expect(checkFAQ('tạm biệt')).toBeTypeOf('string')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('answer cache', () => {
  it('set rồi get trả về đúng kết quả', () => {
    const result = { answer: 'abc', confidence: 0.9, source: 'rag' }
    setAnswerCache('câu hỏi A', 'rice', result)
    expect(getAnswerCache('câu hỏi A', 'rice')).toEqual(result)
  })

  it('chuẩn hoá khoảng trắng + hoa thường khi tạo key', () => {
    setAnswerCache('Câu   Hỏi  B', 'rice', { answer: 'x' })
    expect(getAnswerCache('câu hỏi b', 'rice')).toEqual({ answer: 'x' })
  })

  it('cropType khác nhau → cache tách biệt', () => {
    setAnswerCache('cùng câu', 'rice', { answer: 'lúa' })
    expect(getAnswerCache('cùng câu', 'fruit')).toBeNull()
  })

  it('miss → null', () => {
    expect(getAnswerCache('chưa từng hỏi', null)).toBeNull()
  })
})

describe('semantic cache', () => {
  it('embedding rất sát (≥0.95) → trả lại kết quả đã cache', () => {
    const result = { answer: 'bón đạm', confidence: 0.9, source: 'rag' }
    const emb = [1, 0, 0, 0]
    setAnswerCache('bón phân lúa sao', 'rice', result, emb)
    const near = [0.99, 0.02, 0, 0] // gần như cùng hướng
    const hit = getSemanticCache(near, 'rice')
    expect(hit?.result).toEqual(result)
    expect(hit.similarity).toBeGreaterThanOrEqual(0.95)
  })

  it('embedding khác hướng → không khớp', () => {
    setAnswerCache('bón phân lúa sao', 'rice', { answer: 'x' }, [1, 0, 0, 0])
    expect(getSemanticCache([0, 1, 0, 0], 'rice')).toBeNull()
  })

  it('cropType khác → không khớp dù embedding sát', () => {
    setAnswerCache('câu', 'rice', { answer: 'lúa' }, [1, 0, 0, 0])
    expect(getSemanticCache([1, 0, 0, 0], 'fruit')).toBeNull()
  })

  it('entry không có embedding (cache cũ) → bỏ qua, không lỗi', () => {
    setAnswerCache('câu cũ', 'rice', { answer: 'x' }) // không truyền embedding
    expect(getSemanticCache([1, 0, 0, 0], 'rice')).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('askRAG — phân tầng theo confidence', () => {
  it('FAQ short-circuit: không gọi embed/pgvector', async () => {
    const res = await askRAG('bạn là ai?')

    expect(res.source).toBe('faq')
    expect(res.needEngineer).toBe(false)
    expect(res.confidence).toBe(1.0)
    expect(mocks.embedContent).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('không có chunk nào → chuyển kỹ sư', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })

    const res = await askRAG('câu hỏi rất lạ về abc xyz')

    expect(res.needEngineer).toBe(true)
    expect(res.answer).toBeNull()
    expect(res.chunksFound).toBe(0)
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('confidence < 0.5 → chuyển kỹ sư, không gọi LLM', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ id: '1', doc_id: 'd1', chunk_text: 'nội dung', similarity: 0.3 }],
      error: null,
    })

    const res = await askRAG('câu hỏi mơ hồ')

    expect(res.needEngineer).toBe(true)
    expect(res.answer).toBeNull()
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('0.5 ≤ confidence < 0.7 → trả lời thận trọng (rag_low_conf), không cache', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ id: '1', doc_id: 'd1', chunk_text: 'Phun thuốc Beam 75WP', similarity: 0.6 }],
      error: null,
    })

    const res = await askRAG('đạo ôn lá trị sao')

    expect(res.source).toBe('rag_low_conf')
    expect(res.needEngineer).toBe(false)
    expect(res.answer).toBe('Trả lời mẫu từ Cò Con')
    expect(mocks.invoke).toHaveBeenCalledOnce()
    // low-conf không được cache
    expect(getAnswerCache('đạo ôn lá trị sao', null)).toBeNull()
  })

  it('chunk QA biên soạn khớp cao → trả thẳng câu trả lời, KHÔNG gọi LLM', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        id: '1', doc_id: 'd1',
        chunk_text: 'Câu hỏi: Lúa bị vàng lá là bệnh gì?\n\nCâu trả lời: Vàng lá thường do thiếu đạm, bón thêm urê 5-7kg/công.',
        similarity: 0.85,
      }],
      error: null,
    })

    const res = await askRAG('lúa bị vàng lá là bệnh gì')

    expect(res.source).toBe('qa_direct')
    expect(res.answer).toBe('Vàng lá thường do thiếu đạm, bón thêm urê 5-7kg/công.')
    expect(res.needEngineer).toBe(false)
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('confidence ≥ 0.7 → trả lời tin cậy (rag) và được cache', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ id: '1', doc_id: 'd1', chunk_text: 'Rầy nâu: phun Actara', similarity: 0.85 }],
      error: null,
    })

    const q = 'cách trị rầy nâu trên lúa'
    const res = await askRAG(q)

    expect(res.source).toBe('rag')
    expect(res.needEngineer).toBe(false)
    expect(res.answer).toBe('Trả lời mẫu từ Cò Con')
    expect(getAnswerCache(q, null)).toBeTruthy()
  })

  it('câu hỏi lặp lại → trả từ cache, không gọi lại pgvector/LLM', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ id: '1', doc_id: 'd1', chunk_text: 'Rầy nâu: phun Actara', similarity: 0.85 }],
      error: null,
    })

    const q = 'cách phòng rầy nâu hiệu quả'
    await askRAG(q)
    const second = await askRAG(q)

    expect(second.source).toBe('rag_cached')
    // pgvector + LLM chỉ được gọi đúng 1 lần cho cả 2 request
    expect(mocks.rpc).toHaveBeenCalledOnce()
    expect(mocks.invoke).toHaveBeenCalledOnce()
  })

  it('lỗi pgvector → ném lỗi ra ngoài', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'pgvector boom' } })

    await expect(askRAG('câu hỏi gây lỗi db')).rejects.toBeDefined()
  })
})
