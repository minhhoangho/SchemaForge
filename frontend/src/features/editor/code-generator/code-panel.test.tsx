import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { act, screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import type { ViewportControls } from "../lib/viewport-controls";
import { ViewportControlsProvider } from "../lib/viewport-controls";
import { createEditorStore } from "../state/create-editor-store";
import type { EditorStore } from "../state/create-editor-store";
import { EditorStoreProvider } from "../state/editor-store-provider";
import { CodePanel } from "./code-panel";
import type {
  GenerateCodeRequest,
  GenerateCodeResponse,
} from "./worker-protocol";

class FakeWorker extends EventTarget implements Worker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly postMessage = vi.fn<(request: GenerateCodeRequest) => void>();
  readonly terminate = vi.fn();

  reply(response: GenerateCodeResponse): void {
    act(() => {
      this.onmessage?.(new MessageEvent("message", { data: response }));
    });
  }

  fail(): void {
    act(() => {
      this.onerror?.(new ErrorEvent("error"));
    });
  }

  get lastRequest(): GenerateCodeRequest {
    const request = this.postMessage.mock.lastCall?.[0];
    if (request === undefined) {
      throw new Error("The worker received no request.");
    }
    return request;
  }
}

function ok(requestId: number): GenerateCodeResponse {
  return {
    requestId,
    kind: "ok",
    file: { fileName: "schema.sql", language: "sql", content: "SELECT 1;\n" },
    diagnostics: [
      { code: "seed-table-skipped", path: ["tables", "tbl_users"] },
    ],
    tokens: [[{ content: "SELECT 1;", color: null }]],
  };
}

const VALID_DOCUMENT: SchemaDocument = buildSchema({
  name: "shop",
  tables: [makeTable({ id: "tbl_users", name: "users" })],
  columns: [makeColumn({ id: "col_users_id", tableId: "tbl_users" })],
});

// Both tables report `table-name-duplicate`.
const INVALID_DOCUMENT: SchemaDocument = buildSchema({
  name: "shop",
  tables: [
    makeTable({ id: "tbl_users", name: "users" }),
    makeTable({ id: "tbl_people", name: "users" }),
  ],
  columns: [
    makeColumn({ id: "col_users_id", tableId: "tbl_users" }),
    makeColumn({ id: "col_people_id", tableId: "tbl_people" }),
  ],
});

type Harness = ReturnType<typeof renderWithProviders> & {
  readonly store: EditorStore;
  readonly worker: FakeWorker;
};

function renderPanel(
  document: SchemaDocument = VALID_DOCUMENT,
  themePreference: "light" | "dark" = "light",
): Harness {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document,
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const worker = new FakeWorker();
  const controls: ViewportControls = {
    zoomIn: vi.fn<ViewportControls["zoomIn"]>(),
    zoomOut: vi.fn<ViewportControls["zoomOut"]>(),
    fitView: vi.fn<ViewportControls["fitView"]>(),
    setCenter: vi.fn<ViewportControls["setCenter"]>(),
    getZoom: vi.fn<ViewportControls["getZoom"]>(() => 1),
  };
  const result = renderWithProviders(
    <EditorStoreProvider store={store}>
      <ViewportControlsProvider controls={controls}>
        <CodePanel id="code-panel" createWorker={() => worker} />
      </ViewportControlsProvider>
    </EditorStoreProvider>,
    { locale: "en", themePreference },
  );
  return { ...result, store, worker };
}

