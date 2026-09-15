import { describe, expect, it } from "vitest";

import { buildSchema, makeColumn, makeTable } from "../testing/factories.js";
import { checkColumnList } from "./references.js";

describe("checkColumnList", () => {
  it("returns null for a valid column list", () => {
    const table = makeTable({ id: "tbl_1" });
    const column = makeColumn({ id: "col_a", tableId: "tbl_1" });
    const schema = buildSchema({ tables: [table], columns: [column] });

    expect(checkColumnList(schema, "tbl_1", ["col_a"], ["columnIds"])).toBe(
      null,
    );
  });

  it("returns column-not-found with the path extended by the index", () => {
    const table = makeTable({ id: "tbl_1" });
    const schema = buildSchema({ tables: [table] });

    const result = checkColumnList(
      schema,
      "tbl_1",
      ["col_missing"],
      ["columnIds"],
    );

    expect(result).toStrictEqual({
      code: "column-not-found",
      path: ["columnIds", 0],
    });
  });

  it("returns only the first error of the list", () => {
    const table = makeTable({ id: "tbl_1" });
    const schema = buildSchema({ tables: [table] });

    const result = checkColumnList(
      schema,
      "tbl_1",
      ["col_missing_1", "col_missing_2"],
      ["columnIds"],
    );

    expect(result).toStrictEqual({
      code: "column-not-found",
      path: ["columnIds", 0],
    });
  });
});
