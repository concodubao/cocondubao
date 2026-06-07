import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Shield, FileText, Mail } from 'lucide-react'

const CONTACT_EMAIL = 'conconongnghiep@gmail.com'
const UPDATED = '08/06/2026'

// Mỗi mục: tiêu đề + danh sách đoạn (chuỗi). **đậm** được tô đậm đơn giản.
const PRIVACY = [
  {
    h: 'Thông tin Cò Con thu thập',
    items: [
      '**Thông tin tài khoản:** số điện thoại (dùng đăng nhập), tên, ấp/xã và loại cây trồng bạn tự cung cấp.',
      '**Nội dung trao đổi:** câu hỏi, ảnh cây/sâu bệnh bạn gửi cho Cò Con và bài đăng/bình luận trong Cộng đồng.',
      '**Thông báo:** đăng ký nhận thông báo đẩy trên thiết bị (nếu bạn cho phép).',
      '**Vị trí:** chỉ dùng tại chỗ để hiển thị thời tiết khu vực của bạn — KHÔNG lưu lại trên máy chủ.',
    ],
  },
  {
    h: 'Cò Con dùng thông tin để làm gì',
    items: [
      'Trả lời câu hỏi nông nghiệp và kết nối bạn với kỹ sư khi cần.',
      'Gửi cảnh báo sâu bệnh, thời tiết, thông báo phù hợp cây trồng của bạn.',
      'Cải thiện chất lượng câu trả lời (rà soát các câu trả lời bị báo lỗi).',
    ],
  },
  {
    h: 'Chia sẻ với bên thứ ba',
    items: [
      'Cò Con **không bán** thông tin của bạn cho bất kỳ ai.',
      'Một số dịch vụ kỹ thuật giúp app hoạt động: lưu trữ dữ liệu (Supabase), trợ lý AI (Google Gemini), gửi mã OTP (nhà mạng/Twilio), dữ liệu thời tiết (Open-Meteo).',
      '**Khi nào kỹ sư xem câu hỏi:** chỉ những câu được **chuyển cho kỹ sư** (câu khó AI chưa trả lời được) mới được kỹ sư xem để trả lời. Các cuộc trò chuyện khác không bị xem tự do.',
      'Đội ngũ cũng rà soát câu trả lời của AI (không kèm danh tính của bạn) để cải thiện chất lượng.',
    ],
  },
  {
    h: 'Lưu trữ & bảo mật',
    items: [
      'Mật khẩu được mã hoá (băm), kết nối dùng token bảo mật.',
      'Dữ liệu được lưu trên hạ tầng đám mây có kiểm soát truy cập.',
    ],
  },
  {
    h: 'Quyền của bạn',
    items: [
      'Xem và chỉnh sửa thông tin cá nhân bất cứ lúc nào trong mục **Hồ sơ cá nhân**.',
      'Yêu cầu xoá tài khoản và dữ liệu cá nhân bằng cách liên hệ email bên dưới.',
      'Tắt nhận thông báo bất cứ lúc nào trong **Cài đặt thông báo**.',
    ],
  },
]

const TERMS = [
  {
    h: 'Cò Con là công cụ tham khảo',
    items: [
      'Cò Con hỗ trợ thông tin nông nghiệp mang tính **tham khảo**, KHÔNG thay thế tư vấn trực tiếp của kỹ sư/chuyên gia.',
      'Với quyết định quan trọng (phun thuốc liều cao, xử lý bệnh nặng), bạn nên xác nhận thêm với kỹ sư địa phương.',
      'AI có thể trả lời chưa chính xác — bạn tự cân nhắc trước khi áp dụng.',
    ],
  },
  {
    h: 'Trách nhiệm tài khoản',
    items: [
      'Giữ bí mật mã OTP và mật khẩu của bạn.',
      'Thông tin bạn cung cấp cần trung thực để Cò Con hỗ trợ đúng.',
    ],
  },
  {
    h: 'Sử dụng hợp lệ',
    items: [
      'Không đăng nội dung sai sự thật, xúc phạm hay quảng cáo trái phép trong Cộng đồng.',
      'Không dùng app vào mục đích gây hại hoặc phá hoại hệ thống.',
    ],
  },
  {
    h: 'Thay đổi điều khoản',
    items: [
      'Điều khoản có thể được cập nhật; thay đổi quan trọng sẽ được thông báo trong app.',
    ],
  },
]

