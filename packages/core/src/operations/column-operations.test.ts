import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeRelation,
  makeTable,
} from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import type { ApplyResult } from "./apply-result.js";
import { applyColumnOperation } from "./column-operations.js";
import type { Operation } from "./operation.js";

// tbl_users with columns col_a, col_b and col_c, in that order.
function buildUsersSchema(): SchemaDocument {
  return buildSchema({
    tables: [makeTable({ id: "tbl_users" })],
    columns: [
      makeColumn({ id: "col_a", tableId: "tbl_users" }),
      makeColumn({ id: "col_b", tableId: "tbl_users" }),
      makeColumn({ id: "col_c", tableId: "tbl_users" }),
    ],
  });
}

// Inverses are typed as any Operation; these tests only apply column inverses.
function applyColumnInverse(
  schema: SchemaDocument,
  inverse: Operation,
): ApplyResult {
  if (
    inverse.type === "addColumn" ||
    inverse.type === "updateColumn" ||
    inverse.type === "moveColumn" ||
    inverse.type === "removeColumn"
  ) {
    return applyColumnOperation(schema, inverse);
  }
  throw new Error(`Expected a column operation, got ${inverse.type}`);
}

describe("addColumn", () => {
  it.each([
    {
      position: "start",
      insertAt: 0,
      expectedColumnIds: ["col_new", "col_a", "col_b", "col_c"],
    },
    {
      position: "middle",
      insertAt: 2,
      expectedColumnIds: ["col_a", "col_b", "col_new", "col_c"],
    },
    {
      position: "end",
      insertAt: 3,
      expectedColumnIds: ["col_a", "col_b", "col_c", "col_new"],
    },
  ])(
    "adds a column at the start, middle and end of the table: $position",
    ({ insertAt, expectedColumnIds }) => {
      const schema = buildUsersSchema();
      const column = makeColumn({ id: "col_new", tableId: "tbl_users" });

      const result = unwrapOk(
        applyColumnOperation(schema, { type: "addColumn", column, insertAt }),
      );

      expect(result.schema.tables.tbl_users?.columnIds).toStrictEqual(
        expectedColumnIds,
      );
      expect(result.schema.columns.col_new).toStrictEqual(column);
    },
  );

  it("returns removeColumn as the inverse of addColumn", () => {
    const schema = buildUsersSchema();
    const column = makeColumn({ id: "col_new", tableId: "tbl_users" });

    const result = unwrapOk(
      applyColumnOperation(schema, { type: "addColumn", column, insertAt: 1 }),
    );

    expect(result.inverse).toStrictEqual({
      type: "removeColumn",
      columnId: "col_new",
    });
  });

  it("restores the schema when the addColumn inverse is applied", () => {
    const schema = buildUsersSchema();
    const column = makeColumn({ id: "col_new", tableId: "tbl_users" });
    const added = unwrapOk(
      applyColumnOperation(schema, { type: "addColumn", column, insertAt: 1 }),
    );

    const restored = unwrapOk(applyColumnInverse(added.schema, added.inverse));

    expect(restored.schema).toStrictEqual(schema);
  });

  it("accepts addColumn with an enum type whose enum exists", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      enums: [makeEnum({ id: "enum_status" })],
    });
    const column = makeColumn({
      id: "col_status",
      tableId: "tbl_users",
      type: { kind: "enum", enumId: "enum_status" },
    });

    const result = unwrapOk(
      applyColumnOperation(schema, { type: "addColumn", column, insertAt: 0 }),
    );

    expect(result.schema.columns.col_status).toStrictEqual(column);
  });

  it("keeps other tables, columns, indexes and relations by reference when a column is added", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" }), makeTable({ id: "tbl_posts" })],
      columns: [
        makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
        makeColumn({ id: "col_author_id", tableId: "tbl_posts" }),
      ],
      indexes: [
        makeIndex({
          id: "idx_author",
          tableId: "tbl_posts",
          columnIds: ["col_author_id"],
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_author",
          fromTableId: "tbl_posts",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_author_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });
    const column = makeColumn({ id: "col_email", tableId: "tbl_users" });

    const result = unwrapOk(
      applyColumnOperation(schema, { type: "addColumn", column, insertAt: 1 }),
    );

    expect(result.schema.tables.tbl_posts).toBe(schema.tables.tbl_posts);
    expect(result.schema.columns.col_user_id).toBe(schema.columns.col_user_id);
    expect(result.schema.indexes).toBe(schema.indexes);
    expect(result.schema.relations).toBe(schema.relations);
  });

  it("rejects addColumn with id-already-exists", () => {
    const schema = buildUsersSchema();
    const column = makeColumn({ id: "col_a", tableId: "tbl_users" });

    const error = unwrapError(
      applyColumnOperation(schema, { type: "addColumn", column, insertAt: 0 }),
    );

    expect(error).toStrictEqual({
      code: "id-already-exists",
      path: ["column", "id"],
    });
  });

  it("reports id-already-exists before table-not-found for addColumn", () => {
    const schema = buildUsersSchema();
    const column = makeColumn({ id: "col_a", tableId: "tbl_missing" });

    const error = unwrapError(
      applyColumnOperation(schema, { type: "addColumn", column, insertAt: 0 }),
    );

    expect(error.code).toBe("id-already-exists");
  });

  it("rejects addColumn with table-not-found at column.tableId", () => {
    const schema = buildUsersSchema();
    const column = makeColumn({ id: "col_new", tableId: "tbl_missing" });

    const error = unwrapError(
      applyColumnOperation(schema, { type: "addColumn", column, insertAt: 0 }),
    );

    expect(error).toStrictEqual({
      code: "table-not-found",
      path: ["column", "tableId"],
    });
  });

  it("rejects addColumn with enum-not-found at column.type.enumId", () => {
    const schema = buildUsersSchema();
    const column = makeColumn({
      id: "col_new",
      tableId: "tbl_users",
      type: { kind: "enum", enumId: "enum_missing" },
    });

    const error = unwrapError(
      applyColumnOperation(schema, { type: "addColumn", column, insertAt: 0 }),
    );

    expect(error).toStrictEqual({
      code: "enum-not-found",
      path: ["column", "type", "enumId"],
    });
  });

  it("rejects addColumn with insert-position-out-of-range when insertAt exceeds the column count", () => {
    const schema = buildUsersSchema();
    const column = makeColumn({ id: "col_new", tableId: "tbl_users" });

    const error = unwrapError(
      applyColumnOperation(schema, { type: "addColumn", column, insertAt: 4 }),
    );

    expect(error).toStrictEqual({
      code: "insert-position-out-of-range",
      path: ["insertAt"],
    });
  });
});

