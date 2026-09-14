import { describe, expect, it } from "vitest";

import { columnShape } from "./column.js";

const COLUMN = {
  id: "col_1",
  tableId: "tbl_1",
  name: "email",
  type: { kind: "varchar", length: 255 },
  isNullable: false,
  defaultValue: { kind: "literal", value: "" },
  isUnique: true,
  isAutoIncrement: false,
  comment: "Login email",
};

describe("columnShape", () => {
  it("accepts a column with every field present", () => {
    expect(columnShape.safeParse(COLUMN).data).toStrictEqual(COLUMN);
  });

  it("rejects a column missing isNullable", () => {
    const columnWithoutIsNullable = {
      id: "col_1",
      tableId: "tbl_1",
      name: "email",
      type: { kind: "varchar", length: 255 },
      defaultValue: null,
      isUnique: true,
      isAutoIncrement: false,
      comment: "",
    };

    expect(columnShape.safeParse(columnWithoutIsNullable).success).toBe(false);
  });

  it("rejects an extra field", () => {
    expect(
      columnShape.safeParse({ ...COLUMN, isPrimaryKey: true }).success,
    ).toBe(false);
  });

  it("accepts a null default value", () => {
    expect(
      columnShape.safeParse({ ...COLUMN, defaultValue: null }).success,
    ).toBe(true);
  });
});
