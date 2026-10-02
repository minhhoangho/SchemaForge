# Review plan phần 6: Code generators

Không có plan task (review plan). Plan: [2026-09-15-code-generators-plan.md](../../plans/2026-09-15-code-generators-plan.md). Spec: [2026-09-14-code-generators-design.md](../../specs/2026-09-14-code-generators-design.md). Log viết plan: [2026-10-02-code-generators-plan-pass-2.md](2026-10-02-code-generators-plan-pass-2.md). Reviewer chỉ đọc; log này do `spec-writer` ghi theo yêu cầu của orchestrator.

## 2026-10-02 14:27 — project-reviewer — Xong

- **Đã làm**: review plan phần 6 (bản chưa commit sau lượt 2) đối chiếu `CLAUDE.md`, `.claude/rules/`, `architecture.md`, spec phần 6 (R1–R18) và code nền đã merge. Kết luận: `needs-fix`, 4 lỗi chặn, 5 lỗi nên sửa, 4 nit.
- **File thay đổi**: không có (chỉ đọc).
- **Kiểm tra**:
  - `pnpm exec prettier --check` plan: đạt.
  - Secret-scan: CLEAN.
  - `prisma validate` 7.10 từ chối `@default(1e10)` với P1012.
  - `tsc` 6.0.3 strict báo TS2322 cho `switch` trên tham số generic trả `Promise<Generate<T>>`.
  - `@dbml/core` 10.2 bỏ phần thụt đầu dòng chung khỏi chuỗi `'''…'''`.
- **Quyết định**: tóm tắt phát hiện, đã được orchestrator chốt cách sửa:
  - Chặn B1: Task 17 ghi literal `real`, `double` dạng mũ trần, `prisma validate` từ chối; phải dùng `dbgenerated`.
  - Chặn B2: Task 18 không dành riêng `table`, `one`, `many`; tham số callback che biến bảng cùng tên.
  - Chặn B3: Task 17, 18 cần Task 13 (so khớp với `buildSqlDdlModel`) nhưng cùng đợt với nó; Task 28 dùng `listGeneratorCases()` của Task 27 nhưng cùng đợt.
  - Chặn B4: Task 33 `loadGenerator` bằng `switch` không qua typecheck strict (TS2322).
  - Nên sửa S5: Task 27 ghi 20 biến thể, thực tế 18.
  - Nên sửa S6: Task 18 chọn dạng `.default()` theo `column.type`, sai cho cột MySQL bị đổi sang `LONGTEXT` (R13).
  - Nên sửa S7: `parseSeedDataset` gọi Zod đệ quy trên input chưa biết (tràn stack với input lồng sâu), không giới hạn số dòng.
  - Nên sửa S8: Task 35 thiếu các mục spec cần sửa theo Vấn đề 18, 19; câu cũ ở Vấn đề 19 về spec phần 5 đã lỗi thời.
  - Nên sửa S9: Task 17 chép lại `sqlServerEnumLength` của Task 16; nên dùng chung trong `generators/shared/`.
  - Nit N10: giới hạn `'''…'''` của `@dbml/core` 10.2 chưa ghi ở Task 25, 31.
  - Nit N11: Task 34 cho chọn sửa `issue-and-error-messages.test.ts`; nên bắt buộc file test mới.
  - Nit N12: Task 19 chưa dành riêng `Record`.
  - Nit N13: Task 21 chưa nói `sequence` bắt đầu từ 1; test R14 của Task 17, 18 chưa khẳng định không có diagnostic.
- **Việc còn lại**: không có; mọi phát hiện đã được áp vào plan ở lượt "sửa sau review" ngày 2026-10-02 của log viết plan.
- **Ghi chú cho người tiếp theo**: không có.

## 2026-10-02 14:35 — project-reviewer — Xong (duyệt lại)

