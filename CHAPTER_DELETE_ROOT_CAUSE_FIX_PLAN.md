# Kế hoạch sửa tận gốc lỗi chương bị xóa rồi xuất hiện trở lại

Ngày lập: 05/10/2026. Dành cho AI triển khai trong repository `novelist-app`.

## 1. Nhiệm vụ và phạm vi

Sửa lỗi: người dùng xóa chương/thẻ, giao diện báo thành công, nhưng vài giây sau chương xuất hiện lại khi đồng bộ. Phải sửa cả chương thường và chương có tên “Khôi phục”.

Đây là kế hoạch dựa trên mã nguồn đã đọc, chưa phải bản sửa đã triển khai. Không có log production, bản chụp D1 hay Network trace của phiên trong ảnh. Các đường gây lỗi dưới đây đã được xác định trong mã hiện tại; AI triển khai phải xác nhận bản production đang chạy cùng đường xử lý trước khi kết luận chính xác đường nào gây ra lần lỗi trong ảnh.

Kết quả bắt buộc: **một ID đã được máy chủ xác nhận xóa không được trở lại danh sách chương đang hoạt động qua snapshot cũ, autosave, retry, cache, thiết bị offline, hoặc recovery tự động.** Nội dung nháp chưa đồng bộ được giữ trong vùng lưu trữ riêng nếu cần; việc giữ nội dung không tự tạo lại chương trong tài liệu.

Không sửa bằng cách tắt đồng bộ, tăng thời gian polling, chỉ lọc trên UI, ép reload, hoặc yêu cầu người dùng xóa cache. Không tự xóa hàng loạt những chương có cùng tên/nội dung.

## 2. Bằng chứng và chẩn đoán

### 2.1. Quan sát từ ảnh

- Ảnh đầu: thông báo “Đã xóa chương”, tài liệu có 5 chương và 18.303 từ.
- Ảnh sau: trạng thái “Đang đồng bộ…”, tài liệu có 7 chương và 36.605 từ.
- Nhiều chương “Khôi phục – Chương 1 – Máy tính/Điện thoại · Chrome …” cùng có 9.151 từ.
- Chênh lệch 18.302 từ bằng hai bản 9.151 từ. Điều này phù hợp với hai bản nội dung được đưa lại vào danh sách, nhưng ảnh không cung cấp ID để chứng minh chúng là bản cũ được chèn lại hay recovery mới.
- Phải phân biệt hai lỗi: **cùng ID sống lại** và **một recovery tương đương được tạo dưới ID khác**. Bản sửa phải chặn cả hai trong trường hợp retry cùng thao tác.

### 2.2. Lỗ hổng đã xác nhận trong mã

| Vị trí hiện tại | Hành vi | Hệ quả |
| --- | --- | --- |
| `apps/api/src/routes/chapters.ts:554` | DELETE xóa vật lý chapter, scenes, revisions; trả `{ success: true }`; không ghi tombstone bền vững trong D1 | Máy chủ quên ID này đã từng bị xóa |
| `apps/api/src/routes/sync.ts:219` | POST sync gặp chapter không có trong D1 thì insert như chương mới, trước khi có kiểm tra dấu xóa bền vững | Snapshot cũ chèn lại chương đã xóa |
| `apps/web/lib/utils.ts:1648` | `apiFetch` thành công từ remote thì trả dữ liệu ngay | DELETE thành công không chạy nhánh local để xóa cache/ghi tombstone |
| `apps/web/lib/utils.ts:1009` | Chỉ nhánh DELETE local ghi tombstones rồi loại chương khỏi `novelist_chapters` | Đường online và local có ngữ nghĩa xóa khác nhau |
| `apps/web/app/(dashboard)/editor/[projectId]/page.tsx:273` | Sau DELETE, gọi `fetchData()` và `pushSync()` mà không await `fetchData()`; không cập nhật dấu xóa/cache cục bộ | Push có thể gửi chính snapshot local còn chương vừa bị xóa; kể cả await fetch, hàm này chỉ cập nhật React state nên vẫn chưa sửa cache |
| `apps/web/lib/sync-core.ts:344` | Chương có `updatedAt > deletedAt` được phép tồn tại dù có tombstone | Autosave muộn, timestamp được nâng, đồng hồ thiết bị lệch có thể thắng thao tác xóa |
| `apps/web/lib/sync-core.ts:321` | Bỏ tombstone sau 30 ngày | Thiết bị offline lâu hoặc backup cũ có thể đưa ID trở lại |
| `apps/web/lib/sync.ts:185` | Bảo vệ chương đang sửa bằng cách đưa local chapter vào merged result, kể cả khi không còn trong kết quả merge | Cơ chế bảo vệ nội dung có thể đưa chương đã xóa trở lại cache |
| `apps/web/lib/chapter-lock.ts:279` | `cacheRemoteChapter` thêm chapter khi ID chưa có trong cache, không xét dấu xóa | Phản hồi GET/PATCH/recovery đến muộn có thể tái thêm chương |
| `apps/api/src/routes/chapters.ts:267` | Recovery chỉ idempotent khi chapter có `recoveryId` còn tồn tại | Xóa recovery rồi retry cùng recoveryId có thể tạo lại nếu source còn tồn tại |
| `apps/api/src/routes/sync.ts:257` | Recovery từ lock conflict dùng ID có timestamp máy chủ | Retry cùng snapshot khác thời điểm có thể sinh nhiều recovery |
| `apps/web/app/(dashboard)/editor/[projectId]/[chapterId]/page.tsx:850` | UI DELETE lần lượt các descendants rồi DELETE cha; máy chủ cũng cascade | Có thể xóa một phần, phát sinh nhiều request/race không cần thiết |
| `apps/web/app/(dashboard)/editor/[projectId]/[chapterId]/page.tsx:722` | Điều hướng thông thường gọi save khi dirty; sau xóa dùng lại hàm này | Có đường save sau DELETE; cần kiểm tra theo trạng thái editor thực tế |
| `apps/api/src/routes/sync.ts:133` | Nếu D1 không có chapter thì GET sync dùng chapter từ KV | Kết quả rỗng có chủ ý có thể bị hiểu thành thiếu dữ liệu để fallback |
| `apps/web/lib/sync.ts:336` | Nếu đang push, trả `{ success: true }` ngay | Push sau DELETE có thể bị bỏ qua nhưng UI vẫn nhận kết quả như đã ack |
| `apps/web/lib/sync.ts:711` | Poll khi active mỗi 8 giây, ngoài ra pull khi focus/visibility | Giải thích được việc danh sách thay đổi vài giây sau xóa; không phải nguyên nhân cần sửa bằng cách tăng interval |

