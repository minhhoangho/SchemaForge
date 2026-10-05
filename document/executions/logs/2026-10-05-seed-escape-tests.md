# Test thoát chuỗi và trích dẫn định danh của seed SQL generator

Không thuộc task nào trong plan; theo dõi từ security review của AI assistant (roadmap phần 5). Spec liên quan: `document/specs/` (code generators, CG-08 seed).

## 2026-10-05 — test-engineer — Xong
- **Đã làm**: thêm test chứng minh chuỗi đối nghịch không thoát khỏi literal hay INSERT trên 3 dialect (postgresql, mysql, sqlserver).
  - `seed-sql-values.test.ts`: `O'Brien\'); SELECT 1;--` + xuống dòng thật, dấu `\` đơn độc ở cuối, chuỗi chỉ gồm dấu nháy, và `\` + xuống dòng trên SQL Server; so khớp đầu ra chính xác.
  - `serialize-seed-dataset.test.ts`: tên bảng/cột chứa ký tự trích dẫn của dialect (`"`, backtick, `]`) được nhân đôi đúng, cột `__proto__` được giữ nguyên, và một hàng đối nghịch chỉ sinh đúng một câu INSERT (đếm `;` và `INSERT INTO` bên ngoài literal/định danh).
- **File thay đổi**: `packages/core/src/generators/seed/seed-sql-values.test.ts`, `packages/core/src/generators/seed/serialize-seed-dataset.test.ts` (không sửa production code).
- **Kiểm tra**: `.claude/scripts/verify.sh core` PASS (typecheck, lint, test: 3025 passed, line coverage 97.58%); `.claude/scripts/secret-scan.sh` CLEAN.
- **Quyết định**: dùng test theo bảng (`it.each`) thay vì fast-check, vì cần so khớp đầu ra chính xác; tính chất "không còn văn bản người dùng ngoài literal/định danh" đã có trong `sql-safety.properties.test.ts` (gồm seed). Test INSERT đặt trong `serialize-seed-dataset.test.ts` (nơi lắp câu lệnh thật sự), không phải `generate-seed.test.ts`. Dùng lại regex `QUOTED_PATTERNS` cùng mẫu với `sql-safety.properties.test.ts` (sao chép cục bộ vì file kia không export).
- **Việc còn lại**: không có.
- **Ghi chú cho người tiếp theo**: không phát hiện lỗi thoát chuỗi nào. Chưa bẻ production code để kiểm chứng test thất bại; đã lập luận: bỏ nhân đôi `'`, bỏ thoát `\` của MySQL hoặc xử lý `\`+LF của SQL Server đều làm các so khớp chính xác thất bại.
