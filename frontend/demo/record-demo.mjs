// Quay video demo Cò Con trên app THẬT (production) bằng Chrome đã cài sẵn (Playwright).
//
//   cd frontend
//   node demo/record-demo.mjs            # đăng nhập (nếu chưa) + quay cả 3 đoạn
//   node demo/record-demo.mjs login      # chỉ đăng nhập lại
//   node demo/record-demo.mjs record     # chỉ quay (dùng phiên đăng nhập đã lưu)
//
// Đăng nhập do NGƯỜI DÙNG tự gõ trong cửa sổ Chrome mở ra (script không đụng mật khẩu).
// Phiên đăng nhập lưu ở DEMO_AUTH_DIR (mặc định thư mục tạm của máy) — chứa token, đừng commit.
//
// Ghi dữ liệu THẬT lên production: 1 câu hỏi của nông dân (+ chuyển kỹ sư) và 1 câu trả lời
// của kỹ sư cho đúng câu đó. KHÔNG đăng bài cộng đồng, KHÔNG tải tài liệu lên kho tri thức.
//
// Biến môi trường tuỳ chọn:
//   DEMO_URL       (mặc định https://cocondubao.vercel.app)
//   DEMO_API       (mặc định https://cocon-backend.onrender.com — để đánh thức Render trước)
//   DEMO_PHOTO     đường dẫn ảnh lá bệnh → thêm cảnh hỏi bằng ảnh (tốn thêm 1 lượt Gemini)
//   DEMO_AUTH_DIR  nơi lưu phiên đăng nhập
//   DEMO_HEADED=1  hiện cửa sổ khi quay (mặc định quay ẩn)

import { chromium } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE     = path.dirname(fileURLToPath(import.meta.url))
const BASE     = process.env.DEMO_URL || 'https://cocondubao.vercel.app'
const API      = process.env.DEMO_API || 'https://cocon-backend.onrender.com'
const PHOTO    = process.env.DEMO_PHOTO
const AUTH_DIR = process.env.DEMO_AUTH_DIR || path.join(os.tmpdir(), 'cocon-demo-auth')
const OUT_DIR  = path.join(HERE, 'out')
const RAW_DIR  = path.join(OUT_DIR, '.raw')
const MODE     = process.argv[2] || 'all'

const QUESTION = 'Lúa bị đạo ôn lá thì nên xử lý thế nào?'
const ENGINEER_ANSWER = [
  'Chào bà con, đạo ôn lá hay bùng khi trời âm u, sương nhiều và ruộng bón dư đạm. Bà con nên:',
  '- Tạm ngưng bón đạm và phân bón lá có đạm.',
  '- Giữ mực nước ruộng khoảng 3–5 cm.',
  '- Phun thuốc đặc trị có hoạt chất Tricyclazole hoặc Isoprothiolane, đúng liều ghi trên nhãn, phun lúc chiều mát; nếu bệnh còn lan thì phun lại sau 5–7 ngày.',
  'Nếu vết bệnh lan nhanh, bà con chụp ảnh lá gửi lại để kỹ sư xem kỹ hơn nhé.',
].join('\n')

const PHONE = {
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh',
}
const DESKTOP = {
  viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1,
  locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh',
}

const authFile = role => path.join(AUTH_DIR, `${role}.json`)
const pause = ms => new Promise(r => setTimeout(r, ms))

