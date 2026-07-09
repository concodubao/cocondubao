import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { chatAPI } from '../../services/api'
import { useSTT } from '../../hooks/useSTT'
import { useTTS } from '../../hooks/useTTS'
import { toast } from '../../stores/toastStore'
import AnswerContent from '../../components/AnswerContent'

const CROP_OPTIONS = [
  { id: 'rice',   label: 'Lúa',          icon: 'grass' },
  { id: 'veggie', label: 'Rau màu',      icon: 'eco' },
  { id: 'fruit',  label: 'Cây ăn trái', icon: 'forest' },
  { id: 'other',  label: 'Khác',         icon: 'more_horiz' },
]

const SUGGESTIONS = {
  rice:    ['Lúa bị vàng lá là bệnh gì?', 'Rầy nâu cắn gốc phải làm sao?', 'Phun thuốc đạo ôn liều bao nhiêu?', 'Lúa bị đổ ngã cần xử lý gì?'],
  veggie:  ['Rau bị sâu ăn lá làm sao?', 'Phân bón cho rau ngắn ngày?', 'Rau bị vàng úa xử lý thế nào?', 'Cách tưới nước cho rau đúng?'],
  fruit:   ['Cây ăn trái bị nấm phải làm gì?', 'Bón phân cho cây ra hoa?', 'Xử lý cây bị sâu đục thân?', 'Khi nào nên thu hoạch?'],
  default: ['Cây của tôi bị bệnh gì?', 'Nên dùng thuốc nào cho sâu bệnh này?', 'Cách bón phân đúng cách?', 'Lịch phun thuốc nên như thế nào?'],
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-4" aria-label="Cò Con đang trả lời">
      <div className="w-7 h-7 rounded-xl bg-white border-[1.5px] border-[#f0e0d0]
                      flex items-center justify-center flex-shrink-0 overflow-hidden">
        <img src="/cocon-icon-bg.png" alt="Cò Con" className="w-6 h-6 object-contain" />
      </div>
      <div className="flex items-center gap-1.5 px-4 py-3 bg-white
                      rounded-[4px_18px_18px_18px] border border-[#f1f5f9] shadow-sm">
        <span className="w-2 h-2 rounded-full bg-[#4B230A] inline-block"
              style={{ animation: 'blink 1.4s ease infinite' }} />
        <span className="w-2 h-2 rounded-full bg-[#4B230A] inline-block"
              style={{ animation: 'blink 1.4s ease infinite', animationDelay: '0.2s' }} />
        <span className="w-2 h-2 rounded-full bg-[#4B230A] inline-block"
              style={{ animation: 'blink 1.4s ease infinite', animationDelay: '0.4s' }} />
      </div>
    </div>
  )
}

