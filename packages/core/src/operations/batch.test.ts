import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../model/schema-document.js";
import { buildSchema, makeColumn, makeTable } from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import { applyOperation } from "./apply-operation.js";
import { applyBatch } from "./batch.js";
import type { BatchOperation, OperationOfType } from "./operation.js";

const USERS_TABLE = makeTable({
  id: "tbl_users",
  primaryKeyColumnIds: ["col_users_id"],
});

const USERS_ID_COLUMN = makeColumn({
  id: "col_users_id",
  tableId: "tbl_users",
});

const ADD_ORDERS_TABLE: OperationOfType<"addTable"> = {
  type: "addTable",
  table: {
    id: "tbl_orders",
    name: "orders",
    comment: "",
    position: { x: 0, y: 0 },
    subjectAreaId: null,
  },
};

const ADD_ORDERS_ID_COLUMN: OperationOfType<"addColumn"> = {
  type: "addColumn",
  column: makeColumn({ id: "col_orders_id", tableId: "tbl_orders" }),
  insertAt: 0,
};

function buildUsersSchema(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [USERS_TABLE],
    columns: [USERS_ID_COLUMN],
  });
}

describe("applyBatch", () => {
  it("applies steps in order on the result of the previous step", () => {
    const operation: BatchOperation = {
      type: "batch",
      operations: [
        ADD_ORDERS_TABLE,
        ADD_ORDERS_ID_COLUMN,
        {
          type: "setPrimaryKey",
          tableId: "tbl_orders",
          columnIds: ["col_orders_id"],
        },
      ],
    };

    const applied = unwrapOk(
      applyBatch(buildUsersSchema(), operation, applyOperation),
    );

    expect(applied.schema).toStrictEqual(
      buildSchema({
        name: "shop",
        tables: [
          USERS_TABLE,
          makeTable({
            id: "tbl_orders",
            primaryKeyColumnIds: ["col_orders_id"],
          }),
        ],
        columns: [USERS_ID_COLUMN, ADD_ORDERS_ID_COLUMN.column],
      }),
    );
  });

  it("returns an error whose path starts with operations and the failing step index", () => {
    const operation: BatchOperation = {
      type: "batch",
      operations: [
        ADD_ORDERS_TABLE,
        { type: "removeColumn", columnId: "col_missing" },
      ],
    };

    const error = unwrapError(
      applyBatch(buildUsersSchema(), operation, applyOperation),
    );

    expect(error).toStrictEqual({
      code: "column-not-found",
      path: ["operations", 1, "columnId"],
    });
  });

  it("keeps the original schema unchanged when a middle step fails", () => {
    const schema = buildUsersSchema();
    const operation: BatchOperation = {
      type: "batch",
      operations: [
        ADD_ORDERS_TABLE,
        { type: "removeTable", tableId: "tbl_missing" },
        { type: "renameSchema", name: "store" },
      ],
    };

    const result = applyBatch(schema, operation, applyOperation);

    expect(result).toStrictEqual({
      isOk: false,
      error: { code: "table-not-found", path: ["operations", 1, "tableId"] },
    });
    expect(schema).toStrictEqual(buildUsersSchema());
  });

  it("prefixes the path at every level for a nested batch error", () => {
    const operation: BatchOperation = {
      type: "batch",
      operations: [
        { type: "renameSchema", name: "store" },
        {
          type: "batch",
          operations: [
            ADD_ORDERS_TABLE,
            {
              type: "batch",
              operations: [{ type: "removeIndex", indexId: "idx_missing" }],
            },
          ],
        },
      ],
    };

    const error = unwrapError(
      applyBatch(buildUsersSchema(), operation, applyOperation),
    );

    expect(error).toStrictEqual({
      code: "index-not-found",
      path: ["operations", 1, "operations", 1, "operations", 0, "indexId"],
    });
  });

  it("returns the inverses of the steps in reverse order", () => {
    const operation: BatchOperation = {
      type: "batch",
      operations: [
        { type: "renameSchema", name: "store" },
        ADD_ORDERS_TABLE,
        {
          type: "updateTable",
          tableId: "tbl_users",
          changes: { comment: "people" },
        },
      ],
    };

    const applied = unwrapOk(
      applyBatch(buildUsersSchema(), operation, applyOperation),
    );

    expect(applied.inverse).toStrictEqual({
      type: "batch",
      operations: [
        { type: "updateTable", tableId: "tbl_users", changes: { comment: "" } },
        { type: "removeTable", tableId: "tbl_orders" },
        { type: "renameSchema", name: "shop" },
      ],
    });
  });

  it("flattens a step inverse that is itself a batch", () => {
    const operation: BatchOperation = {
      type: "batch",
      operations: [
        { type: "batch", operations: [ADD_ORDERS_TABLE, ADD_ORDERS_ID_COLUMN] },
        { type: "removeColumn", columnId: "col_users_id" },
      ],
    };

    const applied = unwrapOk(
      applyBatch(buildUsersSchema(), operation, applyOperation),
    );

    expect(applied.inverse).toStrictEqual({
      type: "batch",
      operations: [
        { type: "addColumn", column: USERS_ID_COLUMN, insertAt: 0 },
        {
          type: "setPrimaryKey",
          tableId: "tbl_users",
          columnIds: ["col_users_id"],
        },
        { type: "removeColumn", columnId: "col_orders_id" },
        { type: "removeTable", tableId: "tbl_orders" },
      ],
    });
  });

  it("returns the same schema reference and an empty batch inverse for an empty batch", () => {
    const schema = buildUsersSchema();

    const applied = unwrapOk(
      applyBatch(schema, { type: "batch", operations: [] }, applyOperation),
    );

    expect(applied.schema).toBe(schema);
    expect(applied.inverse).toStrictEqual({ type: "batch", operations: [] });
  });
});
