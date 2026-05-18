import webpush from 'web-push'
import { supabase } from './supabase.js'

// Cấu hình VAPID
webpush.setVapidDetails(
  process.env.VAPID_CONTACT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// Gửi thông báo đến kỹ sư khi có câu hỏi mới
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

  if (!subscriptions?.length) return

  const payload = JSON.stringify({ title, body, url: '/engineer/queue' })

  // Gửi đến tất cả kỹ sư, không block nếu 1 người lỗi
  await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload
      ).catch(err => console.warn('Push failed:', err.message))
    )
  )
}

// Gửi thông báo đến nông dân khi kỹ sư trả lời
export async function notifyFarmer(userId, title, body) {
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys')
    .eq('user_id', userId)
    .eq('active', true)

  if (!subscriptions?.length) return

  const payload = JSON.stringify({ title, body, url: '/notifications' })

  await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload)
        .catch(err => console.warn('Push failed:', err.message))
    )
  )
}