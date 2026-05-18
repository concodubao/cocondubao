import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { Bell, Smartphone, MessageCircle, Home } from 'lucide-react'

export default function WaitEngineer() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sessionId, messageId } = location.state || {}

  useEffect(() => {
    if (!sessionId || !messageId) return
    const channel = supabase
      .channel(`engineer-reply-${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'engineer_queue', filter: `message_id=eq.${messageId}` },
        payload => { if (payload.new.status === 'resolved') navigate('/chat', { state: { sessionId, scrollToBottom: true } }) })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [sessionId, messageId])

  return (
    <div style={styles.page}>
      <div style={styles.content}>
        <div style={styles.iconWrap}>
          <MessageCircle size={40} color="#16a34a" strokeWidth={1.5} />
        </div>
        <h1 style={styles.title}>Đã gửi cho kỹ sư!</h1>
        <p style={styles.desc}>
          Câu hỏi của bạn đã được chuyển cho kỹ sư nông nghiệp.{'\n'}
          Kỹ sư sẽ trả lời trong vòng <strong>24 giờ</strong>.
        </p>
        <div style={styles.card}>
          <div style={styles.cardRow}>
            <Bell size={18} color="#64748b" strokeWidth={1.5} />
            <span>Bạn sẽ nhận thông báo ngay khi có câu trả lời</span>
          </div>
          <div style={styles.cardRow}>
            <Smartphone size={18} color="#64748b" strokeWidth={1.5} />
            <span>Bạn có thể đóng ứng dụng, thông báo vẫn đến</span>
          </div>
        </div>
        <button onClick={() => navigate('/chat')} style={styles.btnAsk}>
          Hỏi câu khác
        </button>
        <button onClick={() => navigate('/home')} style={styles.btnHome}>
          <Home size={16} strokeWidth={2} /> Về trang chủ
        </button>
      </div>
    </div>
  )
}

const styles = {
  page:    { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '48px 20px', paddingBottom: 'max(48px, calc(48px + env(safe-area-inset-bottom)))', fontFamily: "'Noto Sans', sans-serif" },
  content: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 380, width: '100%' },
  iconWrap:{ width: 80, height: 80, borderRadius: 24, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #bbf7d0' },
  title:   { fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0, textAlign: 'center' },
  desc:    { fontSize: 16, color: '#64748b', textAlign: 'center', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' },
  card:    { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px', width: '100%', display: 'flex', flexDirection: 'column', gap: 12 },
  cardRow: { display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 15, color: '#64748b', lineHeight: 1.5 },
  btnAsk:  { width: '100%', padding: '14px', fontSize: 17, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' },
  btnHome: { width: '100%', padding: '13px', fontSize: 15, background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
}