describe("updateColumn", () => {
  it("updates the type, nullability and default of a column", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyColumnOperation(schema, {
        type: "updateColumn",
        columnId: "col_a",
        changes: {
          type: { kind: "varchar", length: 255 },
          isNullable: true,
          defaultValue: { kind: "literal", value: "guest" },
        },
      }),
    );

    expect(result.schema.columns.col_a).toStrictEqual(
      makeColumn({
        id: "col_a",
        tableId: "tbl_users",
        type: { kind: "varchar", length: 255 },
        isNullable: true,
        defaultValue: { kind: "literal", value: "guest" },
      }),
    );
  });

  it("clears the default value when changes.defaultValue is null", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_a",
          tableId: "tbl_users",
          defaultValue: { kind: "literal", value: "1" },
        }),
      ],
    });

    const result = unwrapOk(
      applyColumnOperation(schema, {
        type: "updateColumn",
        columnId: "col_a",
        changes: { defaultValue: null },
      }),
    );

    expect(result.schema.columns.col_a?.defaultValue).toBeNull();
  });

  it("ignores a change whose value is undefined", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyColumnOperation(schema, {
        type: "updateColumn",
        columnId: "col_a",
        changes: { name: "renamed", comment: undefined },
      }),
    );

    expect(result.schema.columns.col_a).toStrictEqual(
      makeColumn({ id: "col_a", tableId: "tbl_users", name: "renamed" }),
    );
  });

  it("returns updateColumn with the previous values as the inverse", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyColumnOperation(schema, {
        type: "updateColumn",
        columnId: "col_a",
        changes: {
          type: { kind: "varchar", length: 255 },
          isNullable: true,
          defaultValue: { kind: "literal", value: "guest" },
        },
      }),
    );

    expect(result.inverse).toStrictEqual({
      type: "updateColumn",
      columnId: "col_a",
      changes: {
        type: { kind: "integer" },
        isNullable: false,
        defaultValue: null,
      },
    });
  });

  it("leaves a change whose value is undefined out of the inverse", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyColumnOperation(schema, {
        type: "updateColumn",
        columnId: "col_a",
        changes: { name: "renamed", comment: undefined },
      }),
    );

    expect(result.inverse).toStrictEqual({
      type: "updateColumn",
      columnId: "col_a",
      changes: { name: "a" },
    });
  });

  it("restores the column when the updateColumn inverse is applied", () => {
    const schema = buildUsersSchema();
    const updated = unwrapOk(
      applyColumnOperation(schema, {
        type: "updateColumn",
        columnId: "col_a",
        changes: {
          name: "email",
          type: { kind: "text" },
          isNullable: true,
          defaultValue: { kind: "literal", value: "none" },
          isUnique: true,
          isAutoIncrement: true,
          comment: "Contact address",
        },
      }),
    );

    const restored = unwrapOk(
      applyColumnInverse(updated.schema, updated.inverse),
    );

    expect(restored.schema).toStrictEqual(schema);
  });

  it("rejects updateColumn with column-not-found", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyColumnOperation(schema, {
        type: "updateColumn",
        columnId: "col_missing",
        changes: { name: "renamed" },
      }),
    );

    expect(error).toStrictEqual({
      code: "column-not-found",
      path: ["columnId"],
    });
  });

  it("rejects updateColumn with enum-not-found at changes.type.enumId", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyColumnOperation(schema, {
        type: "updateColumn",
        columnId: "col_a",
        changes: { type: { kind: "enum", enumId: "enum_missing" } },
      }),
    );

    expect(error).toStrictEqual({
      code: "enum-not-found",
      path: ["changes", "type", "enumId"],
    });
  });

  it("keeps the relation when a column type change creates a type mismatch", () => {
    const relation = makeRelation({
      id: "rel_author",
      fromTableId: "tbl_posts",
      toTableId: "tbl_users",
      columnPairs: [
        { fromColumnId: "col_author_id", toColumnId: "col_user_id" },
      ],
    });
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" }), makeTable({ id: "tbl_posts" })],
      columns: [
        makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
        makeColumn({ id: "col_author_id", tableId: "tbl_posts" }),
      ],
      relations: [relation],
    });

    const result = unwrapOk(
      applyColumnOperation(schema, {
        type: "updateColumn",
        columnId: "col_author_id",
        changes: { type: { kind: "text" } },
      }),
    );

    expect(result.schema.relations).toStrictEqual({ rel_author: relation });
  });

  it("returns the same schema reference when updateColumn changes nothing", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyColumnOperation(schema, {
        type: "updateColumn",
        columnId: "col_a",
        changes: { name: "a", type: { kind: "integer" }, defaultValue: null },
      }),
    );

    expect(result.schema).toBe(schema);
  });
});

