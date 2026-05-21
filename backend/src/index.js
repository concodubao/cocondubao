// backend/src/index.js

import 'dotenv/config'

import express from 'express'
import cors    from 'cors'
import helmet  from 'helmet'

import authRoutes     from './routes/auth.js'
import chatRoutes     from './routes/chat.js'
import pushRoutes     from './routes/push.js'
import engineerRoutes from './routes/engineer.js'
import adminRoutes    from './routes/admin.js'

const app = express()

app.use(helmet())
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/v1/auth',         authRoutes)
app.use('/api/v1/chat',         chatRoutes)
app.use('/api/v1/push',         pushRoutes)
app.use('/api/v1/notifications', pushRoutes)
app.use('/api/v1/engineer',     engineerRoutes)
app.use('/api/v1/knowledge',    engineerRoutes)
app.use('/api/v1/admin',        adminRoutes)

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