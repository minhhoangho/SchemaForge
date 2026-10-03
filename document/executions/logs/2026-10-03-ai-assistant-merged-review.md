# Review code phần 5 đã merge (508e5a6..509b45a)

Liên kết: [Plan](../../plans/2026-10-03-ai-assistant-plan.md), [Spec](../../specs/2026-10-02-ai-assistant-design.md)

## 2026-10-03 14:30 — project-reviewer — Xong

- **Đã làm**: review chỉ đọc dải `508e5a6..509b45a` trên `master` (Task 1, 2, 10, 11, 12, 13, 22 và các commit docs `a328aa8`, `684c782`, `a06c14f`), đối chiếu "Chữ ký và hành vi", "Test viết trước" của từng task, "Quy ước chung", "Điểm nóng", spec AI-R22, R23, R33, R62, R63 và danh mục tool; kiểm tra độ thuần của core, phụ thuộc của `api-contract`, thứ tự guard (Origin → Jwt → RateLimit), ranh giới lint và key không lọt ra thông báo lỗi.

- **File thay đổi**: không (review chỉ đọc)

- **Kiểm tra**:
  - `.claude/scripts/verify.sh core frontend backend --build` → `RESULT: PASS` (core 2759 test, coverage dòng 97,66 %; frontend 3876 test, 96,02 %; backend 307 test, 97,61 %)
  - `pnpm turbo run typecheck lint test build --filter @schemaforge/api-contract` → 5/5 thành công, 69 test, coverage 100 %
  - Hai probe eslint (`ai` trong `features/editor`, `@schemaforge/core/ai` trong `lib/api`) đều báo `no-restricted-imports`; probe thứ ba chờ `ai-chat-client.ts` (Task 21)
  - `.claude/scripts/secret-scan.sh --range 508e5a6..509b45a` → `SECRET-SCAN: CLEAN`

- **Quyết định**: kết luận accept-with-fixes. Một lỗi should-fix: Task 2 đã bỏ `AI_MAX_SAMPLE_DEPTH` khỏi `packages/core/src/ai/ai-limits.ts`, trong khi plan Task 2, spec AI-R62 và Task 8 cần hằng này. Phần sửa `DATABASE_URL` trong `.env.example` của Task 12 không tính là lỗi vì đã ghi trong log Task 12.

- **Việc còn lại**:
  - [x] Thêm lại `AI_MAX_SAMPLE_DEPTH = 4` — đã làm ở commit `20600b9` `fix(core): restore ai sample depth limit` (log `2026-10-03-ai-sample-depth-limit.md`)
  - [ ] (Tùy chọn) Cho `verify.sh` và `test-file.sh` nhận package `api-contract`
  - [ ] (Tùy chọn) Vòng import chỉ-type giữa `proposal-display.ts` và `state/create-editor-store.ts` (Task 22): lint pass; nếu muốn tuân thủ chặt "No circular imports" trong `typescript.md` thì tách type dùng chung ra file riêng ở task sau

- **Ghi chú cho người tiếp theo**: khi Task 14–18 merge, chạy `ecc:security-reviewer` (chỉ review). Probe eslint cho `frontend/src/lib/api/ai-chat-client.ts` chạy lại ở Task 21.
