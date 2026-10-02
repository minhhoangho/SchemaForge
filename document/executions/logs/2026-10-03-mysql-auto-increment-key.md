# Sửa CG-01 MySQL: index thay thế cho cột AUTO_INCREMENT nằm trong CREATE TABLE

- Plan: [Task 15](../../plans/2026-09-15-code-generators-plan.md) (CG-01 MySQL)
- Spec: [code generators](../../specs/2026-09-14-code-generators-design.md) mục 4, R8, R14 (R25 do spec-writer ghi song song)

## 2026-10-03 04:20 — core-engineer — Xong

- **Đã làm**: Conformance Task 29 trên MySQL 8.4 báo lỗi 1075 với fixture `target-limit`: index thay thế `<bảng>_<cột>_idx` của cột `AUTO_INCREMENT` (bảng `auto_trailing`, `auto_wide_key`) được ghi bằng `CREATE INDEX` sau mọi bảng, trong khi MySQL kiểm tra lỗi 1075 ngay lúc `CREATE TABLE`. Printer MySQL giờ ghi index đó thành dòng `` KEY `<tên>` (`<cột>`) `` trong thân `CREATE TABLE`, sau `PRIMARY KEY` và các `CONSTRAINT … UNIQUE`; index đó bị loại khỏi danh sách `CREATE INDEX`. Chỉ sửa printer (`findInlineIndexes`, `renderInlineIndex` trong `generate-mysql.ts`), không đụng `generators/shared/`.
- **File thay đổi**:
  - `packages/core/src/generators/mysql/generate-mysql.ts`
  - `packages/core/src/generators/mysql/generate-mysql.test.ts` (sửa test index thay thế cũ theo kỳ vọng mới, thêm test index người dùng dẫn đầu bằng cột auto)
  - `packages/core/src/generators/__snapshots__/mysql/target-limit.sql` (2 dòng `KEY` vào `auto_trailing`, `auto_wide_key`; bỏ 2 câu `CREATE INDEX` tương ứng; `.diagnostics.txt` không đổi)
- **Kiểm tra**:
  - RED: `.claude/scripts/test-file.sh core src/generators/mysql/generate-mysql.test.ts` → `Tests  2 failed | 32 passed (34)` (index vẫn ra ở `CREATE INDEX`)
  - GREEN: cùng lệnh → chỉ còn snapshot `target-limit` lệch; `--update-snapshots` → `RESULT: PASS`
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS`, 2254 test, line coverage 97.67%
  - `.claude/scripts/secret-scan.sh` → CLEAN
- **Quyết định**:
  - Vị trí: sau `PRIMARY KEY` và các unique constraint, đúng quyết định của orchestrator; đây cũng là thứ tự sẵn có (cột, khóa chính, ràng buộc) nên không chọn chỗ khác.
  - Tổng quát hóa trong printer: với mỗi cột `AUTO_INCREMENT` mà khóa chính lẫn unique constraint trong `CREATE TABLE` không dẫn đầu, index **đầu tiên** (theo thứ tự `model.indexes`) có cột đầu là cột đó được ghi trong `CREATE TABLE` (`UNIQUE KEY` nếu unique). Lý do: `findAutoIncrementIndexColumnIds` ở `shared/dialect-constraints.ts` coi index người dùng dẫn đầu bằng cột auto là đủ cho R14 nên không sinh index thay thế, nhưng index đó vẫn là `CREATE INDEX` sau bảng, tức cùng lỗi 1075. Với index thay thế, kết quả trùng đúng quyết định orchestrator; mọi index khác giữ nguyên vị trí. Nếu orchestrator muốn chỉ áp dụng cho index thay thế, cần cờ nhận diện trong model chung (ngoài phạm vi).
  - Nhận diện bằng tên cột đã ghi (`column.name`, `index.columnNames[0]`) và `tableName`, vì cả hai cùng lấy từ `context.columnName` và tên bảng gốc trong model chung.
- **Ghi chú cho người tiếp theo**: Orchestrator chạy lại conformance MySQL (Task 29) sau khi merge. Spec R25 nên ghi thêm trường hợp index người dùng dẫn đầu cột auto (xem Quyết định).