Số dòng là điểm tham chiếu của mã tại ngày lập kế hoạch; tìm theo tên hàm khi mã đã thay đổi.

### 2.3. Chuỗi gây lỗi chính

```text
Local snapshot vẫn chứa chapter C
    → DELETE C thành công ở D1, không có sổ dấu xóa
    → push từ PC hoặc điện thoại gửi C trong snapshot cũ
    → POST /api/sync thấy C không có trong D1
    → insert C như chapter mới
    → pull/event/fetch lại danh sách
    → C xuất hiện lại và số từ tăng
```

Chuỗi recovery riêng:

```text
Recovery R đã được tạo từ draft D
    → người dùng xóa R
    → thiết bị còn pending recovery D do chưa nhận được response
    → retry POST recoveries với cùng R
    → server chỉ kiểm tra bảng chapters, không thấy R
    → tạo lại R
```

Một chuỗi khác: repeated workspace push gặp lock conflict → server tạo recovery mới có timestamp khác → xóa recovery trước đó không chặn lần tạo mới tương đương.

### 2.4. Những gì đã chạy để kiểm chứng

Đã gọi trực tiếp `mergeWorkspaces` thật trong `apps/web/lib/sync-core.ts` với ba đầu vào:

1. Local bỏ C nhưng không có tombstone; remote giữ C → C trở lại.
2. Local có tombstone; remote có C với timestamp sau tombstone → C trở lại.
3. Tombstone 31 ngày, remote giữ C từ 32 ngày trước → dấu xóa bị bỏ và C trở lại.

Đã chạy chọn lọc 5 test hiện hữu và cả 5 pass. Chúng chưa chứng minh luồng DELETE → stale POST sync an toàn:

- Test “Recreating or editing a chapter after deletion timestamp permits the newer version” đang yêu cầu cho phép phục sinh theo timestamp.
- Test “Pruning tombstones older than 30 days keeps payload clean” đang yêu cầu loại dấu xóa sau 30 ngày.
- T20 có tên nhắc đến resurrect nhưng thân test chỉ kiểm tra PATCH không có lock token bị 423.
- T30 có tên nhắc đến tombstone nhưng thân test chỉ cập nhật/check emoji và parentId.
- Integration hiện hữu dùng mô phỏng server bằng SQLite, không dispatch request tới các Hono route production.

Lệnh đã chạy thành công trên Node v24.21.0:

```text
node --test --test-isolation=none --test-name-pattern="Deleting a chapter on PC|Recreating or editing a chapter after deletion|Pruning tombstones older|T20:|T30:" apps/web/lib/qa-verification.test.mjs apps/web/lib/sync-pc-mobile-integration.test.mjs
```

Lần chạy test runner mặc định gặp `spawn EPERM` trong sandbox; chạy không tách process đã giải quyết. Đây không phải lỗi sản phẩm. Root package khai báo Node 20.x, trong khi integration dùng `node:sqlite`; AI triển khai phải thống nhất runtime kiểm thử hỗ trợ module này hoặc thay adapter, không ghi “test pass” nếu suite chưa thực sự chạy.

## 3. Quyết định kiến trúc cần giữ xuyên suốt bản sửa

### 3.1. D1 lưu trạng thái tồn tại/xóa của chương

Giữ mô hình chapter active trong bảng `chapters`, nhưng thêm **sổ dấu xóa bền vững trong D1**. Hard delete chapter phải đi cùng việc ghi sổ này trong cùng thao tác nguyên tử. KV/localStorage chỉ giữ bản sao của trạng thái đó.

Quy tắc lifecycle:

- ID chưa từng bị xóa có thể được tạo qua luồng tạo/import được hỗ trợ.
- ID đã bị xóa là ID đã đóng; snapshot hay save thông thường không được mở lại.
- Nội dung mới hơn, nhiều từ hơn, hoặc timestamp trong tương lai không làm vô hiệu dấu xóa.
- Nếu sau này có tính năng khôi phục thủ công, mặc định tạo ID mới bằng thao tác rõ ràng. Không bổ sung tính năng restore vào bản sửa này nếu chưa cần.
- Xóa cha phải ghi dấu xóa cho toàn bộ descendants. Chương mới không được tạo/di chuyển vào parent hoặc project đã xóa.
- Dấu xóa lịch sử trên server không bị xóa sau 30 ngày. Chỉ được compact khi có cơ chế epoch/full-resync thực sự chặn mọi client cũ. Chưa có cơ chế đó thì giữ dấu xóa.

### 3.2. Thứ tự ưu tiên

```text
Server tombstone đã commit
    > pending delete cục bộ
    > bảo vệ nội dung đang sửa
    > snapshot/cached chapter
```

`protectedChapterIds` chỉ bảo vệ nội dung của chapter còn hoạt động; không bảo vệ sự tồn tại của chapter đã bị xóa.

### 3.3. Trạng thái delete và trạng thái save tách riêng

- Delete online chỉ báo hoàn tất khi nhận ack sau commit D1.
- Delete offline có thể ẩn cục bộ nhưng phải hiển thị “Đã xóa trên thiết bị, đang chờ đồng bộ”.
- Pending delete không phải server tombstone; server phải kiểm tra quyền, lock, và tối thiểu một thẻ trước khi commit.
- Không gửi local timestamp như quyền quyết định xóa trên server.
- Trạng thái synced phải gắn với mutation đã ack; một GET thành công không xác nhận tất cả writes đã commit.

