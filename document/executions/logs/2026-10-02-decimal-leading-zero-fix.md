# Sửa lỗi decimal(p, p) trong default-literals

Spec: `document/specs/2026-09-14-core-schema-model-design.md` (dòng 217). Liên quan: Task 10 của `document/plans/2026-09-15-code-generators-plan.md` (`decimalStringPattern`).

## 2026-10-02 14:35 — core-engineer — Xong
- **Đã làm**: `isValidDefaultLiteral` từng từ chối mọi giá trị của `decimal(p, p)` (kể cả `0`, `0.5`, `-0.12`) vì `LEADING_ZEROS_PATTERN = /^0+(?=[0-9])/` giữ lại một số `0` đơn lẻ như một chữ số được đếm. Đổi thành `/^0+/` để phần nguyên `0`/`00` đếm là 0 chữ số, đúng với spec ("không kể số 0 ở đầu"). Viết test trước, xác nhận đỏ, rồi sửa.
- **File thay đổi**:
  - `packages/core/src/validation/rules/default-literals.ts`
  - `packages/core/src/validation/rules/default-literals.test.ts` (thêm `decimal(2, 2)`: chấp nhận `0`, `0.5`, `-0.12`, `00.5`; từ chối `1.0`, `0.123`)
  - `packages/core/src/generators/shared/json-representation.test.ts` (thêm 6 dòng `decimal(2, 2)` vào test "agrees with isValidDefaultLiteral")
- **Kiểm tra**:
  - RED: `.claude/scripts/test-file.sh core src/validation/rules/default-literals.test.ts` -> `4 failed | 102 passed`; `.../json-representation.test.ts` -> `4 failed | 96 passed` (4 giá trị hợp lệ của decimal(2, 2)).
  - GREEN: cả hai file `RESULT: PASS` sau khi sửa.
  - `.claude/scripts/verify.sh core --build --format` -> `RESULT: PASS` (1287 test pass, line coverage 97.92%).
  - `.claude/scripts/secret-scan.sh` -> `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Dùng đúng `/^0+/` như task yêu cầu; không đụng `decimalStringPattern` vì nó đã chấp nhận `0+` (và `0*[0-9]{1,n}` cho p > s), nên đã khớp sau khi sửa.
  - Đã grep mọi nơi dùng `isValidDefaultLiteral`/`isValidDecimalLiteral`/`LEADING_ZEROS_PATTERN` trong `packages`, `frontend`, `backend`: chỉ có `default-literals.ts`, `json-representation.ts` (ủy quyền) và hai file test; không nơi nào phụ thuộc hành vi cũ. Với p > s, chuỗi `0`/`0.5`/`007.5` vẫn hợp lệ như trước (chỉ khác ở trường hợp p = s).
  - Với p > s, `isValidDecimalLiteral` cũng chấp nhận `0` ở phần nguyên như trước (0 chữ số sau khi bỏ số 0 đầu <= p - s).
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: orchestrator review và commit. Không có thay đổi API công khai, snapshot hay consumer nào bị ảnh hưởng.
