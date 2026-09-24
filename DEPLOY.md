# Hướng Dẫn Deploy Chi Tiết - Novelist Studio

## Tổng Quan Kiến Trúc Deploy

```
User Browser
    |
    ├──> Cloudflare Pages (Next.js 15 frontend) - novelist.pages.dev
    |
    └──> Cloudflare Workers (Hono API) - novelist-api.workers.dev
              |
              ├──> D1 Database (SQLite) - 5GB free
              ├──> R2 Bucket (File storage) - 10GB free
              └──> KV Namespace (Cache/session) - 1GB free
```

Tất cả đều trong **Free Tier**, $0/tháng.

---

## Bước 1: Chuẩn Bị Tài Khoản Cloudflare

1. Đăng ký https://dash.cloudflare.com (miễn phí)
2. Cài Wrangler CLI:

```bash
npm i -g wrangler
wrangler login
```

Wrangler sẽ mở browser để bạn đăng nhập.

---

## Bước 2: Tạo Cloudflare Resources

### 2.1 Tạo D1 Database

```bash
wrangler d1 create novelist-db-prod
```

Output sẽ như:

```
✅ Successfully created DB 'novelist-db-prod' in region APAC
Created your new D1 database.

[[d1_databases]]
binding = "DB"
database_name = "novelist-db-prod"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy `database_id`** và dán vào `apps/api/wrangler.toml` phần production:

```toml
[[d1_databases]]
binding = "DB"
database_name = "novelist-db-prod"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2.2 Tạo R2 Bucket

```bash
wrangler r2 bucket create novelist-storage-prod
```

Update `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "R2"
bucket_name = "novelist-storage-prod"
```

### 2.3 Tạo KV Namespace

```bash
wrangler kv namespace create novelist-kv-prod
wrangler kv namespace create novelist-kv-prod --preview
```

Output:

```
{ binding: "KV", id: "abc123..." }
```

Update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "KV"
id = "abc123..."
preview_id = "xyz789..."
```

---

## Bước 3: Deploy API (Cloudflare Workers)

### 3.1 Cấu hình Secrets

**BẮT BUỘC** - Không commit secret vào git!

```bash
cd apps/api

# JWT secret - random 64 chars
wrangler secret put JWT_SECRET
# Khi hỏi, nhập: ví dụ: kX9mPqW3vT8rY2nZ5bJ6hL0cF4dG7jK1aB8eC2fD5gH9iJ3kL6mN0pQ2rS4tU7

# Encryption key - đúng 32 chars cho AES-256
wrangler secret put ENCRYPTION_KEY
# Ví dụ: MySuperSecret32CharsKey12345678

# Frontend URL (sẽ có sau khi deploy Pages, tạm để placeholder)
wrangler secret put FRONTEND_URL
# Nhập: https://novelist.pages.dev
```

Kiểm tra secrets:

```bash
wrangler secret list
```

### 3.2 Deploy Workers

```bash
pnpm deploy
# hoặc
wrangler deploy
```

Nếu thành công:

```
✨ Uploaded novelist-api (2.34 sec)
✨ Deployed to https://novelist-api.your-subdomain.workers.dev
```

**Copy URL này** - sẽ dùng cho frontend env.

### 3.3 Chạy Migration Production

```bash
pnpm db:migrate:remote
# hoặc
wrangler d1 migrations apply novelist-db-prod --remote
```

Kiểm tra D1:

```bash
wrangler d1 execute novelist-db-prod --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

Bạn sẽ thấy list tables: users, projects, chapters, characters...

---

## Bước 4: Deploy Frontend (Cloudflare Pages)

### Cách A: Qua Cloudflare Dashboard (Khuyến nghị)

1. Vào https://dash.cloudflare.com > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**

2. Chọn GitHub repo của bạn (novelist-app)

3. Cấu hình Build:

```
Framework preset: Next.js
Build command: pnpm install && pnpm --filter web build
Build output directory: apps/web/.next
Root directory: /
Node version: 20
```

4. Environment variables:

```
NEXT_PUBLIC_API_URL = https://novelist-api.your-subdomain.workers.dev
```

5. Click **Save and Deploy**

Chờ 2-3 phút build. Nếu thành công, bạn có URL: `https://novelist-xyz.pages.dev`

### Cách B: Qua Wrangler CLI

```bash
cd apps/web

# Build
pnpm build

# Deploy
wrangler pages deploy .next --project-name=novelist-web
```

### Cách C: Direct Upload (không cần Git)

```bash
# Build local
pnpm --filter web build

# Deploy folder .next
npx wrangler pages deploy apps/web/.next --project-name=novelist-web
```

---

## Bước 5: Cấu Hình CORS & Custom Domain

### 5.1 Update FRONTEND_URL trong Workers

Sau khi có Pages URL, update secret:

```bash
cd apps/api
wrangler secret put FRONTEND_URL
# Nhập: https://novelist-xyz.pages.dev (URL thực tế của bạn)
```

Deploy lại:

```bash
wrangler deploy
```

### 5.2 Custom Domain (Optional)

**Cho Pages:**

- Dashboard > Pages > your project > Custom domains > Set up a custom domain
- Nhập domain: `novelist.yourdomain.com`
- Cloudflare sẽ tự tạo DNS record

**Cho Workers (API):**

- Dashboard > Workers > novelist-api > Settings > Triggers > Add Custom Domain
- Nhập: `api.novelist.yourdomain.com`

