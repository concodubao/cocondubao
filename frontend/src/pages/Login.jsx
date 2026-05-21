import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { ChevronLeft, Wheat, Wrench, Shield } from 'lucide-react'

const ROLES = [
  { id: 'farmer',   label: 'Nông Dân',  Icon: Wheat,   desc: 'Hỏi Cò Con về sâu bệnh, thời vụ' },
  { id: 'engineer', label: 'Kỹ Sư',     Icon: Wrench,  desc: 'Trả lời câu hỏi, quản lý tri thức' },
  { id: 'admin',    label: 'Quản Trị',  Icon: Shield,  desc: 'Quản lý hệ thống, gửi thông báo' },
]

function StepRole({ onNext }) {
  return (
    <>
      {ROLES.map(r => (
        <button key={r.id} onClick={() => onNext(r.id)} style={s.roleCard}>
          <div style={s.roleIconWrap}><r.Icon size={22} color="#16a34a" strokeWidth={1.5} /></div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{r.label}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>{r.desc}</div>
          </div>
        </button>
      ))}
    </>
  )
}

function StepPhone({ onNext }) {
  const [phone,   setPhone]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleSend() {
    const trimmed = phone.trim()
    if (!trimmed) return setError('Vui lòng nhập số điện thoại.')
    const digits = trimmed.replace(/\D/g, '')
    if (digits.length < 9 || digits.length > 11) return setError('Số điện thoại không hợp lệ.')
    setError('')
    setLoading(true)
    try {
      const res = await authAPI.requestOTP(trimmed)
      onNext(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Không gửi được OTP. Thử lại nhé.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <label style={s.label} htmlFor="phone">Số điện thoại</label>
      <input id="phone" type="tel" inputMode="numeric" autoComplete="tel"
        placeholder="0901 234 567" value={phone}
        onChange={e => setPhone(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSend()}
        style={s.input} autoFocus />
      {error && <p style={s.error}>{error}</p>}
      <button onClick={handleSend} disabled={loading}
        style={{ ...s.btnPrimary, opacity: loading ? 0.7 : 1 }}>
        {loading ? 'Đang gửi...' : 'Nhận mã OTP'}
      </button>
    </>
  )
}

function StepOTP({ phone, role, devOtp, onResend }) {
  const [otp,       setOtp]       = useState(devOtp || '')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [countdown, setCountdown] = useState(60)
  const [resending, setResending] = useState(false)
  const { setUser, setToken } = useAuthStore()

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function handleVerify() {
    if (otp.length !== 6) return setError('OTP gồm 6 chữ số.')
    setError('')
    setLoading(true)
    try {
      const res = await authAPI.verifyOTP(phone, otp, role)
      const { token, user, isNewUser } = res.data
      setToken(token)
      setUser(user)
      window.location.href = isNewUser ? '/profile?onboard=true' : '/home'
    } catch (err) {
      setError(err.response?.data?.error || 'OTP không đúng. Thử lại nhé.')
      setLoading(false)
    }
  }

  async function handleResend() {
    setResending(true)
    setError('')
    try {
      const newDevOtp = await onResend()
      if (newDevOtp) setOtp(newDevOtp)
      setCountdown(60)
    } catch (err) {
      setError(err.response?.data?.error || 'Không gửi lại được. Thử lại sau.')
    } finally {
      setResending(false)
    }
  }

  return (
    <>
      <label style={s.label} htmlFor="otp">Mã 6 chữ số</label>
      <input id="otp" type="tel" inputMode="numeric" autoComplete="one-time-code"
        maxLength={6} placeholder="• • • • • •" value={otp}
        onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={e => e.key === 'Enter' && handleVerify()}
        style={{ ...s.input, textAlign: 'center', fontSize: 28, letterSpacing: 8 }}
        autoFocus />
      {devOtp && (
        <p style={{ fontSize: 13, color: '#16a34a', background: '#f0fdf4', padding: '8px 12px', borderRadius: 8, margin: 0 }}>
          [DEV] OTP: <strong>{devOtp}</strong>
        </p>
      )}
      <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, textAlign: 'center' }}>Mã hết hạn sau 10 phút</p>
      {error && <p style={s.error}>{error}</p>}
      <button onClick={handleVerify} disabled={loading || otp.length !== 6}
        style={{ ...s.btnPrimary, opacity: (loading || otp.length !== 6) ? 0.6 : 1 }}>
        {loading ? 'Đang xác nhận...' : 'Xác nhận'}
      </button>
      <div style={{ textAlign: 'center' }}>
        {countdown > 0 ? (
          <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>Gửi lại sau <strong>{countdown}s</strong></p>
        ) : (
          <button onClick={handleResend} disabled={resending}
            style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            {resending ? 'Đang gửi lại...' : 'Gửi lại OTP'}
          </button>
        )}
      </div>
    </>
  )
}

function StepEmailPassword({ role }) {
  const [mode,     setMode]     = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const { setUser, setToken } = useAuthStore()

  async function handleLogin() {
    if (!email || !password) return setError('Vui lòng nhập đầy đủ.')
    setError(''); setLoading(true)
    try {
      const res = await authAPI.loginEmail(email, password)
      const { token, user, isNewUser } = res.data
      setToken(token)
      setUser(user)
      window.location.href = isNewUser ? '/profile?onboard=true' : '/home'
    } catch (err) {
      setError(err.response?.data?.error || 'Đăng nhập thất bại.')
      setLoading(false)
    }
  }

  async function handleRegister() {
    if (!email || !password) return setError('Vui lòng nhập đầy đủ.')
    if (password.length < 8) return setError('Mật khẩu tối thiểu 8 ký tự.')
    setError(''); setLoading(true)
    try {
      const res = await authAPI.registerEmail(email, password, role)
      if (res.data.pending) {
        setSuccess('Tài khoản đã tạo! Vui lòng chờ admin phê duyệt.')
      } else {
        setSuccess('Đăng ký thành công! Đăng nhập để tiếp tục.')
      }
      setMode('login')
    } catch (err) {
      setError(err.response?.data?.error || 'Đăng ký thất bại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        {['login', 'register'].map(m => (
          <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: mode === m ? 700 : 400, background: mode === m ? '#f0fdf4' : 'transparent', color: mode === m ? '#16a34a' : '#94a3b8' }}>
            {m === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        ))}
      </div>

      <label style={s.label} htmlFor="email">Email</label>
      <input id="email" type="email" autoComplete="email"
        placeholder="email@example.com" value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleRegister())}
        style={s.input} autoFocus />

      <label style={s.label} htmlFor="password">Mật khẩu</label>
      <input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        placeholder={mode === 'login' ? '••••••••' : 'Tối thiểu 8 ký tự'}
        value={password} onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleRegister())}
        style={s.input} />

      {error   && <p style={s.error}>{error}</p>}
      {success && <p style={{ color: '#16a34a', fontSize: 14, background: '#f0fdf4', padding: '10px 14px', borderRadius: 10, margin: 0 }}>{success}</p>}

      <button onClick={mode === 'login' ? handleLogin : handleRegister}
        disabled={loading}
        style={{ ...s.btnPrimary, opacity: loading ? 0.7 : 1 }}>
        {loading ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
      </button>
    </>
  )
}

