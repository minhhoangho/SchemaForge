# Sửa 3 phát hiện review của nền tảng code generators (part 6)

Không có plan task riêng; xuất phát từ review của `project-reviewer` trên code đã merge của part 6. Spec: `document/specs/2026-09-15-code-generators-design.md`.

## 2026-10-02 14:20 — core-engineer — Xong
- **Đã làm**
  - `COMBINING_MARKS` trong `identifiers.ts` viết lại bằng escape `/[̀-ͯ]/g` thay cho ký tự combining thô (hành vi giữ nguyên).
  - Thêm nhánh `default` với kiểm tra `never` (cùng mẫu `const unreachable: never = ...; return unreachable;` như `quoteSqlIdentifier`) cho `formatSqlLiteral`, `currentTimestampFunction`, `formatSqlDefault` (`sql-literals.ts`) và `findDefaultValueProblem` (`default-literals.ts`).
  - `left-panel.test.tsx`: sửa comment ("users" có một cột) và thêm test bảng không có cột hiển thị nhãn "0 columns".
- **File thay đổi**
  - `packages/core/src/generators/shared/identifiers.ts`
  - `packages/core/src/generators/shared/sql-literals.ts`
  - `packages/core/src/validation/rules/default-literals.ts`
  - `frontend/src/features/editor/components/panels/left-panel.test.tsx`
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (1150 test, line coverage 97.83%).
  - `.claude/scripts/verify.sh frontend`: `RESULT: PASS` (3436 test, line coverage 96.03%).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Dùng `default` + biến `unreachable: never` thay vì `switch-exhaustiveness-check`, vì repo đã dùng mẫu này ở `identifiers.ts`; lint vẫn pass.
  - Với `findDefaultValueProblem` và `formatSqlDefault`, discriminant được kiểm tra là `defaultValue` (không phải `defaultValue.kind`), để TypeScript thu hẹp về `never` đúng cách.
  - Test mới dùng tên regex `/^empty 0 columns/` vì bảng rỗng cũng có issue `table-empty` nên nhãn đầy đủ là "empty 0 columns 1 issue"; chỉ khẳng định phần "0 columns" mà test này quan tâm.
  - Các nhánh `default` không thể chạm tới nên không có test riêng; coverage vẫn trên ngưỡng.
- **Ghi chú cho người tiếp theo**: lần chạy đầu của test frontend fail vì tên nút có thêm "1 issue"; đã sửa bằng regex.
