import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/authStore'
import { pushAPI } from '../../services/api'
import { usePush } from '../../hooks/usePush'
import { NotifCardSkeleton } from '../../components/Skeleton'
import { ChevronLeft, Settings, Bell, AlertTriangle, Tag, Cloud, ChevronRight } from 'lucide-react'

const TYPE_CONFIG = {
  alert:     { label: 'Cảnh báo',   Icon: AlertTriangle, bg: '#fef2f2', border: '#fecaca', color: '#ef4444', dot: '#ef4444' },
  promotion: { label: 'Khuyến mãi', Icon: Tag,           bg: '#eff6ff', border: '#bfdbfe', color: '#3b82f6', dot: '#3b82f6' },
  weather:   { label: 'Thời tiết',  Icon: Cloud,         bg: '#fffbeb', border: '#fde68a', color: '#f59e0b', dot: '#f59e0b' },
}

function NotifCard({ notif, onRead, onPress }) {
  const [hovered, setHovered] = useState(false)
  const cfg     = TYPE_CONFIG[notif.type] || TYPE_CONFIG.alert
  const date    = new Date(notif.sent_at)
  const dateStr = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  return (
    <div
      onClick={() => { onRead(notif.id); onPress(notif) }}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onPress(notif)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`${notif.is_read ? '' : 'Chưa đọc — '}${notif.title}`}
      style={{
        ...styles.card,
        background: notif.is_read ? (hovered ? '#fafcff' : '#fff') : cfg.bg,
        borderColor: notif.is_read ? (hovered ? '#d1d5db' : '#f1f5f9') : cfg.border,
        borderLeft: !notif.is_read ? `3px solid ${cfg.dot}` : '1px solid',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.07)' : '0 1px 3px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        animation: 'fadeUp 0.25s ease both',
      }}>
      <div style={styles.cardHead}>
        <div style={{ ...styles.typeIconWrap, background: notif.is_read ? '#fdf8f5' : '#fff' }}>
          <cfg.Icon size={17} color={cfg.color} strokeWidth={2} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.cardTitle}>
            {!notif.is_read && (
              <span style={{ ...styles.unreadDot, background: cfg.dot }} aria-hidden="true" />
            )}
            <span style={{
              color: notif.is_read ? '#0f172a' : '#0f172a',
              fontWeight: notif.is_read ? 600 : 700,
            }}>
              {notif.title}
            </span>
          </div>
          <p style={styles.cardBody}>{notif.body.slice(0, 85)}{notif.body.length > 85 ? '...' : ''}</p>
          <div style={styles.cardMeta}>
            <span style={{ ...styles.typeBadge, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
              {cfg.label}
            </span>
            <span style={styles.cardDate}>{dateStr} · {timeStr}</span>
          </div>
        </div>

        <ChevronRight size={16} color="#cbd5e1" style={{ flexShrink: 0, marginLeft: 4 }} />
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
      {/* Header */}
      <header style={styles.header}>
        <button onClick={() => navigate('/home')} style={styles.iconBtn} aria-label="Quay lại">
          <ChevronLeft size={22} strokeWidth={2} />
        </button>
        <h1 style={styles.title}>
          Thông báo
          {unreadCount > 0 && (
            <span style={styles.badge} aria-label={`${unreadCount} chưa đọc`}>{unreadCount}</span>
          )}
        </h1>
        <button onClick={() => navigate('/notifications/settings')} style={styles.iconBtn} aria-label="Cài đặt thông báo">
          <Settings size={18} strokeWidth={1.5} />
        </button>
      </header>

      {/* Push permission banner */}
      {permission !== 'granted' && !isSubscribed && (
        <div style={styles.pushBanner} className="fade-up">
          <div style={styles.pushIconWrap}>
            <Bell size={18} color="#7a3b10" strokeWidth={2} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={styles.pushBannerTitle}>Bật thông báo để nhận cảnh báo sâu bệnh</p>
            <p style={styles.pushBannerSub}>Nhận ngay khi có dịch bệnh xuất hiện trong vùng bạn</p>
          </div>
          <button onClick={subscribe} style={styles.pushBannerBtn}>Bật</button>
        </div>
      )}

      {/* Filter tabs */}
      <div style={styles.filterRow} role="tablist" aria-label="Lọc thông báo">
        {FILTERS.map(f => (
          <button key={f.key} role="tab" aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            style={{
              ...styles.filterBtn,
              background: filter === f.key ? '#7a3b10' : 'transparent',
              color:      filter === f.key ? '#fff' : '#64748b',
              fontWeight: filter === f.key ? 700 : 400,
              boxShadow:  filter === f.key ? '0 2px 6px rgba(22,163,74,0.25)' : 'none',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main style={styles.main} role="feed" aria-label="Danh sách thông báo" aria-live="polite" aria-busy={isLoading}>
        {isLoading ? (
          // Skeleton loading
          <>
            {Array.from({ length: 5 }).map((_, i) => (
              <NotifCardSkeleton key={i} />
            ))}
          </>
        ) : notifications.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIconWrap}>
              <Bell size={32} color="#cbd5e1" strokeWidth={1.5} />
            </div>
            <p style={styles.emptyTitle}>
              {filter === 'unread' ? 'Bạn đã đọc hết rồi!' : 'Chưa có thông báo nào'}
            </p>
            <p style={styles.emptySub}>
              {filter === 'unread'
                ? 'Tuyệt vời — không có thông báo nào chưa đọc.'
                : 'Thông báo sâu bệnh và cảnh báo sẽ xuất hiện ở đây.'}
            </p>
          </div>
        ) : (
          notifications.map((n, i) => (
            <div key={n.id} style={{ animationDelay: `${i * 0.04}s` }}>
              <NotifCard notif={n}
                onRead={id => markRead.mutate(id)}
                onPress={notif => navigate(`/notifications/${notif.id}`, { state: { notif } })} />
            </div>
          ))
        )}
      </main>
    </div>
  )
}

const styles = {
  page:           { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fdf8f5', fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: '0 auto' },
  header:         { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' },
  iconBtn:        { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title:          { flex: 1, fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 },
  badge:          { background: '#ef4444', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 700, padding: '2px 7px' },
  pushBanner:     { margin: '10px 14px 0', background: '#fdf6f0', border: '1px solid #f5d5b0', borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center' },
  pushIconWrap:   { width: 36, height: 36, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pushBannerTitle:{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 },
  pushBannerSub:  { fontSize: 12, color: '#64748b', margin: '2px 0 0', lineHeight: 1.4 },
  pushBannerBtn:  { padding: '7px 14px', background: '#7a3b10', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(22,163,74,0.3)' },
  filterRow:      { display: 'flex', padding: '10px 12px', gap: 6, background: '#fff', borderBottom: '1px solid #f1f5f9', overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  filterBtn:      { padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0, fontFamily: "'Noto Sans', sans-serif", transition: 'background 0.15s, color 0.15s, box-shadow 0.15s' },
  main:           { flex: 1, padding: '10px 14px', paddingBottom: 'max(24px, calc(24px + env(safe-area-inset-bottom)))', display: 'flex', flexDirection: 'column', gap: 8 },
  card:           { border: '1px solid', borderRadius: 14, padding: '12px 14px', transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease' },
  cardHead:       { display: 'flex', gap: 10, alignItems: 'flex-start' },
  typeIconWrap:   { width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle:      { fontSize: 14, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.4 },
  cardBody:       { fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.5 },
  cardMeta:       { display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' },
  typeBadge:      { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99 },
  cardDate:       { fontSize: 11, color: '#94a3b8' },
  unreadDot:      { width: 7, height: 7, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  emptyState:     { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '60px 20px 40px', textAlign: 'center' },
  emptyIconWrap:  { width: 72, height: 72, borderRadius: 22, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:     { fontSize: 16, fontWeight: 700, color: '#374151', margin: 0 },
  emptySub:       { fontSize: 14, color: '#94a3b8', margin: 0, lineHeight: 1.6, maxWidth: 260 },
}
