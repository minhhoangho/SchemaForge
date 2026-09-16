import type {
  Operation,
  Position,
  SchemaDocument,
  TableId,
} from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";

import { EMPTY_SELECTION } from "../lib/selection";
import {
  HISTORY_LIMIT,
  createEditorStore,
  getMoveCoalesceKey,
} from "./create-editor-store";
import type { EditorStore } from "./create-editor-store";

const SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";

type Harness = {
  readonly store: EditorStore;
  readonly notify: ReturnType<typeof vi.fn<Notify>>;
  readonly logger: {
    readonly error: ReturnType<typeof vi.fn<Logger["error"]>>;
    readonly warn: ReturnType<typeof vi.fn<Logger["warn"]>>;
  };
};

function createDocument(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({ id: "tbl_users", name: "users" }),
      makeTable({ id: "tbl_orders", name: "orders" }),
    ],
    columns: [makeColumn({ id: "col_id", tableId: "tbl_users", name: "id" })],
  });
}

function createHarness(document: SchemaDocument = createDocument()): Harness {
  const notify = vi.fn<Notify>();
  const logger = {
    error: vi.fn<Logger["error"]>(),
    warn: vi.fn<Logger["warn"]>(),
  };
  const store = createEditorStore({
    schemaId: SCHEMA_ID,
    document,
    generateId: createCounterIdGenerator(),
    notify,
    logger,
  });
  return { store, notify, logger };
}

function rename(name: string): Operation {
  return { type: "renameSchema", name };
}

function move(
  moves: readonly {
    readonly elementId: TableId;
    readonly position: Position;
  }[],
): Operation {
  return { type: "moveElements", moves };
}

const MISSING_TABLE_REMOVAL: Operation = {
  type: "removeTable",
  tableId: "tbl_missing",
};

// One more distinct rename than the history keeps.
const RENAMES_OVER_HISTORY_LIMIT: readonly Operation[] = Array.from(
  { length: HISTORY_LIMIT + 1 },
  (_, index) => rename(`name_${String(index)}`),
);

