# Sửa review vòng cuối cửa sổ chat AI nổi (task 6)

Không thuộc task nào trong plan. Tiếp theo [task 4](2026-10-05-ai-chat-floating-task-4.md). Spec: `document/specs/2026-10-02-ai-assistant-design.md` (AI-R51, ghi chú 2026-10-05).

## 2026-10-05 — frontend-engineer — Xong
- **Đã làm**
  1. S1: thêm `AI_RESTORE_ID` (`ai-panel-ids.ts`) làm id nút Thu nhỏ/Khôi phục ở header; `focusProposalCard` fallback thẻ -> launcher -> nút Khôi phục.
  2. S2: khi thu nhỏ và `hasUnreadReply`, nút Khôi phục hiện chấm chưa đọc (`aria-hidden`) và có tên "Restore, new reply" / "Khôi phục, có phản hồi mới" (key mới `panel.restoreUnread`, vì `unreadReply` là "AI assistant, new reply" nên không diễn đạt được "Khôi phục").
  3. S3: tách `AiWindowState`, `CLOSED_AI_WINDOW`, `createAiWindowActions` sang `state/ai-window-actions.ts` (cùng kiểu `proposal-actions.ts`); `create-editor-store.ts` 362 -> 305 dòng; test chuyển sang `ai-window-actions.test.ts`. Không đổi hành vi.
  4. `vi.useRealTimers()` chuyển vào `afterEach` cấp file của `ai-panel.test.tsx`.
  5. Rewrap JSDoc `use-reveal-focused-element.ts`.
- **File thay đổi**: `frontend/src/features/editor/components/ai-panel/{ai-panel-ids.ts,proposal-decision.ts,ai-panel-header.tsx,ai-panel-loader.tsx,ai-panel.test.tsx}`, `frontend/src/features/editor/components/editor-workspace.test.tsx`, `frontend/src/features/editor/state/{ai-window-actions.ts,ai-window-actions.test.ts,create-editor-store.ts,create-editor-store.test.ts}`, `frontend/src/features/editor/hooks/use-reveal-focused-element.ts`, `frontend/src/lib/i18n/locales/{en,vi}/ai/panel.ts`.
- **Kiểm tra**
  - RED: bỏ fallback Khôi phục thì test focus trong `editor-workspace.test.tsx` FAIL; khôi phục lại thì PASS.
  - `.claude/scripts/verify.sh frontend --format --build`: `RESULT: PASS` (4587 test). Hai lần chạy trước FAIL do test timeout 5s ở các file không liên quan (theme-switch, committed-text-area, editor-workspace) khi máy tải cao (load average ~33-50, process khác); chạy riêng file đều PASS, chạy lại toàn bộ PASS.
  - Bundle: các dấu `ai-assistant-restore`, `data-ai-window-overlay`, `vercel.ai.error` không có trong chunk entry của `/schemas/[schemaId]/page`; chuỗi locale mới nằm trong chunk entry cùng các chuỗi locale cũ (không kéo panel hay SDK `ai` vào entry).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Nút Khôi phục có id cố định `ai-assistant-restore` và là fallback cuối của `focusProposalCard`.
  - Thêm key `panel.restoreUnread` thay vì tái dùng `unreadReply`.
  - Chấm chưa đọc trên Khôi phục chỉ hiện khi đang thu nhỏ (khi chưa thu nhỏ `hasUnreadReply` luôn false).
  - Slice mới import type từ `create-editor-store.ts` (vòng type-only, như `proposal-actions.ts`); `ai-panel-loader.tsx` import `AiWindowState` từ file mới.
- **Việc còn lại**: không có.
- **Ghi chú cho người tiếp theo**: kiểm tay trên trình duyệt thật: chấm chưa đọc trên nút Khôi phục ở cả hai theme (tương phản với `bg-destructive`), focus sau Chấp nhận/Bỏ khi thu nhỏ trên màn < 640px. Spec vẫn cần `spec-writer` cập nhật như ghi chú ở log task 4.
