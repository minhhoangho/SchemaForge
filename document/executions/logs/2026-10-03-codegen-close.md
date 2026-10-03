# Đóng phần 6 Code generators (SQL Server kiểm tra bằng code)

- Spec: [`document/specs/2026-09-14-code-generators-design.md`](../../specs/2026-09-14-code-generators-design.md)
- Plan: [`document/plans/2026-09-15-code-generators-plan.md`](../../plans/2026-09-15-code-generators-plan.md) (không đổi)
- Log kiểm tra: [`2026-10-03-sqlserver-code-check.md`](2026-10-03-sqlserver-code-check.md); Task 35: [`2026-10-03-code-generators-task-35.md`](2026-10-03-code-generators-task-35.md)

## 2026-10-03 — spec-writer — Xong

- **Đã làm**
  - `roadmap.md`: phần 6 sang "Xong"; thay đoạn giải thích bằng ghi chú ngắn dẫn tới log kiểm tra và R34.
  - Spec phần 6: mục 5 thêm hai bullet (SQL Server `\` + xuống dòng nhân đôi cả `\` lẫn xuống dòng; seed `decimal` tối đa 38 chữ số); CG-08 thêm dẫn chiếu "(tối đa 38 chữ số, mục 5)"; mục Rủi ro: thay mục "Việc còn mở" SQL Server bằng bullet "SQL Server, kiểm tra bằng code thay conformance" (quyết định, 15/15 file 142 test, rủi ro còn lại, case conformance đề xuất, giới hạn đã biết); sửa câu "Còn phải xác nhận bằng conformance test" ở bullet probe SQL Server; R3 thêm "(thay bằng R34 cho SQL Server)"; thêm R34.
  - Task 35 log: thêm entry cuối, không sửa entry cũ.
- **File thay đổi**: `document/roadmap.md`, `document/specs/2026-09-14-code-generators-design.md`, `document/executions/logs/2026-10-03-code-generators-task-35.md`, log này.
- **Kiểm tra**: đọc lại các đoạn đã sửa; bảng R34 đúng 4 cột; liên kết tương đối tới log kiểm tra tồn tại. Không chạy lệnh test (chỉ sửa tài liệu).
- **Quyết định**
  - Các giới hạn đã biết đặt trong mục Rủi ro (bullet SQL Server), không thêm vào mục CG-01, vì chưa là quy tắc và người dùng có thể xử lý sau; hai quy tắc đã sửa mới vào mục 5. Giới hạn thứ sáu (tên > 128 ký tự, bảng không cột...) lấy từ bảng kịch bản của log kiểm tra.
  - Thêm R34 thay R3 cho SQL Server thay vì sửa R3 im lặng, theo cách các dòng R trước đã làm ("thay bằng Rx"). Không thêm mục "Quyết định bổ sung" mới.
  - Escape `\` ghi theo log kiểm tra: `\` + (CR)LF thành `\\` + (CR)LF + (CR)LF, nên mô tả "xuống dòng lặp hai lần".
  - Rủi ro còn lại ghi `sys.default_constraints` cho default, bên cạnh `sys.extended_properties` của log (log chỉ nêu cái sau), vì default đọc lại từ view đó.
  - Mục "Màn hình hẹp" trong spec đã lỗi thời (log `narrow-screen-layout` Xong): đổi sang "đã làm, còn kiểm tra tay"; roadmap chỉ còn nhắc tối ưu tùy chọn. Đây là chỗ ngoài yêu cầu, để mục Rủi ro khớp roadmap.
  - Không sửa `architecture.md` và `plans/*` theo chỉ định; thư viện không đổi nên `architecture.md` không cần sửa.
  - Không thêm dòng "Câu hỏi đã trả lời": quyết định ghi bằng R34, vì không phải câu hỏi mở của spec.
- **Việc còn lại**: kiểm tra tay bản production và bố cục màn hình hẹp (xem Task 35 log); case conformance `\` cuối dòng khi có database SQL Server.
- **Ghi chú cho người tiếp theo**: mục "Việc còn mở" trong Rủi ro chỉ còn "Màn hình hẹp (đã làm)" và "Hiệu năng (tùy chọn)". Nếu plan phần 6 còn câu "phần 6 chỉ xong khi mọi conformance qua", cần agent phụ trách plan sửa (không thuộc lượt này).
