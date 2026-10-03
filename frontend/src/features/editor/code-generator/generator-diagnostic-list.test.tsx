import type { GeneratorDiagnostic, SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import type { ViewportControls } from "../lib/viewport-controls";
import { ViewportControlsProvider } from "../lib/viewport-controls";
import { createEditorStore } from "../state/create-editor-store";
import { EditorStoreProvider } from "../state/editor-store-provider";
import { GeneratorDiagnosticList } from "./generator-diagnostic-list";

const DOCUMENT: SchemaDocument = buildSchema({
  name: "shop",
  tables: [
    makeTable({ id: "tbl_users", name: "users", position: { x: 40, y: 80 } }),
  ],
  columns: [
    makeColumn({ id: "col_email", tableId: "tbl_users", name: "email" }),
  ],
});

const DIAGNOSTICS: readonly GeneratorDiagnostic[] = [
  { code: "default-omitted", path: ["columns", "col_email", "defaultValue"] },
  { code: "seed-table-skipped", path: ["tables", "tbl_users"] },
];

function renderList(
  diagnostics: readonly GeneratorDiagnostic[] = DIAGNOSTICS,
  themePreference: "light" | "dark" = "light",
): ReturnType<typeof renderWithProviders> & {
  readonly store: ReturnType<typeof createEditorStore>;
} {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: DOCUMENT,
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  store.getState().setRightPanelMode("code");
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
        <GeneratorDiagnosticList
          diagnostics={diagnostics}
          document={DOCUMENT}
        />
      </ViewportControlsProvider>
    </EditorStoreProvider>,
    { locale: "en", themePreference },
  );
  return { ...result, store };
}

describe("GeneratorDiagnosticList", () => {
  it("shows translated messages with the element name and a count", () => {
    renderList();

    expect(
      screen.getByRole("heading", { name: "2 notes about this output" }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", {
        name: /default value of column “email” of “users”/,
      }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Table “users” has no rows/ }),
    ).toBeDefined();
  });

  it("selects the element on click and keeps the code panel open", async () => {
    const { user, store } = renderList();

    await user.click(
      screen.getByRole("button", { name: /Table “users” has no rows/ }),
    );

    expect(store.getState().selection.tableIds).toEqual(["tbl_users"]);
    expect(store.getState().rightPanelMode).toBe("code");
    expect(store.getState().focusRequest).toBeNull();
  });

  it("renders nothing without diagnostics", () => {
    renderList([]);

    expect(screen.queryByRole("heading")).toBeNull();
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const { container } = renderList(DIAGNOSTICS, themePreference);

      await expectNoAxeViolations(container);
    },
  );
});
