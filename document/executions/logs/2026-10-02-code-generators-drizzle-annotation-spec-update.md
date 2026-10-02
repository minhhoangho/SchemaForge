# Ghi quyết định chú thích kiểu callback Drizzle (CG-03) vào spec và plan

Spec: [Code generators](../../specs/2026-09-14-code-generators-design.md) (CG-03, mục Rủi ro, R21). Plan: [Task 18](../../plans/2026-09-15-code-generators-plan.md#task-18-cg-03-drizzle-schema).

## 2026-10-02 — spec-writer — Xong

- **Đã làm**: ghi quyết định của orchestrator sau bước kiểm chứng sớm của Task 18 (`drizzle-orm` 0.45.3: hai bảng tham chiếu nhau trong callback cấu hình gây TS7022, TS7024 ở PostgreSQL và MySQL; `getTableConfig` lúc chạy vẫn đúng). Spec: bullet "Cấu trúc file" của CG-03 (mọi callback chú thích `PgTableExtraConfigValue[]` / `MySqlTableExtraConfigValue[]`, import `type …` khi có callback), dòng Drizzle trong mục Rủi ro (kết quả probe, rủi ro `getTableConfig` đã đóng), dòng R21 trong bảng "Sửa sau review" của mục "Quyết định bổ sung 2026-10-02" (theo cách ghi R20), một câu ở đoạn mở đầu. Plan Task 18: Mục tiêu dẫn R21; "Bước kiểm chứng sớm" dùng dạng có chú thích và kỳ vọng không có diagnostic; `DRIZZLE_IMPORT_NAMES` thêm hai tên type; "Cấu trúc file" bước 1 (import `type …`, sắp theo tên không tính tiền tố `type `, nên đứng đầu) và bước 4 (mẫu code và quy tắc chú thích); test `imports only used builders sorted by name` cập nhật, thêm `annotates every table config callback with the dialect extra config type`.
- **File thay đổi**: `document/specs/2026-09-14-code-generators-design.md`, `document/plans/2026-09-15-code-generators-plan.md`, file log này.
- **Kiểm tra**: `grep` trong `node_modules/.pnpm/drizzle-orm@0.45.3_*/node_modules/drizzle-orm`: `pg-core/table.d.ts` export `PgTableExtraConfigValue`, `mysql-core/table.d.ts` export `MySqlTableExtraConfigValue`, cả hai `index.d.ts` có `export * from "./table.js"`. Bảng R21 giữ đúng 4 cột; `git diff --stat` chỉ hai file tài liệu.
- **Quyết định**: thứ tự tên type trong dòng import do spec-writer chốt ở mức plan: sắp theo tên không tính tiền tố `type ` bằng `<`, nên tên type (chữ hoa đầu) đứng trước builder; "có callback" nghĩa là mảng ràng buộc của bảng không rỗng (đã có quy tắc "Mảng rỗng thì không có tham số callback").
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: Task 30 (`drizzle.test.ts`) vẫn kiểm tra `getTableConfig` lúc chạy, không cần sửa. Spec ghi phiên bản `drizzle-orm` 0.45.2 ở CG-03 và mục Phiên bản, trong khi bước kiểm chứng chạy trên 0.45.3 đã cài; không đổi trong lần này.
