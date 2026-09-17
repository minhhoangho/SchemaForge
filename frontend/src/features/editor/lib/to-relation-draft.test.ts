import type { SchemaDocument } from "@schemaforge/core";
import { buildSchema, makeColumn, makeTable } from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { formatColumnHandleId, formatTableHandleId } from "./handle-ids";
import {
  changePairedColumn,
  changeReferencedColumn,
  changeTargetTable,
  createRelationDraftFromConnection,
  createRelationDraftFromTable,
  swapRelationDraft,
} from "./to-relation-draft";

function createDocument(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_users",
        name: "users",
        primaryKeyColumnIds: ["col_users_id"],
      }),
      makeTable({
        id: "tbl_orders",
        name: "orders",
        primaryKeyColumnIds: ["col_orders_id"],
      }),
      makeTable({ id: "tbl_logs", name: "logs" }),
    ],
    columns: [
      makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
      makeColumn({
        id: "col_users_email",
        tableId: "tbl_users",
        name: "email",
      }),
      makeColumn({ id: "col_orders_id", tableId: "tbl_orders", name: "id" }),
      makeColumn({
        id: "col_orders_user_id",
        tableId: "tbl_orders",
        name: "user_id",
      }),
      makeColumn({ id: "col_logs_text", tableId: "tbl_logs", name: "text" }),
    ],
  });
}

const TABLE_CONNECTION = {
  source: "tbl_orders",
  target: "tbl_users",
  sourceHandle: formatTableHandleId("tbl_orders", "right"),
  targetHandle: formatTableHandleId("tbl_users", "left"),
} as const;

describe("createRelationDraftFromConnection", () => {
  it("fills the referenced column from the target column handle", () => {
    const draft = createRelationDraftFromConnection(createDocument(), {
      ...TABLE_CONNECTION,
      targetHandle: formatColumnHandleId("col_users_email", "left"),
    });

    expect(draft).toMatchObject({
      fromTableId: "tbl_orders",
      toTableId: "tbl_users",
      referencedColumnIds: ["col_users_email"],
    });
  });

  it("falls back to the primary key when dropping on the table handle", () => {
    const draft = createRelationDraftFromConnection(
      createDocument(),
      TABLE_CONNECTION,
    );

    expect(draft?.referencedColumnIds).toStrictEqual(["col_users_id"]);
  });

  it("uses existing columns when dragging from a column handle", () => {
    const draft = createRelationDraftFromConnection(createDocument(), {
      ...TABLE_CONNECTION,
      sourceHandle: formatColumnHandleId("col_orders_user_id", "right"),
    });

    expect(draft).toMatchObject({
      foreignKeyMode: "existing-columns",
      columnPairs: [
        { fromColumnId: "col_orders_user_id", toColumnId: "col_users_id" },
      ],
    });
  });

  it("uses new columns when dragging from the table handle", () => {
    const draft = createRelationDraftFromConnection(
      createDocument(),
      TABLE_CONNECTION,
    );

    expect(draft).toStrictEqual({
      fromTableId: "tbl_orders",
      toTableId: "tbl_users",
      kind: "oneToMany",
      foreignKeyMode: "new-columns",
      referencedColumnIds: ["col_users_id"],
      columnPairs: [],
      junctionTableName: "orders_users",
      onDelete: "noAction",
      onUpdate: "noAction",
    });
  });

  it("suggests a junction table name from both tables", () => {
    const document = buildSchema({
      tables: [
        makeTable({ id: "tbl_users", name: "users" }),
        makeTable({ id: "tbl_orders", name: "orders" }),
        makeTable({ id: "tbl_junction", name: "orders_users" }),
      ],
    });

    const draft = createRelationDraftFromConnection(document, {
      ...TABLE_CONNECTION,
      sourceHandle: formatTableHandleId("tbl_orders", "right"),
    });

    expect(draft?.junctionTableName).toBe("orders_users_2");
  });

  it("returns null for an unparsable handle", () => {
    const draft = createRelationDraftFromConnection(createDocument(), {
      ...TABLE_CONNECTION,
      sourceHandle: "column:broken",
    });

    expect(draft).toBeNull();
  });

  it.each([
    ["a missing target handle", { targetHandle: null }],
    ["an unknown target table", { target: "tbl_missing" }],
    [
      "a column of another table",
      { targetHandle: formatColumnHandleId("col_orders_id", "left") },
    ],
  ])("returns null for %s", (_case, override) => {
    const draft = createRelationDraftFromConnection(createDocument(), {
      ...TABLE_CONNECTION,
      ...override,
    });

    expect(draft).toBeNull();
  });
});

