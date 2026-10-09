# Task 19: Benchmark import

Plan: [Task 19](../../plans/2026-10-03-import-export-plan.md#task-19-benchmark-import). Spec: [mục 14 Hiệu năng](../../specs/2026-09-15-import-export-design.md#14-hiệu-năng).

## 2026-10-09 13:00 — core-engineer — Xong (HAI chỉ tiêu trượt: `buildImportOperation` + `applyOperation` 200 bảng, và `applyOperation` ở giới hạn 20 000 phần tử trên 3 giây)

- **Đã làm**
  - `importers.bench.ts`: nguồn từ `createLargeSchema({ tableCount: 200 })` qua `generatePostgresql`, `generateMysql`, `generateSqlServer`, `generatePrisma` (`postgresql`), `generateDbml`, `serializeSchemaDocument`; mỗi importer một bench, chia hai `test`: ba importer SQL (10 mẫu, 1 lần warmup) và Prisma, DBML, JSON (mặc định tinybench, ít nhất 64 mẫu). Mỗi lần chạy kiểm tra `isOk`, bị từ chối thì throw (nếu không bench chỉ đo đường lỗi). Không thêm bench JSON ở giới hạn phần tử (plan ghi "nếu có").
  - `sql/sql-parsing.bench.ts`: `scanSqlStatements` trên 10 bản DDL PostgreSQL 200 bảng nối nhau (2 078 720 ký tự, sát `MAX_IMPORT_SOURCE_LENGTH` = 2 097 152; 7 200 câu, 347 500 token < `MAX_SCANNED_TOKENS` 524 288); `parseSqlWithDbmlCore` trên DDL 200 bảng (207 872 ký tự).
  - `operations/build-import-operation.bench.ts`: build + apply chế độ `new` trên `createEmptySchema`, chế độ `merge` lên `createSampleSchema()` (id có tiền tố `bench` để không trùng id counter của tài liệu mẫu), tài liệu 200 bảng (4 920 bước). Cặp ở giới hạn: `tableCount` tìm trong file bằng nhân đôi rồi chia đôi → **847 bảng, 19 988 phần tử, batch 20 835 bước**; bench `buildImportOperation` (worker) và riêng `applyOperation` của batch đó trên `createEmptySchema` (5 mẫu, không warmup).
  - Tên `test` ghi số bảng, số phần tử, số bước nên output bench tự ghi lại.
- **File thay đổi**
  - `packages/core/src/importers/importers.bench.ts` (tạo)
  - `packages/core/src/importers/sql/sql-parsing.bench.ts` (tạo)
  - `packages/core/src/operations/build-import-operation.bench.ts` (tạo)
  - `document/executions/logs/2026-10-09-import-export-task-19.md` (tạo)
- **Kiểm tra**
  - Máy: Apple M1 Pro, 8 nhân, 16 GB, macOS (Darwin 27.0.0), Node 24.21.0, Vitest 5.0.0 (tinybench 6.1.4). Ngày 2026-10-09. Dev server của người dùng vẫn chạy; load average lúc bắt đầu thấp hơn dự kiến (không phải ~18).
  - Lần 1 (12:34, `uptime`: 2.78 / 5.73 / 12.13): `pnpm --filter @schemaforge/core bench --reporter=verbose` thoát mã 1: hai bench ở giới hạn gọi `bench.compare()` với một bench (`SyntaxError: bench.compare() requires at least 2 benchmarks, received 1 instead`); đã sửa sang `bench(...).run(options)`. Các bench khác có số (bảng dưới). Bảng verbose không có cột trung vị.
  - Lần 2 (12:39, `uptime`: 2.90 / 4.22 / 9.63; kết thúc 3.15): `pnpm --filter @schemaforge/core bench --reporter=verbose --reporter=json --outputFile.json=<scratchpad>/run2.json` thoát mã **0**, 5 file, 9 test pass. Trung vị lấy từ `latency.p50` của JSON.
  - Lần 3 (12:46, `uptime`: 2.85 / 3.20 / 6.90; kết thúc 3.34): cùng lệnh, thoát mã **0**, 9 test pass.
  - Bảng (ms; trung vị / p75; lần 1 chỉ có mean / p75 vì reporter verbose không in trung vị):

    | Bench | Ngưỡng | Lần 1 mean / p75 | Lần 2 trung vị / p75 | Lần 3 trung vị / p75 | Kết quả |
    |---|---|---|---|---|---|
    | `importPostgresql` | ≤ 4 000 | 1 113 / 1 146 | 1 070 / 1 084 | 1 069 / 1 087 | Đạt |
    | `importMysql` | ≤ 4 000 | 2 736 / 2 750 | 2 699 / 2 707 | 2 680 / 2 716 | Đạt |
    | `importSqlserver` | ≤ 4 000 | 2 643 / 2 664 | 2 644 / 2 653 | 2 629 / 2 650 | Đạt |
    | `importPrisma` | ≤ 1 000 | 27.4 / 27.6 | 26.9 / 27.9 | 27.3 / 27.9 | Đạt |
    | `importDbml` | ≤ 1 000 | 182 / 183 | 179 / 184 | 179 / 183 | Đạt |
    | `importJson` | ≤ 1 000 | 10.1 / 10.5 | 9.6 / 10.1 | 9.4 / 9.6 | Đạt |
    | build + apply, `new`, 200 bảng | trung vị ≤ 1 000 | 1 560 / 1 543 | 1 532 / 1 544 | 1 521 / 1 538 | **TRƯỢT** |
    | build + apply, `merge` lên tài liệu mẫu, 200 bảng | trung vị ≤ 1 000 | 1 578 / 1 586 | 1 567 / 1 572 | 1 572 / 1 589 | **TRƯỢT** |
    | `buildImportOperation` ở giới hạn (847 bảng) | không có | lỗi | 1.90 / 2.05 | 1.68 / 1.75 | chỉ ghi số |
    | `applyOperation` batch ở giới hạn (20 835 bước) | không có; báo nếu > 3 000 | lỗi | **32 168** / 32 174 | **32 053** / 32 056 | **> 3 s, gấp ~10 lần** |
    | `scanSqlStatements` 2 MiB | chỉ ghi số | 118.9 / 118.7 | 119.7 / 120.2 | 120.5 / 123.4 | chỉ ghi số |
    | `parseSqlWithDbmlCore` DDL 200 bảng | chỉ ghi số | 1 022 / 1 022 | 1 021 / 1 031 | 1 029 / 1 035 | chỉ ghi số |

    Số đo ổn định giữa các lần (lệch dưới 3 %; `rme` của bench giới hạn ±0.10 %), nên trượt ngưỡng không phải nhiễu.
  - `.claude/scripts/verify.sh core --build --format`: typecheck, lint, test, build, format đều PASS, `RESULT: PASS`; 4 742 test pass; coverage dòng 97.99 %.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - Đo tạm trên `dist` bằng script trong scratchpad (không commit):
    - Phân rã SQL (trung vị 5 lần): PostgreSQL scan 8 ms, parse `@dbml/core` 1 029 ms, import 1 055 ms; MySQL scan 9, parse 2 579, import 2 623; SQL Server scan 11, parse 2 558, import 2 619.
    - Profile CPU `applyOperation` batch 200 bảng (tổng 1 551 ms): `withEntry` (`operations/id-map.ts`) self-time 1 487 ms; `parseOperation` (Zod) trên cả batch chỉ 11 ms.
    - Ở giới hạn (847 bảng): `importDbml` 957 ms (729 559 ký tự), `importPrisma` 101 ms.
- **Quyết định**
  - Số mẫu: bench nhiều giây dùng `{ iterations: 10, time: 0, warmupIterations: 1, warmupTime: 0 }` (mặc định tinybench là ít nhất 64 mẫu và 1 giây, tức nhiều phút mỗi bench); `applyOperation` ở giới hạn dùng 5 mẫu không warmup (mỗi mẫu ~32 s, JIT đã nóng trong một lần chạy). Bench nhanh giữ mặc định.
  - Bench đơn dùng `bench(...).run(options)` vì Vitest 5 bắt `bench.compare()` có ít nhất hai bench.
  - Trung vị đọc từ `latency.p50` của reporter `json` (thêm `--reporter=json --outputFile.json=…` ra scratchpad, không ghi vào repo), vì bảng của reporter `verbose` không có cột trung vị.
  - Nguồn scanner: chỉ nối bản DDL nguyên (10 bản), không cắt giữa chừng, để không có chuỗi hay câu bị cắt ở cuối.
  - `tableCount` ở giới hạn tìm bằng nhân đôi rồi chia đôi (khoảng 20 lần dựng fixture) thay vì tăng dần từ 2 như `apply-ai-edit.bench.ts` (~850 lần dựng).
  - Không sửa `applyOperation` hay importer (plan).
- **Việc còn lại**
  - [ ] Orchestrator: chỉ tiêu `buildImportOperation` + `applyOperation` (200 bảng) trượt: trung vị ~1.52–1.57 s > 1 s. Theo spec mục 14, tạo task tối ưu riêng trong core, không đổi hợp đồng `applyOperation`. Nguyên nhân đo được: `withEntry` trong `packages/core/src/operations/id-map.ts` sao chép cả map (`{ ...map, [id]: value }`) ở mỗi bước, nên batch N bước tốn O(N²) (96 % thời gian); `parseOperation` không đáng kể. Hướng sửa gợi ý: áp batch trên bản nháp có thể ghi (dựng map một lần cho cả batch) rồi đóng băng kết quả, giữ inverse và lỗi như cũ. Sau khi sửa, chạy lại `pnpm --filter @schemaforge/core exec vitest bench --run src/operations/build-import-operation.bench.ts --reporter=verbose --reporter=json --outputFile.json=<tạm>` và so với bảng trên.
  - [ ] Orchestrator: `applyOperation` của batch ở giới hạn `MAX_IMPORTED_ELEMENTS` (847 bảng, 20 835 bước) trung vị ~32 s, **gấp ~10 lần mức 3 s** của plan; editor phát lại batch này trên luồng chính qua `dispatch`. Chọn giữa task tối ưu (cùng nguyên nhân bậc hai ở trên; sửa xong thì thời gian dự kiến gần tuyến tính) và hạ `MAX_IMPORTED_ELEMENTS` (đổi spec mục 1, cần người dùng duyệt). Task tối ưu phải merge trước Task 32 (Vấn đề 11).
- **Ghi chú cho người tiếp theo**
  - `pnpm --filter @schemaforge/core bench` chạy cả 5 file bench, khoảng 7 phút trên máy này; riêng bench `applyOperation` ở giới hạn ~3 phút. Chạy một file: `pnpm --filter @schemaforge/core exec vitest bench --run <file> --reporter=verbose`.
  - MySQL và SQL Server chậm hơn PostgreSQL khoảng 2.5 lần ở bench này (log property test ghi khoảng 4 lần): toàn bộ chênh lệch nằm trong `@dbml/core` (`Parser.parse` → nhánh ANTLR `X7(source, "mysql" | "mssql" | "postgres")` của `@dbml/core` 10.2.0, mỗi dialect một grammar); phần core (scan, phân loại, dựng nháp, `assembleDocument`) chỉ 25–60 ms cho mỗi dialect. Không sửa được trong core ngoài việc đổi thư viện. Chênh lệch lớn hơn trên nguồn nhỏ của property test có thể do chi phí khởi động parser lớn hơn với grammar MySQL và T-SQL (chưa đo).
  - Chi phí DBML đã ghi trước đó (4 000 bảng + 3 999 ref inline ~2.2 s, phần lớn trong `@dbml/core`) nằm ngoài ngưỡng của spec mục 14, vì ngưỡng chỉ áp cho nguồn `createLargeSchema` 200 bảng (179 ms, đạt). Ở giới hạn phần tử với `createLargeSchema` (847 bảng) `importDbml` đo được 957 ms.
