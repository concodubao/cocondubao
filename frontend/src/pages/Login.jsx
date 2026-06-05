import { useState, useEffect, useRef } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuthStore } from '../stores/authStore'

// ─── Role cards ─────────────────────────────────────────────
const ROLES = [
  { id: 'farmer',   label: 'Nông dân',      icon: 'agriculture', desc: 'Tôi cần tư vấn canh tác',          iconBg: '#fdf6f0', iconColor: '#4B230A' },
  { id: 'engineer', label: 'Kỹ sư / Admin', icon: 'engineering', desc: 'Đăng nhập bằng email do admin cấp', iconBg: '#E0F2FE', iconColor: '#00628d' },
]

function StepRole({ onNext }) {
  const [selected, setSelected] = useState(null)
  return (
    <div className="flex flex-col gap-4 fade-up">
      {ROLES.map((r, i) => (
        <button
          key={r.id}
          onClick={() => { setSelected(r.id); onNext(r.id) }}
          className={`flex items-center p-4 rounded-[20px] border-2 shadow-sm transition-all active:scale-[0.98]
            ${selected === r.id ? 'border-[#4B230A] bg-[#fdf6f0] -translate-y-1' : 'border-transparent bg-white'}`}
          style={{ animationDelay: `${i * 0.07}s` }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: r.iconBg }}>
            <span className="material-symbols-outlined text-[32px]" style={{ color: r.iconColor }}>{r.icon}</span>
          </div>
          <div className="ml-4 text-left flex-1">
            <div className="text-[20px] font-bold text-[#0b1c30]">{r.label}</div>
            <div className="text-sm text-[#4a3328] mt-0.5">{r.desc}</div>
          </div>
          <span className="material-symbols-outlined text-[#4B230A] ml-2 transition-opacity"
                style={{ opacity: selected === r.id ? 1 : 0 }}>chevron_right</span>
        </button>
      ))}
    </div>
  )
}

