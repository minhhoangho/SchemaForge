# Task 8: `buildAiSampleDataset` (AI-06)

Plan: [Task 8](../../plans/2026-10-03-ai-assistant-plan.md#task-8-buildaisampledataset-ai-06). Spec: [AI-R41, AI-R42](../../specs/2026-10-02-ai-assistant-design.md#9-dữ-liệu-mẫu-ai-06).

## 2026-10-03 20:27 — core-engineer — Xong

- **Đã làm**
  - Viết test trước (RED: `.claude/scripts/test-file.sh core packages/core/src/ai/build-ai-sample-dataset.test.ts` → `Error: Cannot find module './build-ai-sample-dataset.js'`), rồi cài đặt (GREEN: cùng lệnh → `RESULT: PASS`, 52 test).
  - `buildAiSampleDataset(original, input): Result<SeedDataset, readonly AiEditError[]>`: kiểm tổng số dòng, dịch tên bảng, cột bằng `findTableByName`, `findColumnByName`, giữ dòng trong `Map<ColumnId, …>` rồi `Object.fromEntries`, chuyển chuỗi sang giá trị JSON theo kiểu cột, rồi gọi `validateSeedDataset` và viết lại đường dẫn issue theo tên.
  - Cột `json`: `JSON.parse` trong `try`/`catch`, đo độ sâu bằng stack tường minh (nguyên thủy = 0, mỗi mảng hoặc object bao ngoài +1), vượt `AI_MAX_SAMPLE_DEPTH` (4) thì `seed-value-invalid`; type guard `isJsonWithinDepth` cũng từ chối giá trị không phải JSON nên không cần `as`.
- **File thay đổi**
  - `packages/core/src/ai/build-ai-sample-dataset.ts` (mới)
  - `packages/core/src/ai/build-ai-sample-dataset.test.ts` (mới)
  - `document/executions/logs/2026-10-03-ai-assistant-task-8.md` (log này)
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS` (typecheck, lint, test 2880/2880, build, prettier); line coverage core 97.67%; riêng file mới 96.51% dòng.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
  - `git status --porcelain` chỉ có hai file của task và log.
- **Quyết định**
  - Kiểm `sample-rows-limit` **trước** bước dịch tên (plan đánh số dịch là (1), giới hạn là (2)): rẻ hơn và chặn khối lượng tra tên; kết quả quan sát được chỉ khác khi input vừa quá 200 dòng vừa sai tên (chỉ báo `sample-rows-limit`). Lỗi này có `path: ["tables"]`, `at: "tables"`.
  - `table-name-not-found`: `path: ["tables", i]`, `at: tables.<tên được yêu cầu>` (không có dòng hay cột nào để nối thêm); các dòng của bảng đó không được dịch.
  - `column-name-not-found`: `path: ["tables", i, "rows", j]` (không có `ColumnId` để đặt vào đường dẫn, không đưa tên vào `path`), `at: tables.<bảng>.rows.<j>.<tên cột được yêu cầu>`.
  - `seed-value-invalid` (chuyển đổi hỏng hoặc cột lặp): `path: ["tables", i, "rows", j, columnId]`, `at` dùng tên thật trong schema (cột lặp có thể khác hoa thường, ví dụ `int` và `INT`).
  - Mọi tên trong `at` đi qua `formatAiName`. Lỗi được gom theo thứ tự input (bảng, dòng, ô); issue của `validateSeedDataset` giữ thứ tự đã sắp của nó. Không cắt còn 5 lỗi: việc đó thuộc backend (`AI_MAX_TOOL_ERRORS_PER_CALL`, Task 18).
  - Số nguyên chuỗi khớp `/^-?\d+$/` nhưng tràn thành `Infinity` cũng bị `seed-value-invalid` ngay (cùng hàm `toFiniteNumber` với số thực); số ngoài miền `smallint`/`integer` vẫn để `validateSeedDataset` báo.
  - Cache tra cột theo tên trong một bảng (`Map<string, Column | null>`), vì `findColumnByName` duyệt mọi cột của schema mỗi lần gọi.
  - `JsonValue` lấy bằng `Exclude<SeedRow[ColumnId], undefined>` để chỉ import từ `src/generators/seed/` (không import `generators/shared/`).
  - Không kiểm `AI_MAX_SAMPLE_ROWS_PER_TABLE` trong hàm: hình dạng Zod đã chặn (đúng plan).
- **Việc còn lại**: không. Export `buildAiSampleDataset` ở `src/ai/index.ts` là việc của Task 5.
- **Ghi chú cho người tiếp theo**
  - Test thêm ngoài danh sách tối thiểu: `accepts exactly 200 rows in one call`, `describes a seed issue on a table entry by the table name` (bảng lặp → `seed-order-invalid` với `at: tables.extras`), `quotes a name that is not a plain identifier`, ca biên `json nested exactly 4 deep`.
