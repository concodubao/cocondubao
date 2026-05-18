import { OpenAIEmbeddings } from '@langchain/openai'
import { createClient }     from '@supabase/supabase-js'
 
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)
 
const embeddings = new OpenAIEmbeddings({
  model:  'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY,
})
 
// ─── 20 QA pairs mẫu — đủ để AI trả lời các câu hỏi phổ biến nhất ─────────
// Format: { q: câu hỏi, a: câu trả lời, crops: ['rice'|'veggie'|'fruit'] }
const SEED_QA = [
  // LÚẠ — sâu bệnh
  {
    q: 'Lúa bị vàng lá là bệnh gì?',
    a: 'Lúa vàng lá có thể do nhiều nguyên nhân: (1) Vàng lá lúa non do thiếu đạm — bón thêm phân urê 5-7kg/công. (2) Vàng lá đạo ôn — lá có đốm nâu viền vàng, phun thuốc Beam 75WP hoặc Filia 525SE. (3) Vàng lùn xoắn lá do rầy nâu — lá xoắn lại, chưa có thuốc đặc trị, cần nhổ bỏ cây bệnh và phun thuốc rầy nâu.',
    crops: ['rice'],
  },
  {
    q: 'Rầy nâu cắn gốc lúa phải làm sao?',
    a: 'Rầy nâu là dịch hại nguy hiểm nhất trên lúa. Cách xử lý: Phun thuốc Actara 25WG (0.3g/8L), Bassa 50EC (25ml/8L) hoặc Chess 50WG. Phun vào buổi sáng sớm, hướng vòi phun vào gốc lúa. Rút nước ruộng trước khi phun để thuốc xuống tới gốc. Phun lại sau 7 ngày nếu còn rầy. Lưu ý: không phun khi trời mưa hoặc nắng gắt.',
    crops: ['rice'],
  },
  {
    q: 'Đạo ôn lá lúa có chữa được không?',
    a: 'Đạo ôn lá chữa được nếu phát hiện sớm. Nhận biết: đốm hình thoi màu nâu xám, viền nâu đỏ, có quầng vàng xung quanh. Cách trị: Phun ngay thuốc Beam 75WP (15g/8L) hoặc Filia 525SE (20ml/8L). Ngưng bón đạm khi lúa đang bệnh. Phun 2 lần cách nhau 5-7 ngày. Phòng: không sạ dày, không bón đạm nhiều, bơm nước vào ruộng khi thấy sương mù nhiều.',
    crops: ['rice'],
  },
  {
    q: 'Lúa bị sâu cuốn lá phải xử lý thế nào?',
    a: 'Sâu cuốn lá cuộn lá lúa lại thành ống rồi ăn bên trong. Nhận biết: lá lúa cuộn hình ống, bên trong có sâu xanh nhỏ. Cách trị: Phun thuốc Virtako 40WG (6g/8L) hoặc Prevathon 5SC (20ml/8L). Nên phun vào chiều mát. Không cần trị khi lúa đã trổ bông. Phòng: sạ thưa, bón phân cân đối, không bón quá nhiều đạm.',
    crops: ['rice'],
  },
  {
    q: 'Lem lép hạt lúa do đâu và xử lý sao?',
    a: 'Lem lép hạt lúa do: (1) Bọ xít hút chích hạt — phun Bassa 50EC khi lúa trổ. (2) Nấm lem lép — phun Tilt Super 300EC hoặc Nativo 750WG khi lúa trổ đòng 5-10%. (3) Điều kiện thời tiết xấu khi lúa trổ — không can thiệp được. Nên phun phòng 2 lần: khi lúa trổ 5% và khi trổ đều.',
    crops: ['rice'],
  },
 
  // LÚA — kỹ thuật canh tác
  {
    q: 'Bón phân lúa đúng cách như thế nào?',
    a: 'Lịch bón phân lúa cơ bản cho 1 công (1000m²): Lần 1 (7-10 ngày sau sạ): 10kg NPK 20-20-15. Lần 2 (18-22 ngày): 7kg urê + 3kg KCl. Lần 3 (40-45 ngày, đón đòng): 5kg urê + 5kg KCl. Lưu ý: ruộng bị bệnh không bón đạm. Bón lúc sáng sớm hoặc chiều mát. Ruộng phải có đủ nước mới bón.',
    crops: ['rice'],
  },
  {
    q: 'Khi nào nên bơm nước vào ruộng lúa?',
    a: 'Lịch tưới nước lúa: Giữ mực nước 3-5cm từ khi sạ đến 10 ngày. Rút nước để bón phân lần 1. Giữ 3-5cm đến 45 ngày. Rút nước phơi ruộng 7-10 ngày (khi lúa làm đòng). Bơm vào giữ 3-5cm đến khi lúa chín. Rút cạn trước thu hoạch 10-14 ngày. Không để ruộng khô nước khi lúa đang trổ bông.',
    crops: ['rice'],
  },
 
  // RAU MÀU — sâu bệnh
  {
    q: 'Rau bắp cải bị sâu đục thân làm sao?',
    a: 'Sâu đục thân rau (sâu xanh bướm trắng) phá hại mạnh. Cách xử lý: Phun thuốc Bibas 75WP (15g/8L) hoặc Karate 2.5EC (15ml/8L). Phun buổi sáng sớm khi sâu còn đang hoạt động. Phun mặt dưới lá vì sâu thường đẻ trứng ở đó. Phun 2 lần cách nhau 5 ngày. Ngưng phun thuốc 7-14 ngày trước thu hoạch.',
    crops: ['veggie'],
  },
  {
    q: 'Rau bị héo rũ đột ngột nguyên nhân là gì?',
    a: 'Rau héo rũ đột ngột thường do: (1) Bệnh chết cây con (lở cổ rễ) — nấm Rhizoctonia tấn công gốc, cần phun Validacin 5SL hoặc Ridomil Gold 68WG. (2) Bọ nhảy cắn rễ — kiểm tra đất thấy sâu nhỏ màu trắng, xử lý đất bằng Regent. (3) Ngập nước — bơm thoát nước ngay, rắc vôi. Nhổ cây chết lên xem gốc để xác định đúng nguyên nhân.',
    crops: ['veggie'],
  },
  {
    q: 'Dưa hấu bị héo dây là bệnh gì?',
    a: 'Dưa hấu héo dây thường do bệnh héo xanh vi khuẩn hoặc bệnh thối gốc. Nhận biết héo xanh vi khuẩn: dây héo nhanh, cắt thân thấy dịch nhớt trắng kéo thành sợi. Chưa có thuốc đặc trị — cần nhổ bỏ, rắc vôi vùng bệnh. Phòng: luân canh với lúa, ngâm hạt giống trước khi gieo, tránh để ruộng ngập nước.',
    crops: ['veggie', 'fruit'],
  },
 
  // CÂY ĂN TRÁI
  {
    q: 'Xoài ra hoa không đậu trái nguyên nhân là gì?',
    a: 'Xoài ra hoa không đậu trái do: (1) Thụ phấn kém — thiếu ong bướm, thời tiết mưa nhiều lúc ra hoa. (2) Sâu ăn bông — quan sát thấy sâu nhỏ ăn hoa, phun Karate 2.5EC. (3) Bệnh thán thư — hoa bị đốm đen, phun Tilt Super 300EC. (4) Cây ra hoa lúc nắng nóng quá (>38°C). Giải pháp: phun Boron 0.3% khi hoa nở 30%, tưới đủ nước.',
    crops: ['fruit'],
  },
  {
    q: 'Nhãn bị rụng trái non tại sao?',
    a: 'Nhãn rụng trái non có thể do: (1) Sâu đục trái — trái bị sâu vào bên trong, phun Regent 800WG. (2) Bệnh nấm — trái có đốm nâu, phun Antracol 70WP. (3) Thiếu dinh dưỡng — bón bổ sung phân kali và canxi, phun phân bón lá Atonik. (4) Thời tiết thay đổi đột ngột — không can thiệp được. Cần kiểm tra trái rụng để xem có sâu không.',
    crops: ['fruit'],
  },
  {
    q: 'Cây ăn trái bón phân mấy lần trong năm?',
    a: 'Lịch bón phân cây ăn trái trưởng thành (ví dụ xoài, nhãn): Lần 1 sau thu hoạch: phân hữu cơ + NPK 15-15-15 để phục hồi cây. Lần 2 trước ra hoa 2 tháng: NPK 10-30-10 để kích hoa. Lần 3 khi trái bằng đầu ngón tay: NPK 15-15-15 + KCl để nuôi trái. Lần 4 trước thu hoạch 1 tháng: KCl để tăng chất lượng trái. Tổng 4 lần/năm.',
    crops: ['fruit'],
  },
 
  // VẬT TƯ NÔNG NGHIỆP
  {
    q: 'Thuốc Bassa 50EC dùng cho sâu gì?',
    a: 'Bassa 50EC (hoạt chất Fenobucarb) dùng để trị rầy nâu, rầy lưng trắng, sâu năn trên lúa. Liều dùng: 25-30ml/8L nước/công. Phun ướt đều cả lá và gốc. Thời gian cách ly: 7 ngày trước thu hoạch. Lưu ý: độc với cá và ong, không phun gần ao cá, phun lúc chiều mát.',
    crops: ['rice'],
  },
  {
    q: 'Phân NPK 20-20-15 dùng lúc nào?',
    a: 'Phân NPK 20-20-15 (đạm-lân-kali cân bằng) thích hợp bón lót và bón thúc đầu cho lúa, rau màu và cây ăn trái giai đoạn sinh trưởng. Cho lúa: bón lúc 7-10 ngày sau sạ, 10-15kg/công. Cho rau: bón trước khi trồng 3-5 ngày, trộn đều vào đất. Không bón khi cây đang ra hoa vì đạm cao có thể làm rụng hoa.',
    crops: ['rice', 'veggie', 'fruit'],
  },
 
  // TỔNG QUÁT
  {
    q: 'Cây bị bệnh có nên bón phân đạm không?',
    a: 'Khi cây đang bị bệnh, KHÔNG nên bón phân đạm vì: Đạm làm cây ra lá non nhiều, lá non dễ bị nấm và sâu bệnh tấn công hơn. Đạm làm thân lá mềm, tạo điều kiện cho vi khuẩn xâm nhập. Thay vào đó: tập trung điều trị bệnh trước, bón kali để cây cứng cáp hơn. Chỉ bón đạm trở lại sau khi cây hồi phục.',
    crops: ['rice', 'veggie', 'fruit'],
  },
  {
    q: 'Khi nào nên phun thuốc bảo vệ thực vật?',
    a: 'Thời điểm phun thuốc đúng: Buổi sáng sớm (6-9h) hoặc chiều mát (16-18h). Không phun khi: trời sắp mưa, đang mưa, hoặc gió to. Không phun giờ nắng gắt (làm bốc hơi thuốc nhanh, giảm hiệu quả). Đọc kỹ nhãn thuốc về liều lượng và thời gian cách ly trước thu hoạch. Mặc đồ bảo hộ khi phun: khẩu trang, kính, găng tay, áo dài tay.',
    crops: ['rice', 'veggie', 'fruit'],
  },
  {
    q: 'Làm thế nào để biết lúa cần thu hoạch chưa?',
    a: 'Lúa chín và sẵn sàng thu hoạch khi: 80-85% hạt trên bông đã chuyển vàng. Hạt lúa cứng, không còn sữa. Thân lá gốc vẫn còn xanh nhạt (không để lá vàng hết mới cắt). Thời gian từ trổ đến thu hoạch khoảng 28-32 ngày tùy giống. Thu hoạch đúng thời điểm giúp giảm hao hụt và tăng chất lượng gạo.',
    crops: ['rice'],
  },
]
 
