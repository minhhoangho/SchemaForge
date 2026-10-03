# Bàn giao trạng thái phần 6 (Code generators), phiên 4 — 2026-10-03

Tài liệu bàn giao cho session mới, viết cuối phiên làm việc thứ tư. Nó thay [2026-10-03-codegen-session-3-handoff.md](2026-10-03-codegen-session-3-handoff.md) làm handoff mới nhất. Nguồn công việc là spec `document/specs/2026-09-14-code-generators-design.md` và plan `document/plans/2026-09-15-code-generators-plan.md`.

Đây là tài liệu trạng thái, không phải plan. Nó không thay đổi quyết định nào trong spec hay plan. Bàn giao này không ghi trạng thái phần 5 (AI Assistant); trạng thái gần nhất ở mục 3 của [handoff AI](2026-10-02-codegen-ai-session-handoff.md).

---

## 1. Trạng thái git

- Nhánh `master` trùng `origin/master`. Sau khi handoff này được commit, HEAD sẽ là một commit docs nằm sau `b791262`.
- Không có agent nào đang chạy và không còn worktree: `git worktree list` chỉ hiện cây chính.
- Một dev server frontend (`next-server`, cổng 3000) và một server backend (`backend/dist/main`, cổng 3001) thuộc về người dùng và vẫn đang chạy. Không được dừng chúng.

## 2. Phần 6 "Code generators"

### 2.a. Đã merge trong phiên này

- `a585c29` `feat(frontend): add code generator worker and highlighting` (Task 33):
  - `project-reviewer` trả needs-fix với 7 phát hiện, đã sửa hết.
  - Effect của hook nay có cleanup, trạng thái idle được suy ra lúc render.
  - `createWorker` được đọc qua `useEffectEvent`.
  - `onerror` và `onmessageerror` đặt trạng thái là `failed`.
  - Test ngữ pháp spy `loadLanguage`.
  - Log: `-task-33.md`, `-task-33-review.md`.
- `d7eb4b4` `perf(core): speed up seed dataset generation`:
  - Seed `postgresql` 100 dòng/bảng giảm từ p75 2527,78 ms xuống 355,52 ms; mục tiêu là ≤ 500.
  - Nguyên nhân gốc:
    - `isAllowed` clone dòng một lần cho mỗi ứng viên nên bậc hai.
    - `listCandidates` quét lại các dòng của bảng đích mỗi lần.
    - `sortIndexes` chạy một lần cho mỗi bảng.
  - Output giống hệt từng byte: implementer so 124 trường hợp, reviewer chạy fuzz 41.880 trường hợp, 0 lệch.
  - Thêm 2 test cho các nhánh guard unique tổ hợp.
  - `BENCH_TIMEOUT_MS` là 300k, và thêm `suppressExportGetterWarnings`.
  - Log: `-seed-perf.md`, `-seed-perf-review.md`.
- `b2ead44` `feat(frontend): add code generator panel` (Task 34):
  - `project-reviewer`: approve-with-fixes. `ui-a11y-reviewer`: approve-with-nits.
  - Các sửa:
    - Skip link trỏ tới code panel khi ở chế độ code.
    - Thêm test `it.each` cho các tùy chọn.
    - Ô seed để trống thì trả về giá trị trước đó.
    - `panelLabel` tiếng Việt là "Trình tạo code".
    - `{{table}}` được dùng trong 4 thông điệp diagnostic; `null-character-removed` không nêu phần tử nào vì core phát nó với đường dẫn enum.
  - Độ tương phản token code ≥ 4,5:1 ở cả hai theme; thấp nhất là token comment của theme sáng, 4,91.
  - Orchestrator kiểm tra trong trình duyệt:
    - dev ở :3000, 1440×900;
    - production `next start` ở :3002 với CSP thật. Worker nạp qua `turbopack-worker-*.js`, nên file media `.ts` được phục vụ với `video/mp2t` không ảnh hưởng.
  - Log: `-task-34.md`, `-task-34-review.md`.
- `b791262` `docs: record code generators decisions and results` (docs của Task 35):
  - Quyết định spec R28 đến R33, bảng bench ở mục 9, cập nhật mục 8.
  - Ghi chú Task 36 trong spec và plan phần 2; các dòng của `architecture.md`; một dòng Commands trong `CLAUDE.md` về `pnpm test:conformance`.
  - Roadmap đặt phần 6 là "Đang làm" (cố ý không phải "Xong").
  - Log: `-task-35.md`.
- Kiểm tra trên `b2ead44`, tất cả với Node 24:
  - `pnpm install --frozen-lockfile`, typecheck, lint, test và build: đều OK.
  - Số test: frontend 3845, core 2633.
  - Conformance trừ SQL Server: 142 test pass trong 15/16 file. Lỗi duy nhất là `src/probes/sqlserver.probe.test.ts`, vì container không khởi động được trên VM Docker 2 GB.

### 2.b. Việc mở (theo thứ tự)

1. **Conformance SQL Server:**
   - Chạy `src/sqlserver.test.ts` (14 test), `src/seed-sql.test.ts -t "seed sql on sql server"` (8 test) và `src/probes/sqlserver.probe.test.ts`. Sau đó chạy `pnpm test:conformance --force` ở root một lần.
   - Điều kiện: Docker cần ít nhất 4 GB trống. VM hiện có 2 GB, và các container `local_*` của người dùng (kafka, elasticsearch, v.v.) dùng khoảng 1,4 GB. NGƯỜI DÙNG phải tăng VM hoặc dừng container; không bao giờ tự dừng chúng.
   - Khi pass, cho spec-writer đặt phần 6 là "Xong" trong roadmap, xóa ghi chú ở roadmap, và đóng mục SQL Server trong phần Rủi ro của spec và trong log Task 35.
