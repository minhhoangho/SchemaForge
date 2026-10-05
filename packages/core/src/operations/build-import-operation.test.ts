import { describe, expect, it } from "vitest";

import { createEmptySchema } from "../model/create-empty-schema.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { SchemaParts } from "../testing/factories.js";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeEnum,
  makeIndex,
  makeNote,
  makeRelation,
  makeSubjectArea,
  makeTable,
} from "../testing/factories.js";
import { createSampleSchema } from "../testing/sample-schema.js";
import { unwrapOk } from "../testing/unwrap-result.js";
import { applyOperation } from "./apply-operation.js";
import { buildImportOperation } from "./build-import-operation.js";
import type { ImportMode } from "./build-import-operation.js";
import type {
  BatchOperation,
  OperationOfType,
  OperationType,
} from "./operation.js";

const NEW_MODE: ImportMode = { mode: "new" };
const MERGE_AT_ZERO: ImportMode = { mode: "merge", origin: { x: 0, y: 0 } };

// One of each element: an enum column, a subject area member, a primary key,
// an index and a self relation, so every kind of reference is exercised.
function importedParts(): Required<SchemaParts> {
  return {
    name: "imported",
    enums: [
      makeEnum({ id: "enum_status", name: "status", values: ["open", "done"] }),
    ],
    subjectAreas: [makeSubjectArea({ id: "area_sales", name: "sales" })],
    tables: [
      makeTable({
        id: "tbl_orders",
        name: "orders",
        position: { x: 100, y: 50 },
        subjectAreaId: "area_sales",
        primaryKeyColumnIds: ["col_orders_id"],
      }),
    ],
    columns: [
      makeColumn({ id: "col_orders_id", tableId: "tbl_orders", name: "id" }),
      makeColumn({
        id: "col_orders_parent",
        tableId: "tbl_orders",
        name: "parent_id",
        isNullable: true,
      }),
      makeColumn({
        id: "col_orders_status",
        tableId: "tbl_orders",
        name: "status",
        type: { kind: "enum", enumId: "enum_status" },
      }),
    ],
    indexes: [
      makeIndex({
        id: "idx_orders_status",
        tableId: "tbl_orders",
        name: "orders_status_idx",
        columnIds: ["col_orders_status"],
      }),
    ],
    relations: [
      makeRelation({
        id: "rel_orders_parent",
        fromTableId: "tbl_orders",
        toTableId: "tbl_orders",
        columnPairs: [
          { fromColumnId: "col_orders_parent", toColumnId: "col_orders_id" },
        ],
      }),
    ],
    notes: [
      makeNote({ id: "note_todo", text: "todo", position: { x: 40, y: 400 } }),
    ],
  };
}

function buildImportedSchema(): SchemaDocument {
  return buildSchema(importedParts());
}

function buildMerge(
  targetParts: SchemaParts,
  importedParts: SchemaParts,
  mode: ImportMode = MERGE_AT_ZERO,
): ReturnType<typeof buildImportOperation> {
  return buildImportOperation(
    buildSchema(targetParts),
    buildSchema(importedParts),
    mode,
    createCounterIdGenerator(),
  );
}

function stepsOfType<Type extends OperationType>(
  operation: BatchOperation,
  type: Type,
): readonly OperationOfType<Type>[] {
  return operation.operations.filter(
    (step): step is OperationOfType<Type> => step.type === type,
  );
}

function addedTableNames(operation: BatchOperation): readonly string[] {
  return stepsOfType(operation, "addTable").map((step) => step.table.name);
}