Update `NEXT_PUBLIC_API_URL` trong Pages env vars thành custom domain API.

---

## Bước 6: Kiểm Tra Deploy

### 6.1 Test API

```bash
curl https://novelist-api.your-subdomain.workers.dev/health
# Expected: {"status":"ok"}

curl https://novelist-api.your-subdomain.workers.dev/
# Expected: {"name":"Novelist API","status":"ok",...}
```

### 6.2 Test Frontend

Mở `https://novelist-xyz.pages.dev`

- Landing page phải load
- Click "Bắt đầu viết miễn phí" > Register
- Tạo tài khoản
- Tạo project
- Viết chương

### 6.3 Test AI (BYOK)

1. Vào Settings
2. Chọn provider (ví dụ Groq - miễn phí)
3. Lấy API key tại https://console.groq.com/keys
4. Nhập key, chọn model `llama-3.3-70b-versatile`
5. Lưu
6. Vào một chương, click "AI Assistant" > "Viết tiếp"
7. Nếu streaming trả về text => thành công!

---

## Bước 7: Monitoring & Logs

### Xem Logs Workers

```bash
wrangler tail novelist-api
```

### Xem D1 Data

```bash
wrangler d1 execute novelist-db-prod --remote --command "SELECT COUNT(*) as user_count FROM users;"
wrangler d1 execute novelist-db-prod --remote --command "SELECT COUNT(*) as project_count FROM projects;"
```

### Xem R2 Files

Dashboard > R2 > novelist-storage-prod > Objects

### Analytics

Dashboard > Workers > novelist-api > Metrics

---

## Troubleshooting

### Lỗi CORS

- Kiểm tra `FRONTEND_URL` secret trong Workers có khớp Pages URL không
- Kiểm tra `NEXT_PUBLIC_API_URL` trong Pages env vars

### Lỗi D1 "no such table"

- Chưa chạy migration production: `wrangler d1 migrations apply novelist-db-prod --remote`

### Lỗi R2 "bucket not found"

- Kiểm tra `bucket_name` trong wrangler.toml khớp với bucket đã tạo

### Lỗi "Invalid token" sau deploy

- JWT_SECRET khác nhau giữa local và production? Phải set secret production bằng `wrangler secret put JWT_SECRET`

### Build Pages fail

- Kiểm tra Node version 20
- Kiểm tra pnpm version: thêm env var `NPM_VERSION=9` hoặc dùng `pnpm install` trong build command
- Xem build logs trong Dashboard

### AI không hoạt động

- Kiểm tra API key đã lưu chưa (Settings)
- Kiểm tra provider có đúng không
- Xem logs Workers: `wrangler tail`
- Thử với Groq (free, nhanh, ít lỗi nhất)

---

## Chi Phí Thực Tế

### Free Tier Limits (Đủ cho 1000+ users)

| Service | Free Limit | Novelist Usage |
|---------|------------|----------------|
| Workers | 100k req/ngày | ~10 req / user / ngày => 10k users |
| D1 | 5GB, 5M read/ngày | Mỗi project ~1MB, mỗi user ~10 projects => 500 users |
| R2 | 10GB, 10M ops | Mỗi cover ~500KB, export ~2MB => 1000+ users |
| KV | 1GB, 100k read | Session + cache => 1000+ users |
| Pages | Unlimited req | Frontend static |

**Kết luận: Free tier đủ cho 500-1000 users active. Nếu vượt, Cloudflare giá rất rẻ ($5/tháng cho Workers Paid).**

### AI Cost (BYOK - User tự trả)

- **Groq**: Free tier 14k req/ngày, cực nhanh (miễn phí tốt nhất)
- **Gemini**: Free tier 60 req/phút (miễn phí tốt thứ 2)
- **OpenAI**: $0.15/1M input tokens (gpt-4o-mini) => ~$0.01 cho 1 chương
- **Anthropic**: $3/1M input (Sonnet) => đắt hơn nhưng chất lượng cao
- **Ollama**: $0, chạy local

**App không thu phí AI, user tự quản lý cost.**

---

## Update Sau Này

### Update API

```bash
cd apps/api
# Code changes...
wrangler deploy
```

### Update Frontend

Nếu dùng Git connected Pages: chỉ cần `git push`, Pages tự build & deploy.

Nếu dùng Wrangler:

```bash
cd apps/web
pnpm build
wrangler pages deploy .next --project-name=novelist-web
```

### Migration Mới

```bash
# Tạo migration mới (ví dụ thêm bảng mới)
# Edit src/db/schema.ts, rồi:
pnpm db:generate

# Apply local
pnpm db:migrate

# Apply production
pnpm db:migrate:remote
```

---

## Bảo Mật Production Checklist

- [x] JWT_SECRET random 64+ chars, không dùng default
- [x] ENCRYPTION_KEY đúng 32 chars random
- [x] FRONTEND_URL đúng domain production
- [x] CORS chỉ allow frontend domain (không để `*` trong production)
- [x] R2 bucket private (không public)
- [x] D1 không expose trực tiếp
- [x] Rate limiting enabled (via KV)
- [x] HTTPS only (Cloudflare tự lo)

---

## Liên Hệ & Support

- GitHub Issues: <repo>/issues
- Discord: (tạo server cho community)
- Email: support@novelist.studio

Chúc bạn deploy thành công và viết được tiểu thuyết bestseller! 📚✨