// ─── Lớp phủ: phụ đề song ngữ + vòng tròn chỗ chạm ───────────────────────────
// Gắn vào <html> (ngoài #root) để React render lại không xoá mất.
function overlayInit() {
  const ensure = () => {
    if (document.getElementById('__demo_cap')) return document.getElementById('__demo_cap')
    const st = document.createElement('style')
    st.textContent = `
      #__demo_cap{position:fixed;left:50%;transform:translateX(-50%);width:calc(100% - 24px);max-width:760px;
        box-sizing:border-box;z-index:2147483647;pointer-events:none;padding:10px 14px;border-radius:14px;
        background:rgba(46,21,5,.88);color:#fff;font-family:'Noto Sans',system-ui,sans-serif;
        box-shadow:0 6px 20px rgba(0,0,0,.25);transition:opacity .35s;opacity:0;text-align:center}
      #__demo_cap[data-pos=bottom]{bottom:18px}
      /* top = gọn trong thanh tiêu đề (~60px) để không che bong bóng chat */
      #__demo_cap[data-pos=top]{top:5px;padding:6px 12px;border-radius:12px;width:calc(100% - 12px)}
      #__demo_cap[data-pos=top] .vi{font-size:13.5px} #__demo_cap[data-pos=top] .en{font-size:11px;margin-top:1px}
      #__demo_cap .vi{font-size:15px;font-weight:700;line-height:1.35}
      #__demo_cap .en{font-size:12.5px;opacity:.85;margin-top:3px;line-height:1.3;font-style:italic}
      .__demo_tap{position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;
        background:rgba(75,35,10,.28);border:2px solid rgba(75,35,10,.7);pointer-events:none;
        z-index:2147483646;animation:__demo_tap .55s ease-out forwards}
      @keyframes __demo_tap{from{transform:scale(.4);opacity:1}to{transform:scale(1.5);opacity:0}}`
    document.documentElement.appendChild(st)
    const d = document.createElement('div')
    d.id = '__demo_cap'
    d.dataset.pos = 'bottom'
    d.innerHTML = '<div class="vi"></div><div class="en"></div>'
    document.documentElement.appendChild(d)
    return d
  }
  window.__demoCaption = (vi, en, pos = 'bottom') => {
    const d = ensure()
    d.querySelector('.vi').textContent = vi || ''
    d.querySelector('.en').textContent = en || ''
    d.dataset.pos = pos
    d.style.opacity = vi ? '1' : '0'
  }
  document.addEventListener('pointerdown', e => {
    const t = document.createElement('div')
    t.className = '__demo_tap'
    t.style.left = e.clientX + 'px'
    t.style.top = e.clientY + 'px'
    document.documentElement.appendChild(t)
    setTimeout(() => t.remove(), 700)
  }, true)
}

async function cap(page, vi, en, pos = 'bottom') {
  await page.evaluate(([a, b, c]) => window.__demoCaption?.(a, b, c), [vi, en, pos]).catch(() => {})
}
async function tap(locator) {
  await locator.scrollIntoViewIfNeeded()
  await pause(500)
  await locator.click()
}
async function typeSlow(locator, text, delay = 55) {
  await locator.click()
  await locator.pressSequentially(text, { delay })
}
// Cuộn mượt vùng cuộn chính (trang dùng <main overflow-y-auto> hoặc cuộn cả cửa sổ).
async function smoothScroll(page, total = 600, step = 120, every = 260) {
  for (let y = 0; y < total; y += step) {
    await page.evaluate(dy => {
      const els = [...document.querySelectorAll('main, [role=log], [role=feed]')]
        .filter(el => el.scrollHeight > el.clientHeight + 4)
      const el = els[0]
      if (el) el.scrollBy({ top: dy, behavior: 'smooth' })
      else window.scrollBy({ top: dy, behavior: 'smooth' })
    }, step)
    await pause(every)
  }
}
async function settle(page, ms = 1500) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await pause(ms)
}

async function warmBackend() {
  process.stdout.write(`Đánh thức backend ${API} ... `)
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(60_000) })
      if (r.ok) { console.log('OK'); return }
    } catch { /* Render đang khởi động */ }
    await pause(5000)
  }
  throw new Error('Backend không trả lời /health — kiểm tra Render trước khi quay.')
}

