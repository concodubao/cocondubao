import { useState, useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { ChevronLeft, Wheat, Wrench, Shield, CheckCircle2 } from 'lucide-react'

const ROLES = [
  { id: 'farmer',   label: 'Nông Dân',  Icon: Wheat,   desc: 'Hỏi Cò Con về sâu bệnh, thời vụ' },
  { id: 'engineer', label: 'Kỹ Sư',     Icon: Wrench,  desc: 'Trả lời câu hỏi, quản lý tri thức' },
  { id: 'admin',    label: 'Quản Trị',  Icon: Shield,  desc: 'Quản lý hệ thống, gửi thông báo' },
]

// ─── Step indicator ────────────────────────────────────────
function StepDots({ step }) {
  const steps = ['role', 'phone', 'otp']
  const idx   = steps.indexOf(step)
  if (idx < 0) return null
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
      {steps.map((_, i) => (
        <div key={i} style={{
          height: 5, borderRadius: 99,
          transition: 'all 0.35s cubic-bezier(0.32,0.72,0,1)',
          width: i === idx ? 20 : 5,
          background: i <= idx ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
        }} />
      ))}
    </div>
  )
}

// ─── Step: chọn role ───────────────────────────────────────
function StepRole({ onNext }) {
  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {ROLES.map((r, i) => (
        <button key={r.id} onClick={() => onNext(r.id)} style={{
          ...s.roleCard,
          animationDelay: `${i * 0.06}s`,
        }} className="fade-up">
          <div style={s.roleIconWrap}><r.Icon size={22} color="#16a34a" strokeWidth={1.5} /></div>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{r.label}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>{r.desc}</div>
          </div>
          <ChevronLeft size={16} color="#cbd5e1" style={{ transform: 'rotate(180deg)', flexShrink: 0 }} />
        </button>
      ))}
    </div>
  )
}

// ─── Step: số điện thoại ──────────────────────────────────
function StepPhone({ onNext }) {
  const [phone,   setPhone]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

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
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={s.label} htmlFor="phone">Số điện thoại</label>
        <input ref={inputRef} id="phone" type="tel" inputMode="numeric" autoComplete="tel"
          placeholder="0901 234 567" value={phone}
          onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          style={s.input} />
      </div>
      {error && <p style={s.error} role="alert">{error}</p>}
      <button onClick={handleSend} disabled={loading} style={{ ...s.btnPrimary, opacity: loading ? 0.7 : 1 }}>
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={s.spinner} /> Đang gửi...
          </span>
        ) : 'Nhận mã OTP →'}
      </button>
    </div>
  )
}

// ─── OTP 6-box input ──────────────────────────────────────
function OTPBoxes({ value, onChange }) {
  const r0 = useRef(null); const r1 = useRef(null); const r2 = useRef(null)
  const r3 = useRef(null); const r4 = useRef(null); const r5 = useRef(null)
  const refs = [r0, r1, r2, r3, r4, r5]
  const digits = value.split('')

  function handleInput(i, char) {
    const d = char.replace(/\D/g, '')
    if (!d) return
    const next = digits.slice()
    next[i] = d[0]
    onChange(next.join('').slice(0, 6))
    if (i < 5) refs[i + 1].current?.focus()
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = digits.slice()
        next[i] = ''
        onChange(next.join(''))
      } else if (i > 0) {
        refs[i - 1].current?.focus()
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs[i - 1].current?.focus()
    } else if (e.key === 'ArrowRight' && i < 5) {
      refs[i + 1].current?.focus()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    const focusIdx = Math.min(pasted.length, 5)
    refs[focusIdx].current?.focus()
  }

  useEffect(() => { refs[0].current?.focus() }, [])

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          value={digits[i] || ''}
          onChange={e => handleInput(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          style={{
            width: 44, height: 54,
            textAlign: 'center', fontSize: 22, fontWeight: 700,
            borderRadius: 12,
            border: digits[i] ? '2px solid #16a34a' : '1.5px solid #e2e8f0',
            background: digits[i] ? '#f0fdf4' : '#f8fafc',
            color: '#0f172a',
            outline: 'none',
            caretColor: 'transparent',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        />
      ))}
    </div>
  )
}

