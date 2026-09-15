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
import type {
  Operation,
  OperationOfType,
  TableOperation,
} from "./operation.js";
import { applyTableOperation } from "./table-operations.js";

type AddTableOperation = OperationOfType<"addTable">;

function buildUsersSchema(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_users",
        name: "users",
        comment: "people",
        subjectAreaId: "area_accounts",
        primaryKeyColumnIds: ["col_id"],
      }),
      makeTable({ id: "tbl_orders" }),
    ],
    columns: [
      makeColumn({ id: "col_id", tableId: "tbl_users" }),
      makeColumn({ id: "col_email", tableId: "tbl_users" }),
      makeColumn({
        id: "col_manager_id",
        tableId: "tbl_users",
        isNullable: true,
      }),
      makeColumn({ id: "col_order_id", tableId: "tbl_orders" }),
    ],
    indexes: [
      makeIndex({
        id: "idx_email",
        tableId: "tbl_users",
        columnIds: ["col_email"],
        isUnique: true,
      }),
    ],
    relations: [
      makeRelation({
        id: "rel_manager",
        fromTableId: "tbl_users",
        toTableId: "tbl_users",
        columnPairs: [{ fromColumnId: "col_manager_id", toColumnId: "col_id" }],
      }),
    ],
    subjectAreas: [
      makeSubjectArea({ id: "area_accounts" }),
      makeSubjectArea({ id: "area_billing" }),
    ],
  });
}

function makeAddTableOperation(
  overrides: Partial<AddTableOperation["table"]> = {},
): AddTableOperation {
  return {
    type: "addTable",
    table: {
      id: "tbl_archive",
      name: "archive",
      comment: "old rows",
      position: { x: 10, y: 20 },
      subjectAreaId: null,
      ...overrides,
    },
  };
}

// Inverses are typed as Operation; applying one through the table group
// requires narrowing it back to a table operation first.
function toTableOperation(operation: Operation): TableOperation {
  if (
    operation.type === "addTable" ||
    operation.type === "updateTable" ||
    operation.type === "setPrimaryKey" ||
    operation.type === "removeTable"
  ) {
    return operation;
  }
  throw new Error(`Expected a table operation but got ${operation.type}`);
}

describe("addTable", () => {
  it("adds a table with empty column and primary key lists", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyTableOperation(schema, makeAddTableOperation()),
    );

    expect(result.schema.tables.tbl_archive).toStrictEqual({
      id: "tbl_archive",
      name: "archive",
      comment: "old rows",
      position: { x: 10, y: 20 },
      subjectAreaId: null,
      columnIds: [],
      primaryKeyColumnIds: [],
    });
  });

  it("adds a table to an existing subject area", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyTableOperation(
        schema,
        makeAddTableOperation({ subjectAreaId: "area_billing" }),
      ),
    );

    expect(result.schema.tables.tbl_archive).toHaveProperty(
      "subjectAreaId",
      "area_billing",
    );
  });

  it("returns removeTable as the inverse of addTable", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyTableOperation(schema, makeAddTableOperation()),
    );

    expect(result.inverse).toStrictEqual({
      type: "removeTable",
      tableId: "tbl_archive",
    });
  });

  it("restores the schema when the addTable inverse is applied", () => {
    const schema = buildUsersSchema();
    const added = unwrapOk(
      applyTableOperation(schema, makeAddTableOperation()),
    );

    const restored = unwrapOk(
      applyTableOperation(added.schema, toTableOperation(added.inverse)),
    );

    expect(restored.schema).toStrictEqual(schema);
  });

  it("rejects addTable with id-already-exists at table.id", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyTableOperation(schema, makeAddTableOperation({ id: "tbl_users" })),
    );

    expect(error).toStrictEqual({
      code: "id-already-exists",
      path: ["table", "id"],
    });
  });

  it("rejects addTable with subject-area-not-found for a missing subject area", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyTableOperation(
        schema,
        makeAddTableOperation({ subjectAreaId: "area_missing" }),
      ),
    );

    expect(error).toStrictEqual({
      code: "subject-area-not-found",
      path: ["table", "subjectAreaId"],
    });
  });

  it("keeps the columns, relations and indexes maps by reference when a table is added", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyTableOperation(schema, makeAddTableOperation()),
    );

    expect(result.schema.columns).toBe(schema.columns);
    expect(result.schema.relations).toBe(schema.relations);
    expect(result.schema.indexes).toBe(schema.indexes);
    expect(result.schema.tables.tbl_users).toBe(schema.tables.tbl_users);
  });
});

