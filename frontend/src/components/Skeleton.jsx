// Skeleton loading placeholders

export function SkeletonBlock({ width = '100%', height = 16, radius = 8, style }) {
  return (
    <div className="skeleton" style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }} />
  )
}

export function NotifCardSkeleton() {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0',
      borderRadius: 12, padding: '12px 14px',
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <SkeletonBlock width={36} height={36} radius={10} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <SkeletonBlock width="60%" height={14} />
        <SkeletonBlock width="90%" height={12} />
        <SkeletonBlock width="75%" height={12} />
      </div>
      <SkeletonBlock width={36} height={28} radius={6} />
    </div>
  )
}

export function QueueCardSkeleton() {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0',
      borderRadius: 12, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonBlock width="55%" height={15} />
        <SkeletonBlock width={52} height={22} radius={99} />
      </div>
      <SkeletonBlock width="85%" height={13} />
      <SkeletonBlock width="40%" height={13} />
    </div>
  )
}

export function UserCardSkeleton() {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0',
      borderRadius: 12, padding: '14px 16px',
      display: 'flex', gap: 12, alignItems: 'center',
    }}>
      <SkeletonBlock width={40} height={40} radius={999} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <SkeletonBlock width="50%" height={14} />
        <SkeletonBlock width="35%" height={12} />
      </div>
      <SkeletonBlock width={60} height={28} radius={8} />
    </div>
  )
}
