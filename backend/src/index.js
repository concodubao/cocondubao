// backend/src/index.js

// ⚠️ PHẢI đứng ĐẦU TIÊN — khởi tạo Sentry trước khi nạp express/route (ESM hoist).
import './instrument.js'

import * as Sentry from '@sentry/node'
import 'dotenv/config'

import express        from 'express'
import './middleware/asyncErrors.js' // Express 4: lỗi handler async → error handler JSON (xem file)
import cors           from 'cors'
import helmet         from 'helmet'
import webpush        from 'web-push'
import jwt            from 'jsonwebtoken'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

import authRoutes      from './routes/auth.js'
import chatRoutes      from './routes/chat.js'
import pushRoutes      from './routes/push.js'
import engineerRoutes  from './routes/engineer.js'
import adminRoutes     from './routes/admin.js'
import communityRoutes from './routes/community.js'
import { startNotificationScheduler } from './services/notifications.js'
import { startUserStatusSync } from './middleware/auth.js'
import { startWeatherAlertScheduler } from './services/weatherAlerts.js'
import { startStorageCleanupScheduler } from './services/storageCleanup.js'

// Thiếu JWT_SECRET thì mọi jwt.sign/verify đều lỗi → đăng nhập hỏng toàn bộ. Dừng
// ngay lúc boot (Railway báo deploy lỗi) thay vì chạy "khoẻ" mà không ai login được.
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET chưa được set. Dừng server.')
  process.exit(1)
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn('⚠️ JWT_SECRET ngắn hơn 32 ký tự — nên đổi sang chuỗi ngẫu nhiên dài (đổi = mọi người phải đăng nhập lại).')
}

const app = express()

// Railway chạy sau reverse proxy → tin 1 hop để req.ip là IP thật của client
// (cần cho rate-limit theo IP chính xác).
app.set('trust proxy', 1)

// ─── Rate limiters ────────────────────────────────────────────────────────────
// Chat limiter khoá theo userId (đã đăng nhập) thay vì IP: cả xã dùng chung 4G/NAT
// sẽ không bị chặn nhầm nhau. Chưa đăng nhập (token thiếu/sai) thì rơi về IP qua
// ipKeyGenerator — helper chính thức chuẩn hoá IPv6, KHÔNG gây ERR_ERL_KEY_GEN_IPV6
// (lỗi đó do keyGenerator cũ trả thẳng req.ip; dùng ipKeyGenerator là cách được hỗ trợ).
function userOrIpKey(req) {
  const h = req.headers.authorization
  if (h?.startsWith('Bearer ')) {
    try {
      const p = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET)
      if (p?.userId) return `user:${p.userId}`
    } catch { /* token lỗi → khoá theo IP */ }
  }
  return ipKeyGenerator(req.ip)
}

// Chat: 15 req/phút/user (hoặc IP nếu chưa đăng nhập) — tránh spam AI.
const chatLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              15,
  standardHeaders:  true,
  legacyHeaders:    false,
  keyGenerator:     userOrIpKey,
  message:          { error: 'Bạn hỏi quá nhiều rồi, thử lại sau 1 phút nhé.' },
})

// Auth: 30 req/phút/IP. Khoá theo IP (chưa có userId khi đăng nhập) nên cả xã dùng
// chung 4G/NAT đếm chung — để 10 thì vài người đăng nhập cùng lúc đã bị chặn nhầm.
// Brute-force vẫn được chặn bởi lớp riêng: otpLimiter (5/phút) cho OTP và khoá dò
// PIN theo từng số (5 lần sai → khoá 10 phút) trong routes/auth.js.
const authLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              30,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Thử lại sau 1 phút nhé.' },
})

