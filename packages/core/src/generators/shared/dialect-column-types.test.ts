import { describe, expect, it } from "vitest";

import type { ColumnType } from "../../model/column-type.js";
import type { Column } from "../../model/column.js";
import type { ColumnId } from "../../model/ids.js";
import {
  buildSchema,
  makeColumn,
  makeIndex,
  makeRelation,
  makeTable,
} from "../../testing/factories.js";
import {
  mysqlRowBytes,
  resolveSchemaColumnTypes,
} from "./dialect-column-types.js";
import type { DialectColumnType } from "./dialect-types.js";

const INTEGER: ColumnType = { kind: "integer" };

function char(length: number): ColumnType {
  return { kind: "char", length };
}

function varchar(length: number): ColumnType {
  return { kind: "varchar", length };
}

function column(
  id: ColumnId,
  type: ColumnType,
  overrides: Partial<Column> = {},
): Column {
  const tableId = id.startsWith("col_a") ? "tbl_a" : "tbl_b";
  return makeColumn({ id, tableId, type, ...overrides });
}

function columnIdsOf(prefix: "a" | "b", count: number): readonly ColumnId[] {
  return Array.from(
    { length: count },
    (_, position): ColumnId => `col_${prefix}_${String(position)}`,
  );
}

describe("resolveSchemaColumnTypes", () => {
  it("narrows nchar columns of a SQL Server primary key over 900 bytes and a unique over 1700 bytes to nvarchar", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_a", primaryKeyColumnIds: ["col_a_code"] })],
      columns: [
        column("col_a_code", char(451)),
        column("col_a_unique", char(851), { isUnique: true }),
        column("col_a_plain", char(900)),
      ],
    });

    expect(resolveSchemaColumnTypes(schema, "sqlserver")).toStrictEqual({
      types: new Map([
        ["col_a_code", { kind: "varchar", length: 451 }],
        ["col_a_unique", { kind: "varchar", length: 851 }],
        ["col_a_plain", { kind: "char", length: 900 }],
      ]),
      diagnostics: [
        {
          code: "key-column-type-narrowed",
          path: ["columns", "col_a_code", "type"],
        },
        {
          code: "key-column-type-narrowed",
          path: ["columns", "col_a_unique", "type"],
        },
      ],
    });
  });

  it("keeps the nchar columns of SQL Server keys within the fixed-length limits", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_a", primaryKeyColumnIds: ["col_a_code"] })],
      columns: [
        column("col_a_code", char(450)),
        column("col_a_unique", char(850), { isUnique: true }),
      ],
    });

    expect(resolveSchemaColumnTypes(schema, "sqlserver")).toStrictEqual({
      types: new Map([
        ["col_a_code", { kind: "char", length: 450 }],
        ["col_a_unique", { kind: "char", length: 850 }],
      ]),
      diagnostics: [],
    });
  });

  it("spreads nchar narrowing to every column paired through relations on SQL Server", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_a", primaryKeyColumnIds: ["col_a_code"] }),
        makeTable({ id: "tbl_b" }),
        makeTable({ id: "tbl_c" }),
      ],
      columns: [
        column("col_a_code", char(500)),
        column("col_b_ref", char(500), { isUnique: true }),
        makeColumn({ id: "col_c_ref", tableId: "tbl_c", type: char(500) }),
        makeColumn({ id: "col_c_other", tableId: "tbl_c", type: char(500) }),
      ],
      relations: [
        makeRelation({
          id: "rel_b",
          fromTableId: "tbl_b",
          toTableId: "tbl_a",
          columnPairs: [
            { fromColumnId: "col_b_ref", toColumnId: "col_a_code" },
          ],
        }),
        makeRelation({
          id: "rel_c",
          fromTableId: "tbl_c",
          toTableId: "tbl_b",
          columnPairs: [{ fromColumnId: "col_c_ref", toColumnId: "col_b_ref" }],
        }),
      ],
    });

    const result = resolveSchemaColumnTypes(schema, "sqlserver");

    expect([...result.types.entries()]).toStrictEqual([
      ["col_a_code", { kind: "varchar", length: 500 }],
      ["col_b_ref", { kind: "varchar", length: 500 }],
      ["col_c_ref", { kind: "varchar", length: 500 }],
      ["col_c_other", { kind: "char", length: 500 }],
    ]);
    expect(result.diagnostics).toStrictEqual([
      {
        code: "key-column-type-narrowed",
        path: ["columns", "col_a_code", "type"],
      },
      {
        code: "key-column-type-narrowed",
        path: ["columns", "col_b_ref", "type"],
      },
      {
        code: "key-column-type-narrowed",
        path: ["columns", "col_c_ref", "type"],
      },
    ]);
  });

  it("converts the largest non-key MySQL varchar to text until the row fits", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_a", primaryKeyColumnIds: ["col_a_id"] })],
      columns: [
        column("col_a_id", INTEGER),
        column("col_a_small", varchar(100)),
        column("col_a_first", varchar(10000)),
        column("col_a_second", varchar(10000)),
      ],
    });

    expect(resolveSchemaColumnTypes(schema, "mysql")).toStrictEqual({
      types: new Map([
        ["col_a_id", { kind: "integer" }],
        ["col_a_small", { kind: "varchar", length: 100 }],
        ["col_a_first", { kind: "text" }],
        ["col_a_second", { kind: "varchar", length: 10000 }],
      ]),
      diagnostics: [
        {
          code: "type-parameter-out-of-range",
          path: ["columns", "col_a_first", "type"],
        },
      ],
    });
  });

  it("keeps a MySQL row of exactly 65535 bytes", () => {
    // 32 + (4 × 16375 + 2) + ⌈1 / 8⌉ = 65535.
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_a" })],
      columns: [
        column("col_a_id", INTEGER),
        column("col_a_value", varchar(16375), { isNullable: true }),
      ],
    });

    expect(resolveSchemaColumnTypes(schema, "mysql").diagnostics).toStrictEqual(
      [],
    );
  });

  it("keeps key columns when only key columns remain over the row size", () => {
    const keyIds = columnIdsOf("a", 22);
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_a" })],
      columns: [
        ...keyIds.map((id) => column(id, varchar(768), { isUnique: true })),
        column("col_a_plain", varchar(100)),
      ],
    });

    const result = resolveSchemaColumnTypes(schema, "mysql");

    expect(result.types.get("col_a_0")).toStrictEqual({
      kind: "varchar",
      length: 768,
    });
    expect(result.diagnostics).toStrictEqual([
      {
        code: "type-parameter-out-of-range",
        path: ["columns", "col_a_plain", "type"],
      },
    ]);
  });

  it("resolves the types of every column once per schema", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_a", primaryKeyColumnIds: ["col_a_key"] })],
      columns: [
        column("col_a_key", { kind: "text" }, { isUnique: true }),
        column("col_a_plain", { kind: "text" }),
      ],
      indexes: [
        makeIndex({ id: "idx_a", tableId: "tbl_a", columnIds: ["col_a_key"] }),
      ],
    });

    expect(resolveSchemaColumnTypes(schema, "mysql")).toStrictEqual({
      types: new Map([
        ["col_a_key", { kind: "keyText", length: 255 }],
        ["col_a_plain", { kind: "text" }],
      ]),
      diagnostics: [
        {
          code: "key-column-type-narrowed",
          path: ["columns", "col_a_key", "type"],
        },
      ],
    });
  });
});

describe("mysqlRowBytes", () => {
  it.each<[DialectColumnType, number]>([
    [{ kind: "char", length: 10 }, 40],
    [{ kind: "varchar", length: 10 }, 42],
    [{ kind: "keyText", length: 255 }, 1022],
    [{ kind: "text" }, 12],
    [{ kind: "json" }, 12],
    [{ kind: "binary" }, 12],
    [{ kind: "custom", name: "YEAR", isSafe: true }, 0],
    [{ kind: "integer" }, 32],
  ])("counts MySQL row bytes by type: %o", (type, bytes) => {
    expect(mysqlRowBytes([type], 0)).toBe(bytes);
  });

  it("adds one null bit byte per eight nullable columns", () => {
    expect(mysqlRowBytes([{ kind: "integer" }, { kind: "text" }], 9)).toBe(
      32 + 12 + 2,
    );
  });
});
