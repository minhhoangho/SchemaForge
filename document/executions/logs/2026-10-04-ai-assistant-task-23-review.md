# Review Task 23: Store hội thoại AI

Plan: [Task 23](../../plans/2026-10-03-ai-assistant-plan.md#task-23-store-hội-thoại-ai). Spec: [AI-R4, R6, R7, R18, R22–R25, R46, R47, R50, R54; mục 8 "Lịch sử", mục 13, mục 15](../../specs/2026-10-02-ai-assistant-design.md).

## 2026-10-04 — project-reviewer — Xong

- **Đã làm**
  - Review chỉ đọc Task 23 (store hội thoại AI) trong worktree `agent-ae8d5b203c7a5250f` (base `13236f4`, file chưa track), theo `CLAUDE.md`, `.claude/rules/`, plan Task 23 (Vấn đề 7, 25–28, 46, 47, 57) và spec.
  - Đối chiếu với `ai-chat-client.ts`, `proposal-actions.ts`, `create-editor-store.ts` và `ai-chat-request.dto.ts` của backend (lịch sử khớp giới hạn DTO).
  - Xác nhận L4 (trần văn bản trong store), L2 (lượt có chữ rồi chunk `error` thành `failed`, không đề xuất, không xem trước, có test) và `ai` không bị import ngoài `ai-chat-client.ts`.
  - Kết luận: chấp nhận kèm sửa, không có phát hiện chặn.
- **File thay đổi**: không (reviewer chỉ đọc).
- **Kiểm tra**
  - `.claude/scripts/verify.sh frontend --format`: typecheck PASS, lint PASS, format PASS; test 4366/4368, 2 test lỗi ở `editor-workspace.test.tsx` (không thuộc task, `findByRole` hết thời gian khi máy tải nặng).
  - `.claude/scripts/test-file.sh frontend src/features/editor/components/editor-workspace.test.tsx`: PASS khi chạy lại.
  - Coverage riêng 4 file mới: 97.22% dòng.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Chấp nhận quyết định 1–8 của implementer: trần 32768 ký tự cắt bớt và log một lần; tin thất bại giữ văn bản, lịch sử sau bỏ tin thất bại; file thêm `lib/ai-turn-accumulator.ts`; `acceptProposal` ném lỗi khi không có xem trước, `discardProposal` không làm gì, accept lỗi thì thẻ thành `discarded`; `getLocale` lấy `i18n.language`, mặc định `en`; `retry` gửi lại cả khi tin cuối không thất bại (thẻ `stale`, AI-R18); lỗi `loadClient` hay stream thành `internal-error`, chỉ log tên lỗi; tin chỉ có findings gửi khối `[findings]` không dòng trống đầu.
  - Bác quyết định 9: test provider mock `@/components/auth-provider` và `react-i18next`, trái quy tắc chỉ mock ở biên của `testing.md`; phải dùng `renderWithProviders` với `AuthProvider` thật và `fetchImpl` giả.
  - Orchestrator: chấp nhận file thêm `lib/ai-turn-accumulator.ts` (ngoại lệ về file sở hữu); giao agent Task 23 sửa mọi mục dưới đây trước khi merge; trần L4 chỉ đặt trong store, không sửa `ai-chat-client.ts`, vì backend đã giới hạn tổng output mỗi lượt bằng số bước nhân số token tối đa.
- **Việc còn lại**
  - [ ] `ai-chat-store-provider.test.tsx`: bỏ `vi.mock` của `@/components/auth-provider` và `react-i18next`; render bằng `renderWithProviders` với `AuthProvider` thật và `fetchImpl` giả; thêm test locale lấy từ ngôn ngữ giao diện (`vi`) và test gửi qua transport thật.
  - [ ] `create-ai-chat-store.test.ts`: thêm test `retry` khi tin cuối là tin AI `done` có đề xuất `stale` (AI-R18).
  - [ ] `create-ai-chat-store.test.ts`: thêm sự kiện `findings` và `sampleData` trước `error` để assert L2 có nghĩa.
  - [ ] `ai-turn-accumulator.ts`: không đột biến `acc`, thêm nhánh `never` trong `switch`, bỏ `export` của `collectEvent`.
  - [ ] `create-ai-chat-store.ts`: tách `runTurn` (khoảng 76 dòng) thành các hàm dưới khoảng 40 dòng.
  - [ ] (nit) `set({ isSending: false })` trong `finally` quanh `finishTurn`; sửa comment trần 32768 ký tự; không hẹn khung hình khi văn bản đã cắt không đổi; tách hai test đang kiểm hai hành vi.
- **Ghi chú cho người tiếp theo**
  - Test lỗi ở `editor-workspace.test.tsx` là do máy tải nặng, chạy lại thì PASS.
  - Task 25/27b phải ẩn nút "Chấp nhận" khi `editor.proposal?.messageId` khác tin, vì `acceptProposal` của store ném lỗi trong trường hợp đó.
  - Có thể chạy `ecc:react-reviewer` (chỉ review) cho provider khi Task 27b nối nó vào cây thật.
