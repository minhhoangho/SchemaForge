# Task 9: Tên ràng buộc do generator đặt

- Plan: [Task 9](../../plans/2026-09-15-code-generators-plan.md#task-9-tên-ràng-buộc-do-generator-đặt)
- Spec: [mục 5, "Tên ràng buộc do generator đặt"](../../specs/2026-09-14-code-generators-design.md#tên-ràng-buộc-do-generator-đặt)

## 2026-10-02 14:35 — core-engineer — Xong

- **Đã làm**
  - Viết test trước (`constraint-names.test.ts`), chạy thấy đỏ vì chưa có module (`Cannot find module './constraint-names.js'`), rồi cài đặt đến khi xanh.
  - `buildConstraintName`: quy ước PostgreSQL (`<bảng>_pkey`, còn lại nối bảng, các cột, hậu tố bằng `_`); tên quá 63 byte UTF-8 → `truncateToUtf8Bytes(tên, 54) + "_" + fnv1a32Hex(tên)`.
  - `fnv1a32Hex`: FNV-1a 32 bit (`Math.imul`, `>>> 0`) trên byte UTF-8 tự mã hóa theo code point; surrogate lẻ mã hóa như U+FFFD.
  - `allocateConstraintNames`: một `NameAllocator` (`caseAndAccentInsensitive`, `_`, 63 byte), `reserved` = tên mọi bảng (`sortTables`) và mọi index người dùng (`sortIndexes`); cấp theo bảng (`pkey`, rồi theo `columnIds`: `key`, `check`, `idx`) rồi theo `sortRelations` (`fkey`, cột nguồn theo `orderColumnPairs` được tiêm vào).
- **File thay đổi**
  - `packages/core/src/generators/shared/constraint-names.ts` (mới)
  - `packages/core/src/generators/shared/constraint-names.test.ts` (mới)
- **Kiểm tra**
  - RED: `.claude/scripts/test-file.sh core src/generators/shared/constraint-names.test.ts` → FAIL, `Cannot find module './constraint-names.js'`.
  - GREEN: cùng lệnh → `RESULT: PASS`.
  - `.claude/scripts/verify.sh core --build --format` → typecheck, lint, test (1172 test pass, line coverage 97.9%), build, prettier đều PASS; `RESULT: PASS`.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
  - `git status --porcelain` chỉ có hai file của task (cộng log này).
- **Quyết định**
  - Giá trị mong đợi FNV-1a cho chuỗi có dấu, emoji (4 byte) và surrogate lẻ tính một lần bằng `node -e` dùng `Buffer` ngoài core, ghi cứng trong test; hash của hai test cắt tên 64 byte và cắt giữa chữ có dấu cũng ghi cứng theo cách đó (kiểm tra thật, không gọi lại hàm đang test).
  - Kiểu hậu tố đặt tên `ConstraintSuffix` nhưng không export: plan chỉ yêu cầu union nội tuyến, người gọi truyền literal.
  - Tách phần cấp tên theo bảng ra hàm riêng `allocateTableConstraintNames` để mỗi hàm dưới 40 dòng; thứ tự cấp vẫn đúng plan (bảng trước, khóa ngoại sau).
  - Phần tử thiếu (cột hoặc bảng không tồn tại) bỏ qua bằng `?? []` / `?? ""` theo mẫu của `dialect-constraints.ts`; tài liệu đúng cấu trúc không bao giờ đi vào nhánh này.
  - Test "never renames a user index" dùng index thuộc bảng xếp sau bảng có cột unique, để chứng minh tên index được giữ chỗ trước khi cấp, không phụ thuộc thứ tự duyệt.
  - Không sửa barrel hay file dùng chung nào khác: `generators/shared/` là nội bộ, không cần export.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 13, 17, 18, 21 gọi `allocateConstraintNames(schema, orderColumnPairsByReferencedKey)` (Task 11) một lần cho mỗi lần chạy generator; tên không phụ thuộc dialect.
  - MySQL không ghi tên khóa chính (luôn `PRIMARY`) nhưng tên vẫn được cấp và chiếm chỗ trong allocator để mọi đích có cùng tên cho các ràng buộc còn lại.
