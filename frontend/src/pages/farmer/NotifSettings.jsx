import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { pushAPI } from '../../services/api'
import { usePush } from '../../hooks/usePush'
import { toast } from '../../stores/toastStore'
import { ChevronLeft, CheckCircle, XCircle } from 'lucide-react'

const TYPE_OPTIONS = [
  { id: 'alert',     label: 'Cảnh báo dịch bệnh', desc: 'Dịch bệnh, sâu hại mới xuất hiện' },
  { id: 'promotion', label: 'Khuyến mãi vật tư',  desc: 'Phân bón, thuốc BVTV giảm giá' },
  { id: 'weather',   label: 'Thời tiết nông vụ',  desc: 'Mưa, nắng ảnh hưởng mùa vụ' },
]

export default function NotifSettings() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { isSubscribed, permission, subscribe, unsubscribe } = usePush(user?.id)

  const [types,      setTypes]      = useState(['alert', 'promotion', 'weather'])
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd,   setQuietEnd]   = useState('06:00')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)

  // Tải cài đặt đã lưu để form hiển thị đúng thay vì luôn về mặc định
  useEffect(() => {
    pushAPI.getSettings()
      .then(res => {
        const d = res.data
        if (Array.isArray(d.notifTypes)) setTypes(d.notifTypes)
        if (d.quietStart) setQuietStart(d.quietStart)
        if (d.quietEnd)   setQuietEnd(d.quietEnd)
      })
      .catch(() => {})
  }, [])

  function toggleType(id) {
    setTypes(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  async function handleSave() {
    setSaving(true)
    try {
      await pushAPI.updateSettings({ notifTypes: types, quietStart, quietEnd })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      toast.error('Không lưu được cài đặt. Thử lại nhé.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button onClick={() => navigate('/notifications')} style={s.iconBtn} aria-label="Quay lại">
          <ChevronLeft size={22} />
        </button>
        <h1 style={s.title}>Cài đặt thông báo</h1>
      </header>

      <main style={s.main}>
        <section style={s.section}>
          <p style={s.sTitle}>Trạng thái</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {isSubscribed && permission === 'granted'
                  ? <CheckCircle size={16} color="#4B230A" strokeWidth={2} />
                  : <XCircle size={16} color="#ef4444" strokeWidth={2} />
                }
                <p style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>
                  {isSubscribed && permission === 'granted' ? 'Đang nhận thông báo' : 'Chưa bật thông báo'}
                </p>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                {isSubscribed ? 'Thiết bị này nhận thông báo kể cả khi đóng app' : 'Bật để nhận cảnh báo sâu bệnh kịp thời'}
              </p>
            </div>
            {isSubscribed
              ? <button onClick={unsubscribe} style={s.btnOff}>Tắt</button>
              : <button onClick={subscribe}   style={s.btnOn}>Bật</button>
            }
          </div>
        </section>

        <section style={s.section}>
          <p style={s.sTitle}>Loại thông báo muốn nhận</p>
          {TYPE_OPTIONS.map(t => (
            <label key={t.id} style={s.typeRow} htmlFor={`type-${t.id}`}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>{t.label}</p>
                <p style={{ fontSize: 13, color: '#64748b', margin: '3px 0 0' }}>{t.desc}</p>
              </div>
              <input id={`type-${t.id}`} type="checkbox" checked={types.includes(t.id)} onChange={() => toggleType(t.id)}
                style={{ width: 20, height: 20, cursor: 'pointer', accentColor: '#4B230A' }} />
            </label>
          ))}
        </section>

        <section style={s.section}>
          <p style={s.sTitle}>Khung giờ không gửi thông báo</p>
          <p style={{ fontSize: 13, color: '#64748b', margin: '-4px 0 4px' }}>Trong khung giờ này, thông báo sẽ được giữ lại và gửi sau.</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, color: '#64748b' }} htmlFor="qs">Từ</label>
              <input id="qs" type="time" value={quietStart} onChange={e => setQuietStart(e.target.value)} style={s.timeInput} />
            </div>
            <span style={{ color: '#64748b', paddingBottom: 8 }}>đến</span>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, color: '#64748b' }} htmlFor="qe">Đến</label>
              <input id="qe" type="time" value={quietEnd} onChange={e => setQuietEnd(e.target.value)} style={s.timeInput} />
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>Mặc định: 22:00 – 06:00</p>
        </section>

        <button onClick={handleSave} disabled={saving} style={{ ...s.btnSave, opacity: saving ? 0.7 : 1 }} aria-busy={saving}>
          {saving ? 'Đang lưu...' : saved ? 'Đã lưu!' : 'Lưu cài đặt'}
        </button>
      </main>
    </div>
  )
}

const s = {
  page:      { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fdf8f5', fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: '0 auto' },
  header:    { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 },
  iconBtn:   { width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  title:     { fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0 },
  main:      { flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 'max(32px, env(safe-area-inset-bottom))' },
  section:   { background: '#fff', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid #e2e8f0' },
  sTitle:    { fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 },
  typeRow:   { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', minHeight: 52 },
  timeInput: { padding: '13px 14px', fontSize: 17, borderRadius: 10, border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a', width: '100%', boxSizing: 'border-box', marginTop: 6 },
  btnOn:     { padding: '10px 20px', background: '#4B230A', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', minHeight: 44 },
  btnOff:    { padding: '10px 20px', background: 'transparent', color: '#ef4444', border: '1.5px solid #fecaca', borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', minHeight: 44 },
  btnSave:   { padding: '15px', fontSize: 17, fontWeight: 700, background: '#4B230A', color: '#fff', border: 'none', borderRadius: 14, cursor: 'pointer', minHeight: 54 },
}
