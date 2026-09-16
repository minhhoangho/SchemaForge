import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeTable,
} from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { getEnumUsage } from "./enum-usage";

// "orders" sorts before "users", and inside "users" the column order is
// `role` then `status`, which is not alphabetical.
function createDocument(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({ id: "tbl_users", name: "users" }),
      makeTable({ id: "tbl_orders", name: "orders" }),
    ],
    columns: [
      makeColumn({
        id: "col_users_status",
        tableId: "tbl_users",
        name: "status",
        type: { kind: "enum", enumId: "enum_status" },
      }),
      makeColumn({
        id: "col_users_role",
        tableId: "tbl_users",
        name: "role",
        type: { kind: "enum", enumId: "enum_status" },
      }),
      makeColumn({
        id: "col_orders_status",
        tableId: "tbl_orders",
        name: "state",
        type: { kind: "enum", enumId: "enum_status" },
      }),
      makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
    ],
    enums: [
      makeEnum({ id: "enum_status", name: "status" }),
      makeEnum({ id: "enum_unused", name: "unused" }),
    ],
  });
}

function createSingleUsageDocument(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [makeTable({ id: "tbl_users", name: "users" })],
    columns: [
      makeColumn({
        id: "col_users_status",
        tableId: "tbl_users",
        name: "status",
        type: { kind: "enum", enumId: "enum_status" },
      }),
    ],
    enums: [makeEnum({ id: "enum_status", name: "status" })],
  });
}

describe("getEnumUsage", () => {
  it("lists the columns that use an enum as table.column", () => {
    const usage = getEnumUsage(createSingleUsageDocument());

    expect(usage.get("enum_status")).toStrictEqual(["users.status"]);
  });

  it("returns an empty list for an unused enum", () => {
    const usage = getEnumUsage(createDocument());

    expect(usage.get("enum_unused")).toStrictEqual([]);
  });

  it("orders usages by table then by column order", () => {
    const usage = getEnumUsage(createDocument());

    expect(usage.get("enum_status")).toStrictEqual([
      "orders.state",
      "users.status",
      "users.role",
    ]);
  });

  it("returns the same map for the same document reference", () => {
    const document = createDocument();

    expect(getEnumUsage(document)).toBe(getEnumUsage(document));
  });
});
