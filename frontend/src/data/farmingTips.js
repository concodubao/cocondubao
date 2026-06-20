// Mẹo canh tác hiển thị ở "Mẹo hôm nay" (Home). Xoay theo ngày trong năm nên đổi
// mỗi ngày nhưng ổn định trong cùng 1 ngày. Mẹo có `crops` chỉ hiện cho nông dân
// trồng loại đó; mẹo không có `crops` là chung, ai cũng thấy.
export const FARMING_TIPS = [
  // ── Chung ───────────────────────────────────────────────────────────────────
  { text: 'Phun thuốc vào sáng sớm hoặc chiều mát, tránh giữa trưa nắng gắt để thuốc không bay hơi nhanh.' },
  { text: 'Đọc kỹ liều lượng trên bao bì, pha đúng tỉ lệ — pha đậm hơn không trị bệnh tốt hơn mà còn hại cây.' },
  { text: 'Sau khi phun thuốc nên rửa sạch bình và thay đồ, tắm rửa ngay để bảo vệ sức khỏe.' },
  { text: 'Thăm đồng thường xuyên buổi sáng để phát hiện sâu bệnh sớm, xử lý lúc còn nhẹ sẽ đỡ tốn kém.' },
  { text: 'Luân phiên đổi loại thuốc để sâu rầy không bị "lờn thuốc" (kháng thuốc).' },
  { text: 'Giữ bờ ruộng sạch cỏ dại — đó là nơi sâu bệnh và chuột ẩn nấp.' },

  // ── Lúa ─────────────────────────────────────────────────────────────────────
  { crops: ['rice'], text: 'Bón phân đợt 2 sau khi cấy/sạ 20–25 ngày để lúa đẻ nhánh đều và khỏe.' },
  { crops: ['rice'], text: 'Giữ mực nước 3–5cm giai đoạn lúa đẻ nhánh; rút cạn nước khi lúa chuẩn bị làm đòng.' },
  { crops: ['rice'], text: 'Theo dõi rầy nâu vào giai đoạn lúa trổ — kiểm tra gốc lúa, nếu thấy rầy nhiều phải xử lý ngay.' },
  { crops: ['rice'], text: 'Bệnh đạo ôn thường bùng khi trời ẩm, nhiều sương — hạn chế bón thừa đạm để giảm nguy cơ.' },

  // ── Rau màu ─────────────────────────────────────────────────────────────────
  { crops: ['veggie'], text: 'Rau ăn lá nên tưới sáng sớm và chiều, tránh tưới buổi tối dễ sinh nấm bệnh.' },
  { crops: ['veggie'], text: 'Lên luống cao, thoát nước tốt cho rau màu mùa mưa để tránh úng và thối rễ.' },
  { crops: ['veggie'], text: 'Dùng màng phủ nông nghiệp giúp giữ ẩm, hạn chế cỏ dại và sâu hại cho rau màu.' },

  // ── Cây ăn trái ─────────────────────────────────────────────────────────────
  { crops: ['fruit'], text: 'Tỉa cành tạo tán thông thoáng giúp cây ăn trái ít sâu bệnh và đậu trái tốt hơn.' },
  { crops: ['fruit'], text: 'Bồi bùn, bón phân hữu cơ quanh gốc đầu mùa mưa giúp cây ăn trái phục hồi và nuôi trái.' },
  { crops: ['fruit'], text: 'Bao trái sớm để hạn chế ruồi đục trái và sâu hại, trái đẹp bán được giá hơn.' },
]

// Lấy mẹo của hôm nay; ưu tiên mẹo hợp cây trồng của nông dân, không có thì lấy mẹo chung.
export function getDailyTip(userCrops = []) {
  const crops = Array.isArray(userCrops) ? userCrops : []
  const relevant = FARMING_TIPS.filter(t => !t.crops || t.crops.some(c => crops.includes(c)))
  const pool = relevant.length > 0 ? relevant : FARMING_TIPS

  // Số thứ tự ngày trong năm → đổi mỗi ngày, ổn định trong cùng ngày
  const now = new Date()
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000)
  return pool[dayOfYear % pool.length].text
}
