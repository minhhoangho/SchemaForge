import { describe, expect, it } from "vitest";

import {
  buildSchema,
  makeColumn,
  makeIndex,
  makeTable,
} from "../testing/factories.js";

import { isUniqueColumnSet } from "./column-uniqueness.js";

const schema = buildSchema({
  tables: [
    makeTable({ id: "tbl_1", primaryKeyColumnIds: ["col_pk_a", "col_pk_b"] }),
    makeTable({ id: "tbl_2", primaryKeyColumnIds: [] }),
  ],
  columns: [
    makeColumn({ id: "col_pk_a", tableId: "tbl_1" }),
    makeColumn({ id: "col_pk_b", tableId: "tbl_1" }),
    makeColumn({ id: "col_single_unique", tableId: "tbl_1", isUnique: true }),
    makeColumn({ id: "col_other_unique", tableId: "tbl_1", isUnique: true }),
    makeColumn({ id: "col_pair_a", tableId: "tbl_1" }),
    makeColumn({ id: "col_pair_b", tableId: "tbl_1" }),
    makeColumn({ id: "col_pair_c", tableId: "tbl_1" }),
    makeColumn({ id: "col_pair_d", tableId: "tbl_1" }),
    makeColumn({ id: "col_tbl2_a", tableId: "tbl_2" }),
    makeColumn({ id: "col_tbl2_b", tableId: "tbl_2" }),
  ],
  indexes: [
    makeIndex({
      id: "idx_pair_non_unique",
      tableId: "tbl_1",
      columnIds: ["col_pair_a", "col_pair_b"],
      isUnique: false,
    }),
    makeIndex({
      id: "idx_pair_unique",
      tableId: "tbl_1",
      columnIds: ["col_pair_c", "col_pair_d"],
      isUnique: true,
    }),
    makeIndex({
      id: "idx_other_table",
      tableId: "tbl_2",
      columnIds: ["col_tbl2_a"],
      isUnique: true,
    }),
  ],
});

describe("isUniqueColumnSet", () => {
  it("returns true for exactly the primary key columns in another order", () => {
    expect(isUniqueColumnSet(schema, "tbl_1", ["col_pk_b", "col_pk_a"])).toBe(
      true,
    );
  });

  it("returns false for a strict subset of a composite primary key", () => {
    expect(isUniqueColumnSet(schema, "tbl_1", ["col_pk_a"])).toBe(false);
  });

  it("returns false for a superset of the primary key", () => {
    expect(
      isUniqueColumnSet(schema, "tbl_1", [
        "col_pk_a",
        "col_pk_b",
        "col_single_unique",
      ]),
    ).toBe(false);
  });

  it("returns true for a single column marked unique", () => {
    expect(isUniqueColumnSet(schema, "tbl_1", ["col_single_unique"])).toBe(
      true,
    );
  });

  it("returns false for two columns that are each marked unique", () => {
    expect(
      isUniqueColumnSet(schema, "tbl_1", [
        "col_single_unique",
        "col_other_unique",
      ]),
    ).toBe(false);
  });

  it("returns true for the column set of a unique index", () => {
    expect(
      isUniqueColumnSet(schema, "tbl_1", ["col_pair_d", "col_pair_c"]),
    ).toBe(true);
  });

  it("returns false for the column set of a non-unique index", () => {
    expect(
      isUniqueColumnSet(schema, "tbl_1", ["col_pair_a", "col_pair_b"]),
    ).toBe(false);
  });

  it("returns false for a unique index on another table", () => {
    expect(isUniqueColumnSet(schema, "tbl_1", ["col_tbl2_a"])).toBe(false);
  });

  it("returns false for an empty column list", () => {
    expect(isUniqueColumnSet(schema, "tbl_1", [])).toBe(false);
  });

  it("returns false when the table has no primary key and no unique constraint", () => {
    expect(isUniqueColumnSet(schema, "tbl_2", ["col_tbl2_b"])).toBe(false);
  });
});
