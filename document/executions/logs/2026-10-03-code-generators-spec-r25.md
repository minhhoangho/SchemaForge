# Spec code generators: R25 (KEY trong CREATE TABLE cho cột AUTO_INCREMENT trên MySQL)

Spec: [2026-09-14-code-generators-design.md](../../specs/2026-09-14-code-generators-design.md). Không thuộc task nào của plan.

## 2026-10-03 — spec-writer — Xong
- **Đã làm**: thêm R25 vào bảng "Quyết định bổ sung 2026-10-02"; sửa CG-01 (bước 2 và 3), mục 4 (đoạn "Cột `AUTO_INCREMENT` trên MySQL", ma trận), ghi chú tham chiếu R25 ở R8, R14 và đoạn mở đầu.
- **File thay đổi**: `document/specs/2026-09-14-code-generators-design.md`
- **Kiểm tra**: bảng R25 đủ 4 cột như R24; không sửa plan, `architecture.md`, `roadmap.md` (không đổi thư viện hay trạng thái).
- **Quyết định**: tên index giữ `<bảng>_<cột>_idx` (`auto_trailing`, `auto_wide_key` trong yêu cầu là tên bảng fixture).
- **Ghi chú cho người tiếp theo**: task sửa ở log `2026-10-03-mysql-auto-increment-key.md` cần cập nhật snapshot SQL MySQL của `target-limit` và test CG-01.