2. **Kiểm tra tay của plan chưa làm:**
   - sinh cả 10 target trên production `next start`;
   - xem toàn bộ tab Network để tìm request ra ngoài;
   - nạp `createLargeSchema({ tableCount: 200 })` vào editor, kiểm tra code xuất hiện trong ≤ 1 s, và kéo một bảng trong lúc code đang sinh.
3. **Màn hình hẹp:** ở viewport 500 px, panel trái cộng code panel 32rem khiến canvas rộng 0 px. Cần bố cục cho màn hình hẹp (việc tiếp theo, frontend).
4. **Tối ưu tùy chọn:** cache `toAsciiWords` theo cột, hoặc tăng tốc phần validation literal dùng chung.
5. **Dữ liệu test:** orchestrator đã tạo schema thử "csp-check" trong IndexedDB của trình duyệt ở `localhost:3002`. Chỉ nằm cục bộ, vô hại.
6. Sau phần 6, sub-project tiếp theo trong roadmap là phần 7, Import/Export, trạng thái "Xong spec": cần lập plan. Kiểm tra `document/roadmap.md` và handoff AI `2026-10-02-codegen-ai-session-handoff.md` để biết trạng thái phần 5.

## 3. Quyết định đã thay người dùng trong phiên này

Người dùng có thể bác bỏ từng mục.

- **R28 đến R33** như đã ghi trong spec.
- **Roadmap** hiện "Đang làm" thay vì "Xong", và thông điệp commit của Task 35 đã đổi theo.
- **Thông điệp diagnostic** chỉ nội suy `table`, `column`, `index` và `enum`; plan liệt kê `relation` là sai.
- **Phạm vi skip-link** được mở rộng sang `skip-to-panel-link.tsx`.
- **Ô seed:** trả về giá trị cũ khi để trống, clamp khi blur.
- **Nhãn vi** "Trình tạo code".
- **Màu `--code-*`** lấy từ spec visual-refresh dưới dạng giá trị OKLCH, không dùng alias của shadcn.

## 4. Bài học cho orchestrator

Giữ các bài học của phiên 3 vẫn còn đúng:

- Agent có thể dừng vì stream watchdog hoặc khi Mac ngủ: tiếp tục bằng SendMessage. Nếu agent gần hết ngân sách context thì tạo agent mới kèm đường dẫn log.
- Lệnh `timeout` không có trong shell macOS; một lần verify treo 30 phút, hãy chạy ở chế độ nền.
- Xóa worktree có thể mất hơn 2 phút (do `node_modules`): chạy nền. Không để cwd của session nằm trong worktree sắp xóa.
- Docker: một lần pull từ Docker Hub bị EOF; `docker pull <image>` thủ công đã sửa được.
- Quy trình tích hợp không đổi: commit trong worktree, `rebase master`, `merge --ff-only`, `verify.sh <pkg> --build --format`, secret-scan, push, xóa worktree, `branch -D`, prune.

Bổ sung trong phiên này:

- Extension Chrome (claude-in-chrome) không kết nối được. MCP `ecc chrome-devtools` dùng được cho kiểm tra trình duyệt, nhưng không ghi được file snapshot vào scratchpad. Hãy dùng `evaluate_script` cho các kiểm tra gọn.
- Viewport mặc định của nó là 500 px; hãy emulate `1440x900x1`. Chỉ emulate `colorScheme` sẽ reset viewport, nên truyền cả hai cùng lúc. Theme tối của app là class `.dark`: bật/tắt bằng script (không bền) thay vì đổi cài đặt theme của người dùng.
- Kiểm tra production: chạy nền `pnpm --filter @schemaforge/frontend exec next start -p 3002`, xong thì TaskStop.
- Test frontend xung đột khóa `frontend/coverage` khi hai lần chạy Vitest chồng nhau; không chạy song song.
- Worktree do công cụ Agent tạo vẫn bị khóa sau khi agent kết thúc. Chạy `git worktree unlock <path>`, rồi `prune`, rồi `branch -D`.
- Hook GateGuard yêu cầu nêu sự thật trước lệnh Bash đầu tiên và trước các lệnh phá hủy. Cung cấp rồi thử lại.
- `/usr/bin/git` có thể không tồn tại trong môi trường này; dùng `git -C <wt>` thông thường.
- Conformance trừ SQL Server: trong `packages/codegen-conformance`, chạy `vitest run --exclude src/sqlserver.test.ts -t '^(?!.*sql server).*$'`. File probe vẫn chạy và fail; đó là điều dự kiến.

## 5. Khởi động nhanh cho session mới

Xem mục 6 của [handoff AI](2026-10-02-codegen-ai-session-handoff.md#6-khởi-động-nhanh-cho-session-mới).

Tin nhắn đầu tiên gợi ý cho orchestrator:

- nếu Docker đã được tăng dung lượng, chạy conformance SQL Server (mục 2.b.1);
- nếu chưa, lập plan phần 7 (spec-writer → plan), hoặc sửa bố cục màn hình hẹp.
