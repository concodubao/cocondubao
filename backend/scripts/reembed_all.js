// Re-embed lại TẤT CẢ tài liệu trong kho tri thức bằng EMBED_MODEL hiện tại (rag.js).
// Dùng khi đổi model embedding (đổi không gian vector) — xoá chunks cũ, tạo lại từ content.
//
// Chạy:  cd backend && node scripts/reembed_all.js
//
// An toàn để chạy lại nhiều lần: embedAndStoreDoc tự xoá chunks cũ của doc trước khi tạo mới.

import 'dotenv/config'
import { createClient }      from '@supabase/supabase-js'
import { embedAndStoreDoc }  from '../src/services/rag.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const { data: docs, error } = await supabase
  .from('knowledge_docs')
  .select('id, title, content, status')
  .order('created_at', { ascending: true })

if (error) { console.error('❌ Không lấy được danh sách docs:', error.message); process.exit(1) }

const targets = (docs || []).filter(d => d.content?.trim())
console.log(`🔄 Re-embed ${targets.length}/${docs?.length ?? 0} tài liệu (bỏ qua doc không có content)...\n`)

let ok = 0, fail = 0
for (const doc of targets) {
  process.stdout.write(`- "${doc.title.slice(0, 50)}"... `)
  try {
    const { chunksCreated } = await embedAndStoreDoc(doc.id)
    console.log(`✅ ${chunksCreated} chunks`)
    ok++
  } catch (e) {
    console.log(`❌ ${e.message}`)
    fail++
  }
}

console.log(`\nXong: ${ok} thành công, ${fail} lỗi.`)
process.exit(fail > 0 ? 1 : 0)