// ─── Waveform bars ─────────────────────────────────────────────────────────────
function VolumeWave({ volume }) {
  const bars = [0.4, 0.7, 1.0, 0.7, 0.4]
  return (
    <div className="flex items-center gap-0.5 h-5">
      {bars.map((scale, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-white transition-all duration-75"
          style={{ height: Math.max(4, Math.round(volume * scale * 0.18)) }}
        />
      ))}
    </div>
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, onReport, onSpeak, onEscalate, escalated, speakingMsgId }) {
  const isUser         = msg.role === 'user'
  const isSystem       = msg.role === 'system'
  const isThisSpeaking = speakingMsgId === msg.id
  // Bỏ hậu tố cache để xét đúng loại nguồn (đồng bộ với màn AIResult). qa_direct
  // là câu kỹ sư biên soạn → coi như "kỹ sư", không gắn disclaimer thừa.
  const baseSource     = (msg.source || '').replace(/_(sem)?cached$/, '')
  const isCurated      = baseSource === 'engineer' || baseSource === 'qa_direct'

  return (
    <div className={`flex flex-col gap-1 mb-4 fade-up ${isUser ? 'items-end' : 'items-start'}`}>

      {/* AI bubble */}
      {!isUser && !isSystem && (
        <div className="flex items-end gap-2">
          <img src="/cocon-icon-bg.png" alt="Cò Con"
               className="w-7 h-7 rounded-full flex-shrink-0 mb-0.5 object-cover" />
          <div>
            {msg.image_url && (
              <img src={msg.image_url} alt="Ảnh sâu bệnh"
                className="max-w-[200px] rounded-xl border border-[#f0e0d0] mb-1 block" />
            )}
            <div className="max-w-[80%] px-4 py-3 text-[15px] leading-relaxed text-[#0b1c30]
                            bg-white border border-[#f1f5f9] shadow-sm
                            rounded-[4px_18px_18px_18px]">
              {baseSource === 'vision' && (
                <div className="flex items-center gap-1 text-[11px] text-[#7c3aed] mb-1.5">
                  <span className="material-symbols-outlined text-[14px]">visibility</span>
                  Phân tích ảnh bằng AI Vision
                </div>
              )}
              <AnswerContent content={msg.content} showDisclaimer={!isCurated && baseSource !== 'faq'} />
            </div>
          </div>
        </div>
      )}

      {/* System message */}
      {isSystem && (
        <div className="px-4 py-3 rounded-2xl bg-[#fffbeb] border border-[#fde68a]
                        text-[14px] text-[#92400e] max-w-[85%] leading-snug">
          {msg.content}
        </div>
      )}

      {/* User bubble */}
      {isUser && (
        <>
          {msg.image_url && (
            <img src={msg.image_url} alt="Ảnh sâu bệnh"
              className="max-w-[200px] rounded-xl mb-1 block" />
          )}
          <div className="max-w-[80%] px-4 py-3 text-[15px] leading-relaxed text-white
                          bg-gradient-to-br from-[#6b3410] to-[#4B230A]
                          rounded-[18px_18px_4px_18px]">
            {msg.content}
          </div>
        </>
      )}

      {/* AI action row */}
      {!isUser && !isSystem && (
        <div className="flex flex-col gap-2 pl-9 max-w-[80%]">
          {/* Large TTS button — Stitch spec */}
          <button
            onClick={() => onSpeak(msg.id, msg.content)}
            aria-label={isThisSpeaking ? 'Dừng đọc' : 'Nghe câu trả lời'}
            className={`flex items-center justify-center gap-2 w-full h-[48px] rounded-2xl
                        text-[15px] font-bold transition-all
                        ${isThisSpeaking
                          ? 'bg-[#fef2f2] border border-[#fecaca] text-[#ef4444]'
                          : 'bg-white border-2 border-[#4B230A] text-[#4B230A]'
                        }`}
          >
            <span className="material-symbols-outlined text-[20px] ms-fill">
              {isThisSpeaking ? 'stop_circle' : 'volume_up'}
            </span>
            {isThisSpeaking ? 'Dừng đọc' : '🔊 Nghe câu trả lời'}
          </button>

          {/* Secondary badges */}
          <div className="flex items-center gap-1.5">
            {msg.source === 'engineer' && (
              <span className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-[#2e1505] font-semibold
                               bg-[#fdf6f0] border border-[#f5d5b0] rounded-lg">
                <span className="material-symbols-outlined text-[13px] ms-fill">check_circle</span>
                Kỹ sư xác nhận
              </span>
            )}
            <button
              onClick={() => onReport(msg.id)}
              aria-label="Báo câu trả lời sai"
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-[#7a6358]
                         bg-white border border-[#f0e0d0] rounded-lg"
            >
              <span className="material-symbols-outlined text-[13px]">flag</span>
              Báo lỗi
            </button>
            {msg.source !== 'engineer' && (
              <button
                onClick={() => onEscalate(msg.id)}
                disabled={escalated}
                aria-label="Hỏi lại kỹ sư"
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg
                  ${escalated
                    ? 'text-[#2e1505] bg-[#fdf6f0] border border-[#f5d5b0]'
                    : 'text-[#4B230A] bg-white border border-[#4B230A]'}`}
              >
                <span className="material-symbols-outlined text-[13px] ms-fill">support_agent</span>
                {escalated ? 'Đã gửi kỹ sư' : 'Hỏi lại kỹ sư'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CropSelector ─────────────────────────────────────────────────────────────
function CropSelector({ crops, activeCrop, onChange }) {
  const [open, setOpen] = useState(false)
  const label = CROP_OPTIONS.find(c => c.id === activeCrop)?.label || 'Chọn cây'
  if (!crops?.length) return null
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        className="flex items-center gap-1 px-3 py-1.5 border-[1.5px] border-[#f5d5b0]
                   rounded-full bg-[#fdf6f0] text-[13px] text-[#4B230A] font-semibold"
      >
        <span className="material-symbols-outlined text-[15px] ms-fill">eco</span>
        {label}
        <span className="material-symbols-outlined text-[15px]">expand_more</span>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute top-[110%] right-0 bg-white border border-[#f0e0d0]
                     rounded-2xl shadow-lg z-50 min-w-[130px] overflow-hidden"
        >
          {crops.map(id => {
            const opt = CROP_OPTIONS.find(c => c.id === id)
            if (!opt) return null
            return (
              <button
                key={id}
                role="option"
                aria-selected={id === activeCrop}
                onClick={() => { onChange(id); setOpen(false) }}
                className={`flex items-center gap-2 w-full px-4 py-3 text-[14px] text-left
                            ${id === activeCrop
                              ? 'bg-[#fdf6f0] text-[#4B230A] font-semibold'
                              : 'text-[#0b1c30]'
                            }`}
              >
                <span className={`material-symbols-outlined text-[16px] ${id === activeCrop ? 'ms-fill text-[#4B230A]' : 'text-[#7a6358]'}`}>
                  {opt.icon}
                </span>
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ChatMain() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user }  = useAuthStore()

  const { transcript, isListening, isProcessing, error: sttError, volume, startListening, stopListening, resetTranscript } = useSTT()
  const { speak, stop, isSpeaking } = useTTS()
  const [speakingMsgId, setSpeakingMsgId] = useState(null)

  const [messages,    setMessages]    = useState([])
  const [inputText,   setInputText]   = useState(location.state?.prefillText || '')
  const [sessionId,   setSessionId]   = useState(location.state?.sessionId   || null)
  const [loading,     setLoading]     = useState(false)
  const [loadingHist, setLoadingHist] = useState(false)
  const [showReport,  setShowReport]  = useState(null)
  const [escalatedIds, setEscalatedIds] = useState(() => new Set())

  const [activeCrop, setActiveCrop] = useState(user?.crops?.[0] || null)
  const userCrops   = user?.crops || []
  const suggestions = SUGGESTIONS[activeCrop] || SUGGESTIONS.default

  const bottomRef   = useRef(null)
  const textareaRef = useRef(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!isSpeaking) setSpeakingMsgId(null) }, [isSpeaking])

  useEffect(() => {
    const sid = location.state?.sessionId
    if (!sid) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingHist(true)
    chatAPI.getMessages(sid)
      .then(res => {
        const msgs = (res.data.messages || []).map(m => ({
          id:         m.id,
          role:       m.role,
          content:    m.content,
          image_url:  m.image_url,
          confidence: m.confidence,
          source:     m.source,
          created_at: m.created_at,
        }))
        setMessages(msgs)
      })
      .catch(err => console.warn('[ChatMain] load history failed:', err.message))
      .finally(() => setLoadingHist(false))
  }, [location.state?.sessionId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (transcript) setInputText(transcript) }, [transcript])

  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
  }, [inputText])

  function handleSpeak(msgId, content) {
    if (speakingMsgId === msgId) { stop(); setSpeakingMsgId(null) }
    else { speak(content); setSpeakingMsgId(msgId) }
  }

  const handleSend = useCallback(async (text = inputText) => {
    const q = text.trim()
    if (!q || loading) return

    const userMsg = { id: Date.now(), role: 'user', content: q, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInputText('')
    resetTranscript()
    setLoading(true)

    try {
      const res = await chatAPI.ask({
        text:     q,
        userId:   user?.id,
        cropType: activeCrop,
        sessionId,
      })
      if (!sessionId) setSessionId(res.data.sessionId)
      if (res.data.needEngineer) {
        navigate('/chat/waiting', { state: { sessionId: res.data.sessionId, messageId: res.data.messageId } })
        return
      }
      setMessages(prev => [...prev, {
        id:         res.data.messageId || Date.now() + 1,
        role:       'assistant',
        content:    res.data.answer,
        confidence: res.data.confidence,
        source:     res.data.source,
        created_at: new Date().toISOString(),
      }])
    } catch (err) {
      const msg = err.response?.data?.error
        || (err.code === 'ECONNABORTED'
          ? 'Cò Con xử lý hơi lâu, bạn thử gửi lại sau chút nhé.'
          : 'Mạng đang yếu, bạn thử gửi lại nhé.')
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'system',
        content: msg, created_at: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
    }
  }, [inputText, loading, activeCrop, sessionId, user, navigate, resetTranscript])

  async function handleReport(messageId, errorType) {
    try {
      await chatAPI.reportError({ messageId, errorType })
      setShowReport(null)
      toast.success('Cảm ơn bạn đã báo lỗi! Kỹ sư sẽ xem xét và cải thiện.')
    } catch {
      toast.error('Không gửi được báo lỗi. Thử lại sau nhé.')
    }
  }

  async function handleEscalate(messageId) {
    if (escalatedIds.has(messageId)) return
    if (!confirm('Gửi câu hỏi này cho kỹ sư nông nghiệp xem lại?')) return
    try {
      await chatAPI.escalate(messageId)
      setEscalatedIds(prev => new Set(prev).add(messageId))
      toast.success('Đã gửi cho kỹ sư. Kỹ sư sẽ trả lời trong vòng 24 giờ.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Không gửi được. Thử lại nhé.')
    }
  }

  return (
    <div className="h-dvh flex flex-col bg-[#fdf8f5] max-w-[480px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center gap-2 px-3 py-2.5 bg-white
                         border-b border-[#f1f5f9] shadow-[0_1px_6px_rgba(0,0,0,0.04)]
                         sticky top-0 z-10">
        <button
          onClick={() => navigate('/home')}
          aria-label="Quay lại"
          className="w-10 h-10 flex items-center justify-center rounded-2xl text-[#7a6358] flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>

        <div className="flex-1 flex items-center gap-2.5 justify-center">
          <div className="w-9 h-9 rounded-[12px] bg-white border border-[#f0e0d0]
                          flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src="/cocon-icon-bg.png" alt="Cò Con" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <div className="text-[15px] font-bold text-[#0b1c30] leading-tight">Cò Con</div>
            <div className="text-[11px] text-[#7a6358]">Trợ lý nông nghiệp AI</div>
          </div>
        </div>

        {userCrops.length >= 2 && (
          <CropSelector crops={userCrops} activeCrop={activeCrop} onChange={setActiveCrop} />
        )}

        <button
          onClick={() => navigate('/chat/history')}
          aria-label="Lịch sử chat"
          className="w-10 h-10 flex items-center justify-center rounded-2xl text-[#7a6358] flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[22px]">history</span>
        </button>
        <button
          onClick={() => navigate('/chat/image')}
          aria-label="Gửi ảnh sâu bệnh"
          className="w-10 h-10 flex items-center justify-center rounded-2xl text-[#7a6358] flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[22px]">photo_camera</span>
        </button>
      </header>

      {/* ── Chat area ──────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 py-4"
            role="log" aria-live="polite" aria-label="Lịch sử chat">

        {loadingHist && (
          <p className="text-center text-[13px] text-[#7a6358] py-4">
            Đang tải lịch sử chat...
          </p>
        )}

        {messages.length === 0 && !loadingHist && (
          <div className="flex flex-col items-center gap-4 pt-8">
            <div className="rounded-[22px] bg-white border-2 border-[#f0e0d0]
                            flex items-center justify-center overflow-hidden" style={{ width: 72, height: 72 }}>
              <img src="/cocon-icon-bg.png" alt="Cò Con" className="w-16 h-16 object-contain" />
            </div>
            <p className="text-[15px] text-[#7a6358] text-center m-0">
              Xin chào! Bạn cần hỏi gì về cây trồng không?
            </p>
            <div className="w-full flex flex-col gap-2 mt-1">
              {suggestions.map(sg => (
                <button
                  key={sg}
                  onClick={() => handleSend(sg)}
                  className="w-full px-4 py-3 bg-white border border-[#f0e0d0] rounded-2xl
                             text-[14px] text-[#0b1c30] text-left leading-snug"
                >
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
            onEscalate={handleEscalate}
            escalated={escalatedIds.has(msg.id)}
            speakingMsgId={speakingMsgId}
          />
        ))}

        {loading && <TypingIndicator />}
        <div ref={bottomRef} className="h-2" />
      </main>

      {/* ── Input bar ──────────────────────────────────────────── */}
      <footer className="px-3 py-2.5 bg-white border-t border-[#f1f5f9]
                         shadow-[0_-1px_8px_rgba(0,0,0,0.04)] sticky bottom-0"
              style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
        {sttError && (
          <p className="text-[12px] text-[#ba1a1a] text-center mb-1.5">{sttError}</p>
        )}
        {isProcessing && (
          <p className="text-[12px] text-[#7c3aed] text-center mb-1.5">
            ⏳ Đang nhận dạng giọng nói...
          </p>
        )}
        <div className="flex items-end gap-2">
          <button
            onClick={() => navigate('/chat/image')}
            aria-label="Gửi ảnh sâu bệnh"
            className="w-11 h-11 rounded-full bg-[#f0e0d0] flex items-center justify-center flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[20px] text-[#7a6358]">photo_camera</span>
          </button>
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Nhập câu hỏi hoặc nhấn mic..."
            rows={1}
            aria-label="Nhập câu hỏi"
            className="flex-1 px-4 py-3 text-[15px] text-[#0b1c30] bg-[#fdf8f5]
                       border-[1.5px] border-[#f0e0d0] rounded-2xl resize-none
                       leading-snug overflow-y-auto placeholder-[#d4b8a8]"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={isListening ? stopListening : startListening}
            aria-label={isListening ? 'Dừng ghi âm' : 'Nhấn để nói'}
            aria-pressed={isListening}
            className={`w-11 h-11 rounded-full flex items-center justify-center
                        flex-shrink-0 transition-all
                        ${isListening
                          ? 'bg-[#EF4444] shadow-[0_2px_8px_rgba(239,68,68,0.4)]'
                          : 'bg-[#f0e0d0]'
                        }`}
            style={isListening ? { animation: 'pulse 1s infinite' } : {}}
          >
            {isListening
              ? <VolumeWave volume={volume} />
              : <span className="material-symbols-outlined text-[20px] text-[#7a6358]">mic</span>
            }
          </button>
          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim() || loading}
            aria-label="Gửi câu hỏi"
            className="w-11 h-11 rounded-full bg-gradient-to-br from-[#6b3410] to-[#4B230A]
                       flex items-center justify-center flex-shrink-0
                       shadow-[0_2px_8px_rgba(75,35,10,0.3)]
                       disabled:opacity-40 transition-opacity"
          >
            <span className="material-symbols-outlined text-[20px] text-white ms-fill">send</span>
          </button>
        </div>
      </footer>

      {/* ── Report modal ───────────────────────────────────────── */}
      {showReport && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-end z-50"
          onClick={e => e.target === e.currentTarget && setShowReport(null)}
        >
          <div className="bg-white rounded-t-[28px] px-5 pt-3 pb-10 w-full flex flex-col gap-2 slide-up">
            <div className="w-10 h-1 bg-[#f0e0d0] rounded-full mx-auto mb-3" />
            <h2 className="text-[17px] font-bold text-[#0b1c30] mb-2">Câu trả lời bị lỗi?</h2>
            {[
              { type: 'wrong_info',         label: 'Thông tin sai' },
              { type: 'irrelevant',         label: 'Không liên quan đến câu hỏi' },
              { type: 'hard_to_understand', label: 'Khó hiểu, cần giải thích thêm' },
            ].map(({ type, label }) => (
              <button
                key={type}
                onClick={() => handleReport(showReport, type)}
                className="w-full px-4 py-4 text-[15px] text-[#0b1c30] text-left
                           bg-[#fdf8f5] border border-[#f0e0d0] rounded-2xl"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setShowReport(null)}
              className="py-3 text-[15px] text-[#7a6358] text-center"
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