export default function Login() {
  const [step,           setStep]           = useState('role')
  const [role,           setRole]           = useState('farmer')
  const [phone,          setPhone]          = useState('')
  const [devOtp,         setDevOtp]         = useState('')
  const [isExistingUser, setIsExistingUser] = useState(false)

  const { token } = useAuthStore()
  if (token) return <Navigate to="/home" replace />

  const HERO_INFO = {
    role:  { title: 'Bạn Là Ai?',        sub: 'Chọn vai trò để tiếp tục' },
    phone: { title: 'Đăng Nhập',         sub: 'Nhập số điện thoại để nhận OTP' },
    otp:   { title: 'Nhập Mã OTP',       sub: `Đã gửi mã đến ${phone || '...'}` },
    email: { title: role === 'engineer' ? 'Kỹ Sư' : 'Quản Trị', sub: 'Đăng nhập hoặc tạo tài khoản' },
  }[step]

  function handleBack() {
    if (step === 'phone' || step === 'email') setStep('role')
    else if (step === 'otp') setStep(isExistingUser ? 'phone' : 'phone')
  }

  function handleRoleNext(r) {
    setRole(r)
    if (r === 'farmer') setStep('phone')
    else setStep('email')
  }

  function handlePhoneNext({ phone: p, devOtp: otp, isExistingUser: exists, existingRole }) {
    setPhone(p)
    setDevOtp(otp || '')
    setIsExistingUser(exists)
    setRole(exists ? (existingRole || 'farmer') : 'farmer')
    setStep('otp')
  }

  async function handleResend() {
    const res = await authAPI.requestOTP(phone)
    const newDevOtp = res.data.devOtp || ''
    setDevOtp(newDevOtp)
    return newDevOtp
  }

  return (
    <div style={s.page}>
      <div style={s.hero}>
        <div style={s.logoMark}>C</div>
        <h1 style={s.heroTitle}>{HERO_INFO.title}</h1>
        <p style={s.heroSub}>{HERO_INFO.sub}</p>
      </div>

      <div style={s.sheet}>
        {step !== 'role' && (
          <button onClick={handleBack} style={s.backBtn}>
            <ChevronLeft size={20} /> Quay lại
          </button>
        )}
        {step === 'role'  && <StepRole onNext={handleRoleNext} />}
        {step === 'phone' && <StepPhone onNext={handlePhoneNext} />}
        {step === 'otp'   && (
          <StepOTP phone={phone} role={role} devOtp={devOtp}
            isExistingUser={isExistingUser} onResend={handleResend} />
        )}
        {step === 'email' && <StepEmailPassword role={role} />}
      </div>
    </div>
  )
}

