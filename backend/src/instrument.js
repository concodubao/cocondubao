// backend/src/instrument.js
// PHẢI được import ĐẦU TIÊN trong index.js (trước mọi import khác). ESM hoist mọi
// `import` lên đầu module → nếu để Sentry.init() là statement trong index.js thì nó
// chạy SAU khi express/route đã load → auto-instrument vá hụt. Tách ra đây + import
// trước để Sentry vá module trước khi chúng được nạp.
import 'dotenv/config'
import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'

// Chỉ bật ở production (khỏi nhiễu lỗi lúc dev). DSN qua env, fallback hardcode
// (DSN không phải bí mật). Sampling 10% cho đỡ cháy quota — lỗi vẫn bắt 100%.
const dsn = process.env.SENTRY_DSN
  || 'https://1cd6b44315e060f307d0f0a79856117a@o4511642897678336.ingest.us.sentry.io/4511642907770880'

if (process.env.NODE_ENV === 'production' && dsn) {
  Sentry.init({
    dsn,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate:   0.1,
    profilesSampleRate: 0.1,
  })
  console.log('[SENTRY] backend đã bật (production)')
}
