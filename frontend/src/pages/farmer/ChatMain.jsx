import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { chatAPI } from '../../services/api'
import { useSTT } from '../../hooks/useSTT'
import { useTTS } from '../../hooks/useTTS'
import { ChevronLeft, Camera, Mic, MicOff, Send, Volume2, VolumeX, Flag } from 'lucide-react'

const SUGGESTIONS = {
  rice:    ['Lúa bị vàng lá là bệnh gì?', 'Rầy nâu cắn gốc phải làm sao?', 'Phun thuốc đạo ôn liều bao nhiêu?', 'Lúa bị đổ ngã cần xử lý gì?'],
  default: ['Cây của tôi bị bệnh gì?', 'Nên dùng thuốc nào cho sâu bệnh này?', 'Cách bón phân đúng cách?', 'Lịch phun thuốc nên như thế nào?'],
}

function MessageBubble({ msg, onReport }) {
  const { speak, isSpeaking, stop } = useTTS()
  const isUser   = msg.role === 'user'
  const isSystem = msg.role === 'system'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 4, marginBottom: 12 }}>
      {msg.image_url && (
        <img src={msg.image_url} alt="Ảnh sâu bệnh" style={{ maxWidth: 200, borderRadius: 12, border: '1px solid #e2e8f0' }} />
      )}
      <div style={{
        maxWidth: '82%', padding: '11px 15px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isUser ? '#16a34a' : isSystem ? '#fffbeb' : '#fff',
        color: isUser ? '#fff' : isSystem ? '#92400e' : '#0f172a',
        fontSize: 16, lineHeight: 1.6,
        border: isSystem ? '1px solid #fde68a' : isUser ? 'none' : '1px solid #e2e8f0',
      }}>
        {msg.content}
      </div>
      {!isUser && !isSystem && (
        <div style={{ display: 'flex', gap: 6, paddingLeft: 4 }}>
          <button onClick={() => isSpeaking ? stop() : speak(msg.content)} style={styles.actionBtn}
            aria-label={isSpeaking ? 'Dừng đọc' : 'Nghe câu trả lời'}>
            {isSpeaking
              ? <VolumeX size={13} strokeWidth={2} />
              : <Volume2 size={13} strokeWidth={2} />
            }
            {isSpeaking ? 'Dừng' : 'Nghe'}
          </button>
          {msg.source === 'engineer' && (
            <span style={styles.engineerBadge}>Kỹ sư xác nhận</span>
          )}
          <button onClick={() => onReport(msg.id)} style={{ ...styles.actionBtn, color: '#94a3b8', borderColor: '#e2e8f0' }}
            aria-label="Báo câu trả lời sai">
            <Flag size={12} strokeWidth={2} /> Báo lỗi
          </button>
        </div>
      )}
    </div>
  )
}

