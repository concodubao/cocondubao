import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { authAPI } from '../services/api'
import { MessageCircle, Camera, Bell, ChevronRight } from 'lucide-react'

const STEPS = [
  { Icon: MessageCircle, title: 'Hỏi bằng giọng nói', desc: 'Nói câu hỏi về sâu bệnh, Cò Con sẽ trả lời ngay' },
  { Icon: Camera,        title: 'Chụp ảnh sâu bệnh',  desc: 'Gửi ảnh lá bệnh, kỹ sư sẽ tư vấn cho bạn' },
  { Icon: Bell,          title: 'Nhận cảnh báo sớm',  desc: 'Thông báo dịch bệnh đúng loại cây bạn đang trồng' },
]

export default function Splash() {
  const navigate = useNavigate()
  const { token, user, setUser, logout } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [step,    setStep]    = useState(0)

  useEffect(() => {
    async function checkAuth() {
      if (!token) { setLoading(false); return }
      try {
        const res = await authAPI.me()
        setUser(res.data.user)
        navigate('/home', { replace: true })
      } catch (err) {
        if (err.response?.status === 401) { logout(); setLoading(false) }
        else navigate('/home', { replace: true })
      }
    }
    checkAuth()
  }, [])

  if (loading) {
    return (
      <div style={s.loadPage}>
        <div style={s.logoMark}>C</div>
        <p style={{ fontSize: 15, color: '#64748b', marginTop: 16 }}>Đang khởi động...</p>
      </div>
    )
  }

  const current = STEPS[step]
  const isLast  = step === STEPS.length - 1

  return (
    <div style={s.page}>
      <div style={s.content}>
        <div style={s.logoMark}>C</div>
        <h1 style={s.appName}>Cò Con Dự Báo</h1>
        <p style={s.tagline}>Trợ lý nông nghiệp thông minh</p>

        <div style={s.card}>
          <div style={s.iconWrap}>
            <current.Icon size={32} color="#16a34a" strokeWidth={1.5} />
          </div>
          <h2 style={s.stepTitle}>{current.title}</h2>
          <p style={s.stepDesc}>{current.desc}</p>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: 6, borderRadius: 3, transition: 'all 0.3s',
              width: i === step ? 24 : 6,
              background: i === step ? '#16a34a' : '#e2e8f0',
            }} />
          ))}
        </div>

        {isLast ? (
          <button onClick={() => navigate('/login')} style={s.btnStart}>
            Bắt đầu nào
            <ChevronRight size={20} />
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button onClick={() => navigate('/login')} style={s.btnSkip}>Bỏ qua</button>
            <button onClick={() => setStep(v => v + 1)} style={{ ...s.btnStart, flex: 1 }}>
              Tiếp theo <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  loadPage: { minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: "'Noto Sans', sans-serif" },
  page:     { minHeight: '100dvh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', fontFamily: "'Noto Sans', sans-serif" },
  content:  { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%', maxWidth: 380 },
  logoMark: { width: 64, height: 64, borderRadius: 18, background: '#16a34a', color: '#fff', fontSize: 28, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  appName:  { fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0, textAlign: 'center' },
  tagline:  { fontSize: 14, color: '#64748b', margin: '-8px 0 0', textAlign: 'center' },
  card:     { background: '#fff', borderRadius: 20, padding: '28px 24px', width: '100%', textAlign: 'center', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  iconWrap: { width: 64, height: 64, borderRadius: 16, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 },
  stepDesc:  { fontSize: 15, color: '#64748b', margin: 0, lineHeight: 1.6 },
  btnStart: { padding: '14px 20px', fontSize: 17, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 14, cursor: 'pointer', minHeight: 52, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnSkip:  { padding: '14px 18px', fontSize: 15, background: 'transparent', color: '#64748b', border: '1.5px solid #e2e8f0', borderRadius: 14, cursor: 'pointer', minHeight: 52, whiteSpace: 'nowrap' },
}
