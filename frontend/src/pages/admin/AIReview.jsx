import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { adminAPI } from '../../services/api'
import { toast } from '../../stores/toastStore'
import { useAuthStore } from '../../stores/authStore'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { ChevronLeft, BookOpen, X } from 'lucide-react'

const SOURCE_LABEL = {
  qa_direct: 'QA biên soạn',
  rag:       'RAG',
  vision:    'Ảnh',
  faq:       'Xã giao',
}

function confColor(c) {
  const pct = Math.round((c || 0) * 100)
  if (pct >= 70) return { color: '#4B230A', bg: '#fdf6f0' }
  if (pct >= 50) return { color: '#d97706', bg: '#fffbeb' }
  return { color: '#ef4444', bg: '#fef2f2' }
}

function ReviewCard({ item, onCompose }) {
  const c = confColor(item.confidence)
  const date = new Date(item.created_at).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
  return (
    <div style={s.card}>
      <div style={s.cardHead}>
        <span style={{ ...s.confBadge, color: c.color, background: c.bg }}>
          Tin cậy {Math.round((item.confidence || 0) * 100)}%
        </span>
        {item.source && <span style={s.sourceTag}>{SOURCE_LABEL[item.source] || item.source}</span>}
        {item.helpfulCount > 0 && (
          <span style={{ ...s.confBadge, color: '#15803d', background: '#dcfce7' }}>👍 {item.helpfulCount}</span>
        )}
        <span style={s.date}>{date}</span>
      </div>

      {item.question && (
        <div style={s.qBox}>
          <p style={s.qLabel}>Câu hỏi:</p>
          <p style={s.qText}>{item.question}</p>
        </div>
      )}

      <div style={s.aBox}>
        <p style={s.aLabel}>AI trả lời:</p>
        <p style={s.aText}>{item.answer?.slice(0, 280)}{(item.answer?.length || 0) > 280 ? '…' : ''}</p>
      </div>

      <button onClick={() => onCompose(item)} style={item.helpfulCount > 0 ? s.btnCurate : s.btnFix}>
        <BookOpen size={14} strokeWidth={2} />
        {item.helpfulCount > 0 ? ' Duyệt thành QA' : ' Sai? Soạn câu trả lời đúng'}
      </button>
    </div>
  )
}

function ComposeModal({ item, onClose, onSubmit, saving }) {
  // Câu được nông dân khen 👍 → điền sẵn câu trả lời AI để kỹ sư xem/chỉnh rồi duyệt
  // thẳng thành QA (khỏi gõ lại). Câu sai (không 👍) → để trống cho soạn mới.
  const curate = (item.helpfulCount || 0) > 0
  const [question, setQuestion] = useState(item.question || '')
  const [answer,   setAnswer]   = useState(curate ? (item.answer || '') : '')
  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHead}>
          <span style={s.modalTitle}>{curate ? 'Duyệt thành QA chuẩn' : 'Thêm vào kho tri thức'}</span>
          <button onClick={onClose} aria-label="Đóng" style={s.modalClose}><X size={20} /></button>
        </div>
        <div style={s.modalBody}>
          <p style={s.modalHint}>
            {curate
              ? 'Câu này được nông dân bấm 👍. Xem lại / chỉnh cho chuẩn rồi lưu thành QA — AI sẽ trả thẳng câu này khi có người hỏi tương tự (khỏi tốn quota).'
              : 'Câu hỏi + câu trả lời đúng sẽ được lưu thành QA biên soạn và embed để AI trả lời tốt hơn lần sau.'}
          </p>
          <label style={s.fieldLabel}>Câu hỏi chuẩn</label>
          <textarea value={question} onChange={e => setQuestion(e.target.value)}
            rows={2} placeholder="Câu hỏi nông dân thường hỏi..." style={s.textarea} />
          <label style={s.fieldLabel}>Câu trả lời đúng</label>
          <textarea value={answer} onChange={e => setAnswer(e.target.value)}
            rows={5} placeholder="Câu trả lời chính xác do kỹ sư/admin biên soạn..." style={s.textarea} />
        </div>
        <div style={s.modalFoot}>
          <button onClick={onClose} style={s.btnCancel}>Huỷ</button>
          <button
            onClick={() => onSubmit({ question: question.trim(), answer: answer.trim() })}
            disabled={saving || !question.trim() || !answer.trim()}
            style={{ ...s.btnSave, opacity: (saving || !question.trim() || !answer.trim()) ? 0.5 : 1 }}>
            {saving ? 'Đang lưu...' : 'Lưu & embed'}
          </button>
        </div>
      </div>
    </div>
  )
}

const FILTERS = [
  { key: 'all',     label: 'Tất cả' },
  { key: 'helpful', label: '👍 Được khen' },
  { key: 'low',     label: 'Tin cậy thấp (<50%)' },
  { key: 'mid',     label: 'Trung bình (50–70%)' },
]

