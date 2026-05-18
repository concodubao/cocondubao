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
    <div style={s.step}>
      <div style={s.logoMark}>C</div>
      <h1 style={s.title}>Cò Con Dự Báo</h1>
      <p style={s.sub}>Nhập số điện thoại để đăng nhập</p>
      <div style={s.card}>
        <label style={s.label} htmlFor="phone">Số điện thoại</label>
        <input
          id="phone" type="tel" inputMode="numeric" autoComplete="tel"
          placeholder="0901 234 567" value={phone}
          onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          style={s.input} autoFocus
        />
        {error && <p style={s.error}>{error}</p>}
        <button onClick={handleSend} disabled={loading} style={{ ...s.btnPrimary, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Đang gửi...' : 'Nhận mã OTP'}
        </button>
      </div>
    </div>
  )
}

function StepRole({ onNext, onBack }) {
  return (
    <div style={s.step}>
      <button onClick={onBack} style={s.backBtn}><ChevronLeft size={20} /> Quay lại</button>
      <div style={s.logoMark}>C</div>
      <h1 style={s.title}>Bạn là ai?</h1>
      <p style={s.sub}>Vai trò sẽ được gắn vĩnh viễn với số điện thoại này</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 360 }}>
        {ROLES.map(r => (
          <button key={r.id} onClick={() => onNext(r.id)} style={s.roleCard}>
            <div style={s.roleIconWrap}><r.Icon size={22} color="#16a34a" strokeWidth={1.5} /></div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{r.label}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{r.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function StepOTP({ phone, role, devOtp, isExistingUser, onBack, onResend }) {
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
    <div style={s.step}>
      <button onClick={onBack} style={s.backBtn}><ChevronLeft size={20} /> Quay lại</button>
      <div style={s.logoMark}>C</div>
      <h1 style={s.title}>Nhập mã OTP</h1>
      <p style={s.sub}>Mã đã gửi đến {phone}</p>
      <div style={s.card}>
        <label style={s.label} htmlFor="otp">Mã 6 số</label>
        <input
          id="otp" type="tel" inputMode="numeric" autoComplete="one-time-code"
          maxLength={6} placeholder="• • • • • •" value={otp}
          onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={e => e.key === 'Enter' && handleVerify()}
          style={{ ...s.input, textAlign: 'center', fontSize: 28, letterSpacing: 8 }}
          autoFocus
        />
        {devOtp && (
          <p style={{ fontSize: 13, color: '#16a34a', background: '#f0fdf4', padding: '6px 10px', borderRadius: 8, margin: 0 }}>
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
      </div>
    </div>
  )
}

export default function Login() {
  const [step,           setStep]           = useState('phone')
  const [phone,          setPhone]          = useState('')
  const [role,           setRole]           = useState('farmer')
  const [devOtp,         setDevOtp]         = useState('')
  const [isExistingUser, setIsExistingUser] = useState(false)

  const { token } = useAuthStore()
  if (token) return <Navigate to="/home" replace />

  function handlePhoneNext({ phone: p, devOtp: otp, isExistingUser: exists, existingRole }) {
    setPhone(p)
    setDevOtp(otp || '')
    setIsExistingUser(exists)
    if (exists) { setRole(existingRole || 'farmer'); setStep('otp') }
    else setStep('role')
  }

  async function handleResend() {
    const res = await authAPI.requestOTP(phone)
    const newDevOtp = res.data.devOtp || ''
    setDevOtp(newDevOtp)
    return newDevOtp
  }

  return (
    <div style={s.page}>
      {step === 'phone' && <StepPhone onNext={handlePhoneNext} />}
      {step === 'role'  && <StepRole onNext={r => { setRole(r); setStep('otp') }} onBack={() => setStep('phone')} />}
      {step === 'otp'   && (
        <StepOTP phone={phone} role={role} devOtp={devOtp} isExistingUser={isExistingUser}
          onBack={() => setStep(isExistingUser ? 'phone' : 'role')} onResend={handleResend} />
      )}
    </div>
  )
}

const s = {
  page:        { minHeight: '100dvh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: "'Noto Sans', sans-serif" },
  step:        { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 400 },
  logoMark:    { width: 56, height: 56, borderRadius: 16, background: '#16a34a', color: '#fff', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0, textAlign: 'center' },
  sub:         { fontSize: 15, color: '#64748b', margin: 0, textAlign: 'center' },
  card:        { background: '#fff', borderRadius: 20, padding: '24px 20px', width: '100%', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12 },
  label:       { fontSize: 15, fontWeight: 600, color: '#0f172a' },
  input:       { width: '100%', padding: '13px 16px', fontSize: 18, borderRadius: 12, border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a', background: '#f8fafc', boxSizing: 'border-box', transition: 'border-color 0.2s', textAlign: 'left' },
  btnPrimary:  { width: '100%', padding: '14px', fontSize: 17, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', minHeight: 52 },
  error:       { color: '#ef4444', fontSize: 14, background: '#fef2f2', padding: '8px 12px', borderRadius: 8, margin: 0 },
  backBtn:     { alignSelf: 'flex-start', background: 'transparent', border: 'none', fontSize: 15, color: '#64748b', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 },
  roleCard:    { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'border-color 0.15s' },
  roleIconWrap:{ width: 44, height: 44, borderRadius: 12, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
}
