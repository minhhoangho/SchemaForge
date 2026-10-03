# Review tối ưu hiệu năng seed (CG-08)

Liên kết: [Spec §8.2](../../specs/2026-09-14-code-generators-design.md#82-tối-ưu-hiệu-năng-seed-dataset) | [Task log](2026-10-03-code-generators-seed-perf.md) | [Task 28 log](2026-10-03-code-generators-task-28.md)

## 2026-10-03 15:15 — project-reviewer — Xong

**Đã làm:**
- Reviewed diff của seed optimization (base `9c48ff0`): `seed-relations.ts`, `build-seed-dataset.ts`, `validate-seed-dataset.ts`, `seed-values.ts`, `generators.bench.ts` (timeout 900k → 300k) và `vitest.config.ts` (`suppressExportGetterWarnings`).
- Built base core trong scratchpad.
- Ran differential fuzz của `buildSeedDataset` old vs new trên random schemas: composite PKs, unique indexes mixing source và non-source columns, nullable và unique FKs, self-relations, oneToOne, cycles với deferred relations, và enum/uuid/binary columns.

**Kiểm tra:**
- Fuzz pass 1: 34,260 cases. Fuzz pass 2: 7,620 cases. 0 mismatches; 546 schemas có deferred relations.
- `verify.sh core --build --format`: RESULT: PASS (2631 tests, 97.67% lines).
- `seed-relations.ts`: 100% lines, 90.66% branches.
- `SECRET-SCAN: CLEAN`.
- Bench không được rerun vì máy đang busy; kết quả của implementer là p75 355.52 ms so với ≤ 500 ms target (2527.78 ms trước đó).

**Quyết định:**
- Output là byte-equivalent, được chứng minh bằng reasoning và fuzz:
  - candidate set và order không thay đổi;
  - số lượng PRNG draws không thay đổi;
  - `completeTargets` không bao giờ stale;
  - unique guard là equivalent, và NULLS DISTINCT được preserve;
  - column ids không thể là prototype-named;
  - sorting once per dataset là pure.
- Không có mutable module state, không có `as`, và không có `any`.

**Phát hiện:**
1. should-fix: Branches tại `seed-relations.ts:272-274` không có test. Thêm test với composite unique key mà mix một deferred source column với boolean column.
2. nit: "first pair wins" branch tại 242-248 là dead code, vì parse đã reject `column-listed-twice`.
3. nit: `createUniqueGuard` khoảng 55 lines; extract trial-key filter.

**Việc còn lại:**
- [ ] Thêm test cho branches tại 272-274.
- [ ] Kiểm tra và xóa dead code tại 242-248.
- [ ] Extract trial-key filter từ `createUniqueGuard`.
