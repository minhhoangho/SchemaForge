import { describe, expect, it } from "vitest";

import type { DocumentPath } from "../document-path.js";
import type { ColumnId, TableId } from "../model/ids.js";
import type { Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Index } from "../model/table-index.js";
import { MAX_BATCH_DEPTH } from "../parse/parse-operation.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeNote,
  makeRelation,
  makeSubjectArea,
  makeTable,
} from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import { applyOperation } from "./apply-operation.js";
import type { Operation, OperationOfType, OperationType } from "./operation.js";

// Two tables with a relation, an index, an enum in use, a subject area and a
// note: every one of the 26 operation examples below applies to it and
// changes something.
function buildShopSchema(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({
        id: "tbl_users",
        subjectAreaId: "area_sales",
        primaryKeyColumnIds: ["col_users_id"],
      }),
      makeTable({
        id: "tbl_orders",
        position: { x: 300, y: 0 },
        primaryKeyColumnIds: ["col_orders_id"],
      }),
    ],
    columns: [
      makeColumn({ id: "col_users_id", tableId: "tbl_users" }),
      makeColumn({
        id: "col_users_email",
        tableId: "tbl_users",
        type: { kind: "varchar", length: 255 },
      }),
      makeColumn({
        id: "col_users_status",
        tableId: "tbl_users",
        type: { kind: "enum", enumId: "enum_status" },
      }),
      makeColumn({ id: "col_orders_id", tableId: "tbl_orders" }),
      makeColumn({ id: "col_orders_user_id", tableId: "tbl_orders" }),
    ],
    relations: [
      makeRelation({
        id: "rel_orders_user",
        fromTableId: "tbl_orders",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_orders_user_id", toColumnId: "col_users_id" },
        ],
      }),
    ],
    indexes: [
      makeIndex({
        id: "idx_users_email",
        tableId: "tbl_users",
        columnIds: ["col_users_email"],
        isUnique: true,
      }),
    ],
    enums: [
      makeEnum({ id: "enum_status", values: ["active", "archived"] }),
      makeEnum({ id: "enum_unused" }),
    ],
    subjectAreas: [makeSubjectArea({ id: "area_sales" })],
    notes: [makeNote({ id: "note_todo", position: { x: 0, y: 400 } })],
  });
}

