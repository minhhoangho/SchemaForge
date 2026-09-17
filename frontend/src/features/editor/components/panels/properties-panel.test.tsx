import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { screen, within } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Locale } from "@/lib/i18n/supported-locales";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import { renderWithProviders } from "@/testing/render-with-providers";

import { EMPTY_SELECTION } from "../../lib/selection";
import type { Selection } from "../../lib/selection";
import { createEditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import { PropertiesPanel } from "./properties-panel";

type RenderOptions = {
  readonly selection: Selection;
  readonly locale?: Locale;
};

function renderPanel({
  selection,
  locale = "en",
}: RenderOptions): RenderResult {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: buildSchema({
      name: "shop",
      tables: [
        makeTable({
          id: "tbl_users",
          name: "users",
          primaryKeyColumnIds: ["col_users_id"],
        }),
        makeTable({ id: "tbl_orders", name: "orders" }),
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
    }),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  store.getState().setSelection(selection);
  return renderWithProviders(
    <EditorStoreProvider store={store}>
      <PropertiesPanel
        id="properties-panel"
        onCreateRelation={vi.fn<() => void>()}
        onDelete={vi.fn<() => void>()}
      />
    </EditorStoreProvider>,
    { locale },
  );
}

describe("PropertiesPanel", () => {
  it("renders nothing without a selection", () => {
    renderPanel({ selection: EMPTY_SELECTION });

    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("shows the table panel for a single table", () => {
    renderPanel({ selection: { tableIds: ["tbl_users"], relationIds: [] } });

    const panel = screen.getByRole("complementary", { name: "Properties" });
    expect(
      within(panel).getByRole("textbox", { name: "Table name" }),
    ).toHaveProperty("value", "users");
  });

  it("shows the relation panel for a single relation", () => {
    renderPanel({
      selection: { tableIds: [], relationIds: ["rel_orders_users"] },
    });

    const panel = screen.getByRole("complementary", { name: "Properties" });
    expect(
      within(panel).getByRole("heading", { name: "Relation" }),
    ).toBeDefined();
  });

  it("shows the multi selection panel for several elements", () => {
    renderPanel({
      selection: {
        tableIds: ["tbl_users", "tbl_orders"],
        relationIds: ["rel_orders_users"],
      },
    });

    const panel = screen.getByRole("complementary", { name: "Properties" });
    expect(
      within(panel).getByText("Selected 2 tables and 1 relation"),
    ).toBeDefined();
  });

  it.each([
    ["en", "Properties"],
    ["vi", "Thuộc tính"],
  ] as const)("names the panel in %s", (locale, name) => {
    renderPanel({
      selection: { tableIds: ["tbl_users"], relationIds: [] },
      locale,
    });

    expect(screen.getByRole("complementary", { name })).toBeDefined();
  });
});
