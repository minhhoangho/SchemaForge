# Spec: tên kiểu custom (R26) và mở rộng R25

Specs: [core-schema-model](../../specs/2026-09-14-core-schema-model-design.md), [code-generators](../../specs/2026-09-14-code-generators-design.md). Không thuộc task nào của plan. Quyết định của orchestrator ngày 2026-10-03.

## 2026-10-03 — spec-writer — Xong
- **Đã làm**: (1) core-schema-model mục 3 "Kiểu custom": thay mô tả tập ký tự an toàn bằng thứ tự kiểm tra (≤63 byte `MAX_NAME_BYTES`, ngữ pháp, từ khóa cấm), ngữ pháp, danh sách từ khóa, lý do, hệ quả, rủi ro còn lại đã chấp nhận; sửa dòng `column-custom-type-invalid` ở bảng mã issue. (2) code-generators: thêm R26; mở rộng R25 và mục 4 "Cột `AUTO_INCREMENT` trên MySQL" (index người dùng có cột đầu là cột tự tăng được ghi trong `CREATE TABLE` dưới dạng `KEY` hoặc `UNIQUE KEY`, index đầu tiên theo `model.indexes`), bước 2 của CG-01, hàng ma trận mục 4, và câu giới thiệu đầu spec.
- **File thay đổi**: `document/specs/2026-09-14-core-schema-model-design.md`, `document/specs/2026-09-14-code-generators-design.md`
- **Kiểm tra**: bảng R25, R26 đủ 4 cột; liên kết tương đối tới spec core; không sửa plan, `architecture.md`, `roadmap.md` (không đổi thư viện hay trạng thái).
- **Quyết định**: giữ nguyên tên diagnostic `custom-type-unsafe` (vẫn đúng nghĩa); KEY của index người dùng dùng tên và danh sách cột của index gốc, cùng vị trí với dòng thay thế.
- **Ghi chú cho người tiếp theo**: log `2026-10-03-custom-type-name-hardening.md` được dẫn tới nhưng do task triển khai tạo; plan phần 6 và importer (phần 7) chưa kiểm tra có tạo kiểu custom dạng `... with time zone` hay không.