export default function ChatMain() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user }  = useAuthStore()
  const { transcript, isListening, error: sttError, startListening, stopListening, resetTranscript } = useSTT()

  const [messages,   setMessages]   = useState([])
  const [inputText,  setInputText]  = useState(location.state?.prefillText || '')
  const [sessionId,  setSessionId]  = useState(location.state?.sessionId   || null)
  const [loading,    setLoading]    = useState(false)
  const [showReport, setShowReport] = useState(null)
  const bottomRef = useRef(null)

  const crop        = user?.crops?.[0] || 'default'
  const suggestions = SUGGESTIONS[crop] || SUGGESTIONS.default

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => { if (transcript) setInputText(transcript) }, [transcript])

  async function handleSend(text = inputText) {
    const q = text.trim()
    if (!q || loading) return

    const userMsg = { id: Date.now(), role: 'user', content: q, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInputText('')
    resetTranscript()
    setLoading(true)

    try {
      const res = await chatAPI.ask({ text: q, userId: user?.id, cropType: user?.crops?.[0] || null, sessionId })
      if (!sessionId) setSessionId(res.data.sessionId)
      if (res.data.needEngineer) {
        navigate('/chat/waiting', { state: { sessionId: res.data.sessionId, messageId: res.data.messageId } })
        return
      }
      setMessages(prev => [...prev, {
        id: res.data.messageId || Date.now() + 1, role: 'assistant',
        content: res.data.answer, confidence: res.data.confidence,
        source: res.data.source, created_at: new Date().toISOString(),
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'system',
        content: 'Mạng đang yếu, bạn thử gửi lại nhé.', created_at: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
    }
  }

  async function handleReport(messageId, errorType) {
    try {
      await chatAPI.reportError({ messageId, errorType })
      setShowReport(null)
      alert('Cảm ơn bạn đã báo lỗi! Kỹ sư sẽ xem xét và cải thiện.')
    } catch {
      alert('Không gửi được báo lỗi. Thử lại sau nhé.')
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button onClick={() => navigate('/home')} style={styles.iconBtn} aria-label="Quay lại">
          <ChevronLeft size={22} />
        </button>
        <div style={styles.headerTitle}>Hỏi Cò Con</div>
        <button onClick={() => navigate('/chat/image')} style={styles.iconBtn} aria-label="Gửi ảnh sâu bệnh">
          <Camera size={20} />
        </button>
      </header>

      <main style={styles.chatArea} role="log" aria-live="polite" aria-label="Lịch sử chat">
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyLogoMark}>C</div>
            <p style={styles.emptyText}>Xin chào! Bạn cần hỏi gì về cây trồng không?</p>
            <div style={styles.suggestions}>
              {suggestions.map(sg => (
                <button key={sg} onClick={() => handleSend(sg)} style={styles.suggestionBtn}>{sg}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} onReport={id => setShowReport(id)} />
        ))}

        {loading && (
          <div style={styles.typingIndicator} aria-label="Cò Con đang trả lời">
            <span style={styles.typingDot} />
            <span style={{ ...styles.typingDot, animationDelay: '0.2s' }} />
            <span style={{ ...styles.typingDot, animationDelay: '0.4s' }} />
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <footer style={styles.inputBar}>
        {sttError && <p style={{ fontSize: 13, color: '#ef4444', margin: '0 0 6px', textAlign: 'center' }}>{sttError}</p>}
        <div style={styles.inputRow}>
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Nhập câu hỏi hoặc nhấn mic để nói..."
            style={styles.textarea} rows={1} aria-label="Nhập câu hỏi"
          />
          <button
            onClick={isListening ? stopListening : startListening}
            style={{ ...styles.micBtn, background: isListening ? '#ef4444' : '#16a34a', animation: isListening ? 'pulse 1s infinite' : 'none' }}
            aria-label={isListening ? 'Dừng ghi âm' : 'Nhấn để nói'} aria-pressed={isListening}
          >
            {isListening ? <MicOff size={22} color="#fff" /> : <Mic size={22} color="#fff" />}
          </button>
          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim() || loading}
            style={{ ...styles.sendBtn, opacity: (!inputText.trim() || loading) ? 0.4 : 1 }}
            aria-label="Gửi câu hỏi"
          >
            <Send size={20} color="#fff" />
          </button>
        </div>
      </footer>

      {showReport && (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true">
          <div style={styles.modal}>
            <h2 style={{ fontSize: 18, margin: '0 0 14px', color: '#0f172a' }}>Câu trả lời bị lỗi?</h2>
            {[
              { type: 'wrong_info',         label: 'Thông tin sai' },
              { type: 'irrelevant',         label: 'Không liên quan' },
              { type: 'hard_to_understand', label: 'Khó hiểu quá' },
            ].map(({ type, label }) => (
              <button key={type} onClick={() => handleReport(showReport, type)} style={styles.reportBtn}>{label}</button>
            ))}
            <button onClick={() => setShowReport(null)} style={styles.cancelBtn}>Bỏ qua</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        @keyframes blink { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
      `}</style>
    </div>
  )
}

const styles = {
  page:            { height: '100dvh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: '0 auto' },
  header:          { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 },
  iconBtn:         { width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  headerTitle:     { flex: 1, fontSize: 17, fontWeight: 700, color: '#0f172a', textAlign: 'center' },
  chatArea:        { flex: 1, overflowY: 'auto', padding: '16px' },
  emptyState:      { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 24 },
  emptyLogoMark:   { width: 60, height: 60, borderRadius: 18, background: '#16a34a', color: '#fff', fontSize: 26, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyText:       { fontSize: 16, color: '#64748b', textAlign: 'center', margin: 0 },
  suggestions:     { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' },
  suggestionBtn:   { padding: '11px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 15, color: '#0f172a', cursor: 'pointer', textAlign: 'left', lineHeight: 1.4 },
  typingIndicator: { display: 'flex', gap: 5, alignItems: 'center', padding: '10px 14px', background: '#fff', borderRadius: '18px 18px 18px 4px', width: 'fit-content', border: '1px solid #e2e8f0' },
  typingDot:       { width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'blink 1.4s infinite' },
  actionBtn:       { padding: '3px 8px', fontSize: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', color: '#16a34a', minHeight: 28, display: 'flex', alignItems: 'center', gap: 4 },
  engineerBadge:   { padding: '3px 8px', fontSize: 11, background: '#f0fdf4', borderRadius: 6, color: '#15803d', fontWeight: 600 },
  inputBar:        { padding: '10px 12px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))', background: '#fff', borderTop: '1px solid #e2e8f0', position: 'sticky', bottom: 0 },
  inputRow:        { display: 'flex', gap: 8, alignItems: 'flex-end' },
  textarea:        { flex: 1, padding: '11px 13px', fontSize: 16, borderRadius: 12, border: '1.5px solid #e2e8f0', resize: 'none', outline: 'none', background: '#f8fafc', color: '#0f172a', lineHeight: 1.5, maxHeight: 120, textAlign: 'left' },
  micBtn:          { width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sendBtn:         { width: 48, height: 48, borderRadius: '50%', border: 'none', background: '#16a34a', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalOverlay:    { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end' },
  modal:           { background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', display: 'flex', flexDirection: 'column', gap: 8 },
  reportBtn:       { padding: '13px', fontSize: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', color: '#0f172a', textAlign: 'left' },
  cancelBtn:       { padding: '12px', fontSize: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', textAlign: 'center' },
}
