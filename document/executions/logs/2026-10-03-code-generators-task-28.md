# Task 28: Benchmark generator

- Plan: [`document/plans/2026-09-15-code-generators-plan.md`](../../plans/2026-09-15-code-generators-plan.md), mục "Task 28"
- Spec: [`document/specs/2026-09-14-code-generators-design.md`](../../specs/2026-09-14-code-generators-design.md), mục 9 "Hiệu năng"

## 2026-10-03 05:20 — core-engineer — Dừng giữa chừng

- **Đã làm**
  - Bước đỏ: `pnpm --filter @schemaforge/core bench` trước khi có script báo `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT` ("None of the selected packages has a "bench" script").
  - Thêm script `"bench": "vitest bench --run"` ngay sau `"test"` trong `packages/core/package.json`.
  - Tạo `packages/core/src/generators/generators.bench.ts`: dựng `createLargeSchema({ tableCount: 200 })` một lần ở cấp module; khẳng định `buildSeedDataset(schema, { rowsPerTable: 100, seed: 1 }).dataset.tables` có ít nhất một bảng có dòng (throw `Error` nếu không); đo mỗi biến thể của `listGeneratorCases()` (18 biến thể) cùng `seed postgresql with 100 rows per table`.
  - Chạy benchmark ba lần (lần 1 bị test timeout 60 s nên sửa timeout, lần 2 reporter mặc định không in bảng, lần 3 với `--reporter=verbose` cho bảng cuối). Chạy thêm một kiểm tra phụ bằng `node` thuần trên `dist/` để loại trừ nghi ngờ do overhead của Vitest.
- **File thay đổi**
  - `packages/core/package.json` (chỉ thêm script `bench`)
  - `packages/core/src/generators/generators.bench.ts` (mới)
  - `document/executions/logs/2026-10-03-code-generators-task-28.md` (log này)
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, test 2622 test pass, build, format; coverage dòng 97.66%, không có dòng "does not meet global threshold"). `dist/` không chứa file bench.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - `pnpm --filter @schemaforge/core bench --reporter=verbose`: exit 0, 257 s.
  - Kiểm tra phụ: `generateSeed` PostgreSQL 100 dòng/bảng trên `dist/` chạy bằng `node` thuần, 12 lần, 2341–2436 ms (không qua Vitest).
- **Cấu hình máy**: Apple M1 Pro (`sysctl -n machdep.cpu.brand_string`), 8 lõi, 16 GB RAM, Node `v24.21.0`, Vitest 5.0.0, macOS (Darwin 27.0.0). Máy không hoàn toàn yên tĩnh: load average 3.5–4.3 (8 lõi) khi chạy, do agent khác đang dùng chung máy.
- **Kết quả** (lần chạy 3, đơn vị ms, `createLargeSchema({ tableCount: 200 })`; mục tiêu p75: mỗi generator ≤ 100, seed 100 dòng ≤ 500)

  | Tên | mean | p75 | p99 | Mục tiêu |
  |---|---|---|---|---|
  | typescript | 1.6728 | 1.6850 | 2.3594 | đạt |
  | zod | 1.7787 | 1.8126 | 2.4418 | đạt |
  | openapi | 3.8215 | 3.9427 | 5.0477 | đạt |
  | postgresql | 7.2348 | 7.4524 | 9.2134 | đạt |
  | mysql | 10.3327 | 10.5292 | 11.7713 | đạt |
  | prisma postgresql | 11.0697 | 11.3760 | 13.0467 | đạt |
  | sqlserver | 11.8462 | 12.0619 | 15.8465 | đạt |
  | prisma mysql | 13.4769 | 13.7983 | 14.9835 | đạt |
  | prisma sqlserver | 15.9869 | 16.1073 | 28.0177 | đạt |
  | dbml | 16.9374 | 17.1650 | 17.9220 | đạt |
  | drizzle postgresql | 34.8611 | 35.6497 | 39.7429 | đạt |
  | drizzle mysql | 39.7540 | 40.1018 | 47.1576 | đạt |
  | markdown | 41.3441 | 41.3768 | 54.8643 | đạt |
  | seed json (3 dòng/bảng) | 63.3549 | 63.6519 | 70.3331 | đạt |
  | seed sqlserver (3 dòng/bảng) | 68.5245 | 69.2360 | 79.6700 | đạt |
  | seed postgresql (3 dòng/bảng) | 69.2296 | 69.5217 | 81.4313 | đạt |
  | seed mysql (3 dòng/bảng) | 69.7622 | 69.6534 | 83.3204 | đạt (xem ghi chú nhiễu) |
  | mock-api | 78.9917 | 78.9640 | 94.6659 | đạt |
  | **seed postgresql with 100 rows per table** | **2513.31** | **2527.78** | **2585.70** | **TRƯỢT (≤ 500)** |

  Ghi chú nhiễu: ở lần chạy 1 (máy bận hơn), `seed mysql` có p75 = 106.82 ms (mean 102.01) vượt 100 ms; chạy lại thì 69.65 ms, nên coi là nhiễu. Cùng lần 1, `seed postgresql 100 dòng` có p75 = 2530.59 ms, gần như trùng lần 3 (2527.78 ms) và kiểm tra bằng `node` thuần (≈ 2.4 s), nên đây là kết quả thật, không phải nhiễu.
