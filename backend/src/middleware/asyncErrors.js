// Express 4 bỏ qua promise mà handler async trả về: lỗi ném ra ngoài try (vd gọi
// .trim() trên body không phải chuỗi) thành unhandled rejection — request treo, còn
// không có Sentry thì Node 22 thoát cả process. Bản vá này làm đúng như Express 5 /
// gói express-async-errors: promise bị reject → next(err) → error handler JSON ở
// index.js trả 500. Logic còn lại giữ nguyên Layer.handle_request của Express 4.
// PHẢI import trước khi mount route (index.js).
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const Layer = require('express/lib/router/layer.js')

if (!Layer.prototype.__coconAsyncPatched) {
  Layer.prototype.handle_request = function handle(req, res, next) {
    const fn = this.handle
    if (fn.length > 3) return next() // không phải request handler chuẩn
    try {
      const ret = fn(req, res, next)
      // reject(undefined/null/0) vẫn phải là lỗi, không được "đi tiếp" sang route sau
      if (ret && typeof ret.then === 'function') {
        ret.then(undefined, (err) => next(err || new Error('Rejected promise')))
      }
    } catch (err) {
      next(err)
    }
  }
  Layer.prototype.__coconAsyncPatched = true
}
