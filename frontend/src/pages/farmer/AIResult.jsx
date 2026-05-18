import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useTTS } from '../../hooks/useTTS'
import { chatAPI } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import { useState } from 'react'
import { ChevronLeft, Volume2, VolumeX, MessageCircle, Home } from 'lucide-react'

export default function AIResult() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const { speak, stop, isSpeaking, isSupported } = useTTS()

  const { answer, confidence, source, sessionId, messageId, engineerQueued } = location.state || {}

  const [reported,   setReported]   = useState(false)
  const [showReport, setShowReport] = useState(false)

  if (!answer && !engineerQueued) return <Navigate to="/chat" replace />
  if (engineerQueued) return <Navigate to="/chat/waiting" state={{ sessionId, messageId }} replace />

  const confidencePct = Math.round((confidence || 0) * 100)
  const isHighConf    = confidence >= 0.85
  const isMidConf     = confidence >= 0.7 && confidence < 0.85

  async function handleReport(errorType) {
    try {
      await chatAPI.reportError({ messageId, errorType, userId: user?.id })
      setReported(true)
      setShowReport(false)
    } catch {
      alert('Không gửi được báo lỗi. Thử lại nhé.')
    }
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button onClick={() => navigate('/chat', { state: { sessionId } })} style={s.iconBtn} aria-label="Quay lại">
          <ChevronLeft size={22} />
        </button>
        <span style={s.headerTitle}>Câu trả lời</span>
      </header>

      <main style={s.main}>
        <div style={s.sourceRow}>
          {source === 'engineer' && <span style={s.engineerBadge}>Kỹ sư xác nhận</span>}
          {source === 'rag' && confidence && (
            <span style={{
              ...s.confBadge,
              background: isHighConf ? '#f0fdf4' : isMidConf ? '#fffbeb' : '#eff6ff',
              color:      isHighConf ? '#16a34a' : isMidConf ? '#d97706' : '#2563eb',
            }}>
              Độ tin cậy {confidencePct}%
            </span>
          )}
        </div>

        <div style={s.answerBox}>
          <p style={s.answerText}>{answer}</p>
        </div>

        {isSupported && (
          <button onClick={() => isSpeaking ? stop() : speak(answer)} style={s.ttsBtn}
            aria-label={isSpeaking ? 'Dừng đọc' : 'Nghe câu trả lời'}>
            {isSpeaking
              ? <><VolumeX size={18} strokeWidth={2} /> Dừng đọc</>
              : <><Volume2 size={18} strokeWidth={2} /> Nghe câu trả lời</>
            }
          </button>
        )}

        <div style={s.actionRow}>
          <button onClick={() => navigate('/chat', { state: { sessionId } })} style={s.btnAsk}>
            <MessageCircle size={18} strokeWidth={2} /> Hỏi thêm
          </button>
          <button onClick={() => navigate('/home')} style={s.btnHome}>
            <Home size={18} strokeWidth={2} /> Trang chủ
          </button>
        </div>

        {!reported ? (
          <button onClick={() => setShowReport(true)} style={s.reportLink}>
            Câu trả lời này chưa đúng?
          </button>
        ) : (
          <p style={s.reportedText}>Cảm ơn bạn đã báo lỗi!</p>
        )}
      </main>

      {showReport && (
        <div style={s.overlay} role="dialog" aria-modal="true">
          <div style={s.modal}>
            <h2 style={{ fontSize: 18, margin: '0 0 14px', color: '#0f172a' }}>Câu trả lời bị lỗi?</h2>
            {[
              { type: 'wrong_info',         label: 'Thông tin sai' },
              { type: 'irrelevant',         label: 'Không liên quan' },
              { type: 'hard_to_understand', label: 'Khó hiểu quá' },
            ].map(({ type, label }) => (
              <button key={type} onClick={() => handleReport(type)} style={s.reportBtn}>{label}</button>
            ))}
            <button onClick={() => setShowReport(false)} style={s.cancelBtn}>Bỏ qua</button>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page:          { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: '0 auto', position: 'relative' },
  header:        { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 },
  iconBtn:       { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  headerTitle:   { flex: 1, fontSize: 17, fontWeight: 700, color: '#0f172a', textAlign: 'center' },
  main:          { flex: 1, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 },
  sourceRow:     { display: 'flex', gap: 8, flexWrap: 'wrap' },
  engineerBadge: { fontSize: 12, background: '#f0fdf4', color: '#15803d', padding: '4px 10px', borderRadius: 99, fontWeight: 600 },
  confBadge:     { fontSize: 12, padding: '4px 10px', borderRadius: 99 },
  answerBox:     { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px' },
  answerText:    { fontSize: 17, color: '#0f172a', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' },
  ttsBtn:        { padding: '12px', fontSize: 15, fontWeight: 600, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionRow:     { display: 'flex', gap: 10 },
  btnAsk:        { flex: 1, padding: '13px', fontSize: 16, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnHome:       { flex: 1, padding: '13px', fontSize: 16, background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  reportLink:    { fontSize: 13, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textAlign: 'center' },
  reportedText:  { fontSize: 13, color: '#16a34a', textAlign: 'center' },
  overlay:       { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end' },
  modal:         { background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', display: 'flex', flexDirection: 'column', gap: 8 },
  reportBtn:     { padding: '13px', fontSize: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', color: '#0f172a', textAlign: 'left' },
  cancelBtn:     { padding: '12px', fontSize: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', textAlign: 'center' },
}
