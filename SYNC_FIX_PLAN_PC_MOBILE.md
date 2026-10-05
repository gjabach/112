# Plan sửa lỗi PC–điện thoại báo ngoại tuyến và không đồng bộ

Tài liệu bàn giao cho AI triển khai. Ngày lập: 05/10/2026.

## 1. Yêu cầu và mức độ xác minh

Người dùng mở ứng dụng trên PC và điện thoại cùng lúc. Cả hai thiết bị có Internet. Hai ảnh đều mở thẻ tên “Chương 2”, đều hiện thông báo “Đang viết ngoại tuyến. Bản nháp được giữ trên thiết bị này và chưa được đồng bộ”, nhưng nội dung khác nhau. Điện thoại truy cập một domain Vercel.

Mục tiêu: tìm và sửa nguyên nhân không kết nối/dữ liệu không hội tụ; trạng thái lưu phải phản ánh đúng dữ liệu đã được máy chủ xác nhận; bảo toàn nội dung trên cả hai thiết bị.

Đã đọc mã nguồn frontend, API, khóa chỉnh sửa, đồng bộ, đăng nhập và cấu hình triển khai. Đã chạy bốn file test hiện có: **99 test pass, 0 fail**. Nhiều test kiểm tra chuỗi mã nguồn hoặc mô phỏng thuật toán, chưa kiểm tra request trình duyệt, preflight CORS, D1 thực, JWT thực hay hai browser context độc lập.

Chưa có Network/Console/log production; chưa xác minh env của deployment đang chạy. Chưa xác minh hai thiết bị có cùng account ID, project ID, chapter ID, origin và build. Tên “Chương 2” giống nhau không đủ chứng minh cùng bản ghi. Các kết luận về nguyên nhân production dưới đây là giả thuyết có bằng chứng trong code, cần kiểm chứng theo bước 4.

Tài liệu này là plan; chưa thay đổi logic ứng dụng hoặc dữ liệu production.

## 2. Quy tắc triển khai và hành vi đích

1. Trước mọi thao tác nhập dữ liệu cũ, đổi auth hoặc bật luồng lưu mới, tạo bản sao riêng cho PC, điện thoại và server. Bản sao phải bao gồm pending drafts/recoveries, không chỉ chapters.
2. Giữ đầy đủ hai nội dung khác nhau trong ảnh. Nếu không có đủ base version để xác định quan hệ giữa chúng, giữ thành hai bản khôi phục; không chọn một bản theo thời gian hoặc độ dài rồi xóa bản kia.
3. Tiếp tục kiến trúc **một thiết bị được sửa một chương tại một thời điểm** đã có trong repo. Thiết bị còn lại đọc được bản mới và có thể chuyển quyền sửa rõ ràng. Hai thiết bị vẫn có thể sửa hai chương khác nhau đồng thời.
4. “Hai thiết bị truy cập cùng lúc” chưa có nghĩa là yêu cầu cả hai cùng gõ vào một chương như Google Docs. Nếu có yêu cầu đó, cần kế hoạch CRDT/OT riêng; không thêm Yjs/WebSocket chỉ để chữa lỗi cấu hình hiện tại.
5. Dữ liệu chương được lưu qua API có xác thực, kiểm tra quyền sở hữu, khóa và phiên bản. Mọi đường ghi content/title phải tuân theo cùng quy tắc.
6. Bản nháp địa phương và bản đã được máy chủ xác nhận là hai khái niệm riêng. Chỉ hiện “Đã lưu trên đám mây” sau xác nhận ghi bền vững cho đúng phiên bản.
7. Không dùng `navigator.onLine` làm kết luận rằng API hoạt động; cần request thực. Không gộp 401/403/404/500/CORS vào cùng thông báo “mất mạng”.
8. Không reset localStorage, đăng xuất bắt buộc, đổi domain hay reload liên tục để chữa triệu chứng. Những thao tác này có thể làm mất bản đang nằm riêng trên thiết bị.
9. Giữ phạm vi sửa ở lưu, đồng bộ, auth liên quan và triển khai; không thay giao diện biên tập hoặc tính năng AI ngoài phần cần thiết.

## 3. Bằng chứng từ repo và giả thuyết ưu tiên

Các đường dẫn trong bảng tính từ thư mục gốc repo. Số dòng là mốc của bản được kiểm tra; AI triển khai phải tìm lại theo tên hàm khi code thay đổi.

