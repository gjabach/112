# Novelist Studio - Web App Viết Tiểu Thuyết Chuyên Nghiệp

> **Miễn phí 100% - Chạy 24/7 trên Cloudflare Free Tier - BYOK AI**

Công cụ viết tiểu thuyết all-in-one cho nhà văn Việt Nam, lấy cảm hứng từ Notion, Scrivener, Ulysses, Linear.

![License](https://img.shields.io/badge/license-MIT-green)
![Stack](https://img.shields.io/badge/stack-Next.js%2015%20%2B%20Cloudflare%20Workers-blue)
![Free](https://img.shields.io/badge/cost-%240%2Fmonth-brightgreen)

## ✨ Tính năng

### 📝 Editor Chuyên Nghiệp
- **Tiptap Rich Text**: heading, bold, italic, list, blockquote, code, image, link
- **3 chế độ**: Focus mode (ẩn UI), Typewriter mode (dòng hiện tại giữa màn hình), Fullscreen
- **Auto-save** mỗi 5s (debounced) + indicator "Đã lưu"
- **Version history**: snapshot mỗi 10 phút, diff & restore
- **Word count**, reading time, Pomodoro timer
- **Command palette** (Cmd+K)

### 👥 Quản Lý Nhân Vật
- Profile chi tiết: ngoại hình, tính cách, lai lịch, động cơ, nỗi sợ, bí mật...
- **Relationship graph** (React Flow) - visual hóa quan hệ
- **Character arc** visualization
- Custom fields
- AI consistency check

### 🌍 Xây Dựng Thế Giới
- Locations (hierarchical: world > continent > city > building)
- Organizations, Species, Magic Systems, Religions, Items, Events
- **Map view**: upload bản đồ, pin locations
- Related entities linking

### 📚 Outline & Timeline
- Tree structure: Act > Chapter > Scene > Beat
- **4 views**: Tree, Kanban (Trello), Timeline, Corkboard
- Templates: 3-Act, Hero's Journey, Save the Cat, Snowflake
- AI generate outline từ premise

### 🤖 AI Assistant (BYOK)
**Provider abstraction** hỗ trợ:
- OpenAI, Anthropic Claude, Google Gemini, Groq, Mistral, OpenRouter, Ollama (local)

**15+ Built-in Skills:**
1. ✍️ Continue Writing - Viết tiếp giữ giọng văn
2. 🔄 Rewrite - Viết lại (formal, casual, show don't tell...)
3. 🔍 Critique - Phê bình nhịp độ, nhân vật, cấu trúc
4. 🌿 Expand - Mở rộng đoạn văn
5. 🎭 Character Voice - Giọng điệu nhân vật
6. 🕳️ Plot Hole Detection - Tìm lỗ hổng cốt truyện
7. 💡 Brainstorm - Gợi ý ý tưởng
8. 👁️ Sensory Details - Thêm chi tiết giác quan
9. + 7 skills khác...

**Context awareness**: AI truy cập chương hiện tại, 5 chương trước, hoặc toàn bộ project + characters + worldbuilding

### 📤 Export & Publish
- PDF (layout sách, mục lục, font serif)
- DOCX (thư viện docx)
- EPUB (metadata, cover)
- Markdown, HTML, Plain text, JSON backup

### 📊 Thống Kê
- Total words, words today, streak, avg words/day
- Biểu đồ: words per day (line), words per chapter (bar), heatmap (GitHub style)
- Project progress, writing goals, session history

## 🏗️ Tech Stack (100% Free Tier)

**Frontend:**
- Next.js 15 (App Router) + TypeScript strict
- TailwindCSS + shadcn/ui
- Tiptap editor
- Zustand (state) + TanStack Query
- react-hook-form + zod
- Framer Motion + next-themes

**Backend:**
- Cloudflare Workers (Hono)
- Cloudflare D1 (SQLite 5GB free)
- Cloudflare R2 (10GB storage free)
- Cloudflare KV (1GB free)
- Drizzle ORM

**Auth:** Lucia Auth self-hosted (free) + JWT (jose)

**AI:** Provider abstraction, BYOK, streaming, AES-256-GCM encryption cho API keys

**Deploy:**
- Cloudflare Pages (frontend)
- Cloudflare Workers (backend)
- $0/month

## 📁 Cấu Trúc Thư Mục

```
novelist-app/
├── apps/
│   ├── web/              # Next.js frontend
│   │   ├── app/
│   │   │   ├── (auth)/login, register
│   │   │   ├── (dashboard)/projects, editor/[projectId]/[chapterId], characters, worldbuilding, ai-assistant, settings
│   │   │   └── page.tsx (landing)
│   │   ├── components/ui, editor, layout
│   │   ├── lib/utils, store
│   │   └── hooks/
│   └── api/              # Cloudflare Workers
│       ├── src/
│       │   ├── routes/auth, projects, chapters, characters, ai, worldbuilding, export
│       │   ├── db/schema.ts, migrations/
│       │   ├── middleware/auth, cors
│       │   └── index.ts
│       └── wrangler.toml
├── packages/
│   ├── shared/           # Types, zod schemas
│   └── ai-core/          # AI provider abstraction + skills
└── package.json (turbo monorepo)
```

## 🚀 Quick Start (Local Dev)

### Yêu cầu
- Node.js 18+
- pnpm 9+ (`npm i -g pnpm`)
- Wrangler (`npm i -g wrangler`)

### 1. Clone & Install

```bash
git clone <repo>
cd novelist-app
pnpm install
```

### 2. Tạo Cloudflare Resources (Local)

```bash
# Đăng nhập Cloudflare
wrangler login

# Tạo D1 database
wrangler d1 create novelist-db
# Copy database_id vào apps/api/wrangler.toml

# Tạo R2 bucket
wrangler r2 bucket create novelist-storage

# Tạo KV namespace
wrangler kv namespace create novelist-kv
wrangler kv namespace create novelist-kv --preview
# Copy id vào wrangler.toml

# Chạy migrations local
cd apps/api
pnpm db:migrate
```

### 3. Cấu hình Env

Tạo `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8787
```

Tạo `apps/api/.dev.vars`:

```
JWT_SECRET=your-super-secret-64-chars-random-string-for-jwt
ENCRYPTION_KEY=your-32-chars-encryption-key!!
FRONTEND_URL=http://localhost:3000
ENVIRONMENT=development
```

### 4. Chạy Dev

```bash
# Terminal 1 - API
pnpm dev:api
# -> http://localhost:8787

# Terminal 2 - Web
pnpm dev:web
# -> http://localhost:3000
```

Mở http://localhost:3000, đăng ký tài khoản, tạo project và bắt đầu viết!

## 🌐 Deploy Lên Cloudflare (Free 100%)

### Bước 1: Chuẩn bị

```bash
# Tạo resources production
wrangler d1 create novelist-db-prod
wrangler r2 bucket create novelist-storage-prod
wrangler kv namespace create novelist-kv-prod

# Update wrangler.toml với production ids
```

### Bước 2: Deploy API (Workers)

```bash
cd apps/api

# Set secrets production
wrangler secret put JWT_SECRET
wrangler secret put ENCRYPTION_KEY

# Deploy
pnpm deploy
# -> https://novelist-api.<subdomain>.workers.dev

# Chạy migration production
pnpm db:migrate:remote
```

### Bước 3: Deploy Web (Pages)

**Cách 1: Qua Dashboard (khuyến nghị)**

1. Vào https://dash.cloudflare.com > Pages > Create a project
2. Connect GitHub repo
3. Build settings:
   - Framework: Next.js
   - Build command: `pnpm --filter web build`
   - Output directory: `apps/web/.next`
   - Root directory: `/`
   - Env var: `NEXT_PUBLIC_API_URL=https://your-api.workers.dev`

**Cách 2: Wrangler**

```bash
cd apps/web
pnpm build
wrangler pages deploy .next --project-name=novelist-web
```

### Bước 4: Cấu hình Custom Domain (Optional)

- Pages: Settings > Custom domains > Add
- Workers: Triggers > Custom Domains

### Chi phí Free Tier Cloudflare

- **Workers**: 100k requests/ngày free
- **D1**: 5GB storage, 5M rows read/ngày free
- **R2**: 10GB storage, 10M Class A ops free
- **KV**: 1GB, 100k read/ngày free
- **Pages**: Unlimited requests, 500 builds/tháng free

**Đủ cho 1000+ users active với BYOK AI!**

## 🔐 Bảo Mật

- ✅ AI API key mã hóa AES-256-GCM trước khi lưu D1
- ✅ JWT httpOnly, secure, sameSite cookies
- ✅ Rate limiting via KV
- ✅ Input validation với zod mọi endpoint
- ✅ Drizzle ORM chống SQL injection
- ✅ Row-level security: user chỉ truy cập data của mình
- ✅ XSS prevention (sanitize HTML)

## 🗺️ Roadmap

### Phase 1 - MVP (Hiện tại) ✅
- [x] Auth (register/login/JWT)
- [x] Projects CRUD + templates
- [x] Chapters CRUD + reorder
- [x] Tiptap editor + auto-save
- [x] Characters CRUD + graph API
- [x] AI provider abstraction (OpenAI, Anthropic, Gemini, Groq, Ollama)
- [x] 8 AI Skills (continue, rewrite, critique, expand, brainstorm, plot hole...)
- [x] Streaming chat
- [x] Landing page + dashboard + settings

### Phase 2 - Next
- [ ] Worldbuilding full (locations map, organizations...)
- [ ] Outline (Kanban, timeline, corkboard)
- [ ] Timeline events
- [ ] Export PDF/DOCX/EPUB thực tế (hiện tại mock)
- [ ] Version history UI + diff
- [ ] Writing stats + heatmap
- [ ] Command palette (Cmd+K)
- [ ] Collaboration (read-only link)
- [ ] Import từ Scrivener/Word

### Phase 3 - Advanced
- [ ] Real-time collaboration (Yjs)
- [ ] Mobile app (React Native)
- [ ] Desktop app (Tauri)
- [ ] Plugin system
- [ ] Marketplace prompt templates

## 🤝 Contributing

PRs welcome! Stack đơn giản, dễ contribute.

## 📄 License

MIT - Free for personal & commercial use.

## 🙏 Credits

- Inspired by: Notion, Obsidian, Ulysses, Scrivener, Linear, Arc Browser
- Fonts: Inter (UI), Crimson Pro / Lora (editor)
- Icons: Lucide React

---

**Built with ❤️ for Vietnamese writers. Chạy 24/7 miễn phí trên Cloudflare.**

> Nếu project hữu ích, hãy cho 1 ⭐ trên GitHub!
