# Backend Cò Con — image dùng được cho Render, Railway (builder Dockerfile) hoặc VPS.
# Node 22 + poppler-utils (pdftotext cho upload PDF ở engineer.js). sharp dùng binary
# linux-x64 có sẵn trong package-lock (@img/sharp-linux-x64), không cần build native.
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends poppler-utils ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Cài dependency trước (cache layer), chỉ production — bỏ vitest/supertest/nodemon.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

COPY src ./src

# Không chạy bằng root
USER node

# Render/Railway truyền PORT qua env; index.js đọc process.env.PORT (mặc định 3000).
EXPOSE 3000
CMD ["node", "src/index.js"]
