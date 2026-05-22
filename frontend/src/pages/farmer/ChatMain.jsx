import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { chatAPI } from '../../services/api'
import { useSTT } from '../../hooks/useSTT'
import { useTTS } from '../../hooks/useTTS'
import { toast } from '../../components/Toast'
import { ChevronLeft, Camera, Mic, MicOff, Send, Volume2, VolumeX, Flag, CheckCircle, Leaf } from 'lucide-react'

const SUGGESTIONS = {
  rice:    ['Lúa bị vàng lá là bệnh gì?', 'Rầy nâu cắn gốc phải làm sao?', 'Phun thuốc đạo ôn liều bao nhiêu?', 'Lúa bị đổ ngã cần xử lý gì?'],
  default: ['Cây của tôi bị bệnh gì?', 'Nên dùng thuốc nào cho sâu bệnh này?', 'Cách bón phân đúng cách?', 'Lịch phun thuốc nên như thế nào?'],
}

function TypingIndicator() {
  return (
    <div style={styles.typingRow} aria-label="Cò Con đang trả lời">
      <div style={styles.typingAvatar}>
        <Leaf size={12} color="#16a34a" strokeWidth={1.5} />
      </div>
      <div style={styles.typingBubble}>
        <span style={styles.typingDot} />
        <span style={{ ...styles.typingDot, animationDelay: '0.2s' }} />
        <span style={{ ...styles.typingDot, animationDelay: '0.4s' }} />
      </div>
    </div>
  )
}

