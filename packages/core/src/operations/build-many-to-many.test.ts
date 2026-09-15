import { describe, expect, it } from "vitest";

import type { TableId } from "../model/ids.js";
import type { Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import { findIntroducedIssues } from "../validation/find-introduced-issues.js";
import { applyOperation } from "./apply-operation.js";
import { buildManyToMany } from "./build-many-to-many.js";
import type { ManyToManyInput } from "./build-many-to-many.js";
import type { Operation, OperationOfType, OperationType } from "./operation.js";

const JUNCTION_TABLE_NAME = "user_posts";
const JUNCTION_POSITION = { x: 400, y: 120 };

type KeyedTableNames = {
  readonly tableName: string;
  readonly keyColumnName: string;
};

type RelationEnds = Pick<Relation, "kind" | "fromTableId" | "toTableId">;

// users has an auto-increment integer key and a non-key column that must not
// be copied; posts has a uuid key.
function buildUsersAndPostsSchema(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_users_id"] }),
      makeTable({
        id: "tbl_posts",
        position: { x: 300, y: 0 },
        primaryKeyColumnIds: ["col_posts_id"],
      }),
    ],
    columns: [
      makeColumn({
        id: "col_users_id",
        tableId: "tbl_users",
        name: "id",
        isAutoIncrement: true,
      }),
      makeColumn({
        id: "col_users_email",
        tableId: "tbl_users",
        name: "email",
        type: { kind: "varchar", length: 255 },
      }),
      makeColumn({
        id: "col_posts_id",
        tableId: "tbl_posts",
        name: "id",
        type: { kind: "uuid" },
      }),
    ],
  });
}

// Both keys are composite, and each lists its columns in a different order
// than the table does.
function buildOrdersAndProductsSchema(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_orders",
        primaryKeyColumnIds: ["col_orders_tenant_id", "col_orders_number"],
      }),
      makeTable({
        id: "tbl_products",
        primaryKeyColumnIds: ["col_products_sku", "col_products_region"],
      }),
    ],
    columns: [
      makeColumn({
        id: "col_orders_number",
        tableId: "tbl_orders",
        name: "number",
      }),
      makeColumn({
        id: "col_orders_tenant_id",
        tableId: "tbl_orders",
        name: "tenant_id",
      }),
      makeColumn({
        id: "col_products_region",
        tableId: "tbl_products",
        name: "region",
        type: { kind: "char", length: 2 },
      }),
      makeColumn({
        id: "col_products_sku",
        tableId: "tbl_products",
        name: "sku",
        type: { kind: "varchar", length: 32 },
      }),
    ],
  });
}

// tbl_left and tbl_right, each keyed by a single integer column.
function buildLeftAndRightSchema(
  left: KeyedTableNames,
  right: KeyedTableNames,
): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_left",
        name: left.tableName,
        primaryKeyColumnIds: ["col_left_key"],
      }),
      makeTable({
        id: "tbl_right",
        name: right.tableName,
        primaryKeyColumnIds: ["col_right_key"],
      }),
    ],
    columns: [
      makeColumn({
        id: "col_left_key",
        tableId: "tbl_left",
        name: left.keyColumnName,
      }),
      makeColumn({
        id: "col_right_key",
        tableId: "tbl_right",
        name: right.keyColumnName,
      }),
    ],
  });
}

function buildSchemaWithKeylessTable(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_users_id"] }),
      makeTable({ id: "tbl_tags" }),
    ],
    columns: [
      makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
      makeColumn({ id: "col_tags_label", tableId: "tbl_tags", name: "label" }),
    ],
  });
}

function joinTables(
  leftTableId: TableId,
  rightTableId: TableId,
): ManyToManyInput {
  return {
    leftTableId,
    rightTableId,
    junctionTableName: JUNCTION_TABLE_NAME,
    position: JUNCTION_POSITION,
  };
}

function buildBatch(schema: SchemaDocument, input: ManyToManyInput): Operation {
  return unwrapOk(buildManyToMany(schema, input, createCounterIdGenerator()));
}

