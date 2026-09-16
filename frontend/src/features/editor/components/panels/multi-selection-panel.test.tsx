import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { act, screen } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Locale } from "@/lib/i18n/supported-locales";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { EMPTY_SELECTION } from "../../lib/selection";
import type { Selection } from "../../lib/selection";
import { createEditorStore } from "../../state/create-editor-store";
import type { EditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import { MultiSelectionPanel } from "./multi-selection-panel";

const SELECTION: Selection = {
  tableIds: ["tbl_users", "tbl_orders"],
  relationIds: ["rel_orders_users"],
};

function createDocument(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({
        id: "tbl_users",
        name: "users",
        primaryKeyColumnIds: ["col_users_id"],
      }),
      makeTable({ id: "tbl_orders", name: "orders" }),
      makeTable({ id: "tbl_products", name: "products" }),
    ],
    columns: [
      makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
      makeColumn({
        id: "col_orders_user_id",
        tableId: "tbl_orders",
        name: "user_id",
      }),
    ],
    relations: [
      makeRelation({
        id: "rel_orders_users",
        fromTableId: "tbl_orders",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_orders_user_id", toColumnId: "col_users_id" },
        ],
      }),
    ],
  });
}

type Harness = RenderResult & {
  readonly user: UserEvent;
  readonly store: EditorStore;
  readonly initialDocument: SchemaDocument;
  readonly onDeleted: ReturnType<typeof vi.fn<() => void>>;
};

type HarnessOptions = {
  readonly selection?: Selection;
  readonly locale?: Locale;
  readonly themePreference?: ThemePreference;
};

function renderPanel(options: HarnessOptions = {}): Harness {
  const initialDocument = createDocument();
  const selection = options.selection ?? SELECTION;
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: initialDocument,
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  store.getState().setSelection(selection);
  const onDeleted = vi.fn<() => void>();
  const result = renderWithProviders(
    <EditorStoreProvider store={store}>
      <MultiSelectionPanel selection={selection} onDeleted={onDeleted} />
    </EditorStoreProvider>,
    {
      locale: options.locale ?? "en",
      themePreference: options.themePreference ?? "light",
    },
  );
  return { ...result, store, initialDocument, onDeleted };
}

describe("MultiSelectionPanel", () => {
  it("summarises the number of tables and relations", () => {
    renderPanel();

    expect(screen.getByText("Selected 2 tables and 1 relation")).toBeDefined();
  });

  it.each([
    ["en", "Selected 1 table and 1 relation"],
    ["vi", "Đã chọn 1 bảng, 1 quan hệ"],
  ] as const)("uses the singular summary in %s", (locale, summary) => {
    renderPanel({
      locale,
      selection: { tableIds: ["tbl_users"], relationIds: ["rel_orders_users"] },
    });

    expect(screen.getByText(summary)).toBeDefined();
  });

  it("deletes everything with one dispatch", async () => {
    const { user, store } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Delete all" }));

    // Every successful dispatch records exactly one history entry.
    expect(store.getState().history.past).toHaveLength(1);
    expect(store.getState().history.past[0]?.operation.type).toBe("batch");
    expect(Object.keys(store.getState().document.tables)).toStrictEqual([
      "tbl_products",
    ]);
    expect(store.getState().document.relations).toStrictEqual({});
  });

  it("restores everything with a single undo", async () => {
    const { user, store, initialDocument } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Delete all" }));
    act(() => {
      store.getState().undo();
    });

    expect(store.getState().document).toStrictEqual(initialDocument);
    expect(store.getState().history.past).toHaveLength(0);
  });

  it("clears the selection after deleting", async () => {
    const { user, store, onDeleted } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Delete all" }));

    expect(store.getState().selection).toStrictEqual(EMPTY_SELECTION);
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it("keeps the selection when the deletion is rejected", async () => {
    const selection = { tableIds: ["tbl_missing"], relationIds: [] } as const;
    const { user, store, onDeleted } = renderPanel({ selection });

    await user.click(screen.getByRole("button", { name: "Delete all" }));

    expect(store.getState().selection).toBe(selection);
    expect(store.getState().history.past).toHaveLength(0);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const { container } = renderPanel({ themePreference });

      await expectNoAxeViolations(container);
    },
  );
});
