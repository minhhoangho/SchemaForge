import { describe, expect, it } from "vitest";

import type { Column } from "../model/column.js";
import type { ColumnId, IndexId, RelationId, TableId } from "../model/ids.js";
import type { ColumnPair, Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import type { Index } from "../model/table-index.js";

import {
  checkIndexInvariants,
  checkRelationInvariants,
} from "./relation-index-invariants.js";

function makeTable(id: TableId, columnIds: readonly ColumnId[] = []): Table {
  return {
    id,
    name: id,
    comment: "",
    position: { x: 0, y: 0 },
    subjectAreaId: null,
    columnIds,
    primaryKeyColumnIds: [],
  };
}

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

function makeIndex(
  id: IndexId,
  tableId: TableId,
  columnIds: readonly ColumnId[],
): Index {
  return { id, tableId, name: id, columnIds, isUnique: false };
}

function makeRelation(
  id: RelationId,
  fromTableId: TableId,
  toTableId: TableId,
  columnPairs: readonly ColumnPair[],
): Relation {
  return {
    id,
    kind: "oneToMany",
    fromTableId,
    toTableId,
    columnPairs,
    onDelete: "noAction",
    onUpdate: "noAction",
  };
}

function makeDocument(
  tables: SchemaDocument["tables"] = {},
  columns: SchemaDocument["columns"] = {},
  relations: SchemaDocument["relations"] = {},
  indexes: SchemaDocument["indexes"] = {},
): SchemaDocument {
  return {
    version: 1,
    name: "test",
    tables,
    columns,
    relations,
    indexes,
    enums: {},
    subjectAreas: {},
    notes: {},
  };
}

describe("checkIndexInvariants", () => {
  it("reports table-not-found for an index on a missing table", () => {
    const index = makeIndex("idx_1", "tbl_missing", ["col_1"]);
    const document = makeDocument({}, {}, {}, { idx_1: index });

    expect(checkIndexInvariants(document)).toStrictEqual([
      { code: "table-not-found", path: ["indexes", "idx_1", "tableId"] },
    ]);
  });

  it("skips column checks of an index whose table is missing", () => {
    const index = makeIndex("idx_1", "tbl_missing", ["col_missing"]);
    const document = makeDocument({}, {}, {}, { idx_1: index });

    expect(checkIndexInvariants(document)).toStrictEqual([
      { code: "table-not-found", path: ["indexes", "idx_1", "tableId"] },
    ]);
  });

  it("reports column-not-found for a missing index column", () => {
    const table = makeTable("tbl_1", ["col_1"]);
    const column = makeColumn("col_1", "tbl_1");
    const index = makeIndex("idx_1", "tbl_1", ["col_missing"]);
    const document = makeDocument(
      { tbl_1: table },
      { col_1: column },
      {},
      { idx_1: index },
    );

    expect(checkIndexInvariants(document)).toStrictEqual([
      { code: "column-not-found", path: ["indexes", "idx_1", "columnIds", 0] },
    ]);
  });

  it("reports column-not-in-table for an index column of another table", () => {
    const table1 = makeTable("tbl_1", ["col_1"]);
    const table2 = makeTable("tbl_2", ["col_2"]);
    const column1 = makeColumn("col_1", "tbl_1");
    const column2 = makeColumn("col_2", "tbl_2");
    const index = makeIndex("idx_1", "tbl_1", ["col_2"]);
    const document = makeDocument(
      { tbl_1: table1, tbl_2: table2 },
      { col_1: column1, col_2: column2 },
      {},
      { idx_1: index },
    );

    expect(checkIndexInvariants(document)).toStrictEqual([
      {
        code: "column-not-in-table",
        path: ["indexes", "idx_1", "columnIds", 0],
      },
    ]);
  });

  it("reports column-listed-twice for a repeated index column", () => {
    const table = makeTable("tbl_1", ["col_1"]);
    const column = makeColumn("col_1", "tbl_1");
    const index = makeIndex("idx_1", "tbl_1", ["col_1", "col_1"]);
    const document = makeDocument(
      { tbl_1: table },
      { col_1: column },
      {},
      { idx_1: index },
    );

    expect(checkIndexInvariants(document)).toStrictEqual([
      {
        code: "column-listed-twice",
        path: ["indexes", "idx_1", "columnIds", 1],
      },
    ]);
  });
});

describe("checkRelationInvariants", () => {
  it("reports table-not-found for a missing fromTableId and toTableId", () => {
    const relation = makeRelation(
      "rel_1",
      "tbl_missing_from",
      "tbl_missing_to",
      [{ fromColumnId: "col_1", toColumnId: "col_2" }],
    );
    const document = makeDocument({}, {}, { rel_1: relation });

    expect(checkRelationInvariants(document)).toStrictEqual([
      { code: "table-not-found", path: ["relations", "rel_1", "fromTableId"] },
      { code: "table-not-found", path: ["relations", "rel_1", "toTableId"] },
    ]);
  });

  it("reports column-not-in-table for a fromColumnId outside the from table", () => {
    const fromTable = makeTable("tbl_1", ["col_1"]);
    const toTable = makeTable("tbl_2", ["col_2"]);
    const otherTable = makeTable("tbl_3", ["col_3"]);
    const columns = {
      col_1: makeColumn("col_1", "tbl_1"),
      col_2: makeColumn("col_2", "tbl_2"),
      col_3: makeColumn("col_3", "tbl_3"),
    };
    const relation = makeRelation("rel_1", "tbl_1", "tbl_2", [
      { fromColumnId: "col_3", toColumnId: "col_2" },
    ]);
    const document = makeDocument(
      { tbl_1: fromTable, tbl_2: toTable, tbl_3: otherTable },
      columns,
      { rel_1: relation },
    );

    expect(checkRelationInvariants(document)).toStrictEqual([
      {
        code: "column-not-in-table",
        path: ["relations", "rel_1", "columnPairs", 0, "fromColumnId"],
      },
    ]);
  });

  it("reports column-not-in-table for a toColumnId outside the to table", () => {
    const fromTable = makeTable("tbl_1", ["col_1"]);
    const toTable = makeTable("tbl_2", ["col_2"]);
    const otherTable = makeTable("tbl_3", ["col_3"]);
    const columns = {
      col_1: makeColumn("col_1", "tbl_1"),
      col_2: makeColumn("col_2", "tbl_2"),
      col_3: makeColumn("col_3", "tbl_3"),
    };
    const relation = makeRelation("rel_1", "tbl_1", "tbl_2", [
      { fromColumnId: "col_1", toColumnId: "col_3" },
    ]);
    const document = makeDocument(
      { tbl_1: fromTable, tbl_2: toTable, tbl_3: otherTable },
      columns,
      { rel_1: relation },
    );

    expect(checkRelationInvariants(document)).toStrictEqual([
      {
        code: "column-not-in-table",
        path: ["relations", "rel_1", "columnPairs", 0, "toColumnId"],
      },
    ]);
  });

  it("reports column-listed-twice when one side repeats a column", () => {
    const fromTable = makeTable("tbl_1", ["col_1"]);
    const toTable = makeTable("tbl_2", ["col_3", "col_4"]);
    const columns = {
      col_1: makeColumn("col_1", "tbl_1"),
      col_3: makeColumn("col_3", "tbl_2"),
      col_4: makeColumn("col_4", "tbl_2"),
    };
    const relation = makeRelation("rel_1", "tbl_1", "tbl_2", [
      { fromColumnId: "col_1", toColumnId: "col_3" },
      { fromColumnId: "col_1", toColumnId: "col_4" },
    ]);
    const document = makeDocument(
      { tbl_1: fromTable, tbl_2: toTable },
      columns,
      { rel_1: relation },
    );

    expect(checkRelationInvariants(document)).toStrictEqual([
      {
        code: "column-listed-twice",
        path: ["relations", "rel_1", "columnPairs", 1, "fromColumnId"],
      },
    ]);
  });

  it("accepts a self-referencing relation", () => {
    const table = makeTable("tbl_1", ["col_1", "col_2"]);
    const columns = {
      col_1: makeColumn("col_1", "tbl_1"),
      col_2: makeColumn("col_2", "tbl_1"),
    };
    const relation = makeRelation("rel_1", "tbl_1", "tbl_1", [
      { fromColumnId: "col_1", toColumnId: "col_2" },
    ]);
    const document = makeDocument({ tbl_1: table }, columns, {
      rel_1: relation,
    });

    expect(checkRelationInvariants(document)).toStrictEqual([]);
  });
});
