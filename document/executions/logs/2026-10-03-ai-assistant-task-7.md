# Task 7: `buildAiFindings`

- Plan: [Task 7](../../plans/2026-10-03-ai-assistant-plan.md#task-7-buildaifindings)
- Spec: [AI-R35](../../specs/2026-10-02-ai-assistant-design.md) (mục 8), AI-R63

## 2026-10-03 — core-engineer — Xong

- **Đã làm**
  - Viết test trước (`build-ai-findings.test.ts`, 9 test), chạy thấy đỏ vì chưa có module (`Cannot find module './build-ai-findings.js'`), rồi cài đặt `buildAiFindings`, chạy lại xanh.
  - `buildAiFindings(original, input)` dịch `table`, `columns` của mỗi mục `reportFindings` sang `targets` theo id trên tài liệu gốc, chỉ qua `findTableByName`, `findColumnByName` (Task 3), nên tên `__proto__`, `toString` không chạm prototype (AI-R63). Gom mọi lỗi của mọi mục theo thứ tự input; có lỗi thì trả `err`.
  - Export type `AiFinding`, `AiFindingTarget` từ file (chưa export qua `src/ai/index.ts`, việc của Task 5).
- **File thay đổi**
  - `packages/core/src/ai/build-ai-findings.ts` (mới)
  - `packages/core/src/ai/build-ai-findings.test.ts` (mới)
  - `document/executions/logs/2026-10-03-ai-assistant-task-7.md` (log này)
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core src/ai/build-ai-findings.test.ts`: đỏ trước khi cài đặt, `RESULT: PASS` sau đó.
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, test, build, prettier); 2837 test pass; coverage dòng của core 97,7%. Lượt đầu bị lint `restrict-template-expressions` (số trong template) và prettier của file test; đã sửa bằng `String(index)` và `prettier --write`.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - `at` của lỗi: `findings.<i>` nối với đường dẫn theo tên giống Task 4, 8: bảng không có là `findings.<i>.tables.<tên yêu cầu>`, cột không có là `findings.<i>.tables.<bảng>.columns.<tên yêu cầu>`, `columns` mà không có `table` là `findings.<i>`. Mọi tên qua `formatAiName`. Plan viết "dạng `findings.<i>.table` theo tên được yêu cầu"; chọn dạng `tables.<tên>` để tên được yêu cầu nằm trong `at` (test `returns table-name-not-found with the requested name`) và khớp cách viết đường dẫn theo tên ở chỗ khác.
  - `path` là vị trí trong input (không có phần tử nào trong tài liệu để trỏ tới): `["findings", i, "table"]`, `["findings", i, "columns", j]`, `["findings", i]` cho `columns` không có `table`. Không chứa id hay tên.
  - Bảng không tìm thấy thì không tra cột của mục đó (không có bảng để tìm trong); các cột thiếu của cùng một mục đều được báo.
  - `columns` rỗng xử lý như không có `columns` (hình dạng đã chặn `min(1)`, nhánh này chỉ để không mất đích bảng).
  - `kind`, `category` của `AiFinding` lấy từ type của input (`AiFindingsInput`) thay vì viết lại hai union, để một nguồn duy nhất là hình dạng Zod của Task 2; giá trị trùng plan.
  - Không gộp đích trùng khi model nêu một cột hai lần (spec không yêu cầu; `columns` ≤ 16 nên `targets` vẫn ≤ 20 của `aiFindingsDataSchema`).
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 5 thêm `buildAiFindings`, `AiFinding` (và `AiFindingTarget` nếu cần) vào `src/ai/index.ts`.
  - Task 10, 16: backend kiểm `AiFinding` bằng `satisfies` với một mục của `aiFindingsDataSchema`; `findings-limit` (tổng của lượt) do backend xử lý.
