import { describe, expect, it } from "vitest";

import type { Column } from "../model/column.js";
import type { ColumnType } from "../model/column-type.js";
import type { ColumnId, SubjectAreaId, TableId } from "../model/ids.js";
import { CURRENT_SCHEMA_VERSION } from "../model/schema-document.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";

import { checkStructuralInvariants } from "./structural-invariants.js";

function makeTable(
  id: TableId,
  columnIds: readonly ColumnId[] = [],
  primaryKeyColumnIds: readonly ColumnId[] = [],
  subjectAreaId: SubjectAreaId | null = null,
): Table {
  return {
    id,
    name: id,
    comment: "",
    position: { x: 0, y: 0 },
    subjectAreaId,
    columnIds,
    primaryKeyColumnIds,
  };
}

function makeColumn(
  id: ColumnId,
  tableId: TableId,
  type: ColumnType = { kind: "integer" },
): Column {
  return {
    id,
    tableId,
    name: id,
    type,
    isNullable: false,
    defaultValue: null,
    isUnique: false,
    isAutoIncrement: false,
    comment: "",
  };
}

function makeDocument(
  tables: SchemaDocument["tables"] = {},
  columns: SchemaDocument["columns"] = {},
  enums: SchemaDocument["enums"] = {},
  subjectAreas: SchemaDocument["subjectAreas"] = {},
): SchemaDocument {
  return {
    version: CURRENT_SCHEMA_VERSION,
    name: "test",
    tables,
    columns,
    relations: {},
    indexes: {},
    enums,
    subjectAreas,
    notes: {},
  };
}

describe("checkStructuralInvariants", () => {
  it("returns no errors for a consistent document", () => {
    const table = makeTable("tbl_1", ["col_1", "col_2"], ["col_1"]);
    const columnA = makeColumn("col_1", "tbl_1");
    const columnB = makeColumn("col_2", "tbl_1");
    const document = makeDocument(
      { tbl_1: table },
      { col_1: columnA, col_2: columnB },
    );

    expect(checkStructuralInvariants(document)).toStrictEqual([]);
  });

  it("reports id-mismatch when a map key differs from the element id", () => {
    const table = makeTable("tbl_1");
    const document = makeDocument({ tbl_2: table });

    expect(checkStructuralInvariants(document)).toStrictEqual([
      { code: "id-mismatch", path: ["tables", "tbl_2", "id"] },
    ]);
  });

  it("reports table-not-found for a column whose table does not exist", () => {
    const column = makeColumn("col_1", "tbl_missing");
    const document = makeDocument({}, { col_1: column });

    expect(checkStructuralInvariants(document)).toStrictEqual([
      { code: "table-not-found", path: ["columns", "col_1", "tableId"] },
    ]);
  });

  it("reports column-not-found for a missing id in table columnIds", () => {
    const table = makeTable("tbl_1", ["col_missing"]);
    const document = makeDocument({ tbl_1: table });

    expect(checkStructuralInvariants(document)).toStrictEqual([
      { code: "column-not-found", path: ["tables", "tbl_1", "columnIds", 0] },
    ]);
  });

  it("reports column-ownership-mismatch when a column is missing from its table columnIds", () => {
    const table = makeTable("tbl_1", []);
    const column = makeColumn("col_1", "tbl_1");
    const document = makeDocument({ tbl_1: table }, { col_1: column });

    expect(checkStructuralInvariants(document)).toStrictEqual([
      {
        code: "column-ownership-mismatch",
        path: ["tables", "tbl_1", "columnIds"],
      },
    ]);
  });

  it("reports column-ownership-mismatch when columnIds lists a column of another table", () => {
    const table1 = makeTable("tbl_1", ["col_2"]);
    const table2 = makeTable("tbl_2", ["col_2"]);
    const column = makeColumn("col_2", "tbl_2");
    const document = makeDocument(
      { tbl_1: table1, tbl_2: table2 },
      { col_2: column },
    );

    expect(checkStructuralInvariants(document)).toStrictEqual([
      {
        code: "column-ownership-mismatch",
        path: ["tables", "tbl_1", "columnIds"],
      },
    ]);
  });

  it("reports column-ownership-mismatch when columnIds lists a column twice", () => {
    const table = makeTable("tbl_1", ["col_1", "col_1"]);
    const column = makeColumn("col_1", "tbl_1");
    const document = makeDocument({ tbl_1: table }, { col_1: column });

    expect(checkStructuralInvariants(document)).toStrictEqual([
      {
        code: "column-ownership-mismatch",
        path: ["tables", "tbl_1", "columnIds"],
      },
    ]);
  });

  it("reports column-not-in-table for a primary key column of another table", () => {
    const table1 = makeTable("tbl_1", ["col_1"], ["col_2"]);
    const table2 = makeTable("tbl_2", ["col_2"]);
    const column1 = makeColumn("col_1", "tbl_1");
    const column2 = makeColumn("col_2", "tbl_2");
    const document = makeDocument(
      { tbl_1: table1, tbl_2: table2 },
      { col_1: column1, col_2: column2 },
    );

    expect(checkStructuralInvariants(document)).toStrictEqual([
      {
        code: "column-not-in-table",
        path: ["tables", "tbl_1", "primaryKeyColumnIds", 0],
      },
    ]);
  });

  it("reports column-listed-twice for a repeated primary key column", () => {
    const table = makeTable("tbl_1", ["col_1"], ["col_1", "col_1"]);
    const column = makeColumn("col_1", "tbl_1");
    const document = makeDocument({ tbl_1: table }, { col_1: column });

    expect(checkStructuralInvariants(document)).toStrictEqual([
      {
        code: "column-listed-twice",
        path: ["tables", "tbl_1", "primaryKeyColumnIds", 1],
      },
    ]);
  });

  it("reports subject-area-not-found for a missing subject area", () => {
    const table = makeTable("tbl_1", [], [], "area_missing");
    const document = makeDocument({ tbl_1: table });

    expect(checkStructuralInvariants(document)).toStrictEqual([
      {
        code: "subject-area-not-found",
        path: ["tables", "tbl_1", "subjectAreaId"],
      },
    ]);
  });

  it("reports enum-not-found for a column type that uses a missing enum", () => {
    const table = makeTable("tbl_1", ["col_1"]);
    const column = makeColumn("col_1", "tbl_1", {
      kind: "enum",
      enumId: "enum_missing",
    });
    const document = makeDocument({ tbl_1: table }, { col_1: column });

    expect(checkStructuralInvariants(document)).toStrictEqual([
      { code: "enum-not-found", path: ["columns", "col_1", "type", "enumId"] },
    ]);
  });

  it("returns every error sorted by path then code", () => {
    const table = makeTable("tbl_1");
    const column = makeColumn("col_1", "tbl_missing");
    const document = makeDocument({ tbl_2: table }, { col_1: column });

    expect(checkStructuralInvariants(document)).toStrictEqual([
      { code: "table-not-found", path: ["columns", "col_1", "tableId"] },
      { code: "id-mismatch", path: ["tables", "tbl_2", "id"] },
    ]);
  });
});
