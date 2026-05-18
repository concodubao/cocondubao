import { useState } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { authAPI } from '../services/api'
import { ChevronLeft } from 'lucide-react'

export default function Profile() {
  const navigate       = useNavigate()
  const [params]       = useSearchParams()
  const isOnboard      = params.get('onboard') === 'true'
  const { user, setUser } = useAuthStore()

  const isFarmer = user?.role === 'farmer'

  const [name,    setName]    = useState(user?.name    || '')
  const [village, setVillage] = useState(user?.village || '')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const profileComplete = user?.name && (!isFarmer || user?.crops?.length > 0)
  if (isOnboard && profileComplete) return <Navigate to="/home" replace />

  async function handleSave() {
    if (!name.trim()) return setError('Vui lòng nhập tên của bạn.')
    setError('')
    setLoading(true)
    try {
      const res = await authAPI.updateProfile({
        name:    name.trim(),
        village: village.trim(),
        crops:   isFarmer ? ['rice'] : [],
      })
      setUser(res.data.user)
      navigate('/home', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Không lưu được. Thử lại nhé.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        {!isOnboard && (
          <button onClick={() => navigate('/home')} style={s.back} aria-label="Quay lại">
            <ChevronLeft size={22} />
          </button>
        )}
        <h1 style={s.title}>{isOnboard ? 'Hoàn tất hồ sơ' : 'Hồ sơ cá nhân'}</h1>
      </header>

      <main style={s.main}>
        {isOnboard && (
          <div style={s.welcomeBox}>
            <div style={s.logoMark}>C</div>
            <p style={s.welcomeText}>Chào mừng đến với Cò Con! Cho mình biết thêm một chút nhé.</p>
          </div>
        )}

        <section style={s.section}>
          <label style={s.label} htmlFor="name">Tên của bạn *</label>
          <input
            id="name" type="text" autoComplete="name"
            placeholder="Ví dụ: Chú Hai, Anh Ba Lúa..."
            value={name} onChange={e => setName(e.target.value)}
            style={s.input} aria-required="true"
          />
        </section>

        <section style={s.section}>
          <label style={s.label} htmlFor="village">Ấp / Xã</label>
          <input
            id="village" type="text" autoComplete="address-level3"
            placeholder="Ví dụ: Ấp Trường Thọ, xã Trường Khánh"
            value={village} onChange={e => setVillage(e.target.value)}
            style={s.input}
          />
        </section>

        {error && <p style={s.error} role="alert">{error}</p>}

        <button onClick={handleSave} disabled={loading}
          style={{ ...s.btnSave, opacity: loading ? 0.7 : 1 }} aria-busy={loading}>
          {loading ? 'Đang lưu...' : isOnboard ? 'Bắt đầu dùng Cò Con →' : 'Lưu hồ sơ'}
        </button>

        <div style={s.infoBox}>
          <div style={s.infoRow}>
            <span style={s.infoLabel}>Số điện thoại</span>
            <span style={s.infoValue}>{user?.phone}</span>
          </div>
          <div style={s.infoRow}>
            <span style={s.infoLabel}>Vai trò</span>
            <span style={s.infoValue}>
              {user?.role === 'farmer' ? 'Nông dân' : user?.role === 'engineer' ? 'Kỹ sư nông nghiệp' : 'Quản trị viên'}
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}

const s = {
  page:        { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: '0 auto' },
  header:      { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 },
  back:        { background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: 4, display: 'flex' },
  title:       { fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 },
  main:        { flex: 1, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 },
  welcomeBox:  { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px', background: '#f0fdf4', borderRadius: 16, textAlign: 'center' },
  logoMark:    { width: 48, height: 48, borderRadius: 14, background: '#16a34a', color: '#fff', fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  welcomeText: { fontSize: 15, color: '#15803d', margin: 0, lineHeight: 1.6 },
  section:     { display: 'flex', flexDirection: 'column', gap: 6 },
  label:       { fontSize: 14, fontWeight: 600, color: '#0f172a', margin: 0 },
  input:       { padding: '12px 14px', fontSize: 16, borderRadius: 10, border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a', background: '#fff', boxSizing: 'border-box' },
  error:       { color: '#ef4444', fontSize: 14, background: '#fef2f2', padding: '10px 14px', borderRadius: 10, margin: 0 },
  btnSave:     { padding: '14px', fontSize: 17, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', minHeight: 52 },
  infoBox:     { background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 10 },
  infoRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel:   { fontSize: 13, color: '#94a3b8' },
  infoValue:   { fontSize: 14, fontWeight: 600, color: '#0f172a' },
}
