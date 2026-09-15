import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeIndex,
  makeRelation,
  makeSubjectArea,
  makeTable,
} from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import { applyTableOperation } from "./table-operations.js";

// users <- orders -> products, plus a self-referencing relation on users.
function buildShopSchema(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_users",
        comment: "people",
        position: { x: 40, y: 80 },
        subjectAreaId: "area_accounts",
        primaryKeyColumnIds: ["col_user_id"],
      }),
      makeTable({ id: "tbl_orders", primaryKeyColumnIds: ["col_order_id"] }),
      makeTable({
        id: "tbl_products",
        primaryKeyColumnIds: ["col_product_id"],
      }),
    ],
    columns: [
      makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
      makeColumn({ id: "col_user_email", tableId: "tbl_users" }),
      makeColumn({
        id: "col_user_referrer_id",
        tableId: "tbl_users",
        isNullable: true,
      }),
      makeColumn({ id: "col_order_id", tableId: "tbl_orders" }),
      makeColumn({ id: "col_order_user_id", tableId: "tbl_orders" }),
      makeColumn({ id: "col_order_product_id", tableId: "tbl_orders" }),
      makeColumn({ id: "col_product_id", tableId: "tbl_products" }),
      makeColumn({ id: "col_product_sku", tableId: "tbl_products" }),
    ],
    indexes: [
      makeIndex({
        id: "idx_user_email",
        tableId: "tbl_users",
        columnIds: ["col_user_email"],
        isUnique: true,
      }),
      makeIndex({
        id: "idx_order_user",
        tableId: "tbl_orders",
        columnIds: ["col_order_user_id"],
      }),
      makeIndex({
        id: "idx_product_sku",
        tableId: "tbl_products",
        columnIds: ["col_product_sku"],
      }),
    ],
    relations: [
      makeRelation({
        id: "rel_order_user",
        fromTableId: "tbl_orders",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_order_user_id", toColumnId: "col_user_id" },
        ],
      }),
      makeRelation({
        id: "rel_order_product",
        fromTableId: "tbl_orders",
        toTableId: "tbl_products",
        columnPairs: [
          {
            fromColumnId: "col_order_product_id",
            toColumnId: "col_product_id",
          },
        ],
      }),
      makeRelation({
        id: "rel_user_referrer",
        fromTableId: "tbl_users",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_user_referrer_id", toColumnId: "col_user_id" },
        ],
      }),
    ],
    subjectAreas: [makeSubjectArea({ id: "area_accounts" })],
  });
}

