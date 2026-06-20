// backend/src/routes/push.js
// POST /api/v1/push/subscribe      — đăng ký nhận push
// DELETE /api/v1/push/unsubscribe  — huỷ đăng ký
// POST /api/v1/push/send           — admin gửi thông báo
// GET  /api/v1/notifications/:userId     — danh sách thông báo
// PATCH /api/v1/notifications/:id/read   — đánh dấu đã đọc
// PATCH /api/v1/notifications/settings   — cài đặt thông báo cá nhân

import express   from 'express'
import { verifyJWT, requireRole } from '../middleware/auth.js'
import { supabase } from '../services/supabase.js'
import { sendPush, dispatchNotification } from '../services/notifications.js'

const router = express.Router()

// ══════════════════════════════════════════════════════════════════════════════
// ĐĂNG KÝ / HUỶ ĐĂNG KÝ
// ══════════════════════════════════════════════════════════════════════════════

// POST /push/subscribe
router.post('/subscribe', verifyJWT, async (req, res) => {
  const { subscription } = req.body

  if (!subscription?.endpoint || !subscription?.keys) {
    return res.status(400).json({ error: 'Thiếu thông tin subscription.' })
  }

  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id:  req.user.userId,
        endpoint: subscription.endpoint,
        keys:     subscription.keys,
        active:   true,
      }, { onConflict: 'endpoint' })

    if (error) {
      console.error('[PUSH] supabase upsert error:', error)
      throw error
    }

    console.log('[PUSH] subscription saved for user:', req.user.userId, 'endpoint:', subscription.endpoint.slice(0, 60))

    const welcomeResult = await sendPush(subscription, {
      title: 'Cò Con Dự Báo!',
      body:  'Bạn đã bật thông báo thành công!',
      url:   '/notifications',
    })
    console.log('[PUSH] welcome push result:', welcomeResult)

    res.json({ success: true })
  } catch (err) {
    console.error('[PUSH] subscribe error:', err.message, err.code)
    res.status(500).json({ error: 'Không đăng ký được thông báo: ' + err.message })
  }
})

// DELETE /push/unsubscribe
router.delete('/unsubscribe', verifyJWT, async (req, res) => {
  const { endpoint } = req.body
  if (!endpoint) return res.status(400).json({ error: 'Thiếu endpoint.' })

  await supabase
    .from('push_subscriptions')
    .update({ active: false })
    .eq('endpoint', endpoint)
    .eq('user_id', req.user.userId)

  res.json({ success: true })
})

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN GỬI THÔNG BÁO
// ══════════════════════════════════════════════════════════════════════════════

// POST /push/send — Admin gửi broadcast thông báo
router.post('/send', verifyJWT, requireRole('admin'), async (req, res) => {
  const {
    title,
    body,
    type       = 'alert',
    imageUrl,
    cropTags   = [],
    region,
    scheduleAt,
  } = req.body

  if (!title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'Tiêu đề và nội dung không được để trống.' })
  }

  // Chuẩn hoá thời điểm đặt lịch (nếu có)
  let scheduledAt = null
  if (scheduleAt) {
    const t = new Date(scheduleAt)
    if (isNaN(t.getTime())) {
      return res.status(400).json({ error: 'Thời điểm đặt lịch không hợp lệ.' })
    }
    scheduledAt = t.toISOString()
  }

  try {
    const { data: notif, error: notifError } = await supabase
      .from('notifications')
      .insert({
        title:        title.trim(),
        body:         body.trim(),
        type,
        image_url:    imageUrl || null,
        crop_tags:    cropTags,
        region:       region || null,
        created_by:   req.user.userId,
        scheduled_at: scheduledAt,
        sent_at:      scheduledAt ? null : new Date().toISOString(),
      })
      .select('id, title, body, type, image_url, crop_tags')
      .single()

    if (notifError) throw notifError

    // Đặt lịch: chỉ lưu DB, scheduler sẽ gửi khi tới hạn (xem services/notifications.js)
    if (scheduledAt) {
      return res.json({
        success:        true,
        notificationId: notif.id,
        scheduled:      true,
        scheduledAt,
        message:        'Đã lưu thông báo, sẽ gửi vào lúc ' + scheduledAt,
      })
    }

    // Gửi ngay — dùng chung logic với scheduler
    const stats = await dispatchNotification(notif)

    if (stats.total === 0) {
      return res.json({ success: true, sent: 0, message: 'Không có thiết bị nào phù hợp để gửi.' })
    }

    res.json({
      success:        true,
      notificationId: notif.id,
      sent:           stats.sent,
      failed:         stats.failed,
      total:          stats.total,
      message:        `Đã gửi đến ${stats.sent}/${stats.total} thiết bị.`,
    })

  } catch (err) {
    console.error('[PUSH] send error:', err)
    res.status(500).json({ error: 'Gửi thông báo thất bại: ' + err.message })
  }
})

