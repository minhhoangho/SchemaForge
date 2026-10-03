import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../model/schema-document.js";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeEnum,
  makeIndex,
  makeTable,
} from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import type { AiColumnSpec, AiEdit } from "./ai-edit-tools.js";
import { applyAiEdit } from "./apply-ai-edit.js";
import type { AiTablePlacement } from "./place-ai-table.js";
import { createAiTablePlacement } from "./place-ai-table.js";

const USERS = makeTable({
  id: "tbl_users",
  primaryKeyColumnIds: ["col_users_id"],
});
const ORDERS = makeTable({
  id: "tbl_orders",
  position: { x: 400, y: 0 },
  primaryKeyColumnIds: ["col_orders_id"],
});
const USERS_ID = makeColumn({
  id: "col_users_id",
  tableId: "tbl_users",
  name: "id",
});
const USERS_EMAIL = makeColumn({
  id: "col_users_email",
  tableId: "tbl_users",
  name: "email",
  type: { kind: "varchar", length: 255 },
});
const ORDERS_ID = makeColumn({
  id: "col_orders_id",
  tableId: "tbl_orders",
  name: "id",
});
const ORDERS_USER_ID = makeColumn({
  id: "col_orders_user_id",
  tableId: "tbl_orders",
  name: "user_id",
});
const ORDERS_STATUS = makeColumn({
  id: "col_orders_status",
  tableId: "tbl_orders",
  name: "status",
  type: { kind: "enum", enumId: "enum_status" },
});
const ORDER_STATUS = makeEnum({
  id: "enum_status",
  name: "order_status",
  values: ["pending", "paid"],
});
const USERS_EMAIL_KEY = makeIndex({
  id: "idx_users_email",
  tableId: "tbl_users",
  name: "users_email_key",
  columnIds: ["col_users_email"],
  isUnique: true,
});

const SCHEMA = buildSchema({
  name: "shop",
  tables: [USERS, ORDERS],
  columns: [USERS_ID, USERS_EMAIL, ORDERS_ID, ORDERS_USER_ID, ORDERS_STATUS],
  indexes: [USERS_EMAIL_KEY],
  enums: [ORDER_STATUS],
});

// The original schema's rightmost table is at x 400, so the grid starts at 800.
const GRID_ORIGIN_X = 800;

function columnSpec(
  overrides: Partial<AiColumnSpec> & Pick<AiColumnSpec, "name">,
): AiColumnSpec {
  return { type: { kind: "integer" }, isNullable: false, ...overrides };
}

function apply(
  edit: AiEdit,
  schema: SchemaDocument = SCHEMA,
  placement: AiTablePlacement = createAiTablePlacement(SCHEMA),
): ReturnType<typeof applyAiEdit> {
  return applyAiEdit(schema, edit, {
    generateId: createCounterIdGenerator(),
    placement,
  });
}

