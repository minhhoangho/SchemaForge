# Sửa phát hiện của security review 1 cho importer (phần 7)

Plan: [2026-10-03-import-export-plan.md](../../plans/2026-10-03-import-export-plan.md) · Spec: [2026-09-15-import-export-design.md](../../specs/2026-09-15-import-export-design.md) mục 1 · Nguồn: security review 1 (`2026-10-05-import-export-security-review-1.md`).

## 2026-10-05 — core-engineer — Xong

- **Đã làm**
  - HIGH-1: `checkStructuralInvariants` dựng `Map<tableId, columnId[]>` một lần cho cả tài liệu thay vì lọc mọi cột cho từng bảng (O(bảng × cột) → O(n)). Đã rà `parse/`, `assemble-document.ts`, `resolve-references.ts`, `place-elements.ts`, `assign-import-ids.ts`, `draft-target-path.ts`, `pick-unused-name.ts`: không còn mẫu bậc hai nào khác (name claimer và nhóm bảng của layout đã tuyến tính).
  - HIGH-1b: `importJson` đếm phần tử trên JSON vừa parse (7 map, chỉ map là object thường) trước `parseSchemaDocument`, trả `too-many-elements`; vẫn giữ lần đếm sau parse phòng khi migration đổi map. `countDocumentElements` nhận `Readonly<Record<string, unknown>>`, map không phải object đếm 0.
  - HIGH-2: `DELIMITER` MySQL chỉ được nhận khi delimiter dài tối đa `MAX_DELIMITER_LENGTH = 16`; dài hơn thì dòng đó thành text của câu lệnh và đi tiếp đường `statement-not-supported` sẵn có.
  - MEDIUM: scanner dừng khi vượt `MAX_SCANNED_TOKENS = MAX_IMPORT_SOURCE_LENGTH / 4` (524 288) token và trả `source-too-large` không vị trí. Lỗi của scanner thành `StatementScanFailure` (`{ code: "syntax-error", offset } | { code: "source-too-large" }`); `import-sql.ts` đổi 3 dòng để chuyển `code` sang diagnostic.
  - MEDIUM: `assembleDocument` không throw nữa: tài liệu không qua `parseSchemaDocument` và `RangeError` của `elementAt` (vị trí ngoài draft) đều thành `parse-failed` không vị trí; lỗi khác vẫn throw.
- **File thay đổi**
  - `packages/core/src/parse/structural-invariants.ts` (+ test)
  - `packages/core/src/importers/json/import-json.ts` (+ test)
  - `packages/core/src/importers/shared/import-limits.ts` (+ test)
  - `packages/core/src/importers/shared/assemble-document.ts` (+ test: 2 test "throws" đổi thành "returns parse-failed")
  - `packages/core/src/importers/shared/resolve-references.ts` (chỉ comment của `elementAt`)
  - `packages/core/src/importers/sql/statement-scanner.ts` (+ test)
  - `packages/core/src/importers/sql/import-sql.ts` (+ test)
