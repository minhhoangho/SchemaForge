# Review spec phần 5: AI Assistant

Không có plan task (review spec). Spec: [2026-10-02-ai-assistant-design.md](../../specs/2026-10-02-ai-assistant-design.md). Log viết spec: [2026-10-02-ai-assistant-spec.md](2026-10-02-ai-assistant-spec.md). Hai reviewer chỉ đọc; log này do `spec-writer` ghi theo yêu cầu của orchestrator.

## 2026-10-02 13:45 — project-reviewer — Xong

- **Đã làm**: review spec phần 5 đối chiếu `CLAUDE.md`, `.claude/rules/`, `architecture.md`, spec phần 2, 4, 6 và code hiện có. Kết luận: chấp nhận, kèm việc phải sửa.
- **File thay đổi**: không có (chỉ đọc).
- **Kiểm tra**: `prettier --check` spec đạt; secret-scan CLEAN; `npm view`, `npm pack` xác nhận `ai` 7.0.126 và `@ai-sdk/google` 4.0.87.
- **Quyết định**: tóm tắt phát hiện, đã được orchestrator chốt cách sửa:
  - P1: vị trí bảng mới (AI-R13) tính trên bản nháp làm các bảng của một lượt lệch hàng; cần ngữ cảnh `{ originX, placedCount }` từ tài liệu gốc trong `AiTurnState`.
  - P2: AI-R33 viết lại phần thân `createDispatch` trong `acceptProposal`, mâu thuẫn dòng 5 của "Tóm tắt quyết định"; phải gọi `get().dispatch`.
  - P3: chưa nói gì khi gửi tin nhắn mới trong lúc xem trước và khi xem trước lại đề xuất cũ.
  - P4: mục "Thay đổi cần ghi vào architecture.md" và tiêu chí cuối cần khớp việc ghi "Chưa chốt" ngay và cập nhật roadmap lúc duyệt.
  - P5: `parseSeedDataset` đặt trong subpath `ai` kéo hình dạng tool vào bundle editor; nên đặt cạnh `SeedDataset`.
  - P6: quy tắc `GEMINI_MODEL` đặt sau `return` sớm của `superRefine` chỉ chạy ở production; chú thích `.env.example` phải tiếng Anh.
  - P7: chưa nói `GenerateId` của backend.
  - P8: sửa đổi dùng chung `packages/core/package.json`, `src/index.ts` với phần 6 cần thứ tự.
  - P9: Rủi ro 2 thiếu hình dạng dự phòng cho `proposeSampleData.rows`.
  - P10: AI-R49 nên ghi rõ request bị rule theo phút từ chối vẫn tiêu lượt theo giờ.
- **Việc còn lại**: không có; mọi phát hiện đã được áp vào spec ở lượt 14:00 của log viết spec.
- **Ghi chú cho người tiếp theo**: không có.

## 2026-10-02 13:45 — ecc:security-reviewer — Xong

- **Đã làm**: review bảo mật spec phần 5. Kết luận: chấp nhận, kèm việc phải sửa.
- **File thay đổi**: không có (chỉ đọc).
- **Kiểm tra**: `prettier --check` spec đạt; secret-scan CLEAN; `npm view`, `npm pack` xác nhận `ai` 7.0.126 và `@ai-sdk/google` 4.0.87.
- **Quyết định**: tóm tắt phát hiện theo mức độ, đã được orchestrator chốt cách sửa:
  - S-H1 (cao): khuếch đại chi phí: không có ngân sách toàn cục, không giới hạn theo IP, giới hạn schema 200.000 ký tự quá rộng, `maxRetries` 2, không giới hạn stream đồng thời.
  - S-H2 (cao): chi phí kiểm tra đồng bộ trên event loop với 60 tool call mỗi lượt, chưa có ngân sách CPU.
  - S-M1 (trung bình): rò rỉ qua stream và log: reasoning, source, chunk tool, `onError` mặc định, telemetry và log cảnh báo của AI SDK.
  - S-M2 (trung bình): SQL dữ liệu mẫu do AI sinh cần nhắc đọc lại và dựa vào hàm quote của phần 6.
  - S-M3 (trung bình): lịch sử do client gửi có thể giả dấu chấp nhận, bỏ và thẻ ranh giới.
  - S-M4 (trung bình): đề xuất phá hủy (xóa, `cascade`, đổi kiểu) chưa được làm nổi bật, chưa có bước xác nhận.
  - S-M5 (trung bình): quyền riêng tư: gói key, đồng ý của người dùng, log prompt ở proxy và APM.
  - S-L1 (thấp): nghe `close` của request để hủy là sai; `abortSignal` chưa tới tool.
  - S-L2 (thấp): tra cứu theo tên có thể dính prototype (`__proto__`).
  - S-L3 (thấp): chuỗi, mảng của input tool chưa có `.max()`; chưa giới hạn kích thước đề xuất.
  - S-L4 (thấp): bộ đếm trong bộ nhớ, chạy nhiều instance nhân giới hạn.
- **Việc còn lại**: không có; mọi phát hiện đã được áp vào spec ở lượt 14:00 của log viết spec.
- **Ghi chú cho người tiếp theo**: không có.
