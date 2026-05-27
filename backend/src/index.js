// backend/src/index.js

import 'dotenv/config'

import express        from 'express'
import cors           from 'cors'
import helmet         from 'helmet'
import webpush        from 'web-push'
import rateLimit      from 'express-rate-limit'

import authRoutes     from './routes/auth.js'
import chatRoutes     from './routes/chat.js'
import pushRoutes     from './routes/push.js'
import engineerRoutes from './routes/engineer.js'
import adminRoutes    from './routes/admin.js'

const app = express()

// ─── Rate limiters ────────────────────────────────────────────────────────────
// Chat: 15 req/phút/IP (tránh spam AI)
const chatLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              15,
  standardHeaders:  true,
  legacyHeaders:    false,
  keyGenerator:     (req) => req.headers['x-forwarded-for']?.split(',')[0] || req.ip,
  message:          { error: 'Bạn hỏi quá nhiều rồi, thử lại sau 1 phút nhé.' },
})

// Auth: 10 req/phút/IP (tránh brute-force OTP)
const authLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              10,
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

app.get('/health', (_, res) => res.json({
  status:    'ok',
  timestamp: new Date().toISOString(),
  env:       process.env.NODE_ENV,
}))

app.use(function(req, res) {
  res.status(404).json({ error: 'Endpoint không tồn tại' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🐦 Cò Con API đang chạy tại http://localhost:${PORT}`)
  console.log(`📋 Môi trường: ${process.env.NODE_ENV}`)
  console.log(`🔗 Supabase: ${process.env.SUPABASE_URL ? '✅ Connected' : '❌ Missing URL'}`)
})
