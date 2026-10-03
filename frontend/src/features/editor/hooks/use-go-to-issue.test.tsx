import type { DocumentPath, SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeEnum,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { act, renderHook } from "@testing-library/react";
import type { JSX, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";

import type { ViewportControls } from "../lib/viewport-controls";
import { ViewportControlsProvider } from "../lib/viewport-controls";
import { createEditorStore } from "../state/create-editor-store";
import type { EditorStore } from "../state/create-editor-store";
import { EditorStoreProvider } from "../state/editor-store-provider";
import { useGoToIssue } from "./use-go-to-issue";

const PATH: DocumentPath = ["columns", "col_users_id", "name"];

function createDocument(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({ id: "tbl_users", name: "users", position: { x: 40, y: 80 } }),
      makeTable({ id: "tbl_orders", name: "orders" }),
    ],
    columns: [
      makeColumn({ id: "col_users_id", tableId: "tbl_users" }),
      makeColumn({ id: "col_orders_user", tableId: "tbl_orders" }),
    ],
    relations: [
      makeRelation({
        id: "rel_orders_users",
        fromTableId: "tbl_orders",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_orders_user", toColumnId: "col_users_id" },
        ],
      }),
    ],
    enums: [makeEnum({ id: "enum_status", name: "status" })],
  });
}

function setup(shouldRequestFocus: boolean): {
  readonly store: EditorStore;
  readonly setCenter: ReturnType<typeof vi.fn<ViewportControls["setCenter"]>>;
  readonly goTo: (issue: { readonly path: DocumentPath }) => void;
} {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: createDocument(),
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
  function Wrapper({
    children,
  }: {
    readonly children: ReactNode;
  }): JSX.Element {
    return (
      <EditorStoreProvider store={store}>
        <ViewportControlsProvider controls={controls}>
          {children}
        </ViewportControlsProvider>
      </EditorStoreProvider>
    );
  }
  const hook = renderHook(() => useGoToIssue({ shouldRequestFocus }), {
    wrapper: Wrapper,
  });
  return { store, setCenter, goTo: hook.result.current };
}

describe("useGoToIssue", () => {
  it("selects and reveals the element of an issue", () => {
    const { store, setCenter, goTo } = setup(true);

    act(() => {
      goTo({ path: PATH });
    });

    expect(store.getState().selection.tableIds).toEqual(["tbl_users"]);
    expect(setCenter).toHaveBeenCalledOnce();
  });

  it("requests focus only when asked", () => {
    const withFocus = setup(true);
    const withoutFocus = setup(false);

    act(() => {
      withFocus.goTo({ path: PATH });
      withoutFocus.goTo({ path: PATH });
    });

    expect(withFocus.store.getState().focusRequest).toEqual(PATH);
    expect(withoutFocus.store.getState().focusRequest).toBeNull();
  });

  it("selects only the relation of a relation path", () => {
    const { store, setCenter, goTo } = setup(false);

    act(() => {
      goTo({ path: ["relations", "rel_orders_users", "onDelete"] });
    });

    expect(store.getState().selection).toEqual({
      tableIds: [],
      relationIds: ["rel_orders_users"],
    });
    expect(setCenter).not.toHaveBeenCalled();
  });

  it("opens the enums tab for an enum path", () => {
    const { store, goTo } = setup(false);
    act(() => {
      store.getState().setLeftPanelTab("tables");
      goTo({ path: ["enums", "enum_status", "values", 0] });
    });

    expect(store.getState().leftPanelTab).toBe("enums");
  });

  it("does nothing for a path whose element is gone", () => {
    const { store, goTo } = setup(false);

    act(() => {
      goTo({ path: ["tables", "tbl_missing", "name"] });
    });

    expect(store.getState().selection.tableIds).toEqual([]);
  });
});
