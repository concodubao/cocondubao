import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSTT } from '../../hooks/useSTT'
import { ChevronLeft, Mic, Square, RefreshCw, Check } from 'lucide-react'

function WaveVisualizer({ volume, isListening, isProcessing }) {
  const BAR_COUNT = 20
  function barHeight(i) {
    if (!isListening && !isProcessing) return 4
    if (isProcessing) return 20
    const center   = BAR_COUNT / 2
    const distance = Math.abs(i - center) / center
    const base     = volume * (1 - distance * 0.6)
    const jitter   = Math.sin(Date.now() / 80 + i * 0.7) * 8
    return Math.max(4, Math.min(60, base * 0.6 + jitter))
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 72, padding: '0 16px' }}
      role="img" aria-label={isProcessing ? 'Đang xử lý' : isListening ? 'Đang nghe' : 'Chưa ghi âm'}>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div key={i} style={{
          width: isListening ? 4 : 3, height: barHeight(i), borderRadius: 99,
          background: isListening ? `rgba(22,163,74,${0.4 + (volume/100)*0.6})` : isProcessing ? '#86efac' : '#e2e8f0',
          transition: 'height 0.08s ease, background 0.2s',
          animation: isProcessing ? `wave-${i % 5} 0.8s ease-in-out infinite` : 'none',
          animationDelay: isProcessing ? `${i * 0.04}s` : '0s',
        }} />
      ))}
    </div>
  )
}

function MicButton({ isListening, isProcessing, onStart, onStop }) {
  const size = 128
  let bg, icon, label
  if (isProcessing) { bg = '#f59e0b'; icon = <Square size={48} color="#fff" />; label = 'Đang xử lý...' }
  else if (isListening) { bg = '#ef4444'; icon = <Square size={48} color="#fff" />; label = 'Nhấn để dừng' }
  else { bg = '#7a3b10'; icon = <Mic size={48} color="#fff" strokeWidth={1.5} />; label = 'Nhấn để nói' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <button onClick={isListening ? onStop : onStart} disabled={isProcessing}
        style={{
          width: size, height: size, borderRadius: '50%', background: bg, border: 'none',
          cursor: isProcessing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isListening ? '0 0 0 14px rgba(239,68,68,0.15), 0 0 0 28px rgba(239,68,68,0.07)' : '0 8px 28px rgba(22,163,74,0.32)',
          transition: 'all 0.25s', animation: isListening ? 'mic-pulse 1.5s ease-in-out infinite' : 'none',
          opacity: isProcessing ? 0.8 : 1,
        }}
        aria-label={label} aria-pressed={isListening}>
        {icon}
      </button>
      <p style={{ fontSize: 16, color: isListening ? '#ef4444' : '#64748b', margin: 0, fontWeight: isListening ? 600 : 400, transition: 'color 0.2s' }}>
        {label}
      </p>
    </div>
  )
}

