import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../model/schema-document.js";
import type { Index } from "../model/table-index.js";
import {
  buildSchema,
  makeColumn,
  makeIndex,
  makeTable,
} from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import { applyIndexOperation } from "./index-operations.js";
import type { IndexOperation, Operation } from "./operation.js";

function buildUsersSchema(indexes: readonly Index[] = []): SchemaDocument {
  return buildSchema({
    tables: [makeTable({ id: "tbl_users" }), makeTable({ id: "tbl_orders" })],
    columns: [
      makeColumn({ id: "col_users_email", tableId: "tbl_users" }),
      makeColumn({ id: "col_users_tenant", tableId: "tbl_users" }),
      makeColumn({ id: "col_orders_total", tableId: "tbl_orders" }),
    ],
    indexes,
  });
}

function makeEmailIndex(overrides: Partial<Index> = {}): Index {
  return makeIndex({
    id: "idx_users_email",
    tableId: "tbl_users",
    columnIds: ["col_users_email"],
    ...overrides,
  });
}

function makeTenantIndex(): Index {
  return makeIndex({
    id: "idx_users_tenant",
    tableId: "tbl_users",
    columnIds: ["col_users_tenant"],
  });
}

// Inverses are typed as any Operation; the handler only accepts its own group.
function toIndexOperation(operation: Operation): IndexOperation {
  if (
    operation.type === "addIndex" ||
    operation.type === "updateIndex" ||
    operation.type === "removeIndex"
  ) {
    return operation;
  }
  throw new Error(`Expected an index operation, got ${operation.type}`);
}

describe("addIndex", () => {
  it("adds a unique multi-column index", () => {
    const schema = buildUsersSchema();
    const index = makeEmailIndex({
      columnIds: ["col_users_tenant", "col_users_email"],
      isUnique: true,
    });

    const result = unwrapOk(
      applyIndexOperation(schema, { type: "addIndex", index }),
    );

    expect(result.schema).toStrictEqual(buildUsersSchema([index]));
  });

  it("returns removeIndex as the inverse of addIndex", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyIndexOperation(schema, {
        type: "addIndex",
        index: makeEmailIndex(),
      }),
    );

    expect(result.inverse).toStrictEqual({
      type: "removeIndex",
      indexId: "idx_users_email",
    });
  });

  it("keeps the other maps and indexes by reference when an index is added", () => {
    const schema = buildUsersSchema([makeTenantIndex()]);

    const result = unwrapOk(
      applyIndexOperation(schema, {
        type: "addIndex",
        index: makeEmailIndex(),
      }),
    );

    expect(result.schema.tables).toBe(schema.tables);
    expect(result.schema.columns).toBe(schema.columns);
    expect(result.schema.relations).toBe(schema.relations);
    expect(result.schema.indexes.idx_users_tenant).toBe(
      schema.indexes.idx_users_tenant,
    );
  });

  it("rejects addIndex with column-not-found at the column index", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyIndexOperation(schema, {
        type: "addIndex",
        index: makeEmailIndex({
          columnIds: ["col_users_email", "col_missing"],
        }),
      }),
    );

    expect(error).toStrictEqual({
      code: "column-not-found",
      path: ["index", "columnIds", 1],
    });
  });

  it("rejects addIndex with column-not-in-table for a column of another table", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyIndexOperation(schema, {
        type: "addIndex",
        index: makeEmailIndex({ columnIds: ["col_orders_total"] }),
      }),
    );

    expect(error).toStrictEqual({
      code: "column-not-in-table",
      path: ["index", "columnIds", 0],
    });
  });

  it("rejects addIndex with table-not-found", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyIndexOperation(schema, {
        type: "addIndex",
        index: makeEmailIndex({ tableId: "tbl_missing" }),
      }),
    );

    expect(error).toStrictEqual({
      code: "table-not-found",
      path: ["index", "tableId"],
    });
  });

  it("rejects addIndex with id-already-exists", () => {
    const schema = buildUsersSchema([makeEmailIndex()]);

    const error = unwrapError(
      applyIndexOperation(schema, {
        type: "addIndex",
        index: makeEmailIndex({ tableId: "tbl_missing" }),
      }),
    );

    expect(error).toStrictEqual({
      code: "id-already-exists",
      path: ["index", "id"],
    });
  });
});