describe("applyAiEdit table edits", () => {
  it("creates a table with its columns and primary key as one batch", () => {
    const success = unwrapOk(
      apply({
        tool: "createTable",
        input: {
          name: "products",
          columns: [
            columnSpec({
              name: "id",
              type: { kind: "bigint" },
              isAutoIncrement: true,
            }),
            columnSpec({
              name: "title",
              type: { kind: "varchar", length: 200 },
              comment: "Shown in the catalog",
            }),
          ],
          primaryKey: ["id"],
        },
      }),
    );

    expect(success.operation).toStrictEqual({
      type: "batch",
      operations: [
        {
          type: "addTable",
          table: {
            id: "tbl_1",
            name: "products",
            comment: "",
            position: { x: GRID_ORIGIN_X, y: 0 },
            subjectAreaId: null,
          },
        },
        {
          type: "addColumn",
          column: {
            id: "col_2",
            tableId: "tbl_1",
            name: "id",
            type: { kind: "bigint" },
            isNullable: false,
            defaultValue: null,
            isUnique: false,
            isAutoIncrement: true,
            comment: "",
          },
          insertAt: 0,
        },
        {
          type: "addColumn",
          column: {
            id: "col_3",
            tableId: "tbl_1",
            name: "title",
            type: { kind: "varchar", length: 200 },
            isNullable: false,
            defaultValue: null,
            isUnique: false,
            isAutoIncrement: false,
            comment: "Shown in the catalog",
          },
          insertAt: 1,
        },
        { type: "setPrimaryKey", tableId: "tbl_1", columnIds: ["col_2"] },
      ],
    });
  });

  it("leaves the primary key out of the batch when primaryKey is empty", () => {
    const success = unwrapOk(
      apply({
        tool: "createTable",
        input: {
          name: "logs",
          comment: "Audit trail",
          columns: [columnSpec({ name: "message", type: { kind: "text" } })],
          primaryKey: [],
        },
      }),
    );

    expect(success.schema.tables.tbl_1).toStrictEqual({
      id: "tbl_1",
      name: "logs",
      comment: "Audit trail",
      position: { x: GRID_ORIGIN_X, y: 0 },
      subjectAreaId: null,
      columnIds: ["col_2"],
      primaryKeyColumnIds: [],
    });
  });

  it("places a created table on the grid and reports one placed table", () => {
    const success = unwrapOk(
      apply(
        {
          tool: "createTable",
          input: {
            name: "products",
            columns: [columnSpec({ name: "id" })],
            primaryKey: ["id"],
          },
        },
        SCHEMA,
        { originX: GRID_ORIGIN_X, placedCount: 5 },
      ),
    );

    expect({
      position: success.schema.tables.tbl_1?.position,
      placedTables: success.placedTables,
    }).toStrictEqual({ position: { x: 1200, y: 400 }, placedTables: 1 });
  });

  it("renames the schema", () => {
    const success = unwrapOk(
      apply({ tool: "renameSchema", input: { name: "store" } }),
    );

    expect(success).toStrictEqual({
      schema: { ...SCHEMA, name: "store" },
      operation: { type: "renameSchema", name: "store" },
      placedTables: 0,
    });
  });

  it("updates a table name and comment", () => {
    const success = unwrapOk(
      apply({
        tool: "updateTable",
        input: { table: "users", newName: "accounts", comment: "People" },
      }),
    );

    expect(success.operation).toStrictEqual({
      type: "updateTable",
      tableId: "tbl_users",
      changes: { name: "accounts", comment: "People" },
    });
  });

  it("removes a table", () => {
    const success = unwrapOk(
      apply({ tool: "removeTable", input: { table: "orders" } }),
    );

    expect({
      operation: success.operation,
      tableIds: Object.keys(success.schema.tables),
    }).toStrictEqual({
      operation: { type: "removeTable", tableId: "tbl_orders" },
      tableIds: ["tbl_users"],
    });
  });

  it("returns table-name-not-found with the requested name", () => {
    const errors = unwrapError(
      apply({ tool: "removeTable", input: { table: "user accounts" } }),
    );

    expect(errors).toStrictEqual([
      {
        code: "table-name-not-found",
        path: ["table"],
        at: 'tables."user accounts"',
      },
    ]);
  });

  it("uses a table created by an earlier call on the same draft", () => {
    const created = unwrapOk(
      apply({
        tool: "createTable",
        input: {
          name: "products",
          columns: [columnSpec({ name: "id" })],
          primaryKey: ["id"],
        },
      }),
    );

    const success = unwrapOk(
      apply(
        {
          tool: "addColumn",
          input: { table: "products", column: columnSpec({ name: "price" }) },
        },
        created.schema,
      ),
    );

    expect(success.schema.tables.tbl_1?.columnIds).toStrictEqual([
      "col_2",
      "col_1",
    ]);
  });

  it("creates a table with a column named __proto__", () => {
    const success = unwrapOk(
      apply({
        tool: "createTable",
        input: {
          name: "__proto__",
          columns: [columnSpec({ name: "__proto__" })],
          primaryKey: ["__proto__"],
        },
      }),
    );

    expect({
      tableName: success.schema.tables.tbl_1?.name,
      columnName: success.schema.columns.col_2?.name,
      primaryKey: success.schema.tables.tbl_1?.primaryKeyColumnIds,
    }).toStrictEqual({
      tableName: "__proto__",
      columnName: "__proto__",
      primaryKey: ["col_2"],
    });
  });

  it("returns column-name-not-found for a primary key outside the new columns", () => {
    const errors = unwrapError(
      apply({
        tool: "createTable",
        input: {
          name: "products",
          columns: [columnSpec({ name: "id" })],
          primaryKey: ["id", "code"],
        },
      }),
    );

    expect(errors).toStrictEqual([
      {
        code: "column-name-not-found",
        path: ["primaryKey", 1],
        at: "tables.products.columns.code",
      },
    ]);
  });

  it("locates a column type error by the column's place in the input", () => {
    const errors = unwrapError(
      apply({
        tool: "createTable",
        input: {
          name: "products",
          columns: [
            columnSpec({ name: "id" }),
            columnSpec({ name: "title", type: { kind: "varchar" } }),
          ],
          primaryKey: [],
        },
      }),
    );

    expect(errors).toStrictEqual([
      {
        code: "column-type-invalid",
        path: ["columns", 1, "type", "length"],
        at: "tables.products.columns.title",
      },
    ]);
  });
});

