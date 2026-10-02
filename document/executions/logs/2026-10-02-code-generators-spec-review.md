# Review spec code generators (Task 0)

Plan: [2026-09-15-code-generators-plan.md](../../plans/2026-09-15-code-generators-plan.md), mục "Vấn đề phát hiện khi lập plan" (Task 0). Spec: [2026-09-14-code-generators-design.md](../../specs/2026-09-14-code-generators-design.md). Reviewer chỉ đọc nên không ghi file; log này do spec-writer viết theo yêu cầu của orchestrator. Các sửa đổi tương ứng nằm trong bảng "Sửa sau review ngày 2026-10-02" của spec và trong [log Task 0](2026-10-02-code-generators-task-0.md).

## 2026-10-02 — project-reviewer (vòng 1) — Xong

- **Đã làm**: review các sửa spec cho vấn đề 1–12. Kết luận: needs-fix.
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**: `prettier --check` qua; secret-scan CLEAN; không chạy probe trên database thật (thuộc Task 8).
- **Quyết định**: phát hiện: SQL Server từ chối khóa có phần cố định quá giới hạn bằng Msg 1944 (không chỉ cảnh báo); cách viết cột MySQL vượt giới hạn trong khóa; thứ tự cổng conformance; cần bảng thay đổi với spec phần 2; cần probe giây lẻ MySQL; hai nit. Đã sửa thành R1–R9.
- **Ghi chú cho người tiếp theo**: không còn việc mở từ vòng này.

## 2026-10-02 — ecc:database-reviewer — Xong

- **Đã làm**: review spec theo hành vi database. Kết luận: accept with follow-ups.
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**: `prettier --check` qua; secret-scan CLEAN; không chạy probe trên database thật (thuộc Task 8).
- **Quyết định**: phát hiện: cách viết giới hạn tên sequence của PostgreSQL; MySQL so định danh theo `utf8mb3_general_ci`, gộp `đ`/`ø`/`ł`/`ħ`; kích thước dòng MySQL 65 535 byte (lỗi 1118); SQL Server bắt cột khóa ngoại cùng kiểu với cột được tham chiếu; cột `AUTO_INCREMENT` không đứng đầu index nào; làm tròn giây lẻ MySQL có thể nhớ sang đơn vị kế tiếp; không gian tên kiểu của enum và bảng trên PostgreSQL. Đã sửa thành R10–R17.
- **Ghi chú cho người tiếp theo**: không còn việc mở từ vòng này.

## 2026-10-02 — project-reviewer (vòng 2) — Xong

- **Đã làm**: review lại sau R1–R9. Kết luận: needs-fix.
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**: `prettier --check` qua; secret-scan CLEAN; không chạy probe trên database thật (thuộc Task 8).
- **Quyết định**: phát hiện: thay đổi R1 không lan tới cột khóa ngoại ghép cặp (Msg 1753, 1778). Đã sửa thành R10, cùng R11 và các nit.
- **Ghi chú cho người tiếp theo**: không còn việc mở từ vòng này.

## 2026-10-02 — project-reviewer (vòng 3) — Xong

- **Đã làm**: review lại sau R10–R18. Kết luận: accept with follow-ups.
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**: `prettier --check` qua; secret-scan CLEAN; không chạy probe trên database thật (thuộc Task 8).
- **Quyết định**: phát hiện: phạm vi R13 phải loại cả cột thuộc khóa chính, unique, index hay cặp cột quan hệ (MySQL không cho khóa ngoại trên `LONGTEXT`); hai nit (liệt kê output MySQL dùng phép cắt giây lẻ kèm lý do tương đương; ghi chú "(thay bằng R15)" ở dòng R5). Đã sửa trong lần chạy cuối của spec-writer.
- **Ghi chú cho người tiếp theo**: các probe trên database thật thuộc Task 8 của plan.