function listSteps(operation: Operation): readonly Operation[] {
  if (operation.type !== "batch") {
    throw new Error(`Expected a batch operation, got ${operation.type}`);
  }
  return operation.operations;
}

function listStepsOfType<Type extends OperationType>(
  operation: Operation,
  type: Type,
): readonly OperationOfType<Type>[] {
  return listSteps(operation).filter(
    (step): step is OperationOfType<Type> => step.type === type,
  );
}

function listJunctionColumnNames(operation: Operation): readonly string[] {
  return listStepsOfType(operation, "addColumn").map(
    (step) => step.column.name,
  );
}

function listRelationEnds(schema: SchemaDocument): readonly RelationEnds[] {
  return Object.values(schema.relations)
    .toSorted((first, second) => (first.id < second.id ? -1 : 1))
    .map(({ kind, fromTableId, toTableId }) => ({
      kind,
      fromTableId,
      toTableId,
    }));
}

describe("buildManyToMany", () => {
  it("returns a batch of addTable, addColumn steps, setPrimaryKey and two addRelation steps", () => {
    const operation = buildBatch(
      buildUsersAndPostsSchema(),
      joinTables("tbl_users", "tbl_posts"),
    );

    expect(operation).toStrictEqual({
      type: "batch",
      operations: [
        {
          type: "addTable",
          table: {
            id: "tbl_1",
            name: "user_posts",
            comment: "",
            position: { x: 400, y: 120 },
            subjectAreaId: null,
          },
        },
        {
          type: "addColumn",
          column: {
            id: "col_2",
            tableId: "tbl_1",
            name: "users_id",
            type: { kind: "integer" },
            isNullable: false,
            defaultValue: null,
            isUnique: false,
            isAutoIncrement: false,
            comment: "",
          },
          insertAt: 0,
        },
        {
          type: "addColumn",
          column: {
            id: "col_3",
            tableId: "tbl_1",
            name: "posts_id",
            type: { kind: "uuid" },
            isNullable: false,
            defaultValue: null,
            isUnique: false,
            isAutoIncrement: false,
            comment: "",
          },
          insertAt: 1,
        },
        {
          type: "setPrimaryKey",
          tableId: "tbl_1",
          columnIds: ["col_2", "col_3"],
        },
        {
          type: "addRelation",
          relation: {
            id: "rel_4",
            kind: "oneToMany",
            fromTableId: "tbl_1",
            toTableId: "tbl_users",
            columnPairs: [
              { fromColumnId: "col_2", toColumnId: "col_users_id" },
            ],
            onDelete: "cascade",
            onUpdate: "noAction",
          },
        },
        {
          type: "addRelation",
          relation: {
            id: "rel_5",
            kind: "oneToMany",
            fromTableId: "tbl_1",
            toTableId: "tbl_posts",
            columnPairs: [
              { fromColumnId: "col_3", toColumnId: "col_posts_id" },
            ],
            onDelete: "cascade",
            onUpdate: "noAction",
          },
        },
      ],
    });
  });

  it("copies the type of each primary key column into the junction column", () => {
    const operation = buildBatch(
      buildOrdersAndProductsSchema(),
      joinTables("tbl_orders", "tbl_products"),
    );

    expect(
      listStepsOfType(operation, "addColumn").map((step) => step.column.type),
    ).toStrictEqual([
      { kind: "integer" },
      { kind: "integer" },
      { kind: "varchar", length: 32 },
      { kind: "char", length: 2 },
    ]);
  });

  it("creates a junction primary key from every column of two composite primary keys", () => {
    const operation = buildBatch(
      buildOrdersAndProductsSchema(),
      joinTables("tbl_orders", "tbl_products"),
    );

    expect(listStepsOfType(operation, "setPrimaryKey")).toStrictEqual([
      {
        type: "setPrimaryKey",
        tableId: "tbl_1",
        columnIds: ["col_2", "col_3", "col_4", "col_5"],
      },
    ]);
  });

  it("pairs each junction column with its primary key column in primary key order", () => {
    const operation = buildBatch(
      buildOrdersAndProductsSchema(),
      joinTables("tbl_orders", "tbl_products"),
    );

    expect(
      listStepsOfType(operation, "addRelation").map(
        (step) => step.relation.columnPairs,
      ),
    ).toStrictEqual([
      [
        { fromColumnId: "col_2", toColumnId: "col_orders_tenant_id" },
        { fromColumnId: "col_3", toColumnId: "col_orders_number" },
      ],
      [
        { fromColumnId: "col_4", toColumnId: "col_products_sku" },
        { fromColumnId: "col_5", toColumnId: "col_products_region" },
      ],
    ]);
  });

  it("names junction columns after the table name and the primary key column name", () => {
    const operation = buildBatch(
      buildOrdersAndProductsSchema(),
      joinTables("tbl_orders", "tbl_products"),
    );

    expect(listJunctionColumnNames(operation)).toStrictEqual([
      "orders_tenant_id",
      "orders_number",
      "products_sku",
      "products_region",
    ]);
  });

  it("suffixes the second column name when both ends are the same table", () => {
    const operation = buildBatch(
      buildUsersAndPostsSchema(),
      joinTables("tbl_users", "tbl_users"),
    );

    expect(listJunctionColumnNames(operation)).toStrictEqual([
      "users_id",
      "users_id_2",
    ]);
  });

  it("suffixes a name that collides across different tables", () => {
    const schema = buildLeftAndRightSchema(
      { tableName: "a_b", keyColumnName: "c" },
      { tableName: "a", keyColumnName: "b_c" },
    );

    const operation = buildBatch(schema, joinTables("tbl_left", "tbl_right"));

    expect(listJunctionColumnNames(operation)).toStrictEqual([
      "a_b_c",
      "a_b_c_2",
    ]);
  });

  it("compares generated names without regard to case", () => {
    const schema = buildLeftAndRightSchema(
      { tableName: "Users", keyColumnName: "ID" },
      { tableName: "users", keyColumnName: "id" },
    );

    const operation = buildBatch(schema, joinTables("tbl_left", "tbl_right"));

    expect(listJunctionColumnNames(operation)).toStrictEqual([
      "Users_ID",
      "users_id_2",
    ]);
  });

  it("uses the smallest suffix that no earlier generated name has taken", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_users",
          primaryKeyColumnIds: ["col_users_id", "col_users_id_2"],
        }),
      ],
      columns: [
        makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
        makeColumn({
          id: "col_users_id_2",
          tableId: "tbl_users",
          name: "id_2",
        }),
      ],
    });

    const operation = buildBatch(schema, joinTables("tbl_users", "tbl_users"));

    expect(listJunctionColumnNames(operation)).toStrictEqual([
      "users_id",
      "users_id_2",
      "users_id_3",
      "users_id_2_2",
    ]);
  });

  it("keeps a generated name longer than 63 bytes without truncating it", () => {
    const longTableName = "a".repeat(70);
    const schema = buildLeftAndRightSchema(
      { tableName: longTableName, keyColumnName: "id" },
      { tableName: "b", keyColumnName: "id" },
    );

    const operation = buildBatch(schema, joinTables("tbl_left", "tbl_right"));

    expect(listJunctionColumnNames(operation)).toStrictEqual([
      `${longTableName}_id`,
      "b_id",
    ]);
  });

  it("sets onDelete cascade and onUpdate noAction on both relations", () => {
    const operation = buildBatch(
      buildUsersAndPostsSchema(),
      joinTables("tbl_users", "tbl_posts"),
    );

    expect(
      listStepsOfType(operation, "addRelation").map(({ relation }) => ({
        onDelete: relation.onDelete,
        onUpdate: relation.onUpdate,
      })),
    ).toStrictEqual([
      { onDelete: "cascade", onUpdate: "noAction" },
      { onDelete: "cascade", onUpdate: "noAction" },
    ]);
  });

  it("generates ids in a fixed order from the id generator", () => {
    const operation = buildBatch(
      buildOrdersAndProductsSchema(),
      joinTables("tbl_orders", "tbl_products"),
    );

    expect([
      ...listStepsOfType(operation, "addTable").map((step) => step.table.id),
      ...listStepsOfType(operation, "addColumn").map((step) => step.column.id),
      ...listStepsOfType(operation, "addRelation").map(
        (step) => step.relation.id,
      ),
    ]).toStrictEqual([
      "tbl_1",
      "col_2",
      "col_3",
      "col_4",
      "col_5",
      "rel_6",
      "rel_7",
    ]);
  });

  it("returns table-not-found at leftTableId for a missing left table", () => {
    const result = buildManyToMany(
      buildSchemaWithKeylessTable(),
      joinTables("tbl_missing", "tbl_missing"),
      createCounterIdGenerator(),
    );

    expect(unwrapError(result)).toStrictEqual({
      code: "table-not-found",
      path: ["leftTableId"],
    });
  });

  it("returns table-not-found at rightTableId before checking primary keys", () => {
    const result = buildManyToMany(
      buildSchemaWithKeylessTable(),
      joinTables("tbl_tags", "tbl_missing"),
      createCounterIdGenerator(),
    );

    expect(unwrapError(result)).toStrictEqual({
      code: "table-not-found",
      path: ["rightTableId"],
    });
  });

  it("returns primary-key-missing at leftTableId when the left table has no primary key", () => {
    const result = buildManyToMany(
      buildSchemaWithKeylessTable(),
      joinTables("tbl_tags", "tbl_tags"),
      createCounterIdGenerator(),
    );

    expect(unwrapError(result)).toStrictEqual({
      code: "primary-key-missing",
      path: ["leftTableId"],
    });
  });

  it("returns primary-key-missing at rightTableId when the right table has no primary key", () => {
    const result = buildManyToMany(
      buildSchemaWithKeylessTable(),
      joinTables("tbl_users", "tbl_tags"),
      createCounterIdGenerator(),
    );

    expect(unwrapError(result)).toStrictEqual({
      code: "primary-key-missing",
      path: ["rightTableId"],
    });
  });

  it("restores the original schema when the inverse of the applied batch is applied", () => {
    const schema = buildOrdersAndProductsSchema();
    const operation = buildBatch(
      schema,
      joinTables("tbl_orders", "tbl_products"),
    );

    const applied = unwrapOk(applyOperation(schema, operation));
    const undone = unwrapOk(applyOperation(applied.schema, applied.inverse));

    expect(undone.schema).toStrictEqual(buildOrdersAndProductsSchema());
  });

  it("introduces no semantic issues when the junction table name is unused", () => {
    const schema = buildUsersAndPostsSchema();
    const operation = buildBatch(schema, joinTables("tbl_users", "tbl_posts"));

    const applied = unwrapOk(applyOperation(schema, operation));

    expect(findIntroducedIssues(schema, applied.schema)).toStrictEqual([]);
  });
});

describe("buildManyToMany editor criteria", () => {
  it("ED-03 creates a junction table with two one-to-many relations that one undo removes", () => {
    const schema = buildUsersAndPostsSchema();
    const operation = buildBatch(schema, joinTables("tbl_users", "tbl_posts"));

    const applied = unwrapOk(applyOperation(schema, operation));
    const undone = unwrapOk(applyOperation(applied.schema, applied.inverse));

    expect(applied.schema.tables.tbl_1?.name).toBe(JUNCTION_TABLE_NAME);
    expect(listRelationEnds(applied.schema)).toStrictEqual([
      { kind: "oneToMany", fromTableId: "tbl_1", toTableId: "tbl_users" },
      { kind: "oneToMany", fromTableId: "tbl_1", toTableId: "tbl_posts" },
    ]);
    expect(undone.schema).toStrictEqual(schema);
  });
});
