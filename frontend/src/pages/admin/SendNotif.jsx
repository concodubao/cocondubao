import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pushAPI } from '../../services/api'
import { ChevronLeft, AlertTriangle, Tag, Cloud, Bell, Send, Clock, CheckCircle } from 'lucide-react'

const TYPE_OPTIONS = [
  { id: 'alert',     Icon: AlertTriangle, label: 'Cảnh báo dịch bệnh', desc: 'Ưu tiên cao — hiển thị nổi bật', color: '#ef4444', bg: '#fef2f2' },
  { id: 'promotion', Icon: Tag,           label: 'Khuyến mãi vật tư',  desc: 'Phân bón, thuốc BVTV giảm giá', color: '#3b82f6', bg: '#eff6ff' },
  { id: 'weather',   Icon: Cloud,         label: 'Thời tiết nông vụ',  desc: 'Thời tiết ảnh hưởng mùa vụ',   color: '#f59e0b', bg: '#fffbeb' },
]

function NotifPreview({ type, title, body }) {
  const cfg = TYPE_OPTIONS.find(t => t.id === type) || TYPE_OPTIONS[0]
  const { Icon } = cfg

  if (!title && !body) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
        Preview sẽ hiện ở đây khi bạn nhập nội dung...
      </div>
    )
  }

  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={14} color={cfg.color} strokeWidth={2} />
        <span style={{ fontSize: 11, color: cfg.color, fontWeight: 700, textTransform: 'uppercase' }}>Preview thông báo</span>
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>{title || '(Tiêu đề)'}</p>
      <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
        {body?.slice(0, 120) || '(Nội dung)'}{body?.length > 120 ? '...' : ''}
      </p>
    </div>
  )
}

