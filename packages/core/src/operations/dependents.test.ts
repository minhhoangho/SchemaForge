import { describe, expect, it } from "vitest";

import {
  buildSchema,
  makeColumn,
  makeIndex,
  makeRelation,
  makeTable,
} from "../testing/factories.js";
import {
  findIndexesUsingColumns,
  findRelationsUsingColumns,
} from "./dependents.js";

describe("findIndexesUsingColumns", () => {
  it("finds indexes that contain any of the columns sorted by id", () => {
    const table = makeTable({ id: "tbl_1" });
    const columnA = makeColumn({ id: "col_a", tableId: "tbl_1" });
    const columnB = makeColumn({ id: "col_b", tableId: "tbl_1" });
    const columnC = makeColumn({ id: "col_c", tableId: "tbl_1" });
    const indexOnB = makeIndex({
      id: "idx_2",
      tableId: "tbl_1",
      columnIds: ["col_b"],
    });
    const indexOnA = makeIndex({
      id: "idx_1",
      tableId: "tbl_1",
      columnIds: ["col_a", "col_c"],
    });
    const indexOnC = makeIndex({
      id: "idx_3",
      tableId: "tbl_1",
      columnIds: ["col_c"],
    });
    const schema = buildSchema({
      tables: [table],
      columns: [columnA, columnB, columnC],
      indexes: [indexOnB, indexOnA, indexOnC],
    });

    const result = findIndexesUsingColumns(schema, new Set(["col_a", "col_b"]));

    expect(result).toStrictEqual([indexOnA, indexOnB]);
  });
});

describe("findRelationsUsingColumns", () => {
  it("finds relations that use a column on the from side", () => {
    const table = makeTable({ id: "tbl_1" });
    const column = makeColumn({ id: "col_a", tableId: "tbl_1" });
    const relation = makeRelation({
      id: "rel_1",
      fromTableId: "tbl_1",
      toTableId: "tbl_1",
      columnPairs: [{ fromColumnId: "col_a", toColumnId: "col_a" }],
    });
    const schema = buildSchema({
      tables: [table],
      columns: [column],
      relations: [relation],
    });

    const result = findRelationsUsingColumns(schema, new Set(["col_a"]));

    expect(result).toStrictEqual([relation]);
  });

  it("finds relations that use a column on the to side", () => {
    const leftTable = makeTable({ id: "tbl_1" });
    const rightTable = makeTable({ id: "tbl_2" });
    const leftColumn = makeColumn({ id: "col_a", tableId: "tbl_1" });
    const rightColumn = makeColumn({ id: "col_b", tableId: "tbl_2" });
    const relation = makeRelation({
      id: "rel_1",
      fromTableId: "tbl_1",
      toTableId: "tbl_2",
      columnPairs: [{ fromColumnId: "col_a", toColumnId: "col_b" }],
    });
    const schema = buildSchema({
      tables: [leftTable, rightTable],
      columns: [leftColumn, rightColumn],
      relations: [relation],
    });

    const result = findRelationsUsingColumns(schema, new Set(["col_b"]));

    expect(result).toStrictEqual([relation]);
  });

  it("returns an empty list when nothing uses the columns", () => {
    const table = makeTable({ id: "tbl_1" });
    const column = makeColumn({ id: "col_a", tableId: "tbl_1" });
    const schema = buildSchema({ tables: [table], columns: [column] });

    expect(findIndexesUsingColumns(schema, new Set(["col_a"]))).toStrictEqual(
      [],
    );
    expect(findRelationsUsingColumns(schema, new Set(["col_a"]))).toStrictEqual(
      [],
    );
  });
});
