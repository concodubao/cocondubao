import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { chatAPI } from '../../services/api'
import { Send, FlaskConical, ClipboardList } from 'lucide-react'
import AnswerContent from '../../components/AnswerContent'

const TEST_SUGGESTIONS = [
  'Lúa bị vàng lá là bệnh gì?',
  'Rầy nâu cắn gốc phải làm sao?',
  'Phun thuốc đạo ôn liều bao nhiêu?',
  'Cách bón phân NPK cho cây lúa?',
]

function ConfidenceBadge({ confidence }) {
  const pct = Math.round((confidence || 0) * 100)
  const color = pct >= 70 ? '#4B230A' : pct >= 50 ? '#f59e0b' : '#ef4444'
  const bg    = pct >= 70 ? '#fdf6f0' : pct >= 50 ? '#fffbeb' : '#fef2f2'
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: bg, color, fontWeight: 600, border: `1px solid ${color}33` }}>
      Tin cậy: {pct}%
    </span>
  )
}

export default function TestAI() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [messages,  setMessages]  = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('cocon-testai-msgs') || '[]') } catch { return [] }
  })
  const [inputText, setInputText] = useState('')
  const [sessionId, setSessionId] = useState(() => sessionStorage.getItem('cocon-testai-sid') || null)
  const [loading,   setLoading]   = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  // Giữ lại đoạn test khi reload (F5/F12) thay vì mất sạch
  useEffect(() => { sessionStorage.setItem('cocon-testai-msgs', JSON.stringify(messages)) }, [messages])
  useEffect(() => { if (sessionId) sessionStorage.setItem('cocon-testai-sid', sessionId) }, [sessionId])

  async function handleSend(text = inputText) {
    const q = text.trim()
    if (!q || loading) return

    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: q }])
    setInputText('')
    setLoading(true)

    try {
      const res = await chatAPI.ask({ text: q, userId: user?.id, cropType: null, sessionId, testMode: true })
      if (!sessionId && res.data.sessionId) setSessionId(res.data.sessionId)

      if (res.data.needEngineer) {
        setMessages(prev => [...prev, {
          id: Date.now() + 1, role: 'system',
          content: 'AI không đủ tự tin — câu này trong thực tế sẽ được chuyển cho kỹ sư (chế độ test nên không tạo hàng đợi thật).',
        }])
      } else {
        setMessages(prev => [...prev, {
          id: res.data.messageId || Date.now() + 1,
          role: 'assistant',
          content: res.data.answer,
          confidence: res.data.confidence,
          source: res.data.source,
        }])
      }
    } catch (err) {
      const msg = err.response?.data?.error
        || (err.code === 'ECONNABORTED'
          ? 'AI xử lý hơi lâu (có thể đang quá tải), thử lại sau chút nhé.'
          : 'Lỗi kết nối. Thử lại sau.')
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'system',
        content: msg,
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerIcon}>
          <FlaskConical size={18} color="#4B230A" />
        </div>
        <div style={s.headerTitle}>Test AI</div>
        <button onClick={() => navigate('/engineer/queue')} style={s.queueBtn}>
          <ClipboardList size={15} />
          Hàng đợi
        </button>
      </header>

      <main style={s.chatArea}>
        {messages.length === 0 && (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>
              <FlaskConical size={28} color="#fff" />
            </div>
            <p style={s.emptyText}>Nhập câu hỏi để kiểm tra khả năng AI trả lời</p>
            <div style={s.suggestions}>
              {TEST_SUGGESTIONS.map(sg => (
                <button key={sg} onClick={() => handleSend(sg)} style={s.suggestionBtn}>{sg}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => {
          const isUser   = msg.role === 'user'
          const isSystem = msg.role === 'system'
          const baseSource = (msg.source || '').replace(/_(sem)?cached$/, '')
          const isCurated  = baseSource === 'engineer' || baseSource === 'qa_direct'
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 4, marginBottom: 12 }}>
              <div style={{
                maxWidth: '82%', padding: '11px 15px',
                borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: isUser ? '#4B230A' : isSystem ? '#fffbeb' : '#fff',
                color: isUser ? '#fff' : isSystem ? '#92400e' : '#0f172a',
                fontSize: 15, lineHeight: 1.6,
                border: isSystem ? '1px solid #fde68a' : isUser ? 'none' : '1px solid #e2e8f0',
              }}>
                {(!isUser && !isSystem)
                  ? <AnswerContent content={msg.content} showDisclaimer={!isCurated && baseSource !== 'faq'} />
                  : msg.content}
              </div>
              {!isUser && !isSystem && (
                <div style={{ display: 'flex', gap: 6, paddingLeft: 4, flexWrap: 'wrap' }}>
                  <ConfidenceBadge confidence={msg.confidence} />
                  {baseSource === 'engineer' && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#fdf6f0', color: '#2e1505', fontWeight: 600 }}>
                      Kỹ sư xác nhận
                    </span>
                  )}
                </div>
              )}
              {isSystem && msg.showQueueLink && (
                <button onClick={() => navigate('/engineer/queue')} style={s.goQueueBtn}>
                  Xem hàng đợi →
                </button>
              )}
            </div>
          )
        })}

        {loading && (
          <div style={s.typingIndicator} aria-label="AI đang xử lý">
            <span style={s.typingDot} />
            <span style={{ ...s.typingDot, animationDelay: '0.2s' }} />
            <span style={{ ...s.typingDot, animationDelay: '0.4s' }} />
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <footer style={s.inputBar}>
        <div style={s.inputRow}>
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Nhập câu hỏi để test AI..."
            style={s.textarea}
            rows={1}
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim() || loading}
            style={{ ...s.sendBtn, opacity: (!inputText.trim() || loading) ? 0.4 : 1 }}
            aria-label="Gửi"
          >
            <Send size={20} color="#fff" />
          </button>
        </div>
      </footer>

      <style>{`
        @keyframes blink { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
      `}</style>
    </div>
  )
}

