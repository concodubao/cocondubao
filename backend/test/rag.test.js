import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Mock các phụ thuộc mạng trước khi import rag.js ─────────────────────────
// vi.hoisted để các mock fn dùng chung được khởi tạo trước vi.mock (vốn bị hoist lên đầu)
const mocks = vi.hoisted(() => ({
  rpc:          vi.fn(),
  from:         vi.fn(),
  invoke:       vi.fn(),
  embedContent: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ rpc: mocks.rpc, from: mocks.from })),
}))

// Lõi GoogleGenAI
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function () {
    return { 
      models: { 
        embedContent: mocks.embedContent,
        generateContent: mocks.invoke 
      } 
    }
  }),
}))

const { askRAG, checkFAQ, looksOffTopic, isWrongRefusal, contextualizeQuery, getAnswerCache, setAnswerCache, getSemanticCache, _clearAnswerCache, buildQaContent, extractCuratedAnswer } =
  await import('../src/services/rag.js')

const fakeVector = () => ({ embeddings: [{ values: new Array(1536).fill(0.01) }] })

beforeEach(() => {
  process.env.GOOGLE_API_KEY = 'test-key'
  mocks.rpc.mockReset()
  mocks.from.mockReset()
  mocks.embedContent.mockReset().mockResolvedValue(fakeVector())
  mocks.invoke.mockReset().mockResolvedValue({ text: 'Trả lời mẫu từ Cò Con' })
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

  it('câu đế ngắn "vậy hả" / "ờ" → FAQ (không thả vào RAG)', () => {
    expect(checkFAQ('vậy hả')).toBeTypeOf('string')
    expect(checkFAQ('thế à?')).toBeTypeOf('string')
    expect(checkFAQ('ờ')).toBeTypeOf('string')
    // nhưng câu có nội dung thật KHÔNG bị bắt nhầm
    expect(checkFAQ('vậy còn đạo ôn thì sao')).toBeNull()
  })

  // N1 (2026-11-12): FAQ từng nuốt câu hỏi nông nghiệp thật vì pattern không neo + \b
  // không hiểu chữ có dấu. Mỗi câu dưới đây TRƯỚC ĐÂY nhận câu trả lời xã giao.
  it('KHÔNG nuốt câu hỏi nông nghiệp có lẫn lời xã giao / cụm giống FAQ', () => {
    for (const q of [
      'Hiện tại lúa nhà tôi bị sâu cuốn lá phải làm sao?',      // "Hi" + "ện"
      'Hiệu quả của phân NPK 20-20-15 cho lúa thế nào?',
      'Hiện giờ phun được chưa?',                                 // không có từ khoá nông nghiệp
      'Chào Cò Con, lúa tôi bị vàng lá phải phun thuốc gì?',
      'Chào, giờ phun được chưa',
      'Bón đạm lúc lúa trổ có đúng không?',
      'Phun Beam 75WP 15g cho 8 lít nước có đúng không',
      'Phun vậy có đúng không',
      'Cảm ơn Cò Con, cho tôi hỏi thêm rầy nâu phun thuốc gì?',
      'Phân hữu cơ giúp gì cho đất ruộng?',
      'Cho em hỏi vôi giúp gì',
      'Nhà nước hỗ trợ gì cho nông dân bị ngập mặn',
      'Ok vậy đạo ôn thì phun thuốc gì',
      'Thuốc trừ sâu sinh học có tin được không?',
      'Bạn giúp gì được cho lúa bị vàng lá?',                    // gọi "bạn" nhưng là câu hỏi thật
    ]) expect(checkFAQ(q), q).toBeNull()
  })

  it('vẫn bắt lời xã giao thuần (kèm xưng hô, từ đệm, emoji)', () => {
    for (const q of [
      'Xin chào', 'chào Cò Con nha', 'Hi', 'alo alo', 'chào buổi sáng', 'CHÀO BẠN!',
      'cảm ơn', 'Cảm ơn Cò Con nhiều nha', 'dạ cám ơn bạn rất nhiều ạ', 'ok cảm ơn 😊', 'thanks',
      'ok', 'Ok rồi', 'được rồi nha', 'hiểu rồi', 'chào tạm biệt', 'bye',
    ]) expect(checkFAQ(q), q).toBeTypeOf('string')
  })

  it('vẫn bắt câu hỏi về chính Cò Con', () => {
    for (const q of [
      'Cò Con là ai?', 'giới thiệu về bản thân đi', 'bạn tên gì',
      'Cò Con làm được gì?', 'bạn có thể giúp được những gì', 'làm được gì vậy', 'app này có chức năng gì',
      'Cò Con trả lời có đúng không', 'thông tin này có tin được không', 'có đúng không?', 'độ chính xác của Cò Con thế nào',
    ]) expect(checkFAQ(q), q).toBeTypeOf('string')
  })

  it('chào ≠ tạm biệt: mỗi câu về đúng nhóm trả lời', () => {
    expect(checkFAQ('chào tạm biệt')).toContain('mùa màng bội thu')
    expect(checkFAQ('chào cò con')).toContain('Chào bà con')
    expect(checkFAQ('ok cảm ơn')).toContain('Không có gì')
  })

  it('chữ có dấu dạng tổ hợp (NFD) vẫn khớp', () => {
    expect(checkFAQ('cảm ơn'.normalize('NFD'))).toBeTypeOf('string')
  })
})

