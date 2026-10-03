# Review Task 33: Worker sinh code và highlight

**Plan**: [Task 33](../../plans/2026-09-15-code-generators-plan.md)  
**Spec**: [Sections 8–9](../../specs/2026-09-14-code-generators-design.md)  
**Nhật ký task**: [2026-10-03-code-generators-task-33.md](2026-10-03-code-generators-task-33.md)

## 2026-10-03 — project-reviewer — Xong

- **Đã làm**: Đánh giá các thay đổi chưa commit của Task 33 (10 file trong `frontend/src/features/editor/code-generator/` cộng với nhật ký task) so với Task 33 của plan, "Vấn đề 14" và các mục 8–9 của spec. Kết luận: cần sửa. Không phát hiện vấn đề về ranh giới hoặc bảo mật. Cả năm chữ ký đều khớp với plan. `loadGenerator` sử dụng một bản ghi được ánh xạ mà không có switch và không có `as`. Dòng đầu tiên của worker là `import "@/lib/zod-config";`. Shiki sử dụng một highlighter lười biếng, theme với biến CSS có tiền tố `--code-`, và không xây dựng chuỗi HTML. Worker không bao giờ ghi lại nội dung document.

- **Phát hiện**:
  1. should-fix: `use-generated-code.ts` có race condition khi disable. Một response đến sau `isEnabled=false` vẫn đặt trạng thái thành `ready`. Không có cleanup effect và lưu trữ trạng thái idle với setState.
  2. should-fix: `createWorker` nằm trong effect deps. Một hàm inline gây ra vòng lặp yêu cầu vô hạn.
  3. should-fix: không có `onerror`/`onmessageerror`, vì vậy worker không tải thành công sẽ để lại trạng thái ở `loading` mãi mãi.
  4. should-fix: test "loads each grammar once" không thể bắt được việc xóa cache, vì shiki phát ra 0 cảnh báo khi `loadLanguage` được gọi lại.
  5. nit: không có test chỉ thay đổi `options`, và không có assertion rằng `createWorker` được gọi một lần.
  6. nit: việc cast `as unknown as Worker` trong hook test.
  7. nit: nhật ký task nói "Việc còn lại: không" trong khi chunk worker vẫn chưa được xác minh.
  Người đánh giá chấp nhận những điều này mà không yêu cầu thay đổi: hai lần sử dụng đầu tiên đồng thời của một ngôn ngữ có thể tải grammar hai lần; một rejected highlighter promise vẫn được cache cho đến khi worker khởi động lại; test worker không kiểm tra hình dạng của `tokens`.

- **Kiểm tra**: `.claude/scripts/verify.sh frontend --format` cho PASS (3474 test, line coverage 96.03%). Kiểm tra ad-hoc `node` cho thấy shiki phát ra 0 cảnh báo khi `loadLanguage` lặp lại. `secret-scan.sh` cho CLEAN. `--build` không được chạy, vì không gì import hook này.

- **Quyết định**: orchestrator chấp nhận cả 7 phát hiện và gửi lại cho frontend-engineer. Tất cả đều được sửa: effect cleanup và idle dẫn xuất tại render; `createWorker` đọc qua `useEffectEvent`; `onerror`/`onmessageerror` đặt trạng thái thành `failed`; grammar test spy trên `loadLanguage`; thêm test cho thay đổi chỉ options và cho một lần gọi `createWorker`; `FakeWorker implements Worker` loại bỏ cast; nhật ký task bổ sung checkbox cho Task 34. Xác minh lại sau các fix cho `RESULT: PASS` với 3478 test.

- **Việc còn lại**:
  - [ ] Task 34: sau khi hook được import, chạy verify --build để xác nhận tên chunk worker và Turbopack resolve shiki/langs/*.mjs.
