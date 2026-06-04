import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useTTS } from '../../hooks/useTTS'
import { chatAPI } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import { useState } from 'react'
import { ChevronLeft, Volume2, VolumeX, MessageCircle, Home } from 'lucide-react'
import AnswerContent from '../../components/AnswerContent'

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
        {/* Vùng trên — badge + nội dung câu trả lời (cuộn được nếu dài) */}
        <div style={s.topContent}>
          <div style={s.sourceRow}>
            {source === 'engineer' && <span style={s.engineerBadge}>Kỹ sư xác nhận</span>}
            {source === 'rag' && confidence && (
              <span style={{
                ...s.confBadge,
                background: isHighConf ? '#fdf6f0' : isMidConf ? '#fffbeb' : '#eff6ff',
                color:      isHighConf ? '#4B230A' : isMidConf ? '#d97706' : '#2563eb',
              }}>
                Độ tin cậy {confidencePct}%
              </span>
            )}
          </div>

          <div style={s.answerBox}>
            <AnswerContent
              content={answer}
              showDisclaimer={source !== 'engineer' && source !== 'faq'}
              style={s.answerText}
            />
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
        </div>

        {/* Vùng dưới — nút hành động (luôn hiện ở cuối trang) */}
        <div style={s.bottomContent}>
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
        </div>
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
  page:          { height: '100dvh', display: 'flex', flexDirection: 'column', background: '#fdf8f5', fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: '0 auto', position: 'relative' },
  header:        { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 },
  iconBtn:       { width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  headerTitle:   { flex: 1, fontSize: 17, fontWeight: 700, color: '#0f172a', textAlign: 'center' },
  main:          { flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16, paddingBottom: 'max(24px, env(safe-area-inset-bottom))' },
  topContent:    { display: 'flex', flexDirection: 'column', gap: 14, flex: 1 },
  bottomContent: { display: 'flex', flexDirection: 'column', gap: 10 },
  sourceRow:     { display: 'flex', gap: 8, flexWrap: 'wrap' },
  engineerBadge: { fontSize: 12, background: '#fdf6f0', color: '#2e1505', padding: '5px 12px', borderRadius: 99, fontWeight: 600 },
  confBadge:     { fontSize: 12, padding: '5px 12px', borderRadius: 99 },
  answerBox:     { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px', flex: 1 },
  answerText:    { fontSize: 17, color: '#0f172a', lineHeight: 1.85, margin: 0, whiteSpace: 'pre-wrap', textAlign: 'left' },
  ttsBtn:        { padding: '13px', fontSize: 15, fontWeight: 600, background: '#fdf6f0', color: '#4B230A', border: '1px solid #f5d5b0', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionRow:     { display: 'flex', gap: 10 },
  btnAsk:        { flex: 1, padding: '14px', fontSize: 16, fontWeight: 700, background: '#4B230A', color: '#fff', border: 'none', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnHome:       { flex: 1, padding: '14px', fontSize: 16, background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  reportLink:    { fontSize: 13, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textAlign: 'center', padding: '4px 0' },
  reportedText:  { fontSize: 13, color: '#4B230A', textAlign: 'center' },
  overlay:       { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end' },
  modal:         { background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', display: 'flex', flexDirection: 'column', gap: 8 },
  reportBtn:     { padding: '13px', fontSize: 16, background: '#fdf8f5', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', color: '#0f172a', textAlign: 'left' },
  cancelBtn:     { padding: '12px', fontSize: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', textAlign: 'center' },
}