| Ưu tiên | Bằng chứng | Ý nghĩa và cách xác nhận |
| --- | --- | --- |
| P0 | `apps/web/lib/utils.ts:231`: `API_URL = process.env.NEXT_PUBLIC_API_URL || ''`; `apps/web/lib/chapter-lock.ts:46`: `hasRemoteChapterApi()` chỉ trả `Boolean(API_URL)` | Thiếu biến public làm editor tự coi là local-only, dù `/api/sync` cùng origin vẫn hoạt động. Kiểm tra giá trị trong build thực, không chỉ dashboard env. |
| P0 | Editor `page.tsx:285`: `tryAcquireLock()` thấy không có remote API thì chuyển `offline`, protect chương và return | Nhánh này tạo chính banner trong ảnh. Nút “Kết nối lại” ở khoảng dòng 1167 cũng bị ẩn nếu thiếu API. Ảnh không thấy nút là dấu hiệu phù hợp, chưa phải bằng chứng chắc chắn vì có thể khác build hoặc bị cắt ảnh. |
| P0 | Editor `page.tsx:468`: `saveChapter()` ghi draft local rồi return khi thiếu API hoặc đang `offline` | Nhánh lưu ngoại tuyến không kích hoạt auto-push sau đó. Polling có thể đẩy workspace gián tiếp, nhưng không bảo đảm editor đang xem hội tụ. |
| P0 | Editor `page.tsx:318` và `:495`: catch chỉ phân biệt một số lỗi 423/409; lỗi khác chuyển `offline` | API trả 401 vì JWT, 404 vì route/chương, 500 vì migration hoặc lỗi cấu hình đều bị trình bày giống lỗi mạng. |
| P0 | `apps/web/lib/utils.ts:417` trở đi: local login tạo `token_<userId>`; `apps/api/src/middleware/auth.ts` chỉ chấp nhận JWT đã verify | Nếu bật Worker API cho account đã đăng nhập qua fallback, token cũ có thể luôn nhận 401. Cần chứng minh loại token trước khi thay env. |
| P0 | `apps/api/src/middleware/cors.ts`: allow-headers chỉ có `Content-Type, Authorization`; editor gửi `X-Chapter-Lock-Token` | Khi frontend gọi Worker khác origin, PATCH lưu/heartbeat có custom header sẽ cần preflight cho header đó. Acquire có thể thành công nhưng lưu sau đó bị browser chặn. |
| P0 | CORS mặc định cho Pages/local và `FRONTEND_URL`, trong khi ảnh điện thoại là Vercel | Vercel production chỉ được phép nếu origin đúng được cấu hình. Không mặc định coi tất cả Vercel origin đều được phép. |
| P0 | `apps/web/app/api/sync/route.ts`: có `Map` trong memory, fallback KVDB và có thể trả `success: true` sau các PUT bị catch; `functions/api/sync.ts` có cách xử lý tương tự | “Đã đồng bộ” có thể chưa có dữ liệu bền vững. Cần thử ghi lỗi upstream và cold start để phân biệt. |
| P0 | `apps/api/src/routes/chapters.ts` ghi D1; `apps/api/src/routes/sync.ts` GET/POST snapshot KV; Next route fallback dùng KVDB | Có nhiều nguồn dữ liệu. Lưu content ở D1 không tự cập nhật snapshot KV; POST snapshot không nhập chapters vào D1. Thêm API_URL chưa đủ bảo đảm dữ liệu cũ tồn tại trong D1. |
| P0 | Worker sync POST không kiểm tra khóa chương; Next/Pages fallback cũng merge snapshot ngoài khóa | Snapshot có thể chứa draft chưa được xác nhận và tạo một bản “cloud” khác với canonical D1. Không thể coi toàn bộ các đường sync hiện tại đều đã bảo vệ khóa. |
| P1 | `apps/web/lib/sync.ts:578`: `pullRes.success || pushRes.success`; `pullSync()` không có candidates vẫn báo synced trước khi push hoàn tất | Sync có thể xanh khi chỉ đọc được hoặc không đọc được gì, trong khi bản nháp chưa ghi thành công. |
| P1 | `SyncProvider` biến mọi `novelist-sync-updated` thành `synced`; sự kiện cũng đến từ storage/BroadcastChannel | Cập nhật cache cùng máy bị nhầm với xác nhận cloud. Icon xanh trong ảnh không chứng minh lưu server thành công. |
| P1 | `protectedChapterIds` chỉ bảo vệ import vào local; editor chỉ refresh content trên sync event khi `locked` | Hai editor `offline` có thể tiếp tục hiển thị khác nhau ngay cả khi snapshot cloud đã đổi. Không sửa bằng cách ép remote ghi đè editor đang dirty. |
| P1 | `sync-core.ts`: chọn content theo timestamp, tie-break theo độ dài, heuristic giữ văn bản không rỗng; `lastModified` có `Date.now()` lúc merge | Timestamp máy khách không đủ xử lý xung đột; đọc/merge có thể tạo timestamp mới dù không có mutation. Xóa nội dung hợp lệ có thể bị heuristic chống rỗng cản lại. |
| P1 | Chapter PATCH kiểm tra lock/version bằng các lần đọc rồi cuối cùng update `WHERE id = ...` | Có cửa sổ race giữa kiểm tra và ghi; cần cập nhật có điều kiện tại database, không chỉ assert trước request. |

Repo có `wrangler.toml` với ID/binding local, `ENVIRONMENT=development`, `FRONTEND_URL` localhost. Đây là template trong checkout, chưa chứng minh production dùng các giá trị đó. Xác minh deployment thực trước khi sửa.

## 4. Chẩn đoán có bằng chứng trước khi sửa

### 4.1 Bảo toàn và định danh dữ liệu

Lập bảng cho PC và điện thoại: origin đầy đủ, build ID hoặc commit, account ID đã được server xác nhận, project ID, chapter ID, browser, thời điểm kiểm tra. Dùng nickname A/B trong log công khai.

Xuất riêng các nhóm sau từ từng thiết bị vào bản sao người dùng giữ được:

- `novelist_projects`, `novelist_chapters`, `novelist_tombstones`.
- `novelist_pending_chapter_drafts`, `novelist_pending_recoveries`.
- Characters, worldbuilding/entities, timeline/events/eras, outline/outlines và wiki articles.
- Nội dung hiện đang ở Tiptap và title, kể cả chưa qua debounce.
- Metadata device/session, baseVersion, thời điểm lưu local; không xuất token, mật khẩu/hash mật khẩu hoặc AI key vào log.

Kiểm tra export hiện có có chứa pending drafts/recoveries hay không; `exportFullWorkspace()` hiện không xuất hai queue này. Nếu thiếu, bổ sung chức năng backup trong quá trình triển khai trước khi migration.

Đầu ra: có backup-PC, backup-mobile và backup-server độc lập; ghi số chương, số draft và hash nội dung của Chương 2. Khôi phục thử trên môi trường test để chứng minh file đọc được.

### 4.2 Trace request thật

Trên một project test, mở Network/Console PC và log tương ứng điện thoại. Nếu không có remote debugging điện thoại, thêm bảng chẩn đoán tạm trong app, chỉ hiện endpoint tương đối, status, request ID và trạng thái; không hiện credential/nội dung truyện.

Ghi từng request theo thứ tự:

1. Config/capabilities và health API.
2. `/api/auth/me` bằng session thực.
3. GET chương và danh sách chương.
4. POST `/api/chapters/:id/lock`.
5. OPTIONS nếu khác origin, PATCH chương và PATCH heartbeat.
6. GET/POST `/api/sync` và nguồn lưu thực tế mà server sử dụng.

Với mỗi request ghi URL/origin, method, HTTP status, content-type, duration, request ID, lỗi máy chủ đã lọc dữ liệu riêng tư. Với response chương ghi chapter ID, revision và hash content. Không log Authorization hoặc lock token.

### 4.3 Cây quyết định