- **Quyết định**
  - Vitest 5.0.0 không còn export `bench` từ `vitest` (import ra `undefined`, lỗi `TypeError: bench is not a function`). API mới: fixture `bench` của test và `bench.compare(...)`. Vì vậy file bench dùng một `describe` chứa một `test` nhận `{ bench }` rồi gọi `bench.compare` cho cả 19 benchmark. Vẫn một benchmark cho mỗi biến thể như plan, chỉ khác cách đăng ký. Một `test` duy nhất cho ra một bảng so sánh chung.
  - `test` đặt timeout riêng 900 000 ms (hằng `BENCH_TIMEOUT_MS`), không đổi cấu hình dùng chung: mặc định 60 s làm test fail dù số liệu đã có (19 benchmark, mỗi cái tối thiểu 64 mẫu, riêng seed 100 dòng mất khoảng 160 s).
  - Script `bench` giữ đúng `vitest bench --run` như task yêu cầu. Hệ quả: với reporter mặc định, bench pass thì không in bảng số liệu; xem bảng bằng `pnpm --filter @schemaforge/core bench --reporter=verbose` (đã kiểm tra nhận được tham số).
  - Mục tiêu đọc theo cột `p75` như plan (Vitest không in trung vị).
  - Giữ nguyên các biến thể seed của `listGeneratorCases()` (3 dòng/bảng) cùng bench riêng 100 dòng, đúng plan.
  - Không tối ưu generator, theo plan.
- **Việc còn lại**
  - [ ] Orchestrator tạo task tối ưu riêng cho `generateSeed` / `buildSeedDataset` (`packages/core/src/generators/seed/`): `seed postgresql with 100 rows per table` p75 ≈ 2528 ms, cần ≤ 500 ms (chậm hơn mục tiêu khoảng 5 lần). Ba biến thể seed 3 dòng/bảng tốn 63–70 ms nên chi phí cố định của `buildSeedDataset` (load order, kiểm tra unique, `toSeedKey`) đáng nghi; chi phí tăng gần tuyến tính theo số dòng (3 dòng: ≈ 65 ms; 100 dòng: ≈ 2500 ms, tức ≈ 25 ms mỗi dòng/200 bảng). Sau khi tối ưu, chạy lại `pnpm --filter @schemaforge/core bench --reporter=verbose` và ghi kết quả vào log của task đó.
  - [ ] Orchestrator cân nhắc (cần sửa `packages/core/vitest.config.ts`, ngoài phạm vi task này): đặt `benchmark.suppressExportGetterWarnings` hoặc xử lý cảnh báo "accessed module export getters too many times" mà Vitest in ra (overhead của module runner). Kiểm tra bằng `node` thuần trên `dist/` cho cùng kết quả seed 100 dòng (≈ 2.4 s), nên cảnh báo không làm đổi kết luận trượt mục tiêu; các số liệu của generator nhanh hơn (typescript, zod, openapi) có thể bị phóng đại nhẹ.
  - [ ] Commit (orchestrator): `perf(core): add generator benchmarks`.
- **Ghi chú cho người tiếp theo**
  - Chạy: `source ~/.nvm/nvm.sh && nvm use` rồi `pnpm --filter @schemaforge/core bench --reporter=verbose`; mất khoảng 4,3 phút. Chạy khi máy yên tĩnh, vì nhiễu từ tải máy có thể làm p75 của các variant 60–100 ms lệch tới 40 ms.
  - Sau khi tối ưu seed, bench seed 100 dòng vẫn là điểm chậm nhất; nếu nhanh hơn nhiều thì có thể giảm `BENCH_TIMEOUT_MS`.
  - Task 1 đã loại `*.bench.ts` khỏi build và coverage; `vitest run` không chạy file bench (xác nhận bằng `verify.sh`: 2622 test, `dist/` không có file bench).
