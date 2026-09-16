import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";

import { createEditorStore } from "../state/create-editor-store";
import type { EditorStore } from "../state/create-editor-store";
import type { MeasuredSize } from "./apply-canvas-changes";
import {
  applyDragStop,
  applyEdgeChanges,
  applyNodeChanges,
  applySelectionChange,
  reduceEdgeChanges,
  reduceNodeChanges,
  toDragStopMoves,
} from "./apply-canvas-changes";
import { EMPTY_SELECTION } from "./selection";
import type { TableNode } from "./to-table-nodes";

const USERS_POSITION = { x: 0, y: 0 };
const POSTS_POSITION = { x: 400, y: 0 };

function createDocument(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_users",
        position: USERS_POSITION,
        primaryKeyColumnIds: ["col_user_id"],
      }),
      makeTable({ id: "tbl_posts", position: POSTS_POSITION }),
    ],
    columns: [
      makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
      makeColumn({ id: "col_post_author", tableId: "tbl_posts" }),
    ],
    relations: [
      makeRelation({
        id: "rel_posts_users",
        fromTableId: "tbl_posts",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_post_author", toColumnId: "col_user_id" },
        ],
      }),
    ],
  });
}

function createTestStore(): EditorStore {
  return createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: createDocument(),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
}

function createState(): Parameters<typeof reduceNodeChanges>[0] {
  return {
    document: createDocument(),
    dragPositions: {},
    selection: EMPTY_SELECTION,
  };
}

function createNode(id: string, x: number, y: number): TableNode {
  return {
    id,
    type: "table",
    position: { x, y },
    data: { tableId: "tbl_users" },
  };
}

describe("reduceNodeChanges", () => {
  it("ignores remove, add and replace changes", () => {
    const state = createState();
    const node = createNode("tbl_users", 0, 0);

    const effects = reduceNodeChanges(state, [
      { type: "remove", id: "tbl_users" },
      { type: "add", item: node },
      { type: "replace", id: "tbl_users", item: node },
    ]);

    expect(effects).toEqual({
      dragPositions: state.dragPositions,
      selection: state.selection,
      moves: [],
      measuredSizes: [],
    });
  });

  it("keeps the position of a dragged table as a drag position", () => {
    const effects = reduceNodeChanges(createState(), [
      {
        type: "position",
        id: "tbl_users",
        position: { x: 50, y: 30 },
        dragging: true,
      },
    ]);

    expect({
      dragPositions: effects.dragPositions,
      moves: effects.moves,
    }).toEqual({ dragPositions: { tbl_users: { x: 50, y: 30 } }, moves: [] });
  });

  it("leaves the end of a mouse drag to the drag stop handler", () => {
    const state = {
      ...createState(),
      dragPositions: { tbl_users: { x: 50, y: 30 } },
    };

    const effects = reduceNodeChanges(state, [
      {
        type: "position",
        id: "tbl_users",
        position: { x: 50, y: 30 },
        dragging: false,
      },
    ]);

    expect(effects.moves).toEqual([]);
  });

  it("drops the drag position of a drag that ended without a drag stop", () => {
    const state = {
      ...createState(),
      dragPositions: {
        tbl_users: { x: 50, y: 30 },
        tbl_posts: { x: 450, y: 30 },
      },
    };

    const effects = reduceNodeChanges(state, [
      {
        type: "position",
        id: "tbl_users",
        position: { x: 50, y: 30 },
        dragging: false,
      },
    ]);

    expect({
      dragPositions: effects.dragPositions,
      moves: effects.moves,
    }).toEqual({ dragPositions: { tbl_posts: { x: 450, y: 30 } }, moves: [] });
  });

  it("turns an arrow key move into a move", () => {
    const effects = reduceNodeChanges(createState(), [
      {
        type: "position",
        id: "tbl_users",
        position: { x: 5, y: 0 },
        dragging: false,
      },
    ]);

    expect(effects.moves).toEqual([
      { elementId: "tbl_users", position: { x: 5, y: 0 } },
    ]);
  });

  it("does not move a table to the position it already has", () => {
    const effects = reduceNodeChanges(createState(), [
      { type: "position", id: "tbl_users", position: USERS_POSITION },
    ]);

    expect(effects.moves).toEqual([]);
  });

  it("ignores position changes without a position or of an unknown table", () => {
    const state = createState();

    const effects = reduceNodeChanges(state, [
      { type: "position", id: "tbl_users" },
      { type: "position", id: "tbl_gone", position: { x: 1, y: 1 } },
    ]);

    expect({
      moves: effects.moves,
      dragPositions: effects.dragPositions,
    }).toEqual({ moves: [], dragPositions: state.dragPositions });
  });

  it("adds and removes selected tables", () => {
    const effects = reduceNodeChanges(createState(), [
      { type: "select", id: "tbl_users", selected: true },
      { type: "select", id: "tbl_posts", selected: true },
      { type: "select", id: "tbl_users", selected: false },
      { type: "select", id: "tbl_gone", selected: true },
    ]);

    expect(effects.selection).toEqual({
      tableIds: ["tbl_posts"],
      relationIds: [],
    });
  });

  it("collects measured sizes from dimension changes", () => {
    const effects = reduceNodeChanges(createState(), [
      {
        type: "dimensions",
        id: "tbl_users",
        dimensions: { width: 200, height: 120 },
      },
      { type: "dimensions", id: "tbl_posts" },
    ]);

    expect(effects.measuredSizes).toEqual([
      ["tbl_users", { width: 200, height: 120 }],
    ]);
  });
});