const s = {
  page:        { height: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: "'Noto Sans', sans-serif", background: '#16a34a', overflow: 'hidden' },
  hero:        { flex: '0 0 38%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '0 28px', paddingTop: 'env(safe-area-inset-top)' },
  logoMark:    { width: 76, height: 76, borderRadius: 22, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 34, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px rgba(255,255,255,0.25)' },
  heroTitle:   { fontSize: 26, fontWeight: 800, color: '#fff', margin: 0, textAlign: 'center' },
  heroSub:     { fontSize: 14, color: 'rgba(255,255,255,0.85)', margin: 0, textAlign: 'center', lineHeight: 1.5 },
  sheet:       { flex: 1, background: '#fff', borderRadius: '28px 28px 0 0', padding: '28px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingBottom: 'max(36px, env(safe-area-inset-bottom))' },
  backBtn:     { alignSelf: 'flex-start', background: 'none', border: 'none', color: '#16a34a', fontSize: 15, cursor: 'pointer', padding: '0 0 4px', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 },
  label:       { fontSize: 15, fontWeight: 600, color: '#0f172a' },
  input:       { width: '100%', padding: '14px 16px', fontSize: 18, borderRadius: 12, border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a', background: '#f8fafc', boxSizing: 'border-box' },
  btnPrimary:  { width: '100%', padding: '15px', fontSize: 17, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', minHeight: 54 },
  error:       { color: '#ef4444', fontSize: 14, background: '#fef2f2', padding: '10px 14px', borderRadius: 10, margin: 0 },
  roleCard:    { display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 16, cursor: 'pointer', width: '100%', textAlign: 'left', boxSizing: 'border-box' },
  roleIconWrap:{ width: 48, height: 48, borderRadius: 14, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
}