// ─── Step: OTP ────────────────────────────────────────────
function StepOTP({ phone, role, onResend }) {
  const [otp,       setOtp]       = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [countdown, setCountdown] = useState(60)
  const [resending, setResending] = useState(false)
  const [success,   setSuccess]   = useState(false)
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
      setSuccess(true)
      setToken(token)
      setUser(user)
      setTimeout(() => {
        window.location.href = isNewUser ? '/profile?onboard=true' : '/home'
      }, 400)
    } catch (err) {
      setError(err.response?.data?.error || 'OTP không đúng. Thử lại nhé.')
      setLoading(false)
    }
  }

  async function handleResend() {
    setResending(true)
    setError('')
    try {
      await onResend()
      setCountdown(60)
      setOtp('')
    } catch (err) {
      setError(err.response?.data?.error || 'Không gửi lại được. Thử lại sau.')
    } finally {
      setResending(false)
    }
  }

  const filled = otp.length === 6

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, textAlign: 'center' }}>
        Mã đã gửi đến <strong style={{ color: '#64748b' }}>{phone}</strong>
      </p>

      <OTPBoxes value={otp} onChange={setOtp} />

      <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, textAlign: 'center' }}>
        Mã hết hạn sau 10 phút
      </p>

      {error && <p style={s.error} role="alert">{error}</p>}

      <button onClick={handleVerify} disabled={loading || !filled || success}
        style={{
          ...s.btnPrimary,
          opacity: (!filled || loading || success) ? 0.6 : 1,
          background: success ? '#15803d' : '#16a34a',
        }}>
        {success ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <CheckCircle2 size={18} /> Xác nhận thành công!
          </span>
        ) : loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={s.spinner} /> Đang xác nhận...
          </span>
        ) : 'Xác nhận OTP'}
      </button>

      <div style={{ textAlign: 'center' }}>
        {countdown > 0 ? (
          <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>
            Gửi lại sau <strong style={{ color: '#64748b' }}>{countdown}s</strong>
          </p>
        ) : (
          <button onClick={handleResend} disabled={resending}
            style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: '8px 0' }}>
            {resending ? 'Đang gửi lại...' : 'Gửi lại OTP'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Step: Email / Password ───────────────────────────────
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
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Toggle login / register */}
      <div style={{ display: 'flex', gap: 4, background: '#f8fafc', padding: 4, borderRadius: 12, border: '1px solid #e2e8f0' }}>
        {['login', 'register'].map(m => (
          <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
            style={{
              flex: 1, padding: '9px', borderRadius: 9,
              border: 'none', cursor: 'pointer', fontSize: 14,
              fontWeight: mode === m ? 700 : 500,
              background: mode === m ? '#fff' : 'transparent',
              color: mode === m ? '#16a34a' : '#94a3b8',
              boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            {m === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={s.label} htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email"
          placeholder="email@example.com" value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleRegister())}
          style={s.input} autoFocus />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={s.label} htmlFor="password">Mật khẩu</label>
        <input id="password" type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          placeholder={mode === 'login' ? '••••••••' : 'Tối thiểu 8 ký tự'}
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleRegister())}
          style={s.input} />
      </div>

      {error   && <p style={s.error} role="alert">{error}</p>}
      {success && <p style={{ color: '#15803d', fontSize: 14, background: '#f0fdf4', padding: '10px 14px', borderRadius: 10, margin: 0 }}>{success}</p>}

      <button onClick={mode === 'login' ? handleLogin : handleRegister}
        disabled={loading}
        style={{ ...s.btnPrimary, opacity: loading ? 0.7 : 1 }}>
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={s.spinner} /> Đang xử lý...
          </span>
        ) : mode === 'login' ? 'Đăng nhập →' : 'Tạo tài khoản →'}
      </button>
    </div>
  )
}