### 3.4. Recovery có danh tính thao tác bền vững

Mỗi draft xung đột có một danh tính được lưu trước khi gửi. Retry cùng draft không tạo thêm chapter. Xóa recovery là kết thúc lifecycle của recovery đó; retry thao tác cũ không được làm nó trở lại dưới cùng ID hoặc ID mới.

## 4. Giai đoạn A — Xác nhận deployment và tái hiện có kiểm soát

1. Xác định endpoint thực tế cho DELETE, GET chapters, POST/GET sync, POST recoveries; xác định cùng user, cùng Worker, cùng D1. Không in token hay nội dung tiểu thuyết vào log.
2. Kiểm tra cấu hình deployment Vercel trong ảnh: Next `/api/sync` hiện proxy sang Worker nếu có `API_URL` hoặc `NEXT_PUBLIC_API_URL`. Repository còn `functions/api/sync.ts` cho Pages với merge riêng; không giả định nó đang phục vụ production.
3. Xác định API local fallback có đang hoạt động do 404, mất mạng hoặc `UNCONFIGURED` hay không. Phân biệt route không tồn tại với entity đã xóa.
4. Dùng tài khoản/dữ liệu kiểm thử: một project P, C1 có nội dung khác biệt, C2, recovery R từ C1, parent có child và grandchild; giữ một thẻ ngoài subtree để hợp lệ khi xóa.
5. Tạo hai browser context độc lập A/B cùng user. B giữ snapshot trước xóa. A xóa R hoặc C2; sau ack, B POST snapshot cũ.
6. Chụp bằng chứng gồm requestId, chapterId, recoveryId/draftId, response status, mutation revision, thời điểm dispatch/commit, danh sách ID trong D1 và cache. Chỉ hash nội dung để so sánh.
7. Thêm test tái hiện gọi route thật trước khi sửa. Test DELETE C → stale POST sync → GET C phải thất bại với mã hiện tại vì C đã được chèn lại.

Đầu ra: một reproduction script/test kiểm soát được thứ tự request và báo cáo phân biệt “resurrected ID” với “duplicate recovery”. Không dùng thời gian chờ ngẫu nhiên để làm race test.

## 5. Giai đoạn B — Schema và invariant tại cơ sở dữ liệu

### 5.1. Migration mới

Thêm migration sau `0002_chapter_edit_locks.sql`; không sửa lịch sử migration đã chạy. Đồng bộ `schema.ts` và loader migration của test.

Đề xuất bảng `entity_tombstones`:

| Trường | Mục đích |
| --- | --- |
| `user_id` | Phạm vi chủ sở hữu |
| `entity_type` | `chapter` hoặc `project` |
| `entity_id` | ID đã đóng |
| `project_id` | Tra cứu dấu xóa theo tài liệu, có thể null cho project |
| `deleted_at` | Thời gian máy chủ, dùng audit/hiển thị |
| `delete_operation_id` | Idempotency và nhóm các ID cascade |
| `deleted_revision` | Revision máy chủ tại commit |

Unique key `(user_id, entity_type, entity_id)`; index theo `(user_id, deleted_revision)` và `(user_id, project_id)`. Không đặt FK cascade từ dấu xóa chapter tới chapter/project bị xóa: dấu xóa phải sống lâu hơn entity.

Thêm bảng `workspace_sync_state` với `user_id`, `revision`. Revision tăng khi có mutation được commit; GET/poll không làm tăng revision.

Thêm bảng `recovery_operations` để giữ idempotency kể cả khi recovery chapter đã bị xóa:

- `user_id`, `operation_key` unique, `source_chapter_id`, `source_base_revision` hoặc version nền hiện có.
- `draft_id`, `payload_hash`, `recovery_chapter_id`, `state` (`created`/`deleted`), `created_at`, `deleted_at`.
- Hash phải bao gồm đủ payload có ý nghĩa, tối thiểu content, title và source; không chỉ hash title.
- Nếu một operation key được dùng lại với payload khác, trả 409, không giả vờ đã lưu nội dung mới.

### 5.2. Guard chống race ở write time

Không chỉ SELECT tombstone ở JavaScript rồi INSERT: DELETE có thể commit giữa hai bước đó.

Triển khai guard trong SQL tại thời điểm INSERT/UPDATE, hoặc trigger database tương đương đã được test trên D1 local. Guard tối thiểu:

- Không insert chapter mang ID có dấu xóa của chủ sở hữu project.
- Không insert/update chapter vào project đã xóa.
- Không insert hoặc reparent vào parent đã xóa, không tồn tại, hoặc thuộc project khác.
- Không insert project mang ID có dấu xóa.
- Save/reorder/recovery kiểm tra lifecycle và lock/version trong chính thao tác ghi, tránh race sau preflight.

Có thể dùng `INSERT ... SELECT ... WHERE NOT EXISTS (...)` và cập nhật có điều kiện, kiểm tra số hàng affected; hoặc trigger `RAISE(ABORT, ...)`. Phải xử lý kết quả zero rows như thao tác bị từ chối. Một câu SQL no-op không tự gây rollback cho các câu khác trong batch.

Nếu dùng trigger, kiểm thử phạm vi ownership đúng và ánh xạ lỗi nội bộ thành mã `CHAPTER_DELETED`/`PARENT_DELETED`, không trả một thông báo thành công chung.

## 6. Giai đoạn C — DELETE nguyên tử và idempotent

Sửa `deleteChapterHandler` và reuse service này cho tất cả entrypoint xóa chương.

Luồng yêu cầu:

