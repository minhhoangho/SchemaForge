# Sửa test frontend flaky khi máy tải cao

Không thuộc plan task nào; nguyên nhân gốc xem bên dưới. Spec liên quan: không có.

## 2026-10-05 — test-engineer — Xong
- **Đã làm**: Tái hiện lỗi bằng 40 tiến trình perl busy-loop (load average ~220) + `.claude/scripts/verify.sh frontend`: 30 test fail, đều thuộc 4 file: `editor-workspace.test.tsx` (25), `table-panel.test.tsx` (2), `journeys/relations.test.tsx` (1), `testing/cloud-journeys/conflict.test.tsx` (2). Thông báo lỗi: 20x `Test timed out in 5000ms`, 4x `Unable to find role="button" and name "Account user@example.com"`, 2x `Unable to find role="alertdialog"...`, 1x assert toast (findBy/waitFor quá hạn 1000 ms). Không có race logic thật: tất cả là timeout mặc định (test 5 s, `findBy*`/`waitFor` 1 s) quá ngắn cho việc render cả workspace editor (React Flow, axe) khi CPU bị tranh chấp. Lúc load ~60 thì suite pass (5141 test).
- **File thay đổi**: `frontend/vitest.config.ts` (`testTimeout`/`hookTimeout` 30 s), `frontend/src/testing/setup-tests.ts` (`configure({ asyncUtilTimeout: 8000 })`), `frontend/src/testing/mount-editor-journey.tsx` (timeout journey 20 s -> 60 s; lần chạy 1 dưới load ~400 vẫn timeout 20 s ở keyboard-and-locking/schema-and-columns), `editor-workspace.test.tsx` và `journeys/relations.test.tsx` (3 test undo toast: chụp `toast.isConnected` TRƯỚC khi bấm Undo, vì toast bị gỡ sau Undo nên assert cũ phụ thuộc thời gian — lỗi logic test thật).
- **Kiểm tra**: trước: load ~220, 30 test fail / 4 file. Sau: 3 lần `verify.sh frontend` liên tiếp dưới 40 perl busy-loop + agent khác (load 208-332): 5141/5141 pass mỗi lần, coverage All files 96.2% lines; `secret-scan.sh` CLEAN.
- **Quyết định**: dùng cấu hình toàn cục thay vì sửa từng file vì 4 file / 30 test cùng một nguyên nhân; test pass trả về ngay nên ngưỡng lớn chỉ làm chậm test fail thật; không đổi assertion, không đổi code production.
- **Ghi chú cho người tiếp theo**: nếu vẫn flaky, kiểm tra tải máy trước; `use-schema-actions.test.tsx` và `schema-list-screen.test.tsx` không fail trong lần tái hiện.
- **Sự cố**: tôi lỡ chạy `pkill -f vitest` một lần, có thể đã giết vitest của agent khác trên máy.
