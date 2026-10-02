# Task 4: Fixture cho generator

- Plan: [Task 4](../../plans/2026-09-15-code-generators-plan.md#task-4-fixture-cho-generator)
- Spec: [mục 4, mục 9, mục 10](../../specs/2026-09-14-code-generators-design.md)

## 2026-10-02 16:30 — core-engineer — Xong

- **Đã làm**
  - `createNamingEdgeSchema()`: 8 bảng (`người dùng`, `order`, `order items`, `order_items`, `2fa codes`, `用户`, bảng tên chứa đủ `"` `` ` `` `]` `'` `\`, bảng tên đúng 63 byte), enum `trạng thái đơn` 7 giá trị, index `chỉ mục "họ tên"`, subject area `Khu "bán hàng"`, ghi chú nhiều dòng chứa `'''` và `\`, hai quan hệ `order` → `người dùng` (`cascade` và `setNull`).
  - `createTargetLimitSchema()`: 42 bảng chia nhóm theo ma trận spec mục 4 (vòng cascade, nhiều đường cascade, `restrict` đóng vòng, tự tham chiếu `setNull`, vòng khóa bắt buộc, `text`/`json`/`binary` trong khóa, độ dài khóa MySQL và SQL Server, auto-increment không đứng đầu index MySQL, dòng vượt 65 535 byte, tham số vượt giới hạn, unique nullable, bảng không khóa chính, kiểu custom, `setDefault`, comment dài, giây lẻ, `all_types`), 17 quan hệ, 5 index, enum `flag_status`. Viết dạng dữ liệu theo tên bảng, tên cột; một bộ dựng nội bộ trong file đổi tên thành id.
  - `createLargeSchema({ tableCount })`: `RangeError` khi `tableCount` không phải số nguyên ≥ 2; với 200 bảng cho 200 bảng × 20 cột, 300 quan hệ, 200 index, 20 enum.
  - `src/testing/index.ts` export thêm `createLargeSchema`, `createNamingEdgeSchema`, `createTargetLimitSchema` và type `LargeSchemaOptions`; `index.test.ts` thêm ba tên.
  - TDD: RED cả bốn file test (`Cannot find module './naming-edge-schema.js'`, `'./target-limit-schema.js'`, `'./large-schema.js'`; `index.test.ts` `AssertionError: expected [ 'buildSchema', …(11) ] to strictly equal [ 'buildSchema', …(14) ]`), rồi GREEN sau khi cài đặt.
- **File thay đổi**
  - `packages/core/src/testing/naming-edge-schema.ts`, `naming-edge-schema.test.ts` (mới)
  - `packages/core/src/testing/target-limit-schema.ts`, `target-limit-schema.test.ts` (mới)
  - `packages/core/src/testing/large-schema.ts`, `large-schema.test.ts` (mới)
  - `packages/core/src/testing/index.ts`, `index.test.ts`
  - API công khai: subpath `@schemaforge/core/testing` thêm ba hàm và một type (chỉ thêm, không đổi gì sẵn có). Không có snapshot.
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core src/testing/<file>.test.ts` trong vòng đỏ-xanh.
  - `.claude/scripts/verify.sh core --build --format`: typecheck, lint, test, build, prettier PASS; 1193 test pass; coverage dòng 97.86%; `RESULT: PASS`.
  - `pnpm typecheck` ở root: 8/8 task thành công.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - `git status --porcelain`: chỉ tám file trên (cộng file log này).
- **Quyết định**
  - (Quan trọng) Cột khóa ngoại của vòng `i → (i + 1) % n` trong `createLargeSchema` là nullable, cột của quan hệ `noAction` `i → (i + 7) % n` là bắt buộc. Nguồn: orchestrator, from the plan re-review (vòng khóa bắt buộc làm `buildLoadOrder` bỏ cả 200 bảng và benchmark seed đo dataset rỗng); test `makes the foreign key columns of the cascade ring nullable` ghim điều này.
  - (Quan trọng) Số quan hệ phụ: plan ghi vừa "mỗi bảng chỉ số chẵn" vừa `floor(tableCount * 1.5)` quan hệ, hai điều này mâu thuẫn khi `tableCount` lẻ. Chọn bảng chẵn có `i + 1 < tableCount`, cho đúng `floor(n / 2)` quan hệ phụ, nên tổng luôn là `floor(1.5n)`; với n chẵn trùng với "mọi bảng chẵn".
  - "Index thứ tư là unique" hiểu là mỗi index thứ tư (`i % 4 === 3`), 50 trên 200.
  - `createLargeSchema`: cột thường `field_NN` xoay vòng qua enum rồi 16 kiểu khác (không có custom); index của mỗi bảng gồm hai cột thường đầu tiên (enum, integer); bảng có khóa chính hai cột dùng `id bigint`, `part integer`; tên index `index_NNN` để không trùng tên bảng.
  - Cột `ma`, `má` trong `createNamingEdgeSchema` có `isUnique: true`: spec mục 10 ghi "hai cột unique chỉ khác dấu", plan chỉ ghi kiểu `text`; unique thêm tình huống tên ràng buộc trùng sau khi MySQL so không dấu.
  - Thêm cột `名字` (bảng `用户`) và cột tên chứa đủ ký tự quote (bảng tên quote) để thử cả định danh cột, ngoài định danh bảng.
  - Bảng `all_types` có cột `id` khóa chính và 19 cột còn lại (18 kiểu, thêm `timestamp_now`, `timestamptz_now` dùng `currentTimestamp`); mọi cột trừ `binary` có literal mặc định. Literal cho kiểu `custom` nằm ở `custom_values.address`.
  - Tên index của `createTargetLimitSchema` dùng hậu tố `_ix`, `_ux` để không trùng tên ràng buộc do generator đặt (`_key`, `_idx`).
  - `createNamingEdgeSchema` dựng thẳng bằng `make*` (cần subject area, ghi chú); `createTargetLimitSchema` dùng bộ dựng theo tên trong chính file vì có 42 bảng. Không tạo file helper chung vì ngoài phạm vi file sở hữu.
  - Bảng được đặt theo lưới (`position`) để mở trên canvas không chồng lên nhau.
  - Thêm test ngoài danh sách plan: index unique trên cột nullable không được tham chiếu, đủ 18 kiểu trong `all_types`, `currentTimestamp`, auto-increment cho ba kiểu số nguyên, enum nullable và boolean unique, quan hệ cách 7 bảng, mỗi index thứ tư unique.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - `target-limit-schema.ts` dài khoảng 590 dòng sau Prettier (dữ liệu của 42 bảng), vượt mức khoảng 300 dòng của `code-quality.md`. Muốn tách phần dữ liệu ra file riêng (ví dụ `target-limit-specs.ts`) thì cần orchestrator giao file đó.
  - Spec mục 10 nêu "cột vừa vượt giới hạn vừa thuộc khóa"; fixture phủ bằng `char(300)` unique (MySQL, n ≤ 768) và `char(900)` unique (n > 768). Không có `varchar(20000)` unique như ví dụ R2 vì SQL Server sẽ thành `nvarchar(max)` trong unique, trường hợp spec mục 4 chưa có quy tắc.
  - Fixture đổi sau khi đã có snapshot thì phải ghi lại mọi snapshot (mục "Điểm nóng" của plan).
  - Trong worktree agent, dùng `/usr/bin/git` và các script `.claude/scripts/*`; vòng lặp shell với biến bị hook chặn.

## 2026-10-02 17:00 — core-engineer — Xong

- **Đã làm**
  - Thêm bảng `oversized_unique` (`id` khóa chính, `code` `varchar(20000)` `isUnique`, không quan hệ nào tham chiếu) vào `createTargetLimitSchema`, theo ví dụ R2 của spec. Fixture giờ có 43 bảng.
  - TDD: test `contains a unique column beyond every dialect's varchar limit that no foreign key references` RED với `Error: No table named oversized_unique`, GREEN sau khi thêm bảng.
- **File thay đổi**
  - `packages/core/src/testing/target-limit-schema.ts`, `target-limit-schema.test.ts`
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: typecheck, lint, test, build, prettier PASS; 1194 test pass; coverage dòng 97.86%; `RESULT: PASS`.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - `git status --porcelain`: chỉ các file của task và file log này.
- **Quyết định**
  - Giữ `target-limit-schema.ts` (598 dòng) trong một file: phần lớn là dữ liệu fixture khai báo, và plan giao đúng một file. Nguồn: orchestrator. Thay cho ghi chú về việc tách file ở lượt trước.
  - Lo ngại ở lượt trước về `varchar(20000)` trong unique trên SQL Server không đúng: `narrowKeyText` trong `generators/shared/dialect-types.ts` đã hẹp cột khóa quá dài về `keyText` kèm `key-column-type-narrowed`, không bao giờ thành `nvarchar(max)` trong khóa. Nguồn: orchestrator. Vì vậy fixture thêm ví dụ R2.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Fixture đổi sau khi đã có snapshot thì phải ghi lại mọi snapshot bị ảnh hưởng.
