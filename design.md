# Design System — Cò Con Dự Báo

Tài liệu thiết kế cho PWA tư vấn nông nghiệp **Cò Con**. Nguồn sự thật của token là
`@theme` trong [frontend/src/index.css](frontend/src/index.css) — tài liệu này diễn giải
cách dùng. **Luôn dùng token, đừng hardcode màu/spacing rời rạc.**

Triết lý thiết kế: **nông dân lớn tuổi, dùng điện thoại ngoài đồng, nắng chói, một tay**.
Vì vậy: chữ to, tương phản cao, vùng chạm rộng, ít bước, ngôn ngữ thuần Việt mộc mạc.

---

## 1. Thương hiệu

- **Tên:** Cò Con Dự Báo. Linh vật: con cò trắng trong vòng tròn nâu.
- **Logo/avatar:** luôn dùng `/cocon-icon-bg.png` (cò trong vòng tròn nâu).
  `/cocon-icon.png` cũ đã bỏ — không dùng lại.
- **Lưu ý icon:** Material-symbol `eco` trong chat là icon **cây rau**, KHÔNG phải con cò.
- **Màu chủ đạo:** nâu đất `#4B230A` — gợi đất ruộng, ấm, tin cậy.

---

## 2. Bảng màu (color tokens)

### Thương hiệu & nền
| Token | Hex | Dùng cho |
|---|---|---|
| `--color-primary` | `#4B230A` | Màu nâu chuẩn: nút chính, icon active, text nhấn |
| gradient tối | `#6b3410 → #4B230A` | Hero tile "Hỏi Cò Con", header logo |
| `--color-on-primary` | `#ffffff` | Chữ/icon trên nền nâu |
| `--color-surface` / `--color-background` | `#fdf8f5` | Nền toàn app (kem ấm) |
| `--color-surface-card` | `#ffffff` | Thẻ, nav, ô nhập |
| `--color-border-warm` | `#f0e0d0` | Viền thẻ ấm (mặc định cho card) |
| `--color-tab-active-bg` | `#fdf6f0` | Nền tab/icon đang chọn |

### Chữ
| Token | Hex | Dùng cho |
|---|---|---|
| `--color-text-ink` / `--color-on-surface` | `#0b1c30` | Chữ chính (gần đen, hơi xanh) |
| `--color-on-surface-variant` | `#4a3328` | Chữ phụ nâu |
| `--color-text-muted` | `#6b7280` | Chú thích mờ |
| `--color-outline` | `#7a6358` | Chữ phụ/icon inactive nâu xám |
| `--color-outline-variant` | `#d4b8a8` | Icon chevron, đường kẻ mờ |

### Ngữ nghĩa (semantic)
| Mục đích | Token / Hex | Ghi chú |
|---|---|---|
| Phụ / mùa vụ | `--color-secondary` `#855300`, container `#fea619` | Vàng nghệ |
| Thông tin / nước | `--color-tertiary` / `--color-accent-blue` `#00628d` | Xanh dương riêng cho thời tiết |
| Lỗi / cảnh báo sâu bệnh | `--color-error` `#ba1a1a`, `--color-pest-alert` `#c62828` | |
| Badge chưa đọc | `--color-badge` `#d32f2f` (thực tế dùng `#EF4444`) | Chấm đỏ |
| Mẹo / harvest | `--color-harvest-cream` `#fff8e8`, amber `#f59e0b` | Card "Mẹo hôm nay" |
| Push info | `--color-push-info` `#e3f2fd`, border `#90caf9`, text `#1565c0` | Banner thông báo |

**Quy ước cặp container/on-container** theo Material 3: nền dùng `*-container`,
chữ/icon trên đó dùng `on-*-container` để đảm bảo tương phản.

---

## 3. Typography

Font duy nhất: **Noto Sans** (`--font-sans`), fallback `system-ui, sans-serif`.
Hỗ trợ tiếng Việt đầy đủ dấu.

