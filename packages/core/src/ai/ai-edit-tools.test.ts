import { describe, expect, expectTypeOf, it } from "vitest";

import type { ColumnType } from "../model/column-type.js";
import {
  AI_COLUMN_TYPE_KINDS,
  AI_EDIT_TOOL_NAMES,
  AI_TOOL_NAMES,
  aiEditToolInputShapes,
  proposeSampleDataInputShape,
  reportFindingsInputShape,
} from "./ai-edit-tools.js";
import type { AiToolName } from "./ai-edit-tools.js";

const toolInputShapes = {
  ...aiEditToolInputShapes,
  reportFindings: reportFindingsInputShape,
  proposeSampleData: proposeSampleDataInputShape,
};

function isAccepted(tool: AiToolName, input: unknown): boolean {
  return toolInputShapes[tool].safeParse(input).success;
}

const NAME_AT_LIMIT = "n".repeat(63);
const NAME_OVER_LIMIT = "n".repeat(64);

const column = { name: "id", type: { kind: "integer" }, isNullable: false };

const finding = {
  kind: "issue",
  category: "index",
  title: "Missing index",
  detail: "",
};

const minimalInputs: Readonly<Record<AiToolName, Record<string, unknown>>> = {
  renameSchema: { name: "shop" },
  createTable: { name: "users", columns: [column], primaryKey: [] },
  updateTable: { table: "users" },
  removeTable: { table: "users" },
  addColumn: { table: "users", column },
  updateColumn: { table: "users", column: "id" },
  removeColumn: { table: "users", column: "id" },
  setPrimaryKey: { table: "users", columns: ["id"] },
  addRelation: { fromTable: "orders", toTable: "users", kind: "oneToMany" },
  updateRelation: { fromTable: "orders", toTable: "users" },
  removeRelation: { fromTable: "orders", toTable: "users" },
  addIndex: { table: "users", columns: ["id"], isUnique: false },
  removeIndex: { table: "users", index: "users_id_idx" },
  createEnum: { name: "status", values: ["active"] },
  updateEnum: { enum: "status" },
  removeEnum: { enum: "status" },
  reportFindings: { findings: [finding] },
  proposeSampleData: { tables: [{ table: "users", rows: [] }] },
};

function withSampleRows(rows: readonly unknown[]): unknown {
  return { tables: [{ table: "users", rows }] };
}

function namedColumns(count: number): readonly string[] {
  return Array.from({ length: count }, (_, index) => `c${String(index)}`);
}

function sampleRow(
  count: number,
  value: string | null = "1",
): readonly { readonly column: string; readonly value: string | null }[] {
  return namedColumns(count).map((column) => ({ column, value }));
}

function nestedArray(depth: number): unknown {
  return Array.from({ length: depth }).reduce<unknown>((inner) => [inner], "1");
}

describe("AI tool names", () => {
  it("defines one input shape per schema edit tool", () => {
    expect(Object.keys(aiEditToolInputShapes)).toStrictEqual(
      AI_EDIT_TOOL_NAMES,
    );
  });

  it("lists the eighteen tools with the two non-edit tools last", () => {
    expect(AI_TOOL_NAMES).toStrictEqual([
      "renameSchema",
      "createTable",
      "updateTable",
      "removeTable",
      "addColumn",
      "updateColumn",
      "removeColumn",
      "setPrimaryKey",
      "addRelation",
      "updateRelation",
      "removeRelation",
      "addIndex",
      "removeIndex",
      "createEnum",
      "updateEnum",
      "removeEnum",
      "reportFindings",
      "proposeSampleData",
    ]);
  });

  it("covers every core column type kind", () => {
    expectTypeOf<
      Exclude<ColumnType["kind"], (typeof AI_COLUMN_TYPE_KINDS)[number]>
    >().toBeNever();
    expect(new Set(AI_COLUMN_TYPE_KINDS).size).toBe(19);
  });
});

