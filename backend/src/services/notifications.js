// backend/src/services/notifications.js
// Gửi thông báo broadcast (admin) tới các thiết bị đã đăng ký — dùng chung cho:
//   - POST /push/send  (gửi ngay)
//   - scheduler         (gửi thông báo đã đặt lịch khi tới hạn)

import webpush      from 'web-push'
import { supabase } from './supabase.js'

// ─── Gửi push tới 1 subscription, đánh dấu inactive nếu hết hạn (410) ────────
export async function sendPush(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return { success: true }
  } catch (err) {
    if (err.statusCode === 410) {
      await supabase
        .from('push_subscriptions')
        .update({ active: false })
        .eq('endpoint', subscription.endpoint)
    }
    return { success: false, error: err.message }
  }
}

// ─── Kiểm tra khung giờ yên tĩnh (hỗ trợ khung qua nửa đêm, vd 22:00-06:00) ──
export function isQuietHour(quietStart, quietEnd) {
  if (!quietStart || !quietEnd) return false
  const now  = new Date()
  const hhmm = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = quietStart.split(':').map(Number)
  const [eh, em] = quietEnd.split(':').map(Number)
  const start = sh * 60 + sm
  const end   = eh * 60 + em
  if (start > end) return hhmm >= start || hhmm < end
  return hhmm >= start && hhmm < end
}

// ─── Gửi 1 notification (đã lưu DB) tới các subscriber phù hợp ───────────────
// notif: { id, title, body, type, image_url, crop_tags }
// Trả về { sent, failed, total } để route/scheduler báo cáo.
export async function dispatchNotification(notif) {
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys, user_id, notif_types, quiet_start, quiet_end')
    .eq('active', true)

  if (!subscriptions?.length) return { sent: 0, failed: 0, total: 0 }

  // Lọc theo loại thông báo user muốn nhận + khung giờ yên tĩnh
  const filtered = subscriptions.filter(sub => {
    if (sub.notif_types && !sub.notif_types.includes(notif.type)) return false
    if (isQuietHour(sub.quiet_start, sub.quiet_end)) return false
    return true
  })

  // Nếu nhắm theo cây trồng → chỉ gửi cho user có crop khớp
  let targetSubs = filtered
  const cropTags = notif.crop_tags || []
  if (cropTags.length > 0) {
    const userIds = [...new Set(filtered.map(s => s.user_id))]
    const { data: users } = await supabase
      .from('users')
      .select('id, crops')
      .in('id', userIds)

    const userMap = Object.fromEntries((users || []).map(u => [u.id, u.crops || []]))
    targetSubs = filtered.filter(sub => {
      const userCrops = userMap[sub.user_id] || []
      return cropTags.some(tag => userCrops.includes(tag))
    })
  }

  const payload = {
    title:   notif.title,
    body:    notif.body,
    image:   notif.image_url || null,
    url:     '/notifications',
    notifId: notif.id,
  }

  const results = await Promise.allSettled(
    targetSubs.map(sub => sendPush({ endpoint: sub.endpoint, keys: sub.keys }, payload))
  )
  const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  return { sent, failed: results.length - sent, total: targetSubs.length }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCHEDULER — gửi thông báo đã đặt lịch khi tới hạn
// ══════════════════════════════════════════════════════════════════════════════

let _processing = false  // tránh chồng lượt nếu 1 lượt chạy lâu hơn interval

export async function processScheduledNotifications() {
  if (_processing) return
  _processing = true
  try {
    const { data: due, error } = await supabase
      .from('notifications')
      .select('id, title, body, type, image_url, crop_tags')
      .is('sent_at', null)
      .not('scheduled_at', 'is', null)
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(50)

    if (error)        { console.warn('[CRON] query scheduled failed:', error.message); return }
    if (!due?.length) return

    for (const notif of due) {
      try {
        const stats = await dispatchNotification(notif)
        await supabase
          .from('notifications')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', notif.id)
        console.log(`[CRON] đã gửi notif đặt lịch ${notif.id} → ${stats.sent}/${stats.total} thiết bị`)
      } catch (e) {
        console.warn(`[CRON] gửi notif ${notif.id} lỗi:`, e.message)
      }
    }
  } finally {
    _processing = false
  }
}

// Khởi động scheduler in-process (gọi 1 lần khi boot).
// LƯU Ý: chạy trong tiến trình web server — đúng khi 1 replica. Nếu scale nhiều
// replica, cần khoá phân tán (vd advisory lock Postgres) để tránh gửi trùng.
export function startNotificationScheduler(intervalMs = 60_000) {
  setInterval(() => {
    processScheduledNotifications().catch(e => console.warn('[CRON]', e.message))
  }, intervalMs)
  console.log(`[CRON] Scheduler thông báo đặt lịch đã chạy (mỗi ${intervalMs / 1000}s)`)
}
