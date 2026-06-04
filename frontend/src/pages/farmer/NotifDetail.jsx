import { useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { pushAPI } from '../../services/api'
import { ChevronLeft, MessageCircle, AlertTriangle, Tag, Cloud } from 'lucide-react'

const TYPE_CONFIG = {
  alert:     { label: 'Cảnh báo dịch bệnh', Icon: AlertTriangle, color: '#ef4444' },
  promotion: { label: 'Khuyến mãi vật tư',  Icon: Tag,           color: '#3b82f6' },
  weather:   { label: 'Thông tin thời tiết', Icon: Cloud,         color: '#f59e0b' },
}

export default function NotifDetail() {
  const navigate = useNavigate()
  const { id }   = useParams()
  const location = useLocation()
  const { user } = useAuthStore()
  const notif    = location.state?.notif

  useEffect(() => {
    if (notif && !notif.is_read && user?.id) {
      pushAPI.markRead(id, user.id).catch(() => {})
    }
  }, [id])

  if (!notif) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ color: '#94a3b8' }}>Không tìm thấy thông báo.</p>
        <button onClick={() => navigate('/notifications')} style={styles.backBtn}>← Quay lại</button>
      </div>
    )
  }

  const cfg     = TYPE_CONFIG[notif.type] || TYPE_CONFIG.alert
  const dateStr = new Date(notif.sent_at).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button onClick={() => navigate('/notifications')} style={styles.iconBtn} aria-label="Quay lại">
          <ChevronLeft size={22} />
        </button>
        <div style={{ ...styles.typeBadge, color: cfg.color }}>
          <cfg.Icon size={15} strokeWidth={2} /> {cfg.label}
        </div>
      </header>

      <main style={styles.main}>
        {notif.image_url && (
          <img src={notif.image_url} alt="Ảnh thông báo" style={styles.image} />
        )}

        <h1 style={styles.title}>{notif.title}</h1>
        <time style={styles.date} dateTime={notif.sent_at}>{dateStr}</time>

        <div style={styles.body}>
          {notif.body.split('\n').map((line, i) => (
            <p key={i} style={{ margin: '0 0 8px', lineHeight: 1.7 }}>{line}</p>
          ))}
        </div>

        {notif.crop_tags?.length > 0 && (
          <div style={styles.tagRow}>
            <span style={styles.tagLabel}>Áp dụng cho:</span>
            {notif.crop_tags.map(tag => (
              <span key={tag} style={styles.tag}>
                {tag === 'rice' ? 'Lúa' : tag === 'veggie' ? 'Rau' : tag === 'fruit' ? 'Cây ăn trái' : tag}
              </span>
            ))}
          </div>
        )}

        <button onClick={() => navigate('/chat', { state: { prefillText: `Về thông báo "${notif.title}": ${notif.body.slice(0, 100)}` } })}
          style={styles.btnAsk} aria-label="Hỏi Cò Con về vấn đề này">
          <MessageCircle size={20} strokeWidth={2} />
          Hỏi Cò Con về vấn đề này
        </button>
      </main>
    </div>
  )
}

const styles = {
  page:      { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: '0 auto' },
  header:    { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: '#fff', zIndex: 10 },
  iconBtn:   { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  typeBadge: { fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 },
  main:      { flex: 1, padding: '20px 16px', paddingBottom: 'max(32px, calc(32px + env(safe-area-inset-bottom)))', display: 'flex', flexDirection: 'column', gap: 14 },
  image:     { width: '100%', borderRadius: 12, objectFit: 'cover', maxHeight: 200, border: '1px solid #e2e8f0' },
  title:     { fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.3 },
  date:      { fontSize: 13, color: '#94a3b8' },
  body:      { fontSize: 16, color: '#0f172a', lineHeight: 1.7 },
  tagRow:    { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  tagLabel:  { fontSize: 13, color: '#94a3b8' },
  tag:       { fontSize: 12, background: '#fdf6f0', color: '#4B230A', padding: '3px 10px', borderRadius: 99 },
  btnAsk:    { padding: '14px', fontSize: 17, fontWeight: 700, background: '#4B230A', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  backBtn:   { padding: '10px 20px', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', fontSize: 14, color: '#64748b', marginTop: 12 },
}
