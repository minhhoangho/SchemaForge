import { describe, expect, expectTypeOf, it } from "vitest";

import type { ColumnId } from "./ids.js";
import { tableShape } from "./table.js";
import type { Table } from "./table.js";

const TABLE = {
  id: "tbl_1",
  name: "users",
  comment: "",
  position: { x: 0, y: 0 },
  subjectAreaId: null,
  columnIds: [],
  primaryKeyColumnIds: [],
};

describe("tableShape", () => {
  it("accepts a table with empty column and primary key lists", () => {
    expect(tableShape.safeParse(TABLE).data).toStrictEqual(TABLE);
  });

  it("rejects a column id with the wrong prefix in columnIds", () => {
    expect(
      tableShape.safeParse({ ...TABLE, columnIds: ["tbl_2"] }).success,
    ).toBe(false);
  });

  it("rejects an extra field", () => {
    expect(tableShape.safeParse({ ...TABLE, color: "red" }).success).toBe(
      false,
    );
  });

  it("infers columnIds as a readonly array of ColumnId", () => {
    expectTypeOf<Table["columnIds"]>().toEqualTypeOf<readonly ColumnId[]>();
  });
});
