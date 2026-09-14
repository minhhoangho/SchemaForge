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
- **Đồng bộ local và cloud:** sau khi đăng nhập, bản cloud là bản chính. Schema tự động được lưu lên cloud, còn bản trong trình duyệt chỉ đóng vai trò cache. Lần đầu đăng nhập, người dùng được hỏi có đưa các schema đang lưu local lên cloud không. Xung đột được phát hiện theo revision, và khi đó người dùng chọn giữ bản nào. Chi tiết được chốt trong spec của phần "Auth + lưu cloud".
- **Chia sẻ link và lịch sử phiên bản:** do backend quản lý.

### AI Assistant

1. Người dùng gửi tin nhắn; frontend gửi tin nhắn kèm schema hiện tại lên backend.
2. Backend gọi Gemini qua Vercel AI SDK, với API key và tên model lấy từ biến môi trường, kèm danh sách tool tương ứng với các operation của core.
3. Backend validate các tool call bằng core, rồi stream câu trả lời và danh sách operation về frontend.
4. Frontend hiển thị diff của các operation trên canvas (bảng, cột được thêm, sửa, xóa) để người dùng chọn Chấp nhận hoặc Bỏ.
5. Khi người dùng chấp nhận, frontend áp operation qua đúng đường của thao tác tay, nên thay đổi do AI tạo ra cũng undo được.

Backend giới hạn tần suất gọi AI (rate limit, ví dụ X request/phút) để chống lạm dụng. Hiện chưa có quota theo ngày hay theo tháng.

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
| UI kit, styling | Tailwind CSS + shadcn/ui | Component nằm trong repo nên tùy biến được hoàn toàn; dark mode dùng CSS variables |
| Test runner | Vitest cho mọi package; NestJS chạy trên Vitest qua `unplugin-swc` | Cả monorepo dùng một runner và một kiểu API mock |
| i18n | i18next + react-i18next | Hệ sinh thái lớn; backend cũng dùng được nếu cần dịch thông báo lỗi |
| Định dạng schema model | JSON phẳng theo ID, có trường `version` để migrate | Bảng, cột, quan hệ, index, enum là các map theo ID ở cấp gốc, nên đổi tên không làm hỏng tham chiếu; operation, diff và lịch sử phiên bản đơn giản |
| Thư viện canvas | React Flow (`@xyflow/react`) | Node là React component nên dùng được UI kit; có sẵn zoom, pan, minimap và điểm nối |
| Quản lý state | Zustand | Nhẹ, store nằm ngoài React nên gọi được từ code không phải component; React Flow cũng dùng Zustand |
| Cơ chế lưu local | IndexedDB qua Dexie | Có bảng, index, query và migration theo version, hợp khi lưu nhiều schema cùng lịch sử operation |
| Auth | Passport + JWT | Cách làm chuẩn của NestJS, kiểm soát hoàn toàn luồng auth |
| Cách đăng nhập | Email + mật khẩu, chưa xác minh email khi đăng ký | Lựa chọn của dự án |
| Đồng bộ local và cloud | Sau khi đăng nhập, bản cloud là bản chính, bản local làm cache | Không phải merge operation; xung đột được phát hiện theo revision |
| SDK gọi Gemini | Vercel AI SDK (`ai` + `@ai-sdk/google`) | Khai báo tool bằng Zod, có vòng lặp tool call nhiều bước và giao thức stream dùng được với `useChat` ở frontend |
| Model Gemini | Một model, đặt trong biến môi trường `GEMINI_MODEL` | Đổi model không cần sửa code |
| Giới hạn sử dụng AI | Chỉ rate limit theo tần suất, chưa có quota theo ngày hay theo tháng | Chống lạm dụng mà không phải theo dõi quota |
| Xác nhận thay đổi của AI | Người dùng xem diff rồi chọn chấp nhận hoặc bỏ | An toàn khi AI xóa hoặc thay đổi nhiều |
| SQL dialect | PostgreSQL, MySQL, SQL Server. Chưa hỗ trợ SQLite | Lựa chọn của dự án |
| Parser SQL cho import | `@dbml/core` | Một thư viện parse được cả DBML lẫn SQL của cả ba dialect được hỗ trợ |
| Auto-layout | elkjs, chạy trong Web Worker | Hỗ trợ điểm nối theo cột, đường nối vuông góc và ít giao cắt, hợp sơ đồ ER |

## Chưa chốt

Hiện không còn hạng mục nào. Khi phát sinh lựa chọn kỹ thuật mới, liệt kê ở đây hạng mục, các ứng viên và phần sẽ chốt. Quyết định cuối cùng nằm trong spec của phần tương ứng, sau đó được chuyển lên bảng "Quyết định đã chốt".
