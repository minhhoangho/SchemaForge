# Task 26: CG-10 tài liệu Markdown

Plan: [Task 26](../../plans/2026-09-15-code-generators-plan.md#task-26-cg-10-tài-liệu-markdown). Spec: [CG-10](../../specs/2026-09-14-code-generators-design.md#cg-10-tài-liệu-markdown).

## 2026-10-02 21:30 — core-engineer — Xong

- **Đã làm**
  - Viết test trước (`markdown-text.test.ts`, `generate-markdown.test.ts`), chạy `test-file.sh` thấy đỏ vì `Cannot find module './markdown-text.js'` và `'./generate-markdown.js'`, rồi cài đặt.
  - `markdown-text.ts`: `escapeMarkdownText` (thêm `\` trước `` \ ` * _ { } [ ] ( ) # + - . ! | < > ~ ``), `formatMarkdownInline` (escape rồi đổi `\r\n`, `\r`, `\n` thành `<br>`).
  - `generate-markdown.ts`: `generateMarkdown` (const `Generate<"markdown">`) in `schema.md`: `#` tên schema, `## enumsHeading` + `###` từng enum + danh sách giá trị, `## tablesHeading` + `###` từng bảng, comment bảng, bảng cột sáu cột, `#### indexesHeading` + bảng index, `#### relationsHeading` + nhóm đi ra, đi vào. Diagnostic duy nhất là `default-omitted`.
  - `index.ts` chỉ export `generateMarkdown` và type `MarkdownOptions`.
  - Snapshot bốn fixture trong `src/generators/__snapshots__/markdown/`, đã đọc lại và đối chiếu với spec CG-10 và mục 5 "Markdown".
- **File thay đổi**
  - `packages/core/src/generators/markdown/index.ts`, `generate-markdown.ts`, `generate-markdown.test.ts`, `markdown-text.ts`, `markdown-text.test.ts` (mới)
  - `packages/core/src/generators/__snapshots__/markdown/{sample,naming-edge,target-limit,empty}.md` và `.diagnostics.txt` tương ứng (mới; cả bốn diagnostics là `(none)`)
- **Kiểm tra**
  - RED: `.claude/scripts/test-file.sh core packages/core/src/generators/markdown/markdown-text.test.ts` và `generate-markdown.test.ts`: FAIL, `Cannot find module`.
  - GREEN: hai lệnh trên PASS (generate-markdown: 45 test).
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS`; typecheck, lint, test (2050 test pass, line coverage 98,22%), build, prettier đều PASS.
  - `pnpm --filter @schemaforge/backend exec node --input-type=module -e '…generateMarkdown(createSampleSchema(), { labels })…'` với object 23 nhãn: in `23 function schema.md`.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - CG-10 không có conformance (Vấn đề 13).
- **Quyết định**
  - Mọi ô của bảng Markdown (kể cả kiểu, `now()`, `gen_random_uuid()`, `yes`/`no`) đi qua `formatMarkdownInline` một lần ở `tableRow`: một chỗ escape duy nhất, không ô nào lọt; `now\(\)` hiển thị đúng `now()`.
  - Ô rỗng ghi `| |` (không hai khoảng trắng) cho output gọn; GFM hiểu như ô rỗng.
  - Nhãn nhóm quan hệ (`outgoingRelations`, `incomingRelations`) và danh sách là hai block riêng (có dòng trống giữa), để mọi trình hiển thị nhận danh sách, theo quy ước "mỗi tiêu đề và phần thân là block riêng".
  - Tên cột trong dòng quan hệ được escape từng tên rồi nối `, `; ký tự cấu trúc do generator viết (`→`, `.`, `(…)`) ghi trần vì tên đã escape nên không tạo được liên kết hay định dạng.
  - Kiểu enum không tìm thấy ghi `text` như Task 25 (không xảy ra với tài liệu đã qua bất biến cấu trúc).
  - Quan hệ có bảng đầu kia không tìm thấy thì bỏ qua (như Task 25); cột không tìm thấy bị lọc khỏi danh sách.
  - Hàm `typeName` lặp lại logic `renderType` của DBML (bản thứ hai, chưa trích ra `shared/` theo quy tắc "trích ở bản thứ ba"; thư mục đích không được import nhau).
  - Thêm test ngoài danh sách plan: tên kiểu chung, custom (`it.each`), kiểu enum, năm hành động (`it.each`), quan hệ nhiều cột, escape tên trong tiêu đề và danh sách.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Comment bảng bắt đầu bằng 4 khoảng trắng trở lên thành khối code khi hiển thị (Markdown thụt lề), và khoảng trắng đầu, cuối ô bảng bị trình hiển thị cắt. Output vẫn an toàn (không chèn được cú pháp); plan không yêu cầu xử lý nên chưa bù.
  - Khi `MarkdownLabels` thêm khóa, cập nhật `TEST_MARKDOWN_LABELS` trong `generate-markdown.test.ts` và ghi lại snapshot `markdown/`.
