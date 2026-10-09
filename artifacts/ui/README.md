# Novelist Studio — Bàn giao giao diện

Bản xem trước: [localhost:3000](http://localhost:3000). Đây là môi trường cục bộ, chưa triển khai công khai.

[Bộ ảnh desktop/mobile](C:/Users/Administrator/Downloads/workspace-01a0d30d-99e2-7ab2-86d1-d9cc82c5f001/novelist-app/artifacts/ui/index.html)

## Những phần đã hoàn thành

- Hệ màu giấy ấm, mực và xanh ngọc; hỗ trợ Sáng, Tối, Sepia và Theo thiết bị. Chủ đề đã chọn vẫn được giữ.
- Inter cho điều khiển, Crimson Pro cho tiêu đề và bản thảo, có dấu tiếng Việt và tải font tập trung.
- Thương hiệu, minh họa bản thảo và bìa mặc định bằng SVG/CSS; ảnh bìa riêng vẫn được sử dụng, bìa lỗi có dự phòng.
- Trang giới thiệu, đăng nhập/đăng ký, thư viện, tổng quan, trình viết, AI, xuất bản và cài đặt.
- Sidebar desktop; điều hướng và mục lục bằng drawer trên điện thoại; menu phụ gom các công cụ và hành động ít dùng.
- Hộp tạo chương đồng bộ; hộp xác nhận xóa tác phẩm; nhãn truy cập, Escape, giữ focus và trả focus.
- Toolbar cuộn ngang, bản thảo tối đa 760px, vùng viết dùng chiều cao động; trạng thái lưu cục bộ và đồng bộ hiển thị riêng.
- Chuyển động ngắn, nền giấy tĩnh; thiết lập giảm chuyển động áp dụng cho CSS, cuộn, Framer Motion và canvas.
- Giữ API, cấu trúc dữ liệu và cơ chế lưu/khóa/xung đột. Trình viết vẫn dùng khóa theo chương, không khởi tạo lại khi đổi chủ đề hay mở menu.
- Chỉnh phần xuất tệp phía giao diện để không nhận nhầm TXT khi yêu cầu EPUB; dùng bộ tạo EPUB hiện có khi dịch vụ trả định dạng khác. PDF báo bản in sẵn sàng, không báo đã lưu tệp trước khi người dùng in.

## Kiểm tra đã thực hiện

| Kiểm tra | Kết quả |
| --- | --- |
| TypeScript | Đạt |
| Build production | Đạt |
| Bộ kiểm thử hiện có, một tiến trình | 163/163 đạt |
| Trang giới thiệu, đăng nhập/đăng ký và các trang làm việc | 360, 390, 768, 1024, 1440px; Sáng/Tối/Sepia; không tràn ngang |
| Trình viết | Năm chiều rộng trên ba chủ đề; toolbar cuộn trong vùng riêng |
| Theo thiết bị | Chủ đề tối khớp với thiết bị đang chọn tối |
| Tiêu đề tiếng Việt dài và bìa lỗi | Bố cục giữ nguyên; bìa SVG dự phòng xuất hiện |
| Tìm kiếm rỗng và mục lục nhiều chương | Hiển thị đúng trạng thái; đã kiểm tra mục lục 7 chương |
| Hộp thoại/drawer | Focus vào trường nhập; Tab giữ trong hộp, Escape đóng và trả focus |
| Tìm/thay thế, định dạng | Tìm cụm có dấu, thay thế toàn bộ và in đậm hoạt động |
| Lưu và chuyển chương | Nội dung tiếng Việt còn nguyên khi đổi chủ đề, mở drawer, tải lại và chuyển chương trước khi lưu thủ công |
| Sắp xếp chương | Space + phím mũi tên di chuyển; đã trả lại thứ tự ban đầu |
| AI chưa cấu hình | Báo lỗi, giữ lại yêu cầu và cho gửi lại |
| DOCX/EPUB | Tạo đúng định dạng qua giao diện; thông báo kết quả có dung lượng |
| PDF | Chuẩn bị bản in A4; trình duyệt thử chặn popup nên dùng tệp HTML dự phòng |
| Năm đường dẫn phụ | Nhân vật, thế giới, dàn ý, timeline, wiki đều chuyển về tổng quan |
| Giảm chuyển động | Thiết bị thử bật giảm chuyển động; CSS transition 0.01ms; canvas bỏ hiệu ứng khi bật thiết lập này |
| Màu chữ dùng chung | Chữ thường, chữ phụ, nút chính và trạng thái đạt trên 4.5:1 trên ba chủ đề |

Kết quả đo: [responsive-checks.json](C:/Users/Administrator/Downloads/workspace-01a0d30d-99e2-7ab2-86d1-d9cc82c5f001/novelist-app/artifacts/ui/responsive-checks.json), [contrast-tokens.json](C:/Users/Administrator/Downloads/workspace-01a0d30d-99e2-7ab2-86d1-d9cc82c5f001/novelist-app/artifacts/ui/contrast-tokens.json), [redirect-checks.json](C:/Users/Administrator/Downloads/workspace-01a0d30d-99e2-7ab2-86d1-d9cc82c5f001/novelist-app/artifacts/ui/redirect-checks.json).

## Giới hạn kiểm tra

Môi trường không cấu hình dịch vụ backend và khóa API AI. Đã kiểm tra luồng cục bộ và trạng thái thất bại; chưa xác nhận AI trả nội dung thật hoặc đồng bộ hai thiết bị qua máy chủ thật. Bộ kiểm thử hiện có vẫn kiểm tra khóa, xung đột, hàng đợi lưu và đồng bộ bằng mô phỏng.

Đã nhập/gõ chuỗi có dấu qua trình duyệt và kiểm tra dữ liệu tiếng Việt; kiểm thử composition của IME nằm trong bộ 163 bài. Chưa xác nhận bằng bàn phím tiếng Việt trên điện thoại vật lý.

DOCX/EPUB báo tạo tệp thành công qua giao diện. Công cụ theo dõi tải tệp bị mất kết nối, nên chưa mở trực tiếp các tệp tải về bằng Word hoặc thiết bị đọc EPUB. PDF được kiểm tra đến bước tạo bản in/HTML; việc lưu PDF qua hộp thoại in của hệ điều hành vẫn cần thao tác người dùng.

Build còn bốn cảnh báo phụ thuộc hook ở hai trang trình viết/tổng quan từ logic hiện có, không có lỗi biên dịch.

Ảnh dùng tài khoản và bản thảo thử. Không thay dữ liệu mẫu trong mã nguồn hay seed dữ liệu cho người dùng thật.

## Chạy lại bản xem trước

Từ thư mục ứng dụng web: chạy lệnh build của dự án, rồi lệnh start ở cổng 3000. Trong phiên bàn giao, bản production preview đang được giữ chạy tại localhost:3000. Chế độ phát triển dùng thư mục build riêng để không bị ghi đè khi kiểm tra production.
