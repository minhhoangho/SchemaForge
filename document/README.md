# Tài liệu SchemaForge

Tài liệu thiết kế của dự án, viết bằng tiếng Việt. Code và `CLAUDE.md` viết bằng tiếng Anh.

## Mục lục

| Tài liệu | Nội dung |
|---|---|
| [overview.md](overview.md) | Sản phẩm là gì, nguyên tắc sản phẩm, danh sách tính năng |
| [architecture.md](architecture.md) | Các thành phần, luồng dữ liệu, bảo mật API key, quyết định kỹ thuật |
| [roadmap.md](roadmap.md) | Các phần của dự án, phụ thuộc và thứ tự thực hiện |
| [specs/](specs/) | Spec thiết kế của từng phần |

## Quy ước

- Mỗi phần trong roadmap cần một spec trước khi làm: `specs/YYYY-MM-DD-<topic>-design.md`.
- Spec được duyệt thì viết plan: `plans/YYYY-MM-DD-<topic>-plan.md`. Thư mục `plans/` được tạo khi có plan đầu tiên.
- `<topic>` viết tiếng Anh, dạng kebab-case, ví dụ `core-schema-model`.
- Khi chốt hoặc thay đổi một quyết định kỹ thuật, cập nhật `architecture.md` kèm lý do.
- Khi một phần đổi trạng thái, cập nhật bảng trong `roadmap.md`.
