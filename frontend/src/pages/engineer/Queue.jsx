import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { engineerAPI } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../services/supabase'
import { ChevronLeft, BookOpen, RefreshCw, CheckCircle, Clock, Trash2 } from 'lucide-react'

function WaitBadge({ minutes }) {
  const urgent = minutes > 60
  const warn   = minutes > 30
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
      background: urgent ? '#fef2f2' : warn ? '#fffbeb' : '#f0fdf4',
      color:      urgent ? '#ef4444' : warn ? '#f59e0b' : '#16a34a',
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <Clock size={10} strokeWidth={2} />
      {minutes < 60 ? `${minutes} phút` : `${Math.round(minutes / 60)} giờ`} chờ
    </span>
  )
}

function QueueCard({ item, onTake, onDelete, currentUserId, deleting }) {
  const msg          = item.messages
  const user         = msg?.chat_sessions?.users
  const crop         = msg?.chat_sessions?.crop_type
  const isMyItem     = item.status === 'in_progress' && item.assigned_to === currentUserId
  const isOthersItem = item.status === 'in_progress' && item.assigned_to !== currentUserId
  const isDeleting   = deleting === item.id

  return (
    <div style={styles.card}>
      <div style={styles.cardHead}>
        <div>
          <span style={styles.farmerName}>{user?.name || 'Nông dân'}</span>
          {user?.village && <span style={styles.village}> · {user.village}</span>}
        </div>
        <WaitBadge minutes={item.waitMinutes} />
      </div>
      <p style={styles.question}>{msg?.content}</p>
      {msg?.image_url && (
        <img src={msg.image_url} alt="Ảnh sâu bệnh" style={styles.thumb} />
      )}
      <div style={styles.cardMeta}>
        {crop && <span style={styles.cropTag}>{crop === 'rice' ? 'Lúa' : crop}</span>}
        {msg?.confidence != null && (
          <span style={styles.confTag}>AI tin cậy {Math.round(msg.confidence * 100)}%</span>
        )}
      </div>
      <div style={styles.cardActions}>
        {isOthersItem ? (
          <div style={styles.processingNote}>Kỹ sư khác đang xử lý</div>
        ) : (
          <button onClick={() => onTake(item)} style={styles.btnTake}>
            {isMyItem ? 'Tiếp tục trả lời →' : 'Nhận & Trả lời →'}
          </button>
        )}
        {/* Admin xóa được tất cả; engineer chỉ xóa của mình hoặc pending */}
        {!isOthersItem && (
          <button
            onClick={() => onDelete(item.id)}
            disabled={isDeleting}
            style={{ ...styles.btnDelete, opacity: isDeleting ? 0.6 : 1 }}
            aria-label="Xóa câu hỏi này"
          >
            <Trash2 size={14} strokeWidth={1.5} />
            {isDeleting ? 'Đang xóa...' : 'Xóa'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Queue() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [queue,   setQueue]   = useState([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('pending')
  const [deleting, setDeleting] = useState(null)

  async function loadQueue() {
    setLoading(true)
    try {
      const res = await engineerAPI.getQueue(tab)
      setQueue(res.data.queue || [])
    } catch (err) {
      console.error('[QUEUE] load error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadQueue() }, [tab])

  useEffect(() => {
    const channel = supabase.channel('engineer-queue-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'engineer_queue' }, () => loadQueue())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [tab])

  async function handleTake(item) {
    if (item.status === 'in_progress' && item.assigned_to === user?.id) {
      navigate(`/engineer/answer/${item.id}`, { state: { queueItem: item } })
      return
    }
    try {
      await engineerAPI.take(item.id)
      navigate(`/engineer/answer/${item.id}`, { state: { queueItem: item } })
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể nhận câu hỏi này.')
      loadQueue()
    }
  }

  async function handleDelete(id) {
    if (!confirm('Xóa câu hỏi này khỏi hàng đợi? Nông dân sẽ không nhận được câu trả lời.')) return
    setDeleting(id)
    try {
      await engineerAPI.deleteQueueItem(id)
      setQueue(prev => prev.filter(q => q.id !== id))
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể xóa. Thử lại nhé.')
    } finally {
      setDeleting(null)
    }
  }

  const TABS = [
    { key: 'pending',     label: 'Chờ trả lời' },
    { key: 'in_progress', label: 'Đang xử lý' },
  ]

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button onClick={() => navigate('/home')} style={styles.iconBtn} aria-label="Quay lại">
          <ChevronLeft size={22} />
        </button>
        <h1 style={styles.title}>Hàng đợi câu hỏi</h1>
        <button onClick={() => navigate('/engineer/knowledge')} style={styles.iconBtn} aria-label="Kho tri thức">
          <BookOpen size={20} />
        </button>
      </header>

      <div style={styles.tabs} role="tablist">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            style={{ ...styles.tab, background: tab === t.key ? '#16a34a' : 'transparent', color: tab === t.key ? '#fff' : '#64748b', fontWeight: tab === t.key ? 700 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      <main style={styles.main} role="region" aria-label="Danh sách câu hỏi" aria-live="polite">
        {loading ? (
          <div style={styles.empty}><p style={{ color: '#94a3b8' }}>Đang tải...</p></div>
        ) : queue.length === 0 ? (
          <div style={styles.empty}>
            <CheckCircle size={48} color="#bbf7d0" strokeWidth={1} />
            <p style={{ color: '#64748b', fontSize: 16, textAlign: 'center' }}>
              {tab === 'pending' ? 'Không có câu hỏi nào đang chờ.' : 'Không có câu hỏi đang xử lý.'}
            </p>
          </div>
        ) : (
          queue.map(item => (
            <QueueCard
              key={item.id}
              item={item}
              onTake={handleTake}
              onDelete={handleDelete}
              currentUserId={user?.id}
              deleting={deleting}
            />
          ))
        )}
      </main>

      <footer style={{ padding: '10px 16px', textAlign: 'center' }}>
        <button onClick={loadQueue} style={styles.refreshBtn} aria-label="Tải lại">
          <RefreshCw size={14} strokeWidth={2} /> Tải lại
        </button>
      </footer>
    </div>
  )
}

const styles = {
  page:          { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: "'Noto Sans', sans-serif", maxWidth: 520, margin: '0 auto' },
  header:        { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 },
  iconBtn:       { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title:         { flex: 1, fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0 },
  tabs:          { display: 'flex', padding: '8px 12px', gap: 8, background: '#fff', borderBottom: '1px solid #e2e8f0' },
  tab:           { padding: '7px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 14, transition: 'all 0.2s' },
  main:          { flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 },
  empty:         { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  card:          { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  cardHead:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  farmerName:    { fontSize: 14, fontWeight: 700, color: '#0f172a' },
  village:       { fontSize: 13, color: '#94a3b8' },
  question:      { fontSize: 16, color: '#0f172a', margin: 0, lineHeight: 1.6 },
  thumb:         { width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' },
  cardMeta:      { display: 'flex', gap: 8, flexWrap: 'wrap' },
  cropTag:       { fontSize: 12, background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: 99 },
  confTag:       { fontSize: 12, background: '#fffbeb', color: '#d97706', padding: '2px 8px', borderRadius: 99 },
  cardActions:   { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  btnTake:       { flex: 1, padding: '11px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 700, minHeight: 44 },
  btnDelete:     { padding: '10px 12px', background: 'transparent', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 10, cursor: 'pointer', fontSize: 13, minHeight: 44, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' },
  processingNote:{ flex: 1, padding: '11px 14px', background: '#f1f5f9', color: '#94a3b8', borderRadius: 10, fontSize: 14, textAlign: 'center', fontWeight: 500 },
  refreshBtn:    { background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 14, cursor: 'pointer', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 },
}
