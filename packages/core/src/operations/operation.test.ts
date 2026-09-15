import { describe, expect, expectTypeOf, it } from "vitest";

import { operationShape } from "./operation.js";
import type {
  BatchOperation,
  Operation,
  OperationOfType,
} from "./operation.js";

const TABLE = {
  id: "tbl_1",
  name: "users",
  comment: "",
  position: { x: 0, y: 0 },
  subjectAreaId: null,
};

const COLUMN = {
  id: "col_1",
  tableId: "tbl_1",
  name: "email",
  type: { kind: "varchar", length: 255 },
  isNullable: false,
  defaultValue: null,
  isUnique: true,
  isAutoIncrement: false,
  comment: "",
};

const RELATION = {
  id: "rel_1",
  kind: "oneToMany",
  fromTableId: "tbl_2",
  toTableId: "tbl_1",
  columnPairs: [{ fromColumnId: "col_4", toColumnId: "col_1" }],
  onDelete: "cascade",
  onUpdate: "noAction",
};

const INDEX = {
  id: "idx_1",
  tableId: "tbl_1",
  name: "users_email_idx",
  columnIds: ["col_1"],
  isUnique: true,
};

const ENUM = {
  id: "enum_1",
  name: "status",
  values: ["active", "inactive"],
};

const SUBJECT_AREA = { id: "area_1", name: "Sales" };

const NOTE = { id: "note_1", text: "Follow up", position: { x: 5, y: 5 } };

// One valid example per operation type, including the recursive `batch`.
const VALID_OPERATIONS = [
  { type: "renameSchema", value: { type: "renameSchema", name: "Shop" } },
  { type: "addTable", value: { type: "addTable", table: TABLE } },
  {
    type: "updateTable",
    value: {
      type: "updateTable",
      tableId: "tbl_1",
      changes: { name: "Customers" },
    },
  },
  {
    type: "setPrimaryKey",
    value: { type: "setPrimaryKey", tableId: "tbl_1", columnIds: ["col_1"] },
  },
  { type: "removeTable", value: { type: "removeTable", tableId: "tbl_1" } },
  {
    type: "addColumn",
    value: { type: "addColumn", column: COLUMN, insertAt: 0 },
  },
  {
    type: "updateColumn",
    value: {
      type: "updateColumn",
      columnId: "col_1",
      changes: { name: "email2" },
    },
  },
  {
    type: "moveColumn",
    value: { type: "moveColumn", columnId: "col_1", toIndex: 2 },
  },
  { type: "removeColumn", value: { type: "removeColumn", columnId: "col_1" } },
  { type: "addRelation", value: { type: "addRelation", relation: RELATION } },
  {
    type: "updateRelation",
    value: {
      type: "updateRelation",
      relationId: "rel_1",
      changes: { onDelete: "restrict" },
    },
  },
  {
    type: "removeRelation",
    value: { type: "removeRelation", relationId: "rel_1" },
  },
  { type: "addIndex", value: { type: "addIndex", index: INDEX } },
  {
    type: "updateIndex",
    value: {
      type: "updateIndex",
      indexId: "idx_1",
      changes: { isUnique: false },
    },
  },
  { type: "removeIndex", value: { type: "removeIndex", indexId: "idx_1" } },
  { type: "addEnum", value: { type: "addEnum", enum: ENUM } },
  {
    type: "updateEnum",
    value: {
      type: "updateEnum",
      enumId: "enum_1",
      changes: { values: ["active"] },
    },
  },
  { type: "removeEnum", value: { type: "removeEnum", enumId: "enum_1" } },
  {
    type: "addSubjectArea",
    value: { type: "addSubjectArea", subjectArea: SUBJECT_AREA },
  },
  {
    type: "updateSubjectArea",
    value: {
      type: "updateSubjectArea",
      subjectAreaId: "area_1",
      changes: { name: "Marketing" },
    },
  },
  {
    type: "removeSubjectArea",
    value: { type: "removeSubjectArea", subjectAreaId: "area_1" },
  },
  { type: "addNote", value: { type: "addNote", note: NOTE } },
  {
    type: "updateNote",
    value: {
      type: "updateNote",
      noteId: "note_1",
      changes: { text: "Done" },
    },
  },
  { type: "removeNote", value: { type: "removeNote", noteId: "note_1" } },
  {
    type: "moveElements",
    value: {
      type: "moveElements",
      moves: [{ elementId: "tbl_1", position: { x: 1, y: 1 } }],
    },
  },
  {
    type: "batch",
    value: {
      type: "batch",
      operations: [{ type: "renameSchema", name: "Shop" }],
    },
  },
] as const;

