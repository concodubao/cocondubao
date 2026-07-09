import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { chatAPI } from '../../services/api'
import { Bell, Smartphone, MessageCircle, Home } from 'lucide-react'

export default function WaitEngineer() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sessionId } = location.state || {}
  // Mốc thời gian (ms) câu trả lời kỹ sư MỚI NHẤT lúc vào màn này; xuất hiện câu mới hơn
  // = kỹ sư vừa trả lời. So theo thời điểm thay vì đếm số lượng để bền với phân trang
  // (câu mới luôn là tin mới nhất) và với việc xoá tin cũ.
  const baselineRef = useRef(null)

  // Realtime Supabase ở đây là no-op: client dùng anon key (không đăng nhập Supabase
  // Auth) nên auth.uid()=NULL, mà engineer_queue bật RLS không policy → bị chặn → không
  // nhận UPDATE. Thay bằng polling getMessages: khi có câu trả lời 'engineer' mới hơn
  // mốc → tự nhảy về chat. Tạm dừng hẳn khi tab ẩn (cùng pattern với Queue.jsx).
  // (Nông dân vẫn nhận push song song; đây là lối tự động khi đang mở app.)
  useEffect(() => {
    if (!sessionId) return
    let timer = null
    let navigated = false

    const start = () => { if (!timer) timer = setInterval(check, 12_000) }
    const stop  = () => { if (timer) { clearInterval(timer); timer = null } }

    async function check() {
      try {
        const res = await chatAPI.getMessages(sessionId)
        // getMessages trả raw (select('*')) → message kỹ sư có role/source = 'engineer'.
        const msgs = res.data.messages || []
        const latestEngineerMs = msgs.reduce((max, m) => {
          if (m.role !== 'engineer' && m.source !== 'engineer') return max
          const t = Date.parse(m.created_at)
          return t > max ? t : max
        }, 0)
        // Lần đầu: ghi mốc câu trả lời kỹ sư mới nhất hiện có (thường chưa có → 0).
        if (baselineRef.current === null) { baselineRef.current = latestEngineerMs; return }
        if (!navigated && latestEngineerMs > baselineRef.current) {
          navigated = true
          stop()
          navigate('/chat', { state: { sessionId, scrollToBottom: true } })
        }
      } catch { /* lỗi mạng tạm thời: bỏ qua, lần poll sau thử lại */ }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') { check(); start() } else stop()
    }

    check()
    start()
    document.addEventListener('visibilitychange', onVisible)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisible) }
  }, [sessionId, navigate])

  return (
    <div style={styles.page}>
      {/* Vùng trên — icon + tiêu đề + mô tả */}
      <div style={styles.topSection}>
        <div style={styles.iconWrap}>
          <MessageCircle size={48} color="#4B230A" strokeWidth={1.5} />
        </div>
        <h1 style={styles.title}>Đã gửi cho kỹ sư!</h1>
        <p style={styles.desc}>
          Câu hỏi của bạn đã được chuyển cho kỹ sư nông nghiệp.{'\n'}
          Kỹ sư sẽ trả lời trong vòng <strong>24 giờ</strong>.
        </p>
      </div>

      {/* Vùng giữa — thông tin thêm */}
      <div style={styles.card}>
        <div style={styles.cardRow}>
          <div style={styles.cardIconWrap}>
            <Bell size={20} color="#4B230A" strokeWidth={1.5} />
          </div>
          <span style={styles.cardText}>Bạn sẽ nhận thông báo ngay khi có câu trả lời</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.cardRow}>
          <div style={styles.cardIconWrap}>
            <Smartphone size={20} color="#4B230A" strokeWidth={1.5} />
          </div>
          <span style={styles.cardText}>Bạn có thể đóng ứng dụng, thông báo vẫn đến</span>
        </div>
      </div>

      {/* Vùng dưới — nút hành động */}
      <div style={styles.buttons}>
        <button onClick={() => navigate('/chat')} style={styles.btnAsk}>
          <MessageCircle size={18} strokeWidth={2} /> Hỏi câu khác
        </button>
        <button onClick={() => navigate('/home')} style={styles.btnHome}>
          <Home size={18} strokeWidth={2} /> Về trang chủ
        </button>
      </div>
    </div>
  )
}

const styles = {
  page:        { height: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#fdf8f5', padding: '56px 24px', paddingBottom: 'max(56px, env(safe-area-inset-bottom))', fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: '0 auto', boxSizing: 'border-box' },
  topSection:  { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' },
  iconWrap:    { width: 96, height: 96, borderRadius: 28, background: '#fdf6f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #f5d5b0', boxShadow: '0 4px 20px rgba(22,163,74,0.12)' },
  title:       { fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0 },
  desc:        { fontSize: 16, color: '#64748b', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' },
  card:        { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 0 },
  cardRow:     { display: 'flex', gap: 14, alignItems: 'center', padding: '4px 0' },
  cardIconWrap:{ width: 40, height: 40, borderRadius: 12, background: '#fdf6f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardText:    { fontSize: 15, color: '#374151', lineHeight: 1.55 },
  divider:     { height: 1, background: '#f1f5f9', margin: '12px 0' },
  buttons:     { display: 'flex', flexDirection: 'column', gap: 12 },
  btnAsk:      { width: '100%', padding: '16px', fontSize: 17, fontWeight: 700, background: '#4B230A', color: '#fff', border: 'none', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnHome:     { width: '100%', padding: '15px', fontSize: 16, background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
}