// Keyed by type, so adding an operation type without an example here is a
// compile error.
const OPERATION_EXAMPLES: {
  readonly [Type in OperationType]: OperationOfType<Type>;
} = {
  renameSchema: { type: "renameSchema", name: "store" },
  addTable: {
    type: "addTable",
    table: {
      id: "tbl_products",
      name: "products",
      comment: "",
      position: { x: 600, y: 0 },
      subjectAreaId: "area_sales",
    },
  },
  updateTable: {
    type: "updateTable",
    tableId: "tbl_users",
    changes: { name: "customers", subjectAreaId: null },
  },
  setPrimaryKey: {
    type: "setPrimaryKey",
    tableId: "tbl_users",
    columnIds: ["col_users_email", "col_users_id"],
  },
  removeTable: { type: "removeTable", tableId: "tbl_users" },
  addColumn: {
    type: "addColumn",
    column: makeColumn({
      id: "col_orders_total",
      tableId: "tbl_orders",
      type: { kind: "decimal", precision: 10, scale: 2 },
    }),
    insertAt: 1,
  },
  updateColumn: {
    type: "updateColumn",
    columnId: "col_users_email",
    changes: { name: "mail", isNullable: true, comment: "login" },
  },
  moveColumn: { type: "moveColumn", columnId: "col_users_status", toIndex: 0 },
  removeColumn: { type: "removeColumn", columnId: "col_users_id" },
  addRelation: {
    type: "addRelation",
    relation: makeRelation({
      id: "rel_users_order",
      kind: "oneToOne",
      fromTableId: "tbl_users",
      toTableId: "tbl_orders",
      columnPairs: [
        { fromColumnId: "col_users_id", toColumnId: "col_orders_id" },
      ],
    }),
  },
  updateRelation: {
    type: "updateRelation",
    relationId: "rel_orders_user",
    changes: { kind: "oneToOne", onDelete: "cascade" },
  },
  removeRelation: { type: "removeRelation", relationId: "rel_orders_user" },
  addIndex: {
    type: "addIndex",
    index: makeIndex({
      id: "idx_orders_user",
      tableId: "tbl_orders",
      columnIds: ["col_orders_user_id"],
    }),
  },
  updateIndex: {
    type: "updateIndex",
    indexId: "idx_users_email",
    changes: { name: "users_email_idx", isUnique: false },
  },
  removeIndex: { type: "removeIndex", indexId: "idx_users_email" },
  addEnum: {
    type: "addEnum",
    enum: makeEnum({ id: "enum_role", values: ["admin", "member"] }),
  },
  updateEnum: {
    type: "updateEnum",
    enumId: "enum_status",
    changes: { values: ["active", "archived", "banned"] },
  },
  removeEnum: { type: "removeEnum", enumId: "enum_unused" },
  addSubjectArea: {
    type: "addSubjectArea",
    subjectArea: makeSubjectArea({ id: "area_billing" }),
  },
  updateSubjectArea: {
    type: "updateSubjectArea",
    subjectAreaId: "area_sales",
    changes: { name: "Sales team" },
  },
  removeSubjectArea: { type: "removeSubjectArea", subjectAreaId: "area_sales" },
  addNote: {
    type: "addNote",
    note: makeNote({ id: "note_new", position: { x: 100, y: 100 } }),
  },
  updateNote: {
    type: "updateNote",
    noteId: "note_todo",
    changes: { text: "done" },
  },
  removeNote: { type: "removeNote", noteId: "note_todo" },
  moveElements: {
    type: "moveElements",
    moves: [
      { elementId: "tbl_users", position: { x: 50, y: 60 } },
      { elementId: "note_todo", position: { x: 10, y: 20 } },
    ],
  },
  batch: {
    type: "batch",
    operations: [
      { type: "removeTable", tableId: "tbl_orders" },
      {
        type: "batch",
        operations: [
          { type: "renameSchema", name: "store" },
          { type: "removeColumn", columnId: "col_users_email" },
        ],
      },
    ],
  },
};

const OPERATION_CASES = Object.values(OPERATION_EXAMPLES).map(
  (operation): [OperationType, Operation] => [operation.type, operation],
);

// Order items with a composite primary key, two indexes and relations on both
// sides: items point to orders and products, shipments point to items.
function buildOrderItemsSchema(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({ id: "tbl_orders", primaryKeyColumnIds: ["col_orders_id"] }),
      makeTable({
        id: "tbl_products",
        primaryKeyColumnIds: ["col_products_id"],
      }),
      makeTable({
        id: "tbl_items",
        comment: "order lines",
        position: { x: 200, y: 100 },
        primaryKeyColumnIds: ["col_items_order_id", "col_items_product_id"],
      }),
      makeTable({
        id: "tbl_shipments",
        primaryKeyColumnIds: ["col_shipments_id"],
      }),
    ],
    columns: [
      makeColumn({ id: "col_orders_id", tableId: "tbl_orders" }),
      makeColumn({ id: "col_products_id", tableId: "tbl_products" }),
      makeColumn({ id: "col_items_order_id", tableId: "tbl_items" }),
      makeColumn({ id: "col_items_product_id", tableId: "tbl_items" }),
      makeColumn({ id: "col_items_quantity", tableId: "tbl_items" }),
      makeColumn({ id: "col_shipments_id", tableId: "tbl_shipments" }),
      makeColumn({ id: "col_shipments_order_id", tableId: "tbl_shipments" }),
      makeColumn({ id: "col_shipments_product_id", tableId: "tbl_shipments" }),
    ],
    indexes: [
      makeIndex({
        id: "idx_items_product",
        tableId: "tbl_items",
        columnIds: ["col_items_product_id"],
      }),
      makeIndex({
        id: "idx_items_product_quantity",
        tableId: "tbl_items",
        columnIds: ["col_items_product_id", "col_items_quantity"],
        isUnique: true,
      }),
      makeIndex({
        id: "idx_shipments_order",
        tableId: "tbl_shipments",
        columnIds: ["col_shipments_order_id"],
      }),
    ],
    relations: [
      makeRelation({
        id: "rel_items_order",
        fromTableId: "tbl_items",
        toTableId: "tbl_orders",
        columnPairs: [
          { fromColumnId: "col_items_order_id", toColumnId: "col_orders_id" },
        ],
      }),
      makeRelation({
        id: "rel_items_product",
        fromTableId: "tbl_items",
        toTableId: "tbl_products",
        columnPairs: [
          {
            fromColumnId: "col_items_product_id",
            toColumnId: "col_products_id",
          },
        ],
      }),
      makeRelation({
        id: "rel_shipments_item",
        fromTableId: "tbl_shipments",
        toTableId: "tbl_items",
        columnPairs: [
          {
            fromColumnId: "col_shipments_order_id",
            toColumnId: "col_items_order_id",
          },
          {
            fromColumnId: "col_shipments_product_id",
            toColumnId: "col_items_product_id",
          },
        ],
      }),
    ],
  });
}

