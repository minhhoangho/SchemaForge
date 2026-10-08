# Bỏ các đường chi phí bậc hai còn lại trong importer

Spec: [2026-09-15-import-export-design.md](../../specs/2026-09-15-import-export-design.md) mục 1 · Nguồn: phần "Việc còn lại" của [2026-10-05-import-export-security-fixes-1.md](2026-10-05-import-export-security-fixes-1.md) (SF1). Không có task plan riêng.

## 2026-10-08 — core-engineer — Xong

- **Đã làm**
  - Prisma (`prisma-relations.ts`): mỗi model dựng `ModelLookup` một lần (lười, `Map<ModelBlock, ModelLookup>` cục bộ trong `buildPrismaRelations`): field không có `fields` theo (typeName, tên quan hệ), `Set` tên field optional, `Set` khóa tập (`JSON` của tên đã khử trùng và sắp xếp) của `@id`/`@unique`/`@@id`/`@@unique`. `findBackField`, `hasNullableField` và `inferKind` không còn quét mọi field cho từng field quan hệ.
  - DBML (`dbml-relations.ts`): token bảng được sắp theo `start`, mỗi phần tử giữ `end` xa nhất của nó và các bảng bắt đầu trước nó; ref nằm trong bảng nào đó ⇔ tìm nhị phân bảng cuối cùng bắt đầu không sau ref rồi so `end` xa nhất. Tương đương chính xác `tables.some(isInside…)`, kể cả khi bảng chồng nhau hoặc mảng không theo thứ tự nguồn.
  - SQL — đo trước trên một bảng rất lớn (N = 4000 và 16 000, profile CPU): cả hai đường đều bậc hai đo được, và ở vài dạng nguồn thì phần của core lớn hơn phần `@dbml/core`, nên đã sửa:
    - `sql-column-set-lookup.ts` (mới): `createColumnSetLookup` cho phép so "cùng tập" của draft SQL (cùng độ dài, mọi cột cần tìm có trong ứng viên theo name key). Cột cần tìm không lặp tên → tra `Map` theo khóa (độ dài + name key đã sắp); có tên lặp (parser nhận FK `(a, a, b)`) → quét các ứng viên cùng độ dài, giữ nguyên ngữ nghĩa cũ.
    - `sql-draft-relations.ts`: `isUniqueColumnSet` dùng `TableUniqueKeys` dựng một lần mỗi bảng (khóa chính + unique index qua `createColumnSetLookup`, `Set` name key của cột unique).
    - `sql-table-index-lookup.ts` (mới): `createTableIndexLookup` dựng một lần mỗi bảng: CREATE INDEX và MySQL key theo tên (name key) hoặc theo danh sách cột đúng thứ tự (`JSON`), unique constraint trong CREATE TABLE và qua ALTER TABLE, `Set` cột auto-increment, index theo cột đầu, `Set` cột là khóa. `sql-draft-index-rules.ts` bỏ `findDefinition`, `findTableKey`, `isSameIndex`, `isSameList`, `isSameSet` và đọc từ `source.lookup`; `sql-draft-indexes.ts` dựng lookup trong `translateIndexes`.
- **File thay đổi**
  - `packages/core/src/importers/prisma/prisma-relations.ts` (+ test)
  - `packages/core/src/importers/dbml/dbml-relations.ts` (+ `dbml-relations.test.ts` mới)
  - `packages/core/src/importers/sql/sql-column-set-lookup.ts` (mới, + test)
  - `packages/core/src/importers/sql/sql-table-index-lookup.ts` (mới)
  - `packages/core/src/importers/sql/sql-draft-index-rules.ts`, `sql-draft-indexes.ts` (+ `sql-draft-indexes.test.ts` mới)
  - `packages/core/src/importers/sql/sql-draft-relations.ts` (+ `sql-draft-relations.test.ts` mới)
