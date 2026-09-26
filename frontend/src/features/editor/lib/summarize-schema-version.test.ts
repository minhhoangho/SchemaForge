import { createEmptySchema } from "@schemaforge/core";
import { buildSchema, makeColumn, makeTable } from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { summarizeSchemaVersion } from "./summarize-schema-version";

const UPDATED_AT = Date.parse("2026-09-18T00:00:00.000Z");

describe("summarizeSchemaVersion", () => {
  it("counts the tables and columns of a document", () => {
    const document = buildSchema({
      name: "shop",
      tables: [
        makeTable({ id: "tbl_users", name: "users" }),
        makeTable({ id: "tbl_orders", name: "orders" }),
      ],
      columns: [
        makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
        makeColumn({ id: "col_orders_id", tableId: "tbl_orders", name: "id" }),
        makeColumn({
          id: "col_orders_user_id",
          tableId: "tbl_orders",
          name: "user_id",
        }),
      ],
    });

    expect(summarizeSchemaVersion(document, UPDATED_AT)).toEqual({
      updatedAt: UPDATED_AT,
      tableCount: 2,
      columnCount: 3,
    });
  });

  it("returns zero counts for an empty schema", () => {
    expect(
      summarizeSchemaVersion(createEmptySchema("Billing"), UPDATED_AT),
    ).toEqual({ updatedAt: UPDATED_AT, tableCount: 0, columnCount: 0 });
  });
});
