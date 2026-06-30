// backend/scripts/eval_rag.js
// ─── Khung đo chất lượng trả lời RAG ────────────────────────────────────────────
// Chạy bộ câu hỏi "golden" (eval/dataset.json) qua chính pipeline askRAG() rồi chấm:
//   1. HÀNH VI  — đúng tầng chưa? (faq / chuyển kỹ sư / AI tự trả)
//   2. TỪ KHOÁ  — câu trả lời có chứa các cụm bắt buộc không (và tránh cụm cấm)
//   3. LLM-JUDGE — Gemini chấm độ đúng so với câu tham chiếu của kỹ sư (cờ --judge)
//
// Mục đích: mỗi khi đổi SYSTEM_PROMPT / model / threshold, chạy lại để biết NGAY
// có làm tệ đi câu nào không — thay vì "thử vài câu bằng tay".
//
// Dùng:
//   cd backend
//   node scripts/eval_rag.js                 # chấm hành vi + từ khoá (rẻ, ít quota)
//   node scripts/eval_rag.js --judge         # thêm LLM-judge (tốn quota Gemini)
//   node scripts/eval_rag.js --case rice-brown-planthopper
//   node scripts/eval_rag.js --threshold 0.9 # exit≠0 nếu tỉ lệ đậu < 0.9 (cổng CI)
//   node scripts/eval_rag.js --json > eval-result.json
//
// ⚠️ Cần backend/.env (SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_API_KEY) như khi chạy app.
// ⚠️ Mỗi case gọi embed + có thể gọi LLM → tốn quota; có --delay giữa các case (mặc định 800ms).

import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { askRAG } from '../src/services/rag.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Tham số dòng lệnh ──────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const hasFlag = (f) => argv.includes(f)
const getOpt  = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }

const USE_JUDGE  = hasFlag('--judge')
const AS_JSON    = hasFlag('--json')
const ONLY_CASE  = getOpt('--case', null)
const LIMIT      = Number(getOpt('--limit', 0))      // 0 = tất cả
const THRESHOLD  = Number(getOpt('--threshold', 0.8))
const DELAY_MS   = Number(getOpt('--delay', 800))
const JUDGE_PASS = 3                                  // điểm judge ≥3/5 coi là đạt

const log = (...a) => { if (!AS_JSON) console.log(...a) }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Bỏ dấu tiếng Việt + hạ thường để so khớp từ khoá khoan dung.
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// ─── LLM-judge: chấm câu trả lời so với tham chiếu, trả {score 0..5, reason} ─────
async function judge(question, reference, answer) {
  try {
    const { GoogleGenAI } = await import('@google/genai')
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })
    const prompt = `Bạn là kỹ sư nông nghiệp chấm điểm câu trả lời của một trợ lý AI cho nông dân.
CÂU HỎI: ${question}
ĐÁP ÁN THAM CHIẾU (đúng): ${reference}
CÂU TRẢ LỜI CỦA AI: ${answer}

Chấm độ ĐÚNG & AN TOÀN của câu trả lời AI so với tham chiếu trên thang 0-5:
5 = đúng trọng tâm, an toàn, không bịa; 3 = tạm được nhưng thiếu/mơ hồ; 0 = sai hoặc nguy hiểm (vd sai thuốc/sai liều).
CHỈ trả về JSON: {"score": <0-5>, "reason": "<ngắn gọn tiếng Việt>"}`
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0, maxOutputTokens: 256, thinkingConfig: { thinkingBudget: 0 } },
    })
    const raw = (result.text || '').trim().replace(/^```json?/i, '').replace(/```$/, '')
    const parsed = JSON.parse(raw)
    return { score: Math.max(0, Math.min(5, Number(parsed.score))), reason: parsed.reason || '' }
  } catch (err) {
    return { score: null, reason: 'judge lỗi: ' + err.message }
  }
}

// Xác định hành vi thực tế của pipeline từ kết quả askRAG.
function actualBehavior(r) {
  if (r.source === 'faq') return 'faq'
  if (r.needEngineer)     return 'engineer'
  return 'answer'
}