| Quan sát | Chẩn đoán cần ưu tiên | Hướng xử lý |
| --- | --- | --- |
| Không có request lock, client API_URL rỗng | Client coi thiếu cấu hình là offline | Chuẩn hóa resolver/capabilities và deployment; đừng sửa navigator.onLine. |
| Server có API_URL nhưng client public env rỗng | Hai nơi định tuyến khác nhau; public env lúc build thiếu | Same-origin proxy hoặc rebuild đúng public env. |
| Request trỏ localhost/HTTP từ trang HTTPS | Endpoint sai hoặc mixed content | HTTPS endpoint đúng cho deployment. |
| OPTIONS fail, thiếu allow-origin/header | CORS | Sửa đúng origin/method/header hoặc dùng same-origin proxy. |
| 401 | Token local giả, hết hạn hoặc không hợp lệ | Auth rõ loại session, migration account; không fallback sang local login thành công. |
| 403 | Account/quyền sở hữu không khớp | Xác minh ownership; không bỏ auth middleware. |
| 404 chương hoặc route lock | Route chưa deploy hoặc record chỉ có trong snapshot/local | Phân biệt route và record; import có kiểm soát sau xác thực. |
| 500, log thiếu table/column | Migration/binding backend lệch | Áp dụng schema đúng môi trường, xác minh lại. |
| 423 | Thiết bị khác giữ khóa | Read-only đúng thiết kế, không báo offline. |
| 409 | Base version không còn hợp lệ | Giữ draft, recovery/reconcile, không retry overwrite. |
| 200 nhưng HTML hoặc JSON thiếu lock/chapter | Sai router/SPA fallback/protocol | Lỗi contract; không mặc định thành công. |
| Sync trả 200 nhưng cold start hoặc thiết bị B không thấy dữ liệu | Persist chưa thành công hoặc đọc kho khác | Kiểm tra storage ack, canonical store và cache. |

AI phải kết luận nguyên nhân trực tiếp bằng trace. Có thể có nhiều lỗi nối tiếp: thiếu env → bật env → lộ 401 → sửa auth → lộ CORS → lộ dữ liệu chỉ ở KVDB. Không kết thúc ở lỗi đầu tiên.

## 5. Kiến trúc sửa đề xuất

Chọn mặc định: browser gọi API cùng origin Next.js; Next proxy sang Worker đã cấu hình trên server; Worker xác thực session và dùng D1 làm nguồn chính thức cho projects/chapters/locks/revisions. Local cache và draft queue bảo vệ quá trình viết khi chưa kết nối.

Luồng: `Editor → API cùng origin → Worker có auth → D1`. Đọc thay đổi qua polling có revision/cursor. BroadcastChannel chỉ cập nhật tab cùng origin trên cùng thiết bị. KV dùng cache hoặc backup, không quyết định quyền sửa và phiên bản chương.

Repo trên Vercel hiện chỉ có một số route Next, chưa có proxy cho chapters/projects/auth. Nếu chọn same-origin, phải triển khai đầy đủ các route liên quan, không chỉ đổi `hasRemoteChapterApi()` thành true.

Nếu deployment bắt buộc browser gọi Worker trực tiếp, giữ phương án đó nhưng tất cả đường auth/đọc/ghi/sync phải dùng cùng base URL và session. Khi đó CORS và public env lúc build là điều kiện bắt buộc. Ghi lại lý do chọn phương án này; không để editor dùng Worker còn sync fallback sang kho khác.

Không dùng Cloudflare Pages Function như thể nó tự chạy trên Vercel. `functions/api/sync.ts` chỉ cần sửa nếu Pages còn là deployment được hỗ trợ; nếu giữ cả hai, phải chia sẻ contract/logic để tránh ba bản merge khác nhau.

## 6. Thứ tự triển khai cụ thể

### Bước A — Viết test tái hiện và thêm quan sát lỗi

Tạo tối thiểu các test thất bại trước sửa:

1. Client không có public API_URL nhưng same-origin API khả dụng: phải kiểm tra capabilities và dùng API, không tự offline.
2. Lock acquire nhận 401/404/500: hiển thị đúng loại lỗi, giữ draft và không giả thành network offline.
3. Pull thành công, push thất bại: trạng thái không được là “Đồng bộ hoàn tất”.
4. `/api/sync` upstream PUT thất bại toàn bộ: không được trả durable success.
5. Context B đang read-only nhận content đã ack từ context A, không cần reload.
6. Snapshot từ B không có lock không được thay canonical content của A.

Test phải gọi module/hàm thực hoặc route thật; không chép lại implementation vào test và chỉ kiểm tra bản chép. Bổ sung logger có `requestId`, endpoint, HTTP status, error code, duration, backend source, revision. Bật debug theo môi trường/cờ, không spam toast mỗi chu kỳ poll.

Hoàn thành khi lỗi tái hiện được và trace chỉ ra nơi đầu tiên thất bại.

### Bước B — Chuẩn hóa endpoint và capabilities

File chính: `utils.ts`, `api-client.ts`, `chapter-lock.ts`, các route Next cần thêm, config deploy.

- Tạo resolver chung để các luồng auth, projects, chapters, lock, recovery, sync không tự chọn backend riêng.
- Thay điều kiện `Boolean(API_URL)` bằng config/capabilities được kiểm chứng; phân biệt `checking`, `available`, `unconfigured`, `unreachable`.
- Nếu chọn proxy, API_URL chỉ cần server-side. Browser gọi `/api/...`; endpoint capabilities không tiết lộ secret và cho biết có hỗ trợ chapter locks, revision protocol, durable sync.
- Proxy phải allowlist path/method, chuyển Authorization/cookie cần thiết, lock header, body và status; giữ cả 409/423/401/503. Không dựng generic open proxy từ URL do client truyền vào.
- Client đặt timeout, cleanup timer trong finally, support AbortSignal. GET dữ liệu user có cache policy rõ ràng, không dùng CDN/static cache làm mất freshness hoặc lẫn tài khoản.
- Validate JSON contract: 2xx HTML hoặc `{}` không được xem là acquire/save thành công. `lock.token`, chapter ID và revision cần tồn tại, có kiểu đúng.
- Không tiếp tục dùng client option `baseUrl` chỉ khai báo mà `request()` không sử dụng; hoặc dùng resolver thực hoặc loại bỏ config gây hiểu nhầm.

Hoàn thành khi browser nhìn thấy API khả dụng và tất cả luồng có cùng server identity/backend.

### Bước C — Auth thống nhất và đường chuyển đổi dữ liệu cũ

File chính: `utils.ts` phần login/register, `store.ts`, auth routes, middleware và importer mới nếu cần.

