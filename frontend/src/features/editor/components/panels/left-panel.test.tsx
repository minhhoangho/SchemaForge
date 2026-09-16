import type { DocumentPath, SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeEnum,
  makeTable,
} from "@schemaforge/core/testing";
import { act, screen, within } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Locale } from "@/lib/i18n/supported-locales";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import type { ViewportControls } from "../../lib/viewport-controls";
import {
  VIEWPORT_TRANSITION_MS,
  ViewportControlsProvider,
} from "../../lib/viewport-controls";
import { createEditorStore } from "../../state/create-editor-store";
import type { EditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import { LeftPanel } from "./left-panel";

type Harness = RenderResult & {
  readonly user: UserEvent;
  readonly store: EditorStore;
  readonly setCenter: ReturnType<typeof vi.fn<ViewportControls["setCenter"]>>;
};

type HarnessOptions = {
  readonly locale?: Locale;
  readonly themePreference?: ThemePreference;
  readonly document?: SchemaDocument;
};

// "orders" has two columns and a duplicated column name, "users" none.
function createDocument(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({ id: "tbl_users", name: "users", position: { x: 5, y: 6 } }),
      makeTable({ id: "tbl_orders", name: "orders" }),
    ],
    columns: [
      makeColumn({ id: "col_orders_a", tableId: "tbl_orders", name: "code" }),
      makeColumn({ id: "col_orders_b", tableId: "tbl_orders", name: "code" }),
    ],
    enums: [makeEnum({ id: "enum_status", name: "status" })],
  });
}

// "empty" reports `enum-values-empty`, "status" `enum-value-duplicate`.
function createDocumentWithEnumIssues(): SchemaDocument {
  return buildSchema({
    name: "shop",
    enums: [
      makeEnum({ id: "enum_empty", name: "empty", values: [] }),
      makeEnum({ id: "enum_status", name: "status", values: ["a", "A"] }),
    ],
  });
}

// Stands in for Task 29's focus request hook: it finds the element that
// declares the requested path and focuses it.
function focusRequestedField(path: DocumentPath | null): void {
  window.document
    .querySelector<HTMLElement>(`[data-focus-path='${JSON.stringify(path)}']`)
    ?.focus();
}

function renderLeftPanel(options: HarnessOptions = {}): Harness {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: options.document ?? createDocument(),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const setCenter = vi.fn<ViewportControls["setCenter"]>();
  const controls: ViewportControls = {
    zoomIn: vi.fn<ViewportControls["zoomIn"]>(),
    zoomOut: vi.fn<ViewportControls["zoomOut"]>(),
    fitView: vi.fn<ViewportControls["fitView"]>(),
    setCenter,
    getZoom: vi.fn<ViewportControls["getZoom"]>(() => 1),
  };
  const result = renderWithProviders(
    <EditorStoreProvider store={store}>
      <ViewportControlsProvider controls={controls}>
        <LeftPanel />
      </ViewportControlsProvider>
    </EditorStoreProvider>,
    {
      locale: options.locale ?? "en",
      themePreference: options.themePreference ?? "light",
    },
  );
  return { ...result, store, setCenter };
}

