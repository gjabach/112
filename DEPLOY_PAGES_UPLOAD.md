# Fix Lỗi Deploy Cloudflare Pages - Upload and Deploy

## ❌ Lỗi bạn gặp

```
1/86 files could not be uploaded:
- 1 are unknown
  wrangler.toml
```

## 🔍 Nguyên nhân

Bạn đã upload **cả monorepo** (gồm `apps/api/wrangler.toml`) lên Cloudflare Pages.

- **Cloudflare Pages** = chỉ cho **frontend tĩnh** (HTML/CSS/JS)
- **Cloudflare Workers** = cho **backend API** (Hono + D1/R2/KV)
- `wrangler.toml` là config của **Workers**, không phải Pages → Pages không hiểu file này → báo "unknown"

Bạn đang trộn 2 thứ khác nhau vào 1 chỗ.

---

## ✅ Cách fix - Deploy đúng cách

### Kiến trúc đúng

```
Frontend (Next.js) → Cloudflare Pages (pages.dev)
Backend (Hono API) → Cloudflare Workers (workers.dev)
         ↓                    ↓
    out/ folder          wrangler deploy
    (static files)       (với wrangler.toml)
```

**2 deploy riêng biệt!**

---

## Bước 1: Deploy Backend API lên Workers (trước)

Backend phải chạy trước để frontend có `NEXT_PUBLIC_API_URL`.

```bash
cd apps/api

# 1. Đăng nhập
wrangler login

# 2. Tạo resources production (nếu chưa)
wrangler d1 create novelist-db-prod
wrangler r2 bucket create novelist-storage-prod
wrangler kv namespace create novelist-kv-prod

# 3. Copy IDs vào wrangler.toml (phần production)
# Edit apps/api/wrangler.toml - thay database_id, bucket_name, kv id

# 4. Set secrets (BẮT BUỘC, không commit)
wrangler secret put JWT_SECRET
# Nhập random 64 chars: ví dụ kX9mPqW3vT8rY2nZ5bJ6hL0cF4dG7jK1aB8eC2fD5gH9iJ3kL6mN0pQ2rS4tU7

wrangler secret put ENCRYPTION_KEY
# Nhập đúng 32 chars: MySuperSecret32CharsKey12345678

wrangler secret put FRONTEND_URL
# Tạm nhập: https://novelist.pages.dev (sẽ update sau khi có Pages URL)

# 5. Deploy Workers
pnpm deploy
# hoặc wrangler deploy
# Output: https://novelist-api.your-subdomain.workers.dev

# 6. Chạy migration production
wrangler d1 migrations apply novelist-db-prod --remote

# 7. Lưu lại API URL
# Ví dụ: https://novelist-api.yourname.workers.dev
```

---

## Bước 2: Build Frontend cho Pages Upload

**Quan trọng:** Pages Upload chỉ cần **file tĩnh**, không cần source code.

Tôi đã fix `apps/web/next.config.js` để build ra static export:

```js
output: 'export',
distDir: 'out',
images: { unoptimized: true },
trailingSlash: true
```

### Build:

```bash
# Từ root novelist-app
cd apps/web

# Tạo .env.local với API URL production
echo "NEXT_PUBLIC_API_URL=https://novelist-api.your-subdomain.workers.dev" > .env.local

# Install deps (nếu chưa)
pnpm install

# Build static export
pnpm build
# Output: apps/web/out/ folder - chứa index.html, _next/, v.v.

# Kiểm tra
ls -lh out/
# Phải thấy: index.html, 404.html, _next/, projects/, editor/, v.v.
# KHÔNG có wrangler.toml, KHÔNG có src/, KHÔNG có node_modules
```

### Chuẩn bị file upload:

**Cách A: Zip out/ folder (khuyến nghị)**

```bash
cd out
zip -r ../novelist-frontend.zip . -x "*.map"
cd ..
# File novelist-frontend.zip chứa toàn bộ static files
```