describe("moveColumn", () => {
  it.each([
    {
      position: "first",
      toIndex: 0,
      expectedColumnIds: ["col_b", "col_a", "col_c"],
    },
    {
      position: "last",
      toIndex: 2,
      expectedColumnIds: ["col_a", "col_c", "col_b"],
    },
  ])(
    "moves a column to the first and last position: $position",
    ({ toIndex, expectedColumnIds }) => {
      const schema = buildUsersSchema();

      const result = unwrapOk(
        applyColumnOperation(schema, {
          type: "moveColumn",
          columnId: "col_b",
          toIndex,
        }),
      );

      expect(result.schema.tables.tbl_users?.columnIds).toStrictEqual(
        expectedColumnIds,
      );
    },
  );

  it("returns moveColumn to the previous index as the inverse", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyColumnOperation(schema, {
        type: "moveColumn",
        columnId: "col_a",
        toIndex: 2,
      }),
    );

    expect(result.inverse).toStrictEqual({
      type: "moveColumn",
      columnId: "col_a",
      toIndex: 0,
    });
  });

  it("restores the column order when the moveColumn inverse is applied", () => {
    const schema = buildUsersSchema();
    const moved = unwrapOk(
      applyColumnOperation(schema, {
        type: "moveColumn",
        columnId: "col_a",
        toIndex: 2,
      }),
    );

    const restored = unwrapOk(applyColumnInverse(moved.schema, moved.inverse));

    expect(restored.schema).toStrictEqual(schema);
  });

  it("rejects moveColumn with column-not-found", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyColumnOperation(schema, {
        type: "moveColumn",
        columnId: "col_missing",
        toIndex: 0,
      }),
    );

    expect(error).toStrictEqual({
      code: "column-not-found",
      path: ["columnId"],
    });
  });

  it("rejects moveColumn with insert-position-out-of-range", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyColumnOperation(schema, {
        type: "moveColumn",
        columnId: "col_a",
        toIndex: 3,
      }),
    );

    expect(error).toStrictEqual({
      code: "insert-position-out-of-range",
      path: ["toIndex"],
    });
  });

  it("returns the same schema reference when moveColumn keeps the index", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyColumnOperation(schema, {
        type: "moveColumn",
        columnId: "col_b",
        toIndex: 1,
      }),
    );

    expect(result.schema).toBe(schema);
  });
});
