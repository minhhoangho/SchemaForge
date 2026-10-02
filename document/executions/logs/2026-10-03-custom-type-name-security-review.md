# Review bảo mật: siết tên kiểu custom

Không có plan task. Review chỉ đọc (read-only) cho commit `c5071c5` (xem [log sửa](2026-10-03-custom-type-name-hardening.md)). Spec liên quan: [core schema model, kiểu custom](../../specs/2026-09-14-core-schema-model-design.md), [code generators, R26](../../specs/2026-09-14-code-generators-design.md).

## 2026-10-03 — ecc:security-reviewer — Xong

- **Đã làm**
  - Review lần hai việc siết ngữ pháp tên kiểu custom (`packages/core/src/validation/rules/custom-type-name.ts`) và các cổng chặn trong generator SQL.
  - Kết luận: duyệt, kèm sửa nhỏ (đã sửa, xem dưới).
  - Không có chèn câu lệnh, cột thừa, ràng buộc, biểu thức hay default trên PostgreSQL, MySQL, SQL Server: ngữ pháp chỉ ASCII, không cho `;`, dấu nháy, `=`, `-`, `/`, xuống dòng, NUL; chỉ một danh sách đối số cuối cân bằng; 17 từ khóa cấm. `MASKED WITH` và `ENCRYPTED WITH` cần `=` hoặc dấu nháy nên không dựng được.
  - Cổng chặn vững: `generators/shared/dialect-types.ts` (`isSafe`) và `sql-ddl-model-tables.ts` (`resolveSafeType`) thay kiểu custom không an toàn bằng kiểu văn bản kèm diagnostic `custom-type-unsafe` cho mọi cột, độc lập với validation.
  - Không ReDoS.
  - Lỗ hổng test đã sửa trong cùng commit: chữ hoa thường lẫn lộn, `\n`, NUL, từ trông giống từ khóa.
- **File thay đổi**: không (review chỉ đọc); log này.
- **Kiểm tra**: không chạy lệnh ghi; kết luận từ đọc code và test.
- **Quyết định**
  - LOW, rủi ro còn lại được chấp nhận: các từ chỉ là thuộc tính cột (MySQL `UNSIGNED`, `ZEROFILL`, `INVISIBLE`, `CHARACTER SET`, `SRID`; SQL Server `SPARSE`, `ROWGUIDCOL`, `FILESTREAM`; PostgreSQL `STORAGE`, `COMPRESSION`) đổi ngữ nghĩa cột nhưng không thêm mệnh đề.
  - INFO: các renderer tin `isSafe` theo quy ước, không tự kiểm lại.
- **Việc còn lại**
  - [ ] Thêm test cấp generator: kiểu custom không an toàn rơi về `text` (PostgreSQL), `LONGTEXT` (MySQL), `nvarchar(max)` (SQL Server) kèm `custom-type-unsafe`. Hiện chỉ PostgreSQL được ghim trong `packages/core/src/generators/sql-ddl-model.test.ts`; MySQL và SQL Server chưa có. Đã giao dưới dạng test task.
- **Ghi chú cho người tiếp theo**: bắt đầu từ `sql-ddl-model.test.ts` để lấy mẫu test PostgreSQL; hàm cần phủ là `resolveSafeType` trong `sql-ddl-model-tables.ts`.
