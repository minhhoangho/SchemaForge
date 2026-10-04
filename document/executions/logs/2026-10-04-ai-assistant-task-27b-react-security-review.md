# Review React và bảo mật Task 27b: Panel AI, thanh xem trước và nối vào editor

Plan: [Task 27b](../../plans/2026-10-03-ai-assistant-plan.md#task-27b-panel-ai-thanh-báo-xem-trước-nút-trên-toolbar-khóa-editor-khi-xem-trước). Spec: [AI-R4, R34, R48, R50–R54, R61; mục 13, mục 15](../../specs/2026-10-02-ai-assistant-design.md).

## 2026-10-04 — ecc:react-reviewer — Xong

- **Đã làm**
  - Review chỉ đọc mã React của Task 27b chưa commit trên `master`. Kết luận: chấp nhận kèm sửa, không có phát hiện Critical.
  - Xác nhận đúng:
    - Đóng hộp thoại trong lúc render có bảo vệ, không vòng lặp, hook gọi vô điều kiện.
    - Selector Zustand trả về giá trị nguyên thủy hoặc tham chiếu ổn định.
    - Effect đồng bộ ref của provider, reset khi StrictMode và effect khi đăng xuất đều đúng.
    - Khởi tạo trạng thái đồng ý an toàn (`ssr:false`, khóa theo id người dùng).
    - Timer hoãn focus không rò rỉ.
- **File thay đổi**: không (reviewer chỉ đọc, không chạy lệnh).
- **Kiểm tra**: không chạy lệnh nào; chỉ đọc mã và test.
- **Quyết định**
  - High:
    - H1: `role="log"` là live region đọc từng khung stream; phải đặt `aria-busy` trên log khi đang stream.
    - H2: focus mất khi nút "Dừng" biến thành "Gửi" bị vô hiệu hóa.
  - Medium:
    - M1: focus mất sau khi chấp nhận hoặc bỏ từ thanh xem trước lúc panel đang đóng.
    - M2: toàn bộ lịch sử render lại mỗi khung (cần đo trước khi tối ưu).
    - M3: luôn cuộn xuống đáy mỗi khung, kể cả khi người dùng đã cuộn lên.
    - M4: loader của thanh xem trước không có placeholder, và import chunk thất bại làm sập editor.
    - M5: `focusProposalCard` dựa vào thời điểm của Radix FocusScope; nên dùng `onCloseAutoFocus`.
  - Low:
    - L1: bản nháp trong ô soạn tin mất khi đóng hoặc mount lại panel.
    - L2: chữ đang gõ trong hộp thoại đổi tên và tạo quan hệ bị bỏ khi bắt đầu xem trước.
    - L3: `acceptProposal` ném lỗi không được bắt trong event handler.
    - L4: `focusProposalCard` buộc thanh xem trước vào file danh sách tin.
    - L5: skeleton khi tải không được thông báo; cần kiểm `viewport` có ổn định trong `useRevealPreview`.
  - Orchestrator: sửa H1, H2, M1, M3, M4, M5, L3, L4, L5; không làm M2 (đo trước), L1, L2 (đúng Vấn đề 46).
- **Việc còn lại**
  - [ ] Sửa H1, H2, M1, M3, M4, M5, L3, L4, L5 (do agent Task 27b làm trước khi commit).
  - [ ] Nếu cần: đo hiệu năng render lại lịch sử mỗi khung stream rồi mới quyết định M2.
- **Ghi chú cho người tiếp theo**
  - H1, H2, M1 trùng với các mục (1), (2) của review a11y; sửa một lần.

## 2026-10-04 — ecc:security-reviewer — Xong

- **Đã làm**
  - Review chỉ đọc bảo mật Task 27b chưa commit trên `master`. Kết luận: chấp nhận, không có phát hiện Critical, High hay Medium.
  - Xác nhận đúng:
    - Chỉ hiển thị văn bản thường: không có `dangerouslySetInnerHTML`, `innerHTML` hay Markdown; không có `href` lấy từ đầu ra của AI (chỉ `GEMINI_API_TERMS_URL`, `buildAuthHref` và blob URL của dữ liệu mẫu). Tên schema do AI sinh render dưới dạng text của React.
    - Cổng đồng ý không bypass được: `Conversation` chỉ render khi `hasConsent`, `readAiConsent` đóng khi lỗi, khóa theo id người dùng. Khách không gửi request nào.
    - Request chỉ qua `openStream` và `withAutoRefresh` với `credentials: "include"`; CSRF khớp với kiểm tra Origin của backend cộng SameSite=Strict.
    - `localStorage` chỉ giữ cờ đồng ý `"1"`; không log nội dung người dùng.
    - Đề xuất chỉ được áp qua `acceptProposal` của store, rồi `acceptProposal` của editor, rồi dispatch của core. Lượt thất bại (L2) không áp gì và bị loại khỏi lịch sử.
    - Dữ liệu mẫu do core parse và kiểm; định dạng postgresql, mysql, sqlserver, json (không có CSV).
    - Link ngoài có `rel="noopener noreferrer"`.
- **File thay đổi**: không (reviewer chỉ đọc, không chạy lệnh).
- **Kiểm tra**: không chạy lệnh nào; chỉ đọc mã và test.
- **Quyết định**
  - Low 1: trần văn bản stream chỉ cắt trong store, client vẫn dựng chuỗi đầy đủ; chấp nhận vì backend giới hạn tổng output mỗi lượt (quyết định của Task 23).
  - Low 2: `acceptProposal` ném lỗi khi không có bản xem trước; giao diện đã chặn, giữ test cho nhánh này.
  - Đề xuất: bộ sinh seed của core nên có test cho escape dấu nháy, dấu gạch chéo ngược và quote định danh (chưa được audit).
  - Orchestrator: chấp nhận cả hai Low; ghi đề xuất kiểm thử escape của seed generator vào việc theo dõi.
- **Việc còn lại**
  - [ ] Theo dõi: kiểm tra test của core cho bộ sinh seed có ca escape dấu nháy, dấu gạch chéo ngược và quote định danh của từng dialect (spec AI-R44, spec phần 6 mục 10); nếu thiếu thì giao `core-engineer` bổ sung.
- **Ghi chú cho người tiếp theo**
  - Không có mục sửa bảo mật nào chặn commit Task 27b.