async function seedRAG() {
  console.log('🌱 Bắt đầu seed dữ liệu RAG...')
  console.log(`📝 Tổng số QA pairs: ${SEED_QA.length}`)
 
  // Tạo 1 doc container để quản lý
  const { data: doc, error: docError } = await supabase
    .from('knowledge_docs')
    .insert({
      title:       'Seed data — QA pairs mẫu (tự động)',
      source:      'seed_rag.js',
      crop_tags:   ['rice', 'veggie', 'fruit'],
      content:     SEED_QA.map(qa => `Q: ${qa.q}\nA: ${qa.a}`).join('\n\n---\n\n'),
      status:      'approved',
      version:     1,
    })
    .select('id')
    .single()
 
  if (docError) {
    console.error('❌ Lỗi tạo doc:', docError)
    return
  }
 
  console.log(`✅ Tạo doc seed: ${doc.id}`)
 
  // Embed từng QA pair (dạng "Q: ... A: ...")
  const texts = SEED_QA.map(qa => `Câu hỏi: ${qa.q}\n\nCâu trả lời: ${qa.a}`)
 
  console.log('🔄 Đang embed vectors... (~10-20 giây)')
  const vectors = await embeddings.embedDocuments(texts)
 
  // Lưu chunks vào DB
  const chunks = SEED_QA.map((qa, i) => ({
    doc_id:      doc.id,
    chunk_text:  texts[i],
    embedding:   vectors[i],
    chunk_index: i,
  }))
 
  const { error: chunkError } = await supabase
    .from('knowledge_chunks')
    .insert(chunks)
 
  if (chunkError) {
    console.error('❌ Lỗi lưu chunks:', chunkError)
    return
  }
 
  console.log(`✅ Đã embed ${chunks.length} chunks vào pgvector`)
  console.log('')
  console.log('🎉 Seed xong! AI sẵn sàng trả lời câu hỏi cơ bản.')
  console.log('📌 Tiếp theo: kỹ sư upload thêm tài liệu thật qua E-03')
  console.log(`💰 Chi phí ước tính: ~$${(chunks.length * 0.00002).toFixed(4)} USD`)
}
 
seedRAG().catch(console.error)