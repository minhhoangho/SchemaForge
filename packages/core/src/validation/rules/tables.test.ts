import { describe, expect, it } from "vitest";

import { buildSchema, makeColumn, makeTable } from "../../testing/factories.js";

import { validateTables } from "./tables.js";

describe("validateTables", () => {
  it("reports a table without columns at its columnIds path", () => {
    const schema = buildSchema({ tables: [makeTable({ id: "tbl_users" })] });

    expect(validateTables(schema)).toStrictEqual([
      {
        code: "table-columns-empty",
        path: ["tables", "tbl_users", "columnIds"],
      },
    ]);
  });

  it("reports nothing for a table with one column", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [makeColumn({ id: "col_id", tableId: "tbl_users" })],
    });

    expect(validateTables(schema)).toStrictEqual([]);
  });

  it("reports every empty table", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_users" }),
        makeTable({ id: "tbl_orders" }),
        makeTable({ id: "tbl_items" }),
      ],
      columns: [makeColumn({ id: "col_id", tableId: "tbl_items" })],
    });

    expect(validateTables(schema)).toStrictEqual([
      {
        code: "table-columns-empty",
        path: ["tables", "tbl_orders", "columnIds"],
      },
      {
        code: "table-columns-empty",
        path: ["tables", "tbl_users", "columnIds"],
      },
    ]);
  });
});
