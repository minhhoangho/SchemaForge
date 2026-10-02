# Gỡ GitHub CI

## 2026-10-02 14:45 — devops-engineer — Xong

### Đã làm

- Xóa `.github/workflows/ci.yml` bằng `git rm -r .github/`.
- Kiểm tra `turbo.json`, `pnpm-workspace.yaml`, root `package.json` và các template env ở gốc để tìm các thứ chỉ dùng cho CI: không tìm thấy.
- Script `format:check` ở root `package.json` vẫn được dùng cục bộ nên giữ lại.
- Kiểm tra các tham chiếu đến `.github/workflows/ci.yml` trong repo: chỉ có ở `document/` (spec, plan) - đây là tài liệu nên không sửa.
- Xác nhận `.github/` directory hoàn toàn bị xóa.

### File thay đổi

- `D  .github/workflows/ci.yml` (staged for deletion)

### Kiểm tra

```bash
git status --short
# Output:
# D  .github/workflows/ci.yml
# M  document/architecture.md
# M  document/roadmap.md
# M  document/specs/2026-09-14-code-generators-design.md
```

```bash
ls -la .github
# ls: .github: No such file or directory
```

```bash
pnpm format:check
# All matched files use Prettier code style!
```

```bash
grep -r "\.github/workflows" --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist
# Chỉ tìm thấy ở tệp tài liệu (document/plans, document/specs, .claude/agents)
```

### Quyết định

- Chỉ xóa `.github/` directory vì nó chỉ chứa CI workflow.
- Không sửa bất kỳ config file nào (`turbo.json`, `pnpm-workspace.yaml`, `package.json`) vì không có gì CI-only.
- Script `format:check` ở root `package.json` được giữ lại vì nó hữu ích cục bộ.

### Việc còn lại

- Không có

### Ghi chú cho người tiếp theo

- Xóa GitHub CI hoàn toàn. Repo hiện chỉ test cục bộ.
- Staged deletion đã sẵn sàng để commit.
- Không có CI-only scripts hay config để dọn dẹp.