| Scale token | Size / line / weight | Dùng cho |
|---|---|---|
| `display-lg` | 28 / 36 / 800, `-0.5px` | Tiêu đề lớn nhất |
| `headline-lg-mobile` | 24 / 32 / 800 | Tiêu đề trang (mobile) |
| `headline-md` | 20 / 28 / 700 | Tiêu đề mục |
| `body-bold` | 18 / 28 / 700 | Nhấn mạnh trong nội dung |
| `body-reading` | 19 / 34 / 400 | **Văn bản đọc** — câu trả lời AI, dòng cao 34px cho dễ đọc |
| `label-caps` | 14 / 18 / 600, `+0.5px`, UPPERCASE | Nhãn nhóm, eyebrow |

Nguyên tắc: ưu tiên chữ to (≥13px cho phụ, ≥16px cho nội dung chính), `font-bold`/`extrabold`
cho tiêu đề thẻ. Câu trả lời kỹ thuật dùng line-height rộng để nông dân lớn tuổi đọc thoải mái.

---

## 4. Spacing, bo góc, đổ bóng

### Spacing tokens
| Token | Giá trị | Dùng cho |
|---|---|---|
| `--spacing-margin-safe` | 20px | Lề an toàn 2 bên màn hình (px-5) |
| `--spacing-stack-gap` | 24px | Khoảng cách giữa các khối lớn |
| `--spacing-gutter-card` | 16px | Padding trong thẻ |
| `--spacing-touch-target-min` | 48px | **Vùng chạm tối thiểu** — bắt buộc cho mọi nút |
| `--spacing-mic-button-lg` | 128px | Nút mic lớn |

### Bo góc (radius)
- `--radius-lg` 8px, `--radius-xl` 12px — input, banner nhỏ.
- Thực tế component dùng nhiều mức lớn hơn: `rounded-2xl` (16px) cho icon box, nav button;
  `rounded-3xl` (24px) / `rounded-[24px]` cho thẻ điều hướng & hero tile;
  `--radius-full` 9999px cho nút pill, avatar, badge tròn.
- Quy ước: phần tử càng lớn/càng "hero" thì bo càng tròn (16 → 20 → 24px).

### Đổ bóng
- Thẻ thường: `shadow-sm` hoặc `shadow-[0_4px_12px_rgba(0,0,0,0.05)]`.
- Hero/nút nâu nổi bật: `shadow-[0_8px_24px_rgba(75,35,10,0.35)]` (bóng màu nâu).
- Bottom nav: bóng hướng lên `shadow-[0_-4px_12px_rgba(0,0,0,0.06)]`.

---

## 5. Layout

App có **2 khung layout** tách biệt theo vai trò:

### Mobile-first — nông dân (`farmer`)
- Standalone, **giới hạn `max-w-[480px] mx-auto`**, căn giữa trên màn hình rộng.
- Nền `#fdf8f5`, cấu trúc: `header` → banner cảnh báo/push → `main` (CTA) → `BottomNav`.
- **BottomNav** ([frontend/src/components/BottomNav.jsx](frontend/src/components/BottomNav.jsx)):
  fixed dưới, 5 tab (Trang chủ / Trò chuyện / Cộng đồng / Thông báo / Cá nhân), cao 80px,
  tôn trọng `env(safe-area-inset-bottom)`. Tab active: nền `#fdf6f0`, chữ nâu, icon `FILL 1`.
  Chèn `<div className="h-20">` cuối trang để không che nội dung.
- **Home hero**: 2 tile vuông bằng nhau (grid 2 cột) — "Hỏi Cò Con" (gradient nâu, mic + vòng
  pulse) và "Thông báo" (trắng, badge đỏ chưa đọc), rồi card thời tiết full-width, rồi card mẹo.

### Desktop — kỹ sư / admin (`engineer`, `admin`)
- Bọc trong **`DesktopLayout`** (sidebar trái), giao diện làm việc rộng. Trang lazy-load.
- Home của staff đổi thành danh sách **NavCard** truy cập nhanh (icon box màu + tiêu đề + mô tả
  + chevron) thay cho hero/bottom-nav.

### Route công khai (không cần đăng nhập)
`/`, `/login`, `/policies`, `/weather`.

---

## 6. Component patterns

- **NavCard** (Home staff): `bg-white border-[#f0e0d0] rounded-3xl px-5 py-4 shadow-sm`,
  icon box `w-12 h-12 rounded-2xl` nền nhạt + icon màu nhấn, `active:scale-[0.98]`.
