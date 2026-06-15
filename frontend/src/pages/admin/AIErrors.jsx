import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminAPI } from '../../services/api'
import { toast } from '../../stores/toastStore'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { ChevronLeft, AlertTriangle, RotateCcw, HelpCircle, Check, CheckCircle, BookOpen, X } from 'lucide-react'

const ERROR_TYPE = {
  wrong_info:         { label: 'Sai thông tin',   Icon: AlertTriangle, color: '#ef4444', bg: '#fef2f2' },
  irrelevant:         { label: 'Không liên quan', Icon: RotateCcw,     color: '#f59e0b', bg: '#fffbeb' },
  hard_to_understand: { label: 'Khó hiểu',        Icon: HelpCircle,    color: '#3b82f6', bg: '#eff6ff' },
}

function ErrorCard({ item, onReview, onCompose }) {
  const cfg  = ERROR_TYPE[item.error_type] || ERROR_TYPE.wrong_info
  const { Icon } = cfg
  const date = new Date(item.created_at).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={{ ...s.card, borderLeft: `3px solid ${cfg.color}` }}>
      <div style={s.cardHead}>
        <span style={{ ...s.typeBadge, color: cfg.color, background: cfg.bg }}>
          <Icon size={11} strokeWidth={2} />
          {cfg.label}
        </span>
        <span style={s.date}>{date}</span>
        {item.reviewed_by && (
          <span style={s.reviewedBadge}><Check size={10} strokeWidth={3} /> Đã xem</span>
        )}
      </div>

      {item.question && (
        <div style={s.qBox}>
          <p style={s.qLabel}>Câu hỏi của nông dân:</p>
          <p style={s.qText}>{item.question}</p>
        </div>
      )}

      <div style={s.aiAnswer}>
        <p style={s.aiLabel}>Câu trả lời AI:</p>
        <p style={s.aiText}>
          {item.messages?.content?.slice(0, 150)}
          {(item.messages?.content?.length || 0) > 150 ? '...' : ''}
        </p>
        {item.messages?.confidence != null && (
          <span style={s.confTag}>Confidence: {Math.round(item.messages.confidence * 100)}%</span>
        )}
      </div>

      {item.note && (
        <div style={s.noteBox}>
          <p style={s.noteLabel}>Ghi chú từ nông dân:</p>
          <p style={s.noteText}>{item.note}</p>
        </div>
      )}

      <p style={s.farmerInfo}>Từ: {item.users?.name || 'Nông dân'} · {item.users?.phone}</p>

      <div style={s.actions}>
        <button onClick={() => onCompose(item)} style={s.btnKnowledge}>
          <BookOpen size={14} strokeWidth={2} /> Soạn câu trả lời đúng
        </button>
        {!item.reviewed_by && (
          <button onClick={() => onReview(item.id)} style={s.btnReview}>
            <Check size={14} strokeWidth={2} /> Đã xem
          </button>
        )}
      </div>
    </div>
  )
}

// Modal: biên soạn lại câu hỏi/câu trả lời đúng → thêm vào kho tri thức
function ComposeModal({ item, onClose, onSubmit, saving }) {
  const [question, setQuestion] = useState(item.question || '')
  const [answer,   setAnswer]   = useState('')

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHead}>
          <span style={s.modalTitle}>Thêm vào kho tri thức</span>
          <button onClick={onClose} aria-label="Đóng" style={s.modalClose}><X size={20} /></button>
        </div>

        <div style={s.modalBody}>
          <p style={s.modalHint}>
            Câu hỏi + câu trả lời đúng sẽ được lưu thành QA biên soạn và embed vào kho tri thức để AI trả lời tốt hơn lần sau.
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

