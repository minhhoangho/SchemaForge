# Roadmap

Dự án được chia thành các phần tương đối độc lập. Mỗi phần đi qua ba bước: spec → plan → implement (xem quy ước trong [README.md](README.md)).

Trạng thái bám theo ba bước đó: `Chưa bắt đầu` (chưa có spec) → `Xong spec` (spec đã duyệt, chưa có plan) → `Xong plan` (plan đã duyệt, chưa viết code) → `Đang làm` (đang viết code) → `Xong`.

## Các phần

| # | Phần | Nội dung chính | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| 0 | Foundation | `CLAUDE.md`, `document/`, khung thư mục | — | Xong |
| 1 | Scaffold & tooling | pnpm workspaces, Turborepo, app Next.js, app NestJS, `packages/core`, lint, format, test (GitHub Actions CI đã gỡ ngày 2026-10-02, chỉ kiểm tra local, xem `architecture.md`) | 0 | Xong |
| 2 | Core schema model | Types cho bảng, cột, quan hệ, index, enum, comment, subject area, ghi chú; validation; operations | 1 | Xong |
| 3 | Editor MVP | Canvas bảng, cột, quan hệ, index, enum, comment; zoom, pan, minimap; undo/redo; lưu local; dark mode; i18n vi/en | 2 | Xong |
| 4 | Auth + lưu cloud | Đăng ký, đăng nhập, lưu schema lên server, danh sách schema | 1, 2 | Xong |
| 5 | AI Assistant | Tích hợp Gemini ở backend; sinh schema từ mô tả; chat nhiều lượt; gợi ý cải thiện; giải thích; phát hiện lỗi thiết kế; sinh dữ liệu mẫu | 2, 3, 4, 6 (chỉ AI-06) | Xong |
| 6 | Code generators | SQL DDL (PostgreSQL, MySQL, SQL Server), Prisma, Drizzle, TypeScript, Zod, Mock API, OpenAPI, seed data, DBML, Markdown | 2 | Xong |
| 7 | Import / Export | Import SQL, Prisma, DBML, JSON; export file, JSON, PNG/SVG, ZIP | 3, 6 | Xong spec |
| 8 | Chia sẻ + lịch sử phiên bản | Link public/private; lịch sử phiên bản cơ bản | 4 | Chưa bắt đầu |
| 9 | Hoàn thiện | Subject area, ghi chú trên canvas, auto-layout, templates, presentation mode, phím tắt | 3 | Chưa bắt đầu |
| 10 | Visual refresh | Làm mới giao diện, giữ bố cục và luồng: token màu light, dark, font, node bảng có dải màu, đường quan hệ, danh sách schema, trang đăng nhập, hộp thoại, toast | 3 | Xong |

Phần 4 đã xong phần code theo [spec phần 4](specs/2026-09-15-auth-cloud-design.md) và [plan phần 4](plans/2026-09-17-auth-cloud-plan.md). Checklist kiểm tra tay chưa chạy vì người dùng bỏ qua ngày 2026-10-02 (xem [log Task 38](executions/logs/2026-10-02-auth-cloud-task-38.md#kết-quả-kiểm-tra-tay)); nơi deploy chưa chọn vì người dùng chạy local trước (xem mục "Chưa chốt" của [architecture.md](architecture.md#chưa-chốt)).

Phần 5 xong theo [spec phần 5](specs/2026-10-02-ai-assistant-design.md) và [plan phần 5](plans/2026-10-03-ai-assistant-plan.md); quyết định đã ghi vào mục "Quyết định đã chốt" của [architecture.md](architecture.md#quyết-định-đã-chốt), ghi chú triển khai (`TRUST_PROXY_HOPS`, khóa IPv6, giới hạn theo từng process) ở mục "Hạn chế đã biết".

Phần 6 xong theo [spec phần 6](specs/2026-09-14-code-generators-design.md) và [plan phần 6](plans/2026-09-15-code-generators-plan.md). Conformance SQL Server không chạy trên database thật (VM Docker quá nhỏ): người dùng quyết định ngày 2026-10-03 kiểm tra bằng review code, xem [log kiểm tra](executions/logs/2026-10-03-sqlserver-code-check.md) và R34 của spec. Việc còn mở khác (tối ưu thêm tùy chọn) ở mục "Rủi ro cần kiểm tra khi triển khai" của spec phần 6.

## Ghi chú về thứ tự

- **Vì sao AI đứng thứ 5 dù là trọng tâm.** AI cần core model để sửa schema có cấu trúc, cần editor để hiển thị kết quả, và cần auth vì AI dùng key của hệ thống nên mỗi request phải gắn với một người dùng.
- **Core model hỗ trợ đủ khái niệm ngay từ phần 2.** Index, enum, comment, subject area và ghi chú có trong model từ đầu, dù giao diện cho subject area và ghi chú làm ở phần 9. Như vậy không phải đổi định dạng dữ liệu về sau.
- **i18n và dark mode làm từ Editor MVP.** Thêm vào sau sẽ phải sửa lại toàn bộ giao diện.
- **Làm song song được.** Phần 6 chỉ phụ thuộc phần 2, nên có thể làm song song với phần 3–5; riêng AI-06 của phần 5 chờ Task 21, 22 (seed) của [plan phần 6](plans/2026-09-15-code-generators-plan.md), xem [spec phần 5](specs/2026-10-02-ai-assistant-design.md), AI-R40. Phần 4 có thể làm song song với phần 3. Phần 10 chỉ đổi giao diện frontend nên đã làm song song với phần 4 và đã xong: [spec phần 10](specs/2026-10-01-visual-refresh-design.md), [plan phần 10](plans/2026-10-01-visual-refresh-plan.md).
