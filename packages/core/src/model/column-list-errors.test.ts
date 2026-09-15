import { describe, expect, it } from "vitest";

import { findColumnListErrors } from "./column-list-errors.js";
import type { Column } from "./column.js";
import type { ColumnId, TableId } from "./ids.js";
import type { SchemaDocument } from "./schema-document.js";

function makeColumn(id: ColumnId, tableId: TableId): Column {
  return {
    id,
    tableId,
    name: id,
    type: { kind: "integer" },
    isNullable: false,
    defaultValue: null,
    isUnique: false,
    isAutoIncrement: false,
    comment: "",
  };
}

const COLUMNS: SchemaDocument["columns"] = {
  col_1: makeColumn("col_1", "tbl_1"),
  col_2: makeColumn("col_2", "tbl_1"),
  col_3: makeColumn("col_3", "tbl_2"),
};

describe("findColumnListErrors", () => {
  it("returns no errors for distinct columns of the table", () => {
    expect(
      findColumnListErrors(COLUMNS, "tbl_1", ["col_1", "col_2"]),
    ).toStrictEqual([]);
  });

  it("reports column-not-found at the index of a missing column", () => {
    expect(
      findColumnListErrors(COLUMNS, "tbl_1", ["col_1", "col_missing"]),
    ).toStrictEqual([{ code: "column-not-found", index: 1 }]);
  });

  it("reports column-not-in-table for a column of another table", () => {
    expect(
      findColumnListErrors(COLUMNS, "tbl_1", ["col_1", "col_3"]),
    ).toStrictEqual([{ code: "column-not-in-table", index: 1 }]);
  });

  it("reports column-listed-twice at the second occurrence", () => {
    expect(
      findColumnListErrors(COLUMNS, "tbl_1", ["col_1", "col_2", "col_1"]),
    ).toStrictEqual([{ code: "column-listed-twice", index: 2 }]);
  });

  it("reports only the first applicable code for one position", () => {
    expect(
      findColumnListErrors(COLUMNS, "tbl_1", ["col_3", "col_3"]),
    ).toStrictEqual([
      { code: "column-not-in-table", index: 0 },
      { code: "column-not-in-table", index: 1 },
    ]);
  });
});