describe("applyNodeChanges", () => {
  it("stores drag positions without touching the document", () => {
    const store = createTestStore();
    const document = store.getState().document;

    applyNodeChanges(
      store,
      [
        {
          type: "position",
          id: "tbl_users",
          position: { x: 50, y: 30 },
          dragging: true,
        },
      ],
      new Map(),
    );

    expect({
      dragPositions: store.getState().dragPositions,
      isSameDocument: store.getState().document === document,
    }).toEqual({
      dragPositions: { tbl_users: { x: 50, y: 30 } },
      isSameDocument: true,
    });
  });

  it("merges consecutive arrow key moves into one history entry", () => {
    const store = createTestStore();

    applyNodeChanges(
      store,
      [{ type: "position", id: "tbl_users", position: { x: 5, y: 0 } }],
      new Map(),
    );
    applyNodeChanges(
      store,
      [{ type: "position", id: "tbl_users", position: { x: 10, y: 0 } }],
      new Map(),
    );

    expect({
      position: store.getState().document.tables.tbl_users?.position,
      entryCount: store.getState().history.past.length,
    }).toEqual({ position: { x: 10, y: 0 }, entryCount: 1 });
  });

  it("stores the selected tables", () => {
    const store = createTestStore();

    applyNodeChanges(
      store,
      [{ type: "select", id: "tbl_posts", selected: true }],
      new Map(),
    );

    expect(store.getState().selection).toEqual({
      tableIds: ["tbl_posts"],
      relationIds: [],
    });
  });

  it("does not replace an unchanged selection", () => {
    const store = createTestStore();
    const selection = store.getState().selection;

    applyNodeChanges(
      store,
      [{ type: "select", id: "tbl_posts", selected: false }],
      new Map(),
    );

    expect(store.getState().selection).toBe(selection);
  });

  it("remembers measured sizes", () => {
    const measuredSizes = new Map<string, MeasuredSize>();

    applyNodeChanges(
      createTestStore(),
      [
        {
          type: "dimensions",
          id: "tbl_users",
          dimensions: { width: 200, height: 120 },
        },
      ],
      measuredSizes,
    );

    expect([...measuredSizes]).toEqual([
      ["tbl_users", { width: 200, height: 120 }],
    ]);
  });

  it("forgets measured sizes of tables that no longer exist", () => {
    const measuredSizes = new Map<string, MeasuredSize>([
      ["tbl_gone", { width: 10, height: 10 }],
    ]);

    applyNodeChanges(
      createTestStore(),
      [
        {
          type: "dimensions",
          id: "tbl_users",
          dimensions: { width: 200, height: 120 },
        },
      ],
      measuredSizes,
    );

    expect([...measuredSizes.keys()]).toEqual(["tbl_users"]);
  });

  it("never removes a table", () => {
    const store = createTestStore();
    const dispatch = vi.spyOn(store.getState(), "dispatch");

    applyNodeChanges(store, [{ type: "remove", id: "tbl_users" }], new Map());

    expect({
      dispatchCount: dispatch.mock.calls.length,
      tableIds: Object.keys(store.getState().document.tables).toSorted(),
    }).toEqual({ dispatchCount: 0, tableIds: ["tbl_posts", "tbl_users"] });
  });
});