// ─── Main Login ────────────────────────────────────────────
export default function Login() {
  const [step,           setStep]           = useState('role')
  const [role,           setRole]           = useState('farmer')
  const [phone,          setPhone]          = useState('')
  const [isExistingUser, setIsExistingUser] = useState(false)

  const { token } = useAuthStore()
  if (token) return <Navigate to="/home" replace />

  const HERO_INFO = {
    role:  { title: 'Xin chào!',           sub: 'Chọn vai trò của bạn để tiếp tục' },
    phone: { title: 'Đăng nhập',           sub: 'Nhập số điện thoại để nhận OTP' },
    otp:   { title: 'Nhập mã OTP',         sub: `Đã gửi mã đến ${phone || '...'}` },
    email: { title: role === 'engineer' ? 'Kỹ Sư' : 'Quản Trị', sub: 'Đăng nhập hoặc tạo tài khoản' },
  }[step]

  function handleBack() {
    if (step === 'phone' || step === 'email') setStep('role')
    else if (step === 'otp') setStep('phone')
  }

  function handleRoleNext(r) {
    setRole(r)
    setStep(r === 'farmer' ? 'phone' : 'email')
  }

  function handlePhoneNext({ phone: p, isExistingUser: exists, existingRole }) {
    setPhone(p)
    setIsExistingUser(exists)
    setRole(exists ? (existingRole || 'farmer') : 'farmer')
    setStep('otp')
  }

  async function handleResend() {
    await authAPI.requestOTP(phone)
  }

  return (
    <div style={s.page}>
      {/* Hero section */}
      <div style={s.hero}>
        <div style={s.logoMark}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
              fill="rgba(255,255,255,0.9)" />
            <circle cx="12" cy="9" r="2.5" fill="rgba(22,163,74,0.6)" />
          </svg>
        </div>
        <h1 style={s.heroTitle}>{HERO_INFO.title}</h1>
        <p style={s.heroSub}>{HERO_INFO.sub}</p>
        {(step === 'phone' || step === 'otp') && <StepDots step={step} />}
      </div>

      {/* Sheet */}
      <div style={s.sheet}>
        {step !== 'role' && (
          <button onClick={handleBack} style={s.backBtn}>
            <ChevronLeft size={18} strokeWidth={2.5} /> Quay lại
          </button>
        )}

        {step === 'role'  && <StepRole onNext={handleRoleNext} />}
        {step === 'phone' && <StepPhone onNext={handlePhoneNext} />}
        {step === 'otp'   && <StepOTP phone={phone} role={role} isExistingUser={isExistingUser} onResend={handleResend} />}
        {step === 'email' && <StepEmailPassword role={role} />}
      </div>
    </div>
  )
}

const s = {
  page:        { height: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: "'Noto Sans', sans-serif", background: '#16a34a', overflow: 'hidden' },
  hero:        { flex: '0 0 auto', minHeight: '36%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 28px 20px', paddingTop: 'max(32px, env(safe-area-inset-top))' },
  logoMark:    { width: 80, height: 80, borderRadius: 24, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px rgba(255,255,255,0.2), inset 0 1px 0 rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)' },
  heroTitle:   { fontSize: 26, fontWeight: 800, color: '#fff', margin: 0, textAlign: 'center', letterSpacing: '-0.5px' },
  heroSub:     { fontSize: 14, color: 'rgba(255,255,255,0.82)', margin: 0, textAlign: 'center', lineHeight: 1.55 },
  sheet:       { flex: 1, background: '#fff', borderRadius: '28px 28px 0 0', padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto', paddingBottom: 'max(40px, env(safe-area-inset-bottom))' },
  backBtn:     { alignSelf: 'flex-start', background: 'none', border: 'none', color: '#16a34a', fontSize: 14, cursor: 'pointer', padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 },
  label:       { fontSize: 14, fontWeight: 600, color: '#374151' },
  input:       { width: '100%', padding: '13px 16px', fontSize: 17, borderRadius: 12, border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a', background: '#f8fafc', boxSizing: 'border-box', fontFamily: "'Noto Sans', sans-serif" },
  btnPrimary:  { width: '100%', padding: '15px', fontSize: 16, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', minHeight: 52, fontFamily: "'Noto Sans', sans-serif', letterSpacing: '0.2px" },
  error:       { color: '#dc2626', fontSize: 13, background: '#fef2f2', padding: '10px 14px', borderRadius: 10, margin: 0, borderLeft: '3px solid #ef4444' },
  roleCard:    { display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 16, cursor: 'pointer', width: '100%', textAlign: 'left', boxSizing: 'border-box' },
  roleIconWrap:{ width: 48, height: 48, borderRadius: 14, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  spinner:     { width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite', flexShrink: 0 },
}