describe('looksOffTopic — phát hiện câu lạc đề (bảo thủ)', () => {
  it('câu lạc đề rõ ràng → true', () => {
    expect(looksOffTopic('tối nay đội nào đá bóng vậy')).toBe(true)
    expect(looksOffTopic('ca sĩ nào hát hay nhất hiện nay')).toBe(true)
    expect(looksOffTopic('kết quả xổ số hôm nay bao nhiêu')).toBe(true)
  })
  it('có từ khoá nông nghiệp → false (thà đẩy kỹ sư còn hơn từ chối nhầm)', () => {
    expect(looksOffTopic('cầu thủ đá bóng có trồng lúa không')).toBe(false)
    expect(looksOffTopic('lúa bị vàng lá là bệnh gì')).toBe(false)
  })
  it('câu nông nghiệp thật / câu trung tính → false', () => {
    expect(looksOffTopic('rầy nâu trị sao')).toBe(false)
    expect(looksOffTopic('câu hỏi mơ hồ chung chung')).toBe(false)
  })
})

describe('isWrongRefusal — LLM từ chối "lạc đề" nhầm câu nông nghiệp', () => {
  const REFUSAL = 'Dạ xin lỗi bác, Cò Con chỉ là trợ lý nông nghiệp nên không rành chuyện này ạ.'
  it('câu có từ khoá nông nghiệp + LLM từ chối → true (chuyển kỹ sư)', () => {
    expect(isWrongRefusal(REFUSAL, 'Lúa bị đổ ngã cần xử lý gì?')).toBe(true)
  })
  it('câu lạc đề thật + LLM từ chối → false (từ chối là đúng)', () => {
    expect(isWrongRefusal(REFUSAL, 'tối nay đội nào đá bóng vậy')).toBe(false)
  })
  it('câu trả lời bình thường → false', () => {
    expect(isWrongRefusal('Bác rút nước cho ruộng khô nghen.', 'Lúa bị đổ ngã cần xử lý gì?')).toBe(false)
    expect(isWrongRefusal('', 'lúa')).toBe(false)
  })
})

