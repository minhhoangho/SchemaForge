# Task 13: Lexer và parser Prisma

Plan: [Task 13](../../plans/2026-10-03-import-export-plan.md#task-13-lexer-và-parser-prisma). Spec: [mục 6 "Chọn parser", "Lỗi cú pháp và khối không hỗ trợ"; mục 13](../../specs/2026-09-15-import-export-design.md#6-ie-02-import-prisma).

## 2026-10-05 17:10 — core-engineer — Xong

- **Đã làm**
  - `prisma-ast.ts`: các type AST đúng chữ ký của plan (`PrismaPosition`, `PrismaValue`, `PrismaArgument`, `PrismaAttribute`, `PrismaField`, `PrismaEnumValue`, `PrismaProperty`, `PrismaBlock`, `PrismaSchema`, `PrismaSyntaxError`).
  - `prisma-lexer.ts`: `tokenizePrisma(source): Result<readonly PrismaToken[], PrismaSyntaxError>`, vòng lặp một lượt trên ký tự; `PrismaToken = { kind, text, position }` với `kind` là `identifier | string | number | symbol | newline | docComment | end`. Chuỗi giải escape kiểu JSON (`\" \\ \/ \b \f \n \r \t \uXXXX`); số `-?digits(.digits)?([eE][+-]?digits)?` giữ văn bản gốc; `//` bị bỏ, `///` thành token (bỏ `///`, một dấu cách đầu và `\r` cuối dòng). Cột theo code unit UTF-16.
  - `prisma-parser.ts`: `parsePrismaSchema(source): Result<PrismaSchema, PrismaSyntaxError>` và hằng `MAX_PRISMA_NESTING = 32`; parser đệ quy xuống, dừng ở token sai đầu tiên, không phục hồi.
  - Test viết trước, đã thấy đỏ (`Cannot find module './prisma-lexer.js'`, `Cannot find module './prisma-parser.js'`) rồi mới cài đặt. Đủ các test tên trong plan, thêm: lỗi escape, ký tự lạ, mỗi loại token lỗi của parser (`it.each` 17 trường hợp), doc comment cuối dòng, doc comment bị tách bởi dòng trống, xuống dòng trong danh sách đối số, đúng giới hạn lồng, parse output `generatePrisma` của cả ba fixture với ba provider, hai property test fast-check (seed cố định) cho "không throw" trên chuỗi bất kỳ và trên schema sinh ra bị chèn ký tự.
- **File thay đổi** (đều mới)
  - `packages/core/src/importers/prisma/prisma-ast.ts`
  - `packages/core/src/importers/prisma/prisma-lexer.ts`, `prisma-lexer.test.ts`
  - `packages/core/src/importers/prisma/prisma-parser.ts`, `prisma-parser.test.ts`
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: typecheck, lint, test, build, prettier đều PASS, `RESULT: PASS`.
  - `pnpm --filter @schemaforge/core test`: 149 file, 3083 test pass; coverage số dòng toàn core 97,66%; `prisma-lexer.ts` 100%, `prisma-parser.ts` 98,53% (chỉ còn nhánh lập trình không tới được: `peek` vượt token `end`, nhánh `never`).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - Không đổi API công khai: chưa có `index.ts` cho `importers/prisma` (Task 15), không sửa `src/index.ts`.
- **Quyết định**
  - Lexer luôn thêm token `end` cuối cùng để parser báo lỗi "hết input" (khối chưa đóng) tại vị trí cuối nguồn.
  - Doc comment: các dòng `///` liền trước phần tử được ghép bằng `\n`; dòng trống (hai `newline` liên tiếp) làm mất các dòng đã gom, theo chữ "liền trước" của plan. Một dòng `//` ở giữa cũng tách vì nó để lại dòng trống về mặt token.
  - `///` cuối dòng của trường hoặc giá trị enum được nối vào `docComment` (giống psl của Prisma ghép trailing doc comment); sau thuộc tính khối hoặc thuộc tính cấu hình thì bị bỏ vì AST không có chỗ chứa.
  - Xuống dòng và `///` trong ngoặc của đối số, mảng được bỏ qua (cho phép mảng nhiều dòng); dấu phẩy cuối được chấp nhận.
  - Độ sâu lồng tính mọi ngoặc mở trong một thuộc tính hoặc giá trị cấu hình, kể cả ngoặc đối số của thuộc tính; ngoặc thứ 33 là lỗi tại chính ngoặc đó.
  - Escape không hợp lệ trong chuỗi là lỗi cú pháp tại dấu `\`; chuỗi gặp xuống dòng hoặc hết input là lỗi tại dấu `"` mở.
  - Định danh chỉ gồm ASCII `[A-Za-z_][A-Za-z0-9_]*` (như Prisma); `\r` coi là khoảng trắng, chỉ `\n` tách dòng.
  - `Unsupported` phải theo sau bởi `("…")`; `Type[]?` là lỗi tại `?`.
  - Property test dùng timeout riêng 60 s (`PROPERTY_TIMEOUT_MS`) theo mẫu `apply-operation.properties.test.ts`, vì lần chạy đầu với coverage mất hơn 5 s (parser chỉ mất dưới 1 ms cho 200 chuỗi; thời gian nằm ở fast-check trong Vitest).
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - `prisma-parser.ts` dài khoảng 450 dòng sau prettier, vượt mức "khoảng 300 dòng" của `code-quality.md`; tách (ví dụ phần đọc giá trị, đối số sang `prisma-parser-values.ts`) cần file ngoài danh sách "File sở hữu" nên chưa làm. Orchestrator quyết định có tạo task tách hay không.
  - Task 14, 15 dùng `PrismaBlock` (discriminated union theo `kind`), `PrismaAttribute.name` không có `@` (ví dụ `"db.VarChar"`), giá trị `identifier` gồm cả `true`, `false`, và tên có chấm.

## 2026-10-05 17:30 — core-engineer — Xong

- **Đã làm**: tách `prisma-parser.ts` thành hai file, không đổi hành vi. `prisma-parser-values.ts` (mới) chứa cursor (`Cursor`, `Parsed`, `peek`, `advance`, `fail`, `isSymbol`, `expectSymbol`, `expectIdentifier`), phần đọc thuộc tính (`parseFieldAttributes`, `parseAttribute`, `parseDottedName`), giá trị, đối số, danh sách và `MAX_PRISMA_NESTING`. `prisma-parser.ts` giữ phần khối, thân khối, trường, giá trị enum, doc comment; vẫn export `parsePrismaSchema` và re-export `MAX_PRISMA_NESTING`. Test không đổi.
- **File thay đổi**: `packages/core/src/importers/prisma/prisma-parser.ts` (286 dòng), `packages/core/src/importers/prisma/prisma-parser-values.ts` (mới, 181 dòng).
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS`.
  - `pnpm --filter @schemaforge/core test`: 149 file, 3083 test pass; coverage số dòng toàn core 97,66%; `prisma-parser.ts` 98,29%, `prisma-parser-values.ts` 98,86% (dòng còn thiếu: guard lập trình trong `peek`, nhánh `never`).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**: tách file do orchestrator cho phép (lý do: giới hạn độ dài file khoảng 300 dòng của `code-quality.md`). `MAX_PRISMA_NESTING` khai báo trong `prisma-parser-values.ts` và re-export từ `prisma-parser.ts` để tránh import vòng. Không tạo `prisma-parser-values.test.ts`: hành vi đã được test qua `parsePrismaSchema`.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: Task 14, 15 chỉ cần import từ `prisma-parser.ts` và `prisma-ast.ts`; `prisma-parser-values.ts` là nội bộ của parser.
