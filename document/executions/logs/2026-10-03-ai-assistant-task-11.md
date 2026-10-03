# Task 11: Dependency và ranh giới import (AI Assistant)

Plan: [document/plans/2026-10-03-ai-assistant-plan.md](../../plans/2026-10-03-ai-assistant-plan.md), Task 11. Vấn đề 9 và 52.

## 2026-10-03 — devops-engineer — Xong
- **Đã làm**
  - Đọc `CHANGELOG.md` trong `npm pack ai@7.0.127`: bản 7.0.127 chỉ có tính năng tool search (`search()`, `maxResults`), hai bản sửa lỗi (hủy merged UI message stream khi consumer ngắt kết nối, chấp nhận tool approval input tạo ở realm JS khác) và nâng `@ai-sdk/gateway` 4.0.103. Không có sửa lỗi bảo mật, nên giữ 7.0.126.
  - Thêm `ai` 7.0.126 (backend, frontend) và `@ai-sdk/google` 4.0.87 (backend), pin chính xác, không `^`.
  - `eslint.config.mjs`: `frontendImportRestrictions` nhận `canImportAiSdk` (mặc định `false`); cấm `ai`, `ai/*` và `@schemaforge/core/ai` trong `frontend/`; thêm khối cho `frontend/src/lib/api/ai-chat-client.ts` cho phép `ai`.
- **File thay đổi**: `backend/package.json`, `frontend/package.json`, `pnpm-lock.yaml`, `eslint.config.mjs`, file log này.
- **Kiểm tra**
  - `pnpm install --frozen-lockfile`: xanh. Lockfile chỉ có một `@ai-sdk/provider-utils` (5.0.53) và một `@ai-sdk/provider` (4.0.21); `allowBuilds` không đổi, không gói mới bị chặn.
  - `pnpm lint`: 8/8 task thành công.
  - Probe (file tạm, đã xóa): `ai` ở `features/editor` báo `no-restricted-imports`; `ai/test` ở `features/editor` báo lỗi; `@schemaforge/core/ai` ở `lib/api` báo lỗi; `ai` ở `lib/api/ai-chat-client.ts` không lỗi. Lệnh `--stdin` của plan không chạy được vì project service cần file thật, nên dùng file tạm.
  - `.claude/scripts/verify.sh backend`: RESULT: PASS. Frontend: lần 1 FAIL do 3 test timeout 5000ms trong `editor-workspace.test.tsx` (máy chạy nhiều Vitest song song của worktree khác, không liên quan thay đổi); chạy lại một mình: RESULT: PASS. `.claude/scripts/secret-scan.sh`: SECRET-SCAN: CLEAN.
- **Quyết định**
  - Giữ 7.0.126 vì 7.0.127 không sửa lỗi bảo mật và plan yêu cầu pin.
  - Không dùng catalog: `ai` chỉ ở backend và frontend, plan ghi trực tiếp vào hai `package.json`.
  - Probe bằng file tạm thay vì `--stdin`, rồi xóa.
  - Tách thêm `ai/test` thành pattern `ai/*` theo plan.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: không có secret hay biến env mới. Worktree khác chạy lại `pnpm install --frozen-lockfile` sau khi merge.
