import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { act, screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { JSX } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Locale } from "@/lib/i18n/supported-locales";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import { renderWithProviders } from "@/testing/render-with-providers";

import { EMPTY_SELECTION } from "../lib/selection";
import type { Selection } from "../lib/selection";
import { createEditorStore } from "../state/create-editor-store";
import type { EditorStore } from "../state/create-editor-store";
import { EditorStoreProvider } from "../state/editor-store-provider";
import { useDeleteSelection } from "./use-delete-selection";

const DELETE_LABEL = "Delete selection";

type Harness = {
  readonly user: UserEvent;
  readonly store: EditorStore;
  readonly initialDocument: SchemaDocument;
  readonly focusCanvas: ReturnType<typeof vi.fn<() => void>>;
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

type DeleteButtonProps = { readonly focusCanvas: () => void };

// Stands in for the Delete key the workspace wires to the hook.
function DeleteButton({ focusCanvas }: DeleteButtonProps): JSX.Element {
  const deleteSelection = useDeleteSelection(focusCanvas);
  return (
    <button type="button" onClick={deleteSelection}>
      {DELETE_LABEL}
    </button>
  );
}

function renderDeleteSelection(
  selection: Selection,
  locale: Locale = "en",
): Harness {
  const initialDocument = createDocument();
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: initialDocument,
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  store.getState().setSelection(selection);
  const focusCanvas = vi.fn<() => void>();
  const { user } = renderWithProviders(
    <EditorStoreProvider store={store}>
      <DeleteButton focusCanvas={focusCanvas} />
    </EditorStoreProvider>,
    { locale },
  );
  return { user, store, initialDocument, focusCanvas };
}

async function deleteSelection(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole("button", { name: DELETE_LABEL }));
}

function getToastRegion(): HTMLElement {
  return screen.getByRole("region", { name: /Notifications|Thông báo/ });
}

afterEach(() => {
  // Sonner keeps its toasts in module state, which outlives each render.
  toast.dismiss();
});

const SEVERAL: Selection = {
  tableIds: ["tbl_users", "tbl_orders"],
  relationIds: ["rel_orders_users"],
};

const PRODUCTS: Selection = { tableIds: ["tbl_products"], relationIds: [] };

describe("useDeleteSelection", () => {
  it("deletes the selected tables and relations with one dispatch", async () => {
    const { user, store } = renderDeleteSelection(SEVERAL);

    await deleteSelection(user);

    expect({
      historyLength: store.getState().history.past.length,
      tableIds: Object.keys(store.getState().document.tables),
      relations: store.getState().document.relations,
    }).toStrictEqual({
      historyLength: 1,
      tableIds: ["tbl_products"],
      relations: {},
    });
  });

  it("restores everything with a single undo", async () => {
    const { user, store, initialDocument } = renderDeleteSelection(SEVERAL);

    await deleteSelection(user);
    act(() => {
      store.getState().undo();
    });

    expect(store.getState().document).toStrictEqual(initialDocument);
  });

  it("does nothing for an empty selection", async () => {
    const { user, store, initialDocument, focusCanvas } =
      renderDeleteSelection(EMPTY_SELECTION);

    await deleteSelection(user);

    expect({
      document: store.getState().document,
      historyLength: store.getState().history.past.length,
      focusCalls: focusCanvas.mock.calls.length,
      toasts: within(getToastRegion()).queryAllByRole("listitem").length,
    }).toStrictEqual({
      document: initialDocument,
      historyLength: 0,
      focusCalls: 0,
      toasts: 0,
    });
  });

  it("shows a toast with an undo action", async () => {
    const { user, store, initialDocument } = renderDeleteSelection(SEVERAL);

    await deleteSelection(user);
    await user.click(
      await within(getToastRegion()).findByRole("button", { name: "Undo" }),
    );

    expect(store.getState().document).toStrictEqual(initialDocument);
  });

  it("names the table in the toast when one table is deleted", async () => {
    const { user } = renderDeleteSelection(PRODUCTS);

    await deleteSelection(user);

    expect(
      await within(getToastRegion()).findByText("Deleted table products"),
    ).toBeDefined();
  });

  it("counts the elements in the toast when several are deleted", async () => {
    const { user } = renderDeleteSelection(SEVERAL);

    await deleteSelection(user);

    expect(
      await within(getToastRegion()).findByText("Deleted 3 elements"),
    ).toBeDefined();
  });

  it("keeps the selection when the deletion is rejected", async () => {
    const selection: Selection = {
      tableIds: ["tbl_missing"],
      relationIds: [],
    };
    const { user, store, focusCanvas } = renderDeleteSelection(selection);

    await deleteSelection(user);

    expect({
      selection: store.getState().selection,
      historyLength: store.getState().history.past.length,
      focusCalls: focusCanvas.mock.calls.length,
    }).toStrictEqual({ selection, historyLength: 0, focusCalls: 0 });
  });

  it("counts the elements in the Vietnamese toast", async () => {
    const { user } = renderDeleteSelection(
      { tableIds: ["tbl_products"], relationIds: ["rel_orders_users"] },
      "vi",
    );

    await deleteSelection(user);

    expect(
      await within(getToastRegion()).findByText("Đã xóa 2 phần tử"),
    ).toBeDefined();
  });

  it("clears the selection and moves focus back to the canvas", async () => {
    const { user, store, focusCanvas } = renderDeleteSelection(SEVERAL);

    await deleteSelection(user);

    expect(store.getState().selection).toStrictEqual(EMPTY_SELECTION);
    expect(focusCanvas).toHaveBeenCalledOnce();
  });

  it("leaves a later change alone when the toast action runs", async () => {
    const { user, store } = renderDeleteSelection(PRODUCTS);

    await deleteSelection(user);
    act(() => {
      store.getState().dispatch({ type: "renameSchema", name: "store" });
    });
    await user.click(
      await within(getToastRegion()).findByRole("button", { name: "Undo" }),
    );

    expect({
      name: store.getState().document.name,
      hasProducts: store.getState().document.tables.tbl_products !== undefined,
    }).toStrictEqual({ name: "store", hasProducts: false });
  });
});