function buildEmployeesSchema(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_employees",
        primaryKeyColumnIds: ["col_employees_id"],
      }),
    ],
    columns: [
      makeColumn({ id: "col_employees_id", tableId: "tbl_employees" }),
      makeColumn({
        id: "col_employees_manager_id",
        tableId: "tbl_employees",
        isNullable: true,
      }),
    ],
    relations: [
      makeRelation({
        id: "rel_employees_manager",
        fromTableId: "tbl_employees",
        toTableId: "tbl_employees",
        columnPairs: [
          {
            fromColumnId: "col_employees_manager_id",
            toColumnId: "col_employees_id",
          },
        ],
        onDelete: "setNull",
      }),
    ],
  });
}

function buildSubjectAreasSchema(): SchemaDocument {
  return buildSchema({
    subjectAreas: [
      makeSubjectArea({ id: "area_sales" }),
      makeSubjectArea({ id: "area_hr" }),
    ],
    tables: [
      makeTable({ id: "tbl_orders", subjectAreaId: "area_sales" }),
      makeTable({ id: "tbl_customers", subjectAreaId: "area_sales" }),
      makeTable({ id: "tbl_employees", subjectAreaId: "area_hr" }),
      makeTable({ id: "tbl_settings" }),
    ],
  });
}

function applyThenUndo(
  schema: SchemaDocument,
  operation: Operation,
): SchemaDocument {
  const applied = unwrapOk(applyOperation(schema, operation));
  return unwrapOk(applyOperation(applied.schema, applied.inverse)).schema;
}

function nestInBatches(depth: number, leaf: Operation): Operation {
  let operation = leaf;
  for (let level = 0; level < depth; level += 1) {
    operation = { type: "batch", operations: [operation] };
  }
  return operation;
}

function pathThroughBatches(count: number): DocumentPath {
  return Array.from({ length: count }, () => ["operations", 0]).flat();
}

function findRelationsTouchingTable(
  schema: SchemaDocument,
  tableId: TableId,
): readonly Relation[] {
  return Object.values(schema.relations).filter(
    (relation) =>
      relation.fromTableId === tableId || relation.toTableId === tableId,
  );
}

function findRelationsUsingColumn(
  schema: SchemaDocument,
  columnId: ColumnId,
): readonly Relation[] {
  return Object.values(schema.relations).filter((relation) =>
    relation.columnPairs.some(
      (pair) => pair.fromColumnId === columnId || pair.toColumnId === columnId,
    ),
  );
}

function findIndexesUsingColumn(
  schema: SchemaDocument,
  columnId: ColumnId,
): readonly Index[] {
  return Object.values(schema.indexes).filter((index) =>
    index.columnIds.includes(columnId),
  );
}

