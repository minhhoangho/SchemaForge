# Review plan phần 5: AI Assistant

Plan: [2026-10-03-ai-assistant-plan.md](../../plans/2026-10-03-ai-assistant-plan.md). Spec: [2026-10-02-ai-assistant-design.md](../../specs/2026-10-02-ai-assistant-design.md). Log lập plan: [2026-10-03-ai-assistant-plan.md](2026-10-03-ai-assistant-plan.md).

## 2026-10-03 19:05 — project-reviewer (log do spec-writer ghi) — Xong

- **Đã làm**
  - Đọc toàn bộ plan (1559 dòng ở lúc review), log lập plan, các quy tắc AI-R liên quan của spec, rule `nestjs.md`, `security.md`, `react.md`, `core.md`, `testing.md`.
  - Đọc code: `backend/src/app.module.ts` (thứ tự guard), `rate-limit.guard.ts`, `rate-limit.policy.ts`, `rate-limit.store.ts`, `api.exception.ts`, `backend/test/create-test-app.ts`, `current-user.decorator.ts`, `clock.ts`, `schemas.service.ts`, `frontend/src/lib/api/api-client.ts`, `api-transport.ts`, `toolbar/schema-name-button.tsx`, `use-schema-commands.ts`, `editor-workspace.tsx`, `editor-toolbar.tsx`, các nơi gọi `dispatch`, luồng đăng xuất (`use-sign-out-flow.ts`, `lib/sync/sign-out.ts`), `vitest.config.ts` và `package.json` của core.
  - So với plan phần 7 ([2026-10-03-import-export-plan.md](../../plans/2026-10-03-import-export-plan.md)) để tìm file dùng chung.
- **File thay đổi**: không (reviewer chỉ đọc). Spec-writer áp các sửa vào `document/plans/2026-10-03-ai-assistant-plan.md` cùng ngày (xem mục 19:05 của log lập plan).
- **Kiểm tra**
  - `.claude/scripts/secret-scan.sh`: `CLEAN`.
  - Mọi số AI-R1 đến AI-R63 xuất hiện ở ít nhất một task.
  - Byte thô của dòng 772 (Task 15) xác nhận lỗi escape: quy tắc ghi thay `<` bằng chính `<`.
- **Quyết định**
  - Kết luận: chấp nhận kèm sửa; 3 lỗi chặn, 5 cần sửa, 4 góp ý nhỏ. Orchestrator chấp nhận mọi phát hiện; spec-writer đã áp tất cả.
  - Lỗi chặn:
    - P1: Task 15 phải thay `<` bằng chuỗi sáu ký tự (dấu gạch chéo ngược, `u`, `0`, `0`, `3`, `c`) theo AI-R59; đã sửa, thêm Vấn đề 41 và test không còn `<` thô ngoài thẻ.
    - P2: AI-R46 xóa hội thoại khi đăng xuất, mà đăng xuất không rời editor; đã thêm `reset()` trong provider của Task 23 khi rời `signed-in` hoặc đổi `user.id` (Vấn đề 47).
    - P3: còn đường gọi `dispatch` khi xem trước (`schema-name-button.tsx`, `CreateRelationDialog`, ô nhập chưa commit); đã thêm khóa ở Task 27b, `commitPendingEdits` ở Task 23, viết lại Vấn đề 40 thành no-op phòng thủ sau lớp khóa giao diện đầy đủ (Vấn đề 46).
  - Cần sửa: P4 Task 5 phụ thuộc thêm 6, Task 14 thêm 2; P5 dòng `PRIVATE_ROUTES` sang Task 18, Vấn đề 23 thay thế; P6 tách Task 27 thành 27a (đợt 5) và 27b (đợt 6); P7 benchmark sang `apply-ai-edit.bench.ts` (Vấn đề 49); P8 phần 5 chạy trước phần 7, thêm dòng file chung ở "Điểm nóng" (Vấn đề 50). Đã áp cả năm.
  - Góp ý nhỏ: P9 `AiStreamResponse` thành provider được inject (Vấn đề 51); P10 `diffSchemas` là O(n log n); P11 Task 11 đọc release notes `ai` 7.0.127 (Vấn đề 52); P12 import `MAX_DOCUMENT_ERRORS` từ `schemas.service.ts` (Vấn đề 60). Đã áp cả bốn.
- **Ghi chú cho người tiếp theo**
  - Lỗi escape chỉ thấy trong byte thô: công cụ sửa file giải mã chuỗi escape thành `<`, nên bản hiển thị trông đúng. Kiểm bằng `grep -n 'u003c'` hoặc `od -c`.
  - `schema-name-button.tsx` gọi `onDone()` bất kể kết quả `dispatch`, nên một `dispatch` bị chặn sẽ nuốt thay đổi im lặng.
  - Đăng xuất không rời editor; mọi trạng thái gắn tài khoản trong editor phải tự xóa theo `useAuth`.
  - Plan phần 7 (merge sau) cần chặn điểm vào import bằng `selectIsPreviewing`; plan phần 7 chưa được sửa trong lượt này.
