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
    } catch {
      setError('Gửi ảnh thất bại. Kiểm tra mạng và thử lại.')
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
          <div style={styles.pickArea} onClick={() => fileRef.current?.click()} role="button" tabIndex={0}>
            <div style={styles.pickIconWrap}>
              <Camera size={36} color="#16a34a" strokeWidth={1.5} />
            </div>
            <p style={styles.pickText}>Nhấn để chụp ảnh hoặc chọn từ thư viện</p>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <img src={preview} alt="Ảnh sâu bệnh đã chọn" style={styles.preview} />
            <button onClick={() => { setPreview(null); setFile(null) }} style={styles.removeBtn} aria-label="Xóa ảnh">
              <X size={16} color="#fff" />
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
  page:        { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: '0 auto' },
  header:      { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0' },
  iconBtn:     { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  headerTitle: { fontSize: 17, fontWeight: 700, color: '#0f172a' },
  main:        { flex: 1, padding: '20px 16px', paddingBottom: 'max(32px, calc(32px + env(safe-area-inset-bottom)))', display: 'flex', flexDirection: 'column', gap: 14 },
  pickArea:    { border: '2px dashed #bbf7d0', borderRadius: 16, padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, cursor: 'pointer', background: '#f0fdf4' },
  pickIconWrap:{ width: 72, height: 72, borderRadius: 20, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #bbf7d0' },
  pickText:    { fontSize: 15, color: '#64748b', textAlign: 'center', margin: 0, lineHeight: 1.5 },
  preview:     { width: '100%', borderRadius: 14, objectFit: 'cover', maxHeight: 280, border: '1px solid #e2e8f0' },
  removeBtn:   { position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  retakeBtn:   { position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 13, cursor: 'pointer' },
  label:       { fontSize: 15, fontWeight: 600, color: '#0f172a' },
  textarea:    { width: '100%', padding: '12px 14px', fontSize: 16, borderRadius: 10, border: '1.5px solid #e2e8f0', resize: 'none', outline: 'none', color: '#0f172a', background: '#fff', lineHeight: 1.6, textAlign: 'left', boxSizing: 'border-box' },
  error:       { color: '#ef4444', fontSize: 14, background: '#fef2f2', padding: '8px 12px', borderRadius: 8, margin: 0 },
  btnSend:     { padding: '14px', fontSize: 18, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', minHeight: 52 },
}
