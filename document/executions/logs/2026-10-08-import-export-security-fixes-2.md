# Sửa finding security review 2 (M1, L1, L2, L3, I1)

Theo [log review](2026-10-05-import-export-security-review-2.md); tiền đề của Task 25 trong [plan](../../plans/2026-10-03-import-export-plan.md), [spec](../../specs/2026-09-15-import-export-design.md).

## 2026-10-08 — frontend-engineer — Xong

- **Đã làm**
  - M1: `isImportRequest` từ chối `source.length > MAX_IMPORT_FILE_BYTES`; `importer-client.run` trả `crashed` ngay cho source quá lớn, không tạo worker, không đặt timer (worker sẽ bỏ qua message và client chờ 30 s).
  - L1: `checkPastedSource` kiểm độ dài trước `trim()`.
  - L2: `importer.worker.ts` đưa `self.postMessage` vào `try`; nếu clone lỗi thì gửi `{ requestId, kind: "crashed" }`.
  - L3: `createWorker()` trong `importer-client.start` bọc `try`; lỗi thì resolve `crashed`, lần `run` sau thử tạo lại.
  - I1: `isImportResponse` kiểm hình dạng từng kind (failure: `diagnostics` là mảng; success: `operation`, `resultDocument` là object, `summary` đủ 7 trường số, `diagnostics`, `introducedIssues` là mảng).
- **File thay đổi**: trong `frontend/src/lib/import-export/`: `decode-import-file.ts`, `import-protocol.ts`, `importer-client.ts`, `importer.worker.ts` và bốn file test cùng tên.
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --format` -> RESULT: PASS (typecheck, lint, test 5330 pass, coverage 96.2%, prettier). `secret-scan.sh` -> SECRET-SCAN: CLEAN.
- **Quyết định**
  - Worktree ban đầu ở commit cũ hơn `b4d6330` nên chưa có log review; fast-forward lên `b4d6330` (không commit).
  - Source quá lớn và lỗi tạo worker đều trả `crashed` (không thêm kind mới): giữ giao thức nguyên vẹn; Task 25 đã chặn kích thước bằng `checkPastedSource`/`readImportFile` nên đây chỉ là lớp phòng thủ.
  - I1 chỉ kiểm lớp ngoài, không kiểm từng phần tử mảng hay document: worker là code của mình, core validate khi áp dụng.
  - Hệ quả L1: văn bản toàn khoảng trắng vượt giới hạn nay báo `too-large` thay vì `empty`.
  - Không viết test RED trước từng fix; test mới đều kiểm hành vi mới và pass sau fix.
- **Ghi chú cho người tiếp theo**: Task 25 vẫn phải gọi `readImportFile`/`checkPastedSource` trước `run` và thêm liên kết `/third-party-notices.txt`. Không thấy lỗi `window is not defined` nào.
