import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeIndex,
  makeTable,
} from "../../testing/factories.js";
import { allocateMysqlNames } from "./mysql-identifiers.js";

// Table a: columns "ma", "má", "MA"; indexes "IX", "íx" and "ix" on table a
// (sorted by name, so "ix" comes after "IX"), and "ix" again on table b.
const CASE_SCHEMA = buildSchema({
  tables: [makeTable({ id: "tbl_a" }), makeTable({ id: "tbl_b" })],
  columns: [
    makeColumn({ id: "col_a1", tableId: "tbl_a", name: "ma" }),
    makeColumn({ id: "col_a2", tableId: "tbl_a", name: "má" }),
    makeColumn({ id: "col_a3", tableId: "tbl_a", name: "MA" }),
    makeColumn({ id: "col_b1", tableId: "tbl_b", name: "ma" }),
  ],
  indexes: [
    makeIndex({
      id: "idx_a1",
      tableId: "tbl_a",
      name: "IX",
      columnIds: ["col_a1"],
    }),
    makeIndex({
      id: "idx_a2",
      tableId: "tbl_a",
      name: "íx",
      columnIds: ["col_a2"],
    }),
    makeIndex({
      id: "idx_a3",
      tableId: "tbl_a",
      name: "ix",
      columnIds: ["col_a3"],
    }),
    makeIndex({
      id: "idx_b1",
      tableId: "tbl_b",
      name: "ix",
      columnIds: ["col_b1"],
    }),
  ],
});

function withReversedMaps(schema: SchemaDocument): SchemaDocument {
  return {
    ...schema,
    columns: Object.fromEntries(Object.entries(schema.columns).reverse()),
    indexes: Object.fromEntries(Object.entries(schema.indexes).reverse()),
  };
}

function twoColumnSchema(first: string, second: string): SchemaDocument {
  return buildSchema({
    tables: [makeTable({ id: "tbl_t" })],
    columns: [
      makeColumn({ id: "col_1", tableId: "tbl_t", name: first }),
      makeColumn({ id: "col_2", tableId: "tbl_t", name: second }),
    ],
  });
}

describe("allocateMysqlNames", () => {
  // MySQL 8.4 accepts each pair as two distinct column names (Task 8 probe).
  it.each([
    ["ma", "má"],
    ["da", "đa"],
    ["ol", "øl"],
    ["la", "ła"],
    ["ha", "ħa"],
    ["sa", "ßa"],
    ["do", "ðo"],
  ])(
    "keeps columns that differ only by an accent or a letter variant (%s, %s)",
    (first, second) => {
      const names = allocateMysqlNames(twoColumnSchema(first, second));

      expect([
        [...names.columnNames.values()],
        names.diagnostics,
      ]).toStrictEqual([[first, second], []]);
    },
  );

  it("renames a column that differs from an earlier column only in case", () => {
    expect(allocateMysqlNames(CASE_SCHEMA).columnNames.get("col_a3")).toBe(
      "MA_2",
    );
  });

  it("renames an index that differs from an earlier index of the same table only in case", () => {
    expect(allocateMysqlNames(CASE_SCHEMA).indexNames.get("idx_a3")).toBe(
      "ix_2",
    );
  });

  it("keeps index names that differ only in case in different tables", () => {
    expect(allocateMysqlNames(CASE_SCHEMA).indexNames.get("idx_b1")).toBe("ix");
  });

  it("reports identifier-collision-renamed at the renamed name path", () => {
    expect(allocateMysqlNames(CASE_SCHEMA).diagnostics).toStrictEqual([
      {
        code: "identifier-collision-renamed",
        path: ["columns", "col_a3", "name"],
      },
      {
        code: "identifier-collision-renamed",
        path: ["indexes", "idx_a3", "name"],
      },
    ]);
  });

  it("keeps every other name unchanged", () => {
    const names = allocateMysqlNames(CASE_SCHEMA);

    expect([
      [...names.columnNames.entries()],
      [...names.indexNames.entries()],
    ]).toStrictEqual([
      [
        ["col_a1", "ma"],
        ["col_a2", "má"],
        ["col_a3", "MA_2"],
        ["col_b1", "ma"],
      ],
      [
        ["idx_a1", "IX"],
        ["idx_a3", "ix_2"],
        ["idx_a2", "íx"],
        ["idx_b1", "ix"],
      ],
    ]);
  });

  it("renames in column order and index order regardless of map key order", () => {
    expect(allocateMysqlNames(withReversedMaps(CASE_SCHEMA))).toStrictEqual(
      allocateMysqlNames(CASE_SCHEMA),
    );
  });
});