// ─── Đăng nhập (người dùng tự gõ) ─────────────────────────────────────────────
async function login(role) {
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: false })
  const ctx = await browser.newContext(role === 'farmer' ? PHONE : DESKTOP)
  await ctx.addInitScript(overlayInit)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`)
  await settle(page, 500)
  const vi = role === 'farmer' ? 'Đăng nhập tài khoản NÔNG DÂN để quay demo' : 'Đăng nhập tài khoản KỸ SƯ để quay demo'
  const en = role === 'farmer' ? 'Log in with the FARMER account' : 'Log in with the ENGINEER account'
  await cap(page, vi, en, 'top')
  console.log(`\n>>> Cửa sổ Chrome đã mở: ${en}. Đang chờ (tối đa 10 phút)...`)
  const target = role === 'farmer' ? /\/(home|profile)(\?|$)/ : /\/(engineer|admin)(\/|\?|$)/
  // Cửa sổ kỹ sư mà vào /home = vừa đăng nhập tài khoản NÔNG DÂN → nhắc, đăng xuất, cho thử lại.
  const deadline = Date.now() + 10 * 60_000
  while (!target.test(new URL(page.url()).pathname)) {
    if (Date.now() > deadline) throw new Error(`Hết 10 phút chờ đăng nhập ${role}.`)
    if (role === 'engineer' && /^\/(home|profile|chat|notifications|community)/.test(new URL(page.url()).pathname)) {
      console.log('    Tài khoản vừa đăng nhập là NÔNG DÂN, không phải kỹ sư — đưa về trang đăng nhập.')
      await page.evaluate(() => localStorage.removeItem('cocon-auth'))
      await page.goto(`${BASE}/login`)
      await settle(page, 500)
      await cap(page, 'Tài khoản vừa rồi là NÔNG DÂN. Chọn "Kỹ sư / Admin" và đăng nhập bằng email kỹ sư',
        'That was a FARMER account. Choose "Kỹ sư / Admin" and log in with the engineer email', 'top')
    }
    await pause(1000)
  }
  await settle(page, 1000)
  await ctx.storageState({ path: authFile(role) })
  console.log(`    Đã lưu phiên ${role}.`)
  await browser.close()
}

// ─── Quay ─────────────────────────────────────────────────────────────────────
async function withRecording(browser, role, opts, name, fn) {
  // Video Playwright quay theo pixel CSS (bỏ qua deviceScaleFactor) → size phải = viewport,
  // để lớn hơn chỉ ra khung xám thừa.
  const size = role === 'farmer'
    ? { width: 390, height: 844 }
    : { width: 1280, height: 800 }
  const ctx = await browser.newContext({
    ...opts,
    // Trình duyệt mới tinh: SW cài lần đầu → clientsClaim → app reload giữa cảnh quay.
    serviceWorkers: 'block',
    storageState: authFile(role),
    recordVideo: { dir: RAW_DIR, size },
  })
  await ctx.addInitScript(overlayInit)
  const page = await ctx.newPage()
  const video = page.video()
  try {
    await fn(page)
  } catch (err) {
    await page.screenshot({ path: path.join(OUT_DIR, `${name}-LOI.png`) }).catch(() => {})
    throw err
  } finally {
    await ctx.close()
    const dest = path.join(OUT_DIR, `${name}.webm`)
    await video.saveAs(dest).catch(() => {})
    await video.delete().catch(() => {})
    console.log(`    → ${dest}`)
  }
}

async function farmerAsks(page) {
  await page.goto(`${BASE}/home`)
  await settle(page)
  if (/\/login/.test(page.url())) throw new Error('Phiên nông dân hết hạn — chạy lại: node demo/record-demo.mjs login')
  await cap(page, 'Cò Con — trợ lý nông nghiệp cho bà con xã Trường Khánh', 'Cò Con — a farming assistant for Trường Khánh commune')
  await pause(3500)
  await cap(page, 'Trang chủ: hỏi Cò Con, thông báo, thời tiết', 'Home: ask Cò Con, alerts and weather')
  await pause(3000)

  // Hỏi bằng chữ
  await tap(page.getByRole('button', { name: 'Hỏi Cò Con' }))
  await page.waitForURL(/\/chat$/)
  await settle(page, 800)
  await cap(page, 'Gõ hoặc nói câu hỏi về cây trồng', 'Type or speak a crop question', 'top')
  await pause(1500)
  const input = page.getByLabel('Nhập câu hỏi')
  await typeSlow(input, QUESTION)
  await pause(700)
  const typed = await input.inputValue()
  if (typed !== QUESTION) {
    console.log(`    [cảnh báo] ô nhập có "${typed}" thay vì câu hỏi → điền lại`)
    await input.fill(QUESTION)
    await pause(500)
  }
  if (process.env.DEMO_DRY === '1') {
    console.log('    DRY: dừng trước khi gửi câu hỏi. Nút gửi bật =', await page.getByRole('button', { name: 'Gửi câu hỏi' }).isEnabled())
    return
  }
  const askResp = page.waitForResponse(
    r => r.url().includes('/chat/ask') && r.request().method() === 'POST', { timeout: 90_000 })
  askResp.catch(() => {}) // tránh unhandled rejection che mất lỗi thật nếu bước sau hỏng
  await tap(page.getByRole('button', { name: 'Gửi câu hỏi' }))
  await cap(page, 'Cò Con tra tài liệu nông nghiệp…', 'Searching the farming knowledge base…', 'top')
  const data = await (await askResp).json().catch(() => ({}))

  if (data.needEngineer) {
    await page.waitForURL(/\/chat\/waiting/, { timeout: 15_000 })
    await settle(page, 500)
    await cap(page, 'Câu khó: tự động chuyển cho kỹ sư nông nghiệp', 'Hard question: automatically sent to an agronomist')
    await pause(5000)
  } else {
    await pause(1200)
    await cap(page, 'Trả lời dễ hiểu, có nút nghe đọc', 'Plain answer, with read-aloud', 'top')
    await smoothScroll(page, 900, 110, 380)
    await pause(2500)
    // Chuyển kỹ sư xem lại (1 chạm)
    page.once('dialog', d => d.accept())
    const esc = page.getByRole('button', { name: 'Hỏi lại kỹ sư' }).last()
    await cap(page, 'Chưa chắc? Một chạm hỏi kỹ sư', 'Not sure? One tap asks an engineer', 'top')
    await pause(1500)
    await tap(esc)
    await pause(3500)
  }

  // Hỏi bằng ảnh (tuỳ chọn)
  if (PHOTO && fs.existsSync(PHOTO)) {
    await page.goto(`${BASE}/chat/image`)
    await settle(page, 800)
    await cap(page, 'Hoặc chụp ảnh lá bệnh', 'Or snap a photo of the sick leaf', 'top')
    await page.locator('input[type=file]').setInputFiles(PHOTO)
    await pause(1500)
    await typeSlow(page.getByLabel('Mô tả thêm'), 'Lá lúa có vết đốm hình thoi, xuất hiện 3 ngày nay')
    const imgResp = page.waitForResponse(r => r.url().includes('/chat/') && r.request().method() === 'POST', { timeout: 90_000 })
    await tap(page.getByRole('button', { name: 'Gửi cho Cò Con' }))
    await imgResp.catch(() => {})
    await settle(page, 1500)
    await smoothScroll(page, 900, 110, 380)
    await pause(2500)
  }

  // Thời tiết
  await page.goto(`${BASE}/weather`)
  await settle(page)
  await cap(page, 'Thời tiết theo giờ, theo ngày cho xã', 'Hourly and daily weather for the commune')
  await pause(2500)
  await smoothScroll(page, 900, 120, 350)
  await pause(1500)

  // Cộng đồng
  await page.goto(`${BASE}/community`)
  await settle(page, 2500)
  await cap(page, 'Cộng đồng: bà con chia sẻ kinh nghiệm, hình ảnh mùa vụ', 'Community: farmers share tips and harvest photos')
  await pause(2500)
  await smoothScroll(page, 1200, 120, 330)
  await pause(1500)

  // Thông báo
  await page.goto(`${BASE}/notifications`)
  await settle(page)
  await page.locator('[role=feed][aria-busy=false]').waitFor({ timeout: 20_000 }).catch(() => {})
  await pause(800)
  await cap(page, 'Thông báo: lịch phun thuốc, cảnh báo thời tiết, tin của xã', 'Alerts: spraying reminders, weather warnings, commune news')
  await pause(4000)

  // Hồ sơ — cỡ chữ
  await page.goto(`${BASE}/profile`)
  await settle(page)
  await cap(page, 'Hồ sơ: chọn cây trồng, cỡ chữ lớn cho dễ đọc', 'Profile: pick your crops and a larger reading size')
  await pause(1500)
  const big = page.getByRole('button', { name: 'Rất lớn' })
  if (await big.count()) {
    await tap(big)
    await pause(1800)
    await tap(page.getByRole('button', { name: 'Thường' }))
    await pause(1500)
  }
  await cap(page, '')
  await pause(800)
}

async function engineerAnswers(page) {
  await page.goto(`${BASE}/engineer/queue`)
  await settle(page)
  if (/\/login/.test(page.url())) throw new Error('Phiên kỹ sư hết hạn — chạy lại: node demo/record-demo.mjs login')
  await cap(page, 'Kỹ sư: hàng đợi câu hỏi của bà con', "Engineer: the farmers' question queue")
  await pause(3000)

  const takeBtn = /Nhận & Trả lời|Tiếp tục trả lời/
  const card = page.locator('div')
    .filter({ hasText: QUESTION })
    .filter({ has: page.getByRole('button', { name: takeBtn }) })
    .last()
  for (let i = 0; i < 6 && !(await card.count()); i++) {
    await tap(page.getByRole('button', { name: 'Tải lại' }))
    await settle(page, 2500)
  }
  if (!(await card.count())) throw new Error('Không thấy câu hỏi demo trong hàng đợi kỹ sư.')

  await cap(page, 'Nhận câu hỏi để không ai trả lời trùng', 'Claim the question so no one else answers it twice')
  await pause(2000)
  await tap(card.getByRole('button', { name: takeBtn }))
  await page.waitForURL(/\/engineer\/answer\//)
  await settle(page, 1200)
  await cap(page, 'Soạn câu trả lời chính xác cho nông dân', 'Write an accurate reply for the farmer')
  await typeSlow(page.locator('#answer-textarea'), ENGINEER_ANSWER, 12)
  await pause(1500)
  await tap(page.getByRole('button', { name: /Gửi câu trả lời cho nông dân/ }))
  await page.waitForURL(/\/engineer\/queue/, { timeout: 30_000 })
  await settle(page, 800)
  await cap(page, 'Đã gửi — nông dân nhận thông báo trên điện thoại', "Sent — the farmer's phone gets a notification")
  await pause(3500)

  // Kho tri thức (chỉ xem, không tải lên)
  await page.goto(`${BASE}/engineer/knowledge`)
  await settle(page)
  await cap(page, 'Kho tri thức: tài liệu PDF/Word và hỏi-đáp mẫu làm nền cho AI', "Knowledge base: PDF/Word documents and curated Q&A behind the AI's answers")
  await pause(3000)
  await smoothScroll(page, 700, 120, 330)
  await pause(1000)
  const search = page.getByLabel('Tìm kiếm tài liệu')
  if (await search.count()) {
    await typeSlow(search, 'lúa', 120)
    await settle(page, 2500)
  }
  const preview = page.getByRole('button', { name: 'Xem nội dung' }).first()
  if (await preview.count()) {
    await tap(preview)
    await settle(page, 3500)
    await smoothScroll(page, 500, 100, 350)
    await page.keyboard.press('Escape').catch(() => {})
    const close = page.getByRole('button', { name: 'Đóng' }).first()
    if (await close.isVisible().catch(() => false)) await tap(close)
    await pause(1200)
  }
  await cap(page, '')
  await pause(800)
}

async function farmerGetsReply(page) {
  await page.goto(`${BASE}/chat/history`)
  await settle(page)
  await cap(page, 'Mở lại cuộc hỏi đáp…', 'Back on the farmer’s phone…', 'top')
  await pause(2000)
  await tap(page.getByText(QUESTION).first())
  await page.waitForURL(/\/chat$/)
  await settle(page, 1500)
  await smoothScroll(page, 3000, 200, 300)
  await page.getByText('Kỹ sư xác nhận').last().waitFor({ timeout: 20_000 }).catch(() => {})
  await cap(page, 'Kỹ sư đã trả lời — có dấu xác nhận', 'The engineer replied — marked verified', 'top')
  await pause(5000)
  await cap(page, 'Cò Con — hỏi là có người trả lời', 'Every question gets an answer', 'top')
  await pause(3500)
}

async function record() {
  for (const r of ['farmer', 'engineer']) {
    if (!fs.existsSync(authFile(r))) throw new Error(`Chưa có phiên ${r} — chạy: node demo/record-demo.mjs login`)
  }
  fs.mkdirSync(RAW_DIR, { recursive: true })
  await warmBackend()
  const browser = await chromium.launch({ channel: 'chrome', headless: process.env.DEMO_HEADED !== '1' })
  try {
    console.log('Quay đoạn 1: nông dân hỏi…')
    await withRecording(browser, 'farmer', PHONE, '1-nong-dan-hoi', farmerAsks)
    if (process.env.DEMO_DRY === '1') return
    console.log('Quay đoạn 2: kỹ sư trả lời…')
    await withRecording(browser, 'engineer', DESKTOP, '2-ky-su-tra-loi', engineerAnswers)
    console.log('Quay đoạn 3: nông dân nhận câu trả lời…')
    await withRecording(browser, 'farmer', PHONE, '3-nong-dan-nhan-tra-loi', farmerGetsReply)
  } finally {
    await browser.close()
    fs.rmSync(RAW_DIR, { recursive: true, force: true })
  }
  console.log(`\nXong. Video ở ${OUT_DIR}`)
}

fs.mkdirSync(OUT_DIR, { recursive: true })
for (const role of ['farmer', 'engineer']) {
  if (MODE === 'login' || (MODE === 'all' && !fs.existsSync(authFile(role)))) await login(role)
}
if (MODE === 'record' || MODE === 'all') await record()
if (MODE === 'clean') { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); console.log('Đã xoá phiên đăng nhập demo.') }
