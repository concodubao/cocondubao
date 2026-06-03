import { useState, useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuthStore } from '../stores/authStore'

// ─── Role cards data ────────────────────────────────────────
const ROLES = [
  { id: 'farmer',   label: 'Nông dân',      icon: 'agriculture', desc: 'Tôi cần tư vấn canh tác',                    iconBg: '#F0FDF4', iconColor: '#006b2c' },
  { id: 'engineer', label: 'Kỹ sư / Admin', icon: 'engineering', desc: 'Đăng nhập bằng email do admin cấp', iconBg: '#E0F2FE', iconColor: '#00628d' },
]

// ─── Step dots ──────────────────────────────────────────────
function StepDots({ step }) {
  const steps = ['role', 'phone', 'otp']
  const idx   = steps.indexOf(step)
  if (idx < 0) return null
  return (
    <div className="flex gap-1.5 items-center justify-center mb-2">
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
  const [selected, setSelected] = useState(null)

  return (
    <div className="flex flex-col gap-4 fade-up">
      {ROLES.map((r, i) => (
        <button
          key={r.id}
          onClick={() => { setSelected(r.id); onNext(r.id) }}
          className={`flex items-center p-4 rounded-[20px] border-2 shadow-sm transition-all active:scale-[0.98]
            ${selected === r.id ? 'border-[#006b2c] bg-[#F0FDF4] shadow-[0_8px_20px_rgba(0,107,44,0.1)] -translate-y-1' : 'border-transparent bg-white'}`}
          style={{ animationDelay: `${i * 0.07}s` }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
               style={{ background: r.iconBg }}>
            <span className="material-symbols-outlined text-[32px]" style={{ color: r.iconColor }}>{r.icon}</span>
          </div>
          <div className="ml-4 text-left flex-1">
            <div className="text-[20px] font-bold text-[#0b1c30]">{r.label}</div>
            <div className="text-sm text-[#3e4a3d] mt-0.5">{r.desc}</div>
          </div>
          <span className="material-symbols-outlined text-[#006b2c] ml-2 opacity-0 transition-opacity"
                style={{ opacity: selected === r.id ? 1 : 0 }}>
            check_circle
          </span>
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
    setError(''); setLoading(true)
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
    <div className="flex flex-col gap-4 fade-up">
      <div className="space-y-2">
        <label className="text-[18px] font-bold text-[#0b1c30]" htmlFor="phone">Số điện thoại</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#6e7b6c]">call</span>
          <input
            ref={inputRef} id="phone" type="tel" inputMode="numeric" autoComplete="tel"
            placeholder="Nhập số điện thoại của bà con"
            value={phone} onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            className="w-full h-[58px] pl-12 pr-4 bg-white border-2 border-[#bdcaba] rounded-2xl
                       text-[20px] font-bold placeholder:text-[#bdcaba] placeholder:font-normal
                       focus:border-[#006b2c] transition-colors"
          />
        </div>
      </div>
      {error && <ErrorBox msg={error} />}
      <button onClick={handleSend} disabled={loading}
        className="w-full h-[60px] rounded-full bg-[#006b2c] text-white text-[20px] font-bold
                   shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all
                   disabled:opacity-60 disabled:cursor-not-allowed">
        {loading
          ? <><Spinner /> Đang gửi...</>
          : <><span>Nhận mã OTP</span><span className="material-symbols-outlined">arrow_forward</span></>}
      </button>
    </div>
  )
}

// ─── OTP Boxes ──────────────────────────────────────────────
function OTPBoxes({ value, onChange }) {
  const refs = Array.from({ length: 6 }, () => useRef(null))
  const digits = value.split('')
  useEffect(() => { refs[0].current?.focus() }, [])

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
      if (digits[i]) { const n = digits.slice(); n[i] = ''; onChange(n.join('')) }
      else if (i > 0) refs[i - 1].current?.focus()
    } else if (e.key === 'ArrowLeft'  && i > 0) refs[i - 1].current?.focus()
    else if   (e.key === 'ArrowRight' && i < 5) refs[i + 1].current?.focus()
  }
  function handlePaste(e) {
    e.preventDefault()
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(p)
    refs[Math.min(p.length, 5)].current?.focus()
  }

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input key={i} ref={refs[i]} type="tel" inputMode="numeric" maxLength={1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          value={digits[i] || ''}
          onChange={e => handleInput(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          className={`w-11 h-14 text-center text-[22px] font-bold rounded-xl border-2 transition-all
            ${digits[i] ? 'border-[#006b2c] bg-[#F0FDF4] text-[#006b2c]' : 'border-[#bdcaba] bg-[#f8f9ff] text-[#0b1c30]'}`}
          style={{ caretColor: 'transparent', outline: 'none' }}
        />
      ))}
    </div>
  )
}

// ─── Step: OTP ────────────────────────────────────────────
function StepOTP({ phone, role, onResend }) {
  const [otp, setOtp]             = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [countdown, setCountdown] = useState(60)
  const [resending, setResending] = useState(false)
  const [success, setSuccess]     = useState(false)
  const { setUser, setToken }     = useAuthStore()

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function handleVerify() {
    if (otp.length !== 6) return setError('OTP gồm 6 chữ số.')
    setError(''); setLoading(true)
    try {
      const res = await authAPI.verifyOTP(phone, otp, role)
      const { token, user, isNewUser } = res.data
      setSuccess(true); setToken(token); setUser(user)
      setTimeout(() => { window.location.href = isNewUser ? '/profile?onboard=true' : '/home' }, 400)
    } catch (err) {
      setError(err.response?.data?.error || 'OTP không đúng. Thử lại nhé.')
      setLoading(false)
    }
  }

  async function handleResend() {
    setResending(true); setError('')
    try { await onResend(); setCountdown(60); setOtp('') }
    catch (err) { setError(err.response?.data?.error || 'Không gửi lại được.') }
    finally { setResending(false) }
  }

  return (
    <div className="flex flex-col gap-5 fade-up">
      <p className="text-center text-[#3e4a3d] text-[16px]">
        Mã đã gửi đến <strong className="text-[#0b1c30]">{phone}</strong>
      </p>
      <OTPBoxes value={otp} onChange={setOtp} />
      <p className="text-center text-sm text-[#6e7b6c]">Mã hết hạn sau 10 phút</p>
      {error && <ErrorBox msg={error} />}
      <button onClick={handleVerify} disabled={loading || otp.length !== 6 || success}
        className={`w-full h-[60px] rounded-full text-white text-[20px] font-bold
                   flex items-center justify-center gap-2 transition-all active:scale-95
                   disabled:opacity-60 disabled:cursor-not-allowed
                   ${success ? 'bg-[#15803d]' : 'bg-[#006b2c]'}`}>
        {success
          ? <><span className="material-symbols-outlined ms-fill">check_circle</span> Xác nhận thành công!</>
          : loading ? <><Spinner /> Đang xác nhận...</>
          : 'Xác nhận OTP'}
      </button>
      <div className="text-center">
        {countdown > 0
          ? <p className="text-sm text-[#6e7b6c]">Gửi lại sau <strong className="text-[#0b1c30]">{countdown}s</strong></p>
          : <button onClick={handleResend} disabled={resending}
              className="text-[#006b2c] text-[16px] font-bold py-2 px-4">
              {resending ? 'Đang gửi lại...' : 'Gửi lại OTP'}
            </button>}
      </div>
    </div>
  )
}

// ─── Step: Email/Password — login only (kỹ sư & admin) ──────────────────────
function StepEmailPassword() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const { setUser, setToken }   = useAuthStore()

  async function handleLogin() {
    if (!email || !password) return setError('Vui lòng nhập đầy đủ.')
    setError(''); setLoading(true)
    try {
      const res = await authAPI.loginEmail(email, password)
      const { token, user, isNewUser } = res.data
      setToken(token); setUser(user)
      window.location.href = isNewUser ? '/profile?onboard=true' : '/home'
    } catch (err) {
      setError(err.response?.data?.error || 'Đăng nhập thất bại.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 fade-up">
      {/* Info banner */}
      <div className="flex items-start gap-2.5 bg-[#fffbeb] border border-[#fde68a] rounded-2xl px-4 py-3">
        <span className="material-symbols-outlined text-[18px] text-[#92400e] mt-0.5 flex-shrink-0">info</span>
        <p className="text-[13px] text-[#78350f] m-0 leading-snug">
          Tài khoản kỹ sư do quản trị viên tạo. Nếu chưa có tài khoản, vui lòng liên hệ admin.
        </p>
      </div>
      <div className="space-y-1">
        <label className="text-[16px] font-bold text-[#0b1c30]" htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" placeholder="email@example.com"
          value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          className="w-full h-[54px] px-4 bg-white border-2 border-[#bdcaba] rounded-2xl text-[18px]" autoFocus />
      </div>
      <div className="space-y-1">
        <label className="text-[16px] font-bold text-[#0b1c30]" htmlFor="password">Mật khẩu</label>
        <input id="password" type="password" autoComplete="current-password" placeholder="••••••••"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          className="w-full h-[54px] px-4 bg-white border-2 border-[#bdcaba] rounded-2xl text-[18px]" />
      </div>
      {error && <ErrorBox msg={error} />}
      <button onClick={handleLogin} disabled={loading}
        className="w-full h-[60px] rounded-full bg-[#006b2c] text-white text-[20px] font-bold
                   flex items-center justify-center gap-2 shadow-lg active:scale-95
                   disabled:opacity-60 disabled:cursor-not-allowed transition-all">
        {loading
          ? <><Spinner /> Đang đăng nhập...</>
          : <><span>Đăng nhập</span><span className="material-symbols-outlined">arrow_forward</span></>}
      </button>
    </div>
  )
}

// ─── Shared helpers ─────────────────────────────────────────
function ErrorBox({ msg }) {
  return (
    <div className="flex items-start gap-2 bg-[#fef2f2] border-l-4 border-[#EF4444] px-4 py-3 rounded-xl text-[#b91c1c] text-[15px]">
      <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
      {msg}
    </div>
  )
}
function Spinner() {
  return <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
}

// ─── Main Login ────────────────────────────────────────────
export default function Login() {
  const [step,  setStep]  = useState('role')
  const [role,  setRole]  = useState('farmer')
  const [phone, setPhone] = useState('')
  const { token } = useAuthStore()
  if (token) return <Navigate to="/home" replace />

  const HERO = {
    role:  { title: 'Đăng nhập',       sub: 'Chào mừng bà con đến với Cò Con!' },
    phone: { title: 'Đăng nhập',       sub: 'Nhập số điện thoại để nhận OTP' },
    otp:   { title: 'Nhập mã OTP',     sub: `Đã gửi mã đến ${phone || '...'}` },
    email: { title: 'Kỹ Sư & Admin', sub: 'Đăng nhập bằng email được cấp' },
  }[step]

  function handleBack() {
    if      (step === 'phone' || step === 'email') setStep('role')
    else if (step === 'otp')                       setStep('phone')
  }

  function handleRoleNext(r) { setRole(r); setStep(r === 'farmer' ? 'phone' : 'email') }

  function handlePhoneNext({ phone: p, isExistingUser: exists, existingRole }) {
    setPhone(p)
    setRole(exists ? (existingRole || 'farmer') : 'farmer')
    setStep('otp')
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#006b2c] overflow-hidden max-w-[480px] mx-auto">
      {/* Hero */}
      <header className="flex-shrink-0 flex flex-col items-center gap-4 px-5 pb-8 fade-in"
              style={{ paddingTop: 'max(48px, env(safe-area-inset-top))' }}>
        {/* Mascot */}
        <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center
                        shadow-[0_0_0_2px_rgba(255,255,255,0.3)] backdrop-blur-sm">
          <span className="material-symbols-outlined text-[56px] text-white">eco</span>
        </div>
        <div className="text-center">
          <h1 className="text-[28px] font-extrabold text-white tracking-tight">{HERO.title}</h1>
          <p className="text-[16px] text-white/80 mt-1">{HERO.sub}</p>
        </div>
        {(step === 'phone' || step === 'otp') && <StepDots step={step} />}
      </header>

      {/* Sheet */}
      <div className="flex-1 bg-white rounded-t-[28px] px-5 pt-6 overflow-y-auto"
           style={{ paddingBottom: 'max(40px, env(safe-area-inset-bottom))' }}>
        {step !== 'role' && (
          <button onClick={handleBack}
            className="flex items-center gap-1 text-[#006b2c] font-bold text-[16px] mb-5">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Quay lại
          </button>
        )}
        {step === 'role'  && <StepRole  onNext={handleRoleNext} />}
        {step === 'phone' && <StepPhone onNext={handlePhoneNext} />}
        {step === 'otp'   && <StepOTP  phone={phone} role={role} onResend={() => authAPI.requestOTP(phone)} />}
        {step === 'email' && <StepEmailPassword />}

        <p className="text-center text-[#6e7b6c] text-[13px] mt-8">
          Bằng cách tiếp tục, bạn đồng ý với Điều khoản của Cò Con
        </p>
      </div>

      {/* Bottom ambient glow */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-32
                      bg-gradient-to-t from-[#006b2c]/10 to-transparent pointer-events-none -z-10" />
    </div>
  )
}