// Zod issue paths are PropertyKey[]; JSON has no symbol keys, so this only
// narrows the type for the assertion below.
function firstIssuePath(
  result: ReturnType<typeof operationShape.safeParse>,
): readonly (string | number)[] {
  if (result.success) {
    throw new Error("Expected the operation shape to reject the input");
  }
  const [issue] = result.error.issues;
  if (issue === undefined) {
    throw new Error("Expected at least one issue");
  }
  return issue.path.filter(
    (segment): segment is string | number => typeof segment !== "symbol",
  );
}

describe("operationShape", () => {
  it.each(VALID_OPERATIONS)("accepts a valid $type operation", ({ value }) => {
    expect(operationShape.safeParse(value).success).toBe(true);
  });

  it("rejects an unknown operation type at the type path", () => {
    const result = operationShape.safeParse({ type: "doesNotExist" });

    expect(firstIssuePath(result)).toStrictEqual(["type"]);
  });

  it("rejects an extra field on an operation", () => {
    const result = operationShape.safeParse({
      type: "removeTable",
      tableId: "tbl_1",
      extra: true,
    });

    expect(result.success).toBe(false);
  });

  it("reports a nested error with the full path inside a batch", () => {
    const result = operationShape.safeParse({
      type: "batch",
      operations: [
        { type: "removeTable", tableId: "tbl_1" },
        { type: "removeTable" },
      ],
    });

    expect(firstIssuePath(result)).toStrictEqual(["operations", 1, "tableId"]);
  });

  it("accepts updateTable with empty changes", () => {
    const result = operationShape.safeParse({
      type: "updateTable",
      tableId: "tbl_1",
      changes: {},
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unknown key inside changes", () => {
    const result = operationShape.safeParse({
      type: "updateTable",
      tableId: "tbl_1",
      changes: { columnIds: ["col_1"] },
    });

    expect(result.success).toBe(false);
  });

  it("requires name in updateSubjectArea changes", () => {
    const result = operationShape.safeParse({
      type: "updateSubjectArea",
      subjectAreaId: "area_1",
      changes: {},
    });

    expect(result.success).toBe(false);
  });

  it("accepts table and note ids in moveElements", () => {
    const result = operationShape.safeParse({
      type: "moveElements",
      moves: [
        { elementId: "tbl_1", position: { x: 1, y: 1 } },
        { elementId: "note_1", position: { x: 2, y: 2 } },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a column id in moveElements", () => {
    const result = operationShape.safeParse({
      type: "moveElements",
      moves: [{ elementId: "col_1", position: { x: 1, y: 1 } }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a negative insertAt", () => {
    const result = operationShape.safeParse({
      type: "addColumn",
      column: COLUMN,
      insertAt: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects addTable carrying columnIds", () => {
    const result = operationShape.safeParse({
      type: "addTable",
      table: { ...TABLE, columnIds: ["col_1"] },
    });

    expect(result.success).toBe(false);
  });

  it("rejects addRelation with no column pairs", () => {
    const result = operationShape.safeParse({
      type: "addRelation",
      relation: { ...RELATION, columnPairs: [] },
    });

    expect(result.success).toBe(false);
  });
});

describe("operation types", () => {
  it("narrows OperationOfType addTable to an operation without column lists", () => {
    expectTypeOf<OperationOfType<"addTable">["table"]>().not.toHaveProperty(
      "columnIds",
    );
  });

  it("infers BatchOperation operations as a readonly Operation array", () => {
    expectTypeOf<BatchOperation["operations"]>().toEqualTypeOf<
      readonly Operation[]
    >();
  });
});