- **Hero tile**: gradient nâu, vòng `mic-pulse` bán trong suốt, icon trong vòng `bg-white/20`.
- **Banner cảnh báo** (`AlertBanner`): nền `#fef2f2`, viền trái `3px #ef4444`, icon `warning`,
  `role="alert" aria-live="polite"`.
- **Banner push** (`PushBanner`): nền `#fdf6f0`, nút pill nâu "Bật"; trạng thái `denied` đổi sang
  tông đỏ với icon `notifications_off`.
- **Card mẹo**: nền `#fffbeb` viền `#fde68a`, eyebrow uppercase amber, icon `lightbulb`.
- **Nút pill chính**: `bg-[#4B230A] text-white font-bold rounded-full`.
- **Card thời tiết**: dùng tông xanh dương riêng (`#e0f2fe` nền icon, màu theo mã WMO từ `getWMO`).
- **AnswerContent** ([frontend/src/components/AnswerContent.jsx](frontend/src/components/AnswerContent.jsx)):
  render markdown (`**đậm**`, list, xuống dòng) + **tự gắn 1 dòng disclaimer "tham khảo kỹ sư"**
  cho câu kỹ thuật (source ≠ faq/engineer). System prompt cố tình không thêm disclaimer — frontend lo.

---

## 7. Iconography

- Bộ icon: **Material Symbols Outlined** (`.material-symbols-outlined`).
- Mặc định outline (`FILL 0`); trạng thái active/nhấn dùng `.ms-fill` hoặc
  `fontVariationSettings: 'FILL' 1` để icon đặc.
- Kích thước theo ngữ cảnh: 18–20px (phụ/chevron), 22–26px (icon thẻ), 36px (hero/CTA).
- Icon quen thuộc: `mic` (hỏi giọng nói), `notifications`, `lightbulb` (mẹo),
  `warning`/`bug_report` (cảnh báo/lỗi), `menu_book` (kiến thức), `groups` (cộng đồng).

---

## 8. Motion

Animation định nghĩa sẵn trong [index.css](frontend/src/index.css), dùng qua class helper:

| Class | Hiệu ứng | Dùng cho |
|---|---|---|
| `.fade-up` | mờ + trượt lên 12px, 0.3s | Nội dung mới xuất hiện, banner |
| `.fade-in` | mờ dần, 0.25s | Chuyển nhẹ |
| `.scale-in` | phóng từ 0.92, 0.2s | Modal/popover |
| `.slide-up` | trượt từ đáy, easing mượt | Bottom sheet |
| `.mic-pulse` | vòng pulse 2s lặp | Vòng quanh nút mic |
| `.skeleton` | shimmer 1.4s | Trạng thái loading |

Phản hồi chạm: nút `:active` co `scale(0.96)` (toàn cục), thẻ lớn `active:scale-95/0.98`.
Tránh animation rườm rà — ưu tiên phản hồi tức thì và rõ ràng.

---

## 9. Accessibility & input

- **Vùng chạm ≥ 48px** (token `touch-target-min`); nút nav `minWidth 56`.
- Mọi nút icon-only có `aria-label`; tab active có `aria-current="page"`.
- Banner cảnh báo dùng `role="alert"` + `aria-live`.
- **Focus visible**: outline `2px solid #4B230A`, offset 2px. Input focus: viền nâu +
  ring `rgba(0,107,44,0.12)`.
- Hỗ trợ **giọng nói** xuyên suốt (STT/TTS) cho người ngại gõ; tránh phụ thuộc thao tác tinh vi.
- `overscroll-behavior: none`, tắt tap-highlight để cảm giác như app native.
- Tôn trọng safe-area trên thiết bị có notch (`env(safe-area-inset-bottom)`).

---

## 10. Nguyên tắc khi thêm UI mới

1. **Dùng token** trong `@theme`, không hardcode hex lạ. Cần màu mới → thêm token có ngữ nghĩa.
2. Bám 2 layout sẵn có: farmer mobile `max-w-[480px]` vs staff desktop `DesktopLayout`.
3. Chữ to, tương phản cao, vùng chạm rộng — luôn nghĩ "nông dân lớn tuổi, nắng chói, một tay".
4. Ngôn ngữ thuần Việt, mộc mạc, ngắn gọn. Tránh thuật ngữ kỹ thuật với nông dân.
5. Tái dùng pattern thẻ/banner/nút pill sẵn có thay vì tạo style mới.