describe("applyAiEdit column edits", () => {
  it("fills omitted column fields with explicit defaults", () => {
    const success = unwrapOk(
      apply({
        tool: "addColumn",
        input: { table: "users", column: columnSpec({ name: "age" }) },
      }),
    );

    expect(success.operation).toStrictEqual({
      type: "addColumn",
      column: {
        id: "col_1",
        tableId: "tbl_users",
        name: "age",
        type: { kind: "integer" },
        isNullable: false,
        defaultValue: null,
        isUnique: false,
        isAutoIncrement: false,
        comment: "",
      },
      insertAt: 2,
    });
  });

  it("adds a column after the named column", () => {
    const success = unwrapOk(
      apply({
        tool: "addColumn",
        input: {
          table: "users",
          column: columnSpec({ name: "nickname" }),
          after: "id",
        },
      }),
    );

    expect(success.schema.tables.tbl_users?.columnIds).toStrictEqual([
      "col_users_id",
      "col_1",
      "col_users_email",
    ]);
  });

  it("adds a column at the end without after", () => {
    const success = unwrapOk(
      apply({
        tool: "addColumn",
        input: { table: "users", column: columnSpec({ name: "nickname" }) },
      }),
    );

    expect(success.schema.tables.tbl_users?.columnIds).toStrictEqual([
      "col_users_id",
      "col_users_email",
      "col_1",
    ]);
  });

  it("returns column-name-not-found for an unknown after column", () => {
    const errors = unwrapError(
      apply({
        tool: "addColumn",
        input: {
          table: "users",
          column: columnSpec({ name: "nickname" }),
          after: "name",
        },
      }),
    );

    expect(errors).toStrictEqual([
      {
        code: "column-name-not-found",
        path: ["after"],
        at: "tables.users.columns.name",
      },
    ]);
  });

  it("locates a default value error inside the column", () => {
    const errors = unwrapError(
      apply({
        tool: "addColumn",
        input: {
          table: "users",
          column: columnSpec({
            name: "score",
            defaultValue: { kind: "literal" },
          }),
        },
      }),
    );

    expect(errors).toStrictEqual([
      {
        code: "default-value-invalid",
        path: ["column", "defaultValue", "value"],
        at: "tables.users.columns.score",
      },
    ]);
  });

  it("adds a column named constructor", () => {
    const success = unwrapOk(
      apply({
        tool: "addColumn",
        input: { table: "users", column: columnSpec({ name: "constructor" }) },
      }),
    );

    expect(success.schema.columns.col_1?.name).toBe("constructor");
  });

  it("updates only the given column fields", () => {
    const success = unwrapOk(
      apply({
        tool: "updateColumn",
        input: {
          table: "users",
          column: "email",
          isNullable: true,
          defaultValue: null,
        },
      }),
    );

    expect(success.operation).toStrictEqual({
      type: "updateColumn",
      columnId: "col_users_email",
      changes: { isNullable: true, defaultValue: null },
    });
  });

  it("translates every column field it is given", () => {
    const success = unwrapOk(
      apply({
        tool: "updateColumn",
        input: {
          table: "orders",
          column: "status",
          newName: "state",
          type: { kind: "varchar", length: 20 },
          isUnique: true,
          isAutoIncrement: false,
          defaultValue: { kind: "literal", value: "pending" },
          comment: "Order state",
        },
      }),
    );

    expect(success.operation).toStrictEqual({
      type: "updateColumn",
      columnId: "col_orders_status",
      changes: {
        name: "state",
        type: { kind: "varchar", length: 20 },
        isUnique: true,
        isAutoIncrement: false,
        defaultValue: { kind: "literal", value: "pending" },
        comment: "Order state",
      },
    });
  });

  it("locates an update type error at the column", () => {
    const errors = unwrapError(
      apply({
        tool: "updateColumn",
        input: {
          table: "users",
          column: "email",
          type: { kind: "text", length: 10 },
        },
      }),
    );

    expect(errors).toStrictEqual([
      {
        code: "column-type-invalid",
        path: ["type", "length"],
        at: "tables.users.columns.email",
      },
    ]);
  });

  it("resolves names case-insensitively", () => {
    const success = unwrapOk(
      apply({
        tool: "updateColumn",
        input: { table: "USERS", column: "Email", comment: "Login" },
      }),
    );

    expect(success.operation).toStrictEqual({
      type: "updateColumn",
      columnId: "col_users_email",
      changes: { comment: "Login" },
    });
  });

  it("removes a column", () => {
    const success = unwrapOk(
      apply({
        tool: "removeColumn",
        input: { table: "orders", column: "user_id" },
      }),
    );

    expect(success.operation).toStrictEqual({
      type: "removeColumn",
      columnId: "col_orders_user_id",
    });
  });

  it("returns column-name-not-found for a column of another table", () => {
    const errors = unwrapError(
      apply({
        tool: "removeColumn",
        input: { table: "users", column: "user_id" },
      }),
    );

    expect(errors).toStrictEqual([
      {
        code: "column-name-not-found",
        path: ["column"],
        at: "tables.users.columns.user_id",
      },
    ]);
  });

  it("sets a primary key", () => {
    const success = unwrapOk(
      apply({
        tool: "setPrimaryKey",
        input: { table: "orders", columns: ["id", "user_id"] },
      }),
    );

    expect(success.operation).toStrictEqual({
      type: "setPrimaryKey",
      tableId: "tbl_orders",
      columnIds: ["col_orders_id", "col_orders_user_id"],
    });
  });

  it("reports every unknown primary key column", () => {
    const errors = unwrapError(
      apply({
        tool: "setPrimaryKey",
        input: { table: "orders", columns: ["code", "id", "sku"] },
      }),
    );

    expect(errors).toStrictEqual([
      {
        code: "column-name-not-found",
        path: ["columns", 0],
        at: "tables.orders.columns.code",
      },
      {
        code: "column-name-not-found",
        path: ["columns", 2],
        at: "tables.orders.columns.sku",
      },
    ]);
  });

  it("locates a core error at the table the call targets", () => {
    const errors = unwrapError(
      apply({
        tool: "setPrimaryKey",
        input: { table: "orders", columns: ["id", "ID"] },
      }),
    );

    expect(errors).toStrictEqual([
      {
        code: "column-listed-twice",
        path: ["columnIds", 1],
        at: "tables.orders",
      },
    ]);
  });

  it("rejects an edit that introduces an issue and keeps the input unchanged", () => {
    const before = JSON.stringify(SCHEMA);

    const errors = unwrapError(
      apply({
        tool: "addColumn",
        input: { table: "users", column: columnSpec({ name: "Email" }) },
      }),
    );

    expect({
      errors,
      isUnchanged: JSON.stringify(SCHEMA) === before,
    }).toStrictEqual({
      errors: [
        {
          code: "column-name-duplicate",
          path: ["columns", "col_1", "name"],
          at: "tables.users.columns.Email.name",
        },
        {
          code: "column-name-duplicate",
          path: ["columns", "col_users_email", "name"],
          at: "tables.users.columns.email.name",
        },
      ],
      isUnchanged: true,
    });
  });
});