describe("CodePanel", () => {
  it("sends the selected target and options to the worker", async () => {
    const { user, worker } = renderPanel();
    expect(worker.lastRequest).toMatchObject({
      target: "postgresql",
      options: {},
    });

    await user.click(screen.getByRole("combobox", { name: "Output" }));
    await user.click(await screen.findByRole("option", { name: "Prisma" }));

    expect(worker.lastRequest).toMatchObject({
      target: "prisma",
      options: { provider: "postgresql" },
    });

    await user.click(screen.getByRole("combobox", { name: "Provider" }));
    await user.click(await screen.findByRole("option", { name: "MySQL" }));

    expect(worker.lastRequest).toMatchObject({
      target: "prisma",
      options: { provider: "mysql" },
    });
  });

  it.each([
    [
      "the sql dialect",
      async (user: UserEvent, store: EditorStore): Promise<void> => {
        act(() => {
          store.getState().setCodeTarget("sql");
        });
        await user.click(
          await screen.findByRole("combobox", { name: "Dialect" }),
        );
        await user.click(await screen.findByRole("option", { name: "MySQL" }));
      },
      { target: "mysql", options: {} },
    ],
    [
      "the seed format",
      async (user: UserEvent, store: EditorStore): Promise<void> => {
        act(() => {
          store.getState().setCodeTarget("seed");
        });
        await user.click(
          await screen.findByRole("combobox", { name: "Format" }),
        );
        await user.click(await screen.findByRole("option", { name: "JSON" }));
      },
      { target: "seed", options: { format: "json" } },
    ],
    [
      "a seed above the maximum",
      async (user: UserEvent, store: EditorStore): Promise<void> => {
        act(() => {
          store.getState().setCodeTarget("seed");
        });
        const seed = await screen.findByRole("spinbutton", { name: "Seed" });
        await user.clear(seed);
        await user.type(seed, "99999999999");
        await user.tab();
      },
      { target: "seed", options: { seed: 4294967295 } },
    ],
  ] as const)("sends %s to the worker", async (_name, act_, expected) => {
    const { user, worker, store } = renderPanel();

    await act_(user, store);

    expect(worker.lastRequest).toMatchObject(expected);
  });

  it("keeps the previous value when a seed field is left empty", async () => {
    const { user, worker, store } = renderPanel();
    act(() => {
      store.getState().setCodeTarget("seed");
    });
    const rows = await screen.findByRole("spinbutton", {
      name: "Rows per table",
    });

    await user.clear(rows);
    await user.tab();

    expect(store.getState().codeOptions.seedRowsPerTable).toBe(10);
    expect(screen.getByDisplayValue("10")).toBe(rows);
    expect(worker.lastRequest.options).toMatchObject({ rowsPerTable: 10 });
  });

  it("clamps the seed options before they reach the worker", async () => {
    const { user, worker, store } = renderPanel();
    store.getState().setCodeTarget("seed");

    const rows = await screen.findByRole("spinbutton", {
      name: "Rows per table",
    });
    await user.clear(rows);
    await user.type(rows, "5000");
    await user.tab();

    expect(worker.lastRequest.options).toMatchObject({ rowsPerTable: 1000 });
  });

  it("shows the code and the diagnostics of a reply", () => {
    const { worker } = renderPanel();

    worker.reply(ok(worker.lastRequest.requestId));

    expect(screen.getByText("SELECT 1;")).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Table “users” has no rows/ }),
    ).toBeDefined();
  });

  it("keeps the previous code and marks the panel busy while generating", async () => {
    const { user, worker } = renderPanel();
    worker.reply(ok(worker.lastRequest.requestId));

    await user.click(screen.getByRole("combobox", { name: "Output" }));
    await user.click(await screen.findByRole("option", { name: "Zod" }));

    expect(screen.getByText("SELECT 1;")).toBeDefined();
    expect(
      screen
        .getByRole("complementary", { name: "Code generator" })
        .getAttribute("aria-busy"),
    ).toBe("true");
  });

  it("shows a translated error when the worker fails", () => {
    const { worker } = renderPanel();

    worker.fail();

    expect(screen.getByRole("alert").textContent).toMatch(
      /Could not generate the code/,
    );
  });

  it("shows a warning with the issue count and opens the issues tab", async () => {
    const { user, store } = renderPanel(INVALID_DOCUMENT);
    expect(store.getState().leftPanelTab).toBe("tables");

    expect(screen.getByText(/The schema has 2 issues/)).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Show issues" }));

    expect(store.getState().leftPanelTab).toBe("issues");
  });

  it("shows no warning for a schema without issues", () => {
    renderPanel();

    expect(screen.queryByText(/The schema has/)).toBeNull();
  });

  it("disables sql server for drizzle with a note", async () => {
    const { user, store } = renderPanel();
    act(() => {
      store.getState().setCodeTarget("drizzle");
    });

    await user.click(await screen.findByRole("combobox", { name: "Dialect" }));
    const listbox = await screen.findByRole("listbox");

    expect(
      within(listbox)
        .getByRole("option", { name: "SQL Server" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
      screen.getByText("Drizzle does not support SQL Server yet."),
    ).toBeDefined();
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const { container, worker } = renderPanel(
        INVALID_DOCUMENT,
        themePreference,
      );
      worker.reply(ok(worker.lastRequest.requestId));

      await expectNoAxeViolations(container);
    },
  );
});