- Auth online thất bại vì 401/403 không được biến thành session local “đã đăng nhập”. Local guest có trạng thái riêng, không tự tuyên bố có quyền cloud.
- Session Worker dùng token được server cấp và verify. `token_<id>` không được đưa qua middleware như JWT hợp lệ.
- Các nơi đọc token phải dùng cùng nguồn; loại bỏ tình trạng `localStorage.token` khác `auth-storage.state.token`.
- Không giải quyết bằng việc server tin userId/email do client gửi, decode JWT không verify, hoặc đổi một chuỗi local token thành token server.
- Với account legacy chỉ có ở local/KVDB: xác định cách chứng minh sở hữu account và chuyển account trước khi nhập dữ liệu. Không tự ghép hai account chỉ vì email gần giống nhau hoặc tên giống nhau. Nếu cần operator/user cung cấp bằng chứng sở hữu, báo rõ phần nào chưa thể migrate.
- Namespacing cache/draft/recovery theo account ID và môi trường. Đổi tài khoản không được gửi pending draft của A vào workspace B. Guest queue giữ riêng.
- Trước logout/reset hoặc chuyển account, backup draft; cleanup subscription/request cũ và bảo đảm late response không ghi vào cache account mới.

Hoàn thành khi `/api/auth/me` trên cả hai thiết bị trả cùng server account ID, và request chương/khóa dùng session hợp lệ.

### Bước D — CORS và deployment

Nếu dùng cross-origin, sửa `apps/api/src/middleware/cors.ts`:

- Origin allowlist gồm domain production thực và các preview được chủ dự án chủ động hỗ trợ. Không allow toàn bộ Vercel hoặc tùy ý phản chiếu Origin.
- Allow methods cần dùng: GET, POST, PATCH, DELETE, OPTIONS; thêm PUT nếu contract mới có PUT.
- Allow headers ít nhất Content-Type, Authorization, X-Chapter-Lock-Token; thêm If-Match/X-Request-Id nếu thực sự dùng.
- Trả `Vary: Origin` khi allow-origin thay đổi theo Origin. Credential policy nhất quán nếu dùng cookie.
- Preflight phải chạy trước auth yêu cầu login; header CORS cũng có trên error response.
- Thử OPTIONS và request thực trong browser. Server-side curl/fetch thành công không chứng minh browser CORS thành công.

Kiểm tra đúng environment Vercel Production/Preview và Worker. Public env Next.js được đóng vào bundle lúc build; thay dashboard env sau build không sửa bundle cũ. Nếu giữ NEXT_PUBLIC_API_URL, rebuild/redeploy đúng môi trường rồi kiểm tra build trên hai thiết bị. Nếu dùng proxy, xác minh server env và route runtime đúng.

Kiểm tra Worker DB/KV bindings và migration `0002_chapter_edit_locks.sql`: có `chapter_edit_locks`, `content_updated_at`, `title_updated_at`, backfill đúng. Không chạy lại ALTER TABLE mù quáng trên DB đã áp dụng; dùng migration tracking và backup schema/data.

Health hiện có không chứng minh auth, table/column và lưu dữ liệu đúng. Bổ sung readiness/capability kiểm tra tối thiểu cần thiết; error nội bộ chi tiết chỉ ở server log.

### Bước E — Chọn nguồn chính thức và nhập dữ liệu hiện có

File chính: API `projects.ts`, `chapters.ts`, `sync.ts`, Next sync route, `sync-core.ts`; thêm migration/import contract nếu cần.

Hiện D1 và workspace snapshot độc lập. Sửa để mọi thiết bị đọc được cùng canonical projects/chapters. Với mục tiêu bản vá này, đề xuất D1 là canonical cho phần đó; workspace GET phải lấy dữ liệu D1 mới hoặc trả snapshot có revision được chứng minh khớp D1.

Kế hoạch import:

1. Xuất manifest dữ liệu legacy có origin, source, account ownership, IDs, count và content hashes. Không đưa credentials vào payload import.
2. Chạy dry-run: liệt kê record chưa có trong D1, ID conflict, hai content khác nhau, quan hệ parentId/projectId hỏng, giới hạn 100 thẻ.
3. Project chưa có thì tạo project trước chapter trong account đúng. Giữ ID nếu hợp lệ/không va chạm; nếu đổi ID, dùng mapping đầy đủ cho parentId, scene, outline, liên kết và recovery.
4. Chương chỉ có ở local/KVDB phải được nhập có xác thực, ownership check và idempotency. Không thể acquire lock một chương chưa tồn tại trong D1; bootstrap phải chạy trước.
5. Với hai bản Chương 2 khác nhau và base không đáng tin: lưu cả hai, gắn nhãn nguồn PC/điện thoại và thời điểm capture, không dùng LWW để âm thầm loại một bản.
6. Import lặp lại cùng manifest không tạo duplicate. Failure giữa chừng có thể resume và đối chiếu count/hash.
7. Hết slot 100 thẻ hoặc bản gốc bị xóa: vẫn giữ recovery trong kho riêng/queue bền vững và báo trạng thái; không xóa draft vì recovery endpoint thất bại.
8. Chỉ đánh dấu migrated sau read-back qua authenticated API xác nhận manifest/version tương ứng. Legacy backup vẫn được giữ để phục hồi.

Đối với snapshot sync còn giữ để backup/metadata, content/title canonical phải do server đọc từ D1. Nếu POST sync vẫn nhận mutation chương, mutation đó phải đi qua cùng lock/version/ownership contract; không merge timestamp để vòng qua khóa.

Không dùng `Map` của Next Edge làm bằng chứng dữ liệu đã lưu bền vững. Upstream persistence phải kiểm tra HTTP status và body; `Promise.allSettled` chỉ cho biết promise hoàn tất, không cho biết PUT thành công. Primary store fail thì trả lỗi hoặc partial rõ ràng. Worker không có binding lưu cần thiết phải báo config/storage unavailable, không trả success.

Cloudflare KV có eventual consistency và ghi đồng thời cùng key có thể ghi đè nhau. Giữ KV như cache/backup; không dùng read-merge-PUT KV để quyết định version/lock tức thời.

### Bước F — Ràng buộc khóa và phiên bản ngay tại database

File chính: `apps/api/src/routes/chapters.ts`, `db/schema.ts`, migrations, shared schemas/types.

