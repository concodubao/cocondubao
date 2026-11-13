import { useState, useEffect, useRef } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import PasswordInput from '../components/PasswordInput'
import { clearApiCache } from '../utils/clearSession'

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

// ─── Ô nhập 6 chữ số (dùng cho cả PIN lẫn OTP). mask=true → che như mật khẩu ──
function DigitBoxes({ value, onChange, autoFocus = true, mask = false, onEnter }) {
  // 6 ref tường minh — không gọi useRef trong vòng lặp (rules-of-hooks)
  const r0 = useRef(null), r1 = useRef(null), r2 = useRef(null)
  const r3 = useRef(null), r4 = useRef(null), r5 = useRef(null)
  const refs = [r0, r1, r2, r3, r4, r5]
  const digits = value.split('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (e.key === 'Enter') onEnter?.()
    else if (e.key === 'Backspace') {
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
        <input key={i} ref={refs[i]} type={mask ? 'password' : 'tel'} inputMode="numeric" maxLength={1}
          autoComplete={mask ? 'off' : (i === 0 ? 'one-time-code' : 'off')}
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

// Trang đích sau đăng nhập theo vai trò (tài khoản staff có SĐT cũng về đúng chỗ)
function landingFor(user, isNewUser) {
  if (isNewUser) return '/profile?onboard=true'
  return user.role === 'admin' ? '/admin' : user.role === 'engineer' ? '/engineer/queue' : '/home'
}

// SĐT di động VN: 10 số bắt đầu bằng 0 (03x–09x), hoặc dạng 84xxxxxxxxx
const PHONE_RE = /^(0|84)[3-9]\d{8}$/

// ─── Nông dân: SĐT + PIN 6 số (Đăng nhập / Đăng ký) — chỉ nhập số ─────────────
function StepPhonePin() {
  const [mode,     setMode]     = useState('login') // 'login' | 'register'
  const [phone,    setPhone]    = useState('')
  const [pin,      setPin]      = useState('')
  const [pin2,     setPin2]     = useState('')   // nhập lại PIN khi đăng ký
  const [showPin,  setShowPin]  = useState(false)
  const [agreed,   setAgreed]   = useState(false) // chỉ cần khi ĐĂNG KÝ
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const { setUser, setToken }   = useAuthStore()
  const phoneRef = useRef(null)
  useEffect(() => { phoneRef.current?.focus() }, [])

  const isRegister = mode === 'register'

  function switchMode(m) {
    setMode(m); setError(''); setPin(''); setPin2('')
  }

  async function submit() {
    if (loading) return
    if (!phone) return setError('Vui lòng nhập số điện thoại.')
    if (!PHONE_RE.test(phone)) return setError('Số điện thoại chưa đúng. Nhập đủ 10 số, ví dụ 0912345678.')
    if (pin.length !== 6) return setError('Mã PIN gồm đúng 6 chữ số.')
    if (isRegister) {
      if (pin2 !== pin) return setError('Mã PIN nhập lại chưa khớp.')
      if (!agreed)      return setError('Bạn cần đánh dấu đồng ý với Điều khoản & Chính sách bảo mật để đăng ký.')
    }
    setError(''); setLoading(true)
    try {
      const res = isRegister
        ? await authAPI.registerPhone(phone, pin)
        : await authAPI.loginPhone(phone, pin)
      const { token, user, isNewUser } = res.data
      await clearApiCache() // không để cache API của tài khoản trước lẫn vào phiên mới
      setToken(token); setUser(user)
      window.location.href = landingFor(user, isNewUser)
    } catch (err) {
      setError(err.response?.data?.error || 'Không kết nối được máy chủ. Thử lại nhé.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 fade-up">
      {/* Tabs Đăng nhập / Đăng ký */}
      <div className="flex bg-[#fdf8f5] border border-[#f0e0d0] rounded-full p-1">
        {[['login', 'Đăng nhập'], ['register', 'Đăng ký']].map(([m, label]) => (
          <button key={m} onClick={() => switchMode(m)}
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
          <input ref={phoneRef} id="pp-phone" type="tel" inputMode="numeric" pattern="[0-9]*" autoComplete="tel"
            placeholder="Ví dụ: 0912345678" maxLength={11}
            value={phone}
            onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 11)); setError('') }}
            onKeyDown={e => e.key === 'Enter' && submit()}
            className="w-full h-[54px] pl-12 pr-4 bg-white border-2 border-[#d4b8a8] rounded-2xl
                       text-[18px] font-bold placeholder:font-normal focus:border-[#4B230A] transition-colors" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[16px] font-bold text-[#0b1c30]">
            {isRegister ? 'Tạo mã PIN (6 số)' : 'Mã PIN (6 số)'}
          </label>
          <button type="button" onClick={() => setShowPin(v => !v)}
            className="flex items-center gap-1 text-[13px] text-[#4B230A] font-semibold">
            <span className="material-symbols-outlined text-[18px]">{showPin ? 'visibility_off' : 'visibility'}</span>
            {showPin ? 'Ẩn mã' : 'Hiện mã'}
          </button>
        </div>
        <DigitBoxes value={pin} onChange={v => { setPin(v); setError('') }} autoFocus={false} mask={!showPin} onEnter={submit} />
      </div>

      {isRegister && (
        <div className="space-y-2">
          <label className="text-[16px] font-bold text-[#0b1c30]">Nhập lại mã PIN</label>
          <DigitBoxes value={pin2} onChange={v => { setPin2(v); setError('') }} autoFocus={false} mask={!showPin} onEnter={submit} />
          <p className="text-[12.5px] text-[#7a6358] text-center">Nhớ kỹ mã PIN này để đăng nhập lần sau nhé.</p>
        </div>
      )}

      {/* Đồng ý điều khoản: chỉ hỏi MỘT lần lúc đăng ký, không hỏi lại mỗi lần đăng nhập */}
      {isRegister && (
        <div className="flex items-start gap-2 px-1">
          <input type="checkbox" id="consent" checked={agreed}
            onChange={e => { setAgreed(e.target.checked); setError('') }}
            className="mt-0.5 w-5 h-5 accent-[#4B230A] cursor-pointer shrink-0" />
          <label htmlFor="consent" className="text-[#7a6358] text-[13px] cursor-pointer leading-snug">
            Tôi đồng ý với việc Cò Con thu thập số điện thoại, ảnh, giọng nói và vị trí theo{' '}
            <Link to="/policies" className="text-[#4B230A] font-semibold underline">Điều khoản & Chính sách bảo mật</Link>
          </label>
        </div>
      )}

      {error && <ErrorBox msg={error} />}

      <button onClick={submit} disabled={loading} className={PRIMARY_BTN}>
        {loading
          ? <><Spinner /> Đang xử lý...</>
          : <>{isRegister ? 'Đăng ký' : 'Đăng nhập'}<span className="material-symbols-outlined">arrow_forward</span></>}
      </button>

      <p className="text-center text-[13px] text-[#7a6358] leading-relaxed px-2">
        {isRegister
          ? <>Đã có tài khoản? <button type="button" onClick={() => switchMode('login')} className="text-[#4B230A] font-bold underline">Đăng nhập</button></>
          : <>Chưa có tài khoản? <button type="button" onClick={() => switchMode('register')} className="text-[#4B230A] font-bold underline">Đăng ký</button><br />
              Quên mã PIN? Nhờ quản trị viên ở xã đặt lại giúp bạn.</>}
      </p>
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
    if (loading) return
    const mail = email.trim()
    if (!mail || !password) return setError('Vui lòng nhập email và mật khẩu.')
    if (!/^\S+@\S+\.\S+$/.test(mail)) return setError('Email chưa đúng định dạng.')
    setError(''); setLoading(true)
    try {
      const res = await authAPI.loginEmail(mail, password)
      const { token, user, isNewUser } = res.data
      await clearApiCache() // không để cache API của tài khoản trước lẫn vào phiên mới
      setToken(token); setUser(user)
      window.location.href = landingFor(user, isNewUser)
    } catch (err) {
      setError(err.response?.data?.error || 'Không kết nối được máy chủ. Thử lại nhé.')
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
        <PasswordInput id="password" autoComplete="current-password" placeholder="••••••••"
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
  const [step, setStep] = useState('role') // 'role' | 'phone-pin' | 'email'
  const { token, user } = useAuthStore()
  // staff đã đăng nhập mà mở /login thì về trang của mình, không rớt vào trang nông dân
  if (token) return <Navigate to={user ? landingFor(user, false) : '/home'} replace />

  const HERO = {
    role:         { title: 'Cò Con Dự Báo', sub: 'Trợ lý nông nghiệp của bà con' },
    'phone-pin':  { title: 'Nông dân',       sub: 'Đăng nhập hoặc đăng ký bằng số điện thoại' },
    email:        { title: 'Kỹ sư & Admin',  sub: 'Đăng nhập bằng email được cấp' },
  }[step]

  function handleBack() {
    setStep('role')
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#4B230A] overflow-hidden max-w-[480px] mx-auto
                    md:max-w-none md:justify-center md:items-center md:px-6 md:py-10">
      <div className="flex flex-col flex-1 w-full md:flex-none md:max-w-[440px]
                      md:rounded-[32px] md:overflow-hidden md:shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
      <header className="flex-shrink-0 flex flex-col items-center gap-4 px-5 pb-8 fade-in md:pt-12"
              style={{ paddingTop: 'max(48px, env(safe-area-inset-top))' }}>
        <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-[0_0_0_2px_rgba(255,255,255,0.3)]">
          <img src="/cocon-icon-bg.png" alt="Cò Con" className="w-20 h-20 object-contain" />
        </div>
        <div className="text-center">
          <h1 className="text-[28px] font-extrabold text-white tracking-tight">{HERO.title}</h1>
          <p className="text-[16px] text-white/80 mt-1">{HERO.sub}</p>
        </div>
      </header>

      <div className="flex-1 bg-white rounded-t-[28px] px-5 pt-6 overflow-y-auto md:flex-none md:rounded-t-none"
           style={{ paddingBottom: 'max(40px, env(safe-area-inset-bottom))' }}>
        {step !== 'role' && (
          <button onClick={handleBack} className="flex items-center gap-1 text-[#4B230A] font-bold text-[16px] mb-5">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Quay lại
          </button>
        )}

        {step === 'role'      && <StepRole onNext={r => setStep(r === 'farmer' ? 'phone-pin' : 'email')} />}
        {step === 'phone-pin' && <StepPhonePin />}
        {step === 'email'     && <StepEmailPassword />}

        <p className="text-center text-[12.5px] text-[#7a6358] mt-6 mb-2">
          <Link to="/policies" className="text-[#4B230A] font-semibold underline">Điều khoản & Chính sách bảo mật</Link>
        </p>
      </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-32
                      bg-gradient-to-t from-[#4B230A]/10 to-transparent pointer-events-none -z-10 md:hidden" />
    </div>
  )
}
