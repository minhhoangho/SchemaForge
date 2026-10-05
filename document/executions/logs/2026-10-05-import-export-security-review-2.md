# Security review 2: Task 24 worker import

Task 24 trong [plan phần 7](../../plans/2026-10-03-import-export-plan.md), theo [spec phần 7](../../specs/2026-09-15-import-export-design.md). `ecc:security-reviewer` (chỉ đọc) review commit `485a8a9`. Reviewer không ghi file, nên log này do `spec-writer` viết từ báo cáo của reviewer và quyết định của orchestrator.

## 2026-10-05 22:04 — security-reviewer — Xong

- **Đã làm**: đọc tĩnh commit `485a8a9`: `import-protocol`, `handle-import-request`, `importer-loaders`, `importer.worker`, `importer-client`, `decode-import-file`, `import-layout`, `third-party-notices.txt`. Đối chiếu sáu điểm trong dòng "Review" của plan Task 24.
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**
  - `grep` `console|logger` trên các file không phải test: không có kết quả.
  - Đọc `package.json` của `@dbml/core` và `@dbml/parse`: không có file NOTICE.
  - Không chạy test. Orchestrator đã chạy toàn bộ test frontend trên `master`: 228 file, 5313 test pass.
- **Quyết định**
  - Kết luận: PASS, không có finding critical hay high.
  - Đạt: giới hạn kích thước (kiểm `file.size` trước `arrayBuffer()`), validate message hai chiều, terminate/cancel/crashed, mã hóa (BOM, `fatal: true`), loader dùng literal.
  - M1 (medium, có điều kiện): `isImportRequest` (`import-protocol.ts:92`) và `run` không giới hạn độ dài `source`. Chỉ thành vấn đề nếu một đường vào nào đó không đi qua `readImportFile` hoặc `checkPastedSource`.
  - L1: `checkPastedSource` gọi `text.trim()` (dòng 66) trước khi kiểm độ dài (dòng 71).
  - L2: `self.postMessage` (`importer.worker.ts:20`) nằm ngoài `try`; lỗi clone khiến người dùng chờ hết 30 s.
  - L3: `createWorker()` (`importer-client.ts:85`) có thể ném lỗi (CSP, trình duyệt không hỗ trợ module worker).
  - I1: `isImportResponse` chỉ kiểm `requestId` và `kind`.
  - I2: UTF-16 không BOM và UTF-32 LE giải mã thành rác; không có tác động bảo mật.
  - Notices: đủ cho code Apache-2.0 được đóng gói; antlr4 dùng văn bản BSD-3 chuẩn.
  - Orchestrator: sửa M1, L1–L3, I1 trong một task frontend nhỏ trước Task 25. Task 25 phải gọi `readImportFile` và `checkPastedSource` trước `run`, và có liên kết tới `/third-party-notices.txt`.
- **Việc còn lại**
  - [ ] M1: giới hạn độ dài `source` trong `isImportRequest` (`frontend/src/lib/import-export/import-protocol.ts`) và ở `run` (`frontend/src/lib/import-export/importer-client.ts`).
  - [ ] L1: trong `checkPastedSource` (`frontend/src/lib/import-export/decode-import-file.ts` hoặc file chứa hàm này), kiểm độ dài trước khi gọi `text.trim()`.
  - [ ] L2: đưa `self.postMessage` vào `try` trong `frontend/src/lib/import-export/importer.worker.ts`, trả lỗi có cấu trúc khi clone thất bại.
  - [ ] L3: bọc `createWorker()` trong `frontend/src/lib/import-export/importer-client.ts`, trả trạng thái `crashed` hoặc lỗi rõ ràng khi tạo worker ném lỗi.
  - [ ] I1: `isImportResponse` trong `import-protocol.ts` kiểm cả hình dạng của payload, không chỉ `requestId` và `kind`.
  - [ ] Task 25: gọi `readImportFile` và `checkPastedSource` trước `run`; thêm liên kết tới `/third-party-notices.txt` trong hộp thoại import.
- **Ghi chú cho người tiếp theo**: timer 30 s bắt đầu trước khi worker khởi động, nên đã bao cả thời gian tải chunk.