function MessageBubble({ msg, onReport, onSpeak, speakingMsgId }) {
  const isUser      = msg.role === 'user'
  const isSystem    = msg.role === 'system'
  const isThisSpeaking = speakingMsgId === msg.id

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: 4, marginBottom: 14,
      animation: 'fadeUp 0.25s ease both',
    }}>
      {/* Avatar + bubble cho AI */}
      {!isUser && !isSystem && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <div style={styles.aiAvatar}>
            <Leaf size={12} color="#16a34a" strokeWidth={1.5} />
          </div>
          <div>
            {msg.image_url && (
              <img src={msg.image_url} alt="Ảnh sâu bệnh"
                style={{ maxWidth: 200, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 4, display: 'block' }} />
            )}
            <div style={{
              maxWidth: '80%', padding: '12px 15px',
              borderRadius: '4px 18px 18px 18px',
              background: '#fff', color: '#0f172a',
              fontSize: 15, lineHeight: 1.65,
              border: '1px solid #f1f5f9',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
              {msg.content}
            </div>
          </div>
        </div>
      )}

      {/* System message */}
      {isSystem && (
        <div style={{
          padding: '10px 14px', borderRadius: 12,
          background: '#fffbeb', color: '#92400e', fontSize: 14,
          border: '1px solid #fde68a', maxWidth: '85%',
          lineHeight: 1.5,
        }}>
          {msg.content}
        </div>
      )}

      {/* User message */}
      {isUser && (
        <>
          {msg.image_url && (
            <img src={msg.image_url} alt="Ảnh sâu bệnh"
              style={{ maxWidth: 200, borderRadius: 12, marginBottom: 2, display: 'block' }} />
          )}
          <div style={{
            maxWidth: '80%', padding: '12px 15px',
            borderRadius: '18px 18px 4px 18px',
            background: 'linear-gradient(135deg, #16a34a, #15803d)',
            color: '#fff', fontSize: 15, lineHeight: 1.65,
          }}>
            {msg.content}
          </div>
        </>
      )}

      {/* AI action buttons */}
      {!isUser && !isSystem && (
        <div style={{ display: 'flex', gap: 6, paddingLeft: 36 }}>
          <button
            onClick={() => onSpeak(msg.id, msg.content)}
            style={styles.actionBtn}
            aria-label={isThisSpeaking ? 'Dừng đọc' : 'Nghe câu trả lời'}
          >
            {isThisSpeaking
              ? <VolumeX size={12} strokeWidth={2} />
              : <Volume2 size={12} strokeWidth={2} />
            }
            {isThisSpeaking ? 'Dừng' : 'Nghe'}
          </button>

          {msg.source === 'engineer' && (
            <span style={styles.engineerBadge}>
              <CheckCircle size={11} strokeWidth={2} /> Kỹ sư xác nhận
            </span>
          )}

          <button
            onClick={() => onReport(msg.id)}
            style={{ ...styles.actionBtn, color: '#94a3b8', borderColor: '#e8edf2' }}
            aria-label="Báo câu trả lời sai"
          >
            <Flag size={11} strokeWidth={2} /> Báo lỗi
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

  // TTS lifted lên đây để state isSpeaking được share qua tất cả bubbles
  const { speak, stop, isSpeaking } = useTTS()
  const [speakingMsgId, setSpeakingMsgId] = useState(null)

  // Khi TTS kết thúc, xóa speakingMsgId
  useEffect(() => {
    if (!isSpeaking) setSpeakingMsgId(null)
  }, [isSpeaking])

  const [messages,   setMessages]   = useState([])
  const [inputText,  setInputText]  = useState(location.state?.prefillText || '')
  const [sessionId,  setSessionId]  = useState(location.state?.sessionId   || null)
  const [loading,    setLoading]    = useState(false)
  const [showReport, setShowReport] = useState(null)
  const bottomRef    = useRef(null)
  const textareaRef  = useRef(null)

  const crop        = user?.crops?.[0] || 'default'
  const suggestions = SUGGESTIONS[crop] || SUGGESTIONS.default

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => { if (transcript) setInputText(transcript) }, [transcript])

  // Auto-resize textarea
  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
  }, [inputText])

  function handleSpeak(msgId, content) {
    if (speakingMsgId === msgId) {
      stop()
      setSpeakingMsgId(null)
    } else {
      speak(content)
      setSpeakingMsgId(msgId)
    }
  }

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
      toast.success('Cảm ơn bạn đã báo lỗi! Kỹ sư sẽ xem xét và cải thiện.')
    } catch {
      toast.error('Không gửi được báo lỗi. Thử lại sau nhé.')
    }
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <button onClick={() => navigate('/home')} style={styles.iconBtn} aria-label="Quay lại">
          <ChevronLeft size={22} strokeWidth={2} />
        </button>
        <div style={styles.headerCenter}>
          <div style={styles.headerAvatar}>
            <Leaf size={14} color="#fff" strokeWidth={1.5} />
          </div>
          <div>
            <div style={styles.headerTitle}>Cò Con</div>
            <div style={styles.headerSub}>Trợ lý nông nghiệp AI</div>
          </div>
        </div>
        <button onClick={() => navigate('/chat/image')} style={styles.iconBtn} aria-label="Gửi ảnh sâu bệnh">
          <Camera size={20} strokeWidth={1.5} />
        </button>
      </header>

      {/* Chat area */}
      <main style={styles.chatArea} role="log" aria-live="polite" aria-label="Lịch sử chat">
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyAvatar}>
              <Leaf size={28} color="#16a34a" strokeWidth={1.5} />
            </div>
            <p style={styles.emptyText}>Xin chào! Bạn cần hỏi gì về cây trồng không?</p>

            <div style={styles.suggestionsWrap}>
              {suggestions.map(sg => (
                <button key={sg} onClick={() => handleSend(sg)} style={styles.suggestionChip}>
                  {sg}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onReport={id => setShowReport(id)}
            onSpeak={handleSpeak}
            speakingMsgId={speakingMsgId}
          />
        ))}

        {loading && <TypingIndicator />}
        <div ref={bottomRef} style={{ height: 8 }} />
      </main>

      {/* Input bar */}
      <footer style={styles.inputBar}>
        {sttError && (
          <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 6px', textAlign: 'center' }}>{sttError}</p>
        )}
        <div style={styles.inputRow}>
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Nhập câu hỏi hoặc nhấn mic..."
            style={styles.textarea} rows={1} aria-label="Nhập câu hỏi"
          />
          <button
            onClick={isListening ? stopListening : startListening}
            style={{
              ...styles.micBtn,
              background: isListening ? '#ef4444' : '#e2e8f0',
              animation: isListening ? 'pulse 1s infinite' : 'none',
            }}
            aria-label={isListening ? 'Dừng ghi âm' : 'Nhấn để nói'} aria-pressed={isListening}
          >
            {isListening
              ? <MicOff size={18} color="#fff" />
              : <Mic   size={18} color="#64748b" />
            }
          </button>
          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim() || loading}
            style={{
              ...styles.sendBtn,
              opacity: (!inputText.trim() || loading) ? 0.4 : 1,
              transform: inputText.trim() && !loading ? 'scale(1)' : 'scale(0.95)',
            }}
            aria-label="Gửi câu hỏi"
          >
            <Send size={18} color="#fff" strokeWidth={2} />
          </button>
        </div>
      </footer>

      {/* Report modal */}
      {showReport && (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true"
          onClick={e => e.target === e.currentTarget && setShowReport(null)}>
          <div style={styles.modal} className="slide-up">
            <div style={styles.modalHandle} />
            <h2 style={{ fontSize: 17, margin: '4px 0 14px', color: '#0f172a', fontWeight: 700 }}>
              Câu trả lời bị lỗi?
            </h2>
            {[
              { type: 'wrong_info',         label: 'Thông tin sai' },
              { type: 'irrelevant',         label: 'Không liên quan đến câu hỏi' },
              { type: 'hard_to_understand', label: 'Khó hiểu, cần giải thích thêm' },
            ].map(({ type, label }) => (
              <button key={type} onClick={() => handleReport(showReport, type)} style={styles.reportBtn}>
                {label}
              </button>
            ))}
            <button onClick={() => setShowReport(null)} style={styles.cancelBtn}>Bỏ qua</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
        @keyframes blink  { 0%,80%,100%{opacity:0.15} 40%{opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}

const styles = {
  page:           { height: '100dvh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: '0 auto' },
  header:         { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' },
  iconBtn:        { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, flexShrink: 0 },
  headerCenter:   { flex: 1, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' },
  headerAvatar:   { width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerTitle:    { fontSize: 15, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 },
  headerSub:      { fontSize: 11, color: '#64748b' },
  chatArea:       { flex: 1, overflowY: 'auto', padding: '16px 14px' },
  emptyState:     { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingTop: 28 },
  emptyAvatar:    { width: 72, height: 72, borderRadius: 22, background: '#f0fdf4', border: '2px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyText:      { fontSize: 15, color: '#64748b', textAlign: 'center', margin: 0 },
  suggestionsWrap:{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
  suggestionChip: { padding: '12px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 14, color: '#374151', cursor: 'pointer', textAlign: 'left', lineHeight: 1.4, width: '100%', fontFamily: "'Noto Sans', sans-serif" },
  aiAvatar:       { width: 28, height: 28, borderRadius: 8, background: '#f0fdf4', border: '1.5px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 },
  typingRow:      { display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 14 },
  typingAvatar:   { width: 28, height: 28, borderRadius: 8, background: '#f0fdf4', border: '1.5px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typingBubble:   { display: 'flex', gap: 5, alignItems: 'center', padding: '12px 16px', background: '#fff', borderRadius: '4px 18px 18px 18px', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  typingDot:      { width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'blink 1.4s ease infinite' },
  actionBtn:      { padding: '4px 9px', fontSize: 11, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', color: '#16a34a', minHeight: 26, display: 'flex', alignItems: 'center', gap: 3, fontFamily: "'Noto Sans', sans-serif" },
  engineerBadge:  { padding: '4px 9px', fontSize: 11, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 },
  inputBar:       { padding: '10px 12px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))', background: '#fff', borderTop: '1px solid #f1f5f9', position: 'sticky', bottom: 0, boxShadow: '0 -1px 8px rgba(0,0,0,0.04)' },
  inputRow:       { display: 'flex', gap: 8, alignItems: 'flex-end' },
  textarea:       { flex: 1, padding: '11px 13px', fontSize: 15, borderRadius: 14, border: '1.5px solid #e2e8f0', resize: 'none', outline: 'none', background: '#f8fafc', color: '#0f172a', lineHeight: 1.55, maxHeight: 120, fontFamily: "'Noto Sans', sans-serif", overflowY: 'auto' },
  micBtn:         { width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sendBtn:        { width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(22,163,74,0.3)', transition: 'opacity 0.15s, transform 0.15s' },
  modalOverlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', zIndex: 100, backdropFilter: 'blur(2px)' },
  modal:          { background: '#fff', borderRadius: '24px 24px 0 0', padding: '12px 20px 36px', width: '100%', display: 'flex', flexDirection: 'column', gap: 8 },
  modalHandle:    { width: 40, height: 4, background: '#e2e8f0', borderRadius: 99, margin: '0 auto 12px', flexShrink: 0 },
  reportBtn:      { padding: '14px 16px', fontSize: 15, background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 12, cursor: 'pointer', color: '#0f172a', textAlign: 'left', fontFamily: "'Noto Sans', sans-serif" },
  cancelBtn:      { padding: '12px', fontSize: 15, background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', textAlign: 'center', fontFamily: "'Noto Sans', sans-serif" },
}