describe("updateIndex", () => {
  it("updates the name, columns and uniqueness of an index", () => {
    const schema = buildUsersSchema([makeEmailIndex()]);

    const result = unwrapOk(
      applyIndexOperation(schema, {
        type: "updateIndex",
        indexId: "idx_users_email",
        changes: {
          name: "users_tenant_email_key",
          columnIds: ["col_users_tenant", "col_users_email"],
          isUnique: true,
        },
      }),
    );

    expect(result.schema).toStrictEqual(
      buildUsersSchema([
        makeEmailIndex({
          name: "users_tenant_email_key",
          columnIds: ["col_users_tenant", "col_users_email"],
          isUnique: true,
        }),
      ]),
    );
  });

  it("ignores a change whose value is undefined", () => {
    const schema = buildUsersSchema([makeEmailIndex()]);

    const result = unwrapOk(
      applyIndexOperation(schema, {
        type: "updateIndex",
        indexId: "idx_users_email",
        changes: { name: "renamed", isUnique: undefined },
      }),
    );

    expect(result).toStrictEqual({
      schema: buildUsersSchema([makeEmailIndex({ name: "renamed" })]),
      inverse: {
        type: "updateIndex",
        indexId: "idx_users_email",
        changes: { name: "users_email" },
      },
    });
  });

  it("returns updateIndex with the previous values of the changed fields as the inverse", () => {
    const schema = buildUsersSchema([makeEmailIndex()]);

    const result = unwrapOk(
      applyIndexOperation(schema, {
        type: "updateIndex",
        indexId: "idx_users_email",
        changes: { columnIds: ["col_users_tenant"], isUnique: true },
      }),
    );

    expect(result.inverse).toStrictEqual({
      type: "updateIndex",
      indexId: "idx_users_email",
      changes: { columnIds: ["col_users_email"], isUnique: false },
    });
  });

  it("rejects updateIndex with column-listed-twice at changes.columnIds", () => {
    const schema = buildUsersSchema([makeEmailIndex()]);

    const error = unwrapError(
      applyIndexOperation(schema, {
        type: "updateIndex",
        indexId: "idx_users_email",
        changes: { columnIds: ["col_users_email", "col_users_email"] },
      }),
    );

    expect(error).toStrictEqual({
      code: "column-listed-twice",
      path: ["changes", "columnIds", 1],
    });
  });

  it("checks changes.columnIds against the table of the index", () => {
    const schema = buildUsersSchema([makeEmailIndex()]);

    const error = unwrapError(
      applyIndexOperation(schema, {
        type: "updateIndex",
        indexId: "idx_users_email",
        changes: { columnIds: ["col_orders_total"] },
      }),
    );

    expect(error).toStrictEqual({
      code: "column-not-in-table",
      path: ["changes", "columnIds", 0],
    });
  });

  it("rejects updateIndex with index-not-found", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyIndexOperation(schema, {
        type: "updateIndex",
        indexId: "idx_missing",
        changes: { name: "renamed" },
      }),
    );

    expect(error).toStrictEqual({ code: "index-not-found", path: ["indexId"] });
  });

  it("keeps the other indexes by reference when an index is updated", () => {
    const schema = buildUsersSchema([makeEmailIndex(), makeTenantIndex()]);

    const result = unwrapOk(
      applyIndexOperation(schema, {
        type: "updateIndex",
        indexId: "idx_users_email",
        changes: { isUnique: true },
      }),
    );

    expect(result.schema.indexes.idx_users_tenant).toBe(
      schema.indexes.idx_users_tenant,
    );
    expect(result.schema.tables).toBe(schema.tables);
  });

  it("returns the same schema reference when updateIndex changes nothing", () => {
    const schema = buildUsersSchema([makeEmailIndex()]);

    const result = unwrapOk(
      applyIndexOperation(schema, {
        type: "updateIndex",
        indexId: "idx_users_email",
        changes: {
          name: "users_email",
          columnIds: ["col_users_email"],
          isUnique: false,
        },
      }),
    );

    expect(result.schema).toBe(schema);
  });
});

describe("removeIndex", () => {
  it("removes an index and returns addIndex as the inverse", () => {
    const index = makeEmailIndex({ isUnique: true });
    const schema = buildUsersSchema([index]);

    const result = unwrapOk(
      applyIndexOperation(schema, {
        type: "removeIndex",
        indexId: "idx_users_email",
      }),
    );

    expect(result).toStrictEqual({
      schema: buildUsersSchema(),
      inverse: { type: "addIndex", index },
    });
  });

  it("rejects removeIndex with index-not-found", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyIndexOperation(schema, {
        type: "removeIndex",
        indexId: "idx_missing",
      }),
    );

    expect(error).toStrictEqual({ code: "index-not-found", path: ["indexId"] });
  });
});

describe("index operation inverses", () => {
  it.each<{
    readonly schema: SchemaDocument;
    readonly operation: IndexOperation;
  }>([
    {
      schema: buildUsersSchema([makeTenantIndex()]),
      operation: { type: "addIndex", index: makeEmailIndex() },
    },
    {
      schema: buildUsersSchema([makeEmailIndex(), makeTenantIndex()]),
      operation: {
        type: "updateIndex",
        indexId: "idx_users_email",
        changes: {
          name: "users_tenant_email_key",
          columnIds: ["col_users_tenant", "col_users_email"],
          isUnique: true,
        },
      },
    },
    {
      schema: buildUsersSchema([makeEmailIndex(), makeTenantIndex()]),
      operation: { type: "removeIndex", indexId: "idx_users_email" },
    },
  ])(
    "restores the schema when each index inverse is applied ($operation.type)",
    ({ schema, operation }) => {
      const applied = unwrapOk(applyIndexOperation(schema, operation));
      const restored = unwrapOk(
        applyIndexOperation(applied.schema, toIndexOperation(applied.inverse)),
      );

      expect(restored.schema).toStrictEqual(schema);
    },
  );
});
