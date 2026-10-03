# Task 13: Rate limit `ai` theo người dùng và IP

Plan: [Task 13](../../plans/2026-10-03-ai-assistant-plan.md#task-13-rate-limit-ai-theo-người-dùng-và-ip) · Spec: [AI-R49](../../specs/2026-10-02-ai-assistant-design.md)

## 2026-10-03 — backend-engineer — Xong

- **Đã làm**
  - `RateLimitKeyKind` thêm `"user"`; `RateLimitKeyInput` thêm `userId: string | null`. `buildRateLimitKey` với `user` trả `sha256Hex(userId)`, `userId` là `null` thì throw `Error("Rate limit rule needs an authenticated user")`.
  - `RATE_LIMIT_POLICIES.ai`: `ai-user-minute` (user, 10, 60), `ai-user-hour` (user, 100, 3600), `ai-ip-minute` (ip, 20, 60), `ai-ip-hour` (ip, 200, 3600).
  - `RateLimitGuard` truyền `userId: readRequestUser(request)?.userId ?? null`; cách đặt `Retry-After` của guard giữ nguyên.
  - `ApiException` nhận tham số thứ hai tùy chọn `{ retryAfterSeconds?: number }`, lưu thành `retryAfterSeconds: number | null`; `ApiExceptionFilter` đặt `Retry-After` trước khi gửi body khi giá trị khác `null`.
  - TDD: RED đã chạy (`vitest run src/modules/rate-limit src/common/api-exception.filter.spec.ts`): 7 test policy đỏ (`Unhandled rate limit key kind: user`, `RATE_LIMIT_POLICIES.ai` chưa có), spec guard đỏ khi import (`undefined is not iterable` vì chưa có `RATE_LIMIT_POLICIES.ai`), test filter đỏ (`expected "vi.fn()" to be called with arguments: [ 'Retry-After', '7' ]`). GREEN: `Test Files 4 passed (4)`, `Tests 53 passed (53)`.
- **File thay đổi**
  - `backend/src/modules/rate-limit/rate-limit.policy.ts`, `rate-limit.policy.spec.ts`
  - `backend/src/modules/rate-limit/rate-limit.guard.ts`, `rate-limit.guard.spec.ts`
  - `backend/src/common/api.exception.ts`, `api-exception.filter.ts`, `api-exception.filter.spec.ts`
- **Kiểm tra**
  - `.claude/scripts/verify.sh backend --build --format`: `RESULT: PASS` (307 test, coverage dòng 97.61%).
  - `pnpm --filter @schemaforge/backend test:e2e`: không chạy được trong worktree: `Error: The datasource.url property is required in your Prisma config file when using prisma migrate deploy.` Worktree không có `backend/.env.test` (file gitignore, chỉ có ở checkout chính) và agent không được đọc hay chép file env thật. Task 13 không liệt kê suite e2e nào.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Test guard với store thật dùng `MemoryRateLimiterStore` mới cho mỗi test (`beforeEach`) để test độc lập; 10 request hợp lệ gửi qua helper `sendAiRequests` ngoài thân test, vì `testing.md` cấm vòng lặp trong test.
  - Test "người dùng khác không bị chặn" dùng cùng IP: 12 request vẫn dưới `ai-ip-minute` (20), nên test chứng minh khóa theo người dùng tách riêng chứ không nhờ IP khác.
  - Filter chỉ đặt `Retry-After` cho `ApiException` có `retryAfterSeconds`. `429` ném từ guard vẫn đặt header trên response như trước (Vấn đề 15), nên hai đường không đè nhau.
  - Kiểu tùy chọn đặt tên là `ApiExceptionOptions` và được export để Task 18 dùng mà không phải khai báo lại.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 18 gắn `@RateLimit("ai")` lên `POST /ai/chat`. Rule `user` cần `JwtAuthGuard` chạy trước (thứ tự guard toàn cục Origin → Jwt → RateLimit); gắn chính sách `ai` lên route `@Public()` sẽ làm request throw lỗi lập trình (`500`).
  - Chạy e2e trong worktree cần `backend/.env.test`; orchestrator hoặc người dùng chạy e2e ở checkout chính.
