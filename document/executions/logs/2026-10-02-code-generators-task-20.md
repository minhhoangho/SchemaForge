# Task 20: CG-05 Zod schema

- Plan: [Task 20](../../plans/2026-09-15-code-generators-plan.md#task-20-cg-05-zod-schema)
- Spec: [CG-05](../../specs/2026-09-14-code-generators-design.md#cg-05-zod-schema), mục 3 "Biểu diễn JSON…", mục 4 cột Zod, mục 5 "Định danh code", mục 7 dòng "CG-05 đúng ngữ nghĩa"

## 2026-10-02 15:30 — core-engineer — Xong

- **Đã làm**
  - Viết test trước (`generate-zod.test.ts`, 39 test); RED: `.claude/scripts/test-file.sh core packages/core/src/generators/zod/generate-zod.test.ts` fail với `Error: Cannot find module './generate-zod.js'`. GREEN sau khi cài đặt.
  - `generateZod` (subpath `@schemaforge/core/generators/zod`) in `schemas.ts`: `import { z } from "zod";` khi có enum hoặc bảng, enum (`z.enum([...])`, enum rỗng `z.never()`) theo `sortEnums`, rồi bảng theo `sortTables` (`z.object({...})`, bảng không cột `z.object({})`), JSDoc cho comment bảng và cột, key là tên cột gốc qua `formatPropertyKey`, `.nullable()` cho cột nullable, `custom-type-unmapped` tại `["columns", id, "type"]` cho cột `custom`.
  - `renderJsonFieldZod` (không export qua `index.ts`) ánh xạ đủ 17 loại `JsonFieldType` theo bảng spec mục 3; pattern của `bigint`, `decimal` ghi qua `new RegExp(JSON.stringify(...))`.
  - Tên biến: một `NameAllocator` (`comparison: "exact"`, `separator: ""`, `reserved: ["z"]`, `maxBytes: null`), enum trước rồi bảng, ứng viên `toCamelCaseIdentifier(name, "enum" | "table") + "Schema"`.
  - Rebase lên master `4205ae2` (Task 19) trước khi kiểm tra cuối.
- **File thay đổi** (tạo mới)
  - `packages/core/src/generators/zod/index.ts`
  - `packages/core/src/generators/zod/generate-zod.ts`
  - `packages/core/src/generators/zod/generate-zod.test.ts`
  - `packages/core/src/generators/__snapshots__/zod/{sample,naming-edge,target-limit,empty}.ts` và 4 file `.diagnostics.txt` tương ứng
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, test 1441/1441, build, prettier). Coverage dòng toàn package 98.14%.
  - `pnpm --filter @schemaforge/backend exec node --input-type=module -e '...generators/zod...'`: in `function schemas.ts generateZod`.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - Thử nhanh ngoài repo (script trong scratchpad, không commit): import 3 snapshot với `zod` 4.6.4 đã cài trong core: mọi schema khởi tạo được; dòng hợp lệ parse được, dòng sai (`guid`, decimal 3 chữ số lẻ, bigint `05`) bị từ chối; `__proto__` là khóa riêng của `shape`.
- **Snapshot**: tạo mới 8 file trong `__snapshots__/zod/`; đã đọc lại và đối chiếu với spec mục 3, CG-05 (`sample` và `target-limit` có `custom-type-unmapped` cho cột `custom`; `naming-edge`, `empty` không có diagnostic; `empty.ts` là một `\n`).
- **Quyết định**
  - **Theo pattern Task 19**: `export const generateZod: Generate<"zod"> = (schema: SchemaDocument): GenerateResult => …` thay cho `function generateZod(schema, options)`, vì tham số `options` không dùng bị `@typescript-eslint/no-unused-vars` chặn và `void options` bị `no-meaningless-void-operator` chặn; annotation `Generate<"zod">` giữ chữ ký công khai. Không tắt rule lint nào.
  - Thêm hai test ngoài danh sách của plan (`writes an unbounded string as z.string()`, `writes a missing enum as z.string()`), vì hai nhánh này là quy tắc của plan mà bảng `it.each` 17 loại chỉ phủ được một biến thể.
  - Thêm test `reports nothing for a schema without custom columns` (biên của diagnostic), theo quy ước mọi mã có test biên.
  - Rebase không dùng `git stash`: thay đổi chỉ là file mới chưa track nên `git rebase master` chạy thẳng, tránh đụng stash dùng chung giữa các worktree.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 30 (conformance Zod): khi thử nhanh, `z.object` của Zod 4.6.4 không kiểm tra giá trị của khóa `__proto__` trong input (`{"__proto__": 5}` vẫn parse thành công với `z.string().nullable()`), dù schema sinh ra có khóa `["__proto__"]` đúng. Đây là hành vi của Zod, không phải lỗi generator; seed JSON của `naming-edge` vẫn parse được, nhưng giá trị của cột `__proto__` không thực sự được kiểm tra.
  - Đã có file conformance `src/zod.test.ts` thì task nào sửa generator này phải chạy cổng conformance (mục "Conformance của task generator" của plan).
