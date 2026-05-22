import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { authAPI } from '../services/api'
import { MessageCircle, Camera, Bell, ChevronRight, Leaf } from 'lucide-react'

const STEPS = [
  {
    Icon: MessageCircle,
    title: 'Hỏi bằng giọng nói',
    desc:  'Nói câu hỏi về sâu bệnh, Cò Con sẽ trả lời ngay cho bạn',
    color: '#16a34a', bg: '#f0fdf4',
  },
  {
    Icon: Camera,
    title: 'Chụp ảnh sâu bệnh',
    desc:  'Gửi ảnh lá bệnh, kỹ sư nông nghiệp sẽ tư vấn chi tiết',
    color: '#0ea5e9', bg: '#f0f9ff',
  },
  {
    Icon: Bell,
    title: 'Nhận cảnh báo sớm',
    desc:  'Thông báo dịch bệnh đúng loại cây bạn đang canh tác',
    color: '#f59e0b', bg: '#fffbeb',
  },
]

// Logo icon thay "C"
function AppLogo({ size = 72 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.27,
      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 8px 24px rgba(22,163,74,0.35)',
    }}>
      <Leaf size={size * 0.48} color="#fff" strokeWidth={1.5} />
    </div>
  )
}

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
        <div style={{ animation: 'scaleIn 0.4s cubic-bezier(0.32,0.72,0,1) both' }}>
          <AppLogo size={80} />
        </div>
        <div style={{ marginTop: 20, display: 'flex', gap: 6 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#16a34a', opacity: 0.3,
              animation: `blink 1.2s ease ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      </div>
    )
  }

  const current = STEPS[step]
  const isLast  = step === STEPS.length - 1

  return (
    <div style={s.page}>
      {/* Brand */}
      <div style={s.brand} className="fade-up">
        <AppLogo size={72} />
        <h1 style={s.appName}>Cò Con Dự Báo</h1>
        <p style={s.tagline}>Trợ lý nông nghiệp thông minh</p>
      </div>

      {/* Feature card */}
      <div key={step} style={s.card} className="scale-in">
        <div style={{ ...s.iconWrap, background: current.bg }}>
          <current.Icon size={36} color={current.color} strokeWidth={1.5} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>
          {current.title}
        </h2>
        <p style={{ fontSize: 15, color: '#64748b', margin: 0, lineHeight: 1.65, textAlign: 'center' }}>
          {current.desc}
        </p>
      </div>

      {/* Actions */}
      <div style={s.actions}>
        {/* Dot indicators */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => setStep(i)} style={{
              height: 6, borderRadius: 99,
              border: 'none', cursor: 'pointer', padding: 0,
              transition: 'all 0.35s cubic-bezier(0.32,0.72,0,1)',
              width: i === step ? 24 : 6,
              background: i === step ? '#16a34a' : '#e2e8f0',
            }} aria-label={`Trang ${i + 1}`} />
          ))}
        </div>

        {isLast ? (
          <button onClick={() => navigate('/login')} style={s.btnStart} className="fade-up">
            Bắt đầu nào <ChevronRight size={20} />
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

      <style>{`
        @keyframes blink { 0%,80%,100%{opacity:0.15} 40%{opacity:1} }
      `}</style>
    </div>
  )
}

const s = {
  loadPage: { height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: "'Noto Sans', sans-serif", gap: 0 },
  page:     { height: '100dvh', background: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 24px max(40px,env(safe-area-inset-bottom))', fontFamily: "'Noto Sans', sans-serif", boxSizing: 'border-box' },
  brand:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  actions:  { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' },
  appName:  { fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0, textAlign: 'center', letterSpacing: '-0.5px' },
  tagline:  { fontSize: 14, color: '#64748b', margin: 0, textAlign: 'center' },
  card:     { background: '#fff', borderRadius: 24, padding: '36px 28px', width: '100%', textAlign: 'center', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, boxSizing: 'border-box', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' },
  iconWrap: { width: 80, height: 80, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  btnStart: { padding: '16px 20px', fontSize: 16, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 14, cursor: 'pointer', minHeight: 52, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 12px rgba(22,163,74,0.3)' },
  btnSkip:  { padding: '16px 18px', fontSize: 14, background: 'transparent', color: '#94a3b8', border: '1.5px solid #e2e8f0', borderRadius: 14, cursor: 'pointer', minHeight: 52, whiteSpace: 'nowrap', fontWeight: 500 },
}