function renderBold(text, key) {
  return text.split(/(\*\*[^*]+?\*\*)/g).map((p, i) => {
    const m = /^\*\*([^*]+?)\*\*$/.exec(p)
    return m ? <strong key={`${key}-${i}`} style={{ color: '#0b1c30' }}>{m[1]}</strong> : <span key={`${key}-${i}`}>{p}</span>
  })
}

function Block({ icon, title, groups }) {
  return (
    <section style={s.card}>
      <div style={s.cardHead}>
        {icon}
        <h2 style={s.cardTitle}>{title}</h2>
      </div>
      {groups.map((g, gi) => (
        <div key={gi} style={{ marginTop: gi === 0 ? 4 : 14 }}>
          <h3 style={s.groupTitle}>{g.h}</h3>
          <ul style={s.list}>
            {g.items.map((it, i) => (
              <li key={i} style={s.li}>
                <span style={s.dot}>•</span>
                <span>{renderBold(it, `${gi}-${i}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

export default function Policies() {
  const navigate = useNavigate()

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button onClick={() => navigate(-1)} style={s.iconBtn} aria-label="Quay lại">
          <ChevronLeft size={22} />
        </button>
        <h1 style={s.title}>Chính sách & Điều khoản</h1>
      </header>

      <main style={s.main}>
        <p style={s.updated}>Cập nhật lần cuối: {UPDATED}</p>

        <Block icon={<Shield size={18} color="#4B230A" />} title="Chính sách bảo mật" groups={PRIVACY} />
        <Block icon={<FileText size={18} color="#4B230A" />} title="Điều khoản sử dụng" groups={TERMS} />

        <section style={s.card}>
          <div style={s.cardHead}>
            <Mail size={18} color="#4B230A" />
            <h2 style={s.cardTitle}>Liên hệ</h2>
          </div>
          <p style={{ ...s.li, marginTop: 4 }}>
            Mọi thắc mắc hoặc yêu cầu về dữ liệu, vui lòng gửi email:
          </p>
          <a href={`mailto:${CONTACT_EMAIL}`} style={s.email}>{CONTACT_EMAIL}</a>
        </section>

        <p style={s.footer}>Cò Con — Trợ lý nông nghiệp 🌾</p>
      </main>
    </div>
  )
}

const s = {
  page:      { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fdf8f5', fontFamily: "'Noto Sans', sans-serif", maxWidth: 480, margin: '0 auto' },
  header:    { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#fff', borderBottom: '1px solid #f0e0d0', position: 'sticky', top: 0, zIndex: 10 },
  iconBtn:   { width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  title:     { fontSize: 17, fontWeight: 700, color: '#0b1c30', margin: 0 },
  main:      { flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 'max(32px, env(safe-area-inset-bottom))' },
  updated:   { fontSize: 13, color: '#6b7280', margin: '0 2px' },
  card:      { background: '#fff', borderRadius: 16, padding: '16px 18px', border: '1px solid #f0e0d0' },
  cardHead:  { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#0b1c30', margin: 0 },
  groupTitle:{ fontSize: 14.5, fontWeight: 700, color: '#855300', margin: '0 0 6px' },
  list:      { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 },
  li:        { display: 'flex', gap: 8, fontSize: 14.5, lineHeight: 1.6, color: '#374151', margin: 0, alignItems: 'flex-start' },
  dot:       { color: '#855300', fontWeight: 700, flexShrink: 0 },
  email:     { display: 'inline-block', marginTop: 8, fontSize: 15, fontWeight: 600, color: '#00628d', textDecoration: 'none' },
  footer:    { textAlign: 'center', fontSize: 13, color: '#6b7280', margin: '8px 0 0' },
}