describe("buildImportOperation", () => {
  it("applies a new-mode batch on an empty schema to the imported document", () => {
    const imported = createSampleSchema();

    const { operation } = buildImportOperation(
      createEmptySchema(imported.name),
      imported,
      NEW_MODE,
      createCounterIdGenerator(),
    );

    const applied = applyOperation(createEmptySchema(imported.name), operation);
    expect(unwrapOk(applied).schema).toStrictEqual(imported);
  });

  it("reports no diagnostics in new mode", () => {
    const imported = buildImportedSchema();

    const { diagnostics } = buildImportOperation(
      createEmptySchema("new"),
      imported,
      NEW_MODE,
      createCounterIdGenerator(),
    );

    expect(diagnostics).toStrictEqual([]);
  });

  it("keeps duplicate table names in new mode", () => {
    const { operation } = buildImportOperation(
      createEmptySchema("new"),
      buildSchema({
        tables: [
          makeTable({ id: "tbl_a", name: "users" }),
          makeTable({ id: "tbl_b", name: "Users" }),
        ],
      }),
      NEW_MODE,
      createCounterIdGenerator(),
    );

    expect(addedTableNames(operation)).toStrictEqual(["Users", "users"]);
  });

  it.each<[string, SchemaParts]>([
    ["a table", { tables: [makeTable({ id: "tbl_users" })] }],
    ["an enum", { enums: [makeEnum({ id: "enum_status" })] }],
    [
      "a subject area",
      { subjectAreas: [makeSubjectArea({ id: "area_sales" })] },
    ],
    ["a note", { notes: [makeNote({ id: "note_todo" })] }],
  ])("throws in new mode when the target is not empty (%s)", (_, parts) => {
    expect(() =>
      buildImportOperation(
        buildSchema(parts),
        buildImportedSchema(),
        NEW_MODE,
        createCounterIdGenerator(),
      ),
    ).toThrow(Error);
  });

  it("gives every merged element a fresh id and rewrites references", () => {
    const { operation, diagnostics } = buildImportOperation(
      createEmptySchema("target"),
      buildImportedSchema(),
      { mode: "merge", origin: { x: 40, y: 50 } },
      createCounterIdGenerator(),
    );

    expect({ operation, diagnostics }).toStrictEqual({
      operation: {
        type: "batch",
        operations: [
          {
            type: "addEnum",
            enum: { id: "enum_1", name: "status", values: ["open", "done"] },
          },
          {
            type: "addSubjectArea",
            subjectArea: { id: "area_2", name: "sales" },
          },
          {
            type: "addTable",
            table: {
              id: "tbl_3",
              name: "orders",
              comment: "",
              position: { x: 100, y: 50 },
              subjectAreaId: "area_2",
            },
          },
          {
            type: "addColumn",
            column: makeColumn({ id: "col_4", tableId: "tbl_3", name: "id" }),
            insertAt: 0,
          },
          {
            type: "addColumn",
            column: makeColumn({
              id: "col_5",
              tableId: "tbl_3",
              name: "parent_id",
              isNullable: true,
            }),
            insertAt: 1,
          },
          {
            type: "addColumn",
            column: makeColumn({
              id: "col_6",
              tableId: "tbl_3",
              name: "status",
              type: { kind: "enum", enumId: "enum_1" },
            }),
            insertAt: 2,
          },
          { type: "setPrimaryKey", tableId: "tbl_3", columnIds: ["col_4"] },
          {
            type: "addIndex",
            index: {
              id: "idx_7",
              tableId: "tbl_3",
              name: "orders_status_idx",
              columnIds: ["col_6"],
              isUnique: false,
            },
          },
          {
            type: "addRelation",
            relation: makeRelation({
              id: "rel_8",
              fromTableId: "tbl_3",
              toTableId: "tbl_3",
              columnPairs: [{ fromColumnId: "col_5", toColumnId: "col_4" }],
            }),
          },
          {
            type: "addNote",
            note: { id: "note_9", text: "todo", position: { x: 40, y: 400 } },
          },
        ],
      },
      diagnostics: [],
    });
  });

  it.each<[string, SchemaParts]>([
    ["a table", { tables: [makeTable({ id: "tbl_users", name: "users" })] }],
    ["an enum", { enums: [makeEnum({ id: "enum_users", name: "USERS" })] }],
  ])(
    "renames a table that clashes with %s and reports table-renamed",
    (_, targetParts) => {
      const result = buildMerge(targetParts, {
        tables: [makeTable({ id: "tbl_a", name: "Users" })],
      });

      expect({
        names: addedTableNames(result.operation),
        diagnostics: result.diagnostics,
      }).toStrictEqual({
        names: ["Users_2"],
        diagnostics: [
          {
            code: "table-renamed",
            location: null,
            path: ["tables", "tbl_1", "name"],
          },
        ],
      });
    },
  );

  it("renames an imported table that clashes with another imported name", () => {
    const result = buildMerge(
      {},
      {
        enums: [makeEnum({ id: "enum_a", name: "users" })],
        tables: [makeTable({ id: "tbl_a", name: "users" })],
      },
    );

    expect(addedTableNames(result.operation)).toStrictEqual(["users_2"]);
  });

  it("renames an enum that clashes with a table", () => {
    const result = buildMerge(
      { tables: [makeTable({ id: "tbl_status", name: "status" })] },
      { enums: [makeEnum({ id: "enum_a", name: "Status" })] },
    );

    expect({
      names: stepsOfType(result.operation, "addEnum").map(
        (step) => step.enum.name,
      ),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      names: ["Status_2"],
      diagnostics: [
        {
          code: "enum-renamed",
          location: null,
          path: ["enums", "enum_1", "name"],
        },
      ],
    });
  });

  it.each<[string, SchemaParts]>([
    [
      "an index",
      {
        tables: [makeTable({ id: "tbl_users" })],
        columns: [makeColumn({ id: "col_users_id", tableId: "tbl_users" })],
        indexes: [
          makeIndex({
            id: "idx_users",
            tableId: "tbl_users",
            name: "lookup_idx",
            columnIds: ["col_users_id"],
          }),
        ],
      },
    ],
    [
      "a table name",
      { tables: [makeTable({ id: "tbl_users", name: "LOOKUP_IDX" })] },
    ],
  ])("renames an index that clashes with %s", (_, targetParts) => {
    const result = buildMerge(targetParts, {
      tables: [makeTable({ id: "tbl_a", name: "accounts" })],
      columns: [makeColumn({ id: "col_a", tableId: "tbl_a" })],
      indexes: [
        makeIndex({
          id: "idx_a",
          tableId: "tbl_a",
          name: "lookup_idx",
          columnIds: ["col_a"],
        }),
      ],
    });

    expect({
      names: stepsOfType(result.operation, "addIndex").map(
        (step) => step.index.name,
      ),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      names: ["lookup_idx_2"],
      diagnostics: [
        {
          code: "index-renamed",
          location: null,
          path: ["indexes", "idx_3", "name"],
        },
      ],
    });
  });

  it("renames an index that clashes with the new name of a merged table", () => {
    const result = buildMerge(
      { tables: [makeTable({ id: "tbl_users", name: "users" })] },
      {
        tables: [makeTable({ id: "tbl_a", name: "users" })],
        columns: [makeColumn({ id: "col_a", tableId: "tbl_a" })],
        indexes: [
          makeIndex({
            id: "idx_a",
            tableId: "tbl_a",
            name: "users_2",
            columnIds: ["col_a"],
          }),
        ],
      },
    );

    expect(
      stepsOfType(result.operation, "addIndex").map((step) => step.index.name),
    ).toStrictEqual(["users_2_2"]);
  });

  it("renames a subject area that clashes", () => {
    const result = buildMerge(
      { subjectAreas: [makeSubjectArea({ id: "area_sales", name: "sales" })] },
      { subjectAreas: [makeSubjectArea({ id: "area_a", name: "Sales" })] },
    );

    expect({
      names: stepsOfType(result.operation, "addSubjectArea").map(
        (step) => step.subjectArea.name,
      ),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      names: ["Sales_2"],
      diagnostics: [
        {
          code: "subject-area-renamed",
          location: null,
          path: ["subjectAreas", "area_1", "name"],
        },
      ],
    });
  });

  it("keeps column names and enum values", () => {
    const target = buildImportedSchema();

    const { operation } = buildImportOperation(
      target,
      buildImportedSchema(),
      MERGE_AT_ZERO,
      createCounterIdGenerator(),
    );

    expect({
      columns: stepsOfType(operation, "addColumn").map(
        (step) => step.column.name,
      ),
      values: stepsOfType(operation, "addEnum").map((step) => step.enum.values),
    }).toStrictEqual({
      columns: ["id", "parent_id", "status"],
      values: [["open", "done"]],
    });
  });

  it("moves merged tables and notes so their top left corner is at the origin", () => {
    const result = buildMerge(
      {},
      {
        tables: [
          makeTable({ id: "tbl_a", name: "a", position: { x: 100, y: 50 } }),
          makeTable({ id: "tbl_b", name: "b", position: { x: 300, y: 20 } }),
        ],
        notes: [makeNote({ id: "note_a", position: { x: 40, y: 400 } })],
      },
      { mode: "merge", origin: { x: 1000, y: 200 } },
    );

    expect({
      tables: stepsOfType(result.operation, "addTable").map(
        (step) => step.table.position,
      ),
      notes: stepsOfType(result.operation, "addNote").map(
        (step) => step.note.position,
      ),
    }).toStrictEqual({
      tables: [
        { x: 1060, y: 230 },
        { x: 1260, y: 200 },
      ],
      notes: [{ x: 1000, y: 580 }],
    });
  });

  it("orders steps as enums, subject areas, tables with columns and keys, indexes, relations, notes", () => {
    const imported = buildSchema({
      ...importedParts(),
      tables: [
        ...importedParts().tables,
        makeTable({
          id: "tbl_z",
          name: "zones",
          primaryKeyColumnIds: ["col_z"],
        }),
      ],
      columns: [
        ...importedParts().columns,
        makeColumn({ id: "col_z", tableId: "tbl_z" }),
      ],
    });

    const { operation } = buildImportOperation(
      createEmptySchema("target"),
      imported,
      MERGE_AT_ZERO,
      createCounterIdGenerator(),
    );

    expect(operation.operations.map((step) => step.type)).toStrictEqual([
      "addEnum",
      "addSubjectArea",
      "addTable",
      "addColumn",
      "addColumn",
      "addColumn",
      "setPrimaryKey",
      "addTable",
      "addColumn",
      "setPrimaryKey",
      "addIndex",
      "addRelation",
      "addNote",
    ]);
  });

  it.each<[string, ImportMode]>([
    ["new", NEW_MODE],
    ["merge", MERGE_AT_ZERO],
  ])("never nests batches (%s mode)", (_, mode) => {
    const { operation } = buildImportOperation(
      createEmptySchema("target"),
      createSampleSchema(),
      mode,
      createCounterIdGenerator(),
    );

    expect(operation.operations.map((step) => step.type)).not.toContain(
      "batch",
    );
  });

  it("does not rename the schema", () => {
    const target = buildSchema({
      name: "mine",
      tables: [makeTable({ id: "tbl_users" })],
    });
    const { operation } = buildImportOperation(
      target,
      buildImportedSchema(),
      MERGE_AT_ZERO,
      createCounterIdGenerator(),
    );

    expect(unwrapOk(applyOperation(target, operation)).schema.name).toBe(
      "mine",
    );
  });
});