export default function SendNotif() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const [type,       setType]       = useState('alert')
  const [title,      setTitle]      = useState('')
  const [body,       setBody]       = useState('')
  const [imageUrl,   setImageUrl]   = useState('')
  const [region,     setRegion]     = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [result,     setResult]     = useState(null)
  const [error,      setError]      = useState('')

  const sendMutation = useMutation({
    mutationFn: (data) => pushAPI.send(data),
    onSuccess: (res) => {
      setResult(res.data)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Gửi thất bại. Thử lại nhé.')
    },
  })

  function handleSend() {
    if (!title.trim()) return setError('Nhập tiêu đề thông báo.')
    if (!body.trim())  return setError('Nhập nội dung thông báo.')
    setError('')
    sendMutation.mutate({
      title:      title.trim(),
      body:       body.trim(),
      type,
      imageUrl:   imageUrl.trim() || undefined,
      region:     region.trim() || undefined,
      scheduleAt: scheduleAt || undefined,
    })
  }

  if (result) {
    return (
      <div style={{ ...s.page, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: result.scheduled ? '#fffbeb' : '#fdf6f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {result.scheduled
              ? <Clock size={32} color="#f59e0b" strokeWidth={1.5} />
              : <CheckCircle size={32} color="#7a3b10" strokeWidth={1.5} />}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>
            {result.scheduled ? 'Đã lên lịch gửi!' : 'Gửi thành công!'}
          </h2>
          {!result.scheduled && (
            <p style={{ fontSize: 15, color: '#64748b', margin: 0 }}>
              Đã gửi đến <strong>{result.sent}</strong> / {result.total} thiết bị
              {result.failed > 0 && ` (${result.failed} lỗi)`}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button onClick={() => setResult(null)} style={s.btnSecondary}>Gửi thêm</button>
            <button onClick={() => navigate('/admin')} style={s.btnPrimary}>Về Dashboard</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button onClick={() => navigate('/admin')} style={s.iconBtn} aria-label="Quay lại">
          <ChevronLeft size={22} />
        </button>
        <h1 style={s.title}>Soạn thông báo</h1>
      </header>

      <main style={s.main}>
        <section style={s.section}>
          <p style={s.sLabel}>Preview</p>
          <NotifPreview type={type} title={title} body={body} />
        </section>

        <section style={s.section}>
          <p style={s.sLabel}>Loại thông báo</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TYPE_OPTIONS.map(t => {
              const active = type === t.id
              return (
                <label key={t.id} htmlFor={`type-${t.id}`}
                  style={{ ...s.typeOption, borderColor: active ? t.color : '#e2e8f0', background: active ? t.bg : '#fff', cursor: 'pointer' }}>
                  <input id={`type-${t.id}`} type="radio" name="type" value={t.id}
                    checked={active} onChange={() => setType(t.id)}
                    style={{ accentColor: t.color }} />
                  <t.Icon size={16} color={active ? t.color : '#94a3b8'} strokeWidth={2} />
                  <div>
                    <span style={{ fontSize: 14, fontWeight: active ? 700 : 400, color: '#0f172a' }}>{t.label}</span>
                    <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 6 }}>{t.desc}</span>
                  </div>
                </label>
              )
            })}
          </div>
        </section>

        <section style={s.section}>
          <p style={s.sLabel}>Nội dung</p>
          <input type="text" placeholder="Tiêu đề thông báo *" value={title}
            onChange={e => setTitle(e.target.value)} maxLength={100}
            style={s.input} aria-label="Tiêu đề thông báo" aria-required="true" />
          <textarea placeholder="Nội dung chi tiết (mô tả tình trạng, hướng dẫn xử lý...)"
            value={body} onChange={e => setBody(e.target.value)} rows={4}
            style={{ ...s.input, resize: 'vertical', minHeight: 100 }}
            aria-label="Nội dung thông báo" aria-required="true" />
          <input type="url" placeholder="Link ảnh minh họa (không bắt buộc)" value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            style={s.input} aria-label="URL ảnh minh họa" />
        </section>

        <section style={s.section}>
          <p style={s.sLabel}>Gửi đến ai?</p>
          <p style={s.sDesc}>Để trống = gửi tất cả nông dân</p>
          <input type="text" placeholder="Vùng / ấp (ví dụ: Trường Khánh)" value={region}
            onChange={e => setRegion(e.target.value)}
            style={s.input} aria-label="Lọc theo vùng" />
        </section>

        <section style={s.section}>
          <p style={s.sLabel}>Thời gian gửi</p>
          <p style={s.sDesc}>Để trống = gửi ngay. Chọn thời gian để lên lịch.</p>
          <input id="schedule-time" type="datetime-local" value={scheduleAt}
            onChange={e => setScheduleAt(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            style={s.input} />
        </section>

        {error && <p style={s.error} role="alert">{error}</p>}

        <button onClick={handleSend} disabled={sendMutation.isPending}
          style={{ ...s.btnPrimary, opacity: sendMutation.isPending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          aria-busy={sendMutation.isPending}>
          {sendMutation.isPending
            ? 'Đang gửi...'
            : scheduleAt
              ? <><Clock size={18} strokeWidth={2} /> Lên lịch gửi</>
              : <><Send size={18} strokeWidth={2} /> Gửi ngay</>}
        </button>
      </main>
    </div>
  )
}

const s = {
  page:        { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fdf8f5', fontFamily: "'Noto Sans', sans-serif", maxWidth: 520, margin: '0 auto' },
  header:      { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 },
  iconBtn:     { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title:       { fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0 },
  main:        { flex: 1, padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 },
  section:     { background: '#fff', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid #e2e8f0' },
  sLabel:      { fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 },
  sDesc:       { fontSize: 12, color: '#94a3b8', margin: '-4px 0 0' },
  typeOption:  { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1.5px solid', transition: 'all 0.15s' },
  input:       { padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a', background: '#fff', width: '100%', boxSizing: 'border-box' },
  error:       { color: '#ef4444', fontSize: 14, background: '#fef2f2', padding: '10px 14px', borderRadius: 10, margin: 0 },
  btnPrimary:  { padding: '14px', fontSize: 16, fontWeight: 700, background: '#7a3b10', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', minHeight: 52 },
  btnSecondary:{ padding: '11px 20px', fontSize: 14, background: 'transparent', color: '#7a3b10', border: '1.5px solid #f5d5b0', borderRadius: 10, cursor: 'pointer' },
}
