import { useState } from 'react'
import { useNavigate, useParams, useLocation, Navigate } from 'react-router-dom'
import { engineerAPI } from '../../services/api'
import { ChevronLeft, X, ZoomIn } from 'lucide-react'

// ─── Image Lightbox ───────────────────────────────────────────────────────────
function ImageLightbox({ src, alt, onClose }) {
  return (
    <div
      style={lb.overlay}
      role="dialog" aria-modal="true" aria-label="Phóng to ảnh"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <button onClick={onClose} style={lb.closeBtn} aria-label="Đóng">
        <X size={22} color="#fff" />
      </button>
      <img src={src} alt={alt} style={lb.img} />
    </div>
  )
}

const lb = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  closeBtn:{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  img:     { maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' },
}

// ─── Answer page ──────────────────────────────────────────────────────────────
export default function Answer() {
  const navigate = useNavigate()
  const { id }   = useParams()
  const location = useLocation()
  const item     = location.state?.queueItem

  if (!item) return <Navigate to="/engineer/queue" replace />

  const [answer,         setAnswer]         = useState('')
  const [addToKnowledge, setAddToKnowledge] = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')
  const [lightbox,       setLightbox]       = useState(false)

  const msg  = item?.messages
  const user = msg?.chat_sessions?.users

  const TEMPLATES = [
    { label: 'Sâu bệnh',  text: 'Cây bạn bị [tên bệnh]. Nguyên nhân là [lý do].\n\nCách xử lý:\n1. [Bước 1]\n2. [Bước 2]\n3. [Bước 3]\n\nLưu ý: [lưu ý quan trọng]' },
    { label: 'Bón phân',  text: 'Đối với [loại cây], nên bón phân theo lịch sau:\n- Lần 1 (tuần X): [loại phân, liều lượng]\n- Lần 2 (tuần Y): [loại phân, liều lượng]\n\nLưu ý: Không bón khi [điều kiện].' },
    { label: 'Phòng trị', text: 'Để phòng [tên dịch bệnh], bạn cần:\n1. [Biện pháp phòng]\n2. [Biện pháp phòng]\n\nNếu đã bị: Phun [tên thuốc] liều [X ml/8L nước], phun vào [thời điểm].' },
    { label: 'Thời vụ',   text: 'Vụ [tên vụ] nên xuống giống vào tháng [X].\nThời gian sinh trưởng khoảng [N] ngày.\nThu hoạch khi [dấu hiệu].' },
  ]

  async function handleSubmit() {
    if (!answer.trim()) return setError('Vui lòng nhập câu trả lời.')
    if (answer.trim().length < 20) return setError('Câu trả lời quá ngắn (tối thiểu 20 ký tự).')
    setLoading(true)
    setError('')
    try {
      await engineerAPI.answer(id, { answer: answer.trim(), addToKnowledge })
      navigate('/engineer/queue')
    } catch (err) {
      setError(err.response?.data?.error || 'Không lưu được câu trả lời.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button onClick={() => navigate('/engineer/queue')} style={styles.iconBtn} aria-label="Quay lại">
          <ChevronLeft size={22} />
        </button>
        <h1 style={styles.title}>Soạn câu trả lời</h1>
      </header>

      <main style={styles.main}>
        <section style={styles.section} aria-label="Câu hỏi của nông dân">
          <p style={styles.sLabel}>Câu hỏi từ {user?.name || 'nông dân'}{user?.village ? ` · ${user.village}` : ''}</p>
          <div style={styles.questionBox}>
            <p style={styles.questionText}>{msg?.content}</p>
            {msg?.image_url && (
              <div style={{ position: 'relative', marginTop: 10 }}>
                <img
                  src={msg.image_url} alt="Ảnh sâu bệnh"
                  style={{ ...styles.questionImg, cursor: 'zoom-in' }}
                  onClick={() => setLightbox(true)}
                />
                <button
                  onClick={() => setLightbox(true)}
                  style={styles.zoomBtn}
                  aria-label="Phóng to ảnh"
                >
                  <ZoomIn size={14} color="#fff" />
                </button>
              </div>
            )}
          </div>
        </section>

        <section style={styles.section}>
          <p style={styles.sLabel}>Mẫu trả lời nhanh</p>
          <div style={styles.templateRow}>
            {TEMPLATES.map(t => (
              <button key={t.label} onClick={() => setAnswer(t.text)} style={styles.templateBtn}>{t.label}</button>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <label style={styles.sLabel} htmlFor="answer-textarea">
            Câu trả lời
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}> ({answer.trim().length} ký tự)</span>
          </label>
          <textarea
            id="answer-textarea" value={answer} onChange={e => setAnswer(e.target.value)}
            placeholder="Soạn câu trả lời chi tiết, dễ hiểu cho nông dân..."
            style={styles.textarea} rows={8} aria-required="true"
          />
          {error && <p style={styles.error} role="alert">{error}</p>}
        </section>

        <section style={styles.section}>
          <label style={styles.trustRow} htmlFor="trust-toggle">
            <input id="trust-toggle" type="checkbox" checked={addToKnowledge}
              onChange={e => setAddToKnowledge(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#16a34a' }} />
            <div>
              <span style={styles.trustLabel}>Đánh dấu "Tin cậy" — thêm vào kho tri thức RAG</span>
              <p style={styles.trustDesc}>
                Câu trả lời sẽ được embed vào pgvector để AI dùng lần sau. Chỉ tích khi câu trả lời chính xác và dùng được nhiều lần.
              </p>
            </div>
          </label>
        </section>

        <button onClick={handleSubmit} disabled={loading || !answer.trim()}
          style={{ ...styles.btnSubmit, opacity: (loading || !answer.trim()) ? 0.5 : 1 }} aria-busy={loading}>
          {loading ? 'Đang gửi...' : 'Gửi câu trả lời cho nông dân'}
        </button>
        <p style={styles.hint}>Nông dân sẽ nhận thông báo ngay sau khi bạn gửi.</p>
      </main>

      {/* Image lightbox */}
      {lightbox && msg?.image_url && (
        <ImageLightbox src={msg.image_url} alt="Ảnh sâu bệnh" onClose={() => setLightbox(false)} />
      )}
    </div>
  )
}

const styles = {
  page:         { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: "'Noto Sans', sans-serif", maxWidth: 520, margin: '0 auto' },
  header:       { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 },
  iconBtn:      { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title:        { fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0 },
  main:         { flex: 1, padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 },
  section:      { display: 'flex', flexDirection: 'column', gap: 8 },
  sLabel:       { fontSize: 14, fontWeight: 600, color: '#0f172a', margin: 0 },
  questionBox:  { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px' },
  questionText: { fontSize: 16, color: '#0f172a', margin: 0, lineHeight: 1.7 },
  questionImg:  { width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0', display: 'block' },
  zoomBtn:      { position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  templateRow:  { display: 'flex', gap: 8, flexWrap: 'wrap' },
  templateBtn:  { padding: '6px 12px', fontSize: 13, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 99, cursor: 'pointer', color: '#16a34a', fontWeight: 500 },
  textarea:     { width: '100%', padding: '12px 14px', fontSize: 16, borderRadius: 10, border: '1.5px solid #e2e8f0', resize: 'vertical', outline: 'none', lineHeight: 1.7, color: '#0f172a', background: '#fff', boxSizing: 'border-box', minHeight: 180 },
  error:        { color: '#ef4444', fontSize: 14, background: '#fef2f2', padding: '8px 12px', borderRadius: 8, margin: 0 },
  trustRow:     { display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', cursor: 'pointer' },
  trustLabel:   { fontSize: 15, fontWeight: 600, color: '#0f172a', display: 'block', marginBottom: 4 },
  trustDesc:    { fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.6 },
  btnSubmit:    { padding: '14px', fontSize: 17, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', minHeight: 52 },
  hint:         { fontSize: 13, color: '#94a3b8', textAlign: 'center', margin: 0 },
}
