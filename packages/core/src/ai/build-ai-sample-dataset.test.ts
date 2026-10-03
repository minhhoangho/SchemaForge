import { describe, expect, it } from "vitest";

import type { ColumnType } from "../model/column-type.js";
import type { ColumnId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import { buildSchema, makeColumn, makeTable } from "../testing/factories.js";
import { createSampleSchema } from "../testing/sample-schema.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import type { AiSampleDataInput } from "./ai-edit-tools.js";
import { proposeSampleDataInputShape } from "./ai-edit-tools.js";
import { buildAiSampleDataset } from "./build-ai-sample-dataset.js";
import { findColumnByName, findTableByName } from "./resolve-ai-names.js";

type Cell = AiSampleDataInput["tables"][number]["rows"][number][number];

const TYPED_COLUMNS: readonly {
  readonly id: ColumnId;
  readonly name: string;
  readonly type: ColumnType;
}[] = [
  { id: "col_small", name: "small", type: { kind: "smallint" } },
  { id: "col_int", name: "int", type: { kind: "integer" } },
  { id: "col_real", name: "real", type: { kind: "real" } },
  { id: "col_double", name: "double", type: { kind: "double" } },
  { id: "col_flag", name: "flag", type: { kind: "boolean" } },
  { id: "col_payload", name: "payload", type: { kind: "json" } },
  { id: "col_big", name: "big", type: { kind: "bigint" } },
  {
    id: "col_amount",
    name: "amount",
    type: { kind: "decimal", precision: 10, scale: 2 },
  },
  { id: "col_uuid", name: "uuid", type: { kind: "uuid" } },
  { id: "col_day", name: "day", type: { kind: "date" } },
  { id: "col_at", name: "at", type: { kind: "timestamp" } },
];

const TYPES_SCHEMA = buildSchema({
  tables: [
    makeTable({ id: "tbl_types", name: "types" }),
    makeTable({ id: "tbl_extras", name: "extras" }),
    makeTable({ id: "tbl_proto", name: "things" }),
  ],
  columns: [
    ...TYPED_COLUMNS.map(({ id, name, type }) =>
      makeColumn({ id, tableId: "tbl_types", name, type, isNullable: true }),
    ),
    makeColumn({
      id: "col_note",
      tableId: "tbl_extras",
      name: "note",
      type: { kind: "text" },
      isNullable: true,
    }),
    makeColumn({
      id: "col_proto",
      tableId: "tbl_proto",
      name: "__proto__",
      type: { kind: "text" },
    }),
  ],
});

const LIMIT_TABLE_COUNT = 11;
const ROWS_PER_TABLE = 20;
const LIMIT_TABLE_NAMES = Array.from(
  { length: LIMIT_TABLE_COUNT },
  (_unused, index) => `t${String(index)}`,
);

const LIMIT_SCHEMA = buildSchema({
  tables: LIMIT_TABLE_NAMES.map((name) =>
    makeTable({ id: `tbl_${name}`, name }),
  ),
  columns: LIMIT_TABLE_NAMES.map((name) =>
    makeColumn({
      id: `col_${name}`,
      tableId: `tbl_${name}`,
      isNullable: true,
    }),
  ),
});

function oneCell(table: string, cell: Cell): AiSampleDataInput {
  return { tables: [{ table, rows: [[cell]] }] };
}

function typesCell(column: string, value: string | null): AiSampleDataInput {
  return oneCell("types", { column, value });
}

function emptyRowsFor(tableCount: number): AiSampleDataInput {
  return {
    tables: LIMIT_TABLE_NAMES.slice(0, tableCount).map((table) => ({
      table,
      rows: Array.from({ length: ROWS_PER_TABLE }, () => []),
    })),
  };
}

function sampleColumnId(
  schema: SchemaDocument,
  tableName: string,
  columnName: string,
): ColumnId {
  const table = findTableByName(schema, tableName);
  const column =
    table === null ? null : findColumnByName(schema, table, columnName);
  if (column === null) {
    throw new Error(`No column ${tableName}.${columnName}`);
  }
  return column.id;
}

function sampleTableId(schema: SchemaDocument, tableName: string): string {
  const table = findTableByName(schema, tableName);
  if (table === null) {
    throw new Error(`No table ${tableName}`);
  }
  return table.id;
}

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

describe("buildAiSampleDataset", () => {
  it("builds a dataset in the given table order", () => {
    const input: AiSampleDataInput = {
      tables: [
        { table: "extras", rows: [[{ column: "note", value: "hello" }]] },
        { table: "types", rows: [[{ column: "int", value: "7" }]] },
      ],
    };

    expect(unwrapOk(buildAiSampleDataset(TYPES_SCHEMA, input))).toStrictEqual({
      tables: [
        { tableId: "tbl_extras", rows: [{ col_note: "hello" }] },
        { tableId: "tbl_types", rows: [{ col_int: 7 }] },
      ],
    });
  });

  it("returns table-name-not-found and column-name-not-found by name", () => {
    const input: AiSampleDataInput = {
      tables: [
        { table: "nope", rows: [[{ column: "x", value: "1" }]] },
        { table: "types", rows: [[], [{ column: "missing", value: "1" }]] },
      ],
    };

    expect(
      unwrapError(buildAiSampleDataset(TYPES_SCHEMA, input)),
    ).toStrictEqual([
      { code: "table-name-not-found", path: ["tables", 0], at: "tables.nope" },
      {
        code: "column-name-not-found",
        path: ["tables", 1, "rows", 1],
        at: "tables.types.rows.1.missing",
      },
    ]);
  });

  it("rejects more than 200 rows in one call", () => {
    expect(
      unwrapError(
        buildAiSampleDataset(LIMIT_SCHEMA, emptyRowsFor(LIMIT_TABLE_COUNT)),
      ),
    ).toStrictEqual([
      { code: "sample-rows-limit", path: ["tables"], at: "tables" },
    ]);
  });

  it("accepts exactly 200 rows in one call", () => {
    const dataset = unwrapOk(
      buildAiSampleDataset(LIMIT_SCHEMA, emptyRowsFor(LIMIT_TABLE_COUNT - 1)),
    );

    expect(dataset.tables.flatMap((entry) => entry.rows)).toHaveLength(200);
  });

  it("returns seed issues with name paths", () => {
    const schema = createSampleSchema();
    const input: AiSampleDataInput = {
      tables: [
        {
          table: "users",
          rows: [
            [
              { column: "tenant_id", value: TENANT_ID },
              { column: "email", value: "a@example.com" },
            ],
          ],
        },
      ],
    };

    expect(unwrapError(buildAiSampleDataset(schema, input))).toStrictEqual([
      {
        code: "seed-foreign-key-missing",
        path: [
          "tables",
          0,
          "rows",
          0,
          sampleColumnId(schema, "users", "tenant_id"),
        ],
        at: "tables.users.rows.0.tenant_id",
      },
    ]);
  });

  it("describes a seed issue on a table entry by the table name", () => {
    const input: AiSampleDataInput = {
      tables: [
        { table: "extras", rows: [] },
        { table: "extras", rows: [] },
      ],
    };

    expect(
      unwrapError(buildAiSampleDataset(TYPES_SCHEMA, input)),
    ).toStrictEqual([
      {
        code: "seed-order-invalid",
        path: ["tables", 1, "tableId"],
        at: "tables.extras",
      },
    ]);
  });

  it("accepts a valid dataset for the sample schema", () => {
    const schema = createSampleSchema();
    const input: AiSampleDataInput = {
      tables: [
        { table: "tenants", rows: [[{ column: "id", value: TENANT_ID }]] },
        {
          table: "users",
          rows: [
            [
              { column: "id", value: "1" },
              { column: "tenant_id", value: TENANT_ID },
              { column: "email", value: "a@example.com" },
              { column: "manager_id", value: null },
            ],
            [
              { column: "id", value: "2" },
              { column: "tenant_id", value: TENANT_ID },
              { column: "email", value: "b@example.com" },
              { column: "manager_id", value: "1" },
            ],
          ],
        },
      ],
    };
    const users = (column: string): ColumnId =>
      sampleColumnId(schema, "users", column);

    expect(unwrapOk(buildAiSampleDataset(schema, input))).toStrictEqual({
      tables: [
        {
          tableId: sampleTableId(schema, "tenants"),
          rows: [{ [sampleColumnId(schema, "tenants", "id")]: TENANT_ID }],
        },
        {
          tableId: sampleTableId(schema, "users"),
          rows: [
            {
              [users("id")]: "1",
              [users("tenant_id")]: TENANT_ID,
              [users("email")]: "a@example.com",
              [users("manager_id")]: null,
            },
            {
              [users("id")]: "2",
              [users("tenant_id")]: TENANT_ID,
              [users("email")]: "b@example.com",
              [users("manager_id")]: "1",
            },
          ],
        },
      ],
    });
  });

  it("keeps a column named __proto__", () => {
    const input = proposeSampleDataInputShape.parse(
      JSON.parse(
        '{"tables":[{"table":"things","rows":[[{"column":"__proto__","value":"x"}]]}]}',
      ),
    );

    expect(unwrapOk(buildAiSampleDataset(TYPES_SCHEMA, input))).toStrictEqual({
      tables: [{ tableId: "tbl_proto", rows: [{ col_proto: "x" }] }],
    });
  });

  it("rejects a column that appears twice in one row", () => {
    const input: AiSampleDataInput = {
      tables: [
        {
          table: "types",
          rows: [
            [
              { column: "int", value: "1" },
              { column: "INT", value: "2" },
            ],
          ],
        },
      ],
    };

    expect(
      unwrapError(buildAiSampleDataset(TYPES_SCHEMA, input)),
    ).toStrictEqual([
      {
        code: "seed-value-invalid",
        path: ["tables", 0, "rows", 0, "col_int"],
        at: "tables.types.rows.0.int",
      },
    ]);
  });

  it.each([
    ["smallint", "small", "-12", -12],
    ["integer", "int", "42", 42],
    ["real", "real", "1.5", 1.5],
    ["double", "double", "-2.5e3", -2500],
    ["boolean true", "flag", "true", true],
    ["boolean false", "flag", "false", false],
    ["json", "payload", '{"a":[1,{"b":null}]}', { a: [1, { b: null }] }],
    ["json nested exactly 4 deep", "payload", "[[[[1]]]]", [[[[1]]]]],
    ["bigint", "big", "9007199254740993", "9007199254740993"],
    ["decimal", "amount", "12.50", "12.50"],
    [
      "uuid",
      "uuid",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000002",
    ],
    ["date", "day", "2026-10-03", "2026-10-03"],
    ["timestamp", "at", "2026-10-03T12:00:00", "2026-10-03T12:00:00"],
  ])(
    "converts string values to the JSON representation of each column type (%s)",
    (_label, column, value, expected) => {
      const dataset = unwrapOk(
        buildAiSampleDataset(TYPES_SCHEMA, typesCell(column, value)),
      );

      expect(dataset.tables[0]?.rows[0]).toStrictEqual({
        [sampleColumnId(TYPES_SCHEMA, "types", column)]: expected,
      });
    },
  );

  it.each(TYPED_COLUMNS.map(({ id, name }) => [name, id]))(
    "keeps null for every column type (%s)",
    (name, id) => {
      const dataset = unwrapOk(
        buildAiSampleDataset(TYPES_SCHEMA, typesCell(name, null)),
      );

      expect(dataset.tables[0]?.rows[0]).toStrictEqual({ [id]: null });
    },
  );

  it.each([
    ["int", "col_int", " 1"],
    ["int", "col_int", "0x10"],
    ["int", "col_int", "1.5"],
    ["double", "col_double", "1e999"],
    ["double", "col_double", "NaN"],
    ["real", "col_real", "Infinity"],
  ])(
    "rejects a number string with spaces, a hex string or a non-finite number (%s %j)",
    (column, columnId, value) => {
      expect(
        unwrapError(
          buildAiSampleDataset(TYPES_SCHEMA, typesCell(column, value)),
        ),
      ).toStrictEqual([
        {
          code: "seed-value-invalid",
          path: ["tables", 0, "rows", 0, columnId],
          at: `tables.types.rows.0.${column}`,
        },
      ]);
    },
  );

  it.each(["True", "1", "TRUE", " true"])(
    "rejects a boolean written as True or 1 (%j)",
    (value) => {
      expect(
        unwrapError(
          buildAiSampleDataset(TYPES_SCHEMA, typesCell("flag", value)),
        ),
      ).toStrictEqual([
        {
          code: "seed-value-invalid",
          path: ["tables", 0, "rows", 0, "col_flag"],
          at: "tables.types.rows.0.flag",
        },
      ]);
    },
  );

  it.each(["{a:1}", "", "[1,", "undefined"])(
    "rejects invalid json text in a json column (%j)",
    (value) => {
      expect(
        unwrapError(
          buildAiSampleDataset(TYPES_SCHEMA, typesCell("payload", value)),
        ),
      ).toStrictEqual([
        {
          code: "seed-value-invalid",
          path: ["tables", 0, "rows", 0, "col_payload"],
          at: "tables.types.rows.0.payload",
        },
      ]);
    },
  );

  it.each(["[[[[[1]]]]]", '{"a":{"b":{"c":{"d":{}}}}}', "[1,[2,[3,[4,[]]]]]"])(
    "rejects a json value nested deeper than 4 (%s)",
    (value) => {
      expect(
        unwrapError(
          buildAiSampleDataset(TYPES_SCHEMA, typesCell("payload", value)),
        ),
      ).toStrictEqual([
        {
          code: "seed-value-invalid",
          path: ["tables", 0, "rows", 0, "col_payload"],
          at: "tables.types.rows.0.payload",
        },
      ]);
    },
  );

  it("does not throw on a json column holding text nested 1000 levels deep", () => {
    const value = `${"[".repeat(1000)}${"]".repeat(1000)}`;

    expect(
      unwrapError(
        buildAiSampleDataset(TYPES_SCHEMA, typesCell("payload", value)),
      ),
    ).toStrictEqual([
      {
        code: "seed-value-invalid",
        path: ["tables", 0, "rows", 0, "col_payload"],
        at: "tables.types.rows.0.payload",
      },
    ]);
  });

  it("quotes a name that is not a plain identifier", () => {
    expect(
      unwrapError(
        buildAiSampleDataset(
          TYPES_SCHEMA,
          oneCell("types", { column: "no such.column", value: "1" }),
        ),
      ),
    ).toStrictEqual([
      {
        code: "column-name-not-found",
        path: ["tables", 0, "rows", 0],
        at: 'tables.types.rows.0."no such.column"',
      },
    ]);
  });
});