export default function AIErrors() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const isDesktop   = useIsDesktop()
  const [filter, setFilter] = useState('unreviewed')
  const [composing, setComposing] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['ai-errors', filter],
    queryFn:  () => adminAPI.getAIErrors(
      filter === 'all' ? undefined : filter === 'unreviewed' ? false : true
    ).then(r => r.data.errors),
    staleTime: 30_000,
  })

  const review = useMutation({
    mutationFn: (id) => adminAPI.reviewError(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['ai-errors'] }),
  })

  const toKnowledge = useMutation({
    mutationFn: ({ id, body }) => adminAPI.errorToKnowledge(id, body),
    onSuccess:  () => {
      toast.success('Đã thêm vào kho tri thức, đang embed.')
      queryClient.invalidateQueries({ queryKey: ['ai-errors'] })
      setComposing(null)
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Không thêm được. Thử lại nhé.'),
  })

  const errors = data || []

  const byType = errors.reduce((acc, e) => {
    acc[e.error_type] = (acc[e.error_type] || 0) + 1
    return acc
  }, {})

  const FILTERS = [
    { key: 'unreviewed', label: 'Chưa xem' },
    { key: 'reviewed',   label: 'Đã xem' },
    { key: 'all',        label: 'Tất cả' },
  ]

  return (
    <div style={s.page}>
      <header style={s.header}>
        {!isDesktop && (
          <button onClick={() => navigate('/admin')} style={s.iconBtn} aria-label="Quay lại">
            <ChevronLeft size={22} />
          </button>
        )}
        <h1 style={s.title}>Báo lỗi AI</h1>
      </header>

      {errors.length > 0 && (
        <div style={s.statsRow}>
          {Object.entries(ERROR_TYPE).map(([type, cfg]) => {
            const { Icon } = cfg
            return (
              <div key={type} style={s.statItem}>
                <Icon size={16} color={cfg.color} strokeWidth={2} />
                <span style={{ fontSize: 14, color: '#0f172a', fontWeight: 600 }}>{byType[type] || 0}</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>{cfg.label}</span>
              </div>
            )
          })}
        </div>
      )}

      <div style={s.tabs} role="tablist">
        {FILTERS.map(f => (
          <button key={f.key} role="tab" aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            style={{ ...s.tab, background: filter === f.key ? '#4B230A' : 'transparent', color: filter === f.key ? '#fff' : '#64748b', fontWeight: filter === f.key ? 700 : 400 }}>
            {f.label}
          </button>
        ))}
      </div>

      <main style={s.main} aria-live="polite" aria-busy={isLoading}>
        {isLoading ? (
          <p style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>Đang tải...</p>
        ) : errors.length === 0 ? (
          <div style={s.empty}>
            <CheckCircle size={48} color="#f5d5b0" strokeWidth={1} />
            <p style={{ color: '#64748b', textAlign: 'center' }}>
              {filter === 'unreviewed' ? 'Không có báo lỗi nào chưa xem.' : 'Chưa có báo lỗi nào.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10, alignItems: 'start' }}>
            {errors.map(item => (
              <ErrorCard key={item.id} item={item}
                onReview={(id) => review.mutate(id)}
                onCompose={setComposing} />
            ))}
          </div>
        )}
      </main>

      {composing && (
        <ComposeModal
          item={composing}
          saving={toKnowledge.isPending}
          onClose={() => setComposing(null)}
          onSubmit={(body) => toKnowledge.mutate({ id: composing.id, body })}
        />
      )}
    </div>
  )
}

const s = {
  page:          { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fdf8f5', fontFamily: "'Noto Sans', sans-serif", maxWidth: 1080, margin: '0 auto', width: '100%' },
  header:        { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' },
  iconBtn:       { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title:         { fontSize: 18, fontWeight: 800, color: '#0b1c30', margin: 0 },
  statsRow:      { display: 'flex', padding: '10px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0' },
  statItem:      { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 0' },
  tabs:          { display: 'flex', padding: '8px 12px', gap: 6, background: '#fff', borderBottom: '1px solid #e2e8f0' },
  tab:           { padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13 },
  main:          { flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 },
  empty:         { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 40 },
  card:          { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  cardHead:      { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  typeBadge:     { fontSize: 12, padding: '3px 10px', borderRadius: 99, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 },
  date:          { fontSize: 12, color: '#64748b', marginLeft: 'auto' },
  reviewedBadge: { fontSize: 11, background: '#fdf6f0', color: '#4B230A', padding: '2px 8px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 3 },
  aiAnswer:      { background: '#fdf8f5', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 },
  aiLabel:       { fontSize: 12, color: '#64748b', margin: 0, fontWeight: 600 },
  aiText:        { fontSize: 14, color: '#0f172a', margin: 0, lineHeight: 1.6 },
  confTag:       { fontSize: 11, background: '#fffbeb', color: '#f59e0b', padding: '2px 8px', borderRadius: 99, alignSelf: 'flex-start' },
  noteBox:       { background: '#fffbeb', borderRadius: 10, padding: '8px 12px' },
  noteLabel:     { fontSize: 12, color: '#f59e0b', margin: '0 0 4px', fontWeight: 600 },
  noteText:      { fontSize: 14, color: '#78350f', margin: 0, lineHeight: 1.5 },
  qBox:          { background: '#fdf6f0', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 },
  qLabel:        { fontSize: 12, color: '#4B230A', margin: 0, fontWeight: 600 },
  qText:         { fontSize: 14, color: '#2e1505', margin: 0, lineHeight: 1.55 },
  farmerInfo:    { fontSize: 12, color: '#64748b', margin: 0 },
  actions:       { display: 'flex', gap: 8, flexWrap: 'wrap' },
  btnReview:     { padding: '9px 12px', fontSize: 13, fontWeight: 600, background: '#fdf6f0', color: '#4B230A', border: '1px solid #f5d5b0', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  btnKnowledge:  { flex: 1, justifyContent: 'center', padding: '9px 12px', fontSize: 13, fontWeight: 700, background: '#4B230A', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  overlay:       { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 },
  modal:         { background: '#fff', width: '100%', maxWidth: 520, maxHeight: '92dvh', borderRadius: '18px 18px 0 0', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 24px rgba(0,0,0,0.18)' },
  modalHead:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f1f5f9' },
  modalTitle:    { fontSize: 16, fontWeight: 700, color: '#0f172a' },
  modalClose:    { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex' },
  modalBody:     { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' },
  modalHint:     { fontSize: 13, color: '#64748b', margin: '0 0 4px', lineHeight: 1.5 },
  fieldLabel:    { fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 4 },
  textarea:      { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: "'Noto Sans', sans-serif", color: '#0f172a', resize: 'vertical', outline: 'none', lineHeight: 1.5 },
  modalFoot:     { display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid #f1f5f9' },
  btnCancel:     { flex: 1, padding: '11px', fontSize: 14, fontWeight: 600, background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 12, cursor: 'pointer' },
  btnSave:       { flex: 2, padding: '11px', fontSize: 14, fontWeight: 700, background: '#4B230A', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' },
}
