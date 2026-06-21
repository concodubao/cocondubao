import { useState } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useDisplayStore } from '../stores/displayStore'
import { authAPI } from '../services/api'
import BottomNav from '../components/BottomNav'
import PasswordInput from '../components/PasswordInput'

// Trang chủ theo vai trò — staff không nên rớt về /home (trang nông dân)
function roleHome(role) {
  return role === 'admin' ? '/admin' : role === 'engineer' ? '/engineer/queue' : '/home'
}

// ─── Modal đặt / đổi mật khẩu ────────────────────────────────────────────────
function PasswordModal({ mode, onClose, onSuccess }) {
  const [current,  setCurrent]  = useState('')
  const [newPw,    setNewPw]    = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const isSet = mode === 'set'
  const tooShort  = newPw.length > 0 && newPw.length < 6
  const mismatch  = confirm.length > 0 && newPw !== confirm
  const canSubmit = newPw.length >= 6 && newPw === confirm && (isSet || current.length > 0)

  async function handleSubmit() {
    if (!newPw || newPw.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự.')
    if (newPw !== confirm) return setError('Mật khẩu xác nhận không khớp.')
    if (!isSet && !current) return setError('Vui lòng nhập mật khẩu hiện tại.')
    setError(''); setLoading(true)
    try {
      if (isSet) {
        await authAPI.setPassword(newPw)
      } else {
        await authAPI.changePassword(current, newPw)
      }
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Không thực hiện được. Thử lại nhé.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-[480px] bg-white rounded-t-[28px] px-5 pt-5 pb-8 flex flex-col gap-4"
           style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>

        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[18px] font-extrabold text-[#0b1c30]">
            {isSet ? 'Đặt mật khẩu' : 'Đổi mật khẩu'}
          </h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-[#f1f5f9] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px] text-[#7a6358]">close</span>
          </button>
        </div>

        {!isSet && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-semibold text-[#0b1c30]">Mật khẩu hiện tại</label>
            <PasswordInput autoComplete="current-password" placeholder="••••••••"
              value={current} onChange={e => setCurrent(e.target.value)}
              className="w-full h-[50px] px-4 bg-[#fdf8f5] border-[1.5px] border-[#f0e0d0] rounded-2xl text-[16px]" />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[14px] font-semibold text-[#0b1c30]">Mật khẩu mới</label>
          <PasswordInput autoComplete="new-password" placeholder="Ít nhất 6 ký tự"
            value={newPw} onChange={e => setNewPw(e.target.value)}
            className={`w-full h-[50px] px-4 bg-[#fdf8f5] border-[1.5px] rounded-2xl text-[16px]
                        ${tooShort ? 'border-[#f3b4b4]' : 'border-[#f0e0d0]'}`} />
          <p className={`text-[12.5px] flex items-center gap-1 ${newPw.length >= 6 ? 'text-[#4B230A]' : 'text-[#7a6358]'}`}>
            <span className="material-symbols-outlined text-[15px]">
              {newPw.length >= 6 ? 'check_circle' : 'info'}
            </span>
            Tối thiểu 6 ký tự
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[14px] font-semibold text-[#0b1c30]">Xác nhận mật khẩu</label>
          <PasswordInput autoComplete="new-password" placeholder="Nhập lại mật khẩu mới"
            value={confirm} onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && canSubmit && handleSubmit()}
            className={`w-full h-[50px] px-4 bg-[#fdf8f5] border-[1.5px] rounded-2xl text-[16px]
                        ${mismatch ? 'border-[#f3b4b4]' : confirm.length > 0 && !mismatch ? 'border-[#86c79a]' : 'border-[#f0e0d0]'}`} />
          {confirm.length > 0 && (
            <p className={`text-[12.5px] flex items-center gap-1 ${mismatch ? 'text-[#c62828]' : 'text-[#15803d]'}`}>
              <span className="material-symbols-outlined text-[15px]">
                {mismatch ? 'cancel' : 'check_circle'}
              </span>
              {mismatch ? 'Mật khẩu chưa khớp' : 'Khớp rồi'}
            </p>
          )}
        </div>

        {error && (
          <p className="text-[13px] text-[#ba1a1a] bg-[#ffdad6] px-4 py-3 rounded-2xl m-0">{error}</p>
        )}

        <button onClick={handleSubmit} disabled={loading || !canSubmit}
          className="w-full h-[56px] rounded-full bg-[#4B230A] text-white text-[16px] font-bold
                     flex items-center justify-center gap-2 shadow-md active:scale-95
                     disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 transition-all">
          {loading
            ? <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Đang lưu...</>
            : isSet ? 'Đặt mật khẩu' : 'Đổi mật khẩu'}
        </button>
      </div>
    </div>
  )
}

const CROP_OPTIONS = [
  { id: 'rice',   label: 'Lúa',          icon: 'grass' },
  { id: 'veggie', label: 'Rau màu',      icon: 'eco' },
  { id: 'fruit',  label: 'Cây ăn trái', icon: 'forest' },
  { id: 'other',  label: 'Khác',         icon: 'more_horiz' },
]

const ROLE_LABELS = {
  farmer:   'Nông dân',
  engineer: 'Kỹ sư nông nghiệp',
  admin:    'Quản trị viên',
}

export default function Profile() {
  const navigate       = useNavigate()
  const [params]       = useSearchParams()
  const isOnboard      = params.get('onboard') === 'true'
  const { user, setUser, logout } = useAuthStore()
  const { fontScale, setFontScale } = useDisplayStore()

  const isFarmer = user?.role === 'farmer'

  const [name,         setName]         = useState(user?.name    || '')
  const [village,      setVillage]      = useState(user?.village || '')
  const [crops,        setCrops]        = useState(user?.crops   || [])
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [passwordModal, setPasswordModal] = useState(null) // 'set' | 'change' | null
  const [pwSuccess,    setPwSuccess]    = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,     setDeleting]     = useState(false)

  if (isOnboard && user?.name) return <Navigate to={roleHome(user?.role)} replace />

  function toggleCrop(id) {
    setCrops(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  async function handleSave() {
    if (!name.trim()) return setError('Vui lòng nhập tên của bạn.')
    setError('')
    setLoading(true)
    try {
      const res = await authAPI.updateProfile({
        name:    name.trim(),
        village: village.trim(),
        crops,
      })
      setUser(res.data.user)
      navigate(roleHome(res.data.user?.role || user?.role), { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Không lưu được. Thử lại nhé.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      await authAPI.deleteAccount()
      logout()  // token bị xoá → ProtectedRoute tự đưa về /login
    } catch (err) {
      setError(err.response?.data?.error || 'Không xoá được tài khoản. Thử lại nhé.')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#fdf8f5] max-w-[480px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────── */}
      {!isOnboard ? (
        <header className="flex items-center gap-3 px-5 pt-5 pb-4">
          <button
            onClick={() => navigate(roleHome(user?.role))}
            aria-label="Quay lại"
            className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[22px] text-[#4B230A]">arrow_back</span>
          </button>
          <h1 className="text-[20px] font-extrabold text-[#0b1c30] flex-1">Hồ sơ cá nhân</h1>
        </header>
      ) : (
        /* Onboarding hero */
        <div className="flex flex-col items-center gap-4 px-5 pt-10 pb-6 text-center fade-up">
          <div className="w-20 h-20 rounded-[28px] bg-white border border-[#f0e0d0]
                          flex items-center justify-center shadow-[0_8px_24px_rgba(75,35,10,0.2)]">
            <img src="/cocon-icon-bg.png" alt="Cò Con" className="w-16 h-16 object-contain" />
          </div>
          <div>
            <h1 className="text-[24px] font-extrabold text-[#0b1c30] leading-tight">Chào mừng!</h1>
            <p className="text-[15px] text-[#7a6358] mt-1 max-w-[280px]">
              Cho Cò Con biết thêm một chút để hỗ trợ bạn tốt hơn nhé.
            </p>
          </div>
        </div>
      )}

      {/* ── Form ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col gap-5 px-5 pb-8">

        {/* ── Nhóm: Thông tin của bạn ── */}
        {!isOnboard && (
          <p className="text-[13px] font-bold text-[#7a6358] uppercase tracking-wider px-1 -mb-1">Thông tin của bạn</p>
        )}

        {/* Identity card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#f0e0d0] flex flex-col gap-5">

          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-[15px] font-semibold text-[#0b1c30]">
              Tên của bạn <span className="text-[#EF4444]">*</span>
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Ví dụ: Chú Hai, Anh Ba Lúa..."
              value={name}
              onChange={e => setName(e.target.value)}
              aria-required="true"
              className="w-full px-4 py-3.5 text-[17px] text-[#0b1c30] bg-[#fdf8f5]
                         border-[1.5px] border-[#f0e0d0] rounded-2xl placeholder-[#d4b8a8]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="village" className="text-[15px] font-semibold text-[#0b1c30]">
              Ấp / Xã
            </label>
            <input
              id="village"
              type="text"
              autoComplete="address-level3"
              placeholder="Ví dụ: Ấp Trường Thọ, xã Trường Khánh"
              value={village}
              onChange={e => setVillage(e.target.value)}
              className="w-full px-4 py-3.5 text-[17px] text-[#0b1c30] bg-[#fdf8f5]
                         border-[1.5px] border-[#f0e0d0] rounded-2xl placeholder-[#d4b8a8]"
            />
          </div>
        </div>

        {/* Crop chips */}
        {isFarmer && (
          <div className="flex flex-col gap-3">
            <div className="text-[15px] font-semibold text-[#0b1c30]">
              Cây trồng{' '}
              <span className="text-[#7a6358] font-normal">(tuỳ chọn)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CROP_OPTIONS.map(c => {
                const active = crops.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCrop(c.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[15px] font-semibold
                                transition-all border-[1.5px]
                                ${active
                                  ? 'bg-[#fdf6f0] border-[#4B230A] text-[#4B230A]'
                                  : 'bg-white border-[#f0e0d0] text-[#7a6358]'
                                }`}
                  >
                    <span className={`material-symbols-outlined text-[16px] ${active ? 'ms-fill' : ''}`}>
                      {c.icon}
                    </span>
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p role="alert" className="text-[14px] text-[#ba1a1a] bg-[#ffdad6] px-4 py-3 rounded-2xl m-0">
            {error}
          </p>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={loading}
          aria-busy={loading}
          className="w-full h-[60px] rounded-full bg-[#4B230A] text-white text-[17px] font-bold
                     shadow-[0_4px_16px_rgba(75,35,10,0.3)] disabled:opacity-60 transition-opacity"
        >
          {loading ? 'Đang lưu...' : isOnboard ? 'Bắt đầu dùng Cò Con →' : 'Lưu thông tin'}
        </button>

        {/* ── Nhóm: Tuỳ chọn ── */}
        {!isOnboard && (
          <p className="text-[13px] font-bold text-[#7a6358] uppercase tracking-wider px-1 mt-1">Tuỳ chọn</p>
        )}

        {/* Cỡ chữ hiển thị — cho bà con lớn tuổi dễ đọc */}
        {isFarmer && !isOnboard && (
          <div className="bg-white rounded-3xl border border-[#f0e0d0] shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-[#4B230A]">format_size</span>
              <span className="text-[14px] font-semibold text-[#0b1c30] flex-1">Cỡ chữ hiển thị</span>
            </div>
            <div className="flex gap-2">
              {[['Thường', 1], ['Lớn', 1.15], ['Rất lớn', 1.3]].map(([label, val]) => (
                <button
                  key={val}
                  onClick={() => setFontScale(val)}
                  aria-pressed={fontScale === val}
                  className={`flex-1 py-2.5 rounded-2xl border-[1.5px] font-semibold transition-all
                    ${fontScale === val
                      ? 'bg-[#fdf6f0] border-[#4B230A] text-[#4B230A]'
                      : 'bg-white border-[#f0e0d0] text-[#7a6358]'}`}
                  style={{ fontSize: val === 1 ? 14 : val === 1.15 ? 16 : 18 }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-[#7a6358] m-0">Áp dụng cho toàn bộ ứng dụng.</p>
          </div>
        )}

        {/* Khác — cài đặt & chính sách */}
        {!isOnboard && (
          <div className="bg-white rounded-3xl border border-[#f0e0d0] shadow-sm divide-y divide-[#f0e0d0]">
            <button
              onClick={() => navigate('/notifications/settings')}
              className="w-full flex items-center justify-between px-5 py-4 active:bg-[#fdf8f5] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-[#4B230A]">notifications</span>
                <span className="text-[14px] text-[#0b1c30]">Cài đặt thông báo</span>
              </div>
              <span className="material-symbols-outlined text-[18px] text-[#c4a898]">chevron_right</span>
            </button>
            <button
              onClick={() => navigate('/policies')}
              className="w-full flex items-center justify-between px-5 py-4 active:bg-[#fdf8f5] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-[#4B230A]">shield</span>
                <span className="text-[14px] text-[#0b1c30]">Chính sách & Điều khoản</span>
              </div>
              <span className="material-symbols-outlined text-[18px] text-[#c4a898]">chevron_right</span>
            </button>
          </div>
        )}

        {/* ── Nhóm: Tài khoản ── */}
        {!isOnboard && (
          <p className="text-[13px] font-bold text-[#7a6358] uppercase tracking-wider px-1 mt-1">Tài khoản</p>
        )}

        {/* Số điện thoại + vai trò */}
        <div className="bg-white rounded-3xl border border-[#f0e0d0] shadow-sm divide-y divide-[#f0e0d0]">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-[#4B230A]">phone</span>
              <span className="text-[14px] text-[#7a6358]">Số điện thoại</span>
            </div>
            <span className="text-[15px] font-semibold text-[#0b1c30]">{user?.phone || '—'}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-[#4B230A]">badge</span>
              <span className="text-[14px] text-[#7a6358]">Vai trò</span>
            </div>
            <span className="text-[15px] font-semibold text-[#0b1c30]">
              {ROLE_LABELS[user?.role] || user?.role}
            </span>
          </div>
        </div>

        {/* Bảo mật */}
        {!isOnboard && (
          <div className="bg-white rounded-3xl border border-[#f0e0d0] shadow-sm">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#f1f5f9]">
              <span className="material-symbols-outlined text-[20px] text-[#4B230A]">lock</span>
              <span className="text-[14px] font-semibold text-[#0b1c30] flex-1">Bảo mật</span>
            </div>
            <button
              onClick={() => { setPwSuccess(false); setPasswordModal(user?.hasPassword ? 'change' : 'set') }}
              className="w-full flex items-center justify-between px-5 py-4 active:bg-[#fdf8f5] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-[#7a6358]">key</span>
                <span className="text-[14px] text-[#0b1c30]">
                  {user?.hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}
                </span>
              </div>
              <span className="material-symbols-outlined text-[18px] text-[#c4a898]">chevron_right</span>
            </button>
          </div>
        )}

        {pwSuccess && (
          <p className="text-[13px] text-[#2e1505] bg-[#fdf6f0] border border-[#f5d5b0] px-4 py-3 rounded-2xl text-center">
            ✓ {passwordModal === 'set' || !user?.hasPassword ? 'Đặt mật khẩu thành công!' : 'Đổi mật khẩu thành công!'}
          </p>
        )}

        {/* Logout row */}
        {!isOnboard && (
          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 text-[14px] text-[#7a6358] font-semibold py-2 mx-auto"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Đăng xuất
          </button>
        )}

        {/* Vùng nguy hiểm — xoá tài khoản */}
        {!isOnboard && (
          confirmDelete ? (
            <div className="bg-[#fde8e8] border border-[#f3b4b4] rounded-2xl p-4 flex flex-col gap-3">
              <p className="text-[13.5px] text-[#7a2020] m-0 leading-relaxed">
                Tài khoản sẽ bị vô hiệu hoá và thông tin cá nhân (tên, ấp/xã, cây trồng) sẽ bị xoá. Bạn sẽ bị đăng xuất ngay.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)}
                  className="flex-1 h-11 rounded-xl bg-white border border-[#f0e0d0] text-[14px] text-[#7a6358] font-semibold">
                  Huỷ
                </button>
                <button onClick={handleDeleteAccount} disabled={deleting}
                  className="flex-1 h-11 rounded-xl bg-[#c62828] text-white text-[14px] font-semibold disabled:opacity-60">
                  {deleting ? 'Đang xoá...' : 'Xác nhận xoá'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="text-[13px] text-[#c62828] font-medium py-2 mx-auto block">
              Xoá tài khoản
            </button>
          )
        )}
      </main>

      {/* ── Bottom Nav (farmers, non-onboard) ─────────────────── */}
      {isFarmer && !isOnboard && <BottomNav />}
      {isFarmer && !isOnboard && <div className="h-20" aria-hidden="true" />}

      {passwordModal && (
        <PasswordModal
          mode={passwordModal}
          onClose={() => setPasswordModal(null)}
          onSuccess={() => {
            setPasswordModal(null)
            setPwSuccess(true)
            setUser({ ...user, hasPassword: true })
          }}
        />
      )}
    </div>
  )
}