1. Xác thực user; lấy operationId từ client hoặc tạo trên server theo contract tương thích.
2. Nếu ID đã có tombstone thuộc user này: trả ack thành công với dữ liệu lần xóa trước; không trả 404 khiến client retry/fallback sai.
3. Nếu ID không tồn tại và không có tombstone của user: trả 404; không tự nhận là xóa thành công. Không tiết lộ entity của user khác.
4. Lấy subtree từ D1 theo project, chống vòng lặp/parent hỏng. Không tin danh sách cascade client tự tính.
5. Kiểm tra còn ít nhất một chapter sau khi xóa và lock của tất cả chapter bị tác động, giữ quy tắc hiện tại đối với lock của thiết bị khác.
6. Commit trong batch: ghi tombstones cho root + descendants; đánh dấu recovery operations liên quan tới recovery bị xóa; xóa scenes/locks/revisions theo policy hiện tại; xóa chapter; tăng workspace revision; cập nhật metadata dẫn xuất cần thiết.
7. Trả ack chỉ sau khi D1 commit. Cache KV lỗi không làm đảo ngược dấu xóa đã commit; có thể retry cache riêng.

Cloudflare D1 `batch()` hỗ trợ nhóm statement theo transaction và rollback khi statement thất bại. Tuy nhiên reads/checks ở JavaScript trước batch không được bảo vệ bởi transaction đó. Chốt subtree, điều kiện tối thiểu một thẻ và điều kiện lock bằng guarded SQL/version check tại commit; nếu dữ liệu đổi thì trả conflict hoặc retry toàn bộ preflight. Không chia cascade thành nhiều batch độc lập rồi báo một success. [Tài liệu D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).

Trường hợp lock/token thay đổi giữa preflight và commit cũng phải được kiểm tra lại. Không gọi một SELECT lock trước batch rồi mặc định quyền xóa vẫn hợp lệ.

Contract đề xuất:

```json
{
  "success": true,
  "operationId": "delete-operation-id",
  "deletedIds": ["root-id", "child-id"],
  "deletedAt": 1790000000000,
  "workspaceRevision": 42,
  "tombstones": { "root-id": 1790000000000, "child-id": 1790000000000 },
  "alreadyDeleted": false
}
```

Giữ `tombstones: Record<string, number>` nếu cần tương thích client v2, nhưng lifecycle trên server không dựa vào so sánh timestamp này. Có thể trả thêm `deletions` dạng đầy đủ ở protocol mới.

Nếu response bị mất sau commit: retry operation cũ phải trả ack cũ. Không tăng revision vô ích, không tạo recovery mới, không thay ID.

Sửa tối thiểu luồng xóa project theo cùng policy vì POST sync hiện cũng có thể tạo lại project không còn trong D1. Một project sống lại có thể mở đường cho các chapter cũ quay lại. Không cần viết lại toàn bộ CRUD unrelated.

## 7. Giai đoạn D — POST/GET sync phục tùng trạng thái xóa

### 7.1. POST sync

1. Đọc các dấu xóa authoritative theo user/project từ D1, áp dụng trước xử lý incoming projects/chapters/recovery.
2. ID incoming đã deleted: không insert, không update, không tạo recovery active từ chính ID đó. Đưa vào `rejectedEntities` với reason rõ ràng.
3. Incoming trỏ project/parent deleted: không chuyển ngầm sang project đầu tiên. Trả rejected/conflict; giữ dữ liệu nháp ở phía client.
4. Chỉ tạo chapter mới khi ID chưa từng bị xóa, project hợp lệ và policy tạo/import cho phép. Duy trì hỗ trợ tạo offline thật; không suy ra delete chỉ vì ID vắng mặt trong snapshot.
5. Nếu client gửi pending delete, xử lý như operation có quyền và validation đầy đủ; không trực tiếp biến mọi tombstone client gửi thành dấu xóa authoritative.
6. Lọc chapter/metadata theo lifecycle trước merge rồi lọc lại kết quả cuối, để mọi nhánh helper đều chịu invariant.
7. Dùng SQL guard trong từng write để bảo vệ race với DELETE concurrent.
8. Thay `.catch(() => {})` trên các mutation quyết định success bằng lỗi có cấu trúc hoặc per-entity result. Không thêm vào map “đã insert” khi insert thực tế thất bại.
9. Phân biệt ack chấp nhận toàn bộ writes với response partial. Snapshot cũ bị reject vì chapter deleted phải được client xử lý terminal, không đưa vào retry vòng lặp.

`mergeSyncSnapshots` hiện chỉ xét tombstone theo timestamp ở metadata/KV và `canonicalPayload` sau đó thay chapters bằng D1. Sửa cuối merge không đủ nếu chương đã được insert vào D1 ở đầu handler.

Contract sync đề xuất có `workspaceRevision`, authoritative tombstones, `acceptedOperations`, `rejectedEntities`, `protocolVersion`. Không cần chuyển mọi entity sang operation log để sửa bug này; ưu tiên lifecycle của chapter/project, delete và recovery.

### 7.2. GET sync và các GET chapters