describe("removeTable", () => {
  it("removes the table and all of its columns", () => {
    const schema = buildShopSchema();

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "removeTable",
        tableId: "tbl_users",
      }),
    );

    expect(Object.keys(result.schema.tables).toSorted()).toStrictEqual([
      "tbl_orders",
      "tbl_products",
    ]);
    expect(Object.keys(result.schema.columns).toSorted()).toStrictEqual([
      "col_order_id",
      "col_order_product_id",
      "col_order_user_id",
      "col_product_id",
      "col_product_sku",
    ]);
  });

  it("removes indexes of the removed table", () => {
    const schema = buildShopSchema();

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "removeTable",
        tableId: "tbl_users",
      }),
    );

    expect(Object.keys(result.schema.indexes).toSorted()).toStrictEqual([
      "idx_order_user",
      "idx_product_sku",
    ]);
  });

  it("removes relations that point to the removed table", () => {
    const schema = buildShopSchema();

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "removeTable",
        tableId: "tbl_products",
      }),
    );

    expect(Object.keys(result.schema.relations).toSorted()).toStrictEqual([
      "rel_order_user",
      "rel_user_referrer",
    ]);
  });

  it("removes relations that point from the removed table", () => {
    const schema = buildShopSchema();

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "removeTable",
        tableId: "tbl_orders",
      }),
    );

    expect(Object.keys(result.schema.relations)).toStrictEqual([
      "rel_user_referrer",
    ]);
  });

  it("keeps unrelated tables, columns, indexes and relations by reference", () => {
    const schema = buildShopSchema();

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "removeTable",
        tableId: "tbl_users",
      }),
    );

    expect(result.schema.tables.tbl_products).toBe(schema.tables.tbl_products);
    expect(result.schema.columns.col_product_sku).toBe(
      schema.columns.col_product_sku,
    );
    expect(result.schema.indexes.idx_product_sku).toBe(
      schema.indexes.idx_product_sku,
    );
    expect(result.schema.relations.rel_order_product).toBe(
      schema.relations.rel_order_product,
    );
    expect(result.schema.subjectAreas).toBe(schema.subjectAreas);
  });

  it("keeps the columns, indexes and relations maps by reference when nothing depends on the table", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" }), makeTable({ id: "tbl_tags" })],
      columns: [makeColumn({ id: "col_user_id", tableId: "tbl_users" })],
      indexes: [
        makeIndex({
          id: "idx_user_id",
          tableId: "tbl_users",
          columnIds: ["col_user_id"],
        }),
      ],
    });

    const result = unwrapOk(
      applyTableOperation(schema, { type: "removeTable", tableId: "tbl_tags" }),
    );

    expect(result.schema.columns).toBe(schema.columns);
    expect(result.schema.indexes).toBe(schema.indexes);
    expect(result.schema.relations).toBe(schema.relations);
  });

  it("returns a batch inverse that re-adds the table, columns in order, primary key, indexes and relations", () => {
    const schema = buildShopSchema();

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "removeTable",
        tableId: "tbl_users",
      }),
    );

    expect(result.inverse).toStrictEqual({
      type: "batch",
      operations: [
        {
          type: "addTable",
          table: {
            id: "tbl_users",
            name: "users",
            comment: "people",
            position: { x: 40, y: 80 },
            subjectAreaId: "area_accounts",
          },
        },
        {
          type: "addColumn",
          column: schema.columns.col_user_id,
          insertAt: 0,
        },
        {
          type: "addColumn",
          column: schema.columns.col_user_email,
          insertAt: 1,
        },
        {
          type: "addColumn",
          column: schema.columns.col_user_referrer_id,
          insertAt: 2,
        },
        {
          type: "setPrimaryKey",
          tableId: "tbl_users",
          columnIds: ["col_user_id"],
        },
        { type: "addIndex", index: schema.indexes.idx_user_email },
        { type: "addRelation", relation: schema.relations.rel_order_user },
        { type: "addRelation", relation: schema.relations.rel_user_referrer },
      ],
    });
  });

  it("orders re-added indexes and relations by id in the inverse", () => {
    const column = makeColumn({ id: "col_parent_id", tableId: "tbl_nodes" });
    const indexB = makeIndex({
      id: "idx_b",
      tableId: "tbl_nodes",
      columnIds: ["col_parent_id"],
    });
    const indexA = makeIndex({
      id: "idx_a",
      tableId: "tbl_nodes",
      columnIds: ["col_parent_id"],
    });
    const selfRelation = {
      fromTableId: "tbl_nodes",
      toTableId: "tbl_nodes",
      columnPairs: [
        { fromColumnId: "col_parent_id", toColumnId: "col_parent_id" },
      ],
    } as const;
    const relationB = makeRelation({ id: "rel_b", ...selfRelation });
    const relationA = makeRelation({ id: "rel_a", ...selfRelation });
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_nodes" })],
      columns: [column],
      indexes: [indexB, indexA],
      relations: [relationB, relationA],
    });

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "removeTable",
        tableId: "tbl_nodes",
      }),
    );

    expect(result.inverse).toStrictEqual({
      type: "batch",
      operations: [
        {
          type: "addTable",
          table: {
            id: "tbl_nodes",
            name: "nodes",
            comment: "",
            position: { x: 0, y: 0 },
            subjectAreaId: null,
          },
        },
        { type: "addColumn", column, insertAt: 0 },
        { type: "setPrimaryKey", tableId: "tbl_nodes", columnIds: [] },
        { type: "addIndex", index: indexA },
        { type: "addIndex", index: indexB },
        { type: "addRelation", relation: relationA },
        { type: "addRelation", relation: relationB },
      ],
    });
  });

  it("includes setPrimaryKey in the inverse even when the primary key is empty", () => {
    const schema = buildSchema({ tables: [makeTable({ id: "tbl_logs" })] });

    const result = unwrapOk(
      applyTableOperation(schema, { type: "removeTable", tableId: "tbl_logs" }),
    );

    expect(result.inverse).toStrictEqual({
      type: "batch",
      operations: [
        {
          type: "addTable",
          table: {
            id: "tbl_logs",
            name: "logs",
            comment: "",
            position: { x: 0, y: 0 },
            subjectAreaId: null,
          },
        },
        { type: "setPrimaryKey", tableId: "tbl_logs", columnIds: [] },
      ],
    });
  });

  it("rejects removeTable with table-not-found", () => {
    const schema = buildShopSchema();

    const error = unwrapError(
      applyTableOperation(schema, {
        type: "removeTable",
        tableId: "tbl_missing",
      }),
    );

    expect(error).toStrictEqual({ code: "table-not-found", path: ["tableId"] });
  });
});
