# Bỏ đường chi phí bậc hai của vị trí FK/check trong importer SQL

Spec: [2026-09-15-import-export-design.md](../../specs/2026-09-15-import-export-design.md) mục 1 và mục 5 ("Vị trí của diagnostic theo phần tử") · Nguồn: mục đầu tiên của "Việc còn lại" trong [2026-10-08-import-export-quadratic-fixes.md](2026-10-08-import-export-quadratic-fixes.md). Không có task plan riêng.

## 2026-10-08 — core-engineer — Xong

- **Đã làm**
  - `sql-element-locations.ts`: bỏ hàm `constraint` quét mọi `ALTER TABLE … ADD` của bảng cho từng lần gọi `foreignKey`/`check` (và bỏ `isSameNames`). Thay bằng `indexAddedConstraints`: một `Map` cục bộ trong lần gọi `locateSqlElements`, dựng một lần, khóa `JSON` của `[kind, name key của bảng, name key của từng cột FK theo thứ tự]` hoặc `[kind, name key của bảng, name key của tên check]`, giá trị là `start` của câu lệnh; chỉ ghi khi khóa chưa có nên giữ phần tử đầu tiên theo thứ tự nguồn như `find` cũ. Check không tên không được đưa vào (lookup cũ không bao giờ khớp nó); `check(t, null)` không tra map, trả về vị trí bảng như cũ.
  - Test: thêm test ghim hành vi (xanh trên code cũ) cho `foreignKey` (khớp không phân biệt hoa thường, giữ câu đầu tiên, thứ tự cột phải trùng, khác độ dài rơi về bảng, FK của bảng khác không khớp, bảng không có CREATE TABLE → `null`) và `check` (khớp tên không phân biệt hoa thường, giữ câu đầu tiên, tên `null` rơi về bảng, tên của FK không khớp check, check của bảng khác không khớp). Thêm hai test chống bậc hai với 1000 constraint trên một bảng.
- **File thay đổi**
  - `packages/core/src/importers/sql/sql-element-locations.ts`
  - `packages/core/src/importers/sql/sql-element-locations.test.ts`
- **Kiểm tra**
  - RED (code cũ): `.claude/scripts/test-file.sh core src/importers/sql/sql-element-locations.test.ts` → 2 failed | 16 passed; "expected 1001000 to be less than 10000" (FK) và "expected 1002000 to be less than 10000" (check). 16 test ghim hành vi xanh trên code cũ.
  - GREEN: cùng lệnh → `RESULT: PASS`.
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS` (typecheck, lint, test, build, prettier); 4679 test; line coverage 98 %.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
  - Đo trên `dist` (Node 24, `importPostgresql`, một bảng `t` N cột + N câu `ALTER TABLE t ADD FOREIGN KEY (cI) REFERENCES u (id);`, một lần chạy, `--cpu-prof`, máy có tải):
    - N = 4000: tổng 1 627 ms → 1 351 ms; self-time của `sql-element-locations` 265 ms → 10 ms.
    - N = 16 000 (bị chặn bởi `MAX_IMPORTED_ELEMENTS`, `isOk = false`, nhưng vị trí vẫn được dựng): tổng 20 455 ms → 15 655 ms; `sql-element-locations` 4 531 ms → 21 ms. Phần còn lại chủ yếu là `@dbml/core`.
- **Quyết định**
  - Một `Map` phẳng với khóa ghép `[kind, bảng, tên…]` thay vì nhóm hai tầng (bảng → khóa): tương đương chính xác (cùng name key bảng, cùng danh sách name key theo thứ tự, cùng loại), ít mã hơn. `JSON.stringify` của mảng chuỗi nên không có va chạm khóa giữa các tên chứa dấu phân cách. `kind` nằm trong khóa nên FK và check không lẫn nhau.
  - Map là biến cục bộ trong `locateSqlElements`, không có state cấp module; dựng sẵn (eager) như `groupByTable` cũ.
  - Test chống bậc hai không đo thời gian: FK đếm số lần đọc mảng `columnNames` truyền vào qua `Proxy` (như các test trước); check không có đối tượng nào để bọc `Proxy` (tên là chuỗi) nên đếm số lần gọi `String.prototype.toLowerCase` (cách `toNameKey` gấp tên) bằng `vi.spyOn`, chỉ trong khoảng các lần lookup, rồi `mockRestore`. Ngưỡng 10 × số constraint; bản cũ vượt khoảng 100 lần.
- **Việc còn lại** (ngoài phạm vi, đã có trong log trước)
  - [ ] Ngữ nghĩa so khớp FK lặp cột trong `sql-column-set-lookup.ts` (xem log `2026-10-08-import-export-quadratic-fixes.md`).
  - [ ] `@dbml/core` vẫn chiếm phần lớn thời gian với nhiều `ALTER TABLE` (khoảng 1,3 s ở N = 4000, 15 s ở N = 16 000); chỉ chặn được bằng hủy worker (spec mục 14).
- **Ghi chú cho người tiếp theo**
  - Test check dùng `vi.spyOn(String.prototype, "toLowerCase")`: nếu `toNameKey` đổi cách gấp tên (không còn gọi `toLowerCase`), test này phải đổi cách đếm theo.
  - Script đo ở scratchpad (ngoài repo): import `dist/importers/sql/index.js` và `dist/testing/import-test-options.js`, chạy `node --cpu-prof`, cộng self-time theo URL chứa `sql-element-locations`.
