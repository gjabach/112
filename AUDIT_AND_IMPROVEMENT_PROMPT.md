# BÁO CÁO ĐÁNH GIÁ CHẤT LƯỢNG MÃ NGUỒN & MASTER PROMPT CẢI THIỆN DỰ ÁN NOVELIST
> **Dự án**: Novelist - Ứng dụng Quản lý & Viết Tiểu Thuyết Đa Nền Tảng (Next.js + Cloudflare Workers + D1 + AI Core)  
> **Kho lưu trữ GitHub**: `gjabach/112` (Branch `main`)  
> **Tiêu chí đánh giá**: Khắt khe nhất theo tiêu chuẩn Production (Bảo mật, Tính toàn vẹn dữ liệu, Độ ổn định Runtime, Tối ưu Cloudflare Workers Free Tier, Hỗ trợ Unicode Tiếng Việt, Chuẩn hóa Monorepo).

---

## MỤC LỤC
1. [TỔNG QUAN ĐÁNH GIÁ & ĐIỂM SỐ CHẤT LƯỢNG](#1-tổng-quan-đánh-giá--điểm-số-chất-lượng)
2. [BÁO CÁO CHI TIẾT CÁC LỖI & ĐIỂM CHƯA HÀI LÒNG](#2-báo-cáo-chi-tiết-các-lỗi--điểm-chưa-hài-lòng)
   - [2.1. Lỗ hổng Bảo mật & Rò rỉ Dữ liệu Người dùng (Critical Security)](#21-lỗ-hổng-bảo-mật--rò-rỉ-dữ-liệu-người-dùng-critical-security)
   - [2.2. Lỗi Gây Sập Ứng dụng Khi Chạy (Critical Runtime Crashes)](#22-lỗi-gây-sập-ứng-dụng-khi-chạy-critical-runtime-crashes)
   - [2.3. Lỗi Truy vấn Dữ liệu & Tính toàn vẹn Cơ sở Dữ liệu (Database & Drizzle SQL)](#23-lỗi-truy-vấn-dữ-liệu--tính-toàn-vẹn-cơ-sở-dữ-liệu-database--drizzle-sql)
   - [2.4. Kiến trúc Monorepo & Công cụ TypeScript (Architecture & Tooling)](#24-kiến-trúc-monorepo--công-cụ-typescript-architecture--tooling)
   - [2.5. Hiệu năng & Giới hạn Tài nguyên Cloudflare Free Tier](#25-hiệu-năng--giới-hạn-tài-nguyên-cloudflare-free-tier)
   - [2.6. Khả năng Quốc tế hóa & Tương thích Tiếng Việt](#26-khả-năng-quốc-tế-hóa--tương-thích-tiếng-việt)
3. [MASTER PROMPT CẢI THIỆN TOÀN DIỆN DỰ ÁN](#3-master-prompt-cải-thiện-toàn-diện-dự-án)
   - [Nhiệm vụ 1: Khắc phục Triệt để Lỗ hổng Bảo mật Dữ liệu & Xác thực](#nhiệm-vụ-1-khắc-phục-triệt-để-lỗ-hổng-bảo-mật-dữ-liệu--xác-thực)
   - [Nhiệm vụ 2: Vá Lỗi Runtime PDF Tiếng Việt & ESM Workers](#nhiệm-vụ-2-vá-lỗi-runtime-pdf-tiếng-việt--esm-workers)
   - [Nhiệm vụ 3: Sửa Toàn bộ Logic SQL & D1 Data Integrity](#nhiệm-vụ-3-sửa-toàn-bộ-logic-sql--d1-data-integrity)
   - [Nhiệm vụ 4: Đồng bộ Kiến trúc Frontend - Backend & Chuẩn hóa Monorepo](#nhiệm-vụ-4-đồng-bộ-kiến-trúc-frontend---backend--chuẩn-hóa-monorepo)
   - [Nhiệm vụ 5: Tối ưu Bộ nhớ & CPU Worker cho Xuất Bản Sách Lớn](#nhiệm-vụ-5-tối-ưu-bộ-nhớ--cpu-worker-cho-xuất-bản-sách-lớn)
4. [TIÊU CHUẨN NGHIỆM THU (ACCEPTANCE CRITERIA)](#4-tiêu-chuẩn-nghiệm-thu-acceptance-criteria)

---

## 1. TỔNG QUAN ĐÁNH GIÁ & ĐIỂM SỐ CHẤT LƯỢNG

| Tiêu chí | Điểm (Thang 10) | Mức độ cảnh báo | Nhận định tóm tắt |
| :--- | :---: | :---: | :--- |
| **Bảo mật (Security)** | **2.0 / 10** | 🚨 **BÁO ĐỘNG ĐỎ** | Mật khẩu tài khoản và nội dung truyện gửi lên public KVDB không mã hóa. API key gửi qua URL query string. |
| **Độ ổn định (Runtime Stability)** | **4.0 / 10** | ⚠️ **NGHIÊM TRỌNG** | 100% tài liệu tiếng Việt xuất PDF trên backend Worker sẽ crash; HTML export gọi `require()` gây crash ESM. |
| **Tính toàn vẹn Dữ liệu (Database)** | **5.0 / 10** | ⚠️ **CẢNH BÁO CAO** | Outline hierarchy hỏng orderIndex do so sánh `parentId = ''` thay vì `NULL`; Chapter reorder trùng lặp index. |
| **Kiến trúc & Monorepo (Architecture)** | **5.5 / 10** | ⚠️ **CẦN TÁI CẤU TRÚC** | Chia đôi logic: Frontend có cả mock DB trong `utils.ts`, Backend có Worker D1 nhưng kết nối lỏng lẻo; thiếu `tsconfig.json`. |
| **Hiệu năng & Tài nguyên Cloudflare** | **5.5 / 10** | ⚠️ **CẢNH BÁO** | Nối chuỗi base64 5MB trong vòng lặp Worker gây timeout CPU 50ms; N+1 queries ở API overview stats. |
| **Giao diện & Trải nghiệm (UI/UX)** | **8.0 / 10** | ✅ **TỐT** | Giao diện TipTap, Outline canvas, Timeline, thống kê trực quan, chế độ Focus mode tốt. |
| **TỔNG KẾT DỰ ÁN** | **5.0 / 10** | ❌ **CHƯA ĐẠT CHUẨN PRODUCTION** | Cần xử lý triệt để các lỗi bảo mật và runtime trước khi triển khai thực tế. |

---

## 2. BÁO CÁO CHI TIẾT CÁC LỖI & ĐIỂM CHƯA HÀI LÒNG

### 2.1. Lỗ hổng Bảo mật & Rò rỉ Dữ liệu Người dùng (Critical Security)
1. **Lộ toàn bộ thông tin tài khoản và Mật khẩu dạng Plaintext trên KVDB công cộng**:
   - **Vị trí**: `apps/web/lib/utils.ts` (dòng 263, dòng 293) và `apps/web/app/api/sync/route.ts` (dòng 7-8).
   - **Mô tả**: Khi người dùng đăng ký tài khoản, hệ thống gửi toàn bộ danh sách `users` chứa `email`, `name`, và `password` dạng **văn bản thuần (plaintext)** trực tiếp lên bucket công cộng `https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/global_users` mà không hề có bất kỳ lớp xác thực (Auth Token), mã hóa băm mật khẩu (Argon2 / Bcrypt / SHA-256), hay phân quyền truy cập nào.
   - **Hậu quả**: Bất kỳ ai trên Internet chỉ cần gửi một lệnh HTTP `GET https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/global_users` là có thể đọc toàn bộ danh bạ email và mật khẩu của người dùng, hoặc gửi HTTP `PUT` với dữ liệu rỗng để xóa sạch tài khoản của toàn bộ hệ thống.
2. **Kho lưu trữ đồng bộ tiểu thuyết không được phân quyền**:
   - **Vị trí**: `apps/web/app/api/sync/route.ts`.
   - **Mô tả**: Bất kỳ người nào đoán được hoặc quét mã `syncKey` đều có thể đọc trộm toàn bộ tác phẩm văn học, ý tưởng cốt truyện hoặc ghi đè (overwrite) phá hủy bản thảo của tác giả.
3. **Lộ Gemini API Key trong URL Query Parameter**:
   - **Vị trí**: `packages/ai-core/src/providers.ts` (dòng 240).
   - **Mô tả**: `url = https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`.
   - **Hậu quả**: Việc truyền API key qua URL query string khiến API key bị lưu trữ vĩnh viễn trong nhật ký máy chủ web (access logs), proxy logs, CDN traces, và lịch sử trình duyệt. Google AI Studio hỗ trợ truyền qua HTTP Header `x-goog-api-key: <KEY>`, an toàn hơn rất nhiều.
4. **Cloudflare D1 SQLite không tự bật `PRAGMA foreign_keys = ON`**:
   - **Vị trí**: `apps/api/src/routes/projects.ts` và `apps/api/src/db/schema.ts`.
   - **Mô tả**: SQLite trong môi trường nhúng mặc định tắt Foreign Key constraints. Khi xóa một `project`, các bảng liên quan (`chapters`, `characters`, `outline_nodes`, `timelines`) không tự động xóa theo (Cascade Delete), gây rác dữ liệu mồ côi (orphaned data) trong D1.

---

### 2.2. Lỗi Gây Sập Ứng dụng Khi Chạy (Critical Runtime Crashes)
1. **Lỗi Crash 100% khi Xuất PDF Tiếng Việt trên Backend Worker**:
   - **Vị trí**: `apps/api/src/lib/export/pdf.ts` (dòng 29-31, dòng 78-84).
   - **Mô tả**: Sử dụng font mặc định `StandardFonts.TimesRoman`, `StandardFonts.TimesRomanBold`. Các font chuẩn của PDF chỉ hỗ trợ bảng mã Windows-1252 (WinAnsi). Khi gặp bất kỳ ký tự tiếng Việt có dấu nào (`ế`, `ạ`, `ơ`, `ư`, `đ`...), `pdf-lib` sẽ ném ngoại lệ:
     ```
     Error: WinAnsi cannot encode "ế" (0x01eb, 491)
     ```
     Lỗi này làm Worker crash ngay lập tức và trả về mã lỗi HTTP 500 cho người dùng.
2. **Lỗi `ReferenceError: require is not defined` trong ESM Cloudflare Workers**:
   - **Vị trí**: `apps/api/src/lib/export/markdown.ts` (dòng 133, 138, 145):
     ```typescript
     const { generateFrontMatter: genFM } = require('./utils');
     const { generateToc: genToc } = require('./utils');
     const { tiptapToHtml } = require('./utils');
     ```
   - **Mô tả**: Cloudflare Workers chạy trên nền V8 isolates với chuẩn ECMAScript Modules (`export default`). Lệnh `require()` chuẩn CommonJS không tồn tại ở runtime, dẫn đến sập toàn bộ luồng xuất HTML khi gọi hàm `generateHtml()`.
3. **Frontend che giấu lỗi thật của hệ thống**:
   - **Vị trí**: `apps/web/next.config.js`:
     ```javascript
     typescript: { ignoreBuildErrors: true },
     eslint: { ignoreDuringBuilds: true },
     ```
   - **Mô tả**: Việc tắt kiểm tra kiểu tĩnh TypeScript và linter khi build khiến mã nguồn có nhiều lỗi tiềm ẩn lọt vào môi trường Production mà lập trình viên không hề hay biết.

---

### 2.3. Lỗi Truy vấn Dữ liệu & Tính toàn vẹn Cơ sở Dữ liệu (Database & Drizzle SQL)
1. **Lỗi logic Outline Node: Gán sai toàn bộ thứ tự orderIndex**:
   - **Vị trí**: `apps/api/src/routes/outline.ts` (dòng 163):
     ```typescript
     const siblings = await db.select().from(schema.outlineNodes).where(
       and(
         eq(schema.outlineNodes.projectId, projectId), 
         body.parentId ? eq(schema.outlineNodes.parentId, body.parentId) : eq(schema.outlineNodes.parentId, '' as any)
       )
     );
     ```
   - **Mô tả**: Các node gốc (root nodes) có `parentId` là `NULL`. Trong SQL chuẩn và SQLite, biểu thức so sánh `parentId = ''` không bao giờ khớp với các bản ghi có `parentId IS NULL` (vì `NULL = ''` trả về `UNKNOWN/FALSE`). Kết quả là `siblings` luôn luôn rỗng (`[]`), làm cho tất cả các node gốc khi tạo mới đều nhận `orderIndex = 0`, gây trùng lặp thứ tự hiển thị. Phải dùng `isNull(schema.outlineNodes.parentId)`.
2. **Lỗi sắp xếp lại thứ tự chương (Chapter Reordering)**:
   - **Vị trí**: `apps/api/src/routes/chapters.ts` (dòng 192):
     ```typescript
     await db.update(schema.chapters).set({ orderIndex: newIndex, updatedAt: nowTimestamp() }).where(eq(schema.chapters.id, id));
     ```
   - **Mô tả**: Khi người dùng di chuyển một chương (ví dụ từ vị trí 4 sang vị trí 1), API chỉ cập nhật duy nhất chương đó thành `orderIndex = 1`. Các chương còn lại không được tịnh tiến (shift), dẫn đến hai chương cùng có `orderIndex = 1` và danh sách hiển thị bị nhảy loạn xạ khi query `ORDER BY orderIndex ASC`.
3. **Lỗi đếm số lượng chương trong API thống kê tổng quan**:
   - **Vị trí**: `apps/api/src/index.ts` (dòng 118 & dòng 130):
     ```typescript
     const chapters = await db.select().from(schema.chapters).where(eq(schema.chapters.projectId, projects[0]?.id || 'none'));
     ...
     totalChapters: chapters.length
     ```
   - **Mô tả**: Nếu một tác giả có 10 tiểu thuyết, hệ thống chỉ đếm số chương của **tiểu thuyết đầu tiên (`projects[0]`)**, bỏ qua toàn bộ 9 cuốn còn lại! Đồng thời dòng 121-124 lặp qua từng project bằng truy vấn riêng lẻ gây lỗi **N+1 Query**.
4. **Xung đột kiểu dữ liệu ID giữa Zod Schema và Runtime Generator**:
   - **Vị trí**: `packages/shared/src/schemas.ts` (dòng 37):
     ```typescript
     parentId: z.string().uuid().optional().nullable(),
     ```
   - **Mô tả**: Trong khi hàm `generateId()` ở `utils.ts` và backend tạo ID có dạng prefix như `chap_abc123` hoặc nanoid, schema lại ép buộc phải là chuỗi UUID 36 ký tự có dấu gạch ngang, dẫn đến lỗi từ chối dữ liệu hợp lệ (Validation Failure).

---

### 2.4. Kiến trúc Monorepo & Công cụ TypeScript (Architecture & Tooling)
1. **Thiếu file `tsconfig.json` trong các package cốt lõi**:
   - `packages/shared`, `packages/ai-core` và `apps/api` không hề có file `tsconfig.json`. Khi chạy `pnpm run type-check` từ thư mục gốc, hệ thống báo lỗi không tìm thấy cấu hình TypeScript.
2. **Chia đôi kiến trúc Backend (Split Brain Architecture)**:
   - File `apps/web/lib/utils.ts` dài hơn 1300 dòng, chứa nguyên một hệ thống Mock API giả lập xử lý localStorage, KVDB, xác thực tự chế.
   - Trong khi đó `apps/api` lại là một backend thực thụ chạy Hono trên Cloudflare Workers kết nối D1.
   - Điều này dẫn đến sự mất đồng bộ: Các tính năng sửa ở Backend Worker không có tác dụng trên Web nếu Web vẫn đang gọi hàm mock trong `utils.ts`.

---

### 2.5. Hiệu năng & Giới hạn Tài nguyên Cloudflare Free Tier
1. **Nguy cơ sập Worker vì nối chuỗi Base64 5MB trong vòng lặp**:
   - **Vị trí**: `apps/api/src/routes/export.ts` (dòng 122-128):
     ```typescript
     const binary = result.data;
     let binaryStr = '';
     for (let i = 0; i < binary.length; i++) {
       binaryStr += String.fromCharCode(binary[i]);
     }
     downloadData = btoa(binaryStr);
     ```
   - **Mô tả**: Một cuốn tiểu thuyết dày hàng trăm trang có thể sinh ra file PDF hoặc EPUB nặng 3-5MB. Vòng lặp chạy 5 triệu lần nối chuỗi từng ký tự một tạo ra hàng triệu chuỗi tạm thời trong bộ nhớ heap của V8, chắc chắn vượt quá thời gian thực thi CPU 50ms của Cloudflare Workers gói Free, làm hệ thống bị ngắt ngang bởi Cloudflare. Phải xử lý bằng cách chia chunk hoặc dùng Buffer/TypedArray chuẩn.

---

### 2.6. Khả năng Quốc tế hóa & Tương thích Tiếng Việt
1. **Thiếu phông chữ Unicode nhúng cho việc biên tập và xuất bản**:
   - Để xuất file in ấn hoặc PDF xuất bản tại Việt Nam, bắt buộc phải nhúng font Unicode hỗ trợ đầy đủ bảng mã tiếng Việt (như Noto Serif, Be Vietnam Pro, Roboto, Times New Roman Unicode). Hiện tại hệ thống hoàn toàn dựa vào font tiêu chuẩn phương Tây (WinAnsi).

---

## 3. MASTER PROMPT CẢI THIỆN TOÀN DIỆN DỰ ÁN

*Dưới đây là bản Prompt hoàn chỉnh, có cấu trúc chỉ đạo chi tiết, sẵn sàng gửi cho Kỹ sư trưởng hoặc AI Coding Assistant để tiến hành refactor và nâng cấp toàn diện dự án Novelist.*

```markdown
# NOVELIST MASTER IMPROVEMENT DIRECTIVE: HARDENING, REFACTORING & PRODUCTION READINESS

## BỐI CẢNH & MỤC TIÊU DỰ ÁN
Dự án Novelist là hệ thống monorepo (Pnpm Workspace + Turborepo) gồm `apps/web` (Next.js 14 App Router), `apps/api` (Cloudflare Workers + Hono + D1 + Drizzle ORM), `packages/shared`, và `packages/ai-core`.
Nhiệm vụ của bạn là thực hiện tái cấu trúc triệt để, khắc phục toàn bộ các lỗ hổng bảo mật nghiêm trọng, vá các lỗi sập hệ thống (runtime crashes), chuẩn hóa kiến trúc cơ sở dữ liệu và nâng cao hiệu năng theo các yêu cầu chi tiết dưới đây.

---

### NHIỆM VỤ 1: KHẮC PHỤC TRIỆT ĐỂ LỖ HỔNG BẢO MẬT & XÁC THỰC
1. **Loại bỏ hoàn toàn Public KVDB Leak**:
   - Xóa bỏ triệt để việc đọc/ghi danh sách người dùng và mật khẩu plaintext vào `https://kvdb.io/GqLhqEZUoDJhURKzLQaYaH/global_users` trong `apps/web/lib/utils.ts` và `apps/web/app/api/sync/route.ts`.
   - Chuyển toàn bộ cơ chế xác thực về `apps/api/src/routes/auth.ts`:
     - Băm mật khẩu (Password Hashing) bằng thuật toán an toàn tiêu chuẩn (như PBKDF2/WebCrypto SHA-256 có Salt trong Cloudflare Workers, hoặc Argon2id/Bcrypt).
     - Lưu trữ tài khoản người dùng trực tiếp vào bảng `users` của Cloudflare D1.
     - Phát hành JWT token có thời hạn hợp lý, kèm refresh token được lưu trữ an toàn trong HTTP-only Cookie.
2. **Bảo mật cơ chế Đồng bộ Dữ liệu (Cloud Sync)**:
   - Viết lại endpoint `/api/sync`: Yêu cầu Header `Authorization: Bearer <JWT>` để xác thực danh tính người dùng trước khi tải hoặc lưu dữ liệu đồng bộ. Không cho phép truy cập nặc danh qua khóa `syncKey` công khai.
3. **Bảo vệ Gemini API Key**:
   - Trong `packages/ai-core/src/providers.ts`: Xóa bỏ việc truyền `?key=${apiKey}` trên URL.
   - Sử dụng Header chính thức của Google Generative Language API:
     ```typescript
     headers: {
       'Content-Type': 'application/json',
       'x-goog-api-key': options.apiKey
     }
     ```

---

### NHIỆM VỤ 2: VÁ LỖI RUNTIME PDF TIẾNG VIỆT & ESM WORKERS
1. **Sửa lỗi PDF Tiếng Việt trong `apps/api/src/lib/export/pdf.ts`**:
   - `pdf-lib` chỉ hỗ trợ UTF-8 khi được nhúng font tùy chỉnh dạng TTF/OTF thông qua fontkit (`@pdf-lib/fontkit`).
   - Tải về và nhúng một phông chữ mã nguồn mở hỗ trợ đầy đủ tiếng Việt (ví dụ: `NotoSans-Regular.ttf` và `NotoSans-Bold.ttf` dưới dạng Base64 hoặc ArrayBuffer nhúng trong Worker/R2/Public asset).
   - Đăng ký fontkit vào `PDFDocument`:
     ```typescript
     import fontkit from '@pdf-lib/fontkit';
     pdfDoc.registerFontkit(fontkit);
     const customFont = await pdfDoc.embedFont(fontBytes);
     ```
   - Đảm bảo toàn bộ chữ tiếng Việt có dấu (`ạ, ả, ã, á, à, â, đ, ê, ô, ơ, ư...`) được vẽ chính xác mà không gặp lỗi `WinAnsi cannot encode`.
   - Nếu chạy trên môi trường Web Client, tối ưu hóa tính năng in trực tiếp `window.print()` với layout sách chuẩn để tác giả có thể xem trước và in PDF chất lượng cao ngay lập tức.
2. **Sửa lỗi ESM `require is not defined` trong `apps/api/src/lib/export/markdown.ts`**:
   - Xóa bỏ toàn bộ các câu lệnh `require('./utils')` tại dòng 133, 138, 145.
   - Đưa tất cả các hàm `generateFrontMatter`, `generateToc`, `tiptapToHtml` lên đầu file và import bằng cú pháp ESM tiêu chuẩn:
     ```typescript
     import { tiptapToPlainText, tiptapToHtml, generateFrontMatter, generateToc, type ExportChapter, type ExportProject } from './utils';
     ```

---

### NHIỆM VỤ 3: SỬA TOÀN BỘ LOGIC SQL & D1 DATA INTEGRITY
1. **Khắc phục lỗi Root Outline Node trong `apps/api/src/routes/outline.ts`**:
   - Thay thế mệnh đề so sánh sai:
     ```typescript
     // SAI:
     body.parentId ? eq(schema.outlineNodes.parentId, body.parentId) : eq(schema.outlineNodes.parentId, '' as any)
     
     // ĐÚNG:
     body.parentId ? eq(schema.outlineNodes.parentId, body.parentId) : isNull(schema.outlineNodes.parentId)
     ```
2. **Cơ chế Chapter Reordering chuẩn xác trong `apps/api/src/routes/chapters.ts`**:
   - Không chỉ cập nhật một dòng duy nhất. Hãy xây dựng logic sắp xếp lại thứ tự:
     - Lấy danh sách tất cả các chương thuộc `projectId` sắp xếp theo `orderIndex`.
     - Loại bỏ chương cần di chuyển ra khỏi mảng, sau đó chèn vào vị trí mới `newIndex`.
     - Cập nhật lại `orderIndex` từ `0` đến `n-1` cho toàn bộ danh sách trong một Transaction hoặc Batch Query của D1 để đảm bảo thứ tự luôn liên tục và không bị trùng lặp.
3. **Sửa thống kê tổng quan trong `apps/api/src/index.ts` (`/api/stats/overview`)**:
   - Đếm chính xác tổng số chương của tất cả các dự án thuộc về người dùng, thay vì chỉ lấy `projects[0]`:
     ```typescript
     // Lấy tất cả dự án của người dùng
     const userProjects = await db.select({ id: schema.projects.id }).from(schema.projects).where(eq(schema.projects.userId, payload.userId));
     const projectIds = userProjects.map(p => p.id);
     
     // Truy vấn tổng hợp số chương và số từ bằng 1 câu lệnh duy nhất (tránh N+1)
     let totalChapters = 0;
     let totalWords = 0;
     if (projectIds.length > 0) {
       const chapters = await db.select({
         wordCount: schema.chapters.wordCount
       }).from(schema.chapters).where(inArray(schema.chapters.projectId, projectIds));
       totalChapters = chapters.length;
       totalWords = chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0);
     }
     ```
4. **Bảo toàn dữ liệu với Foreign Keys trong D1**:
   - Khi khởi tạo D1 middleware trong `apps/api/src/lib/db.ts`, thực thi:
     ```typescript
     await db.run(sql`PRAGMA foreign_keys = ON;`);
     ```
   - Trong `apps/api/src/routes/projects.ts`, khi xóa dự án, chủ động thực thi xóa liên hoàn (Cascade Delete) các bảng con (`chapters`, `characters`, `outline_nodes`, `timelines`, `export_jobs`) trong một transaction để ngăn chặn rác dữ liệu.
5. **Đồng nhất Zod Schema ID**:
   - Cập nhật `packages/shared/src/schemas.ts`: Chuyển các trường ID từ `z.string().uuid()` sang `z.string().min(1)` để chấp nhận cả UUID lẫn các ID có tiền tố dạng `proj_...`, `chap_...`, `char_...`.

---

### NHIỆM VỤ 4: ĐỒNG BỘ KIẾN TRÚC FRONTEND - BACKEND & CHUẨN HÓA MONOREPO
1. **Xây dựng cấu hình TypeScript chuẩn cho Monorepo**:
   - Tạo file `tsconfig.base.json` ở thư mục gốc với các thiết lập hiện đại:
     ```json
     {
       "compilerOptions": {
         "target": "ES2022",
         "module": "NodeNext",
         "moduleResolution": "NodeNext",
         "strict": true,
         "esModuleInterop": true,
         "skipLibCheck": true,
         "forceConsistentCasingInFileNames": true
       }
     }
     ```
   - Thêm `tsconfig.json` cho `packages/shared`, `packages/ai-core`, và `apps/api` kế thừa từ cấu hình chuẩn.
2. **Kích hoạt lại kiểm tra lỗi khi Build trong `apps/web/next.config.js`**:
   - Gỡ bỏ `ignoreBuildErrors: true` và `ignoreDuringBuilds: true`.
   - Sửa toàn bộ các lỗi kiểu và linter còn sót lại để lệnh `pnpm run build` và `pnpm run type-check` vượt qua hoàn toàn với exit code 0.
3. **Thống nhất API Client ở Frontend**:
   - Tạo một lớp `apiClient` tập trung trong `apps/web/lib/api-client.ts`.
   - Tách biệt rõ ràng:
     - Khi chạy Online: Mọi thao tác lưu, đọc, AI đều gọi trực tiếp tới Cloudflare Worker API.
     - Khi chạy Offline: Lưu dữ liệu vào IndexedDB / localStorage với trạng thái `syncStatus: 'pending'`. Khi có mạng trở lại, tự động đẩy dữ liệu lên Worker API.

---

### NHIỆM VỤ 5: TỐI ƯU BỘ NHỚ & CPU WORKER CHO XUẤT BẢN SÁCH LỚN
1. **Tối ưu Base64 Encoding trong `apps/api/src/routes/export.ts`**:
   - Thay thế vòng lặp nối từng ký tự `binaryStr += String.fromCharCode(binary[i])` bằng cơ chế chunking hoặc chuyển đổi trực tiếp:
     ```typescript
     function uint8ArrayToBase64(bytes: Uint8Array): string {
       let binary = '';
       const len = bytes.byteLength;
       const chunkSize = 8192; // Xử lý từng khối 8KB để tránh tràn stack
       for (let i = 0; i < len; i += chunkSize) {
         const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
         binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
       }
       return btoa(binary);
     }
     ```
   - Tránh lưu giữ dữ liệu file lớn trong bộ nhớ Worker; ưu tiên lưu trữ thẳng vào Cloudflare R2 Bucket và trả về Signed Download URL cho người dùng.

---

## 4. TIÊU CHUẨN NGHIỆM THU (ACCEPTANCE CRITERIA)
- [ ] Toàn bộ lệnh `pnpm run type-check` và `pnpm run lint` trên toàn bộ monorepo hoàn thành không có lỗi.
- [ ] Không còn bất kỳ request nào gửi tới `kvdb.io`. Toàn bộ dữ liệu người dùng được lưu an toàn với mật khẩu đã mã hóa.
- [ ] Endpoint `/api/export/:projectId` xuất định dạng PDF tiếng Việt thành công 100%, hiển thị chuẩn dấu câu tiếng Việt mà không bị crash.
- [ ] Endpoint xuất HTML không còn lỗi `require is not defined`.
- [ ] Di chuyển thứ tự chương trong mục Lục cập nhật chính xác và bảo toàn thứ tự `orderIndex`.
- [ ] Endpoint `/api/stats/overview` phản ánh chính xác tổng số chương và từ của toàn bộ các tác phẩm của người dùng.
- [ ] Test suite tự động (`pnpm test`) vượt qua 100%.
```

---

## 5. KẾT LUẬN & ĐỀ XUẤT HÀNH ĐỘNG
Bản phân tích và prompt cải thiện này đã được lập trình viên tổng hợp chi tiết dựa trên toàn bộ mã nguồn hiện tại của dự án Novelist. Việc áp dụng đúng các bước trong Master Prompt sẽ giúp hệ thống lột xác từ một phiên bản thử nghiệm có nhiều lỗ hổng thành một nền tảng viết tiểu thuyết chuyên nghiệp, bảo mật cao và vận hành ổn định trên hạ tầng Cloudflare.
