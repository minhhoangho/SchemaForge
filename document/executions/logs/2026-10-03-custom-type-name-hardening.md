# Siết cú pháp an toàn của tên kiểu custom

Không có plan task (sửa bảo mật sau security review của code generators). Spec liên quan: [core schema model, mục kiểu custom](../../specs/2026-09-14-core-schema-model-design.md), [code generators, `custom-type-unsafe`](../../specs/2026-09-14-code-generators-design.md).

## 2026-10-03 04:55 — core-engineer — Xong

- **Đã làm**
  - `isSafeCustomTypeName` (điều kiện của issue `column-custom-type-invalid`, dùng chung với generator SQL qua `generators/shared/dialect-types.ts`) cũ cho phép dấu phẩy, khoảng trắng, ngoặc tùy ý nên chèn được mệnh đề cột vào `CREATE TABLE` (`text, extra_col int`, `int CHECK (x)`, `int REFERENCES other(id)`, `int DEFAULT (fn())`). Thay bằng ngữ pháp chặt cộng kiểm tra từ khóa, sửa comment sai ("không thể chèn SQL").
  - Ngữ pháp cuối cùng (sau khi đã qua giới hạn 63 byte UTF-8, `MAX_NAME_BYTES`):
    - `word = [A-Za-z_][A-Za-z0-9_]*`
    - `argument = word | [0-9]+`
    - `argumentList = "(" argument ( " "? "," " "? argument )* ")"`
    - `customType = word ( " " word )* ( " "? argumentList )? ( "[]" )*`, khớp toàn chuỗi.
    - Không token định danh nào (cả trong phần từ lẫn trong danh sách đối số; so sánh không phân biệt hoa thường, tách theo ký tự ngoài `[A-Za-z0-9_]`) được là một trong: CHECK, REFERENCES, DEFAULT, CONSTRAINT, PRIMARY, FOREIGN, UNIQUE, KEY, NOT, NULL, COLLATE, GENERATED, AS, ON, AUTO_INCREMENT, IDENTITY, COMMENT.
  - TDD: viết test trước. RED: `.claude/scripts/test-file.sh core src/validation/rules/custom-type-name.test.ts` → `Tests 63 failed | 38 passed (101)`. GREEN: cùng lệnh → `RESULT: PASS`.
- **File thay đổi**
  - `packages/core/src/validation/rules/custom-type-name.ts`
  - `packages/core/src/validation/rules/custom-type-name.test.ts`
  - `document/executions/logs/2026-10-03-custom-type-name-hardening.md`
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS` (typecheck, lint, test 2470/2470, build, prettier; line coverage 97.6%).
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
  - Không snapshot nào đổi; `git status --porcelain` chỉ có hai file trên và log này.
- **Quyết định**
  - Regex ghép từ các hằng `WORD`, `ARGUMENT`, `ARGUMENT_LIST` cộng một `Set` từ khóa, thay vì một regex lớn có lookahead: dễ đọc, và mỗi lần lặp đều bắt đầu bằng ký tự cố định (khoảng trắng, dấu phẩy, `[`) và hai nhánh của `argument` rời nhau (chữ/`_` vs chữ số) nên khớp tuyến tính, không ReDoS. Kiểm tra độ dài chạy trước nên regex chỉ gặp chuỗi ≤ 63 byte.
  - Từ khóa kiểm tra cả trong danh sách đối số (`geometry(NULL)` bị từ chối): an toàn hơn, không fixture nào cần.
  - Không cho khoảng trắng ngay sau `(` hay trước `)`, không cho khoảng trắng trước `[]`, không cho `[n]`, không cho ngoặc lồng hay chữ sau `)`, đúng theo quyết định của orchestrator. Hệ quả: `timestamp(3) with time zone` (cú pháp PostgreSQL đặt tham số ở giữa) bị từ chối; `timestamp with time zone` vẫn hợp lệ.
  - Từ bắt đầu bằng `_` (`_type`) nay hợp lệ (trước chỉ chữ cái), theo ngữ pháp đã chốt.
  - Tách từ bằng `split` với regex không cờ `g` để không có regex toàn cục giữ `lastIndex` ở cấp module.
  - Giữ nguyên issue code `column-custom-type-invalid` và diagnostic `custom-type-unsafe`; không thêm code mới.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Spec phần 2 (`2026-09-14-core-schema-model-design.md`, đoạn "Kiểu custom") còn mô tả cú pháp cũ và câu "kiểu custom không thể chèn câu lệnh SQL"; cần `spec-writer` cập nhật theo ngữ pháp trên.
  - Mọi tên kiểu custom trong fixture (`geometry(Point, 4326)`, `inet`, `tsvector`, `geometry`, `citext`, `ltree`, `point`, `YEAR`, `money`) và trong `withDialectCustomTypes` của `packages/codegen-conformance` vẫn hợp lệ.
  - Rủi ro còn lại đã chấp nhận: các từ thuộc tính cột vô hại không có trong danh sách (MySQL `UNSIGNED`, `ZEROFILL`, `INVISIBLE`; PostgreSQL `STORAGE`, `COMPRESSION`; SQL Server `SPARSE`, `ROWGUIDCOL`) vẫn qua được, vì không thêm cột, ràng buộc hay biểu thức.

## 2026-10-03 05:10 — core-engineer — Xong

- **Đã làm**: theo yêu cầu sau security review, bổ sung test vào `custom-type-name.test.ts`: từ khóa viết hoa thường lẫn lộn (`int NoT nUlL`), `\n` ở cuối và ở giữa (`int\n`, `int\nCHECK`), NUL (`int\u0000`), ký tự giả dạng ngoài ASCII (chữ `а` Cyrillic trong `vаrchar`, ngoặc fullwidth `（`, ký hiệu Kelvin `K` trong `KEY`). Tất cả đều bị từ chối. `geometry(NULL)` và biên 63/64 byte đã có test từ lần chạy trước. Các test mới qua ngay vì ghi lại hành vi đúng sẵn có, không lộ lỗi nào, nên không sửa source.
- **File thay đổi**: `packages/core/src/validation/rules/custom-type-name.test.ts`, log này.
- **Kiểm tra**: `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS` (2477/2477 test, line coverage 97.6%); `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**: rủi ro còn lại đã được chấp nhận (từ chỉ là thuộc tính cột như `UNSIGNED`, `SPARSE`, `STORAGE`), không đổi.
- **Ghi chú cho người tiếp theo**: `generate-postgresql/mysql/sqlserver.test.ts` chưa ghi lại việc kiểu custom không an toàn thành kiểu văn bản kèm `custom-type-unsafe`. Hiện chỉ `generators/shared/sql-ddl-model.test.ts` kiểm tra, và chỉ với `postgresql` (kiểu `{ kind: "text" }`). Chưa có test cho `LONGTEXT` của MySQL hay `nvarchar(max)` của SQL Server ở mức generator. Nên giao một task test riêng.