async function run() {
  const ds = JSON.parse(readFileSync(join(__dirname, '../eval/dataset.json'), 'utf8'))
  let cases = ds.cases || []
  if (ONLY_CASE) cases = cases.filter(c => c.id === ONLY_CASE)
  if (LIMIT > 0) cases = cases.slice(0, LIMIT)

  if (!cases.length) { console.error('Không có case nào khớp.'); process.exit(2) }

  log(`\n🧪 Eval RAG — ${cases.length} câu | judge=${USE_JUDGE ? 'BẬT' : 'tắt'} | ngưỡng đậu=${THRESHOLD}\n`)

  const rows = []
  for (const c of cases) {
    let result, err = null
    try {
      result = await askRAG(c.question, c.cropType || null, [])
    } catch (e) {
      err = e.message
      result = { answer: null, needEngineer: false, source: 'ERROR', confidence: 0 }
    }

    const behavior   = actualBehavior(result)
    const behaviorOK = !c.expectBehavior || c.expectBehavior === 'any' || c.expectBehavior === behavior
    const answerText = result.answer || ''

    const kwExpected = c.expectKeywords || []
    const kwHit      = kwExpected.filter(k => norm(answerText).includes(norm(k)))
    const kwOK       = kwExpected.length === 0 || kwHit.length === kwExpected.length

    const forbid     = c.forbidKeywords || []
    const forbidHit  = forbid.filter(k => norm(answerText).includes(norm(k)))
    const forbidOK   = forbidHit.length === 0

    let judgeScore = null, judgeReason = ''
    if (USE_JUDGE && c.reference && answerText && behavior === 'answer') {
      const j = await judge(c.question, c.reference, answerText)
      judgeScore = j.score; judgeReason = j.reason
    }
    const judgeOK = judgeScore == null || judgeScore >= JUDGE_PASS

    const pass = !err && behaviorOK && kwOK && forbidOK && judgeOK

    rows.push({
      id: c.id, pass, error: err,
      expectBehavior: c.expectBehavior, behavior, behaviorOK,
      confidence: result.confidence, source: result.source,
      keywords: `${kwHit.length}/${kwExpected.length}`, kwOK,
      forbidHit, forbidOK,
      judgeScore, judgeReason,
      question: c.question,
      answerPreview: answerText.slice(0, 120),
    })

    log(
      `${pass ? '✅' : '❌'} ${c.id.padEnd(28)} ` +
      `behav=${behavior}${behaviorOK ? '' : `(≠${c.expectBehavior})`} ` +
      `conf=${(result.confidence ?? 0).toFixed(2)} src=${result.source} ` +
      `kw=${kwHit.length}/${kwExpected.length}` +
      (forbidHit.length ? ` ⚠cấm:[${forbidHit}]` : '') +
      (judgeScore != null ? ` judge=${judgeScore}/5` : '') +
      (err ? `  ERROR:${err}` : '')
    )
    if (judgeReason && !AS_JSON) log(`     ↳ judge: ${judgeReason}`)

    await sleep(DELAY_MS)
  }

  const passed  = rows.filter(r => r.pass).length
  const passRate = rows.length ? passed / rows.length : 0
  const judged   = rows.filter(r => r.judgeScore != null)
  const avgJudge = judged.length ? (judged.reduce((s, r) => s + r.judgeScore, 0) / judged.length) : null

  if (AS_JSON) {
    console.log(JSON.stringify({ passRate, passed, total: rows.length, avgJudge, threshold: THRESHOLD, rows }, null, 2))
  } else {
    log(`\n── Tổng kết ──────────────────────────────`)
    log(`Đậu: ${passed}/${rows.length}  (${(passRate * 100).toFixed(0)}%)`)
    if (avgJudge != null) log(`Điểm judge trung bình: ${avgJudge.toFixed(2)}/5`)
    log(`Ngưỡng yêu cầu: ${(THRESHOLD * 100).toFixed(0)}%  →  ${passRate >= THRESHOLD ? 'ĐẠT ✅' : 'KHÔNG ĐẠT ❌'}\n`)
  }

  process.exit(passRate >= THRESHOLD ? 0 : 1)
}

run().catch(e => { console.error('Eval lỗi:', e); process.exit(2) })