- **Kiểm tra**
  - RED trước khi sửa (test đếm số lần đọc): Prisma "expected 18013002 to be less than 60020" và "expected 20012002 to be less than 40020"; DBML "expected 2001000 to be less than 20000"; SQL index 4 trường hợp "expected 1006003 / 1757003 / 3510503 / 504003 to be less than 30000"; SQL relations "expected 878250 to be less than 10000". Các test hành vi mới (thứ tự bảng, bảng chồng nhau, FK lặp cột) xanh trên code cũ, tức là ghim ngữ nghĩa cũ.
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (exit 0), 4643 test, line coverage 98 %.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - Đo trên `dist` (Node 24, trước → sau, một lần chạy, máy có tải):
    - Prisma 2 model × 4000 quan hệ có back relation: 10 878 ms → 123 ms; không back relation (kind theo unique): 5 136 ms → 94 ms.
    - DBML 4000 bảng + 3999 ref inline: 5 327 ms → 2 206 ms; 6000 bảng sau sửa 4 495 ms, trong đó `@dbml/core` + `@dbml/parse` khoảng 85 %, phần core không còn trong top.
    - PostgreSQL một bảng, 16 000 `CREATE INDEX ON t (c)` không tên: 4 061 ms (core 2 272 ms) → 1 713 ms (core không còn trong top).
    - PostgreSQL 16 000 cột `UNIQUE REFERENCES`: 18 407 ms (core 2 647 ms) → 15 365 ms (phần còn lại là `@dbml/core`).
    - PostgreSQL 4000 `UNIQUE (a, b)` trong CREATE TABLE: core 845 ms → không còn trong top (tổng 625 ms). 4000 FK + 4000 `CREATE UNIQUE INDEX`: core 1 362 ms → không đáng kể. MySQL 4000 `KEY k (c)`: core 512 ms → không đáng kể.
- **Quyết định**
  - Test chống bậc hai đếm số lần đọc qua `Proxy` (như SF1), không đo thời gian: Prisma đếm phần tử `fields` (2000 quan hệ, ngưỡng 10 × số field), DBML đếm `token` của bảng (2000 bảng, ngưỡng 10 × số bảng), SQL index đếm thuộc tính của mọi thứ scanner đọc lại + `fields`/`indexes` của bảng (1000 index, ngưỡng 30 × số index), SQL relations đếm cột và unique index (1000 cột, ngưỡng 10 × số cột). Bản bậc hai vượt ngưỡng 17–117 lần, bản mới dưới ngưỡng xa.
  - SQL relations và index rules test trực tiếp `translateRefs`/`translateIndexes` với input dựng tay (stub `SqlElementLocations`), không qua `@dbml/core`, để test nhanh và không phụ thuộc thời gian parse của thư viện.
  - **Đáng chú ý:** giữ nguyên ngữ nghĩa "cùng tập" cũ cho FK lặp cột: `(a, a, b)` vẫn khớp unique key `(a, b, c)` (oneToOne). Ngữ nghĩa này có vẻ sai (tập `{a, b}` không unique nhờ `(a, b, c)`) nhưng task yêu cầu không đổi hành vi; trường hợp này đi đường quét các ứng viên cùng độ dài, nên nguồn cố tình có nhiều FK lặp cột vẫn tốn O(FK × unique key) trên một bảng.
  - Lookup dựng một lần mỗi bảng/model (Map cục bộ trong lần gọi), không có state cấp module.
  - `findDefinition` (export nội bộ, không thuộc public API) bị xóa; nơi gọi duy nhất là `sql-draft-indexes.ts`.
- **Việc còn lại** (ngoài phạm vi, đề xuất task riêng)
  - [ ] `packages/core/src/importers/sql/sql-element-locations.ts`: `foreignKey` và `check` (hàm `constraint`, dòng ~210–245) quét mọi `ALTER TABLE … ADD` của bảng cho từng FK/check, O(FK × constraint). Đo: 4000 `ALTER TABLE t ADD FOREIGN KEY (c) REFERENCES u (id)` → core 266 ms trên tổng 1 637 ms; ước tính ở giới hạn 2 MiB (~45 000 câu) phần core khoảng 30 s. Sửa: nhóm constraint theo bảng rồi theo khóa `JSON` của danh sách name key cột (FK) và theo name key (check), giữ phần tử đầu tiên.
  - [ ] Cân nhắc sửa ngữ nghĩa so khớp FK lặp cột (xem Quyết định) bằng một quyết định spec; khi đó đường quét dự phòng trong `sql-column-set-lookup.ts` có thể bỏ.
  - [ ] `@dbml/core` vẫn chiếm phần lớn thời gian (ví dụ 4000 `CREATE INDEX i ON t (c)` có tên: khoảng 40 s trong thư viện, phần core không đáng kể); chỉ chặn được bằng hủy worker (spec mục 14).
- **Ghi chú cho người tiếp theo**
  - Script đo nằm ngoài repo (scratchpad); để đo lại, import `dist/importers/<format>/index.js` và `dist/testing/import-test-options.js`, dựng nguồn một bảng N phần tử, chạy `node --cpu-prof` và nhóm self-time theo `packages/core/dist/` và `node_modules`.
  - Thứ tự trả về không đổi: mọi lookup giữ phần tử đầu tiên theo thứ tự nguồn như `find` cũ.
