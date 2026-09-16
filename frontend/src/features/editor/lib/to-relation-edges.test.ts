import type { Position, Relation, SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  makeColumn,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { getIssueIndex } from "./issue-index";
import { EMPTY_SELECTION } from "./selection";
import type { RelationEdge, ToRelationEdgesInput } from "./to-relation-edges";
import { RELATION_EDGE_TYPE, toRelationEdges } from "./to-relation-edges";

type TablePositions = {
  readonly users: Position;
  readonly orders: Position;
};

const USERS_LEFT_OF_ORDERS: TablePositions = {
  users: { x: 0, y: 0 },
  orders: { x: 400, y: 0 },
};

const ORDERS_USERS_RELATION: Relation = makeRelation({
  id: "rel_orders_users",
  fromTableId: "tbl_orders",
  toTableId: "tbl_users",
  columnPairs: [
    { fromColumnId: "col_orders_user", toColumnId: "col_users_id" },
    { fromColumnId: "col_orders_tenant", toColumnId: "col_users_tenant" },
  ],
});

/*
 * Orders hold a composite foreign key to users; categories reference
 * themselves. The self relation targets a column that is neither a primary key
 * nor unique, so it is the only relation with an issue.
 */
function createDocument(positions: TablePositions): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_users",
        position: positions.users,
        primaryKeyColumnIds: ["col_users_id", "col_users_tenant"],
      }),
      makeTable({ id: "tbl_orders", position: positions.orders }),
      makeTable({ id: "tbl_categories", position: { x: 800, y: 0 } }),
    ],
    columns: [
      makeColumn({ id: "col_users_id", tableId: "tbl_users" }),
      makeColumn({ id: "col_users_tenant", tableId: "tbl_users" }),
      makeColumn({ id: "col_orders_user", tableId: "tbl_orders" }),
      makeColumn({ id: "col_orders_tenant", tableId: "tbl_orders" }),
      makeColumn({ id: "col_categories_code", tableId: "tbl_categories" }),
      makeColumn({ id: "col_categories_parent", tableId: "tbl_categories" }),
    ],
    relations: [
      ORDERS_USERS_RELATION,
      makeRelation({
        id: "rel_categories_parent",
        fromTableId: "tbl_categories",
        toTableId: "tbl_categories",
        columnPairs: [
          {
            fromColumnId: "col_categories_parent",
            toColumnId: "col_categories_code",
          },
        ],
      }),
    ],
  });
}

function deriveEdges(
  document: SchemaDocument,
  previousEdges: readonly RelationEdge[],
): readonly RelationEdge[] {
  return toRelationEdges({
    relations: document.relations,
    tables: document.tables,
    selection: EMPTY_SELECTION,
    issueIndex: getIssueIndex(document),
    previousEdges,
  });
}

