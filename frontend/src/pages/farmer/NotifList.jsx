import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/authStore'
import { pushAPI } from '../../services/api'
import { usePush } from '../../hooks/usePush'
import { ChevronLeft, Settings, Bell, AlertTriangle, Tag, Cloud } from 'lucide-react'

const TYPE_CONFIG = {
  alert:     { label: 'Cảnh báo',   Icon: AlertTriangle, bg: '#fef2f2', border: '#fecaca', color: '#ef4444' },
  promotion: { label: 'Khuyến mãi', Icon: Tag,           bg: '#eff6ff', border: '#bfdbfe', color: '#3b82f6' },
  weather:   { label: 'Thời tiết',  Icon: Cloud,         bg: '#fffbeb', border: '#fde68a', color: '#f59e0b' },
}

function NotifCard({ notif, onRead, onPress }) {
  const cfg     = TYPE_CONFIG[notif.type] || TYPE_CONFIG.alert
  const date    = new Date(notif.sent_at)
  const dateStr = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  return (
    <div onClick={() => { onRead(notif.id); onPress(notif) }} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onPress(notif)}
      aria-label={`${notif.is_read ? '' : 'Chưa đọc — '}${notif.title}`}
      style={{ ...styles.card, background: notif.is_read ? '#fff' : cfg.bg, borderColor: notif.is_read ? '#e2e8f0' : cfg.border, cursor: 'pointer' }}>
      <div style={styles.cardHead}>
        <div style={{ ...styles.typeIconWrap, background: notif.is_read ? '#f8fafc' : '#fff' }}>
          <cfg.Icon size={18} color={cfg.color} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.cardTitle}>
            {!notif.is_read && <span style={styles.unreadDot} aria-hidden="true" />}
            <span style={{ color: notif.is_read ? '#0f172a' : cfg.color }}>{notif.title}</span>
          </div>
          <p style={styles.cardBody}>{notif.body.slice(0, 80)}{notif.body.length > 80 ? '...' : ''}</p>
        </div>
        <span style={styles.cardDate}>{dateStr}{'\n'}{timeStr}</span>
      </div>
    </div>
  )
}

export default function NotifList() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const { user }    = useAuthStore()
  const { permission, isSubscribed, subscribe } = usePush(user?.id)
  const [filter, setFilter] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn:  () => pushAPI.getNotifications(user.id).then(r => r.data.notifications),
    enabled:  !!user?.id,
    refetchInterval: 60_000,
  })

  const markRead = useMutation({
    mutationFn: (id) => pushAPI.markRead(id, user.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const notifications = (data || []).filter(n => {
    if (filter === 'all')    return true
    if (filter === 'unread') return !n.is_read
    return n.type === filter
  })
  const unreadCount = (data || []).filter(n => !n.is_read).length

  const FILTERS = [
    { key: 'all',       label: 'Tất cả' },
    { key: 'unread',    label: `Chưa đọc${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
    { key: 'alert',     label: 'Cảnh báo' },
    { key: 'promotion', label: 'Khuyến mãi' },
    { key: 'weather',   label: 'Thời tiết' },
  ]

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button onClick={() => navigate('/home')} style={styles.iconBtn} aria-label="Quay lại">
          <ChevronLeft size={22} />
        </button>
        <h1 style={styles.title}>
          Thông báo
          {unreadCount > 0 && <span style={styles.badge} aria-label={`${unreadCount} chưa đọc`}>{unreadCount}</span>}
        </h1>
        <button onClick={() => navigate('/notifications/settings')} style={styles.iconBtn} aria-label="Cài đặt thông báo">
          <Settings size={20} />
        </button>
      </header>

      {permission !== 'granted' && !isSubscribed && (
        <div style={styles.pushBanner}>
          <Bell size={20} color="#16a34a" strokeWidth={2} />
          <div style={{ flex: 1 }}>
            <p style={styles.pushBannerTitle}>Bật thông báo để nhận cảnh báo sâu bệnh</p>
            <p style={styles.pushBannerSub}>Nhận ngay khi có dịch bệnh xuất hiện trong vùng bạn</p>
          </div>
          <button onClick={subscribe} style={styles.pushBannerBtn}>Bật</button>
        </div>
      )}

      <div style={styles.filterRow} role="tablist" aria-label="Lọc thông báo">
        {FILTERS.map(f => (
          <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
            style={{ ...styles.filterBtn, background: filter === f.key ? '#16a34a' : 'transparent', color: filter === f.key ? '#fff' : '#64748b', fontWeight: filter === f.key ? 700 : 400 }}>
            {f.label}
          </button>
        ))}
      </div>

      <main style={styles.main} role="feed" aria-label="Danh sách thông báo" aria-live="polite" aria-busy={isLoading}>
        {isLoading ? (
          <p style={styles.empty}>Đang tải...</p>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Bell size={48} color="#e2e8f0" strokeWidth={1} />
            <p style={styles.empty}>
              {filter === 'unread' ? 'Không có thông báo chưa đọc.' : 'Chưa có thông báo nào.'}
            </p>
          </div>
        ) : (
          notifications.map(n => (
            <NotifCard key={n.id} notif={n}
              onRead={id => markRead.mutate(id)}
              onPress={notif => navigate(`/notifications/${notif.id}`, { state: { notif } })} />
          ))
        )}
      </main>
    </div>
  )
}

const styles = {
  page:            { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: '0 auto' },
  header:          { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 },
  iconBtn:         { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title:           { flex: 1, fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 },
  badge:           { background: '#ef4444', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 700, padding: '2px 7px' },
  pushBanner:      { margin: '10px 16px 0', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center' },
  pushBannerTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 },
  pushBannerSub:   { fontSize: 12, color: '#64748b', margin: '2px 0 0' },
  pushBannerBtn:   { padding: '7px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' },
  filterRow:       { display: 'flex', padding: '8px 12px', gap: 6, background: '#fff', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' },
  filterBtn:       { padding: '5px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 },
  main:            { flex: 1, padding: '10px 14px', paddingBottom: 'max(24px, calc(24px + env(safe-area-inset-bottom)))', display: 'flex', flexDirection: 'column', gap: 8 },
  empty:           { color: '#94a3b8', fontSize: 15, textAlign: 'center', margin: '16px 0 0' },
  card:            { border: '1px solid', borderRadius: 12, padding: '12px 14px', transition: 'border-color 0.2s' },
  cardHead:        { display: 'flex', gap: 10, alignItems: 'flex-start' },
  typeIconWrap:    { width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle:       { fontSize: 15, fontWeight: 700, margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: 6 },
  cardBody:        { fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.5 },
  cardDate:        { fontSize: 11, color: '#94a3b8', whiteSpace: 'pre', textAlign: 'right', flexShrink: 0 },
  unreadDot:       { width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 },
}
