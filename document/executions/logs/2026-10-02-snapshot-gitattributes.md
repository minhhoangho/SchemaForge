# Cấu hình Git Attributes cho Snapshot Files

## 2026-10-02 — devops-engineer — Xong

- **Đã làm**
  - Tạo file `.gitattributes` tại root repository
  - Thêm rule để buộc text diff cho các snapshot files: `packages/core/src/generators/__snapshots__/** diff`
  - Xác minh rule hoạt động đúng với `git check-attr`
  - Xác minh text diff được áp dụng cho snapshot files thay vì binary diff
  - Chạy secret scan để đảm bảo không có secrets bị rò rỉ

- **File thay đổi**
  - `.gitattributes` (tạo mới)

- **Kiểm tra**
  ```bash
  git check-attr diff -- packages/core/src/generators/__snapshots__/zod/sample.ts
  # Output: packages/core/src/generators/__snapshots__/zod/sample.ts: diff: set
  
  git log -1 -p --format= -- packages/core/src/generators/__snapshots__ | head -30
  # Output: Shows actual text content for SQL files (including naming-edge.sql with 67 lines)
  # Previously would show "Binary files differ"
  
  .claude/scripts/secret-scan.sh
  # Output: SECRET-SCAN: CLEAN
  ```

- **Quyết định**
  - Sử dụng rule `packages/core/src/generators/__snapshots__/** diff` (không có `=text` vì git diễn giải `diff` (set) đã đủ để buộc text diff)
  - File không được commit theo yêu cầu của task

- **Ghi chú cho người tiếp theo**
  - `.gitattributes` đã được tạo và hoạt động đúng
  - Rule này sẽ áp dụng cho tất cả files trong `packages/core/src/generators/__snapshots__/` directory
  - Snapshot files sẽ hiển thị text diff thay vì binary diff trong `git diff` và `git log`
  - Không có vấn đề gì, có thể commit trực tiếp