describe("toRelationEdges", () => {
  it("creates one edge per relation, even for a composite foreign key", () => {
    const edges = deriveEdges(createDocument(USERS_LEFT_OF_ORDERS), []);

    expect(
      edges.map((edge) => [
        edge.id,
        edge.type,
        edge.source,
        edge.target,
        edge.data?.columnPairCount,
      ]),
    ).toEqual([
      [
        "rel_categories_parent",
        RELATION_EDGE_TYPE,
        "tbl_categories",
        "tbl_categories",
        1,
      ],
      ["rel_orders_users", RELATION_EDGE_TYPE, "tbl_orders", "tbl_users", 2],
    ]);
  });

  it("uses the handles of the first column pair", () => {
    const edges = deriveEdges(createDocument(USERS_LEFT_OF_ORDERS), []);

    expect([edges[1]?.sourceHandle, edges[1]?.targetHandle]).toEqual([
      "column:col_orders_user:left",
      "column:col_users_id:right",
    ]);
  });

  it("connects the right edge to the left edge when the from table is to the left", () => {
    const document = createDocument({
      users: { x: 400, y: 0 },
      orders: { x: 0, y: 0 },
    });

    const edges = deriveEdges(document, []);

    expect([edges[1]?.sourceHandle, edges[1]?.targetHandle]).toEqual([
      "column:col_orders_user:right",
      "column:col_users_id:left",
    ]);
  });

  it("uses the right side on both ends of a self relation", () => {
    const edges = deriveEdges(createDocument(USERS_LEFT_OF_ORDERS), []);

    expect([edges[0]?.sourceHandle, edges[0]?.targetHandle]).toEqual([
      "column:col_categories_parent:right",
      "column:col_categories_code:right",
    ]);
  });

  it("marks an edge whose relation has an issue", () => {
    const edges = deriveEdges(createDocument(USERS_LEFT_OF_ORDERS), []);

    expect(edges.map((edge) => [edge.id, edge.data?.hasIssue])).toEqual([
      ["rel_categories_parent", true],
      ["rel_orders_users", false],
    ]);
  });

  it("marks a selected edge", () => {
    const document = createDocument(USERS_LEFT_OF_ORDERS);

    const edges = toRelationEdges({
      relations: document.relations,
      tables: document.tables,
      selection: { tableIds: [], relationIds: ["rel_orders_users"] },
      issueIndex: getIssueIndex(document),
      previousEdges: [],
    });

    expect(edges.map((edge) => [edge.id, edge.selected])).toEqual([
      ["rel_categories_parent", false],
      ["rel_orders_users", true],
    ]);
  });

  it("reuses the edge object of an unchanged relation", () => {
    const previousEdges = deriveEdges(createDocument(USERS_LEFT_OF_ORDERS), []);

    const edges = deriveEdges(
      createDocument({ users: { x: 0, y: 200 }, orders: { x: 400, y: 0 } }),
      previousEdges,
    );

    expect(edges[1]).toBe(previousEdges[1]);
  });

  it("reuses the whole array when nothing changed", () => {
    const previousEdges = deriveEdges(createDocument(USERS_LEFT_OF_ORDERS), []);

    const edges = deriveEdges(
      createDocument(USERS_LEFT_OF_ORDERS),
      previousEdges,
    );

    expect(edges).toBe(previousEdges);
  });

  it("creates a new edge when one of its tables moved", () => {
    const previousEdges = deriveEdges(createDocument(USERS_LEFT_OF_ORDERS), []);

    const edges = deriveEdges(
      createDocument({ users: { x: 800, y: 0 }, orders: { x: 400, y: 0 } }),
      previousEdges,
    );

    expect(edges[1]).not.toBe(previousEdges[1]);
  });

  it.each<[string, (baseline: ToRelationEdgesInput) => ToRelationEdgesInput]>([
    [
      "selection",
      (baseline) => ({
        ...baseline,
        selection: { tableIds: [], relationIds: ["rel_orders_users"] },
      }),
    ],
    [
      "issue presence",
      (baseline) => ({
        ...baseline,
        issueIndex: { ...baseline.issueIndex, countOfElement: () => 1 },
      }),
    ],
    [
      "kind",
      (baseline) => ({
        ...baseline,
        relations: {
          ...baseline.relations,
          rel_orders_users: { ...ORDERS_USERS_RELATION, kind: "oneToOne" },
        },
      }),
    ],
    [
      "column pair count",
      (baseline) => ({
        ...baseline,
        relations: {
          ...baseline.relations,
          rel_orders_users: {
            ...ORDERS_USERS_RELATION,
            columnPairs: ORDERS_USERS_RELATION.columnPairs.slice(0, 1),
          },
        },
      }),
    ],
  ])("creates a new edge when its %s changed", (_change, applyChange) => {
    const document = createDocument(USERS_LEFT_OF_ORDERS);
    const baseline: ToRelationEdgesInput = {
      relations: document.relations,
      tables: document.tables,
      selection: EMPTY_SELECTION,
      issueIndex: getIssueIndex(document),
      previousEdges: [],
    };
    const previousEdges = toRelationEdges(baseline);

    const edges = toRelationEdges({
      ...applyChange(baseline),
      previousEdges,
    });

    expect(edges[1]).not.toBe(previousEdges[1]);
  });

  it("skips a relation without a column pair", () => {
    const document = createDocument(USERS_LEFT_OF_ORDERS);

    const edges = toRelationEdges({
      relations: {
        ...document.relations,
        rel_orders_users: { ...ORDERS_USERS_RELATION, columnPairs: [] },
      },
      tables: document.tables,
      selection: EMPTY_SELECTION,
      issueIndex: getIssueIndex(document),
      previousEdges: [],
    });

    expect(edges.map((edge) => edge.id)).toEqual(["rel_categories_parent"]);
  });

  it("skips a relation whose table is missing", () => {
    const document = createDocument(USERS_LEFT_OF_ORDERS);
    const tablesWithoutUsers = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders" }),
        makeTable({ id: "tbl_categories" }),
      ],
    }).tables;

    const edges = toRelationEdges({
      relations: document.relations,
      tables: tablesWithoutUsers,
      selection: EMPTY_SELECTION,
      issueIndex: getIssueIndex(document),
      previousEdges: [],
    });

    expect(edges.map((edge) => edge.id)).toEqual(["rel_categories_parent"]);
  });
});