- D1 là nguồn active chapters authoritative, kể cả khi kết quả là `[]`.
- Bỏ fallback “D1 rỗng → lấy KV chapters” trong tài khoản đã được quản lý bằng D1.
- Tombstones trả từ D1; KV không phải nguồn duy nhất của dấu xóa.
- Read active rows, revision và dấu xóa thành snapshot nhất quán. Nếu GET trùng DELETE, có thể trả snapshot trước commit, nhưng response phải mang revision tương ứng để client nhận biết cũ.
- Tất cả GET/list/statistics/export phải dựa trên active chapters đã qua cùng invariant.
- KV dùng làm cache; response từ cache phải có revision và được đối chiếu với trạng thái authoritative trước khi được dùng để ghi lại D1.
- Cloudflare Workers KV có eventual consistency; không thể dùng một bản KV đọc ra để phủ nhận dấu xóa vừa commit tại D1. [Tài liệu Workers KV](https://developers.cloudflare.com/kv/concepts/how-kv-works/).

Nếu có D1 read replicas trong deployment, xác nhận read-after-write/session policy trước khi dùng GET làm bằng chứng ack. Không coi việc “chờ vài giây” là bảo đảm đúng.

### 7.3. Đường sync legacy

- Rà `functions/api/sync.ts` vì nó có bản merge riêng và PUT vào nhiều key KVDB.
- Rà direct KVDB fallback trong `pullSync` và backup import/reconcile.
- Không tự động lấy snapshot legacy khi primary lỗi rồi push lại như trạng thái authoritative của tài khoản đã migrate.
- Dùng trạng thái migration/protocol/epoch rõ ràng. Legacy source chỉ là dữ liệu phục hồi có kiểm soát, phải đối chiếu tombstones trước khi nhập.
- Nếu Pages Function còn active, chuyển nó sang cùng service authoritative hoặc làm read-only legacy; không duy trì hai quy tắc xóa khác nhau.

## 8. Giai đoạn E — Recovery không tái sinh và không nhân bản

### 8.1. Client recovery

Sửa `PendingRecovery`, `persistLocalChapterDraft`, `createRecoveryChapter`, `retryPendingRecoveries` và editor:

1. Draft có `draftId` và local revision được lưu bền vững trước request đầu tiên. Giữ nguyên danh tính khi timeout/reload/retry cùng draft.
2. Khi payload thay đổi thật, tạo operation khác hoặc version khác có chủ đích; không dùng lại operationId với content mới rồi clear draft như đã ack.
3. Recovery operation key server tính/validate theo user + source + base version + draft identity + payload hash. Không sinh key bằng `Date.now()` mỗi lần retry.
4. Pending recovery có trạng thái `queued`, `inFlight`, `acknowledged`, `cancelledByDeletion` hoặc tương đương; chapterId và recoveryId đều được xét.
5. Sau delete ack của recovery R: hủy retries trỏ tới R/operation của R. Nếu source C đã deleted, hủy auto-recovery từ C và giữ nội dung riêng ở archive nếu có.
6. Khi nhận 410/`RECOVERY_DELETED`, kết thúc retry; không đổi recoveryId để thử lại. Chỉ chuyển sang retry khi lỗi tạm thời.
7. Response recovery đến muộn phải qua cùng cache gate dấu xóa/revision; không gọi `cacheRemoteChapter` vô điều kiện.
8. Clear pending draft có điều kiện theo draftId/local revision/payload đã ack, tránh xóa draft mới hơn.

### 8.2. Server recovery

- Tra `recovery_operations` trước tạo chapter.
- Operation đã created và chapter active → trả cùng chapter, không tạo bản thứ hai.
- Operation/recovery đã deleted → trả 410 với reason terminal, không tạo lại.
- Source chapter deleted → trả terminal; việc còn nội dung trong body không cho phép tạo active recovery.
- Create chapter + operation + revision phải atomic. Request concurrent cùng key chỉ một lần tạo thành công.
- DELETE recovery cập nhật state operation cùng transaction xóa.
- Không dùng recoveryId bị truncate như khóa chống trùng duy nhất; dùng operation key/hash đầy đủ với unique constraint.

### 8.3. Workspace sync lock conflict

Hiện tại server tạo recovery từ bất kỳ content/title khác canonical khi lock held by other. Một snapshot cũ khác nội dung không tự chứng minh có draft mới cần cứu.

Sửa policy:

- Snapshot cache cũ không có pending draft/base version → reject/reconcile với canonical, không tự tạo recovery mỗi lần polling/push.
- Draft xung đột thật có danh tính/version/payload → chuyển qua cùng recovery service idempotent.
- Thiết bị legacy chưa có draft metadata: giữ snapshot/nội dung ở kho phục hồi riêng hoặc quarantine có dedupe, không tạo chapter active lặp lại để “chống mất dữ liệu”.
- Không ghép text xung đột vào chương chính hoặc dùng độ dài nội dung làm bằng chứng restore.
- `reconcileDeviceBackups` phải xét tombstone và operation identity khi import. Việc xây preview từ backup không được tự đưa chương deleted vào active workspace.

## 9. Giai đoạn F — Luồng xóa frontend duy nhất

Tạo service dùng chung cho xóa ở trang tổng quan và sidebar/editor, thay vì hai implementation độc lập.

### 9.1. Trước khi gửi DELETE

1. Ghi pending operation theo user/project/chapter và operationId vào kho bền vững, nếu không ghi được thì không tự báo đã queue offline.
2. Đặt chapter/subtree ở trạng thái `deleting`; khóa các hành động save/recovery/reorder với những ID này.
3. Nếu editor có nháp chưa ack, giữ nháp trong archive riêng trước khi retire; không tự tạo recovery active khi người dùng đang xóa.
4. Ngắt timer autosave, heartbeat, flush handler, retry đang chờ. Abort network nếu có thể, nhưng server vẫn phải có guard vì abort không thu hồi một write đã commit.
5. Chỉ gửi **một DELETE root**; server tự cascade. Client có thể ẩn subtree dự kiến, nhưng kết quả ack server quyết định `deletedIds` cuối cùng.

### 9.2. Sau delete ack

Áp dụng một mutation cục bộ chung:

- Ghi confirmed tombstones và revision đã ack trước khi bất kỳ response cũ nào được phép ghi lại chapter.
- Loại tất cả `deletedIds` khỏi chapter cache, React state/store, sidebar tree, selection, derived project counters.
- Loại các ID khỏi `protectedChapterIds`, sync flush handlers và active editor refs.
- Hủy pending save/recovery theo lifecycle; giữ bản archive tách riêng nếu cần.
- Broadcast thông điệp `CHAPTERS_DELETED` có userId, projectId, deletedIds, revision, operationId tới tab khác; storage listener cần xét tombstone/delete operations, không chỉ chapters/projects.
- Chuyển sang thẻ còn tồn tại hoặc trang project bằng đường điều hướng dành cho delete, **không autosave chapter vừa deleted**.
- Hoàn tất operation rồi mới cho UI báo “Đã xóa chương”.

Không cần chờ KV hoặc toàn bộ sync thế giới mới báo thành công; ack D1 và việc áp dụng local đủ, vì stale writes đã bị server chặn.

### 9.3. Khi lỗi hoặc mất mạng

- 400/403/409/423 là business failure: bỏ optimistic deletion theo operation tương ứng, tải authoritative state, thông báo lỗi; không ghi confirmed tombstone.
- Mất response không có nghĩa DELETE chưa commit. Retry cùng operationId để reconcile; không tự restore cache chỉ vì timeout.
- Nếu hỗ trợ offline delete: giữ `pendingDelete`, ẩn cục bộ, replay operation khi online; nếu server từ chối thì xử lý rõ ràng.
- Nếu sản phẩm chưa hỗ trợ offline delete: dùng remote-only API cho DELETE và báo chưa xóa được. Không mô phỏng remote success.
- 404 từ entity deleted phải khác route missing; không fallback local silent cho destructive operation ở tài khoản remote.
- Namespace pending drafts, recoveries, deletes và revision theo user. Logout/chuyển tài khoản không được gửi queue của user trước dưới token user sau; callback in-flight cũng phải kiểm tra account/session generation.

## 10. Giai đoạn G — Chặn mọi response cũ ghi ngược trạng thái

### 10.1. Một gate chung cho cache/import

Thiết kế helper dùng bởi `importFullWorkspace`, `cacheRemoteChapter`, GET list, PATCH ack, recovery ack, backup import:

```text
applyRemoteState(response, requestContext):
    xác nhận user/project/session hiện tại
    xét revision và generation của request
    hợp nhất confirmed tombstones, không làm mất dấu xóa đã biết
    loại confirmedDeleted và pendingDelete IDs khỏi active result
    bảo vệ nội dung draft chỉ với ID còn active
    ghi cache và phát event từ kết quả đã qua gate
```

Không chỉ sửa `mergeWorkspaces`: nhiều đường hiện ghi cache trực tiếp, và nhánh protected chapters có thể thêm lại sau merge.

### 10.2. Request generation và revision

- GET phát trước DELETE nhưng trả sau ack phải bị từ chối nếu chứa ID deleted hoặc revision thấp hơn.
- Trang project `fetchData` cần generation/abort để request cũ không `setChapters` sau request mới hoặc sau chuyển project.
- Editor kiểm tra activeChapterId, lifecycle và account generation trước áp dụng GET/PATCH/recovery result.
- GET response không version từ legacy không được xóa/ghi đè confirmed tombstones; nó chỉ được nhập theo migration policy.
- Full snapshot cũ có thể bị bỏ theo workspaceRevision. Response từng chapter phải dùng version tương ứng hoặc deletion gate; không tùy tiện bỏ tất cả chapter response chỉ vì revision của một chapter khác cao hơn.
- Import `merge=false` cũng phải giữ deletion gate. Không coi “replace” là quyền xóa sổ lịch sử deletion.

### 10.3. Sync scheduler

- Thay `isPushing → success ngay` bằng shared promise và cơ chế dirty generation/requeue.
- Mutation xảy ra trong lúc push đang chạy phải có lượt push/operation replay tiếp theo. Await promise cũ chưa đủ xác nhận mutation mới.
- Pull và push có thể chạy cùng lúc nếu có version/gate đúng; nếu serialize thì vẫn phải bảo vệ response ngoài scheduler như GET chapter/PATCH.
- Khi sync rảnh và không mutation, không tăng `lastModified`/revision bằng `Date.now()` rồi coi đó là nội dung mới để push vòng lặp.
- `pullSync` chỉ đặt `synced` khi trạng thái phản ánh đúng pending writes. `importFullWorkspace` từ backup/local không tự cập nhật thời điểm “đã lưu cloud”.

## 11. Ma trận kiểm thử bắt buộc

Viết test gọi route/service production; không sao chép thuật toán thành server mô phỏng rồi test bản sao. Dùng Hono app/request hoặc Worker local với D1 binding kiểm thử, migrations thật. Test pure merge vẫn hữu ích nhưng không thay thế integration.

| ID | Kịch bản | Kết quả bắt buộc |
| --- | --- | --- |
| D01 | DELETE chapter → stale POST sync từ cùng browser | D1 không có active chapter, tombstone tồn tại, GET/list không đưa lại |
| D02 | A DELETE, B offline giữ snapshot rồi online/push | B loại chapter sau reconcile; không tái insert |
| D03 | Snapshot `updatedAt` sau delete một giờ hoặc lệch đồng hồ 7 ngày | Vẫn deleted; timestamp không cho restore |
| D04 | Tombstone 31/365 ngày, backup cũ quay lại | Vẫn deleted, không tự prune lifecycle |
| D05 | GET chapters/pull phát trước delete, trả sau ack | Cache và UI không có chapter, tombstone không mất |
| D06 | Push/PATCH phát trước delete, response ack trả sau | Gate không tái cache; final D1 deleted |
| D07 | Server sync preflight thấy chapter thiếu/chưa deleted, DELETE xen giữa preflight và INSERT | Write-time guard chặn insert, không có TOCTOU resurrect |
| D08 | Xóa chapter đang owned/protected, đang dirty | Không re-add bằng protection; draft archive riêng; không save/recovery active sau delete |
| D09 | Xóa chapter đang mở, điều hướng thẻ khác | Không gọi save của chapter đã xóa; selection hợp lệ |
| D10 | DELETE parent có child/grandchild | Một request; all IDs tombstoned và xóa atomic |
| D11 | Lỗi SQL ở giữa cascade | Không có xóa nửa cây, không success sai |
| D12 | Xóa cả subtree làm còn 0 thẻ | 400/conflict, không tombstone/partial delete |
| D13 | Hai DELETE concurrent khác nhau có thể làm còn 0 thẻ | Commit guard đảm bảo còn ít nhất một thẻ |
| D14 | Một child bị khóa bởi thiết bị khác | 423, không xóa một phần |
| D15 | Lock takeover diễn ra sau preflight delete | Commit xét lại lock; không bypass quyền khóa |
| D16 | DELETE đã commit nhưng response rớt, retry cùng operation | Ack idempotent; cùng deletedIds; không phục sinh |
| D17 | DELETE 403/423/network fail | UI/phân loại pending đúng; không báo cloud delete thành công giả |
| D18 | Xóa recovery R, pending recovery request cũ retry cùng key | 410/terminal; R không tái tạo |
| D19 | Cùng recovery operation retry hai lần/reload | Một chapter tối đa, một operation; không ID timestamp mới |
| D20 | Hai request create recovery concurrent | Unique/atomic guard; chỉ một bản active |
| D21 | Dùng lại operationId nhưng payload đổi | 409; draft mới không bị clear |
| D22 | Source C deleted, pending recovery của C online | Không tạo active recovery; nội dung giữ archive nếu có |
| D23 | Snapshot cũ lặp trong lúc source bị lock | Không tăng số recovery; snapshot khác canonical không tự coi là draft |
| D24 | Draft offline thật bị conflict nhưng source active | Nội dung giữ nguyên và recovery idempotent theo policy |
| D25 | Response recovery đã deleted đến muộn | Không cache/push chapter deleted |
| D26 | D1 active chapters rỗng và KV chứa chapters cũ | Không dùng KV để phục sinh |
| D27 | Primary sync lỗi, direct legacy KVDB có snapshot cũ | Không tự merge/push thành authoritative; pending giữ nguyên |
| D28 | Xóa project rồi stale snapshot có project/chapters | Không tái tạo project hoặc child |
| D29 | ID mới thật được tạo trên B khi A đang sync | Vẫn đồng bộ được; không xóa nhầm do vắng trong snapshot |
| D30 | Update/reorder vào parent đã deleted | Từ chối; không orphan/reparent ngầm |
| D31 | Delete xảy ra khi `isPushing=true` | Mutation mới được replay/ack riêng; không success giả |
| D32 | Hai tab cùng origin, tab B dirty lúc A xóa | Nhận deletion, dừng autosave; bảo tồn draft riêng |
| D33 | Logout/chuyển user trong khi request/queue chạy | Không apply/gửi mutation của user trước sang user sau |
| D34 | Thống kê, sidebar, overview, export sau xóa | Cùng tập ID active; số từ/số chương nhất quán |
| D35 | Poll 2 phút không edit sau xóa | Chapter không trở lại; revision không tăng chỉ vì GET; không recovery tăng dần |
| D36 | Protocol client cũ gửi `tombstones` hoặc thiếu metadata mới | Không bypass lifecycle/quyền xóa, không tạo tự động recovery lặp |

Các race test dùng deferred promise/barrier/fake clock và interleaving xác định. Không dùng `sleep(8000)` để test chính xác một race.

Thêm regression cho import protected chapter bị tombstone, `cacheRemoteChapter` ack cũ, và `merge=false` giữ dấu xóa. Kiểm tra nội dung draft bằng hash hoặc equality, không chỉ kiểm tra số chương.

Sửa/xóa kỳ vọng cũ cho phép `updatedAt > deletedAt` phục sinh cùng ID và prune dấu xóa 30 ngày. Thay T20/T30 bằng test đúng điều tên test tuyên bố, hoặc đổi tên cho đúng phạm vi cũ rồi thêm regression mới.

## 12. Dọn dữ liệu đang bị nhân bản mà không mất bản thảo

Thực hiện sau khi cơ chế chống tái sinh đã hoạt động; nếu dọn trước, các thiết bị cũ có thể tạo lại dữ liệu.

1. Xuất bản sao D1/snapshot workspace và các pending draft/recovery của thiết bị được hỗ trợ; giữ nguyên IDs, metadata và content hash.
2. Tạo báo cáo dry-run theo user/project: chapterId, title, sourceChapterId nếu có, operation key, timestamps, content hash, số từ, cấu trúc cha/con.
3. Phân biệt duplicate exact, recovery có nội dung khác thật, và chapter người dùng tự tạo. Tên “Khôi phục” hoặc cùng wordCount không đủ để quyết định xóa.
4. Với ID có log xóa đáng tin cậy nhưng đã resurrect: lập danh sách cần tái áp dụng delete và ghi tombstone, có báo cáo cụ thể.
5. Với bản trùng chính xác chưa rõ chủ ý: đề xuất giữ một bản canonical, archive các bản khác, trình kết quả để người dùng duyệt trước thao tác dữ liệu production hàng loạt.
6. Recovery cũ thiếu operation metadata có thể chỉ backfill chắc chắn khi xác định được source và payload; trường hợp không chắc giữ nguyên/quarantine, không suy đoán bằng title.
7. Sau cleanup, replay snapshot cũ kiểm thử và xác nhận không tái tạo.

**Giới hạn lịch sử:** những lần hard delete cũ chưa có tombstone/log thì không thể suy ra chắc chắn chỉ từ snapshot. Bản sửa phải ngăn lỗi mới; không hứa tự xác định mọi ID người dùng từng muốn xóa. Cho phép người dùng xóa lại bằng cơ chế mới hoặc dùng evidence đáng tin để backfill.

## 13. Thứ tự triển khai và cổng nghiệm thu

### Mốc 1 — Regression và schema

- Xác nhận route đang phục vụ production.
- Test D01/D18 thất bại trên route thật hiện tại.
- Migration dấu xóa/revision/recovery operation; cập nhật test loader.
- Test guard write-time và rollback trên D1 local.

### Mốc 2 — Server bảo vệ lifecycle

- DELETE transactional/idempotent.
- POST sync không tái insert deleted IDs; recovery service dùng operation ledger.
- GET sync lấy dấu xóa D1, bỏ fallback rỗng sai.
- Chống project resurrect và parent deleted.

Gate: D01–D04, D07, D10–D16, D18–D23, D26, D28 phải pass trước khi coi root cause đã được chặn ở server.

### Mốc 3 — Frontend và phản hồi muộn

- Shared delete service, single cascade request, cache apply sau ack.
- Editor retire/delete-aware navigation.
- Cache/import gate, namespace queue/account generation.
- Scheduler không bỏ mutation hoặc báo success giả.

Gate: D05–D09, D17, D25, D31–D33; offline/conflict preservation D24/D29 vẫn pass.

### Mốc 4 — Compatibility và kiểm thử thủ công

- Audit Pages/KVDB/backup paths; client cũ bị chặn lifecycle ở server.
- Chạy các test hiện hữu phù hợp, test mới và type-check API/web; build web.
- Staging PC + điện thoại cùng tài khoản: xóa chương thường/recovery, sync 10 vòng, reload hai thiết bị, background/foreground, offline/reconnect, chờ ít nhất 2 phút polling.
- Đối chiếu IDs trong UI, local cache và D1; không chỉ nhìn toast.

### Mốc 5 — Deployment và cleanup

- Migration additive trước; server mới trước frontend mới để stale clients đã được bảo vệ.
- Deploy đúng Worker/D1 môi trường mục tiêu, sau đó web; ghi build identifier/protocol version để truy vết.
- Giữ API tương thích đủ cho client cũ đọc, nhưng không cho client cũ vượt tombstone.
- Nếu rollback frontend, vẫn giữ server guard/migration. Không rollback về server biết hard-delete mà quên dấu xóa.
- Cleanup production là thao tác riêng có backup/dry-run và phê duyệt dữ liệu cụ thể.

## 14. Danh sách file cần sửa hoặc rà soát

| File | Công việc |
| --- | --- |
| `apps/api/src/db/schema.ts` | Tombstones, sync revision, recovery operations |
| `apps/api/src/db/migrations/0003_*.sql` | Migration additive, indexes, guard nếu chọn triggers |
| `apps/api/src/routes/chapters.ts` | DELETE, recoveries, save/lock/reorder guards |
| `apps/api/src/routes/sync.ts` | Rejection trước insert, canonical reads, partial ack, recovery policy |
| `apps/api/src/routes/projects.ts` | Project delete không mở đường resurrect |
| `apps/api/src/services/*` hoặc cấu trúc tương đương | Dùng chung lifecycle/delete/recovery helpers, tránh sao chép logic |
| `packages/shared/src/*` | Contract/types deletion và recovery nếu phù hợp cấu trúc repo |
| `apps/web/lib/utils.ts` | Phân biệt remote failure/local mode; DELETE không success giả |
| `apps/web/lib/sync-core.ts` | Lifecycle thắng timestamp, không prune dấu xóa tùy tiện |
| `apps/web/lib/sync.ts` | Import gate, protected IDs, tombstone union, scheduler/ack |
| `apps/web/lib/chapter-lock.ts` | Cache gate, queue recovery bền vững/idempotent |
| `apps/web/lib/store.ts` | Account isolation cho queue/revision/drafts |
| `apps/web/lib/sync-backup.ts` | Import/reconcile tuân thủ dấu xóa và tránh recovery lặp |
| `apps/web/app/(dashboard)/editor/[projectId]/page.tsx` | Shared delete, stale fetch guard |
| `apps/web/app/(dashboard)/editor/[projectId]/[chapterId]/page.tsx` | Single DELETE, editor retire, delete-aware navigation và response guards |
| `apps/web/components/layout/sync-provider.tsx` | Synced theo ack/pending mutation |
| `apps/web/lib/server-proxy.ts` | Forward header operation/protocol/version mới nếu contract dùng headers |
| `apps/web/app/api/sync/route.ts` | Proxy đúng authoritative service, lỗi cấu hình rõ ràng |
| `functions/api/sync.ts` | Xác định có active; loại merge policy độc lập hoặc hạn chế legacy |
| `apps/web/lib/*test.mjs`, test API mới | Thay kỳ vọng lỗi thời; chạy handler thật và race tests |
| `package.json`, test runtime config | Giải quyết Node 20 vs `node:sqlite` nếu cần để kiểm thử chạy thật |

Chỉ sửa file thực sự cần thiết sau khi xác nhận đường chạy; bảng là bản đồ rà soát, không phải yêu cầu thay mọi file.

## 15. Điều kiện hoàn thành và báo cáo của AI triển khai

Chỉ báo hoàn thành khi:

- DELETE ack có dấu xóa D1 bền vững cho mọi ID cascade và thao tác đã commit.
- Mọi đường insert/update/recovery không vượt dấu xóa kể cả race, timestamp tương lai, retry, client cũ.
- Recovery cùng operation không sinh thêm bản và không trở lại sau khi bị xóa.
- UI/cache không re-add ID qua protected merge, GET/PATCH/recovery response đến muộn.
- Pending delete/unsynced draft phân biệt rõ với cloud ack; dữ liệu chưa ack không mất.
- Ma trận kiểm thử quan trọng pass trên mã production; kiểm thử PC/mobile chứng minh bằng ID/content hash.
- Không tắt đồng bộ, không xóa nội dung hàng loạt để làm triệu chứng biến mất.

Báo cáo cuối cần có: root cause đã xác nhận bằng reproduction; schema/contract thay đổi; kết quả tests thực chạy và giới hạn chưa kiểm chứng; bằng chứng PC/mobile nếu đã chạy; trạng thái deploy/migration; cleanup nào chỉ mới dry-run. Không ghi đã xác minh production nếu chỉ kiểm tra local.

## 16. Lời giao việc cho AI triển khai

> Triển khai kế hoạch này để sửa lỗi chương đã xóa bị xuất hiện lại. Bắt đầu bằng regression DELETE → stale POST sync và delete recovery → retry operation trên Hono/Worker handler thật. Dùng dấu xóa bền vững ở D1 làm invariant lifecycle, ghi cùng transaction delete, chặn mọi write tái tạo deleted ID tại SQL write time. Sau đó sửa recovery idempotency còn hiệu lực sau xóa, cache/import gate cho response muộn, và shared frontend delete service. Không cho `updatedAt` hoặc số từ thắng deletion; không prune dấu xóa 30 ngày; không tắt đồng bộ. Giữ draft chưa ack trong archive riêng. Hoàn thành kiểm thử race, offline/reconnect, PC/mobile và báo cáo bằng chứng cụ thể. Cleanup dữ liệu trùng production phải có backup/dry-run và duyệt danh sách trước khi thực thi.
