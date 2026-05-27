import { useState } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { authAPI } from '../services/api'
import BottomNav from '../components/BottomNav'

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

  const isFarmer = user?.role === 'farmer'

  const [name,    setName]    = useState(user?.name    || '')
  const [village, setVillage] = useState(user?.village || '')
  const [crops,   setCrops]   = useState(user?.crops   || [])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  if (isOnboard && user?.name) return <Navigate to="/home" replace />

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
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Không lưu được. Thử lại nhé.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#f8f9ff] max-w-[480px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────── */}
      {!isOnboard ? (
        <header className="flex items-center gap-3 px-5 pt-5 pb-4">
          <button
            onClick={() => navigate('/home')}
            aria-label="Quay lại"
            className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[22px] text-[#006b2c]">arrow_back</span>
          </button>
          <h1 className="text-[20px] font-extrabold text-[#0b1c30] flex-1">Hồ sơ cá nhân</h1>
        </header>
      ) : (
        /* Onboarding hero */
        <div className="flex flex-col items-center gap-4 px-5 pt-10 pb-6 text-center fade-up">
          <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-[#00873a] to-[#006b2c]
                          flex items-center justify-center shadow-[0_8px_24px_rgba(0,107,44,0.35)]">
            <span className="material-symbols-outlined text-white text-[40px] ms-fill">eco</span>
          </div>
          <div>
            <h1 className="text-[24px] font-extrabold text-[#0b1c30] leading-tight">Chào mừng!</h1>
            <p className="text-[15px] text-[#6e7b6c] mt-1 max-w-[280px]">
              Cho Cò Con biết thêm một chút để hỗ trợ bạn tốt hơn nhé.
            </p>
          </div>
        </div>
      )}

      {/* ── Form ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col gap-5 px-5 pb-8">

        {/* Identity card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#e5eeff] flex flex-col gap-5">

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
              className="w-full px-4 py-3.5 text-[17px] text-[#0b1c30] bg-[#f8f9ff]
                         border-[1.5px] border-[#e5eeff] rounded-2xl placeholder-[#bdcaba]"
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
              className="w-full px-4 py-3.5 text-[17px] text-[#0b1c30] bg-[#f8f9ff]
                         border-[1.5px] border-[#e5eeff] rounded-2xl placeholder-[#bdcaba]"
            />
          </div>
        </div>

        {/* Crop chips */}
        {isFarmer && (
          <div className="flex flex-col gap-3">
            <div className="text-[15px] font-semibold text-[#0b1c30]">
              Cây trồng{' '}
              <span className="text-[#6e7b6c] font-normal">(tuỳ chọn)</span>
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
                                  ? 'bg-[#f0fdf4] border-[#006b2c] text-[#006b2c]'
                                  : 'bg-white border-[#e5eeff] text-[#6e7b6c]'
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
          className="w-full h-[60px] rounded-full bg-[#006b2c] text-white text-[17px] font-bold
                     shadow-[0_4px_16px_rgba(0,107,44,0.3)] disabled:opacity-60 transition-opacity"
        >
          {loading ? 'Đang lưu...' : isOnboard ? 'Bắt đầu dùng Cò Con →' : 'Lưu hồ sơ'}
        </button>

        {/* Info rows */}
        <div className="bg-white rounded-3xl border border-[#e5eeff] shadow-sm divide-y divide-[#e5eeff]">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-[#006b2c]">phone</span>
              <span className="text-[14px] text-[#6e7b6c]">Số điện thoại</span>
            </div>
            <span className="text-[15px] font-semibold text-[#0b1c30]">{user?.phone || '—'}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-[#006b2c]">badge</span>
              <span className="text-[14px] text-[#6e7b6c]">Vai trò</span>
            </div>
            <span className="text-[15px] font-semibold text-[#0b1c30]">
              {ROLE_LABELS[user?.role] || user?.role}
            </span>
          </div>
        </div>

        {/* Logout row */}
        {!isOnboard && (
          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 text-[14px] text-[#6e7b6c] font-semibold py-2 mx-auto"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Đăng xuất
          </button>
        )}
      </main>

      {/* ── Bottom Nav (farmers, non-onboard) ─────────────────── */}
      {isFarmer && !isOnboard && <BottomNav />}
      {isFarmer && !isOnboard && <div className="h-20" aria-hidden="true" />}
    </div>
  )
}
