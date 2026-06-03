import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { chatAPI } from '../../services/api'
import { ChevronLeft, Camera, X } from 'lucide-react'

export default function ImageUpload() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const fileRef  = useRef()

  const [preview,  setPreview]  = useState(null)
  const [file,     setFile]     = useState(null)
  const [text,     setText]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError('')
  }

  async function handleSend() {
    if (!file) return setError('Vui lòng chọn ảnh trước.')
    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('image',    file)
      formData.append('text',     text.trim() || 'Cây bị bệnh gì?')
      formData.append('userId',   user.id)
      formData.append('cropType', user.crops?.[0] || '')
      const res = await chatAPI.askWithImage(formData)
      const d   = res.data
      if (d.needEngineer) navigate('/chat/waiting', { state: { sessionId: d.sessionId, messageId: d.messageId } })
      else navigate('/chat', { state: { sessionId: d.sessionId, newAnswer: d.answer } })
    } catch (err) {
      setError(err.response?.data?.error
        || (err.code === 'ECONNABORTED'
          ? 'Xử lý ảnh hơi lâu, thử lại sau chút nhé.'
          : 'Gửi ảnh thất bại. Kiểm tra mạng và thử lại.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.iconBtn} aria-label="Quay lại">
          <ChevronLeft size={22} />
        </button>
        <span style={styles.headerTitle}>Gửi ảnh sâu bệnh</span>
      </header>

      <main style={styles.main}>
        <input ref={fileRef} type="file" accept="image/*" capture="environment"
          onChange={handleFile} style={{ display: 'none' }} aria-label="Chọn ảnh" />

        {!preview ? (
          <div style={styles.pickArea} onClick={() => fileRef.current?.click()} role="button" tabIndex={0}
            aria-label="Nhấn để chọn ảnh">
            <div style={styles.pickIconWrap}>
              <Camera size={40} color="#7a3b10" strokeWidth={1.5} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ ...styles.pickText, fontWeight: 600, color: '#5a2a0a', marginBottom: 4 }}>Nhấn để chụp ảnh</p>
              <p style={{ ...styles.pickText, fontSize: 14, color: '#94a3b8' }}>hoặc chọn từ thư viện ảnh</p>
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', flex: 1, minHeight: 200 }}>
            <img src={preview} alt="Ảnh sâu bệnh đã chọn" style={{ ...styles.preview, height: '100%' }} />
            <button onClick={() => { setPreview(null); setFile(null) }} style={styles.removeBtn} aria-label="Xóa ảnh">
              <X size={18} color="#fff" />
            </button>
            <button onClick={() => fileRef.current?.click()} style={styles.retakeBtn}>Chụp lại</button>
          </div>
        )}

        <label style={styles.label}>Mô tả thêm (không bắt buộc)</label>
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          placeholder="Ví dụ: Lúa bị đốm nâu trên lá, xuất hiện từ 3 ngày nay..."
          style={styles.textarea} rows={3} aria-label="Mô tả thêm"
        />

        {error && <p style={styles.error} role="alert">{error}</p>}

        <button onClick={handleSend} disabled={!file || loading}
          style={{ ...styles.btnSend, opacity: (!file || loading) ? 0.5 : 1 }} aria-busy={loading}>
          {loading ? 'Đang gửi...' : 'Gửi cho Cò Con'}
        </button>
      </main>
    </div>
  )
}

const styles = {
  page:        { height: '100dvh', display: 'flex', flexDirection: 'column', background: '#fdf8f5', fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: '0 auto' },
  header:      { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#fff', borderBottom: '1px solid #e2e8f0' },
  iconBtn:     { width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  headerTitle: { fontSize: 17, fontWeight: 700, color: '#0f172a' },
  main:        { flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 'max(24px, env(safe-area-inset-bottom))' },
  pickArea:    { border: '2px dashed #f5d5b0', borderRadius: 20, padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, cursor: 'pointer', background: '#fdf6f0', flex: 1, minHeight: 200 },
  pickIconWrap:{ width: 80, height: 80, borderRadius: 22, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #f5d5b0', boxShadow: '0 2px 12px rgba(22,163,74,0.10)' },
  pickText:    { fontSize: 16, color: '#64748b', textAlign: 'center', margin: 0, lineHeight: 1.6 },
  preview:     { width: '100%', borderRadius: 16, objectFit: 'cover', flex: 1, minHeight: 200, maxHeight: 360, border: '1px solid #e2e8f0' },
  removeBtn:   { position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  retakeBtn:   { position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: 10, padding: '7px 14px', fontSize: 14, cursor: 'pointer', fontWeight: 600 },
  label:       { fontSize: 15, fontWeight: 600, color: '#0f172a' },
  textarea:    { width: '100%', padding: '13px 14px', fontSize: 16, borderRadius: 12, border: '1.5px solid #e2e8f0', resize: 'none', outline: 'none', color: '#0f172a', background: '#fff', lineHeight: 1.6, textAlign: 'left', boxSizing: 'border-box' },
  error:       { color: '#ef4444', fontSize: 14, background: '#fef2f2', padding: '10px 14px', borderRadius: 10, margin: 0 },
  btnSend:     { padding: '15px', fontSize: 18, fontWeight: 700, background: '#7a3b10', color: '#fff', border: 'none', borderRadius: 14, cursor: 'pointer', minHeight: 54 },
}
