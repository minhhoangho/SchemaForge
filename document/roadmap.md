# Roadmap

Dự án được chia thành các phần tương đối độc lập. Mỗi phần đi qua ba bước: spec → plan → implement (xem quy ước trong [README.md](README.md)).

## Các phần

| # | Phần | Nội dung chính | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| 0 | Foundation | `CLAUDE.md`, `document/`, khung thư mục | — | Xong |
| 1 | Scaffold & tooling | pnpm workspaces, Turborepo, app Next.js, app NestJS, `packages/core`, lint, format, test, CI | 0 | Đang làm |
| 2 | Core schema model | Types cho bảng, cột, quan hệ, index, enum, comment, subject area, ghi chú; validation; operations | 1 | Đang làm |
| 3 | Editor MVP | Canvas bảng, cột, quan hệ, index, enum, comment; zoom, pan, minimap; undo/redo; lưu local; dark mode; i18n vi/en | 2 | Chưa bắt đầu |
| 4 | Auth + lưu cloud | Đăng ký, đăng nhập, lưu schema lên server, danh sách schema | 1, 2 | Chưa bắt đầu |
| 5 | AI Assistant | Tích hợp Gemini ở backend; sinh schema từ mô tả; chat nhiều lượt; gợi ý cải thiện; giải thích; phát hiện lỗi thiết kế; sinh dữ liệu mẫu | 2, 3, 4 | Chưa bắt đầu |
| 6 | Code generators | SQL DDL (PostgreSQL, MySQL, SQL Server), Prisma, Drizzle, TypeScript, Zod, Mock API, OpenAPI, seed data, DBML, Markdown | 2 | Chưa bắt đầu |
| 7 | Import / Export | Import SQL, Prisma, DBML, JSON; export file, JSON, PNG/SVG, ZIP | 3, 6 | Chưa bắt đầu |
| 8 | Chia sẻ + lịch sử phiên bản | Link public/private; lịch sử phiên bản cơ bản | 4 | Chưa bắt đầu |
| 9 | Hoàn thiện | Subject area, ghi chú trên canvas, auto-layout, templates, presentation mode, phím tắt | 3 | Chưa bắt đầu |

## Ghi chú về thứ tự

- **Vì sao AI đứng thứ 5 dù là trọng tâm.** AI cần core model để sửa schema có cấu trúc, cần editor để hiển thị kết quả, và cần auth vì AI dùng key của hệ thống nên mỗi request phải gắn với một người dùng.
- **Core model hỗ trợ đủ khái niệm ngay từ phần 2.** Index, enum, comment, subject area và ghi chú có trong model từ đầu, dù giao diện cho subject area và ghi chú làm ở phần 9. Như vậy không phải đổi định dạng dữ liệu về sau.
- **i18n và dark mode làm từ Editor MVP.** Thêm vào sau sẽ phải sửa lại toàn bộ giao diện.
- **Làm song song được.** Phần 6 chỉ phụ thuộc phần 2, nên có thể làm song song với phần 3–5. Phần 4 có thể làm song song với phần 3.