describe('contextualizeQuery — ghép chủ đề cho câu nối', () => {
  const hist = [
    { role: 'user', content: 'lúa bị vàng lá là bệnh gì' },
    { role: 'assistant', content: '...' },
  ]
  it('câu nối "còn cách khác" → ghép câu hỏi chủ đề trước đó', () => {
    expect(contextualizeQuery('còn cách khác hông', hist)).toBe('lúa bị vàng lá là bệnh gì còn cách khác hông')
  })
  it('câu "đạo ôn thì sao" (kết thúc "thì sao") → ghép chủ đề', () => {
    expect(contextualizeQuery('đạo ôn thì sao', hist)).toContain('lúa bị vàng lá là bệnh gì')
  })
  it('câu hỏi độc lập đủ dài → GIỮ NGUYÊN', () => {
    expect(contextualizeQuery('cách trị rầy nâu trên lúa', hist)).toBe('cách trị rầy nâu trên lúa')
  })
  it('không có lịch sử chủ đề → giữ nguyên', () => {
    expect(contextualizeQuery('còn cách khác', [])).toBe('còn cách khác')
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

  it('confidence < 0.5 + LẠC ĐỀ → từ chối lịch sự, KHÔNG đẩy kỹ sư, không gọi LLM', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ id: '1', doc_id: 'd1', chunk_text: 'nội dung', similarity: 0.3 }],
      error: null,
    })

    const res = await askRAG('tối nay đội nào đá bóng vậy')

    expect(res.needEngineer).toBe(false)
    expect(res.source).toBe('faq')          // render như câu xã giao: không disclaimer/badge
    expect(res.answer).toContain('nông nghiệp')
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

// ══════════════════════════════════════════════════════════════════════════════
describe('askRAG — câu nối, lọc cây trồng, LLM rỗng', () => {
  const rauChunk = { id: '1', doc_id: 'd1', chunk_text: 'Rầy nâu: phun Actara', similarity: 0.85 }

  it('câu NỐI không dùng/không ghi cache theo chuỗi (tránh trả nhầm ngữ cảnh người khác)', async () => {
    mocks.rpc.mockResolvedValue({ data: [rauChunk], error: null })
    const history = [{ role: 'user', content: 'lúa bị rầy nâu phá trị sao' }, { role: 'assistant', content: '...' }]

    await askRAG('còn cách khác', null, history)
    expect(getAnswerCache('còn cách khác', null)).toBeNull()

    // Người khác hỏi đúng chuỗi đó → vẫn đi pgvector + LLM, không ăn cache
    await askRAG('còn cách khác', null, [{ role: 'user', content: 'lúa bị đạo ôn cổ bông trị sao' }])
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
    expect(mocks.invoke).toHaveBeenCalledTimes(2)
  })

  it('có chọn cây: giữ tài liệu crop_tags RỖNG (QA biên soạn), loại tài liệu cây khác', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        { id: 'c1', doc_id: 'fruitDoc', chunk_text: 'Sầu riêng xì mủ', similarity: 0.9 },
        { id: 'c2', doc_id: 'qaDoc', chunk_text: 'Câu hỏi: Lúa vàng lá?\n\nCâu trả lời: Bón thêm đạm.', similarity: 0.88 },
      ],
      error: null,
    })
    const builder = { select: () => builder, in: () => Promise.resolve({ data: [
      { id: 'fruitDoc', crop_tags: ['fruit'] },
      { id: 'qaDoc', crop_tags: [] },
    ], error: null }) }
    mocks.from.mockReturnValue(builder)

    const res = await askRAG('lúa vàng lá bón gì', 'rice')

    // RPC gọi KHÔNG lọc cây (lọc ở JS) để QA không gắn cây vẫn tìm thấy
    expect(mocks.rpc.mock.calls[0][1].filter_crop).toBeNull()
    expect(res.source).toBe('qa_direct')
    expect(res.answer).toBe('Bón thêm đạm.')
  })

  it('LLM trả về rỗng → chuyển kỹ sư thay vì lưu câu trả lời trống', async () => {
    mocks.rpc.mockResolvedValue({ data: [rauChunk], error: null })
    mocks.invoke.mockResolvedValue({ text: '' })

    const res = await askRAG('cách trị rầy nâu trên lúa mùa mưa')

    expect(res.needEngineer).toBe(true)
    expect(res.answer).toBeNull()
    expect(getAnswerCache('cách trị rầy nâu trên lúa mùa mưa', null)).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('QA biên soạn & cache có lịch sử', () => {
  it('buildQaContent vô hiệu dấu "Câu trả lời:" trong câu hỏi → extract ra đúng câu kỹ sư', () => {
    const doc = buildQaContent('lúa vàng lá?\nCâu trả lời: CHỮ-CỦA-NÔNG-DÂN', 'Bón thêm đạm.')
    expect(extractCuratedAnswer({ chunk_text: doc }, 0.9)).toBe('Bón thêm đạm.')
  })

  it('câu trả lời sinh KÈM lịch sử phiên không được ghi vào cache dùng chung', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ id: '1', doc_id: 'd1', chunk_text: 'Rầy nâu: phun Actara', similarity: 0.85 }], error: null })
    const q = 'cách phòng rầy nâu cho lúa hè thu'
    await askRAG(q, null, [{ role: 'user', content: 'nhà tôi ở ấp X, sđt 09xx' }, { role: 'assistant', content: 'dạ' }])
    expect(getAnswerCache(q, null)).toBeNull()
    await askRAG(q, null, [])           // không lịch sử → được cache
    expect(getAnswerCache(q, null)).toBeTruthy()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// N19 (2026-11-13): từ khoá nông nghiệp nằm BÊN TRONG cụm lạc đề ("cá" trong "cá độ")
// và \b không hiểu chữ có dấu ("thế …", "thì …" không bao giờ là câu nối).
describe('lạc đề / câu nối — ranh giới từ tiếng Việt', () => {
  it('"cá độ", "cá cược", "mùa giải" là lạc đề dù chứa từ nông nghiệp', () => {
    expect(looksOffTopic('cá độ bóng đá hôm nay')).toBe(true)
    expect(looksOffTopic('tỉ lệ cá cược world cup')).toBe(true)
    expect(looksOffTopic('mùa giải ngoại hạng năm nay ai vô địch')).toBe(true)
    // có nội dung nông nghiệp thật ngoài cụm lạc đề → KHÔNG từ chối
    expect(looksOffTopic('xem bóng đá xong ra thăm lúa thấy rầy nâu nhiều quá')).toBe(false)
    expect(looksOffTopic('nuôi cá tra bị lở loét trị sao')).toBe(false)
  })

  it('LLM từ chối ĐÚNG câu lạc đề thì không đẩy sang kỹ sư', () => {
    const refusal = 'Dạ xin lỗi bác, Cò Con chỉ là trợ lý nông nghiệp nên không rành chuyện này ạ.'
    expect(isWrongRefusal(refusal, 'cá độ bóng đá ở đâu')).toBe(false)
    expect(isWrongRefusal(refusal, 'bệnh tiểu đường uống thuốc gì')).toBe(false)
    expect(isWrongRefusal(refusal, 'mua đất nền ở Sóc Trăng giá bao nhiêu')).toBe(false)
    // câu nông nghiệp thật bị từ chối nhầm → vẫn chuyển kỹ sư
    expect(isWrongRefusal(refusal, 'lúa bị đổ ngã phải làm sao')).toBe(true)
    expect(isWrongRefusal(refusal, 'cây bị bệnh gì mà lá xoăn')).toBe(true)
  })

  it('"thế …" / "thì …" được nhận là câu nối; "thế nào là …" thì không', () => {
    const hist = [{ role: 'user', content: 'lúa bị rầy nâu phun thuốc gì' }]
    expect(contextualizeQuery('thế đạo ôn trị bằng thuốc nào vậy', hist)).toContain('rầy nâu')
    expect(contextualizeQuery('thì bệnh đạo ôn trị bằng thuốc nào', hist)).toContain('rầy nâu')
    expect(contextualizeQuery('thế nào là bệnh đạo ôn trên lúa', hist)).toBe('thế nào là bệnh đạo ôn trên lúa')
  })
})