- **Đã làm**: duyệt lại plan phần 6 sau lượt sửa theo review đầu. Kết luận: `needs-fix`, 1 lỗi chặn, 1 lỗi nên sửa, 5 nit. Mọi mục B1–B4, S5–S9, N10–N13, X1, X2 của lượt trước đã kiểm chứng là áp đúng, không gây hồi quy.
- **File thay đổi**: không có (chỉ đọc).
- **Kiểm tra**:
  - `pnpm exec prettier --check` trên plan, spec và các log: đạt.
  - Secret-scan: CLEAN.
  - `tsc` 6.0.3 strict trên mẫu mapped type `loaders[target]()` của Task 33: đạt.
  - Node v24.21.0 parse được JSON lồng 100 000 cấp (`JSON.parse` không tràn stack, nên test lồng sâu của Task 21 dựng được input).
  - Đợt 4–8: mỗi đợt tối đa 5 task, phụ thuộc nằm ở đợt trước.
  - Chữ ký trong plan khớp các file đã merge `dialect-column-types.ts`, `dialect-constraints.ts`, `sql-literals.ts`.
- **Quyết định**: phát hiện và cách sửa orchestrator đã chốt:
  - Chặn 1: Task 21 bước 4, 6 cho quan hệ đầu tiên theo `sortRelations` đặt cột nguồn dùng chung, làm schema đa tenant (`orders.tenant_id → tenants.id` cùng `(tenant_id, user_id) → users(tenant_id, id)`) sinh cặp không khớp dòng `users` nào (`seed-foreign-key-missing`). Sửa: ứng viên của quan hệ sau phải khớp cột đã gán, quy tắc null mới, cùng quy tắc cho quan hệ hoãn; thêm test `picks a parent row that agrees with a column shared by two relations`.
  - Nên sửa 2: Task 4 ghi cột khóa ngoại của vòng `(i + 1) % n` trong `createLargeSchema` là nullable; Task 28 khẳng định một lần ngoài `bench` rằng dataset seed 100 dòng có ít nhất một bảng có dòng.
  - Nit 3: Task 21 bước 5 giữ hành vi dừng cả bảng khi một dòng hết lượt; ghi thành Vấn đề 20, Task 35 sửa bullet "Unique" của CG-08.
  - Nit 4: Vấn đề 19 bỏ câu lỗi thời về `@schemaforge/core/ai`, ghi khớp spec phần 5 (AI-R43).
  - Nit 5: Task 18 định nghĩa "bảng có trường quan hệ" theo trường thật sự được ghi; thêm test `writes no relations block for a table whose only field is an omitted named one-to-one inverse`.
  - Nit 6: Task 31 chọn bảng có cột khóa không phải `json` cho bước "DELETE rồi GET → 404" (`hasKey` của Task 23 so bằng `String()`); không sửa `hasKey`.
  - Nit 7: Task 13 bước 1 ghi `findUnindexableConstraints(schema, dialect, types.types)`.
- **Việc còn lại**:
  - [ ] Task 21 bước 4, 6: quy tắc ứng viên khớp cột đã gán và quy tắc null mới; test `picks a parent row that agrees with a column shared by two relations` trong `build-seed-dataset.test.ts`.
  - [ ] Task 4: cột khóa ngoại của vòng trong `createLargeSchema` nullable; Task 28: khẳng định dataset seed có bảng có dòng, ngoài `bench`.
  - [ ] Vấn đề 20 cho hành vi dừng bảng ở Task 21 bước 5 (sửa câu dẫn "Vấn đề 13–19"); Task 35 thêm sửa bullet "Unique" của CG-08.
  - [ ] Vấn đề 19: bỏ câu "thay vì ở `@schemaforge/core/ai` như spec phần 5 đang ghi".
  - [ ] Task 18: định nghĩa "bảng có trường quan hệ"; test `writes no relations block for a table whose only field is an omitted named one-to-one inverse`.
  - [ ] Task 31: chọn bảng có khóa không phải `json` cho bước 404.
  - [ ] Task 13 bước 1: `findUnindexableConstraints(schema, dialect, types.types)`.
- **Ghi chú cho người tiếp theo**: sau khi sửa, chỉ cần kiểm lại Task 4, 13, 18, 21, 23, 28, 31 và bảng "Vấn đề". Khi cài Task 21, 22, nên cho `ecc:database-reviewer` xem seed SQL sinh ra.
