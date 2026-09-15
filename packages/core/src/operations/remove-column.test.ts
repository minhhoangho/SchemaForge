import { describe, expect, it } from "vitest";

import {
  buildSchema,
  makeColumn,
  makeIndex,
  makeRelation,
  makeTable,
} from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import { applyColumnOperation } from "./column-operations.js";

describe("removeColumn", () => {
  it("removes the column from the table column list", () => {
    const table = makeTable({ id: "tbl_users" });
    const columnA = makeColumn({ id: "col_a", tableId: "tbl_users" });
    const columnB = makeColumn({ id: "col_b", tableId: "tbl_users" });
    const columnC = makeColumn({ id: "col_c", tableId: "tbl_users" });
    const schema = buildSchema({
      tables: [table],
      columns: [columnA, columnB, columnC],
    });

    const result = unwrapOk(
      applyColumnOperation(schema, { type: "removeColumn", columnId: "col_b" }),
    );

    expect(result.schema).toStrictEqual(
      buildSchema({ tables: [table], columns: [columnA, columnC] }),
    );
  });

  it("removes the column from the primary key", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_a", "col_b"] }),
      ],
      columns: [
        makeColumn({ id: "col_a", tableId: "tbl_users" }),
        makeColumn({ id: "col_b", tableId: "tbl_users" }),
      ],
    });

    const result = unwrapOk(
      applyColumnOperation(schema, { type: "removeColumn", columnId: "col_b" }),
    );

    expect(result.schema.tables.tbl_users?.primaryKeyColumnIds).toStrictEqual([
      "col_a",
    ]);
  });

  it("removes every index that contains the column, including multi-column indexes", () => {
    const otherIndex = makeIndex({
      id: "idx_other",
      tableId: "tbl_users",
      columnIds: ["col_a"],
    });
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({ id: "col_a", tableId: "tbl_users" }),
        makeColumn({ id: "col_b", tableId: "tbl_users" }),
      ],
      indexes: [
        makeIndex({
          id: "idx_single",
          tableId: "tbl_users",
          columnIds: ["col_b"],
        }),
        makeIndex({
          id: "idx_multi",
          tableId: "tbl_users",
          columnIds: ["col_a", "col_b"],
        }),
        otherIndex,
      ],
    });

    const result = unwrapOk(
      applyColumnOperation(schema, { type: "removeColumn", columnId: "col_b" }),
    );

    expect(result.schema.indexes).toStrictEqual({ idx_other: otherIndex });
  });

  it("removes every relation that uses the column on either side", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" }), makeTable({ id: "tbl_posts" })],
      columns: [
        makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
        makeColumn({ id: "col_author_id", tableId: "tbl_posts" }),
      ],
      relations: [
        makeRelation({
          id: "rel_to_side",
          fromTableId: "tbl_posts",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_author_id", toColumnId: "col_user_id" },
          ],
        }),
        makeRelation({
          id: "rel_from_side",
          fromTableId: "tbl_users",
          toTableId: "tbl_posts",
          columnPairs: [
            { fromColumnId: "col_user_id", toColumnId: "col_author_id" },
          ],
        }),
      ],
    });

    const result = unwrapOk(
      applyColumnOperation(schema, {
        type: "removeColumn",
        columnId: "col_user_id",
      }),
    );

    expect(result.schema.relations).toStrictEqual({});
  });

  it("keeps other indexes and relations of the table", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({ id: "col_a", tableId: "tbl_users" }),
        makeColumn({ id: "col_b", tableId: "tbl_users" }),
        makeColumn({ id: "col_c", tableId: "tbl_users" }),
      ],
      indexes: [
        makeIndex({ id: "idx_a", tableId: "tbl_users", columnIds: ["col_a"] }),
        makeIndex({ id: "idx_b", tableId: "tbl_users", columnIds: ["col_b"] }),
      ],
      relations: [
        makeRelation({
          id: "rel_kept",
          fromTableId: "tbl_users",
          toTableId: "tbl_users",
          columnPairs: [{ fromColumnId: "col_c", toColumnId: "col_a" }],
        }),
        makeRelation({
          id: "rel_removed",
          fromTableId: "tbl_users",
          toTableId: "tbl_users",
          columnPairs: [{ fromColumnId: "col_b", toColumnId: "col_a" }],
        }),
      ],
    });

    const result = unwrapOk(
      applyColumnOperation(schema, { type: "removeColumn", columnId: "col_b" }),
    );

    expect(result.schema.indexes.idx_a).toBe(schema.indexes.idx_a);
    expect(result.schema.relations.rel_kept).toBe(schema.relations.rel_kept);
  });

  it("keeps other tables and the index and relation maps by reference when nothing depends on the column", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" }), makeTable({ id: "tbl_posts" })],
      columns: [
        makeColumn({ id: "col_a", tableId: "tbl_users" }),
        makeColumn({ id: "col_b", tableId: "tbl_users" }),
        makeColumn({ id: "col_author_id", tableId: "tbl_posts" }),
      ],
      indexes: [
        makeIndex({ id: "idx_a", tableId: "tbl_users", columnIds: ["col_a"] }),
      ],
      relations: [
        makeRelation({
          id: "rel_author",
          fromTableId: "tbl_posts",
          toTableId: "tbl_users",
          columnPairs: [{ fromColumnId: "col_author_id", toColumnId: "col_a" }],
        }),
      ],
    });

    const result = unwrapOk(
      applyColumnOperation(schema, { type: "removeColumn", columnId: "col_b" }),
    );

    expect(result.schema.tables.tbl_posts).toBe(schema.tables.tbl_posts);
    expect(result.schema.indexes).toBe(schema.indexes);
    expect(result.schema.relations).toBe(schema.relations);
  });

  it("returns a batch inverse with addColumn at the previous index", () => {
    const columnB = makeColumn({ id: "col_b", tableId: "tbl_users" });
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({ id: "col_a", tableId: "tbl_users" }),
        columnB,
        makeColumn({ id: "col_c", tableId: "tbl_users" }),
      ],
    });

    const result = unwrapOk(
      applyColumnOperation(schema, { type: "removeColumn", columnId: "col_b" }),
    );

    expect(result.inverse).toStrictEqual({
      type: "batch",
      operations: [{ type: "addColumn", column: columnB, insertAt: 1 }],
    });
  });

  it.each([
    {
      columnId: "col_a",
      expectedSteps: [
        {
          type: "addColumn",
          column: makeColumn({ id: "col_a", tableId: "tbl_users" }),
          insertAt: 0,
        },
        {
          type: "setPrimaryKey",
          tableId: "tbl_users",
          columnIds: ["col_b", "col_a"],
        },
      ],
    },
    {
      columnId: "col_c",
      expectedSteps: [
        {
          type: "addColumn",
          column: makeColumn({ id: "col_c", tableId: "tbl_users" }),
          insertAt: 2,
        },
      ],
    },
  ] as const)(
    "includes setPrimaryKey in the inverse only when the column was in the primary key: $columnId",
    ({ columnId, expectedSteps }) => {
      const schema = buildSchema({
        tables: [
          makeTable({
            id: "tbl_users",
            primaryKeyColumnIds: ["col_b", "col_a"],
          }),
        ],
        columns: [
          makeColumn({ id: "col_a", tableId: "tbl_users" }),
          makeColumn({ id: "col_b", tableId: "tbl_users" }),
          makeColumn({ id: "col_c", tableId: "tbl_users" }),
        ],
      });

      const result = unwrapOk(
        applyColumnOperation(schema, { type: "removeColumn", columnId }),
      );

      expect(result.inverse).toStrictEqual({
        type: "batch",
        operations: expectedSteps,
      });
    },
  );

  it("orders re-added indexes and relations by id in the inverse", () => {
    const columnA = makeColumn({ id: "col_a", tableId: "tbl_users" });
    const firstIndex = makeIndex({
      id: "idx_1",
      tableId: "tbl_users",
      columnIds: ["col_b", "col_a"],
    });
    const secondIndex = makeIndex({
      id: "idx_2",
      tableId: "tbl_users",
      columnIds: ["col_a"],
    });
    const firstRelation = makeRelation({
      id: "rel_1",
      fromTableId: "tbl_users",
      toTableId: "tbl_users",
      columnPairs: [{ fromColumnId: "col_a", toColumnId: "col_b" }],
    });
    const secondRelation = makeRelation({
      id: "rel_2",
      fromTableId: "tbl_users",
      toTableId: "tbl_users",
      columnPairs: [{ fromColumnId: "col_b", toColumnId: "col_a" }],
    });
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_a"] })],
      columns: [columnA, makeColumn({ id: "col_b", tableId: "tbl_users" })],
      indexes: [secondIndex, firstIndex],
      relations: [secondRelation, firstRelation],
    });

    const result = unwrapOk(
      applyColumnOperation(schema, { type: "removeColumn", columnId: "col_a" }),
    );

    expect(result.inverse).toStrictEqual({
      type: "batch",
      operations: [
        { type: "addColumn", column: columnA, insertAt: 0 },
        { type: "setPrimaryKey", tableId: "tbl_users", columnIds: ["col_a"] },
        { type: "addIndex", index: firstIndex },
        { type: "addIndex", index: secondIndex },
        { type: "addRelation", relation: firstRelation },
        { type: "addRelation", relation: secondRelation },
      ],
    });
  });

  it("rejects removeColumn with column-not-found", () => {
    const schema = buildSchema({ tables: [makeTable({ id: "tbl_users" })] });

    const error = unwrapError(
      applyColumnOperation(schema, {
        type: "removeColumn",
        columnId: "col_missing",
      }),
    );

    expect(error).toStrictEqual({
      code: "column-not-found",
      path: ["columnId"],
    });
  });
});