describe("createEditorStore", () => {
  it("records one history entry for a successful dispatch", () => {
    const { store } = createHarness();

    const result = store.getState().dispatch(rename("store"));

    expect(result).toStrictEqual({ isOk: true, value: undefined });
    expect(store.getState().document.name).toBe("store");
    expect(store.getState().history.past).toStrictEqual([
      { operation: rename("store"), inverse: rename("shop") },
    ]);
  });

  it("keeps the document and history unchanged when the operation is rejected", () => {
    const { store } = createHarness();
    const before = store.getState();

    store.getState().dispatch(MISSING_TABLE_REMOVAL);

    expect(store.getState().document).toBe(before.document);
    expect(store.getState().history).toBe(before.history);
  });

  it("notifies and logs the error code when the operation is rejected", () => {
    const { store, notify, logger } = createHarness();

    store.getState().dispatch(MISSING_TABLE_REMOVAL);

    expect(notify).toHaveBeenCalledWith({
      tone: "error",
      titleKey: "errors:operationNotApplied",
      descriptionKey: "errors:codes.table-not-found",
    });
    expect(logger.error).toHaveBeenCalledWith("editor.operation-rejected", {
      operationType: "removeTable",
      code: "table-not-found",
      path: ["tableId"],
    });
  });

  it("returns the operation error to the caller", () => {
    const { store } = createHarness();

    const result = store.getState().dispatch(MISSING_TABLE_REMOVAL);

    expect(result).toStrictEqual({
      isOk: false,
      error: { code: "table-not-found", path: ["tableId"] },
    });
  });

  it("records nothing when the operation changes nothing", () => {
    const { store } = createHarness();
    const before = store.getState();

    const result = store.getState().dispatch(rename("shop"));

    expect(result).toStrictEqual({ isOk: true, value: undefined });
    expect(store.getState()).toBe(before);
  });

  it("undoes the last entry", () => {
    const { store } = createHarness();
    store.getState().dispatch(rename("store"));

    store.getState().undo();

    expect(store.getState().document.name).toBe("shop");
    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().history.future).toHaveLength(1);
  });

  it("redoes an undone entry", () => {
    const { store } = createHarness();
    store.getState().dispatch(rename("store"));
    store.getState().undo();

    store.getState().redo();

    expect(store.getState().document.name).toBe("store");
    expect(store.getState().history.past).toHaveLength(1);
    expect(store.getState().history.future).toHaveLength(0);
  });

  it("does nothing when there is nothing to undo", () => {
    const { store } = createHarness();
    const before = store.getState();

    store.getState().undo();
    store.getState().redo();

    expect(store.getState()).toBe(before);
  });

  it("merges consecutive keyboard moves of the same tables into one entry", () => {
    const { store } = createHarness();
    const options = { coalesce: "keyboardMove" } as const;

    store.getState().dispatch(
      move([
        { elementId: "tbl_users", position: { x: 10, y: 0 } },
        { elementId: "tbl_orders", position: { x: 10, y: 0 } },
      ]),
      options,
    );
    store.getState().dispatch(
      move([
        { elementId: "tbl_orders", position: { x: 20, y: 0 } },
        { elementId: "tbl_users", position: { x: 20, y: 0 } },
      ]),
      options,
    );
    store.getState().undo();

    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().document.tables.tbl_users?.position).toStrictEqual({
      x: 0,
      y: 0,
    });
  });

  it("does not merge keyboard moves of a different set of tables", () => {
    const { store } = createHarness();
    const options = { coalesce: "keyboardMove" } as const;

    store
      .getState()
      .dispatch(
        move([{ elementId: "tbl_users", position: { x: 10, y: 0 } }]),
        options,
      );
    store
      .getState()
      .dispatch(
        move([{ elementId: "tbl_orders", position: { x: 10, y: 0 } }]),
        options,
      );

    expect(store.getState().history.past).toHaveLength(2);
  });

  it("does not merge a keyboard move into an earlier entry after undo", () => {
    const { store } = createHarness();
    const options = { coalesce: "keyboardMove" } as const;
    const keyboardMove = move([
      { elementId: "tbl_users", position: { x: 10, y: 0 } },
    ]);
    store.getState().dispatch(rename("store"));
    store.getState().dispatch(keyboardMove, options);
    store.getState().undo();

    store.getState().dispatch(keyboardMove, options);

    expect(store.getState().history.past).toHaveLength(2);
    expect(store.getState().history.past[0]?.operation).toStrictEqual(
      rename("store"),
    );
  });

  it("does not merge when another dispatch happened in between", () => {
    const { store } = createHarness();
    const options = { coalesce: "keyboardMove" } as const;

    store
      .getState()
      .dispatch(
        move([{ elementId: "tbl_users", position: { x: 10, y: 0 } }]),
        options,
      );
    store.getState().dispatch(rename("store"));
    store
      .getState()
      .dispatch(
        move([{ elementId: "tbl_users", position: { x: 20, y: 0 } }]),
        options,
      );

    expect(store.getState().history.past).toHaveLength(3);
  });

  it("keeps a mouse drag of several tables as one entry", () => {
    const { store } = createHarness();
    const drag = move([
      { elementId: "tbl_users", position: { x: 40, y: 40 } },
      { elementId: "tbl_orders", position: { x: 80, y: 40 } },
    ]);

    store.getState().dispatch(drag);
    store.getState().dispatch(
      move([
        { elementId: "tbl_users", position: { x: 50, y: 40 } },
        { elementId: "tbl_orders", position: { x: 90, y: 40 } },
      ]),
    );

    expect(store.getState().history.past).toHaveLength(2);
    expect(store.getState().history.past[0]?.operation).toStrictEqual(drag);
  });

  it("drops selected ids that the operation removed", () => {
    const { store } = createHarness();
    store
      .getState()
      .setSelection({ tableIds: ["tbl_users", "tbl_orders"], relationIds: [] });

    store.getState().dispatch({ type: "removeTable", tableId: "tbl_orders" });

    expect(store.getState().selection).toStrictEqual({
      tableIds: ["tbl_users"],
      relationIds: [],
    });
  });

  it("keeps the selection object when nothing was removed", () => {
    const { store } = createHarness();
    const selection = { tableIds: ["tbl_users"], relationIds: [] } as const;
    store.getState().setSelection(selection);

    store.getState().dispatch(rename("store"));

    expect(store.getState().selection).toBe(selection);
  });

  it("clears history and selection when the document is replaced", () => {
    const { store } = createHarness();
    store.getState().dispatch(rename("store"));
    store.getState().setSelection({ tableIds: ["tbl_users"], relationIds: [] });
    store.getState().setDragPositions({ tbl_users: { x: 5, y: 5 } });
    const replacement = buildSchema({ name: "other" });

    store.getState().replaceDocument(replacement);

    expect(store.getState()).toMatchObject({
      document: replacement,
      history: { past: [], future: [] },
      selection: EMPTY_SELECTION,
      dragPositions: {},
      coalesceKey: null,
    });
  });

  it("caps the history at the history limit", () => {
    const { store } = createHarness();

    RENAMES_OVER_HISTORY_LIMIT.forEach((operation) =>
      store.getState().dispatch(operation),
    );

    expect(store.getState().history.past).toHaveLength(HISTORY_LIMIT);
  });

  it("starts with the tables tab open, nothing selected and saved status", () => {
    const { store } = createHarness();

    expect(store.getState()).toMatchObject({
      schemaId: SCHEMA_ID,
      selection: EMPTY_SELECTION,
      dragPositions: {},
      leftPanelTab: "tables",
      focusRequest: null,
      saveStatus: { kind: "saved" },
      coalesceKey: null,
    });
  });

  it("sets the left panel tab, focus request and save status", () => {
    const { store } = createHarness();

    store.getState().setLeftPanelTab("issues");
    store.getState().requestFocus(["tables", "tbl_users"]);
    store.getState().setSaveStatus({ kind: "failed", errorCode: "closed" });

    expect(store.getState()).toMatchObject({
      leftPanelTab: "issues",
      focusRequest: ["tables", "tbl_users"],
      saveStatus: { kind: "failed", errorCode: "closed" },
    });
  });
});

describe("getMoveCoalesceKey", () => {
  it("returns null for an operation that is not a move", () => {
    expect(getMoveCoalesceKey(rename("store"))).toBeNull();
  });

  it("lists the moved element ids in ascending order", () => {
    const key = getMoveCoalesceKey(
      move([
        { elementId: "tbl_users", position: { x: 0, y: 0 } },
        { elementId: "tbl_orders", position: { x: 0, y: 0 } },
      ]),
    );

    expect(key).toBe("keyboardMove:tbl_orders,tbl_users");
  });
});
