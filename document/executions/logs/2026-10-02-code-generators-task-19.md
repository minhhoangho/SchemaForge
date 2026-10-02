# Task 19: CG-04 TypeScript types

- Plan: [Task 19](../../plans/2026-09-15-code-generators-plan.md#task-19-cg-04-typescript-types)
- Spec: [CG-04](../../specs/2026-09-14-code-generators-design.md#cg-04-typescript-types), mục 3 "Biểu diễn JSON…", mục 4 "Ma trận cho các đích còn lại", mục 5 "Định danh code"

## 2026-10-02 14:50 — core-engineer — Xong

- **Đã làm**
  - Viết test trước (`generate-typescript.test.ts`, 38 test): đủ mọi test trong "Test viết trước" của Task 19, thêm `maps an enum that is not found to string` và `writes enums before tables and references the enum type name`. RED: `.claude/scripts/test-file.sh core packages/core/src/generators/typescript/generate-typescript.test.ts` → `Error: Cannot find module './generate-typescript.js'`.
  - Cài đặt `generateTypeScript` và `renderJsonFieldTypeScript` theo đúng "Hành vi" của plan: `allocateModelNames(schema, ["JsonValue", "Record"])`, `toJsonFieldType` + `switch` vét cạn, ` | null` cho cột nullable, `custom-type-unmapped` tại `["columns", id, "type"]`, `JsonValue` chỉ khi có cột `json`, enum rỗng → `never`, bảng không cột → `Record<string, never>`, JSDoc qua `formatJsDocLines`, key qua `formatPropertyKey`, ghép bằng `renderFileContent`, diagnostic qua `finalizeDiagnostics`.
  - `index.ts` chỉ export `generateTypeScript` và type `TypeScriptOptions` (subpath `@schemaforge/core/generators/typescript` có sẵn nhờ pattern `./generators/*` của Task 5).
  - Ghi 8 snapshot (4 fixture × `.ts` + `.diagnostics.txt`), đọc lại từng file đối chiếu spec CG-04.
- **File thay đổi**
  - `packages/core/src/generators/typescript/index.ts` (mới)
  - `packages/core/src/generators/typescript/generate-typescript.ts` (mới)
  - `packages/core/src/generators/typescript/generate-typescript.test.ts` (mới)
  - `packages/core/src/generators/__snapshots__/typescript/{sample,naming-edge,target-limit,empty}.ts` và `.diagnostics.txt` tương ứng (mới)
  - Không sửa `src/index.ts`, `package.json` hay file dùng chung nào.
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core …/generate-typescript.test.ts` → PASS (38 test).
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS` (typecheck, lint, test 1402/1402, coverage dòng 98.1%, build, prettier).
  - `pnpm --filter @schemaforge/backend exec node --input-type=module -e '…generateTypeScript(testing.createSampleSchema(), {}).file.fileName'` → `v24.21.0 function types.ts generateTypeScript`.
  - Kiểm chứng sớm (không thay Task 30): `tsc --ignoreConfig --noEmit --strict --noUncheckedIndexedAccess --target es2023 --module nodenext` trên cả bốn snapshot `.ts` → không có diagnostic.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - **(Đáng chú ý)** `generateTypeScript` khai báo dạng `export const generateTypeScript: Generate<"typescript"> = (schema: SchemaDocument): GenerateResult => …`, không phải `function (schema, options)`. Lý do: tham số `options` không dùng bị `@typescript-eslint/no-unused-vars` báo lỗi, còn `void options` bị `no-meaningless-void-operator` báo lỗi; không được tắt rule. Kiểu `Generate<"typescript">` vẫn bắt người gọi truyền `options`, nên chữ ký công khai giống plan. Task 20 (Zod) và các đích không option khác sẽ gặp cùng vấn đề.
  - Enum không tìm thấy → `string` (theo plan), kèm test riêng.
  - Test "reports nothing for a schema without custom columns" dùng schema tự dựng (có `json`, `binary`), vì `createSampleSchema()` có cột `custom` (`users.location`).
  - Fallback `?? ""` khi tra tên type trong map của `allocateModelNames`: không xảy ra (map chứa mọi bảng, enum đã sắp), chỉ để thỏa `noUncheckedIndexedAccess`.
- **Ghi chú cho người tiếp theo**
  - Snapshot `naming-edge.ts` chứa ký tự NUL thật trong JSDoc (comment cột `trước\u0000sau` của fixture); `tsc` strict chấp nhận, spec chỉ có `null-character-removed` cho PostgreSQL SQL. Git có thể coi file này là nhị phân khi diff.
  - Task 30 viết conformance `src/typescript.test.ts`; sau khi Task 30 merge, mọi sửa đổi generator này phải chạy cổng conformance đó.