- Giữ lease 60 giây và heartbeat 20 giây làm giá trị khởi đầu; đo thực tế khi mobile background. Server quyết định expiry, không dựa đồng hồ thiết bị.
- Chỉ cấp một lock cho một chương. Takeover kiểm tra expectedLockVersion; token cũ bị từ chối sau khi quyền đã chuyển.
- Khi content/title thay đổi, yêu cầu active lock hợp lệ và base revision phù hợp. Hiện không có active lock thì helper có thể cho ghi; cần đóng đường ghi đó cho các mutation được bảo vệ.
- Ưu tiên thêm revision integer do server tăng, dùng làm optimistic concurrency. Nếu giữ timestamp field-version trong bản vá, phải server-generated, monotonic và compare tại lệnh ghi, không dùng timestamp client làm thẩm quyền.
- UPDATE canonical dùng điều kiện chapter/account/expected revision và active lock token chưa hết hạn ngay trong database statement hoặc transaction tương đương được runtime hỗ trợ. Không SELECT-check rồi UPDATE chỉ theo id.
- Kiểm tra số row thay đổi. 0 row phải phân loại conflict/lock lost/not found; không trả success có revision tự chế.
- Takeover và PATCH chạy sát nhau: nếu PATCH commit trước takeover thì là revision hợp lệ; nếu takeover commit trước thì PATCH token cũ không được commit. Test ranh giới này.
- Acquire trả snapshot chương và revision nhất quán sau khi cấp khóa, hoặc có bước đọc/verify revision trước cho gõ. Không trao quyền sửa với content cũ nhưng baseVersion mới.
- Giữ revision history cho content bị thay thế quan trọng và recovery. Reorder/delete/duplicate có policy khóa rõ ràng nếu ảnh hưởng chương đang mở.

Không gọi D1 `BEGIN/COMMIT` tùy tiện theo SQLite thuần; chọn conditional SQL/batch/transaction theo API thực tế và kiểm tra atomicity trong môi trường D1.

### Bước G — Tách trạng thái kết nối, quyền sửa và lưu

File chính: editor `page.tsx`, `SyncProvider`, `sync.ts`, `chapter-lock.ts`.

Tách ba nhóm state, tránh một biến `offline` gánh mọi lỗi:

| Nhóm | Trạng thái đề xuất | Quy tắc |
| --- | --- | --- |
| Kết nối dịch vụ | checking, reachable, unreachable, unconfigured, auth-required, server-error | Được quyết định bằng config/capability/request; lưu last error code. |
| Quyền sửa | acquiring, owned, read-only, expired | Chỉ owned có active lease mới được ghi canonical; local draft mode là lựa chọn có nhãn rõ. |
| Lưu chương | clean, dirty, local-saved, uploading, server-acked, conflict, failed | server-acked gắn với đúng local revision/content hash đã gửi. |

Thông điệp cần có:

- Không có mạng/kết nối API: “Chưa kết nối được máy chủ. Bản nháp đã lưu trên thiết bị.”
- Thiếu config: “Dịch vụ đồng bộ chưa được cấu hình. Bản nháp vẫn được giữ trên thiết bị.”
- 401: “Phiên đăng nhập cần được xác thực lại. Bản nháp vẫn được giữ.”
- 5xx: “Máy chủ chưa lưu được thay đổi. Đã giữ bản nháp trên thiết bị.”
- 423: “Chương đang được sửa trên [thiết bị]. Bạn đang xem bản chỉ đọc.”
- Ack: “Đã lưu trên đám mây”, kèm thời điểm ack; local-only phải ghi “Đã lưu trên thiết bị”.

Nút thử lại xuất hiện theo khả năng recover. Không ẩn toàn bộ chẩn đoán chỉ vì API_URL rỗng. Có thể hiển thị mã hỗ trợ ngắn, không đưa stack trace vào giao diện người viết.

`SyncProvider` không lấy event cache/storage làm cloud success. `lastSynced` chỉ đổi khi có server ack/read thành công phù hợp; tách lastCloudChecked, lastCloudWriteAck và lastLocalSaved nếu UI cần.

`SyncStatusButton` idle/checking/unconfigured không dùng màu xanh ngụ ý đã lưu. Màu/trạng thái editor và nút cloud phải xuất phát từ cùng nguồn state.

### Bước H — Autosave, journal địa phương và xử lý ack

File chính: editor, `chapter-lock.ts`; cân nhắc tách controller ra module để test lifecycle dễ hơn.

- Khi gõ, tạo local revision tăng dần và lưu journal/draft đủ sớm để bảo toàn khi rời trang trước debounce 700ms. Nội dung hiện tại trong Tiptap là nguồn cho draft, không lấy cache cũ.
- Draft lưu `accountId`, `projectId`, `chapterId`, `content`, `title`, `baseServerRevision`, `localRevision`, `operationId`, `savedLocallyAt`. Giữ tương thích baseVersion legacy đến khi migrate xong.
- Bắt lỗi quota/storage denied/JSON hỏng. Các `catch {}` trong persist draft hiện làm UI có thể nói đã giữ draft dù ghi storage thất bại; cần return kết quả rõ. Nếu storage fail, cảnh báo và cung cấp xuất bản nháp.
- Duy trì queue serial theo chapter+session. Coalesce các snapshot chưa gửi; snapshot đang in-flight hoàn tất trước khi gửi bản mới theo revision đã ack.
- Response cho local revision N không được đánh dấu revision N+1 đã lưu. Không ghi cache bằng content N nếu journal đang chứa N+1 mà không giữ pending N+1 riêng.
- Sau ack N, cập nhật base revision của queued draft đúng quan hệ; content/title local mới hơn vẫn pending. Xóa draft có điều kiện theo operation/localRevision, không chỉ chapterId.
- Validate save response có chapter ID/version đúng. Không dùng `Date.now()` thay revision server khi response thiếu chapter để giả thành công.
- Timeout không chứng minh server chưa commit. Retry cùng operationId/idempotency key hoặc đọc lại revision để xác định kết quả trước khi gửi mutation mới.
- Flush trước chuyển chương/unload phải lưu draft local đồng bộ trước; request mạng sau đó là best effort. Không trông chờ Promise tiếp tục chạy khi iOS đóng/suspend tab.
- Không dùng keepalive để gửi toàn workspace lớn. Giới hạn payload/keepalive cần test; phần chưa gửi vẫn ở durable local queue.
- Khi chuyển chương nhanh, late response của chương cũ không được thay content, refs, lock hoặc pending draft của chương mới.

### Bước I — Reconnect và recovery

Khi dịch vụ reachable trở lại, chạy chuỗi có kiểm soát: xác thực → lấy canonical/version → acquire khóa nếu được → kiểm tra base draft → quyết định gửi hoặc recovery → đọc ack → refresh viewer.