describe("updateTable", () => {
  it("updates only the fields given in changes", () => {
    const schema = buildUsersSchema();
    const before = schema.tables.tbl_users;

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "updateTable",
        tableId: "tbl_users",
        changes: { name: "members", subjectAreaId: "area_billing" },
      }),
    );

    expect(result.schema.tables.tbl_users).toStrictEqual({
      ...before,
      name: "members",
      subjectAreaId: "area_billing",
    });
  });

  it("ignores a change whose value is undefined", () => {
    const schema = buildUsersSchema();
    const before = schema.tables.tbl_users;

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "updateTable",
        tableId: "tbl_users",
        changes: { name: "members", comment: undefined },
      }),
    );

    expect(result.schema.tables.tbl_users).toStrictEqual({
      ...before,
      name: "members",
    });
  });

  it("returns updateTable with the previous values of the changed fields as the inverse", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "updateTable",
        tableId: "tbl_users",
        changes: { name: "members", comment: undefined, subjectAreaId: null },
      }),
    );

    expect(result.inverse).toStrictEqual({
      type: "updateTable",
      tableId: "tbl_users",
      changes: { name: "users", subjectAreaId: "area_accounts" },
    });
  });

  it("restores the table when the updateTable inverse is applied", () => {
    const schema = buildUsersSchema();
    const updated = unwrapOk(
      applyTableOperation(schema, {
        type: "updateTable",
        tableId: "tbl_users",
        changes: { name: "members", comment: "", subjectAreaId: null },
      }),
    );

    const restored = unwrapOk(
      applyTableOperation(updated.schema, toTableOperation(updated.inverse)),
    );

    expect(restored.schema).toStrictEqual(schema);
  });

  it("rejects updateTable with table-not-found", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyTableOperation(schema, {
        type: "updateTable",
        tableId: "tbl_missing",
        changes: { name: "members" },
      }),
    );

    expect(error).toStrictEqual({ code: "table-not-found", path: ["tableId"] });
  });

  it("rejects updateTable with subject-area-not-found at changes.subjectAreaId", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyTableOperation(schema, {
        type: "updateTable",
        tableId: "tbl_users",
        changes: { subjectAreaId: "area_missing" },
      }),
    );

    expect(error).toStrictEqual({
      code: "subject-area-not-found",
      path: ["changes", "subjectAreaId"],
    });
  });

  it("removes a table from its subject area by setting subjectAreaId to null", () => {
    const schema = buildUsersSchema();
    const before = schema.tables.tbl_users;

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "updateTable",
        tableId: "tbl_users",
        changes: { subjectAreaId: null },
      }),
    );

    expect(result.schema.tables.tbl_users).toStrictEqual({
      ...before,
      subjectAreaId: null,
    });
  });

  it("keeps other tables and the columns map by reference when a table is updated", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "updateTable",
        tableId: "tbl_users",
        changes: { name: "members" },
      }),
    );

    expect(result.schema.tables.tbl_orders).toBe(schema.tables.tbl_orders);
    expect(result.schema.columns).toBe(schema.columns);
  });

  it("returns the same schema reference when updateTable changes nothing", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "updateTable",
        tableId: "tbl_users",
        changes: { name: "users", subjectAreaId: "area_accounts" },
      }),
    );

    expect(result.schema).toBe(schema);
  });

  it("returns the same schema reference when every change is undefined", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "updateTable",
        tableId: "tbl_users",
        changes: { name: undefined },
      }),
    );

    expect(result.schema).toBe(schema);
  });
});

describe("setPrimaryKey", () => {
  it("sets a composite primary key in the given order", () => {
    const schema = buildUsersSchema();
    const before = schema.tables.tbl_users;

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "setPrimaryKey",
        tableId: "tbl_users",
        columnIds: ["col_email", "col_id"],
      }),
    );

    expect(result.schema.tables.tbl_users).toStrictEqual({
      ...before,
      primaryKeyColumnIds: ["col_email", "col_id"],
    });
  });

  it("clears the primary key with an empty list", () => {
    const schema = buildUsersSchema();
    const before = schema.tables.tbl_users;

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "setPrimaryKey",
        tableId: "tbl_users",
        columnIds: [],
      }),
    );

    expect(result.schema.tables.tbl_users).toStrictEqual({
      ...before,
      primaryKeyColumnIds: [],
    });
  });

  it("returns setPrimaryKey with the previous list as the inverse", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "setPrimaryKey",
        tableId: "tbl_users",
        columnIds: ["col_email", "col_id"],
      }),
    );

    expect(result.inverse).toStrictEqual({
      type: "setPrimaryKey",
      tableId: "tbl_users",
      columnIds: ["col_id"],
    });
  });

  it("restores the primary key when the setPrimaryKey inverse is applied", () => {
    const schema = buildUsersSchema();
    const updated = unwrapOk(
      applyTableOperation(schema, {
        type: "setPrimaryKey",
        tableId: "tbl_users",
        columnIds: ["col_email", "col_id"],
      }),
    );

    const restored = unwrapOk(
      applyTableOperation(updated.schema, toTableOperation(updated.inverse)),
    );

    expect(restored.schema).toStrictEqual(schema);
  });

  it("rejects setPrimaryKey with table-not-found", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyTableOperation(schema, {
        type: "setPrimaryKey",
        tableId: "tbl_missing",
        columnIds: [],
      }),
    );

    expect(error).toStrictEqual({ code: "table-not-found", path: ["tableId"] });
  });

  it("rejects setPrimaryKey with column-not-found at the column index", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyTableOperation(schema, {
        type: "setPrimaryKey",
        tableId: "tbl_users",
        columnIds: ["col_id", "col_missing"],
      }),
    );

    expect(error).toStrictEqual({
      code: "column-not-found",
      path: ["columnIds", 1],
    });
  });

  it("rejects setPrimaryKey with column-not-in-table", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyTableOperation(schema, {
        type: "setPrimaryKey",
        tableId: "tbl_users",
        columnIds: ["col_order_id"],
      }),
    );

    expect(error).toStrictEqual({
      code: "column-not-in-table",
      path: ["columnIds", 0],
    });
  });

  it("rejects setPrimaryKey with column-listed-twice", () => {
    const schema = buildUsersSchema();

    const error = unwrapError(
      applyTableOperation(schema, {
        type: "setPrimaryKey",
        tableId: "tbl_users",
        columnIds: ["col_id", "col_email", "col_id"],
      }),
    );

    expect(error).toStrictEqual({
      code: "column-listed-twice",
      path: ["columnIds", 2],
    });
  });

  it("returns the same schema reference when setPrimaryKey sets the current list", () => {
    const schema = buildUsersSchema();

    const result = unwrapOk(
      applyTableOperation(schema, {
        type: "setPrimaryKey",
        tableId: "tbl_users",
        columnIds: ["col_id"],
      }),
    );

    expect(result.schema).toBe(schema);
  });
});
