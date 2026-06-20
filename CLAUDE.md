# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Cò Con là PWA tư vấn nông nghiệp cho nông dân xã Trường Khánh, Sóc Trăng: nông dân hỏi (text/giọng nói/ảnh) → AI trả lời bằng RAG, câu khó được chuyển cho kỹ sư. Có 3 vai trò: `farmer`, `engineer`, `admin`.

## Monorepo layout

Hai package độc lập, **không có** package.json ở root:

- `backend/` — Express API (ESM, `"type": "module"`). Deploy lên Railway (service `laudable-happiness`).
- `frontend/` — React 19 + Vite + Tailwind v4 PWA. Deploy lên Vercel (`cocondubao.vercel.app`).
- `supabase/migrations/` — schema Postgres + pgvector (nguồn sự thật của DB).

## Lệnh thường dùng

⚠️ **Luôn `cd` vào đúng package trước khi chạy npm.** Bash tool hay reset cwd về root; chạy npm ở root sẽ tạo rác `package.json`/`node_modules` ở root.

```bash
# Backend (cd backend/ trước)
npm run dev          # nodemon src/index.js (port 3000)
npm test             # vitest run — toàn bộ test
npm test -- rag      # chạy 1 file (match theo tên: rag.test.js)
npm run test:watch   # vitest watch

# Frontend (cd frontend/ trước)
npm run dev          # vite dev (port 5173)
npm run build        # vite build → dist/
npm run lint         # eslint .
```

Không có lint/test ở backend ngoài vitest. Frontend không có test.

## Deploy

Cả hai deploy **tự động qua git push** (Railway watch backend, Vercel watch frontend). Không có lệnh deploy thủ công — fix chỉ có hiệu lực ở production **sau khi push + redeploy**. Khi sửa bug production, nhớ là backend đang chạy vẫn dùng code cũ cho tới khi push.

## Database & migrations

- DB là Supabase Postgres (project ref `mcloxncymnhiuubjzgbh`) + extension `pgvector`. RAG search qua RPC `match_knowledge_chunks(query_embedding, match_threshold, match_count, filter_crop)`.
- **Máy này KHÔNG có Docker** → không dùng `supabase db push`/`db dump`. Áp migration bằng `psql` 17 trực tiếp lên DB production qua Session pooler:
  `C:\Program Files\PostgreSQL\17\bin\psql.exe` (và `pg_dump.exe` để export schema).
- Bảng chính: `users`, `chat_sessions`, `messages`, `engineer_queue`, `knowledge_docs`, `knowledge_chunks`, `notifications`, `notification_reads`, `push_subscriptions`, `posts`/`comments`/`post_likes`, `ai_error_reports`.
- Khi thêm migration: tạo file trong `supabase/migrations/`, áp tay bằng psql, rồi commit. Cột vector là `vector(1536)`.

## Kiến trúc backend

- `src/index.js` — wiring: helmet, cors, 2 rate-limiter (chat 15/phút theo **userId** rồi fallback IP, auth 10/phút theo IP), mount routes dưới `/api/v1/*`, khởi động notification scheduler + đồng bộ denylist tài khoản bị khoá. `app.set('trust proxy', 1)` là bắt buộc để `req.ip` đúng sau reverse-proxy của Railway. Chat limiter dùng `keyGenerator` thủ công (`userOrIpKey`): khoá theo `user:<userId>` khi có JWT, chưa đăng nhập thì gọi `ipKeyGenerator(req.ip)`. **Quan trọng:** nếu tự viết keyGenerator mà fallback theo IP thì PHẢI dùng `ipKeyGenerator` (export từ express-rate-limit) chứ đừng trả thẳng `req.ip` — trả `req.ip` thô mới gây `ERR_ERL_KEY_GEN_IPV6` trên v8.
- Auth: JWT tự ký (`middleware/auth.js`: `verifyJWT` đọc `Bearer`, `requireRole(...roles)`). KHÔNG dùng Supabase Auth — password tự hash bằng bcrypt trong `routes/auth.js`.
- `services/rag.js` — trái tim hệ thống. Pipeline `askRAG()` phân tầng để **tiết kiệm quota Gemini**, theo thứ tự:
  1. `checkFAQ()` — regex match câu xã giao, trả lời ngay, 0 quota.
  2. Answer cache in-memory (TTL 1h, max 200).
  3. Embed câu hỏi → `match_knowledge_chunks` top-5.
  4. Nếu chunk khớp nhất là QA biên soạn (`"Câu trả lời:"`) và sim ≥ 0.80 → `extractCuratedAnswer()` trả thẳng, bỏ qua LLM (`source: 'qa_direct'`).
  5. confidence < 0.5 → `needEngineer: true`. 0.5–0.7 → LLM context hạn chế. ≥ 0.7 → LLM đầy đủ + cache.
