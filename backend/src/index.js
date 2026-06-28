// backend/src/index.js

// ⚠️ PHẢI đứng ĐẦU TIÊN — khởi tạo Sentry trước khi nạp express/route (ESM hoist).
import './instrument.js'

import * as Sentry from '@sentry/node'
import 'dotenv/config'

import express        from 'express'
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
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/v1/auth',          authLimiter, authRoutes)
app.use('/api/v1/chat',          chatLimiter, chatRoutes)
app.use('/api/v1/push',          pushRoutes)
app.use('/api/v1/notifications', pushRoutes)
app.use('/api/v1/engineer',      engineerRoutes)
app.use('/api/v1/knowledge',     engineerRoutes)
app.use('/api/v1/admin',         adminRoutes)
app.use('/api/v1/community',    communityRoutes)

app.get('/health', (_, res) => res.json({
  status:    'ok',
  timestamp: new Date().toISOString(),
  env:       process.env.NODE_ENV,
}))

// Cần gọi hàm này SAU tất cả các routes để Sentry có thể tóm được mọi lỗi unhandled
Sentry.setupExpressErrorHandler(app)

app.use(function(req, res) {
  res.status(404).json({ error: 'Endpoint không tồn tại' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🐦 Cò Con API đang chạy tại http://localhost:${PORT}`)
  console.log(`📋 Môi trường: ${process.env.NODE_ENV}`)
  console.log(`🔗 Supabase: ${process.env.SUPABASE_URL ? '✅ Connected' : '❌ Missing URL'}`)

  // Scheduler gửi thông báo đặt lịch (quét mỗi 60s). In-process — đúng khi 1 replica.
  startNotificationScheduler()

  // Đồng bộ denylist tài khoản bị khoá (để khoá có hiệu lực sớm dù JWT còn hạn).
  startUserStatusSync()

  // Quét thời tiết tạo bản nháp cảnh báo cho admin duyệt (mỗi 6h).
  startWeatherAlertScheduler()

  // Dọn ảnh sâu bệnh (chat) cũ > 30 ngày để bucket khỏi phình (mỗi 24h).
  startStorageCleanupScheduler()
})
