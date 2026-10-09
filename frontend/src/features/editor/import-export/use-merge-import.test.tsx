import { buildImportOperation } from "@schemaforge/core";
import type { Operation, SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { act, renderHook } from "@testing-library/react";
import type { JSX, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify, NotifyInput } from "@/lib/notify";

import type { ImportConfirmation } from "@/components/import-dialog/import-dialog";

import { CanvasNodeControlsProvider } from "../lib/viewport-controls";
import type { CanvasNodeControls } from "../lib/viewport-controls";
import { createEditorStore } from "../state/create-editor-store";
import type { EditorStore } from "../state/create-editor-store";
import { EditorStoreProvider } from "../state/editor-store-provider";
import { useMergeImport } from "./use-merge-import";

const notify = vi.fn<Notify>();
vi.mock("@/lib/use-notify", () => ({ useNotify: (): Notify => notify }));

type MergeConfirmation = Extract<ImportConfirmation, { mode: "merge" }>;

const ADD_EMAIL: Operation = {
  type: "addColumn",
  column: makeColumn({ id: "col_email", tableId: "tbl_users", name: "email" }),
  insertAt: 1,
};

function createTarget(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [makeTable({ id: "tbl_users", name: "users" })],
    columns: [makeColumn({ id: "col_users_id", tableId: "tbl_users" })],
  });
}

function createImported(): SchemaDocument {
  return buildSchema({
    name: "imported",
    tables: [
      makeTable({ id: "tbl_users", name: "users" }),
      makeTable({ id: "tbl_orders", name: "orders" }),
    ],
  });
}

type Harness = {
  readonly store: EditorStore;
  readonly fitNodes: ReturnType<typeof vi.fn<CanvasNodeControls["fitNodes"]>>;
  readonly confirmation: MergeConfirmation;
  readonly addedTableIds: readonly string[];
  readonly mergeImport: (confirmation: MergeConfirmation) => void;
};

function renderMergeImport(): Harness {
  const target = createTarget();
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: target,
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const { operation } = buildImportOperation(
    target,
    createImported(),
    { mode: "merge", origin: { x: 400, y: 0 } },
    createCounterIdGenerator(),
  );
  const addedTableIds = operation.operations.flatMap((step) =>
    step.type === "addTable" ? [step.table.id] : [],
  );
  const fitNodes = vi.fn<CanvasNodeControls["fitNodes"]>();
  const controls: CanvasNodeControls = {
    getMeasuredNodes: () => [],
    fitNodes,
  };
  function Wrapper({
    children,
  }: {
    readonly children: ReactNode;
  }): JSX.Element {
    return (
      <EditorStoreProvider store={store}>
        <CanvasNodeControlsProvider controls={controls}>
          {children}
        </CanvasNodeControlsProvider>
      </EditorStoreProvider>
    );
  }
  const { result } = renderHook(() => useMergeImport(), { wrapper: Wrapper });
  return {
    store,
    fitNodes,
    addedTableIds,
    mergeImport: result.current,
    confirmation: {
      mode: "merge",
      operation,
      target,
      summary: {
        tables: 2,
        columns: 0,
        relations: 0,
        indexes: 0,
        enums: 0,
        subjectAreas: 0,
        notes: 0,
      },
    },
  };
}

function lastNotice(): NotifyInput | undefined {
  return notify.mock.lastCall?.[0];
}

beforeEach(() => {
  notify.mockReset();
});

describe("useMergeImport", () => {
  it("dispatches one operation and selects the new tables", () => {
    const { store, confirmation, addedTableIds, mergeImport } =
      renderMergeImport();

    act(() => {
      mergeImport(confirmation);
    });

    const state = store.getState();
    expect(state.history.past).toHaveLength(1);
    expect(Object.keys(state.document.tables)).toHaveLength(3);
    expect(addedTableIds).toHaveLength(2);
    expect(state.selection).toEqual({
      tableIds: addedTableIds,
      relationIds: [],
    });
    expect(lastNotice()).toMatchObject({
      tone: "success",
      titleKey: "importExport:import.done",
      values: { count: 2 },
    });
  });

  it("fits the view around the new tables", () => {
    const { fitNodes, confirmation, addedTableIds, mergeImport } =
      renderMergeImport();

    act(() => {
      mergeImport(confirmation);
    });

    expect(fitNodes).toHaveBeenCalledExactlyOnceWith(addedTableIds);
  });

  it("offers an undo action that restores the previous schema", () => {
    const { store, confirmation, mergeImport } = renderMergeImport();

    act(() => {
      mergeImport(confirmation);
    });
    act(() => {
      lastNotice()?.action?.onSelect();
    });

    expect(lastNotice()?.action?.labelKey).toBe("common:actions.undo");
    expect(store.getState().document).toEqual(confirmation.target);
    expect(store.getState().history.past).toHaveLength(0);
  });

  it("keeps a later change when the undo action runs", () => {
    const { store, confirmation, mergeImport } = renderMergeImport();

    act(() => {
      mergeImport(confirmation);
    });
    const undoImport = lastNotice()?.action?.onSelect;
    act(() => {
      store.getState().dispatch(ADD_EMAIL);
      undoImport?.();
    });

    expect(store.getState().history.past).toHaveLength(2);
  });

  it("offers no undo when an empty import changes nothing", () => {
    const { store, fitNodes, confirmation, mergeImport } = renderMergeImport();
    act(() => {
      store.getState().dispatch(ADD_EMAIL);
    });
    const history = store.getState().history;

    act(() => {
      mergeImport({
        ...confirmation,
        target: store.getState().document,
        operation: { type: "batch", operations: [] },
      });
    });

    expect(store.getState().history).toBe(history);
    expect(fitNodes).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledExactlyOnceWith({
      tone: "success",
      titleKey: "importExport:import.done",
      values: { count: 0 },
    });
  });

  it("does not dispatch when the document changed", () => {
    const { store, fitNodes, confirmation, mergeImport } = renderMergeImport();
    act(() => {
      store.getState().dispatch(ADD_EMAIL);
    });

    act(() => {
      mergeImport(confirmation);
    });

    expect(store.getState().history.past).toHaveLength(1);
    expect(fitNodes).not.toHaveBeenCalled();
    expect(lastNotice()).toMatchObject({
      tone: "error",
      titleKey: "importExport:import.errors.notApplied",
    });
  });

  it("disables import during an AI proposal preview", () => {
    const { store, fitNodes, confirmation, mergeImport } = renderMergeImport();
    act(() => {
      store.getState().startProposalPreview("message-1", ADD_EMAIL);
    });

    act(() => {
      mergeImport(confirmation);
    });

    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().selection.tableIds).toEqual([]);
    expect(fitNodes).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledExactlyOnceWith({
      tone: "error",
      titleKey: "importExport:import.errors.previewing",
    });
  });
});