describe("AI tool input shapes", () => {
  it.each(AI_TOOL_NAMES)("accepts a minimal valid input for %s", (tool) => {
    expect(isAccepted(tool, minimalInputs[tool])).toBe(true);
  });

  it("accepts a fully specified column spec", () => {
    const fullColumn = {
      name: "price",
      type: { kind: "decimal", precision: 10, scale: 0 },
      isNullable: true,
      isUnique: true,
      isAutoIncrement: false,
      defaultValue: { kind: "literal", value: "0" },
      comment: "Unit price",
    };

    expect(
      isAccepted("addColumn", { table: "items", column: fullColumn }),
    ).toBe(true);
  });

  it("accepts a null default value that removes the default", () => {
    expect(
      isAccepted("updateColumn", {
        table: "users",
        column: "id",
        defaultValue: null,
      }),
    ).toBe(true);
  });

  it("accepts a name at the 63 character limit", () => {
    expect(
      isAccepted("createTable", {
        ...minimalInputs.createTable,
        name: NAME_AT_LIMIT,
      }),
    ).toBe(true);
  });

  it.each<readonly [string, AiToolName, unknown]>([
    ["renameSchema name", "renameSchema", { name: NAME_OVER_LIMIT }],
    [
      "createTable name",
      "createTable",
      { ...minimalInputs.createTable, name: NAME_OVER_LIMIT },
    ],
    [
      "createTable column name",
      "createTable",
      {
        ...minimalInputs.createTable,
        columns: [{ ...column, name: NAME_OVER_LIMIT }],
      },
    ],
    [
      "createTable enumName",
      "createTable",
      {
        ...minimalInputs.createTable,
        columns: [
          { ...column, type: { kind: "enum", enumName: NAME_OVER_LIMIT } },
        ],
      },
    ],
    [
      "createTable customName",
      "createTable",
      {
        ...minimalInputs.createTable,
        columns: [
          { ...column, type: { kind: "custom", customName: NAME_OVER_LIMIT } },
        ],
      },
    ],
    [
      "createTable primaryKey",
      "createTable",
      { ...minimalInputs.createTable, primaryKey: [NAME_OVER_LIMIT] },
    ],
    [
      "updateTable newName",
      "updateTable",
      { table: "users", newName: NAME_OVER_LIMIT },
    ],
    ["removeTable table", "removeTable", { table: NAME_OVER_LIMIT }],
    [
      "addColumn after",
      "addColumn",
      { table: "users", column, after: NAME_OVER_LIMIT },
    ],
    [
      "updateColumn column",
      "updateColumn",
      { table: "users", column: NAME_OVER_LIMIT },
    ],
    [
      "removeColumn table",
      "removeColumn",
      { table: NAME_OVER_LIMIT, column: "id" },
    ],
    [
      "setPrimaryKey columns",
      "setPrimaryKey",
      { table: "users", columns: [NAME_OVER_LIMIT] },
    ],
    [
      "addRelation junctionTable",
      "addRelation",
      { ...minimalInputs.addRelation, junctionTable: NAME_OVER_LIMIT },
    ],
    [
      "updateRelation toTable",
      "updateRelation",
      { fromTable: "orders", toTable: NAME_OVER_LIMIT },
    ],
    [
      "removeRelation fromColumns",
      "removeRelation",
      { fromTable: "orders", toTable: "users", fromColumns: [NAME_OVER_LIMIT] },
    ],
    [
      "addIndex name",
      "addIndex",
      { ...minimalInputs.addIndex, name: NAME_OVER_LIMIT },
    ],
    [
      "removeIndex index",
      "removeIndex",
      { table: "users", index: NAME_OVER_LIMIT },
    ],
    [
      "createEnum value",
      "createEnum",
      { name: "status", values: [NAME_OVER_LIMIT] },
    ],
    [
      "updateEnum newName",
      "updateEnum",
      { enum: "status", newName: NAME_OVER_LIMIT },
    ],
    ["removeEnum enum", "removeEnum", { enum: NAME_OVER_LIMIT }],
    [
      "reportFindings table",
      "reportFindings",
      { findings: [{ ...finding, table: NAME_OVER_LIMIT }] },
    ],
    [
      "proposeSampleData table",
      "proposeSampleData",
      { tables: [{ table: NAME_OVER_LIMIT, rows: [] }] },
    ],
    [
      "proposeSampleData column",
      "proposeSampleData",
      withSampleRows([[{ column: NAME_OVER_LIMIT, value: "1" }]]),
    ],
  ])("rejects a name one character over the limit in %s", (_, tool, input) => {
    expect(isAccepted(tool, input)).toBe(false);
  });

  it.each<readonly [string, AiToolName, unknown]>([
    ["an empty table name", "removeTable", { table: "" }],
    ["an empty enum value", "createEnum", { name: "status", values: [""] }],
  ])("rejects %s", (_, tool, input) => {
    expect(isAccepted(tool, input)).toBe(false);
  });

  it("rejects a comment over 1000 characters", () => {
    expect(
      isAccepted("updateTable", { table: "users", comment: "c".repeat(1001) }),
    ).toBe(false);
  });

  it("rejects a default value over 500 characters", () => {
    expect(
      isAccepted("updateColumn", {
        table: "users",
        column: "id",
        defaultValue: { kind: "literal", value: "v".repeat(501) },
      }),
    ).toBe(false);
  });

  it.each([
    ["createEnum", { name: "status", values: namedColumns(101) }],
    ["updateEnum", { enum: "status", values: namedColumns(101) }],
  ] as const)("rejects more than 100 enum values in %s", (tool, input) => {
    expect(isAccepted(tool, input)).toBe(false);
  });

  it("rejects more than 100 createTable columns", () => {
    const columns = namedColumns(101).map((name) => ({ ...column, name }));

    expect(
      isAccepted("createTable", { ...minimalInputs.createTable, columns }),
    ).toBe(false);
  });

  it("rejects a createTable without columns", () => {
    expect(
      isAccepted("createTable", { ...minimalInputs.createTable, columns: [] }),
    ).toBe(false);
  });

  it.each<readonly [string, AiToolName, (names: readonly string[]) => unknown]>(
    [
      [
        "primaryKey",
        "createTable",
        (names) => ({ ...minimalInputs.createTable, primaryKey: names }),
      ],
      [
        "setPrimaryKey.columns",
        "setPrimaryKey",
        (names) => ({ table: "users", columns: names }),
      ],
      [
        "addIndex.columns",
        "addIndex",
        (names) => ({ table: "users", columns: names, isUnique: false }),
      ],
      [
        "fromColumns",
        "addRelation",
        (names) => ({ ...minimalInputs.addRelation, fromColumns: names }),
      ],
      [
        "toColumns",
        "addRelation",
        (names) => ({ ...minimalInputs.addRelation, toColumns: names }),
      ],
      [
        "reportFindings columns",
        "reportFindings",
        (names) => ({ findings: [{ ...finding, columns: names }] }),
      ],
    ],
  )("rejects more than 16 column names in %s", (_, tool, build) => {
    expect(isAccepted(tool, build(namedColumns(17)))).toBe(false);
  });

  it.each<readonly [string, AiToolName, unknown]>([
    [
      "kind",
      "addRelation",
      { ...minimalInputs.addRelation, kind: "manyToOne" },
    ],
    [
      "updateRelation manyToMany",
      "updateRelation",
      { ...minimalInputs.updateRelation, kind: "manyToMany" },
    ],
    [
      "onDelete",
      "addRelation",
      { ...minimalInputs.addRelation, onDelete: "delete" },
    ],
    [
      "column type kind",
      "addColumn",
      { table: "users", column: { ...column, type: { kind: "string" } } },
    ],
    [
      "zero length",
      "addColumn",
      {
        table: "users",
        column: { ...column, type: { kind: "varchar", length: 0 } },
      },
    ],
    [
      "negative scale",
      "addColumn",
      {
        table: "users",
        column: {
          ...column,
          type: { kind: "decimal", precision: 4, scale: -1 },
        },
      },
    ],
    [
      "fractional precision",
      "addColumn",
      {
        table: "users",
        column: {
          ...column,
          type: { kind: "decimal", precision: 4.5, scale: 0 },
        },
      },
    ],
    [
      "finding category",
      "reportFindings",
      { findings: [{ ...finding, category: "style" }] },
    ],
  ])("rejects an invalid %s", (_, tool, input) => {
    expect(isAccepted(tool, input)).toBe(false);
  });

  it.each([
    ["title", { ...finding, title: "t".repeat(201) }],
    ["detail", { ...finding, detail: "d".repeat(2001) }],
    ["empty title", { ...finding, title: "" }],
  ])("rejects a finding %s outside its length limit", (_, invalid) => {
    expect(isAccepted("reportFindings", { findings: [invalid] })).toBe(false);
  });

  it("rejects more than 30 findings", () => {
    const findings = Array.from({ length: 31 }, () => finding);

    expect(isAccepted("reportFindings", { findings })).toBe(false);
  });

  it("rejects an empty findings list", () => {
    expect(isAccepted("reportFindings", { findings: [] })).toBe(false);
  });

  it.each<readonly [string, AiToolName, unknown]>([
    ["a tool input", "removeTable", { table: "users", id: "tbl_1" }],
    [
      "a column spec",
      "addColumn",
      { table: "users", column: { ...column, tableId: "tbl_1" } },
    ],
    [
      "a column type",
      "addColumn",
      {
        table: "users",
        column: { ...column, type: { kind: "integer", enumId: "enum_1" } },
      },
    ],
    [
      "a default value",
      "updateColumn",
      {
        table: "users",
        column: "id",
        defaultValue: { kind: "generateUuid", raw: "x" },
      },
    ],
    [
      "a finding",
      "reportFindings",
      { findings: [{ ...finding, severity: "high" }] },
    ],
    [
      "a sample table",
      "proposeSampleData",
      { tables: [{ table: "users", rows: [], seed: 1 }] },
    ],
    [
      "a sample cell",
      "proposeSampleData",
      withSampleRows([[{ column: "id", value: "1", type: "integer" }]]),
    ],
  ])("rejects unknown keys in %s", (_, tool, input) => {
    expect(isAccepted(tool, input)).toBe(false);
  });

  it("accepts a column named __proto__ in createTable", () => {
    const input = {
      ...minimalInputs.createTable,
      columns: [{ ...column, name: "__proto__" }],
      primaryKey: ["__proto__"],
    };

    expect(aiEditToolInputShapes.createTable.parse(input)).toStrictEqual(input);
  });
});