- Base revision vẫn hiện hành: gửi draft có lock, chờ ack rồi mới clear pending.
- Server thay đổi từ base: giữ draft thành recovery hoặc mở lựa chọn reconcile; không gửi draft như bản mới nhất chỉ vì timestamp thiết bị cao hơn.
- Thiết bị khác đang giữ khóa: chuyển read-only canonical. Nếu có draft local thì vẫn giữ draft/recovery riêng; giao diện phải cho mở lại nó.
- Recovery request retry với cùng recoveryId/operationId cho cùng snapshot; database unique/idempotency bảo vệ cả hai request song song, không chỉ Map trong một browser.
- Có edit mới sau khi capture recovery: recovery ack chỉ clear đúng snapshot đã capture; không gọi `clearPendingChapterDraft(chapterId)` vô điều kiện làm mất bản mới.
- Nếu tạo recovery fail, giữ bảo vệ draft. Không `unprotectChapterFromSync()` và fetch content mới trước khi bản cũ đã được bảo toàn rõ ràng.
- Recovery limit, source chapter deleted và auth hết hạn phải có đường phục hồi mà không phụ thuộc việc tạo chapter thành công ngay.
- Retry khi online, focus, visibility visible và lịch backoff có jitter; chỉ một lần acquire in-flight cho mỗi session. Tránh toast lặp lại khi server vẫn lỗi.

### Bước J — Đồng bộ hai thiết bị và viewer đang mở

Giữ polling để bản vá nhỏ và phù hợp kiến trúc hiện tại. Dùng một lịch visible polling, ban đầu 8 giây như repo; mục tiêu nghiệm thu viewer thấy revision đã ack trong **tối đa 10 giây trên mạng bình thường**, không phải bảo đảm dưới mọi điều kiện mạng.

- GET changes/canonical trả revision/cursor server, cache-control rõ; conditional GET nếu phù hợp. Khi dùng D1 read replicas, chọn consistency/session strategy để tránh response lùi revision.
- Viewer read-only cập nhật Tiptap từ canonical sau ack của writer. Writer dirty/owned không bị background snapshot thay nội dung đang gõ.
- Khi viewer chuyển quyền sửa, hydrate snapshot/revision mới nhất rồi mới unlock editor. Test viewer lag một chu kỳ poll trước takeover.
- Poll lock status đủ để thiết bị cũ mất quyền, nhưng an toàn server không phụ thuộc chờ heartbeat. Có thể giữ heartbeat 20 giây; UX takeover cần mục tiêu phát hiện riêng, ví dụ polling visible ≤10 giây.
- Tab bị background dừng/reduce polling; khi focus trở lại kiểm tra lease/version trước cho tiếp tục sửa. BFCache pageshow cũng phải revalidate.
- BroadcastChannel/storage events chỉ giúp các tab cùng origin; không coi chúng là kết nối qua Internet giữa PC và điện thoại.
- Không có thay đổi thì không đẩy toàn workspace và không tăng `lastModified` chỉ vì merge/read. Tránh vòng pull → timestamp mới → push → pull liên tục.
- Init phải trả disposer: cleanup interval/listener/channel và abort request khi logout/unmount/reset. Hiện `resetAutoSyncState()` chưa tháo các listener/interval do `initAutoSync()` tạo.

### Bước K — Kết quả sync chính xác và loại bỏ fallback thành công giả

Thay boolean chung bằng kết quả phân biệt `readSucceeded`, `writeAcknowledged`, `pendingWrites`, `updated`, `partial`, `errorCode`, `serverRevision` khi cần. Tối thiểu không dùng OR pull/push để quyết định mọi thứ đã lưu.

- Có local pending thì chỉ “đồng bộ hoàn tất” sau flush thành công và server ack tương ứng; partial/read-only success không được clear pending.
- Nếu push đang chạy, caller await cùng promise hoặc nhận queued/pending; không trả success tức thì chỉ vì `isPushing=true`.
- Nếu không có user/email/session, trả guest/not-authenticated/disabled rõ; không coi skip là cloud success.
- Remote trả `data:null` hợp lệ khác tất cả endpoint đều fail. Chỉ seed dữ liệu sau authenticated empty response và bootstrap phù hợp; seed phải được await/ack.
- Flush handler fail không bị nuốt rồi tiếp tục báo synced. Local cache update có thể emit event riêng nhưng không thay cloud state.
- Upstream auth/backend fail không fallback sang public KVDB hoặc memory để làm request thành công. Cache stale có thể dùng để đọc kèm source/stale label, không dùng làm write ack.
- GET/POST dữ liệu cá nhân phải xác thực và kiểm tra quyền server. Query email, deterministic key hoặc token suffix không phải bằng chứng account ownership.
- Loại đường ghi legacy trực tiếp bằng browser khỏi workflow production sau khi migration. Không xóa legacy data trong cùng bản vá.

## 7. Ma trận test bắt buộc

Fixture: account test A, account test B, project có 4 chương như ảnh, Chương 2 có content nền S0. Tạo hai browser context độc lập, PC và mobile, cùng server account A và cùng IDs. Không chia sẻ localStorage giữa contexts. Có server/DB thật ở môi trường test cho nhóm API; dùng request interception cho fault injection.