// Giới hạn GHI (POST/PATCH/DELETE) theo user ở community & engineer/knowledge. Trước đây
// không giới hạn → 1 tài khoản có thể đăng ảnh liên tục (mỗi ảnh 1 lần sharp + 1 file
// vĩnh viễn trong bucket) hoặc bình luận dồn dập để spam push vào máy chủ bài. GET
// (xem feed, kỹ sư poll hàng đợi 20s) không bị đếm.
// Mỗi khu vực một bộ đếm riêng (không dùng chung 1 bucket cho mọi tính năng).
// push/notifications KHÔNG giới hạn: ghi ở đó là idempotent (đánh dấu đã đọc, đăng ký
// thiết bị, cài đặt) và đọc vài thông báo đã sinh nhiều lần ghi → dễ chặn nhầm.
const makeWriteLimiter = (max) => rateLimit({
  windowMs:         60 * 1000,
  max,
  standardHeaders:  true,
  legacyHeaders:    false,
  keyGenerator:     userOrIpKey,
  skip:             (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message:          { error: 'Bạn thao tác hơi nhanh, chờ 1 phút rồi thử lại nhé.' },
})
const communityLimiter = makeWriteLimiter(20) // đăng bài/ảnh, bình luận, like, báo cáo
const staffLimiter     = makeWriteLimiter(60) // kỹ sư: nhận/trả lời/xoá câu hỏi, tài liệu

// VAPID — cấu hình một lần duy nhất khi khởi động
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_CONTACT || 'mailto:admin@cocon.vn',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

app.use(helmet())
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
// Body JSON chỉ chứa text (câu hỏi, câu trả lời, thông báo…) — ảnh/audio/tài liệu đi
// qua multer riêng. 10MB trước đây vô cớ cho phép đẩy payload lớn vào mọi route.
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

app.use('/api/v1/auth',          authLimiter, authRoutes)
app.use('/api/v1/chat',          chatLimiter, chatRoutes)
app.use('/api/v1/push',          pushRoutes)
app.use('/api/v1/notifications', pushRoutes)
app.use('/api/v1/engineer',      staffLimiter, engineerRoutes)
app.use('/api/v1/knowledge',     staffLimiter, engineerRoutes)
app.use('/api/v1/admin',         adminRoutes)
app.use('/api/v1/community',     communityLimiter, communityRoutes)

app.get('/health', (_, res) => res.json({
  status:    'ok',
  timestamp: new Date().toISOString(),
  env:       process.env.NODE_ENV,
}))

// Cần gọi hàm này SAU tất cả các routes để Sentry có thể tóm được mọi lỗi unhandled
Sentry.setupExpressErrorHandler(app)

// Lỗi lọt tới đây (multer: file quá lớn / sai loại, JSON hỏng, throw đồng bộ…) trước
// đây rơi vào handler mặc định của Express → trả trang HTML, frontend không đọc được
// `error`. Trả JSON thống nhất, không lộ stack.
// eslint-disable-next-line no-unused-vars
app.use(function(err, req, res, next) {
  // Handler đã trả lời rồi mới lỗi → không gửi lần 2 (ERR_HTTP_HEADERS_SENT)
  if (res.headersSent) return next(err)
  if (err?.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File quá lớn.' : 'File tải lên không hợp lệ.'
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: msg })
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn.' })
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Dữ liệu gửi lên không hợp lệ.' })
  // Lỗi từ fileFilter (cb(new Error('Chỉ hỗ trợ file ảnh'))) — thông báo do mình viết, an toàn để hiện
  if (err?.message?.startsWith('Chỉ hỗ trợ')) return res.status(400).json({ error: err.message })
  console.error('[API] unhandled error:', err)
  res.status(500).json({ error: 'Có lỗi xảy ra, vui lòng thử lại sau.' })
})

app.use(function(req, res) {
  res.status(404).json({ error: 'Endpoint không tồn tại' })
})

// Express 4 không chuyển promise bị reject của handler async sang error middleware.
// Không có listener này (Sentry chỉ bật ở production) thì Node 22 THOÁT process khi có
// 1 lỗi lọt try — một request dị dạng đánh sập cả backend 1 replica. Chỉ log.
process.on('unhandledRejection', (reason) => {
  console.error('[API] unhandledRejection:', reason?.message || reason)
})

const PORT = process.env.PORT || 3000
const server = app.listen(PORT, () => {
  console.log(`🐦 Cò Con API đang chạy tại http://localhost:${PORT}`)
  console.log(`📋 Môi trường: ${process.env.NODE_ENV}`)
  console.log(`🔗 Supabase: ${process.env.SUPABASE_URL ? '✅ Connected' : '❌ Missing URL'}`)

  // Đồng bộ denylist tài khoản bị khoá + vai trò staff + mốc thu hồi token — LUÔN chạy
  // (bảo mật), kể cả ở máy dự phòng.
  startUserStatusSync()

  // Các job nền chỉ được chạy ở ĐÚNG 1 máy: chạy 2 nơi (vd Render + Railway dự phòng)
  // sẽ gửi trùng thông báo đặt lịch / nháp cảnh báo. Máy dự phòng đặt RUN_SCHEDULERS=false.
  if (process.env.RUN_SCHEDULERS === 'false') {
    console.log('[CRON] RUN_SCHEDULERS=false → máy dự phòng, KHÔNG chạy job nền')
    return
  }

  // Scheduler gửi thông báo đặt lịch (quét mỗi 60s). In-process — đúng khi 1 replica.
  startNotificationScheduler()

  // Quét thời tiết tạo bản nháp cảnh báo cho admin duyệt (mỗi 6h).
  startWeatherAlertScheduler()

  // Dọn ảnh sâu bệnh (chat) cũ > 30 ngày để bucket khỏi phình (mỗi 24h).
  startStorageCleanupScheduler()
})

// requestTimeout/headersTimeout chỉ giới hạn thời gian NHẬN request (chống client gửi
// chậm); headersTimeout phải ≤ requestTimeout mới có tác dụng. server.timeout = socket
// im lặng quá lâu (handler treo do upstream không trả lời) → đóng; 150s > timeout dài
// nhất phía frontend (120s khi duyệt tài liệu).
server.requestTimeout = 75_000
server.headersTimeout = 20_000
server.timeout        = 150_000