function CountdownBar({ isListening, maxSeconds = 30 }) {
  const [seconds, setSeconds] = useState(maxSeconds)
  useEffect(() => {
    if (!isListening) { setSeconds(maxSeconds); return }
    const interval = setInterval(() => setSeconds(s => s <= 1 ? 0 : s - 1), 1000)
    return () => clearInterval(interval)
  }, [isListening, maxSeconds])
  if (!isListening) return null
  const pct   = (seconds / maxSeconds) * 100
  const color = seconds < 10 ? '#ef4444' : seconds < 20 ? '#f59e0b' : '#7a3b10'
  return (
    <div style={{ width: '100%', padding: '0 8px' }}>
      <div style={{ height: 4, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 1s linear, background 0.3s' }} />
      </div>
      <p style={{ textAlign: 'center', fontSize: 13, color, margin: '6px 0 0', fontWeight: 600 }}>{seconds}s</p>
    </div>
  )
}

export default function VoiceRecord() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const sessionId = location.state?.sessionId
  const { transcript, interimText, isListening, isProcessing, error, volume, startListening, stopListening, resetTranscript, mode } = useSTT()

  const displayText = transcript || interimText
  const hasResult   = !!transcript && !isListening && !isProcessing

  function handleConfirm() {
    if (!transcript.trim()) return
    navigate('/chat', { state: { sessionId, prefillText: transcript.trim() } })
  }

  function handleRetry() {
    resetTranscript()
    startListening()
  }

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes mic-pulse { 0%,100%{box-shadow:0 0 0 14px rgba(239,68,68,0.15),0 0 0 28px rgba(239,68,68,0.07)} 50%{box-shadow:0 0 0 20px rgba(239,68,68,0.20),0 0 0 36px rgba(239,68,68,0.10)} }
        @keyframes wave-0{0%,100%{height:8px}50%{height:40px}} @keyframes wave-1{0%,100%{height:12px}50%{height:52px}}
        @keyframes wave-2{0%,100%{height:16px}50%{height:60px}} @keyframes wave-3{0%,100%{height:10px}50%{height:44px}}
        @keyframes wave-4{0%,100%{height:6px}50%{height:32px}}
      `}</style>

      <header style={styles.header}>
        <button onClick={() => navigate('/chat', { state: { sessionId } })} style={styles.iconBtn} aria-label="Quay lại chat">
          <ChevronLeft size={22} />
        </button>
        <span style={styles.headerTitle}>Ghi âm câu hỏi</span>
        <span style={styles.modeTag}>{mode === 'webspeech' ? 'Web Speech' : 'STT'}</span>
      </header>

      <main style={styles.main}>
        {/* Vùng trên — hiển thị text nhận dạng */}
        <div style={styles.displayArea}>
          <div style={{
            ...styles.textBox,
            borderColor: isListening ? '#f5d5b0' : hasResult ? '#7a3b10' : '#e2e8f0',
            background:  hasResult ? '#fdf6f0' : '#fdf8f5',
          }} role="region" aria-label="Text nhận dạng" aria-live="polite">
            {!displayText && !isListening && !isProcessing && (
              <p style={styles.placeholder}>Nhấn nút micro bên dưới và nói câu hỏi của bạn...</p>
            )}
            {displayText && (
              <p style={styles.transcriptText}>
                {transcript && <span style={{ color: '#0f172a' }}>{transcript}</span>}
                {interimText && <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{transcript ? ' ' : ''}{interimText}</span>}
              </p>
            )}
            {isProcessing && <p style={styles.processingText} aria-live="assertive">Đang nhận dạng giọng nói...</p>}
          </div>

          {error && (
            <div style={styles.errorBox} role="alert"><span>{error}</span></div>
          )}

          {mode === 'mediarecorder' && !isListening && !transcript && !error && (
            <div style={styles.infoBox}>
              <span style={{ fontSize: 13, color: '#1d4ed8', lineHeight: 1.5 }}>
                Trên iPhone: nhấn mic → nói → nhấn dừng. App sẽ gửi giọng nói lên server để nhận dạng.
              </span>
            </div>
          )}
        </div>

        {/* Vùng dưới — điều khiển mic, thumb-friendly */}
        <div style={styles.micArea}>
          <WaveVisualizer volume={volume} isListening={isListening} isProcessing={isProcessing} />
          <CountdownBar isListening={isListening} />
          <MicButton isListening={isListening} isProcessing={isProcessing} onStart={startListening} onStop={stopListening} />

          {hasResult && (
            <div style={styles.actionRow}>
              <button onClick={handleRetry}   style={styles.btnRetry}   aria-label="Ghi lại">
                <RefreshCw size={16} strokeWidth={2} /> Ghi lại
              </button>
              <button onClick={handleConfirm} style={styles.btnConfirm} aria-label="Xác nhận">
                <Check size={18} strokeWidth={2.5} /> Xác nhận
              </button>
            </div>
          )}

          {!isListening && !isProcessing && !hasResult && !error && (
            <p style={styles.hint}>Nói rõ ràng, gần micro. Tự động dừng sau 30 giây.</p>
          )}
        </div>
      </main>
    </div>
  )
}

const styles = {
  page:           { height: '100dvh', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: '0 auto' },
  header:         { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 },
  iconBtn:        { width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  headerTitle:    { flex: 1, fontSize: 17, fontWeight: 700, color: '#0f172a' },
  modeTag:        { fontSize: 10, color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 },
  main:           { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px 20px 0' },
  displayArea:    { display: 'flex', flexDirection: 'column', gap: 12 },
  micArea:        { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingBottom: 'max(36px, env(safe-area-inset-bottom))' },
  textBox:        { width: '100%', minHeight: 130, border: '2px solid', borderRadius: 16, padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.3s, background 0.3s', boxSizing: 'border-box' },
  placeholder:    { fontSize: 15, color: '#94a3b8', textAlign: 'center', margin: 0, lineHeight: 1.6 },
  transcriptText: { fontSize: 18, lineHeight: 1.7, margin: 0, wordBreak: 'break-word', textAlign: 'left' },
  processingText: { fontSize: 15, color: '#f59e0b', margin: 0, fontStyle: 'italic' },
  errorBox:       { width: '100%', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', fontSize: 15, color: '#ef4444', lineHeight: 1.5 },
  infoBox:        { width: '100%', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 16px' },
  actionRow:      { display: 'flex', gap: 10, width: '100%' },
  btnRetry:       { flex: 1, padding: '14px', fontSize: 16, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, cursor: 'pointer', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnConfirm:     { flex: 2, padding: '14px', fontSize: 17, background: '#7a3b10', color: '#fff', border: 'none', borderRadius: 14, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  hint:           { fontSize: 14, color: '#94a3b8', textAlign: 'center', margin: 0, lineHeight: 1.6 },
}
