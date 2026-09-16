import {
  buildSchema,
  makeColumn,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import {
  countSelection,
  EMPTY_SELECTION,
  filterSelection,
  isSelectionEmpty,
} from "./selection";

const documentWithOneRelation = buildSchema({
  tables: [makeTable({ id: "tbl_1" }), makeTable({ id: "tbl_2" })],
  columns: [
    makeColumn({ id: "col_1", tableId: "tbl_1" }),
    makeColumn({ id: "col_2", tableId: "tbl_2" }),
  ],
  relations: [
    makeRelation({
      id: "rel_1",
      fromTableId: "tbl_1",
      toTableId: "tbl_2",
      columnPairs: [{ fromColumnId: "col_1", toColumnId: "col_2" }],
    }),
  ],
});

describe("countSelection", () => {
  it("counts tables and relations together", () => {
    const selection = {
      tableIds: ["tbl_1", "tbl_2"],
      relationIds: ["rel_1"],
    } as const;

    expect(countSelection(selection)).toBe(3);
  });
});

describe("isSelectionEmpty", () => {
  it("treats an empty selection as empty", () => {
    expect(isSelectionEmpty(EMPTY_SELECTION)).toBe(true);
  });

  it("treats a selection holding one relation as not empty", () => {
    expect(isSelectionEmpty({ tableIds: [], relationIds: ["rel_1"] })).toBe(
      false,
    );
  });
});

describe("filterSelection", () => {
  it("drops ids that no longer exist in the document", () => {
    const selection = {
      tableIds: ["tbl_1", "tbl_9"],
      relationIds: ["rel_1", "rel_9"],
    } as const;

    expect(filterSelection(selection, documentWithOneRelation)).toStrictEqual({
      tableIds: ["tbl_1"],
      relationIds: ["rel_1"],
    });
  });

  it("returns the same selection object when nothing was dropped", () => {
    const selection = { tableIds: ["tbl_1"], relationIds: ["rel_1"] } as const;

    expect(filterSelection(selection, documentWithOneRelation)).toBe(selection);
  });
});