describe("reduceEdgeChanges", () => {
  it("keeps only select changes of known relations", () => {
    expect(
      reduceEdgeChanges(
        createDocument(),
        [],
        [
          { type: "select", id: "rel_posts_users", selected: true },
          { type: "select", id: "rel_gone", selected: true },
          { type: "remove", id: "rel_posts_users" },
        ],
      ),
    ).toEqual(["rel_posts_users"]);
  });

  it("removes a relation that is no longer selected", () => {
    expect(
      reduceEdgeChanges(
        createDocument(),
        ["rel_posts_users"],
        [{ type: "select", id: "rel_posts_users", selected: false }],
      ),
    ).toEqual([]);
  });
});

describe("applyEdgeChanges", () => {
  it("stores the selected relations", () => {
    const store = createTestStore();

    applyEdgeChanges(store, [
      { type: "select", id: "rel_posts_users", selected: true },
    ]);

    expect(store.getState().selection).toEqual({
      tableIds: [],
      relationIds: ["rel_posts_users"],
    });
  });

  it("never removes a relation", () => {
    const store = createTestStore();
    const selection = store.getState().selection;

    applyEdgeChanges(store, [{ type: "remove", id: "rel_posts_users" }]);

    expect({
      relationIds: Object.keys(store.getState().document.relations),
      isSameSelection: store.getState().selection === selection,
    }).toEqual({ relationIds: ["rel_posts_users"], isSameSelection: true });
  });
});

describe("applySelectionChange", () => {
  it("replaces the selection with the known selected elements", () => {
    const store = createTestStore();

    applySelectionChange(store, {
      nodes: [createNode("tbl_posts", 0, 0), createNode("tbl_gone", 0, 0)],
      edges: [
        {
          id: "rel_posts_users",
          source: "tbl_posts",
          target: "tbl_users",
        },
      ],
    });

    expect(store.getState().selection).toEqual({
      tableIds: ["tbl_posts"],
      relationIds: ["rel_posts_users"],
    });
  });

  it("does not replace an equal selection", () => {
    const store = createTestStore();
    const selection = store.getState().selection;

    applySelectionChange(store, { nodes: [], edges: [] });

    expect(store.getState().selection).toBe(selection);
  });
});

describe("toDragStopMoves", () => {
  it("moves only known tables whose position changed", () => {
    expect(
      toDragStopMoves(createDocument(), [
        createNode("tbl_users", 100, 60),
        createNode("tbl_posts", POSTS_POSITION.x, POSTS_POSITION.y),
        createNode("tbl_gone", 1, 1),
      ]),
    ).toEqual([{ elementId: "tbl_users", position: { x: 100, y: 60 } }]);
  });
});

describe("applyDragStop", () => {
  it("dispatches one move for every dragged table and clears drag positions", () => {
    const store = createTestStore();
    store.getState().setDragPositions({ tbl_users: { x: 100, y: 60 } });

    applyDragStop(store, [
      createNode("tbl_users", 100, 60),
      createNode("tbl_posts", 500, 20),
    ]);

    expect({
      users: store.getState().document.tables.tbl_users?.position,
      posts: store.getState().document.tables.tbl_posts?.position,
      entryCount: store.getState().history.past.length,
      dragPositions: store.getState().dragPositions,
    }).toEqual({
      users: { x: 100, y: 60 },
      posts: { x: 500, y: 20 },
      entryCount: 1,
      dragPositions: {},
    });
  });

  it("does not dispatch when no table moved", () => {
    const store = createTestStore();
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    store.getState().setDragPositions({ tbl_users: USERS_POSITION });

    applyDragStop(store, [
      createNode("tbl_users", USERS_POSITION.x, USERS_POSITION.y),
    ]);

    expect({
      dispatchCount: dispatch.mock.calls.length,
      dragPositions: store.getState().dragPositions,
    }).toEqual({ dispatchCount: 0, dragPositions: {} });
  });
});