describe("LeftPanel", () => {
  it("switches tabs from the store", async () => {
    const { user, store } = renderLeftPanel();

    act(() => {
      store.getState().setLeftPanelTab("enums");
    });
    expect(
      screen.getByRole("tab", { name: "Enums" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByLabelText("Enum name")).toBeDefined();

    await user.click(screen.getByRole("tab", { name: "Issues (2)" }));
    expect(store.getState().leftPanelTab).toBe("issues");
  });

  it("collapses and expands the panel", async () => {
    const { user, store } = renderLeftPanel();
    act(() => {
      store.getState().setLeftPanelTab("enums");
    });

    await user.click(
      screen.getByRole("button", { name: "Collapse the schema outline" }),
    );
    const expandButton = screen.getByRole("button", {
      name: "Expand the schema outline",
    });
    expect(store.getState().leftPanelTab).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(expandButton.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(expandButton);

    await user.click(expandButton);
    expect(store.getState().leftPanelTab).toBe("enums");
    expect(
      screen
        .getByRole("button", { name: "Collapse the schema outline" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it.each([
    ["en", "Schema outline"],
    ["vi", "Tổng quan schema"],
  ] as const)("names the panel in %s", (locale, name) => {
    renderLeftPanel({ locale });

    expect(screen.getByRole("complementary", { name })).toBeDefined();
  });

  it("lists the tables in core order with their column and issue counts", () => {
    renderLeftPanel();

    expect(
      screen
        .getAllByRole("button", { name: /^(orders|users) / })
        .map((row) => row.textContent.split(" ")[0]),
    ).toStrictEqual(["orders", "users"]);
    expect(
      screen.getByRole("button", { name: "orders 2 columns 2 issues" }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: "users 0 columns" }),
    ).toBeDefined();
  });

  it("selects the table and centers it when its row is clicked", async () => {
    const { user, store, setCenter } = renderLeftPanel();

    await user.click(screen.getByRole("button", { name: /^users/ }));

    expect(store.getState().selection).toStrictEqual({
      tableIds: ["tbl_users"],
      relationIds: [],
    });
    expect(setCenter).toHaveBeenCalledExactlyOnceWith(5, 6, {
      zoom: 1,
      duration: VIEWPORT_TRANSITION_MS,
    });
    expect(
      screen
        .getByRole("button", { name: /^users/ })
        .getAttribute("aria-current"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: /^orders/ })
        .hasAttribute("aria-current"),
    ).toBe(false);
  });

  it("reopens the tab last opened from the store", async () => {
    const { user, store } = renderLeftPanel();
    act(() => {
      store.getState().setLeftPanelTab("issues");
    });
    act(() => {
      store.getState().setLeftPanelTab(null);
    });

    await user.click(
      screen.getByRole("button", { name: "Expand the schema outline" }),
    );

    expect(store.getState().leftPanelTab).toBe("issues");
  });

  it("switches tabs with the arrow keys", async () => {
    const { user, store } = renderLeftPanel();

    await user.click(screen.getByRole("tab", { name: "Tables" }));
    await user.keyboard("{ArrowRight}");

    expect(store.getState().leftPanelTab).toBe("enums");
    expect(document.activeElement).toBe(
      screen.getByRole("tab", { name: "Enums" }),
    );
  });

  it.each([
    [
      "the add value button",
      /Enum “empty” has no values/,
      "empty",
      "button",
      "Add value",
    ],
    [
      "the duplicated value field",
      /lists the value “A”/,
      "status",
      "textbox",
      "Value 2",
    ],
  ] as const)(
    "lets a focus request of an enum issue reach %s",
    async (_target, message, enumName, role, name) => {
      const { user, store } = renderLeftPanel({
        document: createDocumentWithEnumIssues(),
      });
      await user.click(screen.getByRole("tab", { name: "Issues (3)" }));

      await user.click(screen.getByRole("button", { name: message }));
      act(() => {
        focusRequestedField(store.getState().focusRequest);
      });

      expect(store.getState().leftPanelTab).toBe("enums");
      expect(document.activeElement).toBe(
        within(screen.getByRole("group", { name: enumName })).getByRole(role, {
          name,
        }),
      );
    },
  );

  it.each(["light", "dark"] as const)(
    "reports no axe violations on the collapsed panel in the %s theme",
    async (themePreference) => {
      const { store } = renderLeftPanel({ themePreference });
      act(() => {
        store.getState().setLeftPanelTab(null);
      });

      await expectNoAxeViolations(document.body);
    },
  );

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      renderLeftPanel({ themePreference });

      await expectNoAxeViolations(document.body);
    },
  );
});