describe("applyAiEdit index and enum edits", () => {
  it("adds an index with a suggested name", () => {
    const success = unwrapOk(
      apply({
        tool: "addIndex",
        input: { table: "orders", columns: ["user_id"], isUnique: false },
      }),
    );

    expect(success.operation).toStrictEqual({
      type: "addIndex",
      index: {
        id: "idx_1",
        tableId: "tbl_orders",
        name: "orders_user_id_idx",
        columnIds: ["col_orders_user_id"],
        isUnique: false,
      },
    });
  });

  it("adds an index with the given name", () => {
    const success = unwrapOk(
      apply({
        tool: "addIndex",
        input: {
          table: "orders",
          columns: ["status", "user_id"],
          isUnique: true,
          name: "orders_by_status",
        },
      }),
    );

    expect(success.schema.indexes.idx_1).toStrictEqual({
      id: "idx_1",
      tableId: "tbl_orders",
      name: "orders_by_status",
      columnIds: ["col_orders_status", "col_orders_user_id"],
      isUnique: true,
    });
  });

  it("removes an index", () => {
    const success = unwrapOk(
      apply({
        tool: "removeIndex",
        input: { table: "users", index: "users_email_key" },
      }),
    );

    expect(success.operation).toStrictEqual({
      type: "removeIndex",
      indexId: "idx_users_email",
    });
  });

  it("returns index-name-not-found for an index of another table", () => {
    const errors = unwrapError(
      apply({
        tool: "removeIndex",
        input: { table: "orders", index: "users_email_key" },
      }),
    );

    expect(errors).toStrictEqual([
      {
        code: "index-name-not-found",
        path: ["index"],
        at: "tables.orders.indexes.users_email_key",
      },
    ]);
  });

  it("creates, updates and removes an enum", () => {
    const created = unwrapOk(
      apply({
        tool: "createEnum",
        input: { name: "role", values: ["admin"] },
      }),
    );
    const updated = unwrapOk(
      apply(
        {
          tool: "updateEnum",
          input: {
            enum: "role",
            newName: "user_role",
            values: ["admin", "member"],
          },
        },
        created.schema,
      ),
    );
    const removed = unwrapOk(
      apply(
        { tool: "removeEnum", input: { enum: "user_role" } },
        updated.schema,
      ),
    );

    expect({
      operations: [created.operation, updated.operation, removed.operation],
      schema: removed.schema,
    }).toStrictEqual({
      operations: [
        {
          type: "addEnum",
          enum: { id: "enum_1", name: "role", values: ["admin"] },
        },
        {
          type: "updateEnum",
          enumId: "enum_1",
          changes: { name: "user_role", values: ["admin", "member"] },
        },
        { type: "removeEnum", enumId: "enum_1" },
      ],
      schema: SCHEMA,
    });
  });

  it("returns enum-name-not-found with the requested name", () => {
    const errors = unwrapError(
      apply({
        tool: "updateEnum",
        input: { enum: "status", newName: "state" },
      }),
    );

    expect(errors).toStrictEqual([
      { code: "enum-name-not-found", path: ["enum"], at: "enums.status" },
    ]);
  });

  it("returns enum-in-use when removing a used enum", () => {
    const errors = unwrapError(
      apply({ tool: "removeEnum", input: { enum: "order_status" } }),
    );

    expect(errors).toStrictEqual([
      { code: "enum-in-use", path: ["enumId"], at: "enums.order_status" },
    ]);
  });

  it("resolves a column enum type against the draft", () => {
    const success = unwrapOk(
      apply({
        tool: "addColumn",
        input: {
          table: "users",
          column: columnSpec({
            name: "status",
            type: { kind: "enum", enumName: "order_status" },
          }),
        },
      }),
    );

    expect(success.schema.columns.col_1?.type).toStrictEqual({
      kind: "enum",
      enumId: "enum_status",
    });
  });
});

describe("applyAiEdit determinism", () => {
  it("returns the same result for the same input and id generator", () => {
    const edit: AiEdit = {
      tool: "createTable",
      input: {
        name: "products",
        columns: [columnSpec({ name: "id" })],
        primaryKey: ["id"],
      },
    };

    expect(apply(edit)).toStrictEqual(apply(edit));
  });
});