- `services/notifications.js` — scheduler in-process (`setInterval` 60s) gửi push đặt lịch + quiet-hours. **In-process nên chỉ đúng khi chạy 1 replica** (Railway hiện 1 replica). Nếu scale nhiều replica thì scheduler + cache + rate-limit in-memory đều phải chuyển sang Redis/queue.
- Routes mount 2 lần cho gọn URL: `push.js` phục vụ cả `/push` lẫn `/notifications`; `engineer.js` phục vụ cả `/engineer` lẫn `/knowledge`.

## Models Gemini (quan trọng)

Tất cả qua `GOOGLE_API_KEY`. Free tier tính quota **riêng từng model**, rất thấp (~20 request/ngày/model nhóm generate) → đây là nguồn lỗi 429 chính ở production.

- RAG answer LLM: `gemini-2.5-flash`, `maxOutputTokens: 2048`. Đây là model **thinking** — token suy nghĩ tính vào maxOutputTokens, để thấp sẽ bị cắt cụt câu trả lời.
- Vision (chat ảnh, `routes/chat.js`): `gemini-2.5-flash`, `maxOutputTokens: 2048`. Trước dùng `gemini-2.0-flash` nhưng free tier model đó đã về `limit: 0` (Google bỏ free tier) → đổi sang 2.5-flash. **Lưu ý:** 2.5-flash CHUNG bucket quota với RAG answer LLM. Vision thất bại sẽ fallback mềm sang RAG (text-only).
- Embedding: `gemini-embedding-001`, 1536-dim, gửi tuần tự 700ms/request. **Đổi model embedding = đổi không gian vector → phải re-embed toàn bộ:** `node scripts/reembed_all.js`.
- `invokeLLM`/`isRateLimit` retry cả 429 (quota) lẫn 503 (overloaded), đọc `retry in Ns` từ message Gemini, có backoff + jitter.
- Fix triệt để 429 = bật billing Gemini (việc của user); đổi model chỉ là band-aid.

Scripts kho tri thức: `backend/scripts/seed_rag.js` (tạo doc seed mới — **đừng chạy lặp**, mỗi lần tạo doc mới), `reembed_all.js` (re-embed an toàn, keeper).

## Kiến trúc frontend

- `services/api.js` — toàn bộ HTTP gom thành các object (`authAPI`, `chatAPI`, `pushAPI`, `engineerAPI`, `communityAPI`, `adminAPI`). Axios interceptor gắn JWT từ `localStorage['cocon-auth']` và tự đẩy về `/login` khi 401. Chat dùng timeout dài (45s text / 60s ảnh) vì LLM có thể retry.
- State: Zustand (`stores/authStore.js`, persist key `cocon-auth`) + React Query (`staleTime` 5 phút).
- Routing (`App.jsx`): `ProtectedRoute` gác token + `allowedRoles`. Trang nông dân import ngay; trang engineer/admin `lazy()`. Route công khai: `/`, `/login`, `/policies`, `/weather`. Trang engineer/admin bọc trong `DesktopLayout` (sidebar); trang nông dân là mobile-first standalone.
- Component hiển thị câu trả lời: `components/AnswerContent.jsx` render markdown (`**đậm**`, list, xuống dòng) và **tự gắn 1 dòng disclaimer** "tham khảo kỹ sư" cho câu kỹ thuật (source != faq/engineer). SYSTEM_PROMPT cố tình KHÔNG tự thêm disclaimer — để frontend lo.
- Hooks: `useWeather` (Open-Meteo, có fallback khi 429), `useSTT`/`useTTS` (giọng nói), `usePush` (web-push subscribe).

## Thương hiệu

- Màu nâu chuẩn `#4B230A` (gradient tối `#2e1505`), surface `#fdf8f5`. Token định nghĩa trong `@theme` của `frontend/src/index.css` — dùng token, đừng hardcode.
- Mọi avatar/logo dùng `/cocon-icon-bg.png` (cò trong vòng tròn nâu). `/cocon-icon.png` cũ đã bỏ. Material-symbol `eco` ở chat là icon cây rau, KHÔNG phải con cò.

## Biến môi trường

Backend (`backend/.env`): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `GOOGLE_API_KEY`, `JWT_SECRET`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_CONTACT`, `FRONTEND_URL`, `PORT`, `NODE_ENV`.
Frontend (`frontend/.env.local`): `VITE_API_URL`, và Supabase keys cho `services/supabase.js`.

## Lưu ý khi viết test (vitest)

- Mock Supabase/Gemini qua `vi.hoisted`. `GoogleGenerativeAI`/`ChatGoogleGenerativeAI` gọi bằng `new` → mock **phải là `function`** (arrow function không làm constructor được).
- Supabase query builder mock kiểu thenable/chainable: mỗi `await` lấy 1 result đã enqueue.
- `rag.js` export sẵn `checkFAQ`, `extractCuratedAnswer`, `getAnswerCache`/`setAnswerCache`/`_clearAnswerCache`, `embedTexts` để test.
