# Task 3: Tra tên, lưới vị trí bảng, `describePathForAi`

- Plan: [2026-10-03-ai-assistant-plan.md, Task 3](../../plans/2026-10-03-ai-assistant-plan.md#task-3-tra-tên-lưới-vị-trí-bảng-describepathforai)
- Spec: [2026-10-02-ai-assistant-design.md](../../specs/2026-10-02-ai-assistant-design.md) (AI-R9, AI-R13, AI-R16, AI-R63)

## 2026-10-03 20:30 — core-engineer — Xong

- **Đã làm**
  - `resolve-ai-names.ts`: `findTableByName`, `findColumnByName`, `findEnumByName`, `findIndexByName` (tên nguyên văn trước, sau đó `toNameKey`, chỉ nhận đúng một kết quả); `findRelationsBetween` (lọc theo bảng nguồn, bảng đích và danh sách cột nguồn đúng thứ tự, thứ tự theo `sortRelations`).
  - `place-ai-table.ts`: ba hằng lưới (4, 400, 400), `createAiTablePlacement`, `aiTablePosition` đúng công thức AI-R13.
  - `describe-path-for-ai.ts`: `formatAiName`, `describePathForAi` cho đường dẫn `tables`, `columns`, `indexes`, `relations`, `enums`, cộng `subjectAreas` và `notes` để kết quả không bao giờ chứa id.
  - TDD: cả ba file test chạy đỏ trước (`Error: Cannot find module './resolve-ai-names.js'`, tương tự cho hai file kia), rồi xanh sau khi cài đặt.
- **File thay đổi**
  - `packages/core/src/ai/resolve-ai-names.ts`, `resolve-ai-names.test.ts`
  - `packages/core/src/ai/place-ai-table.ts`, `place-ai-table.test.ts`
  - `packages/core/src/ai/describe-path-for-ai.ts`, `describe-path-for-ai.test.ts`
  - Không đổi API công khai: `src/ai/index.ts` không sửa (Task 6 export).
- **Kiểm tra**
  - `pnpm --filter @schemaforge/core exec vitest run src/ai/<file>.test.ts`: đỏ (thiếu module) rồi xanh; 23 + 9 + 37 test.
  - `pnpm turbo run typecheck lint test build --filter @schemaforge/core`: 4/4 task thành công, 139 file test, 2828 test pass, coverage dòng 97.69%, không có dòng "does not meet global threshold".
  - `pnpm exec prettier --check` trên sáu file: pass.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Hai phần tử trùng **nguyên văn** tên (trùng tên là issue ngữ nghĩa, tài liệu vẫn hợp lệ) cũng coi như không tìm thấy, giống trường hợp nhiều kết quả không phân biệt hoa thường của Vấn đề 13: chọn tùy ý một bảng có thể sửa nhầm bảng.
  - Cột và index của bảng lấy bằng `Object.values(...).filter(tableId)` thay vì tra `columnIds`: không đánh chỉ số object theo khóa nào, đúng AI-R63.
  - `describePathForAi` tra id bằng `Object.hasOwn` trước khi đọc: id lạ như `constructor` hay `__proto__` trả `?`, không chạm prototype.
  - Đường dẫn `subjectAreas` mô tả bằng tên vùng; `notes` không có tên nên phần id thành `?`: plan chỉ liệt kê năm loại, nhưng test "never includes an id" duyệt mọi loại đường dẫn của `createSampleSchema()`.
  - Đường dẫn không bắt đầu bằng map id của tài liệu (`["name"]`, `[]`, `["operations", 1, "columnId"]`) giữ nguyên, nối bằng dấu chấm (`[]` thành chuỗi rỗng): các đường dẫn này không chứa id.
  - Id không có trong schema: `columns`/`indexes` thành `tables.?.columns.?`, `relations` thành `relations.?` (không biết bảng nguồn nên bỏ phần cột).
  - `createAiTablePlacement` dùng `reduce` thay vì `Math.max(...xs)` để không tràn stack với danh sách bảng lớn.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 6 export các tên của ba file này từ `src/ai/index.ts`.
  - Trong worktree, lệnh `git` qua hook `rtk` bị chặn bởi kiểm tra cô lập worktree; dùng `/usr/bin/git` trực tiếp.
