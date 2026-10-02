import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeIndex,
  makeTable,
} from "../../testing/factories.js";
import { allocateMysqlNames } from "./mysql-identifiers.js";

// Table a: columns "ma", "má", "đa"/"da"; indexes "ix" and "íx" on table a,
// and "íx" again on table b.
const ACCENT_SCHEMA = buildSchema({
  tables: [makeTable({ id: "tbl_a" }), makeTable({ id: "tbl_b" })],
  columns: [
    makeColumn({ id: "col_a1", tableId: "tbl_a", name: "ma" }),
    makeColumn({ id: "col_a2", tableId: "tbl_a", name: "má" }),
    makeColumn({ id: "col_a3", tableId: "tbl_a", name: "da" }),
    makeColumn({ id: "col_a4", tableId: "tbl_a", name: "đa" }),
    makeColumn({ id: "col_b1", tableId: "tbl_b", name: "ma" }),
  ],
  indexes: [
    makeIndex({
      id: "idx_a1",
      tableId: "tbl_a",
      name: "ix",
      columnIds: ["col_a1"],
    }),
    makeIndex({
      id: "idx_a2",
      tableId: "tbl_a",
      name: "íx",
      columnIds: ["col_a2"],
    }),
    makeIndex({
      id: "idx_b1",
      tableId: "tbl_b",
      name: "íx",
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

describe("allocateMysqlNames", () => {
  it("renames a column that differs from an earlier column only by an accent", () => {
    expect(allocateMysqlNames(ACCENT_SCHEMA).columnNames.get("col_a2")).toBe(
      "má_2",
    );
  });

  it("renames a column that differs from an earlier column only by đ", () => {
    expect(allocateMysqlNames(ACCENT_SCHEMA).columnNames.get("col_a4")).toBe(
      "đa_2",
    );
  });

  it("renames an index that differs from an earlier index of the same table only by an accent", () => {
    expect(allocateMysqlNames(ACCENT_SCHEMA).indexNames.get("idx_a2")).toBe(
      "íx_2",
    );
  });

  it("keeps index names that differ only by an accent in different tables", () => {
    expect(allocateMysqlNames(ACCENT_SCHEMA).indexNames.get("idx_b1")).toBe(
      "íx",
    );
  });

  it("reports identifier-collision-renamed at the renamed name path", () => {
    expect(allocateMysqlNames(ACCENT_SCHEMA).diagnostics).toStrictEqual([
      {
        code: "identifier-collision-renamed",
        path: ["columns", "col_a2", "name"],
      },
      {
        code: "identifier-collision-renamed",
        path: ["columns", "col_a4", "name"],
      },
      {
        code: "identifier-collision-renamed",
        path: ["indexes", "idx_a2", "name"],
      },
    ]);
  });

  it("keeps every other name unchanged", () => {
    const names = allocateMysqlNames(ACCENT_SCHEMA);

    expect([
      [...names.columnNames.entries()],
      [...names.indexNames.entries()],
    ]).toStrictEqual([
      [
        ["col_a1", "ma"],
        ["col_a2", "má_2"],
        ["col_a3", "da"],
        ["col_a4", "đa_2"],
        ["col_b1", "ma"],
      ],
      [
        ["idx_a1", "ix"],
        ["idx_a2", "íx_2"],
        ["idx_b1", "íx"],
      ],
    ]);
  });

  it("renames in column order and index order regardless of map key order", () => {
    expect(allocateMysqlNames(withReversedMaps(ACCENT_SCHEMA))).toStrictEqual(
      allocateMysqlNames(ACCENT_SCHEMA),
    );
  });
});
