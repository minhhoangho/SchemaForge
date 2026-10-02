# Review phần 6 (code generators), range `1c42f9c..4ec7478`

Review: [Plan](../../plans/2026-09-15-code-generators-plan.md), [Spec](../../specs/2026-09-14-code-generators-design.md). Hai reviewer chỉ đọc nên không ghi file; log này do spec-writer viết theo yêu cầu của orchestrator. Đường dẫn file ngắn trong log tính từ `packages/core/src/generators/`, trừ khi ghi đầy đủ.

## 2026-10-02 — project-reviewer — Xong

- **Đã làm**:
  - Review commit range `1c42f9c..4ec7478` của phần 6 (Code generators) so với plan, spec và các rule trong `.claude/rules/`.
  - Kiểm tra escaping và chống injection ở mọi đích: không có lỗi.
  - Verdict: `approve with fixes`.
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**:
  - `.claude/scripts/verify.sh core --build --format`: PASS (2191 test, line coverage 98.09%).
  - Prettier: sạch.
  - `@schemaforge/codegen-conformance` typecheck, lint: PASS.
  - Vitest các bộ conformance openapi, dbml, mock-api: 18 test PASS.
  - `.claude/scripts/secret-scan.sh --range`: CLEAN.
- **Quyết định**: các finding sau, theo mức độ.
  - (should-fix) Seed: cột identity có giá trị ở một số dòng và thiếu ở dòng khác, nên sinh `DEFAULT` bên trong `IDENTITY_INSERT ON` (SQL Server báo Msg 339) hoặc va chạm sequence trên PostgreSQL. Vị trí `seed/serialize-seed-dataset.ts:159-183`.
  - (should-fix) `markdown/generate-markdown.ts` dài 388 dòng, vượt giới hạn 300 dòng của `.claude/rules/code-quality.md`.
  - (should-fix) 9 câu `switch` thiếu nhánh `default` kiểu `never`: `shared/json-representation.ts:53`, `shared/json-representation.ts:132`, `zod/generate-zod.ts:49`, `typescript/generate-typescript.ts:38`, `openapi/openapi-schemas.ts:41`, `dbml/generate-dbml.ts:53`, `dbml/generate-dbml.ts:96`, `markdown/generate-markdown.ts:74`, `markdown/generate-markdown.ts:115`.
  - (nit) DBML: ghi chú nhiều dòng mất phần thụt lề chung của mọi dòng và một dòng trống ở đầu khi `@dbml/core` 10.2.0 parse lại. Helper conformance `isIndentedMultilineText` (`packages/codegen-conformance/src/dbml.test.ts:39`) chỉ phủ trường hợp mọi dòng đều thụt lề.
  - (nit) Khoảng 9 fallback `?? ""` không bao giờ chạy tới; giữ nguyên.
- **Việc còn lại**:
  - [ ] Sửa seed identity và chạy lại conformance seed SQL Server, PostgreSQL (task fix riêng, log `2026-10-02-seed-review-fixes.md`).
  - [ ] Tách `markdown/generate-markdown.ts` dưới 300 dòng và thêm nhánh `never` cho 9 `switch` trên (task fix riêng, log `2026-10-02-generator-review-cleanup.md`).
- **Ghi chú cho người tiếp theo**: hai câu hỏi mở reviewer nêu đã được orchestrator xử lý ở mục "Xử lý" bên dưới: Zod `.max(n)` đếm code unit UTF-16 trong khi chỗ khác đếm code point; tên kiểu custom cho phép `,`, dấu cách và ngoặc.

## 2026-10-02 — ecc:security-reviewer — Xong

- **Đã làm**:
  - Review bảo mật cùng range `1c42f9c..4ec7478`. Không có finding CRITICAL hoặc HIGH.
  - Không đích nào cho thoát khỏi ngữ cảnh: quoting SQL ở 3 dialect, literal chuỗi, base64, `JSON.stringify` cho TypeScript, Zod, MSW, Prisma, xử lý `*/` trong JSDoc, escaping DBML, OpenAPI ghi dạng JSON; không có prototype pollution; regex đều tuyến tính; conformance dùng testcontainers và `execFile` với tham số cố định.
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**: đọc code và đối chiếu với từng đích; không chạy thêm lệnh ngoài các kiểm tra của project-reviewer.
- **Quyết định**: các finding sau, theo mức độ.
  - (medium-low) `parseSeedDataset` (`seed/seed-dataset.ts`) ném `RangeError` với mảng từ khoảng 150 000 phần tử, do `stack.push(...children.toReversed())` trong `findTooDeepPath`. Điều này phá hợp đồng không bao giờ ném lỗi khi nhận input từ AI.
  - (low) `CUSTOM_TYPE_NAME_PATTERN` trong `packages/core/src/validation/rules/custom-type-name.ts` cho phép chèn mệnh đề bên trong `CREATE TABLE` (ví dụ `text, extra_col int`, `int CHECK (x)`, `int REFERENCES other(id)`), nhưng không cho thoát ra câu lệnh khác.
  - (info) Markdown không escape `&`; không có HTML injection.
- **Việc còn lại**:
  - [ ] Sửa `findTooDeepPath` để không spread mảng lớn vào `push`, thêm test với mảng từ 150 000 phần tử (task fix riêng, log `2026-10-02-seed-review-fixes.md`).
  - [ ] Thu hẹp `CUSTOM_TYPE_NAME_PATTERN` sau khi Task 18 merge.
- **Ghi chú cho người tiếp theo**: thu hẹp pattern là thay đổi validation phần 2, cần đối chiếu với kiểu custom trong fixture (ví dụ `geometry(Point, 4326)`) trước khi sửa.

## 2026-10-02 — orchestrator — Xử lý

- **Đã làm**: quyết định xử lý từng finding của hai review.
  - Sửa seed (identity trong `IDENTITY_INSERT`, sequence PostgreSQL, `RangeError` của `parseSeedDataset`): giao task fix, log `document/executions/logs/2026-10-02-seed-review-fixes.md`.
  - Tách `markdown/generate-markdown.ts` và thêm nhánh `never` cho 9 `switch`: giao task fix, log `document/executions/logs/2026-10-02-generator-review-cleanup.md`.
  - Thu hẹp `CUSTOM_TYPE_NAME_PATTERN`: xếp hàng, làm sau khi Task 18 merge.
  - Escape `&` trong Markdown: không làm. Entity được giải mã thành văn bản, không có injection; thêm nếu có renderer hiện entity thô.
  - Fallback `?? ""` không chạy tới: giữ nguyên.
  - Giới hạn DBML (ghi chú nhiều dòng) và Zod (`.max(n)` đếm code unit UTF-16): ghi vào spec như giới hạn đã chấp nhận, R22 và R23 trong mục "Quyết định bổ sung 2026-10-02", cùng CG-09 và CG-05.
- **File thay đổi**: `document/specs/2026-09-14-code-generators-design.md` (CG-05, CG-09, R22, R23), log này.
- **Kiểm tra**: không áp dụng (chỉ sửa tài liệu).
- **Quyết định**: R22, R23 là quyết định của orchestrator thay người dùng; người dùng có thể đổi sau.
- **Việc còn lại**:
  - [ ] Thu hẹp `CUSTOM_TYPE_NAME_PATTERN` trong `packages/core/src/validation/rules/custom-type-name.ts` sau khi Task 18 merge, chặn chèn mệnh đề như `text, extra_col int`, `int CHECK (x)`, `int REFERENCES other(id)`.
- **Ghi chú cho người tiếp theo**: importer DBML ở phần 7 không được kỳ vọng ghi chú nhiều dòng round-trip chính xác (R22).
