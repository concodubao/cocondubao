// backend/src/services/notifications.js
// Gửi thông báo broadcast (admin) tới các thiết bị đã đăng ký — dùng chung cho:
//   - POST /push/send  (gửi ngay)
//   - scheduler         (gửi thông báo đã đặt lịch khi tới hạn)

import webpush      from 'web-push'
import { supabase } from './supabase.js'
import { fetchAllRows } from './dbUtil.js'

// Web Push giới hạn ~4KB/payload (đã mã hoá). Tiêu đề/nội dung dài (tiếng Việt 2–3 byte/ký
// tự) vượt ngưỡng thì push service từ chối → MỌI thiết bị "gửi lỗi". Thông báo đẩy chỉ là
// lời nhắc; nội dung đầy đủ nằm trong app (DB giữ nguyên) nên cắt gọn ở đây.
const PUSH_TITLE_MAX = 100
const PUSH_BODY_MAX  = 300
const clip = (text, max) => {
  const t = String(text || '')
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}

// ─── Gửi push tới 1 subscription, đánh dấu inactive nếu hết hạn (410) ────────
export async function sendPush(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return { success: true }
  } catch (err) {
    // 410 Gone / 404 Not Found = subscription hết hạn hoặc bị huỷ phía push service
    if (err.statusCode === 410 || err.statusCode === 404) {
      await supabase
        .from('push_subscriptions')
        .update({ active: false })
        .eq('endpoint', subscription.endpoint)
    }
    return { success: false, error: err.message }
  }
}

// ─── Kiểm tra khung giờ yên tĩnh (hỗ trợ khung qua nửa đêm, vd 22:00-06:00) ──
// Giờ yên tĩnh do nông dân đặt theo giờ VIỆT NAM. Server Railway chạy UTC → trước
// đây getHours() lệch 7 tiếng: khung 22:00–06:00 thành chặn 05:00–13:00 giờ VN và
// lại GỬI lúc nửa đêm. VN không có giờ mùa hè → cộng cố định +7h.
const VN_OFFSET_MIN = 7 * 60
function vnMinutesOfDay(date = new Date()) {
  return (date.getUTCHours() * 60 + date.getUTCMinutes() + VN_OFFSET_MIN) % (24 * 60)
}

export function isQuietHour(quietStart, quietEnd) {
  if (!quietStart || !quietEnd) return false
  const hhmm = vnMinutesOfDay()
  const [sh, sm] = quietStart.split(':').map(Number)
  const [eh, em] = quietEnd.split(':').map(Number)
  const start = sh * 60 + sm
  const end   = eh * 60 + em
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false // dữ liệu giờ hỏng → không chặn
  if (start > end) return hhmm >= start || hhmm < end
  return hhmm >= start && hhmm < end
}

// Tải đủ người nhận trước khi ghi sent_at để có thể thử lại nếu truy vấn lỗi.
export async function loadNotificationRecipients(notif) {
  // Phân trang: quá 1000 thiết bị thì 1 truy vấn bị cắt âm thầm → phần còn lại không nhận push
  const { data: subscriptions, error } = await fetchAllRows(() => supabase
    .from('push_subscriptions')
    .select('endpoint, keys, user_id, notif_types, quiet_start, quiet_end, crops_filter')
    .eq('active', true)
    .order('endpoint', { ascending: true }))

  if (error) throw error

  // Lọc theo loại thông báo user muốn nhận + khung giờ yên tĩnh
  const filtered = subscriptions.filter(sub => {
    if (sub.notif_types && !sub.notif_types.includes(notif.type)) return false
    if (isQuietHour(sub.quiet_start, sub.quiet_end)) return false
    return true
  })

  // Nếu nhắm theo cây trồng → chỉ gửi cho subscription có crop khớp.
  // Ưu tiên BỘ LỌC CÁ NHÂN của thiết bị (crops_filter); rỗng thì dùng cây trong
  // hồ sơ (users.crops). Trước đây crops_filter được lưu nhưng không bao giờ
  // được dùng khi gửi → cài đặt "lọc theo cây" của nông dân vô tác dụng.
  const cropTags = notif.crop_tags || []
  if (!cropTags.length) return filtered

  const needsProfile = filtered.filter(sub => sub.user_id && !sub.crops_filter?.length)
  const userIds = [...new Set(needsProfile.map(sub => sub.user_id))]
  const cropsByUser = new Map()
  // Keep the UUID list within PostgREST URL and row limits.
  for (let i = 0; i < userIds.length; i += 100) {
    const { data: users, error: profileError } = await supabase
      .from('users')
      .select('id, crops')
      .in('id', userIds.slice(i, i + 100))
    if (profileError) throw profileError
    for (const user of users) cropsByUser.set(user.id, user.crops)
  }
  return filtered.filter(sub => {
    const crops = sub.crops_filter?.length ? sub.crops_filter : cropsByUser.get(sub.user_id)
    return !crops?.length || cropTags.some(tag => crops.includes(tag))
  })
}

export async function dispatchNotification(notif, targetSubs) {
  const payload = {
    title:   clip(notif.title, PUSH_TITLE_MAX),
    body:    clip(notif.body, PUSH_BODY_MAX),
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
        // A lookup failure leaves sent_at NULL so the next scheduler tick can retry.
        const recipients = await loadNotificationRecipients(notif)
        // NHẬN VIỆC trước khi gửi (nguyên tử: chỉ 1 nơi cập nhật được dòng còn sent_at NULL).
        // Trước đây gửi xong mới ghi sent_at: ghi lỗi / process sập giữa chừng / 2 máy cùng
        // chạy scheduler → thông báo bị gửi lại mỗi 60 giây.
        const { data: claimed, error: claimErr } = await supabase
          .from('notifications')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', notif.id)
          .is('sent_at', null)
          .select('id')
        if (claimErr) { console.warn(`[CRON] nhận notif ${notif.id} lỗi:`, claimErr.message); continue }
        if (!claimed?.length) continue // nơi khác đã gửi

        const stats = await dispatchNotification(notif, recipients)
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