describe("createRelationDraftFromTable", () => {
  it("builds a draft from the add relation button", () => {
    const draft = createRelationDraftFromTable(createDocument(), "tbl_users");

    expect(draft).toStrictEqual({
      fromTableId: "tbl_users",
      toTableId: "tbl_logs",
      kind: "oneToMany",
      foreignKeyMode: "new-columns",
      referencedColumnIds: [],
      columnPairs: [],
      junctionTableName: "users_logs",
      onDelete: "noAction",
      onUpdate: "noAction",
    });
  });

  it("builds a self relation when the document has no other table", () => {
    const document = buildSchema({
      tables: [makeTable({ id: "tbl_users", name: "users" })],
    });

    expect(createRelationDraftFromTable(document, "tbl_users")).toMatchObject({
      fromTableId: "tbl_users",
      toTableId: "tbl_users",
    });
  });

  it("returns null for a table the document does not hold", () => {
    const document = buildSchema({
      tables: [makeTable({ id: "tbl_users", name: "users" })],
    });

    expect(createRelationDraftFromTable(document, "tbl_missing")).toBeNull();
  });
});

describe("draft changes", () => {
  it("swaps both tables and rebuilds the defaults", () => {
    const document = createDocument();
    const draft = createRelationDraftFromConnection(document, {
      ...TABLE_CONNECTION,
      sourceHandle: formatColumnHandleId("col_orders_user_id", "right"),
    });

    expect(draft && swapRelationDraft(document, draft)).toMatchObject({
      fromTableId: "tbl_users",
      toTableId: "tbl_orders",
      foreignKeyMode: "new-columns",
      referencedColumnIds: ["col_orders_id"],
      columnPairs: [],
      junctionTableName: "users_orders",
    });
  });

  it("keeps the kind when the target table changes", () => {
    const document = createDocument();
    const draft = createRelationDraftFromTable(document, "tbl_orders");

    const changed =
      draft &&
      changeTargetTable(document, { ...draft, kind: "oneToOne" }, "tbl_users");

    expect(changed).toMatchObject({
      kind: "oneToOne",
      toTableId: "tbl_users",
      referencedColumnIds: ["col_users_id"],
    });
  });

  it("moves the pair along when a referenced column changes", () => {
    const document = createDocument();
    const draft = createRelationDraftFromConnection(document, {
      ...TABLE_CONNECTION,
      sourceHandle: formatColumnHandleId("col_orders_user_id", "right"),
    });

    const changed =
      draft && changeReferencedColumn(draft, 0, "col_users_email");

    expect(changed).toMatchObject({
      referencedColumnIds: ["col_users_email"],
      columnPairs: [
        { fromColumnId: "col_orders_user_id", toColumnId: "col_users_email" },
      ],
    });
  });

  it("pairs a foreign key column with a referenced column", () => {
    const document = createDocument();
    const draft = createRelationDraftFromTable(document, "tbl_orders");
    const withTarget = draft && changeTargetTable(document, draft, "tbl_users");

    const changed =
      withTarget &&
      changePairedColumn(withTarget, "col_users_id", "col_orders_user_id");

    expect(changed?.columnPairs).toStrictEqual([
      { fromColumnId: "col_orders_user_id", toColumnId: "col_users_id" },
    ]);
  });
});
