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
  selectCanvasDocument,
  selectDiffMark,
  selectIsPreviewing,
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

describe("code panel state", () => {
  it("starts in properties mode with sql and default options", () => {
    const { store } = createHarness();

    expect(store.getState()).toMatchObject({
      rightPanelMode: "properties",
      codeTarget: "sql",
      codeOptions: {
        sqlDialect: "postgresql",
        prismaProvider: "postgresql",
        drizzleDialect: "postgresql",
        seedFormat: "postgresql",
        seedRowsPerTable: 10,
        seedSeed: 1,
      },
    });
  });

  it("toggles the right panel mode", () => {
    const { store } = createHarness();

    store.getState().setRightPanelMode("code");
    expect(store.getState().rightPanelMode).toBe("code");

    store.getState().setRightPanelMode("properties");
    expect(store.getState().rightPanelMode).toBe("properties");
  });

  it("keeps the code mode when the selection changes", () => {
    const { store } = createHarness();
    store.getState().setRightPanelMode("code");

    store.getState().setSelection({ tableIds: ["tbl_users"], relationIds: [] });

    expect(store.getState().rightPanelMode).toBe("code");
  });

  it("sets the code target", () => {
    const { store } = createHarness();

    store.getState().setCodeTarget("prisma");

    expect(store.getState().codeTarget).toBe("prisma");
  });

  it("updates code options partially", () => {
    const { store } = createHarness();

    store.getState().updateCodeOptions({ sqlDialect: "mysql" });
    store.getState().updateCodeOptions({ seedRowsPerTable: 50 });

    expect(store.getState().codeOptions).toMatchObject({
      sqlDialect: "mysql",
      seedRowsPerTable: 50,
      prismaProvider: "postgresql",
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

const MESSAGE_ID = "msg_1";

const ADD_EMAIL: Operation = {
  type: "addColumn",
  column: makeColumn({ id: "col_email", tableId: "tbl_users", name: "email" }),
  insertAt: 1,
};

const RENAME_ORDERS_TO_USERS: Operation = {
  type: "updateTable",
  tableId: "tbl_orders",
  changes: { name: "users" },
};

describe("proposal preview", () => {
  it("starts a preview without changing the document or the history", () => {
    const { store } = createHarness();
    store.getState().dispatch(rename("store"));
    store.getState().setSelection({ tableIds: ["tbl_users"], relationIds: [] });
    const before = store.getState();

    const result = store.getState().startProposalPreview(MESSAGE_ID, ADD_EMAIL);

    expect(result).toStrictEqual({ isOk: true, value: undefined });
    expect(store.getState()).toMatchObject({
      document: before.document,
      history: before.history,
      selection: before.selection,
      proposal: {
        messageId: MESSAGE_ID,
        operation: ADD_EMAIL,
        base: before.document,
      },
    });
    expect(store.getState().proposal?.preview.columns.col_email?.name).toBe(
      "email",
    );
  });

  it("returns invalid for a value that is not an operation", () => {
    const { store } = createHarness();

    const result = store
      .getState()
      .startProposalPreview(MESSAGE_ID, { type: "dropEverything" });

    expect(result).toStrictEqual({ isOk: false, error: "invalid" });
    expect(store.getState().proposal).toBeNull();
  });

  it("returns stale when the operation no longer applies to the current document", () => {
    const { store } = createHarness();

    const result = store
      .getState()
      .startProposalPreview(MESSAGE_ID, MISSING_TABLE_REMOVAL);

    expect(result).toStrictEqual({ isOk: false, error: "stale" });
    expect(store.getState().proposal).toBeNull();
  });

  it("returns stale when the operation introduces a new issue", () => {
    const { store } = createHarness();

    const result = store
      .getState()
      .startProposalPreview(MESSAGE_ID, RENAME_ORDERS_TO_USERS);

    expect(result).toStrictEqual({ isOk: false, error: "stale" });
    expect(store.getState().proposal).toBeNull();
  });

  it("replaces an earlier preview with a new one", () => {
    const { store } = createHarness();
    store.getState().startProposalPreview(MESSAGE_ID, ADD_EMAIL);

    store.getState().startProposalPreview("msg_2", rename("store"));

    expect(store.getState().proposal).toMatchObject({
      messageId: "msg_2",
      operation: rename("store"),
    });
  });

  it("accepting a proposal records one history entry that one undo reverts and redo reapplies", () => {
    const { store } = createHarness();
    const original = store.getState().document;
    store.getState().startProposalPreview(MESSAGE_ID, ADD_EMAIL);

    store.getState().acceptProposal();
    const accepted = store.getState().document;

    expect(store.getState().proposal).toBeNull();
    expect(store.getState().history.past).toHaveLength(1);
    expect(accepted.columns.col_email?.name).toBe("email");
    store.getState().undo();
    expect(store.getState().document).toStrictEqual(original);
    store.getState().redo();
    expect(store.getState().document).toStrictEqual(accepted);
  });

  it("acceptProposal returns the result of dispatch", () => {
    const { store } = createHarness();
    store.getState().startProposalPreview(MESSAGE_ID, ADD_EMAIL);

    const result = store.getState().acceptProposal();

    expect(result).toStrictEqual({ isOk: true, value: undefined });
  });

  it("throws when acceptProposal is called without a preview", () => {
    const { store } = createHarness();

    expect(() => store.getState().acceptProposal()).toThrow(Error);
  });

  it("discardProposal leaves the document unchanged", () => {
    const { store } = createHarness();
    const before = store.getState();
    store.getState().startProposalPreview(MESSAGE_ID, ADD_EMAIL);

    store.getState().discardProposal();

    expect(store.getState()).toMatchObject({
      proposal: null,
      document: before.document,
      history: before.history,
    });
  });

  it("ignores dispatch, undo and redo during a preview and logs an error", () => {
    const { store, logger } = createHarness();
    store.getState().dispatch(rename("store"));
    store.getState().dispatch(rename("shop_2"));
    store.getState().undo();
    const before = store.getState();
    store.getState().startProposalPreview(MESSAGE_ID, ADD_EMAIL);

    const result = store.getState().dispatch(rename("other"));
    store.getState().undo();
    store.getState().redo();

    expect(result).toStrictEqual({ isOk: true, value: undefined });
    expect(store.getState().document).toBe(before.document);
    expect(store.getState().history).toBe(before.history);
    expect(logger.error.mock.calls).toStrictEqual([
      ["editor.proposal-locked", { action: "dispatch" }],
      ["editor.proposal-locked", { action: "undo" }],
      ["editor.proposal-locked", { action: "redo" }],
    ]);
  });

  it("replaceDocument clears the preview", () => {
    const { store } = createHarness();
    store.getState().startProposalPreview(MESSAGE_ID, ADD_EMAIL);

    store.getState().replaceDocument(buildSchema({ name: "other" }));

    expect(store.getState().proposal).toBeNull();
  });

  it("selectCanvasDocument returns the display document only during a preview", () => {
    const { store } = createHarness();
    const { document } = store.getState();
    expect(selectCanvasDocument(store.getState())).toBe(document);
    expect(selectIsPreviewing(store.getState())).toBe(false);

    store.getState().startProposalPreview(MESSAGE_ID, ADD_EMAIL);

    expect(selectCanvasDocument(store.getState())).toBe(
      store.getState().proposal?.display,
    );
    expect(selectIsPreviewing(store.getState())).toBe(true);
  });

  it("selectDiffMark returns the mark of an element only during a preview", () => {
    const { store } = createHarness();
    expect(selectDiffMark(store.getState(), "col_email")).toBeNull();

    store.getState().startProposalPreview(MESSAGE_ID, ADD_EMAIL);

    expect(selectDiffMark(store.getState(), "col_email")).toBe("added");
    expect(selectDiffMark(store.getState(), "tbl_users")).toBeNull();
  });
});

describe("AI window state", () => {
  it("starts closed, not minimized, not expanded and without an unread reply", () => {
    const { store } = createHarness();

    expect(store.getState().aiWindow).toEqual({
      isOpen: false,
      isMinimized: false,
      isExpanded: false,
      hasUnreadReply: false,
    });
  });

  it("marks a reply unread only while the window is closed", () => {
    const { store } = createHarness();

    store.getState().markAiReplyUnread();
    expect(store.getState().aiWindow.hasUnreadReply).toBe(true);

    store.getState().openAiWindow();
    expect(store.getState().aiWindow).toMatchObject({
      isOpen: true,
      hasUnreadReply: false,
    });

    store.getState().markAiReplyUnread();
    expect(store.getState().aiWindow.hasUnreadReply).toBe(false);
  });

  it("toggles minimized and expanded", () => {
    const { store } = createHarness();
    store.getState().openAiWindow();

    store.getState().toggleAiWindowMinimized();
    store.getState().toggleAiWindowExpanded();
    expect(store.getState().aiWindow).toMatchObject({
      isMinimized: true,
      isExpanded: true,
    });

    store.getState().toggleAiWindowMinimized();
    store.getState().toggleAiWindowExpanded();
    expect(store.getState().aiWindow).toMatchObject({
      isMinimized: false,
      isExpanded: false,
    });
  });

  it("opens the whole window again after closing it minimized, keeping its size", () => {
    const { store } = createHarness();
    store.getState().openAiWindow();
    store.getState().toggleAiWindowExpanded();
    store.getState().toggleAiWindowMinimized();

    store.getState().closeAiWindow();
    store.getState().openAiWindow();

    expect(store.getState().aiWindow).toMatchObject({
      isOpen: true,
      isMinimized: false,
      isExpanded: true,
    });
  });
});
