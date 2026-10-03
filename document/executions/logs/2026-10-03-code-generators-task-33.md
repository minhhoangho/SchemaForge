# Worker sinh code và highlight

- Plan: [Task 33](../../plans/2026-09-15-code-generators-plan.md)
- Spec: [code-generators-design](../../specs/2026-09-14-code-generators-design.md) (mục 8, mục 9)

## 2026-10-03 — frontend-engineer — Xong
- **Đã làm**: tạo 10 file trong `frontend/src/features/editor/code-generator/` đúng chữ ký của plan: `worker-protocol`, `generator-registry` (record ánh xạ, không `switch`), `highlight-code` (Shiki core, theme CSS variables, grammar nạp động), `code-generator.worker` (dòng đầu `import "@/lib/zod-config";`), `use-generated-code`, cùng 5 file test.
- **File thay đổi**: các file trên (mới); không đụng file nào khác.
- **Kiểm tra**
  - `.claude/scripts/verify.sh frontend --format`: `RESULT: PASS` (typecheck, lint, test 3474 passed, coverage dòng 96.09%, prettier).
  - `.claude/scripts/verify.sh frontend --format --build`: build PASS (lần chạy đó lint còn lỗi test, đã sửa sau; build không đổi).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - Đo một lần (test tạm, đã xóa): tách token output TypeScript của `createLargeSchema({ tableCount: 200 })` = 130 ms, 4642 dòng, trên jsdom/Node sau khi grammar đã nạp.
- **Quyết định**
  - `loadGenerator` đúng plan (`return loaders[target]()`), typecheck xanh, không cần `as`.
  - Test registry dùng record ánh xạ `Record<GeneratorTarget, …>` để thêm đích mới là lỗi biên dịch; không có `MARKDOWN_LABELS` export từ core nên khai báo nhãn trong test.
  - Hook: `createWorker` nằm trong deps của effect (đúng exhaustive-deps), nên caller phải truyền hàm ổn định hoặc bỏ trống; Task 34 không truyền gì thì dùng mặc định.
  - Một `eslint-disable` có lý do trong `use-generated-code.test.tsx` cho `as unknown as Worker` của lớp worker giả.
  - Test worker đọc dòng đầu bằng `process.cwd()` (jsdom làm `import.meta.url` không phải scheme file).
  - Option `RangeError` được kiểm bằng `seed` với `rowsPerTable: -1`.
- **Việc còn lại**: không (xem mục sửa review bên dưới).
- **Ghi chú cho người tiếp theo**: `next build` chưa tạo chunk worker vì chưa có component nào import `use-generated-code` (Task 34); kiểm tra tên chunk worker và đường `shiki/langs/*.mjs` trong Turbopack sau khi Task 34 nối hook vào UI (`--build`). Hook trả `previous` là phản hồi cuối cùng (có thể là `failed`).

## 2026-10-03 — frontend-engineer — Xong (sửa theo project-reviewer)
- **Đã làm**
  - `use-generated-code.ts`: effect trả cleanup gỡ `onmessage`/`onerror`/`onmessageerror` (phản hồi muộn sau khi tắt không còn đổi state); `idle` suy ra lúc render (`isEnabled ? state : IDLE`), không `setState` idle trong effect.
  - `createWorker` đọc qua `useEffectEvent` (React 19 export, eslint react-hooks chấp nhận), bỏ khỏi deps; bỏ ghi chú "phải truyền hàm ổn định". Test truyền `createWorker` inline và xác nhận worker chỉ tạo một lần.
  - Thêm `onerror`/`onmessageerror` -> `failed` (có guard `requestId`).
  - `highlight-code.test.ts`: test "loads each grammar once" bọc `createHighlighterCore` bằng `vi.mock` + `importActual`, spy `loadLanguage`, nạp module mới (`vi.resetModules`), hai lần `highlightCode` -> đúng 1 lần `loadLanguage`.
  - Test hook mới: chỉ đổi `options` thì gửi yêu cầu mới; phản hồi đến sau khi tắt bị bỏ; lỗi worker; lỗi messageerror.
  - `FakeWorker extends EventTarget implements Worker` typecheck được, nên bỏ cast `as unknown as Worker` và eslint-disable.
- **File thay đổi**: `use-generated-code.ts`, `use-generated-code.test.tsx`, `highlight-code.test.ts` (trong `frontend/src/features/editor/code-generator/`).
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --format` -> `RESULT: PASS` (3478 tests); `.claude/scripts/secret-scan.sh` -> `SECRET-SCAN: CLEAN`.
- **Việc còn lại**
  - [ ] Task 34: sau khi hook được import trong UI, chạy `.claude/scripts/verify.sh frontend --build`, xác nhận tên chunk worker và Turbopack resolve được `shiki/langs/*.mjs`.
- **Ghi chú cho người tiếp theo**: khi tắt rồi bật lại, một render đầu có thể còn state cũ trước khi effect đặt `loading`.
