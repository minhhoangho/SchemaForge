# Security review Task 12 và Task 13 của phần 5

Liên kết: [Plan](../../plans/2026-10-03-ai-assistant-plan.md), [Spec](../../specs/2026-10-02-ai-assistant-design.md)

## 2026-10-03 15:45 — ecc:security-reviewer — Xong

- **Đã làm**: rà soát chỉ đọc commit `2b72047` (Task 12) và `32ec307` (Task 13); kiểm tra đường rò `GEMINI_API_KEY` (thông báo lỗi validate, logger, cấu hình serialize, `.env.example`), cách tạo khóa rate limit (sha256 của user id hoặc IP), `X-Forwarded-For` và trust proxy, truy cập không xác thực, `Retry-After`, biên số nguyên của `AI_GLOBAL_REQUESTS_PER_HOUR`. Kết luận accept: không có CRITICAL/HIGH, 2 Low, 2 Info.

- **File thay đổi**: không (review chỉ đọc)

- **Kiểm tra**:
  - Đọc `git show` hai commit
  - Kiểm tra `rate-limit.guard.ts`, `rate-limit.store.ts`, `env.ts`, `app.module.ts`, `app-setup.ts`
  - Grep xác nhận `GEMINI_*` chỉ có trong `config/env.ts` và spec, không có `process.env` ngoài `config/`
  - Không chạy test, không đọc `.env`

- **Quyết định**: không yêu cầu sửa trước khi làm tiếp.

- **Việc còn lại**:
  - [ ] (Low) Ghi vào tài liệu triển khai số hop `TRUST_PROXY_HOPS` đúng khi đứng sau reverse proxy (hops=0 thì mọi người dùng chung IP proxy nên `ai-ip-*` thành giới hạn toàn cục; hops quá lớn thì `X-Forwarded-For` giả được); có thể thêm cảnh báo log khi `NODE_ENV=production` và hops=0 — đưa vào Task 30
  - [ ] (Low, tùy chọn) Khóa IPv6 theo tiền tố /64 trong `buildRateLimitKey` với rule `ip`
  - [x] (Task 14) Route AI không `@Public`; ngân sách toàn cục trả 503 không lộ giá trị; không log hay spread `Env` — Task 14 đã tuân thủ (commit `c4f49d8`), Task 18 phải giữ route không public
  - [ ] (Info) Store rate limit trong bộ nhớ, reset khi restart, không chia sẻ giữa instance; cần Redis/PostgreSQL nếu chạy nhiều instance. Key có khoảng trắng bên trong không bị từ chối ở env, chỉ lỗi lúc gọi

- **Ghi chú cho người tiếp theo**: không có.
