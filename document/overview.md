# Tổng quan sản phẩm

## SchemaForge là gì

SchemaForge là công cụ thiết kế database schema chạy trên web. Người dùng có thể:

- vẽ schema trực quan trên canvas,
- mô tả bằng tiếng Việt hoặc tiếng Anh để AI sinh và chỉnh sửa schema,
- sinh code và tài liệu từ schema: SQL, Prisma, Drizzle, TypeScript, Zod, OpenAPI…

**AI Schema Assistant là tính năng trọng tâm.**

## Nguyên tắc sản phẩm

- **Dùng ngay, không cần tài khoản.** Editor, sinh code và import/export chạy hoàn toàn trên trình duyệt, dữ liệu lưu local.
- **Đăng nhập để dùng thêm.** Tài khoản mở ra lưu cloud, chia sẻ link, lịch sử phiên bản và AI.
- **Dùng AI không cần API key.** AI chạy trên Google Gemini qua backend của SchemaForge; người dùng chỉ cần đăng nhập.
- **Song ngữ.** Giao diện tiếng Việt và tiếng Anh.

## Tính năng

Danh sách chi tiết kèm mã, mức ưu tiên và tiêu chí hoàn thành: [specs/2026-09-14-feature-list-design.md](specs/2026-09-14-feature-list-design.md).

### 1. Visual Schema Editor

- Thêm, sửa, xóa bảng
- Thêm, sửa, xóa cột: tên, kiểu dữ liệu, nullable, default, unique, primary key, auto-increment…
- Quan hệ giữa các bảng: 1-1, 1-n, n-n
- Index, enum, comment
- Nhóm bảng (subject area)
- Ghi chú trên canvas
- Zoom, pan, minimap, auto-layout
- Dark mode, light mode
- Undo, redo

### 2. AI Schema Assistant (trọng tâm)

Cần đăng nhập.

- Mô tả bằng ngôn ngữ tự nhiên (tiếng Việt hoặc tiếng Anh), AI sinh toàn bộ schema
- Chat nhiều lượt để chỉnh sửa schema
- Gợi ý cải thiện: index, chuẩn hóa, đặt tên, quan hệ còn thiếu…
- Giải thích schema
- Phát hiện lỗi thiết kế
- Sinh dữ liệu mẫu

### 3. Code Generator

- SQL DDL: PostgreSQL, MySQL, SQL Server
- Prisma schema
- Drizzle schema
- TypeScript types
- Zod schema
- Mock API (REST)
- OpenAPI / Swagger
- Seed data
- DBML
- Tài liệu Markdown

### 4. Import & Export

- Import: SQL, Prisma, DBML, JSON
- Export: mọi định dạng của Code Generator, JSON, ảnh PNG/SVG, file ZIP

### 5. Lưu trữ & chia sẻ

- Lưu local, không cần đăng nhập
- Lưu cloud khi đăng nhập
- Chia sẻ link public hoặc private
- Lịch sử phiên bản cơ bản

### 6. Tính năng hỗ trợ

- Templates có sẵn: E-commerce, SaaS, Blog, Social…
- Presentation mode
- Phím tắt
- Giao diện tiếng Việt và tiếng Anh
