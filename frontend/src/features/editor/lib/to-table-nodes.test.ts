import type { SchemaDocument } from "@schemaforge/core";
import { buildSchema, makeTable } from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { EMPTY_SELECTION } from "./selection";
import { TABLE_NODE_TYPE, toTableNodes } from "./to-table-nodes";

function createTables(): SchemaDocument["tables"] {
  return buildSchema({
    tables: [
      makeTable({ id: "tbl_orders", position: { x: 300, y: 0 } }),
      makeTable({ id: "tbl_users", position: { x: 0, y: 0 } }),
      makeTable({ id: "tbl_items", position: { x: 600, y: 100 } }),
    ],
  }).tables;
}

describe("toTableNodes", () => {
  it("creates one node per table ordered by id", () => {
    const nodes = toTableNodes({
      tables: createTables(),
      selection: EMPTY_SELECTION,
      dragPositions: {},
      previousNodes: [],
    });

    expect(nodes).toEqual([
      {
        id: "tbl_items",
        type: TABLE_NODE_TYPE,
        position: { x: 600, y: 100 },
        selected: false,
        data: { tableId: "tbl_items" },
      },
      {
        id: "tbl_orders",
        type: TABLE_NODE_TYPE,
        position: { x: 300, y: 0 },
        selected: false,
        data: { tableId: "tbl_orders" },
      },
      {
        id: "tbl_users",
        type: TABLE_NODE_TYPE,
        position: { x: 0, y: 0 },
        selected: false,
        data: { tableId: "tbl_users" },
      },
    ]);
  });

  it("marks selected tables", () => {
    const nodes = toTableNodes({
      tables: createTables(),
      selection: { tableIds: ["tbl_orders"], relationIds: [] },
      dragPositions: {},
      previousNodes: [],
    });

    expect(nodes.map((node) => [node.id, node.selected])).toEqual([
      ["tbl_items", false],
      ["tbl_orders", true],
      ["tbl_users", false],
    ]);
  });

  it("prefers a drag position over the stored position", () => {
    const nodes = toTableNodes({
      tables: createTables(),
      selection: EMPTY_SELECTION,
      dragPositions: { tbl_users: { x: 40, y: 80 } },
      previousNodes: [],
    });

    expect(nodes.find((node) => node.id === "tbl_users")?.position).toEqual({
      x: 40,
      y: 80,
    });
  });

  it("reuses the node object of an unchanged table", () => {
    const tables = createTables();
    const previousNodes = toTableNodes({
      tables,
      selection: EMPTY_SELECTION,
      dragPositions: {},
      previousNodes: [],
    });

    const nodes = toTableNodes({
      tables,
      selection: EMPTY_SELECTION,
      dragPositions: { tbl_users: { x: 40, y: 80 } },
      previousNodes,
    });

    expect(nodes[0]).toBe(previousNodes[0]);
  });

  it("reuses the whole array when nothing changed", () => {
    const tables = createTables();
    const previousNodes = toTableNodes({
      tables,
      selection: EMPTY_SELECTION,
      dragPositions: {},
      previousNodes: [],
    });

    const nodes = toTableNodes({
      tables: createTables(),
      selection: { tableIds: [], relationIds: [] },
      dragPositions: {},
      previousNodes,
    });

    expect(nodes).toBe(previousNodes);
  });

  it("creates a new node when the table moved", () => {
    const tables = createTables();
    const previousNodes = toTableNodes({
      tables,
      selection: EMPTY_SELECTION,
      dragPositions: {},
      previousNodes: [],
    });

    const nodes = toTableNodes({
      tables,
      selection: EMPTY_SELECTION,
      dragPositions: { tbl_users: { x: 40, y: 80 } },
      previousNodes,
    });

    expect(nodes[2]).not.toBe(previousNodes[2]);
  });

  it("creates a new node when the selection changed", () => {
    const tables = createTables();
    const previousNodes = toTableNodes({
      tables,
      selection: EMPTY_SELECTION,
      dragPositions: {},
      previousNodes: [],
    });

    const nodes = toTableNodes({
      tables,
      selection: { tableIds: ["tbl_orders"], relationIds: [] },
      dragPositions: {},
      previousNodes,
    });

    expect(nodes[1]).not.toBe(previousNodes[1]);
  });

  it("drops the node of a removed table", () => {
    const previousNodes = toTableNodes({
      tables: createTables(),
      selection: EMPTY_SELECTION,
      dragPositions: {},
      previousNodes: [],
    });

    const nodes = toTableNodes({
      tables: buildSchema({
        tables: [
          makeTable({ id: "tbl_orders", position: { x: 300, y: 0 } }),
          makeTable({ id: "tbl_users", position: { x: 0, y: 0 } }),
        ],
      }).tables,
      selection: EMPTY_SELECTION,
      dragPositions: {},
      previousNodes,
    });

    expect(nodes).toEqual([previousNodes[1], previousNodes[2]]);
  });
});