describe("applyOperation shape check", () => {
  it("returns invalid-shape with the operation path when the shape is invalid", () => {
    const operation: Operation = {
      type: "batch",
      operations: [
        { type: "moveColumn", columnId: "col_users_id", toIndex: -1 },
        { type: "removeTable", tableId: "tbl_not valid" },
      ],
    };

    const error = unwrapError(applyOperation(buildShopSchema(), operation));

    expect(error).toStrictEqual({
      code: "invalid-shape",
      path: ["operations", 0, "toIndex"],
    });
  });

  it("returns invalid-shape for a batch deeper than MAX_BATCH_DEPTH", () => {
    const operation = nestInBatches(MAX_BATCH_DEPTH + 1, {
      type: "renameSchema",
      name: "store",
    });

    const error = unwrapError(applyOperation(buildShopSchema(), operation));

    expect(error).toStrictEqual({
      code: "invalid-shape",
      path: pathThroughBatches(MAX_BATCH_DEPTH),
    });
  });
});

describe("applyOperation inverse for every operation type", () => {
  it.each(OPERATION_CASES)(
    "restores the original schema when the inverse of %s is applied",
    (_type, operation) => {
      const schema = buildShopSchema();

      const applied = unwrapOk(applyOperation(schema, operation));
      const restored = unwrapOk(
        applyOperation(applied.schema, applied.inverse),
      );

      expect(restored.schema).toStrictEqual(schema);
    },
  );

  it.each(OPERATION_CASES)(
    "produces the first result again when %s is re-applied after its inverse",
    (_type, operation) => {
      const first = unwrapOk(applyOperation(buildShopSchema(), operation));
      const undone = unwrapOk(applyOperation(first.schema, first.inverse));

      const redone = unwrapOk(applyOperation(undone.schema, operation));

      expect(redone).toStrictEqual(first);
    },
  );
});

describe("applyOperation inverse across operation groups", () => {
  it("restores a table with columns, composite primary key, indexes and relations after removeTable is undone", () => {
    const schema = buildOrderItemsSchema();

    const restored = applyThenUndo(schema, {
      type: "removeTable",
      tableId: "tbl_items",
    });

    expect(restored).toStrictEqual(schema);
  });

  it("restores a self-referencing relation after removeTable is undone", () => {
    const schema = buildEmployeesSchema();

    const restored = applyThenUndo(schema, {
      type: "removeTable",
      tableId: "tbl_employees",
    });

    expect(restored).toStrictEqual(schema);
  });

  it("restores a column that was in the primary key, two indexes and two relations after removeColumn is undone", () => {
    const schema = buildOrderItemsSchema();

    const restored = applyThenUndo(schema, {
      type: "removeColumn",
      columnId: "col_items_product_id",
    });

    expect(restored).toStrictEqual(schema);
  });

  it("restores subject area membership after removeSubjectArea is undone", () => {
    const schema = buildSubjectAreasSchema();

    const restored = applyThenUndo(schema, {
      type: "removeSubjectArea",
      subjectAreaId: "area_sales",
    });

    expect(restored).toStrictEqual(schema);
  });

  it("restores the schema after undoing a batch that contains removeTable and removeColumn", () => {
    const schema = buildOrderItemsSchema();

    const restored = applyThenUndo(schema, {
      type: "batch",
      operations: [
        { type: "removeColumn", columnId: "col_items_quantity" },
        { type: "removeTable", tableId: "tbl_items" },
      ],
    });

    expect(restored).toStrictEqual(schema);
  });
});

