# Kiến trúc

Tài liệu này mô tả cách các thành phần của SchemaForge ghép với nhau và các quyết định kỹ thuật đã chốt. Chi tiết của từng phần nằm trong spec tương ứng ở [specs/](specs/).

## Sơ đồ thành phần

```text
Trình duyệt
  frontend/  (Next.js)
    canvas editor · AI chat UI · sinh code · import/export · lưu local
    └── dùng packages/core

          │  HTTPS, chỉ cho các tính năng cần đăng nhập
          ▼

Server
  backend/  (NestJS)
    auth · lưu cloud · share link · lịch sử phiên bản · AI
    └── dùng packages/core
          ├──▶ PostgreSQL (qua Prisma)
          └──▶ Google Gemini API
```

## Trách nhiệm từng thành phần

| Thành phần | Làm gì | Không làm gì |
|---|---|---|
| `packages/core` | Schema model, validation, operations, code generators, importers | Không phụ thuộc React, Next.js, NestJS, Prisma; không gọi mạng; không lưu trữ |
| `frontend/` | Giao diện editor, chat AI, sinh code, import/export, export ảnh, lưu local | Không gọi thẳng Gemini |
| `backend/` | Auth, lưu cloud, share link, lịch sử phiên bản, gọi Gemini | Không có logic schema riêng, luôn dùng `packages/core` |

## Nguyên tắc

1. **`packages/core` là nguồn dữ liệu gốc.** Frontend và backend dùng chung một schema model và một bộ validation, nên dữ liệu không bị lệch giữa hai phía.
2. **Local-first.** Không cần tài khoản vẫn dùng được editor, sinh code và import/export. Tài khoản mở thêm lưu cloud, chia sẻ, lịch sử phiên bản và AI.
3. **Một đường duy nhất để thay đổi schema.** Mọi thay đổi, dù từ thao tác trên canvas, từ AI hay từ import, đều là operation của core. Undo/redo, chỉnh sửa bằng AI và lịch sử phiên bản cùng dựa trên operation.
4. **AI chỉnh sửa có cấu trúc.** AI chỉ thay đổi schema qua tool call ánh xạ sang operation của core, và core validate kết quả trước khi áp dụng. Không đưa output tự do của model (ví dụ SQL thô) thẳng vào schema.

## Luồng dữ liệu

### Khách (chưa đăng nhập)

1. Người dùng thao tác trên canvas; frontend tạo operation tương ứng.
2. Core áp operation lên schema và validate.
3. Schema được lưu trong trình duyệt.
4. Sinh code và import/export chạy bằng core ngay trên trình duyệt, không gọi server.

### Người dùng đã đăng nhập

- **Lưu cloud:** frontend gửi schema lên backend; backend validate bằng core rồi lưu vào PostgreSQL.
- **Chia sẻ link và lịch sử phiên bản:** do backend quản lý.
- Cách đồng bộ giữa bản local và bản cloud được chốt trong spec của phần "Auth + lưu cloud".

### AI Assistant

1. Người dùng gửi tin nhắn; frontend gửi tin nhắn kèm schema hiện tại lên backend.
2. Backend gọi Gemini bằng API key trong biến môi trường, kèm danh sách tool tương ứng với các operation của core.
3. Backend validate các tool call bằng core, rồi stream câu trả lời và danh sách operation về frontend.
4. Frontend áp operation qua đúng đường của thao tác tay, nên thay đổi do AI tạo ra cũng undo được.

Hai điểm được chốt trong spec của phần "AI Assistant": người dùng có cần xem trước và xác nhận thay đổi của AI hay không, và giới hạn sử dụng AI cho mỗi người dùng.

## Bảo mật API key

- Gemini API key chỉ nằm trong biến môi trường của backend. Repo chỉ chứa `.env.example` với giá trị giả.
- Không bao giờ gửi key về client. Không ghi key vào log, thông báo lỗi hay analytics.
- Frontend chỉ gọi backend, không gọi thẳng Gemini.

## Quyết định đã chốt

| Hạng mục | Quyết định | Lý do |
|---|---|---|
| Cấu trúc repo | pnpm workspaces + Turborepo: `frontend/`, `backend/`, `packages/core/` | Schema model, generators và importers viết một lần, dùng cho cả hai phía |
| Ngôn ngữ lập trình | TypeScript (strict) ở mọi package | Dùng chung được `packages/core` |
| Frontend | Next.js | Lựa chọn của dự án |
| Backend | NestJS | Lựa chọn của dự án |
| Database | PostgreSQL + Prisma | Tích hợp NestJS phổ biến, migration tốt, có JSONB để lưu schema |
| Lưu trữ cho khách | Lưu trên trình duyệt | Dùng ngay, không cần tài khoản |
| AI provider | Google Gemini, gọi từ backend | Lựa chọn của dự án |
| API key AI | Một key của hệ thống, nằm trong biến môi trường của backend | Người dùng không phải tự cung cấp key |
| Quyền dùng AI | Bắt buộc đăng nhập | Hệ thống chịu chi phí AI, nên mỗi request cần gắn với một người dùng để giới hạn sử dụng |
| Ngôn ngữ tài liệu | `CLAUDE.md` và code: tiếng Anh. `document/`: tiếng Việt | — |
| Ngôn ngữ giao diện | Tiếng Việt và tiếng Anh, qua i18n | — |

## Chưa chốt

Các ứng viên dưới đây chỉ là đề xuất. Quyết định cuối cùng nằm trong spec của phần tương ứng, sau đó được chuyển lên bảng "Quyết định đã chốt".

| Hạng mục | Ứng viên | Chốt ở phần |
|---|---|---|
| UI kit, styling | Tailwind CSS + shadcn/ui | Scaffold & tooling |
| Test runner | Vitest; Jest cho NestJS | Scaffold & tooling |
| i18n | next-intl | Scaffold & tooling |
| Định dạng schema model | JSON document có version | Core schema model |
| Thư viện canvas | React Flow (`@xyflow/react`) | Editor MVP |
| Quản lý state | Zustand | Editor MVP |
| Cơ chế lưu local | IndexedDB | Editor MVP |
| Auth | Better Auth; Passport + JWT | Auth + lưu cloud |
| SDK gọi Gemini | Google Gen AI SDK (`@google/genai`); Vercel AI SDK | AI Assistant |
| Model Gemini cụ thể | Cấu hình qua biến môi trường | AI Assistant |
| Giới hạn sử dụng AI | Quota theo người dùng | AI Assistant |
| Parser SQL cho import | node-sql-parser | Import / Export |
| Auto-layout | elkjs; dagre | Hoàn thiện |
