// backend/src/services/storageCleanup.js
// Dọn ảnh sâu bệnh (chat) cũ trong Supabase Storage để bucket khỏi phình → đỡ tiền.
// CHỈ dọn pest-images/ (ảnh chat riêng tư, cũ thì nông dân ít xem lại). KHÔNG đụng
// community/ (bài đăng cần giữ lâu dài). In-process scheduler — đúng khi 1 replica
// (giống notifications/weatherAlerts). Scale nhiều replica thì cần leader-election.

import { supabase } from './supabase.js'

const BUCKET       = 'images'
const FOLDER       = 'pest-images'
const MAX_AGE_DAYS = 30
const MAX_AGE_MS   = MAX_AGE_DAYS * 24 * 60 * 60 * 1000
const PAGE         = 1000   // pilot scale: mỗi thư mục user vài ảnh, 1 trang là đủ

export async function cleanupOldPestImages() {
  try {
    const cutoff = Date.now() - MAX_AGE_MS

    // Liệt kê các thư mục con theo userId dưới pest-images/ (folder có id=null)
    const { data: folders, error: fErr } = await supabase.storage.from(BUCKET).list(FOLDER, { limit: PAGE })
    if (fErr) { console.warn('[CLEANUP] list pest-images lỗi:', fErr.message); return 0 }

    const toRemove = []
    for (const f of folders || []) {
      if (f.id !== null || f.name.startsWith('.')) continue   // chỉ duyệt thư mục user
      const prefix = `${FOLDER}/${f.name}`
      const { data: files } = await supabase.storage.from(BUCKET).list(prefix, { limit: PAGE })
      for (const file of files || []) {
        if (file.id === null || file.name.startsWith('.')) continue
        const created  = file.created_at ? new Date(file.created_at).getTime() : null
        // Fallback: tên file là Date.now() (pest-images/<uid>/<ts>.jpg)
        const tsInName = parseInt(file.name, 10)
        const age = created ?? (Number.isFinite(tsInName) ? tsInName : null)
        if (age !== null && age < cutoff) toRemove.push(`${prefix}/${file.name}`)
      }
    }

    if (!toRemove.length) return 0

    // Xóa file theo lô 100
    let removed = 0
    for (let i = 0; i < toRemove.length; i += 100) {
      const batch = toRemove.slice(i, i + 100)
      const { error } = await supabase.storage.from(BUCKET).remove(batch)
      if (error) { console.warn('[CLEANUP] remove lỗi:', error.message); continue }
      removed += batch.length
    }

    // Null image_url ở message tương ứng để khỏi hiện ảnh vỡ (best-effort)
    try {
      const urls = toRemove.map(p => supabase.storage.from(BUCKET).getPublicUrl(p).data.publicUrl)
      for (let i = 0; i < urls.length; i += 100) {
        await supabase.from('messages').update({ image_url: null }).in('image_url', urls.slice(i, i + 100))
      }
    } catch (e) {
      console.warn('[CLEANUP] null image_url lỗi:', e.message)
    }

    console.log(`[CLEANUP] đã xóa ${removed} ảnh sâu bệnh > ${MAX_AGE_DAYS} ngày`)
    return removed
  } catch (err) {
    console.warn('[CLEANUP] lỗi:', err.message)
    return 0
  }
}

// Khởi động: quét lúc boot + mỗi 24h. In-process (đúng khi 1 replica).
export function startStorageCleanupScheduler(intervalMs = 24 * 60 * 60 * 1000) {
  cleanupOldPestImages()
  setInterval(() => { cleanupOldPestImages() }, intervalMs)
  console.log(`[CLEANUP] Scheduler dọn ảnh sâu bệnh cũ đã chạy (mỗi ${intervalMs / 3600000}h, ngưỡng ${MAX_AGE_DAYS} ngày)`)
}