**Cách B: Upload trực tiếp folder out/**

Không zip, chỉ upload nội dung bên trong `out/` (không phải bản thân folder out, mà là files bên trong).

---

## Bước 3: Upload lên Cloudflare Pages

### Via Dashboard (Upload and deploy method)

1. Vào https://dash.cloudflare.com > **Workers & Pages** > **Create application** > **Pages** > **Upload assets**

2. **Project name:** `novelist-web` (hoặc tên bạn muốn)

3. **Upload:**
   - Kéo thả **file zip** `novelist-frontend.zip` HOẶC
   - Kéo thả **toàn bộ files bên trong** `apps/web/out/` (chọn tất cả files trong out/, không chọn folder out)
   - **Đảm bảo KHÔNG có wrangler.toml, package.json, src/, node_modules**

4. Click **Deploy site**

5. Chờ 30s-1 phút → có URL: `https://novelist-web-xyz.pages.dev`

### Kiểm tra file được upload:

Đúng:
```
out/
├── index.html
├── 404.html
├── _next/
│   ├── static/
│   └── ...
├── projects/
│   └── index.html
├── login/
│   └── index.html
└── ...
```

Sai (sẽ lỗi):
```
novelist-app/
├── wrangler.toml  ← LỖI, không được upload
├── package.json   ← LỖI
├── apps/
│   ├── api/
│   └── web/
└── ...
```

---

## Bước 4: Update CORS & Frontend URL

Sau khi có Pages URL, update lại Workers:

```bash
cd apps/api

# Update FRONTEND_URL secret thành Pages URL thực tế
wrangler secret put FRONTEND_URL
# Nhập: https://novelist-web-xyz.pages.dev

# Deploy lại để CORS cho phép
wrangler deploy
```

---

## Bước 5: Test

1. Mở `https://novelist-web-xyz.pages.dev`
2. Landing page phải load (không lỗi 404)
3. Click Register → tạo tài khoản (gọi API Workers)
4. Nếu lỗi CORS: kiểm tra FRONTEND_URL secret và `apiFetch` URL
5. Nếu lỗi API 404: kiểm tra NEXT_PUBLIC_API_URL trong .env.local khi build

---

## 🆚 So sánh 2 cách deploy Pages

| Cách | Ưu điểm | Nhược điểm |
|------|---------|------------|
| **Upload and deploy** (bạn đang dùng) | Nhanh, không cần Git | Manual mỗi lần update, phải build local, dễ upload nhầm file như wrangler.toml |
| **Connect to Git** (khuyến nghị) | Auto build khi git push, không lo nhầm file, build trên Cloudflare | Cần GitHub repo |

**Khuyến nghị:** Sau khi fix Upload, nên chuyển sang **Connect to Git** cho lâu dài.

**Cách Connect to Git:**
1. Push code lên GitHub
2. Pages > Create > Connect to Git > Chọn repo
3. Build settings:
   - Framework: Next.js
   - Build command: `pnpm install && pnpm --filter web build`
   - Output: `apps/web/out`
   - Env var: `NEXT_PUBLIC_API_URL=https://your-api.workers.dev`
4. Save and Deploy → auto deploy mỗi git push

---

## 🔧 Script tự động build cho Upload

Tạo file `build-for-pages.sh` ở root:

```bash
#!/bin/bash
set -e

echo "Building frontend for Cloudflare Pages Upload..."

cd apps/web

# Check env
if [ ! -f .env.local ]; then
  echo "NEXT_PUBLIC_API_URL=https://novelist-api.your-subdomain.workers.dev" > .env.local
  echo "Created .env.local - PLEASE EDIT with your real API URL!"
fi

echo "API URL: $(cat .env.local)"

# Build
pnpm build

echo ""
echo "✅ Build done! Output in apps/web/out/"
echo "📦 Files to upload (DO NOT include wrangler.toml):"
ls -lh out/ | head -20
echo ""
echo "Next steps:"
echo "1. Zip: cd apps/web/out && zip -r ../../novelist-frontend.zip ."
echo "2. Upload novelist-frontend.zip to Cloudflare Pages > Upload assets"
echo "3. Or drag & drop all files INSIDE out/ folder"
```

Chạy: `chmod +x build-for-pages.sh && ./build-for-pages.sh`

---

## ❓ FAQ

**Q: Tại sao wrangler.toml bị báo unknown?**
A: Vì Pages chỉ cho phép HTML/CSS/JS/static assets. wrangler.toml là config của Workers, không phải file web. Bạn đã upload nhầm cả backend.

**Q: Tôi có cần upload cả apps/api không?**
A: Không! Pages chỉ cần frontend. Backend deploy riêng bằng `wrangler deploy` trong apps/api.

**Q: Build ra out/ nhưng vẫn lỗi 404 khi vào /projects?**
A: Vì `trailingSlash: true` trong next.config.js sẽ tạo `projects/index.html`. Cloudflare Pages cần file này. Nếu vẫn 404, thêm `_redirects` file trong out/:
```
/* /index.html 200
```
Hoặc dùng `trailingSlash: false` và test.

**Q: API gọi bị CORS?**
A: Kiểm tra `FRONTEND_URL` secret trong Workers có khớp Pages URL không. Và `NEXT_PUBLIC_API_URL` khi build frontend có đúng Workers URL không.

**Q: Tôi muốn deploy cả frontend + backend cùng 1 lúc bằng wrangler.toml?**
A: Không thể. Pages và Workers là 2 sản phẩm khác nhau. Phải deploy riêng. Tuy nhiên bạn có thể dùng **Cloudflare Workers với Assets** (mới) để serve cả frontend + API từ 1 Worker, nhưng phức tạp hơn. Với Novelist, giữ 2 deploy riêng là đơn giản nhất và vẫn $0.

---

## ✅ Checklist Deploy Thành Công

- [ ] Backend Workers đã deploy và có URL (https://...workers.dev)
- [ ] D1 migration đã chạy production
- [ ] Frontend build ra `out/` folder, không có wrangler.toml bên trong
- [ ] Upload chỉ files trong `out/`, không upload cả monorepo
- [ ] Pages deploy thành công, có URL pages.dev
- [ ] Update FRONTEND_URL secret và deploy lại Workers
- [ ] Test register/login hoạt động (không CORS)
- [ ] Test tạo project, viết chapter, export PDF

---

## 🆘 Vẫn lỗi?

Gửi cho tôi:
1. Ảnh chụp file bạn đang upload (list files)
2. Build log của `pnpm build`
3. URL của Pages và Workers

Tôi sẽ debug tiếp!