describe("proposeSampleData input shape", () => {
  it("accepts 20 sample rows in one table", () => {
    const rows = Array.from({ length: 20 }, () => sampleRow(1));

    expect(isAccepted("proposeSampleData", withSampleRows(rows))).toBe(true);
  });

  it("rejects more than 20 sample rows in one table", () => {
    const rows = Array.from({ length: 21 }, () => sampleRow(1));

    expect(isAccepted("proposeSampleData", withSampleRows(rows))).toBe(false);
  });

  it("rejects more than 100 sample tables", () => {
    const tables = Array.from({ length: 101 }, () => ({
      table: "users",
      rows: [],
    }));

    expect(isAccepted("proposeSampleData", { tables })).toBe(false);
  });

  it("accepts a sample row with 100 columns", () => {
    expect(
      isAccepted("proposeSampleData", withSampleRows([sampleRow(100)])),
    ).toBe(true);
  });

  it("rejects a sample row with more than 100 columns", () => {
    expect(
      isAccepted("proposeSampleData", withSampleRows([sampleRow(101)])),
    ).toBe(false);
  });

  it("accepts a null sample value", () => {
    expect(
      isAccepted("proposeSampleData", withSampleRows([sampleRow(1, null)])),
    ).toBe(true);
  });

  it("accepts a sample string of 2000 characters", () => {
    expect(
      isAccepted(
        "proposeSampleData",
        withSampleRows([sampleRow(1, "s".repeat(2000))]),
      ),
    ).toBe(true);
  });

  it("rejects a sample string over 2000 characters", () => {
    expect(
      isAccepted(
        "proposeSampleData",
        withSampleRows([sampleRow(1, "s".repeat(2001))]),
      ),
    ).toBe(false);
  });

  it.each([
    ["a number", 1],
    ["a boolean", true],
    ["an object", { amount: "1" }],
    ["an array", ["1"]],
  ])("rejects %s as a sample value", (_, value) => {
    expect(
      isAccepted(
        "proposeSampleData",
        withSampleRows([[{ column: "id", value }]]),
      ),
    ).toBe(false);
  });

  it("rejects a deeply nested sample value without throwing", () => {
    const input = withSampleRows([
      [{ column: "id", value: nestedArray(100_000) }],
    ]);

    expect(proposeSampleDataInputShape.safeParse(input).success).toBe(false);
  });

  it("rejects sample data input over 256 KiB", () => {
    const rows = Array.from({ length: 20 }, () =>
      sampleRow(1, "s".repeat(2000)),
    );
    const tables = Array.from({ length: 7 }, () => ({ table: "users", rows }));

    expect(isAccepted("proposeSampleData", { tables })).toBe(false);
  });

  it("counts the sample input size in UTF-8 bytes", () => {
    const rows = Array.from({ length: 20 }, () =>
      sampleRow(1, "\u00e9".repeat(2000)),
    );
    const tables = Array.from({ length: 4 }, () => ({ table: "users", rows }));

    expect(isAccepted("proposeSampleData", { tables })).toBe(false);
  });

  it("keeps a __proto__ column name in a sample row", () => {
    const prototypeNames = Object.getOwnPropertyNames(Object.prototype);
    const input = withSampleRows([[{ column: "__proto__", value: "1" }]]);

    expect(proposeSampleDataInputShape.parse(input)).toStrictEqual(input);
    expect(Object.getOwnPropertyNames(Object.prototype)).toStrictEqual(
      prototypeNames,
    );
  });
});
