# Task 12: Env của AI ở backend

Plan: [Task 12](../../plans/2026-10-03-ai-assistant-plan.md#task-12-env-của-ai-ở-backend). Spec: [AI-R26](../../specs/2026-10-02-ai-assistant-design.md) (mục 6 "Biến môi trường").

## 2026-10-03 19:20 — backend-engineer — Xong

- **Đã làm**
  - Thêm ba biến env vào schema Zod: `GEMINI_API_KEY`, `GEMINI_MODEL` (tùy chọn, chuỗi rỗng hoặc toàn khoảng trắng coi như không có), `AI_GLOBAL_REQUESTS_PER_HOUR` (số nguyên dương, mặc định `1000`).
  - Trong `superRefine`, trước lệnh `return` sớm khi không phải production: có `GEMINI_API_KEY` mà thiếu `GEMINI_MODEL` thì báo issue ở `GEMINI_MODEL` với thông báo `GEMINI_MODEL is required when GEMINI_API_KEY is set` (không chứa giá trị key).
  - Thêm ba biến kèm chú thích tiếng Anh của bảng AI-R26 vào `backend/.env.example`.
  - TDD: viết test trước. RED: `.claude/scripts/test-file.sh backend src/config/env.spec.ts` → `Tests  9 failed | 19 passed (28)`. GREEN: cùng lệnh → `RESULT: PASS`.
- **File thay đổi**
  - `backend/src/config/env.ts`
  - `backend/src/config/env.spec.ts`
  - `backend/.env.example`
- **Kiểm tra**
  - `.claude/scripts/verify.sh backend --build --format`: typecheck, lint, test, build PASS; `FAIL format (prettier --check)` với `[error] No parser could be inferred for file ".../backend/.env.example"` → `RESULT: FAIL (format (prettier --check))`. Lỗi do script truyền `.env.example` cho prettier mà không có `--ignore-unknown`, không phải do định dạng.
  - `pnpm exec prettier --check --ignore-unknown -- ./backend/src/config/env.ts ./backend/src/config/env.spec.ts ./backend/.env.example` → `All matched files use Prettier code style!`
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`
  - `pnpm --filter @schemaforge/backend generate` (worktree mới chưa có Prisma client; cần cho typecheck).
  - Không chạy `test:e2e`: không đổi route, guard hay persistence; ba biến đều tùy chọn nên `.env.test` hiện có vẫn hợp lệ.
- **Quyết định**
  - Dùng một schema chung `optionalNonBlankString` (`z.string().optional()` + transform trim, rỗng thành `undefined`) cho cả hai biến Gemini: hai biến cùng quy tắc, tránh lặp.
  - Giá trị key và model được trim: khoảng trắng thừa ở đầu, cuối trong file env không làm hỏng lời gọi Gemini.
  - Test "rejects GEMINI_API_KEY without GEMINI_MODEL" dùng `GEMINI_MODEL: " "` để đồng thời kiểm tra chuỗi chỉ có khoảng trắng bị coi là thiếu.
  - Test "rejects a non-positive AI_GLOBAL_REQUESTS_PER_HOUR" dùng `it.each` với `0`, `-5`, `1.5` để phủ cả số âm và số không nguyên.
  - Sửa các dòng có sẵn bị `secret-scan.sh` báo trong hai file sở hữu (script quét cả file đã đổi, nên không sửa thì commit bị chặn): URL Postgres trong test và trong `.env.example` bỏ `user:password@` (thêm chú thích cách thêm credentials); JWT ngắn trong test đổi thành `"a".repeat(31)` và hằng `SHORT_JWT_VALUE`. Hành vi test giữ nguyên. Đây là lệch nhỏ so với "chỉ thêm đúng ba dòng" của plan.
  - Cập nhật test có sẵn "returns the parsed values…" thêm `AI_GLOBAL_REQUESTS_PER_HOUR: 1000`: kết quả parse giờ luôn có giá trị mặc định này.
- **Việc còn lại**
  - [ ] (Ngoài phạm vi, devops/orchestrator) Thêm `--ignore-unknown` vào lệnh `prettier --check` trong `.claude/scripts/verify.sh` để `--format` không FAIL khi file thay đổi là `.env.example` hay loại không có parser.
- **Ghi chú cho người tiếp theo**
  - Task 14 đọc `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_GLOBAL_REQUESTS_PER_HOUR` qua `ConfigService<Env, true>`; key là `string | undefined`, khi có key thì model chắc chắn có.
  - Trong test, key giả luôn khai báo `const FAKE_GEMINI_CREDENTIAL = "test-gemini-key-not-real";` rồi chỉ dùng tên hằng.