| ID | Ca kiểm thử | Kết quả phải đạt |
| --- | --- | --- |
| T01 | Không có public API_URL; same-origin proxy/capabilities có đủ API | Dùng được cloud, không tự banner offline. |
| T02 | Backend hoàn toàn chưa cấu hình | Báo unconfigured, giữ draft, không icon synced. |
| T03 | PC và mobile vào cùng Chương 2 đồng thời, lặp 20 lần | Một writer, một viewer; một active lock trong DB, không hai writer canonical. |
| T04 | A gõ và autosave; B đứng yên đang mở chương | B thấy đúng content/title/revision trong mục tiêu ≤10 giây mạng bình thường. |
| T05 | A sửa chương 2, B sửa chương 3 | Cả hai ack độc lập, không mất/chồng content hoặc cấu trúc thẻ. |
| T06 | B takeover; A gửi PATCH token cũ | Sau takeover commit, token cũ bị 423; draft A vẫn khôi phục được. |
| T07 | PATCH A và takeover B chạy sát nhau | Order commit hợp lệ; không có ghi vượt khóa sau takeover. |
| T08 | Heartbeat 20 giây, expiry 60 giây bằng clock điều khiển | Lock active trước expiry, hết hạn đúng; client không dựa clock local. |
| T09 | Điện thoại background >60 giây, mở lại | Revalidate trước sửa; có conflict thì giữ draft và recovery. |
| T10 | Ngắt mạng A, gõ, reload, mở lại | Nội dung mới khôi phục từ queue; UI local-saved, không cloud-saved. |
| T11 | A offline, B sửa canonical, A online lại | Cả hai bản còn nguyên; draft A không âm thầm ghi đè B. |
| T12 | Offline rồi online, canonical chưa đổi | Draft upload đúng một lần về mặt hiệu ứng, ack rồi clear pending. |
| T13 | Server commit PATCH nhưng response bị rớt | Retry/reconcile không tạo duplicate/recovery sai và không mất bản mới. |
| T14 | 401 token local giả và 401 token hết hạn | Auth-required đúng; không fallback thành session cloud thành công. |
| T15 | 403 ownership khác hoặc account B truy cập IDs của A | Không đọc/ghi được; log không lộ dữ liệu/credential. |
| T16 | 404 route; 404 record; 500 migration; 200 HTML; JSON thiếu lock | Phân loại đúng và không fabricated success/version. |
| T17 | Cross-origin OPTIONS có X-Chapter-Lock-Token từ Vercel hợp lệ | Preflight và PATCH thật thành công; origin không phép bị chặn. |
| T18 | Pull thành công, push thất bại; hoặc mọi endpoint fail | Không “Đồng bộ hoàn tất”; pending còn đủ. |
| T19 | Upstream storage trả 500/429; restart/cold start Next | Không ack giả; dữ liệu ack trước đó vẫn đọc được từ durable store. |
| T20 | Browser B gửi workspace snapshot cũ/không token khóa | Không thay canonical content hoặc resurrect deleted chapter. |
| T21 | Gõ N+1 khi save N đang in-flight và reload sau ack N | N+1 vẫn pending/khôi phục; không bị cache N xóa hoặc clear nhầm. |
| T22 | Gõ rồi chuyển chương trong <700ms; late response chương cũ | Mọi ký tự đã nhập giữ được; chương mới không bị refs/content/lock cũ tác động. |
| T23 | LocalStorage quota/denied/corrupt JSON | Không nói đã giữ draft nếu fail; có cách xuất nội dung đang ở RAM. |
| T24 | Recovery tạo lỗi, retry hai request song song; đủ 100 thẻ | Không duplicate, không mất draft; trạng thái chờ khôi phục rõ. |
| T25 | Xóa hết content hợp lệ; đồng hồ PC lệch ±10 phút | Xóa theo revision vẫn hội tụ; clock client không thắng canonical. |
| T26 | Hai bản legacy cùng ID khác content; import manifest hai lần | Giữ cả hai, mapping đúng, không duplicate hoặc bỏ bản ngắn hơn. |
| T27 | Đổi account trong khi request/draft đang pending | Draft A không hiện/gửi vào B; late response không ghi cache B. |
| T28 | Hai tab cùng máy và hai thiết bị, rồi logout/login 5 lần | Không nhân listener/timer, không bắn request từ account cũ. |
| T29 | Payload chương/workspace >64 KiB, pagehide trên mobile | Queue bền vững giữ đủ; không phụ thuộc keepalive lớn. |
| T30 | Đổi tên, di chuyển thẻ con, emoji, tombstone, wiki, timeline eras | Metadata giữ đủ, delete không resurrect; sync không mất nhóm dữ liệu cũ. |
| T31 | Mobile IME tiếng Việt đang composition, blur/pagehide | Không cắt dấu/ký tự; flush phản ánh document thực tế. |
| T32 | Poll liên tục 2 phút không edit; response out-of-order | Không push vòng lặp, không revision lùi, không toast spam. |
| T33 | Reload hai thiết bị sau khi được báo cloud-saved | Nội dung đã ack giống server; draft chưa ack vẫn tồn tại riêng. |

Test E2E dùng Playwright hoặc công cụ tương đương nếu repo bổ sung được. Viewport mobile chỉ kiểm tra layout; vẫn cần một lượt iOS Brave/Safari thực và PC browser thực cho lifecycle/CORS production. Không ghi “đã test điện thoại” chỉ dựa viewport giả lập.

## 8. Các file cần rà soát khi triển khai

| File/nhóm | Trách nhiệm thay đổi |
| --- | --- |
| `apps/web/lib/utils.ts` | Resolver, remote contract/error, phân biệt local guest/auth, không fallback sai. |
| `apps/web/lib/api-client.ts` | Client dùng resolver/token thống nhất. |
| `apps/web/lib/chapter-lock.ts` | Capabilities, draft journal, conditional clearing, recovery/idempotency, storage errors. |
| `apps/web/app/(dashboard)/editor/[projectId]/[chapterId]/page.tsx` | State machine, hydration/lease, autosave/ack, reconnect, bảo vệ late response. |
| `apps/web/components/editor/tiptap-editor.tsx` | Apply canonical ở viewer, không reemit remote thành local edit, flush/IME/read-only gates. |
| `apps/web/lib/sync.ts` | Kết quả sync, queue promises, không fallback giả, polling/disposer, pending protection. |
| `apps/web/lib/sync-core.ts` | Legacy merge chỉ dùng migration có bảo toàn; version canonical không phụ thuộc clock/độ dài. |
| `apps/web/components/layout/sync-provider.tsx` | Trạng thái cloud đúng ack, event local riêng. |
| `apps/web/lib/store.ts` | Session thống nhất, namespaces và logout/account switching. |
| `apps/web/app/api/sync/route.ts` | Proxy/canonical sync, durable ack, auth; bỏ memory success/fallback công khai. |
| Các route Next auth/projects/chapters mới | Proxy đầy đủ theo allowlist nếu chọn same-origin. |
| `functions/api/sync.ts` | Đồng contract nếu Pages còn hỗ trợ, không giữ behavior sai riêng. |
| `apps/api/src/routes/chapters.ts` | SQL lock/revision atomic, recovery unique/idempotent, ownership. |
| `apps/api/src/routes/sync.ts` | D1 canonical, snapshot không vượt khóa, storage error thật. |
| API auth/projects và middleware | Session, import account/project có ownership, CORS/config errors. |
| `apps/api/src/db/schema.ts`, migrations, shared schemas/types | Revision/op ID nếu thêm; backward compatibility có thời hạn. |
| Tests/package scripts/deploy docs | Regression thực, E2E, Vercel/Worker setup thay vì chỉ Pages. |

Đây là danh sách điểm kiểm tra, không yêu cầu sửa mọi file nếu bằng chứng và thiết kế không cần. AI phải ghi rõ file nào sửa, lý do và test xác minh.

## 9. Kiểm tra build và nghiệm thu

Chạy các lệnh đang có sau khi thay đổi, từ root repo:

```text
pnpm --filter web test
pnpm --filter web type-check
pnpm --filter api type-check
pnpm --filter web build
```

