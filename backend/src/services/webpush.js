import webpush from 'web-push'
import { supabase } from './supabase.js'

// ─── Gửi push tới danh sách subscriptions ────────────────────────────────────
async function sendToSubscriptions(subscriptions, payload) {
  if (!subscriptions?.length) return
  await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload
      ).catch(err => {
        console.warn('[PUSH] send failed:', err.message)
        // Nếu subscription hết hạn (410 Gone) → đánh dấu inactive
        if (err.statusCode === 410) {
          supabase.from('push_subscriptions')
            .update({ active: false })
            .eq('endpoint', sub.endpoint)
            .then(() => {})
            .catch(() => {})
        }
      })
    )
  )
}

// ─── Notify kỹ sư khi có câu hỏi mới ────────────────────────────────────────
export async function notifyEngineer(title, body) {
  const { data: engineers } = await supabase
    .from('users')
    .select('id')
    .in('role', ['engineer', 'admin'])
    .eq('is_active', true)

  if (!engineers?.length) return

  const userIds = engineers.map(e => e.id)
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys')
    .in('user_id', userIds)
    .eq('active', true)

  const payload = JSON.stringify({
    title,
    body,
    url:  '/engineer/queue',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    actions: [
      { action: 'view', title: 'Xem ngay' },
      { action: 'dismiss', title: 'Bỏ qua' },
    ],
    tag:     'engineer-queue',       // Gộp nhiều notif cùng tag thành 1
    renotify: true,
  })

  await sendToSubscriptions(subscriptions, payload)
}

// ─── Notify nông dân khi kỹ sư trả lời ───────────────────────────────────────
export async function notifyFarmer(userId, title, body) {
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys')
    .eq('user_id', userId)
    .eq('active', true)

  const payload = JSON.stringify({
    title,
    body,
    url:  '/notifications',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    actions: [
      { action: 'view', title: 'Xem câu trả lời' },
    ],
    tag:     `farmer-answer-${userId}`,
    renotify: true,
  })

  await sendToSubscriptions(subscriptions, payload)
}