// ─── Ô nhập 6 chữ số (dùng cho cả PIN lẫn OTP) ──────────────
function DigitBoxes({ value, onChange, autoFocus = true }) {
  const refs = Array.from({ length: 6 }, () => useRef(null))
  const digits = value.split('')
  useEffect(() => { if (autoFocus) refs[0].current?.focus() }, [])

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
            ${digits[i] ? 'border-[#4B230A] bg-[#fdf6f0] text-[#4B230A]' : 'border-[#d4b8a8] bg-[#fdf8f5] text-[#0b1c30]'}`}
          style={{ caretColor: 'transparent', outline: 'none' }}
        />
      ))}
    </div>
  )
}

const PRIMARY_BTN =
  'w-full h-[60px] rounded-full bg-[#4B230A] text-white text-[20px] font-bold ' +
  'flex items-center justify-center gap-2 shadow-lg active:scale-95 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed transition-all'

// ─── Nông dân: SĐT + PIN (Đăng nhập / Đăng ký) ──────────────
function StepPhonePin({ onForgot }) {
  const [mode,     setMode]     = useState('login') // 'login' | 'register'
  const [phone,    setPhone]    = useState('')
  const [pin,      setPin]      = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const { setUser, setToken }   = useAuthStore()
  const phoneRef = useRef(null)
  useEffect(() => { phoneRef.current?.focus() }, [])

  async function submit() {
    const p = phone.trim()
    if (!p)              return setError('Vui lòng nhập số điện thoại.')
    if (pin.length !== 6) return setError('Mã PIN gồm 6 chữ số.')
    setError(''); setLoading(true)
    try {
      const res = mode === 'register'
        ? await authAPI.registerPhone(p, pin)
        : await authAPI.loginPhone(p, pin)
      const { token, user, isNewUser } = res.data
      setToken(token); setUser(user)
      window.location.href = isNewUser ? '/profile?onboard=true' : '/home'
    } catch (err) {
      setError(err.response?.data?.error || 'Không thực hiện được. Thử lại nhé.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 fade-up">
      {/* Tabs Đăng nhập / Đăng ký */}
      <div className="flex bg-[#fdf8f5] border border-[#f0e0d0] rounded-full p-1">
        {[['login', 'Đăng nhập'], ['register', 'Đăng ký']].map(([m, label]) => (
          <button key={m} onClick={() => { setMode(m); setError('') }}
            className="flex-1 h-10 rounded-full text-[15px] font-bold transition-all"
            style={{ background: mode === m ? '#4B230A' : 'transparent', color: mode === m ? '#fff' : '#7a6358' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-[16px] font-bold text-[#0b1c30]" htmlFor="pp-phone">Số điện thoại</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#7a6358]">call</span>
          <input ref={phoneRef} id="pp-phone" type="tel" inputMode="numeric" autoComplete="tel"
            placeholder="Nhập số điện thoại"
            value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full h-[54px] pl-12 pr-4 bg-white border-2 border-[#d4b8a8] rounded-2xl
                       text-[18px] font-bold placeholder:font-normal focus:border-[#4B230A] transition-colors" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[16px] font-bold text-[#0b1c30]">
          {mode === 'register' ? 'Tạo mã PIN (6 số)' : 'Mã PIN (6 số)'}
        </label>
        <DigitBoxes value={pin} onChange={setPin} autoFocus={false} />
        {mode === 'register' && (
          <p className="text-[12.5px] text-[#7a6358] text-center">Nhớ kỹ mã PIN này để đăng nhập lần sau nhé.</p>
        )}
      </div>

      {error && <ErrorBox msg={error} />}

      <button onClick={submit} disabled={loading} className={PRIMARY_BTN}>
        {loading
          ? <><Spinner /> Đang xử lý...</>
          : <>{mode === 'register' ? 'Đăng ký' : 'Đăng nhập'}<span className="material-symbols-outlined">arrow_forward</span></>}
      </button>

      <button type="button" onClick={onForgot} className="text-center text-[14px] text-[#4B230A] font-semibold py-1">
        Quên mã PIN?
      </button>
    </div>
  )
}

// ─── Quên mã PIN: SĐT → OTP → PIN mới ───────────────────────
function ForgotPin() {
  const [sub,     setSub]     = useState('phone') // 'phone' | 'otp' | 'newpin'
  const [phone,   setPhone]   = useState('')
  const [role,    setRole]    = useState('farmer')
  const [otp,     setOtp]     = useState('')
  const [pin,     setPin]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const { setUser, setToken } = useAuthStore()

  async function sendOtp() {
    if (!phone.trim()) return setError('Vui lòng nhập số điện thoại.')
    setError(''); setLoading(true)
    try {
      const res = await authAPI.requestOTP(phone.trim())
      setRole(res.data.existingRole || 'farmer')
      setSub('otp')
    } catch (err) { setError(err.response?.data?.error || 'Không gửi được OTP. Thử lại nhé.') }
    finally { setLoading(false) }
  }
  async function verifyOtp() {
    if (otp.length !== 6) return setError('OTP gồm 6 chữ số.')
    setError(''); setLoading(true)
    try {
      const res = await authAPI.verifyOTP(phone.trim(), otp, role)
      setToken(res.data.token); setUser(res.data.user)
      setSub('newpin')
    } catch (err) { setError(err.response?.data?.error || 'OTP không đúng. Thử lại nhé.'); setLoading(false) }
  }
  async function saveNewPin() {
    if (pin.length !== 6) return setError('Mã PIN gồm 6 chữ số.')
    setError(''); setLoading(true)
    try {
      await authAPI.resetPin(pin)
      window.location.href = '/home'
    } catch (err) { setError(err.response?.data?.error || 'Không đặt được mã PIN.'); setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-4 fade-up">
      {sub === 'phone' && (
        <>
          <p className="text-[15px] text-[#4a3328] leading-relaxed">
            Nhập số điện thoại đã đăng ký để nhận mã OTP đặt lại mã PIN.
          </p>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#7a6358]">call</span>
            <input type="tel" inputMode="numeric" autoFocus placeholder="Số điện thoại"
              value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full h-[54px] pl-12 pr-4 bg-white border-2 border-[#d4b8a8] rounded-2xl text-[18px] font-bold" />
          </div>
          {error && <ErrorBox msg={error} />}
          <button onClick={sendOtp} disabled={loading} className={PRIMARY_BTN}>
            {loading ? <><Spinner /> Đang gửi...</> : 'Nhận mã OTP'}
          </button>
        </>
      )}

      {sub === 'otp' && (
        <>
          <p className="text-center text-[15px] text-[#4a3328]">
            Mã đã gửi đến <strong className="text-[#0b1c30]">{phone}</strong>
          </p>
          <DigitBoxes value={otp} onChange={setOtp} />
          {error && <ErrorBox msg={error} />}
          <button onClick={verifyOtp} disabled={loading || otp.length !== 6} className={PRIMARY_BTN}>
            {loading ? <><Spinner /> Đang xác nhận...</> : 'Xác nhận OTP'}
          </button>
        </>
      )}

      {sub === 'newpin' && (
        <>
          <p className="text-[15px] text-[#4a3328]">Đặt mã PIN mới (6 số) để đăng nhập lần sau.</p>
          <DigitBoxes value={pin} onChange={setPin} />
          {error && <ErrorBox msg={error} />}
          <button onClick={saveNewPin} disabled={loading || pin.length !== 6} className={PRIMARY_BTN}>
            {loading ? <><Spinner /> Đang lưu...</> : 'Lưu mã PIN'}
          </button>
        </>
      )}
    </div>
  )
}

// ─── Email/Password — login (kỹ sư & admin) ─────────────────
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
      <div className="flex items-start gap-2.5 bg-[#fff8e8] border border-[#fde68a] rounded-2xl px-4 py-3">
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
          className="w-full h-[54px] px-4 bg-white border-2 border-[#d4b8a8] rounded-2xl text-[18px]" autoFocus />
      </div>
      <div className="space-y-1">
        <label className="text-[16px] font-bold text-[#0b1c30]" htmlFor="password">Mật khẩu</label>
        <input id="password" type="password" autoComplete="current-password" placeholder="••••••••"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          className="w-full h-[54px] px-4 bg-white border-2 border-[#d4b8a8] rounded-2xl text-[18px]" />
      </div>
      {error && <ErrorBox msg={error} />}
      <button onClick={handleLogin} disabled={loading} className={PRIMARY_BTN}>
        {loading ? <><Spinner /> Đang đăng nhập...</> : <><span>Đăng nhập</span><span className="material-symbols-outlined">arrow_forward</span></>}
      </button>
    </div>
  )
}

// ─── Shared ─────────────────────────────────────────────────
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

// ─── Main ───────────────────────────────────────────────────
export default function Login() {
  const [step, setStep] = useState('role') // 'role' | 'phone-pin' | 'email' | 'forgot'
  const { token } = useAuthStore()
  if (token) return <Navigate to="/home" replace />

  const HERO = {
    role:         { title: 'Cò Con Dự Báo', sub: 'Trợ lý nông nghiệp của bà con' },
    'phone-pin':  { title: 'Nông dân',       sub: 'Đăng nhập hoặc đăng ký bằng số điện thoại' },
    email:        { title: 'Kỹ sư & Admin',  sub: 'Đăng nhập bằng email được cấp' },
    forgot:       { title: 'Quên mã PIN',    sub: 'Lấy lại mã PIN qua OTP' },
  }[step]

  function handleBack() {
    setStep(step === 'forgot' ? 'phone-pin' : 'role')
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#4B230A] overflow-hidden max-w-[480px] mx-auto">
      <header className="flex-shrink-0 flex flex-col items-center gap-4 px-5 pb-8 fade-in"
              style={{ paddingTop: 'max(48px, env(safe-area-inset-top))' }}>
        <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-[0_0_0_2px_rgba(255,255,255,0.3)]">
          <img src="/cocon-icon-bg.png" alt="Cò Con" className="w-20 h-20 object-contain" />
        </div>
        <div className="text-center">
          <h1 className="text-[28px] font-extrabold text-white tracking-tight">{HERO.title}</h1>
          <p className="text-[16px] text-white/80 mt-1">{HERO.sub}</p>
        </div>
      </header>

      <div className="flex-1 bg-white rounded-t-[28px] px-5 pt-6 overflow-y-auto"
           style={{ paddingBottom: 'max(40px, env(safe-area-inset-bottom))' }}>
        {step !== 'role' && (
          <button onClick={handleBack} className="flex items-center gap-1 text-[#4B230A] font-bold text-[16px] mb-5">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Quay lại
          </button>
        )}

        {step === 'role'      && <StepRole onNext={r => setStep(r === 'farmer' ? 'phone-pin' : 'email')} />}
        {step === 'phone-pin' && <StepPhonePin onForgot={() => setStep('forgot')} />}
        {step === 'email'     && <StepEmailPassword />}
        {step === 'forgot'    && <ForgotPin />}

        <p className="text-center text-[#7a6358] text-[13px] mt-8">
          Bằng cách tiếp tục, bạn đồng ý với{' '}
          <Link to="/policies" className="text-[#4B230A] font-semibold underline">Điều khoản &amp; Chính sách</Link>
        </p>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-32
                      bg-gradient-to-t from-[#4B230A]/10 to-transparent pointer-events-none -z-10" />
    </div>
  )
}