Thêm lệnh chạy integration API/E2E thật vào package scripts và chạy chúng. Ghi rõ test nào là mock, local DB, staging và thiết bị thật. `apps/api` hiện không có test script; phải bổ sung nếu cần test endpoint thực. `pnpm --filter api build` hiện chỉ in “api ready”, không phải kiểm tra backend compile/runtime.

Nếu type-check/build có lỗi tồn tại trước sửa, lưu baseline và phân biệt lỗi mới; không bỏ lỗi bằng `any`, disable auth, bỏ lock/version hoặc tắt strict mode. Không coi “99 test cũ pass” là chứng minh lỗi hai thiết bị đã hết.

Definition of Done:

1. Có trace chứng minh nguyên nhân production hoặc ghi rõ chưa được truy cập môi trường đó.
2. Hai thiết bị cùng identity/IDs dùng được API; không hiện offline do thiếu biến client khi same-origin API có sẵn.
3. Một writer/một viewer cùng chương; hai writer ở hai chương độc lập được hỗ trợ.
4. Viewer thấy đúng revision đã ack trong mục tiêu polling; không phải reload thủ công.
5. Cloud-saved gắn với durable ack và đúng phiên bản; lỗi auth/config/server không ngụy trang thành offline.
6. Có chứng cứ nội dung PC và điện thoại trước sửa đều còn khôi phục được.
7. Offline/reconnect/takeover/timeout/reload không mất ký tự hoặc ghi vượt khóa.
8. Canonical chapter có một nguồn chính thức; snapshot sync không thể ghi đè ngoài contract.
9. Test mới phát hiện được lỗi trước sửa, pass sau sửa, và có lượt thiết bị thực.
10. Môi trường production có đúng routes, bindings, env và migrations; cold start/read-back không mất dữ liệu đã ack.

## 10. Triển khai và rollback

1. Tạo patch nhỏ, review được theo nhóm: quan sát lỗi/tests → endpoint/auth/config → canonical storage/import → lock/save/reconnect → UI/polling → E2E/deploy docs.
2. Chạy staging với account/project test trước; chỉ dùng dữ liệu truyện thật khi đã backup và importer dry-run cho ra manifest đúng.
3. Schema mới nên additive và có compatibility rõ với client cũ. Đừng dùng cột bắt buộc mới rồi deploy frontend trước backend.
4. Deploy backend/routes tương thích trước, migration đã xác minh, frontend sau; ghi build/version protocol để biết hai thiết bị đang chạy gì.
5. Bật luồng mới có feature flag nếu cần. Không dual-write content vào D1/KVDB như hai nguồn có quyền ngang nhau.
6. Thực hiện PC–điện thoại smoke test: mở cùng chương, gõ, chờ ack/viewer, takeover, offline/reconnect và reload. Chỉ dùng một domain production cố định để tránh cache local thuộc origin khác.
7. Theo dõi tỷ lệ auth lỗi, CORS, lock conflict, save failures, pending tuổi lớn và poll latency. Không theo dõi raw content/credential.
8. Nếu rollback frontend/backend, giữ migration additive, canonical data mới, journal và backup. Rollback không được làm client cũ ghi snapshot legacy đè canonical mới; nếu cần, giữ endpoint compatibility hoặc chặn đường write cũ với thông báo rõ.
9. Sau rollout thành công mới lên việc dọn legacy riêng. Không gộp xóa backup/KVDB vào fix đầu tiên.

## 11. Báo cáo AI triển khai phải bàn giao

- Nguyên nhân đã xác minh và trace minh họa trước/sau; giả thuyết chưa xác minh để riêng.
- Kiến trúc/endpoint/account/storage được chọn; các fallback đã xử lý thế nào.
- File sửa và migration/env cần áp dụng đúng deployment.
- Kết quả tests theo T01–T33, phân biệt tự động với thiết bị thật, kèm build/server revision.
- Đối chiếu dữ liệu trước/sau bằng count/hash, vị trí hai bản khôi phục PC/điện thoại.
- Phần còn phụ thuộc quyền truy cập production hoặc migration account; không ghi đã fix production nếu mới sửa local.
- Hướng rollout và rollback cụ thể, không xóa bản nháp người dùng.

## 12. Tài liệu kỹ thuật đối chiếu

- [Next.js: Environment Variables](https://nextjs.org/docs/app/guides/environment-variables): biến `NEXT_PUBLIC_*` được inline lúc build; cần kiểm tra bundle/rebuild nếu thay cấu hình này.
- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS): request có header/method cần preflight phải được server cho phép đúng; đây là cơ sở kiểm tra header lock.
- [Cloudflare KV: Write key-value pairs](https://developers.cloudflare.com/kv/api/write-key-value-pairs/): concurrent writes cùng key có thể ghi đè; không dùng snapshot KV làm cơ chế khóa/commit chương.
- [Cloudflare KV: Read key-value pairs](https://developers.cloudflare.com/kv/api/read-key-value-pairs/): dữ liệu đọc có thể trễ theo caching/eventual consistency; polling nhanh hơn không tự bảo đảm đọc ngay bản mới.

## 13. Prompt giao việc có thể dùng nguyên văn

Bạn hãy triển khai bản sửa lỗi đồng bộ PC–điện thoại trong repo này theo `SYNC_FIX_PLAN_PC_MOBILE.md`. Hai thiết bị cùng có Internet và cùng mở thẻ tên Chương 2 nhưng đều hiện banner ngoại tuyến và có nội dung khác nhau. Đọc plan, kiểm tra lại mã nguồn hiện tại và chẩn đoán bằng request/config/auth/storage trước khi kết luận nguyên nhân. Bảo toàn riêng dữ liệu PC, điện thoại và server; giữ cả hai bản nháp khi không đủ base version để tự reconcile. Ưu tiên kiến trúc khóa một thiết bị sửa một chương đã có trong repo, cho thiết bị còn lại xem dữ liệu mới; không tự đổi sang collaborative CRDT. Sửa đầy đủ luồng endpoint, auth, CORS/deploy, nguồn dữ liệu canonical, lock/version atomic, autosave/ack, reconnect/recovery và trạng thái UI theo bằng chứng. Thêm regression/integration/E2E có hai browser context độc lập và fault injection; test phải gọi implementation thật. Bàn giao patch, test result, migration/env checklist, bằng chứng bảo toàn nội dung và hướng rollout/rollback. Phân biệt rõ sửa local/staging với xác minh production và thiết bị thật; không coi test cũ pass hoặc icon cloud xanh là bằng chứng đồng bộ đã hoạt động.