- **Kiểm tra**
  - RED trước khi sửa: `structural-invariants.test.ts` "expected 4006000 to be less than 20000"; `import-json.test.ts` trả danh sách `invalid-shape` thay vì `too-many-elements`; `statement-scanner.test.ts` 5 test đỏ; `assemble-document.test.ts` "Error: Importer built an invalid document…" và "RangeError: No draft element at position 5".
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS`, 4527 test, line coverage 97.92 %.
  - Đo trên `dist` (máy đang tải nặng), trước → sau: Prisma 8000 model 14 455 ms → 147 ms; Prisma 10 000 model 24 253 ms → 148 ms; DBML 10 000 bảng 43 540 ms → 1 539 ms; MySQL `DELIMITER` 40 000 ký tự + 200 000 `+` 39 901 ms → 71 ms; MySQL 2 MiB `(` 1 039 ms (ok, 2 triệu token) → 161 ms (`source-too-large`).
- **Quyết định**
  - Test chống bậc hai đếm số lần đọc map `columns` qua `Proxy` (2000 bảng, ngưỡng 10 × số bảng) thay vì đo thời gian: test không phụ thuộc đồng hồ (testing.md); bản bậc hai đọc 4 006 000 lần.
  - Delimiter tối đa 16 ký tự: delimiter thật (`;;`, `//`, `$$`) chỉ vài ký tự; mỗi token chi phí so sánh ≤ 16.
  - Giới hạn token = `MAX_IMPORT_SOURCE_LENGTH / 4`: DDL sinh ra trung bình 5,7–9,5 ký tự/token, dữ liệu seed 4,5–4,75 (đo trên snapshot generator), nên nguồn thật ở đúng giới hạn độ dài vẫn dưới mức này.
  - **Đáng chú ý:** mã cho giới hạn token là `source-too-large` (không phải `too-many-elements`): token không phải phần tử (2 MiB `(` không có phần tử nào), còn bản dịch "Nguồn quá lớn để import." đúng nghĩa; vị trí `null` như `source-too-large` sẵn có.
  - **Đáng chú ý:** `assembleDocument` trả `parse-failed` thay vì throw theo task, trái với câu cuối gạch đầu dòng "Không throw với input bất kỳ" ở spec mục 1 ("Lỗi do chính importer tạo tài liệu sai cấu trúc là lỗi lập trình, nên throw"). Spec cần sửa theo. Chỉ bắt `RangeError` (của `elementAt`, kể cả tràn ngăn xếp), lỗi khác (ví dụ `generateId` của nơi gọi) vẫn throw.
  - `import-sql.ts` và `import-sql.test.ts` nằm ngoài scanner/lexer nhưng phải sửa để diagnostic mang đúng mã; thay đổi chỉ 3 dòng code và 1 test.
- **Việc còn lại** (ngoài phạm vi, đề xuất task riêng)
  - [ ] Spec mục 1: sửa câu "Lỗi do chính importer tạo tài liệu sai cấu trúc là lỗi lập trình, nên throw" thành `parse-failed`, và ghi giới hạn token SQL (`source-too-large`) cùng giới hạn độ dài `DELIMITER`.
  - [ ] `packages/core/src/importers/prisma/prisma-relations.ts`: `findBackField` (dòng ~95, `target.fields.find`) và `hasNullableField` (dòng ~187, `model.fields.some` + `includes`) quét mọi field của model cho từng field quan hệ, O(quan hệ × field). Đo: 2 model, 4000 quan hệ có tên → 1,5–2,8 s; ở giới hạn 20 000 phần tử ước tính trên 10 s. Sửa: dựng `Map` field theo (typeName, tên quan hệ) và `Set` tên field optional một lần mỗi model.
  - [ ] `packages/core/src/importers/dbml/dbml-relations.ts` dòng ~65: `tables.some(isInside…)` cho mỗi ref, O(ref × bảng). Đo: 6000 bảng + 5999 ref → 5–11 s, trong đó `@dbml/core` tự parse chiếm khoảng 60 %. Sửa: sắp token bảng theo `start` và tìm nhị phân; phần của thư viện chỉ chặn được bằng hủy worker (spec mục 14).
  - [ ] Các vòng lặp theo bảng trong `importers/sql/` (`sql-draft-relations.ts` `isUniqueColumnSet`, `sql-draft-index-rules.ts` `findDefinition`) là O(phần tử × phần tử cùng bảng); chưa đo, đang có agent khác review `importers/sql/`.
- **Ghi chú cho người tiếp theo**
  - Scanner đếm token trên toàn nguồn (mọi câu, kể cả dữ liệu); dữ liệu `COPY … FROM stdin` không lex nên không tính.
  - Test 40 000 ký tự `DELIMITER` trong `statement-scanner.test.ts` chạy chậm (vài chục giây) nếu bỏ giới hạn độ dài: đó là tín hiệu hồi quy.
