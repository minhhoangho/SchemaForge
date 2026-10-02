# Task 6: Định danh và `NameAllocator`

- Plan: [Task 6](../../plans/2026-09-15-code-generators-plan.md#task-6-định-danh-và-nameallocator)
- Spec: [2026-09-14-code-generators-design.md](../../specs/2026-09-14-code-generators-design.md), mục 5 ("Định danh SQL", "Định danh code", "Tên ràng buộc do generator đặt"), quyết định R12, Vấn đề 5 và 7

## 2026-10-02 — core-engineer — Xong

- **Đã làm**
  - Tạo `identifiers.ts`: `quoteSqlIdentifier`, `toAsciiWords`, `toPascalCaseIdentifier`, `toCamelCaseIdentifier`, `toKebabCaseSegment`, `withReservedWordSuffix`, `formatPropertyKey` (`__proto__` → `["__proto__"]`), `formatJsDocLines`, cùng helper `removeCombiningMarks` (NFD rồi bỏ U+0300–U+036F) dùng chung với allocator.
  - Tạo `name-allocator.ts`: `NameComparison`, `toComparisonKey` (ba mức; `caseAndAccentInsensitive` đổi thêm `đ`/`ø`/`ł`/`ħ` theo R12), `NameAllocator`, `createNameAllocator` (state trong closure, hậu tố `separator + n` từ 2, cắt phần gốc theo `maxBytes`), `truncateToUtf8Bytes` (dùng `utf8ByteLength` của `model/name-limits.ts`, duyệt theo code point nên không tách cặp surrogate).
  - Tạo `javascript-reserved-words.ts`: `JAVASCRIPT_RESERVED_WORDS` đúng danh sách của plan.
  - TDD: viết ba file test trước; RED là `Error: Cannot find module './identifiers.js'` (tương tự cho `./name-allocator.js`, `./javascript-reserved-words.js`); sau khi cài đặt cả ba file pass.
- **File thay đổi** (đều mới, trong `packages/core/src/generators/shared/`)
  - `identifiers.ts`, `identifiers.test.ts`
  - `name-allocator.ts`, `name-allocator.test.ts`
  - `javascript-reserved-words.ts`, `javascript-reserved-words.test.ts`
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core src/generators/shared/<file>.test.ts` cho từng file: RED rồi PASS.
  - `.claude/scripts/verify.sh core --build --format`: typecheck, lint, test, build, prettier đều PASS, `RESULT: PASS`; 936 test pass, coverage dòng toàn package 97.94%. Lần chạy đầu fail ở prettier (3 file), đã chạy `prettier --write` cho file sở hữu rồi chạy lại.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - `git status --porcelain`: chỉ 6 file của task và file log này.
- **Quyết định**
  - `removeCombiningMarks` đặt trong `identifiers.ts` và export nội bộ để `toAsciiWords` và `toComparisonKey` dùng chung một cách bỏ dấu (không lặp regex).
  - Thứ tự trong `caseAndAccentInsensitive` theo đúng plan: NFD và bỏ dấu, rồi `toNameKey`, rồi đổi `đ`/`ø`/`ł`/`ħ` (chữ hoa đã thành chữ thường nên chỉ cần bốn chữ thường).
  - `NameAllocatorOptions` không export: plan ghi option inline trong chữ ký, task sau chỉ cần truyền object.
  - `allocate` không cắt `preferred` khi tên còn trống, chỉ cắt phần gốc khi thêm hậu tố, đúng plan; tên ràng buộc đã được Task 9 rút về 63 byte trước khi vào allocator.
  - Không thêm `RangeError` cho `maxBytes` âm hay bằng 0: plan không yêu cầu, và vòng lặp vẫn dừng vì mỗi hậu tố cho một ứng viên khác nhau.
  - `toAsciiWords` coi từ "chỉ gồm chữ hoa và chữ số, có ít nhất một chữ cái" bằng regex `^[A-Z0-9]*[A-Z][A-Z0-9]*$` (`2FA` → `2fa`, thêm một ca test ngoài plan).
  - Thêm test `truncateToUtf8Bytes` dạng bảng (giới hạn 0, ký tự 2 byte, cặp surrogate) để ghim hành vi ở biên ngoài test qua allocator.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - `formatJsDocLines` không bỏ khoảng trắng đầu hoặc cuối của từng dòng comment; generator cần chuẩn hóa thì tự làm trước khi gọi.
  - `withReservedWordSuffix` so phân biệt hoa thường (`Class` không bị thêm `_`).