export default function AIReview() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isDesktop = useIsDesktop()
  const backTo = user?.role === 'admin' ? '/admin' : '/engineer/queue'
  const [filter, setFilter] = useState('all')
  const [composing, setComposing] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['ai-review', filter],
    queryFn:  () => adminAPI.getAIReview(filter === 'all' ? undefined : filter).then(r => r.data.items),
    staleTime: 30_000,
  })

  const addQA = useMutation({
    mutationFn: (body) => adminAPI.addKnowledgeQA(body),
    onSuccess:  () => { toast.success('Đã thêm vào kho tri thức, đang embed.'); setComposing(null) },
    onError:    (e) => toast.error(e.response?.data?.error || 'Không thêm được. Thử lại nhé.'),
  })

  const items = data || []

  return (
    <div style={s.page}>
      <header style={s.header}>
        {!isDesktop && (
          <button onClick={() => navigate(backTo)} style={s.iconBtn} aria-label="Quay lại">
            <ChevronLeft size={22} />
          </button>
        )}
        <h1 style={s.title}>Soát chất lượng AI</h1>
      </header>

      <p style={s.intro}>Xem lại câu trả lời AI gần đây: câu sai → "Soạn câu trả lời đúng" để dạy lại AI; tab <strong>👍 Được khen</strong> → câu nông dân khen, "Duyệt thành QA" để AI trả thẳng lần sau (tiết kiệm quota).</p>

      <div style={s.tabs} role="tablist">
        {FILTERS.map(f => (
          <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
            style={{ ...s.tab, background: filter === f.key ? '#4B230A' : 'transparent', color: filter === f.key ? '#fff' : '#64748b', fontWeight: filter === f.key ? 700 : 400 }}>
            {f.label}
          </button>
        ))}
      </div>

      <main style={s.main} aria-live="polite" aria-busy={isLoading}>
        {isLoading ? (
          <p style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>Đang tải...</p>
        ) : items.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>Chưa có câu trả lời AI nào trong 30 ngày.</p>
        ) : (
          <div style={s.grid}>
            {items.map((item, i) => (
              <ReviewCard key={i} item={item} onCompose={setComposing} />
            ))}
          </div>
        )}
      </main>

      {composing && (
        <ComposeModal
          item={composing}
          saving={addQA.isPending}
          onClose={() => setComposing(null)}
          onSubmit={(body) => addQA.mutate(body)}
        />
      )}
    </div>
  )
}

const s = {
  page:       { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fdf8f5', fontFamily: "'Noto Sans', sans-serif", maxWidth: 1080, margin: '0 auto', width: '100%' },
  header:     { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' },
  iconBtn:    { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title:      { fontSize: 18, fontWeight: 800, color: '#0b1c30', margin: 0 },
  intro:      { fontSize: 13, color: '#64748b', margin: 0, padding: '12px 16px 0', lineHeight: 1.5 },
  tabs:       { display: 'flex', padding: '10px 12px', gap: 6, flexWrap: 'wrap' },
  tab:        { padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13 },
  main:       { flex: 1, padding: '0 14px 16px' },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10, alignItems: 'start' },
  card:       { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  cardHead:   { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  confBadge:  { fontSize: 12, padding: '3px 10px', borderRadius: 99, fontWeight: 700 },
  sourceTag:  { fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 99 },
  date:       { fontSize: 12, color: '#64748b', marginLeft: 'auto' },
  qBox:       { background: '#fdf6f0', borderRadius: 10, padding: '10px 12px' },
  qLabel:     { fontSize: 12, color: '#4B230A', margin: '0 0 4px', fontWeight: 600 },
  qText:      { fontSize: 14, color: '#2e1505', margin: 0, lineHeight: 1.55 },
  aBox:       { background: '#fdf8f5', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' },
  aLabel:     { fontSize: 12, color: '#64748b', margin: '0 0 4px', fontWeight: 600 },
  aText:      { fontSize: 14, color: '#0f172a', margin: 0, lineHeight: 1.6 },
  btnFix:     { alignSelf: 'flex-start', padding: '9px 14px', fontSize: 13, fontWeight: 700, background: '#fdf6f0', color: '#4B230A', border: '1px solid #f5d5b0', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  btnCurate:  { alignSelf: 'flex-start', padding: '9px 14px', fontSize: 13, fontWeight: 700, background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal:      { background: '#fff', width: '100%', maxWidth: 520, maxHeight: '92dvh', borderRadius: '18px 18px 0 0', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 24px rgba(0,0,0,0.18)' },
  modalHead:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f1f5f9' },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#0f172a' },
  modalClose: { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex' },
  modalBody:  { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' },
  modalHint:  { fontSize: 13, color: '#64748b', margin: '0 0 4px', lineHeight: 1.5 },
  fieldLabel: { fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 4 },
  textarea:   { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: "'Noto Sans', sans-serif", color: '#0f172a', resize: 'vertical', outline: 'none', lineHeight: 1.5 },
  modalFoot:  { display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid #f1f5f9' },
  btnCancel:  { flex: 1, padding: '11px', fontSize: 14, fontWeight: 600, background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 12, cursor: 'pointer' },
  btnSave:    { flex: 2, padding: '11px', fontSize: 14, fontWeight: 700, background: '#4B230A', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' },
}
