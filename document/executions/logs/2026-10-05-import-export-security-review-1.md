# Rà soát bảo mật importer phần 7 (lần 1)

Rà soát các importer của [plan phần 7](../../plans/2026-10-03-import-export-plan.md), theo [spec phần 7](../../specs/2026-09-15-import-export-design.md) (mục 1 "Giới hạn input", mục 13, 14). `ecc:security-reviewer` không ghi file trong repo, nên log này do `spec-writer` viết từ báo cáo của reviewer và quyết định của orchestrator.

## 2026-10-05 22:03 — ecc:security-reviewer — Xong

- **Đã làm**
  - Đọc `packages/core/src/importers/shared/`, `json/`, `prisma/`, `dbml/`, các file scanner của `sql/` (không gồm `import-sql.ts`, `sql-draft*.ts`), `operations/build-import-operation.ts`, `parse/structural-invariants.ts`.
  - Rà ReDoS, vòng lặp bậc hai, đệ quy sâu, prototype pollution, kiểm tra JSON, không throw, `eval`, import động, log.
  - Probe và fuzz ngoài repo (thư mục scratchpad).
- **File thay đổi**: không có.
- **Kiểm tra**
  - 8000 model Prisma một cột mất 13 s ở `parseSchemaDocument`, 10000 model 22 s; 10000 bảng DBML 24 s.
  - `DELIMITER` MySQL dài 5k, 10k, 20k, 40k ký tự mất 60 ms, 350 ms, 1,9 s, 6,7 s; 100k không xong sau hơn 400 s.
  - Fuzz 54k biến thể của 9 fixture Prisma và DBML: 0 lần throw.
  - Lồng sâu 100k `[`, `f(`, `{` và JSON: trả diagnostic, không tràn stack.
  - Tên `__proto__`, `constructor` và khóa `__proto__` trong JSON: an toàn.
  - Không có ReDoS, `eval`, `Function`, import động, `console`.
- **Quyết định**
  - Không có lỗi critical.
  - HIGH-1: `checkTableColumnIds` trong `structural-invariants.ts` là O(bảng × cột); giới hạn 20 000 phần tử không chặn được, và JSON chỉ đếm phần tử sau `parseSchemaDocument`.
  - HIGH-2: `statement-scanner.ts` nhận delimiter MySQL dài tùy ý và gọi `startsWith` ở mỗi bước, nên thời gian tăng bậc hai.
  - MEDIUM: `assembleDocument` (dòng 269-273) và `elementAt` có `throw`; không giới hạn số token SQL (2 MiB `(` cho 2M token, khoảng 600 ms, khoảng 200 MB); giới hạn phần tử chỉ kiểm sau khi parse xong (DBML 30 000 bảng mất 6,7 s trước khi trả `too-many-elements`).
  - LOW: mọi ký tự từ U+0080 là ký tự bắt đầu từ trong lexer SQL; `GO` và `DELIMITER` chỉ nhận theo `\n`.
  - Orchestrator: giao `core-engineer` sửa HIGH-1, HIGH-2 và các MEDIUM (log `2026-10-05-import-export-security-fixes-1.md`) trước khi nối importer vào giao diện (Task 25); LOW chỉ ghi nhận.
- **Việc còn lại**
  - [ ] HIGH-1: bỏ chi phí O(bảng × cột) của `checkTableColumnIds` trong `packages/core/src/parse/structural-invariants.ts`, và đếm phần tử JSON trước `parseSchemaDocument`.
  - [ ] HIGH-2: giới hạn độ dài delimiter MySQL và bỏ vòng `startsWith` bậc hai trong `packages/core/src/importers/sql/statement-scanner.ts`.
  - [ ] MEDIUM: bỏ `throw` ở `assembleDocument` (dòng 269-273) và `elementAt`; giới hạn số token SQL; kiểm giới hạn phần tử trong lúc parse thay vì sau khi parse xong.
  - [ ] Rà `import-sql.ts` và `sql-draft*.ts`: giới hạn, bắt exception của `@dbml/core`, dùng `Map` cho tên.
- **Ghi chú cho người tiếp theo**: thời gian đo trên máy tải nặng, chỉ mang tính tương đối; lỗi bậc hai thể hiện qua tỉ lệ (gấp đôi đầu vào, gấp bốn thời gian).