describe("applyOperation schema references", () => {
  it("returns the same schema reference when the operation changes nothing", () => {
    const schema = buildShopSchema();

    const applied = unwrapOk(
      applyOperation(schema, {
        type: "batch",
        operations: [
          { type: "renameSchema", name: "shop" },
          {
            type: "updateTable",
            tableId: "tbl_users",
            changes: { name: "users" },
          },
          {
            type: "moveElements",
            moves: [{ elementId: "note_todo", position: { x: 0, y: 400 } }],
          },
        ],
      }),
    );

    expect(applied.schema).toBe(schema);
  });

  it("returns a new schema reference when the operation changes something", () => {
    const schema = buildShopSchema();

    const applied = unwrapOk(
      applyOperation(schema, { type: "renameSchema", name: "store" }),
    );

    expect(applied.schema).not.toBe(schema);
  });

  it("reuses unchanged maps of the original schema", () => {
    const schema = buildShopSchema();

    const { schema: updated } = unwrapOk(
      applyOperation(schema, {
        type: "updateNote",
        noteId: "note_todo",
        changes: { text: "done" },
      }),
    );

    expect(updated.tables).toBe(schema.tables);
    expect(updated.columns).toBe(schema.columns);
    expect(updated.relations).toBe(schema.relations);
    expect(updated.indexes).toBe(schema.indexes);
    expect(updated.enums).toBe(schema.enums);
    expect(updated.subjectAreas).toBe(schema.subjectAreas);
  });
});

describe("applyOperation failure", () => {
  it("does not change the input schema when an operation fails", () => {
    const schema = buildShopSchema();

    unwrapError(
      applyOperation(schema, {
        type: "batch",
        operations: [
          { type: "removeTable", tableId: "tbl_orders" },
          { type: "removeEnum", enumId: "enum_status" },
        ],
      }),
    );

    expect(schema).toStrictEqual(buildShopSchema());
  });
});

describe("applyOperation editor criteria", () => {
  it("ED-01 leaves no relation pointing to a removed table", () => {
    const { schema } = unwrapOk(
      applyOperation(buildOrderItemsSchema(), {
        type: "removeTable",
        tableId: "tbl_items",
      }),
    );

    expect(findRelationsTouchingTable(schema, "tbl_items")).toStrictEqual([]);
  });

  it("ED-03 leaves no relation pointing to a removed column", () => {
    const { schema } = unwrapOk(
      applyOperation(buildOrderItemsSchema(), {
        type: "removeColumn",
        columnId: "col_items_product_id",
      }),
    );

    expect(
      findRelationsUsingColumn(schema, "col_items_product_id"),
    ).toStrictEqual([]);
  });

  it("ED-04 rejects an index that uses a column that does not exist", () => {
    const error = unwrapError(
      applyOperation(buildOrderItemsSchema(), {
        type: "addIndex",
        index: makeIndex({
          id: "idx_items_missing",
          tableId: "tbl_items",
          columnIds: ["col_items_quantity", "col_missing"],
        }),
      }),
    );

    expect(error).toStrictEqual({
      code: "column-not-found",
      path: ["index", "columnIds", 1],
    });
  });

  it("ED-04 rejects an index that uses a column of another table", () => {
    const error = unwrapError(
      applyOperation(buildOrderItemsSchema(), {
        type: "addIndex",
        index: makeIndex({
          id: "idx_items_order",
          tableId: "tbl_items",
          columnIds: ["col_orders_id"],
        }),
      }),
    );

    expect(error).toStrictEqual({
      code: "column-not-in-table",
      path: ["index", "columnIds", 0],
    });
  });

  it("ED-04 removes indexes that use a removed column", () => {
    const { schema } = unwrapOk(
      applyOperation(buildOrderItemsSchema(), {
        type: "removeColumn",
        columnId: "col_items_product_id",
      }),
    );

    expect(
      findIndexesUsingColumn(schema, "col_items_product_id"),
    ).toStrictEqual([]);
  });

  it("ED-05 rejects a column that uses an enum that does not exist", () => {
    const error = unwrapError(
      applyOperation(buildShopSchema(), {
        type: "addColumn",
        column: makeColumn({
          id: "col_users_role",
          tableId: "tbl_users",
          type: { kind: "enum", enumId: "enum_missing" },
        }),
        insertAt: 0,
      }),
    );

    expect(error).toStrictEqual({
      code: "enum-not-found",
      path: ["column", "type", "enumId"],
    });
  });

  it("ED-05 rejects removing an enum that a column still uses", () => {
    const error = unwrapError(
      applyOperation(buildShopSchema(), {
        type: "removeEnum",
        enumId: "enum_status",
      }),
    );

    expect(error).toStrictEqual({ code: "enum-in-use", path: ["enumId"] });
  });
});