// GET /push/scheduled — admin xem thông báo đã lên lịch nhưng CHƯA gửi
router.get('/scheduled', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, body, type, region, crop_tags, scheduled_at, created_at')
      .not('scheduled_at', 'is', null)
      .is('sent_at', null)
      .order('scheduled_at', { ascending: true })
    if (error) throw error
    res.json({ scheduled: data || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /push/scheduled/:id — admin hủy thông báo đã lên lịch (chỉ khi chưa gửi)
router.delete('/scheduled/:id', verifyJWT, requireRole('admin'), async (req, res) => {
  try {
    const { data: notif } = await supabase
      .from('notifications').select('id, sent_at').eq('id', req.params.id).single()
    if (!notif) return res.status(404).json({ error: 'Không tìm thấy thông báo.' })
    if (notif.sent_at) return res.status(400).json({ error: 'Thông báo đã gửi, không thể hủy.' })

    const { error } = await supabase.from('notifications').delete().eq('id', req.params.id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS — XEM VÀ ĐỌC
// ══════════════════════════════════════════════════════════════════════════════

// ⚠️ Route tĩnh '/notifications/settings' PHẢI đứng trước '/notifications/:userId',
// nếu không Express khớp :userId="settings" và route settings bị che (farmer 403).

// GET /notifications/settings — lấy cài đặt thông báo đã lưu (để form hiển thị đúng)
router.get('/notifications/settings', verifyJWT, async (req, res) => {
  try {
    const { data } = await supabase
      .from('push_subscriptions')
      .select('notif_types, quiet_start, quiet_end, crops_filter')
      .eq('user_id', req.user.userId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    res.json({
      notifTypes:  data?.notif_types  ?? ['alert', 'promotion', 'weather'],
      quietStart:  data?.quiet_start?.slice(0, 5) ?? '22:00',
      quietEnd:    data?.quiet_end?.slice(0, 5)   ?? '06:00',
      cropsFilter: data?.crops_filter ?? [],
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /notifications/:userId — danh sách thông báo của user
router.get('/notifications/:userId', verifyJWT, async (req, res) => {
  const { userId } = req.params
  if (req.user.role === 'farmer' && req.user.userId !== userId) {
    return res.status(403).json({ error: 'Không có quyền xem.' })
  }

  try {
    const { data: user } = await supabase
      .from('users')
      .select('crops, role')
      .eq('id', userId)
      .single()

    const userCrops = user?.crops || []
    const isStaff   = ['engineer', 'admin'].includes(user?.role)

    let notifQuery = supabase
      .from('notifications')
      .select(`
        id, title, body, type, image_url, crop_tags, sent_at, created_at,
        notification_reads!left ( read_at )
      `)
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(50)

    if (!isStaff) {
      // Chỉ nhận crop dạng chữ/gạch dưới — chặn nội suy ký tự lạ vào filter .or()
      const safeCrops = userCrops.filter(c => typeof c === 'string' && /^[a-z_]+$/i.test(c))
      const cropFilter = safeCrops.length > 0
        ? `crop_tags.eq.{},${safeCrops.map(c => `crop_tags.cs.{${c}}`).join(',')}`
        : 'crop_tags.eq.{}'
      notifQuery = notifQuery.or(cropFilter)
    }

    const { data: notifications } = await notifQuery

    const result = (notifications || []).map(n => ({
      ...n,
      read_at: n.notification_reads?.[0]?.read_at || null,
      is_read: !!n.notification_reads?.[0]?.read_at,
    }))

    res.json({ notifications: result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /notifications/:id/read
router.patch('/notifications/:id/read', verifyJWT, async (req, res) => {
  try {
    await supabase
      .from('notification_reads')
      .upsert({
        notification_id: req.params.id,
        user_id:         req.user.userId,
        read_at:         new Date().toISOString(),
      }, { onConflict: 'notification_id,user_id' })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /notifications/settings — cài đặt thông báo cá nhân
router.patch('/notifications/settings', verifyJWT, async (req, res) => {
  const { notifTypes, cropsFilter, quietStart, quietEnd } = req.body

  try {
    const updates = {}
    if (notifTypes)            updates.notif_types  = notifTypes
    if (cropsFilter)           updates.crops_filter = cropsFilter
    if (quietStart !== undefined) updates.quiet_start = quietStart
    if (quietEnd   !== undefined) updates.quiet_end   = quietEnd

    await supabase
      .from('push_subscriptions')
      .update(updates)
      .eq('user_id', req.user.userId)
      .eq('active', true)

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