const s = {
  page:           { height: '100dvh', display: 'flex', flexDirection: 'column', background: '#fdf8f5', fontFamily: "'Noto Sans', sans-serif" },
  header:         { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 },
  headerIcon:     { width: 34, height: 34, borderRadius: 10, background: '#fdf6f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerTitle:    { flex: 1, fontSize: 17, fontWeight: 700, color: '#0f172a' },
  queueBtn:       { display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer', fontWeight: 500, flexShrink: 0 },
  chatArea:       { flex: 1, overflowY: 'auto', padding: '16px' },
  emptyState:     { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 24, maxWidth: 480, margin: '0 auto' },
  emptyIcon:      { width: 60, height: 60, borderRadius: 18, background: '#4B230A', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyText:      { fontSize: 15, color: '#64748b', textAlign: 'center', margin: 0 },
  suggestions:    { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' },
  suggestionBtn:  { padding: '10px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, color: '#0f172a', cursor: 'pointer', textAlign: 'left', lineHeight: 1.4 },
  typingIndicator:{ display: 'flex', gap: 5, alignItems: 'center', padding: '10px 14px', background: '#fff', borderRadius: '18px 18px 18px 4px', width: 'fit-content', border: '1px solid #e2e8f0' },
  typingDot:      { width: 7, height: 7, borderRadius: '50%', background: '#4B230A', display: 'inline-block', animation: 'blink 1.4s infinite' },
  goQueueBtn:     { fontSize: 13, color: '#4B230A', background: 'none', border: '1px solid #f5d5b0', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 },
  inputBar:       { padding: '10px 16px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))', background: '#fff', borderTop: '1px solid #e2e8f0', position: 'sticky', bottom: 0 },
  inputRow:       { display: 'flex', gap: 8, alignItems: 'flex-end' },
  textarea:       { flex: 1, padding: '11px 13px', fontSize: 15, borderRadius: 12, border: '1.5px solid #e2e8f0', resize: 'none', outline: 'none', background: '#fdf8f5', color: '#0f172a', lineHeight: 1.5, maxHeight: 120 },
  sendBtn:        { width: 48, height: 48, borderRadius: '50%', border: 'none', background: '#4B230A', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
}
