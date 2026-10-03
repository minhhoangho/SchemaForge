import { describe, expect, it } from "vitest";

import type { ColumnId, RelationId } from "../model/ids.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeRelation,
  makeTable,
} from "../testing/factories.js";
import {
  findColumnByName,
  findEnumByName,
  findIndexByName,
  findRelationsBetween,
  findTableByName,
} from "./resolve-ai-names.js";

const USERS = makeTable({ id: "tbl_users" });
const ORDERS_LOWER = makeTable({ id: "tbl_orders", name: "orders" });
const ORDERS_UPPER = makeTable({ id: "tbl_orders_upper", name: "Orders" });
const PROTO = makeTable({ id: "tbl_proto", name: "__proto__" });

const USER_ID = makeColumn({
  id: "col_user_id",
  tableId: "tbl_users",
  name: "id",
});
const USER_EMAIL = makeColumn({
  id: "col_user_email",
  tableId: "tbl_users",
  name: "email",
});
const ORDER_ID = makeColumn({
  id: "col_order_id",
  tableId: "tbl_orders",
  name: "id",
});
const ORDER_USER_ID = makeColumn({
  id: "col_order_user_id",
  tableId: "tbl_orders",
  name: "user_id",
});
const ORDER_CREATOR_ID = makeColumn({
  id: "col_order_creator_id",
  tableId: "tbl_orders",
  name: "creator_id",
});
const PROTO_CONSTRUCTOR = makeColumn({
  id: "col_proto_constructor",
  tableId: "tbl_proto",
  name: "constructor",
});

const USERS_EMAIL_KEY = makeIndex({
  id: "idx_users_email_key",
  tableId: "tbl_users",
  columnIds: ["col_user_email"],
});
const ORDERS_USER_ID_IDX = makeIndex({
  id: "idx_orders_user",
  tableId: "tbl_orders",
  name: "Users_Email_Key",
  columnIds: ["col_order_user_id"],
});

const ORDER_STATUS = makeEnum({ id: "enum_order_status" });

const ORDERS_USER = makeRelation({
  id: "rel_orders_user",
  fromTableId: "tbl_orders",
  toTableId: "tbl_users",
  columnPairs: [
    { fromColumnId: "col_order_user_id", toColumnId: "col_user_id" },
  ],
});
const ORDERS_CREATOR = makeRelation({
  id: "rel_a_orders_creator",
  fromTableId: "tbl_orders",
  toTableId: "tbl_users",
  columnPairs: [
    { fromColumnId: "col_order_creator_id", toColumnId: "col_user_id" },
  ],
});
const USERS_SELF = makeRelation({
  id: "rel_users_self",
  fromTableId: "tbl_users",
  toTableId: "tbl_users",
  columnPairs: [{ fromColumnId: "col_user_email", toColumnId: "col_user_id" }],
});

const SCHEMA = buildSchema({
  tables: [USERS, ORDERS_LOWER, ORDERS_UPPER, PROTO],
  columns: [
    USER_ID,
    USER_EMAIL,
    ORDER_ID,
    ORDER_USER_ID,
    ORDER_CREATOR_ID,
    PROTO_CONSTRUCTOR,
  ],
  indexes: [USERS_EMAIL_KEY, ORDERS_USER_ID_IDX],
  enums: [ORDER_STATUS],
  relations: [ORDERS_USER, ORDERS_CREATOR, USERS_SELF],
});

function existing<Element>(element: Element | undefined): Element {
  if (element === undefined) {
    throw new Error("fixture element is missing");
  }
  return element;
}

const USERS_TABLE = existing(SCHEMA.tables.tbl_users);
const ORDERS_TABLE = existing(SCHEMA.tables.tbl_orders);

describe("findTableByName", () => {
  it("finds a table by its exact name", () => {
    expect(findTableByName(SCHEMA, "users")).toStrictEqual(
      SCHEMA.tables.tbl_users,
    );
  });

  it("finds a table case-insensitively when exactly one matches", () => {
    expect(findTableByName(SCHEMA, "USERS")).toStrictEqual(
      SCHEMA.tables.tbl_users,
    );
  });

  it("prefers the exact name over a case-insensitive match", () => {
    expect(findTableByName(SCHEMA, "Orders")).toStrictEqual(
      SCHEMA.tables.tbl_orders_upper,
    );
  });

  it("returns null when two tables match case-insensitively", () => {
    expect(findTableByName(SCHEMA, "ORDERS")).toBeNull();
  });

  it("returns null when two tables have the same exact name", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_1", name: "users" }),
        makeTable({ id: "tbl_2", name: "users" }),
      ],
    });

    expect(findTableByName(schema, "users")).toBeNull();
  });

  it("finds a table named __proto__ and a column named constructor", () => {
    const table = existing(findTableByName(SCHEMA, "__proto__") ?? undefined);

    expect([
      table,
      findColumnByName(SCHEMA, table, "constructor"),
    ]).toStrictEqual([
      SCHEMA.tables.tbl_proto,
      SCHEMA.columns.col_proto_constructor,
    ]);
  });

  it("returns null for toString when no table has that name", () => {
    expect(findTableByName(SCHEMA, "toString")).toBeNull();
  });
});

describe("findColumnByName", () => {
  it.each([
    ["tbl_users", "email", "col_user_email"],
    ["tbl_orders", "id", "col_order_id"],
    ["tbl_orders", "email", null],
  ] as const)(
    "finds a column only inside the given table (%s.%s)",
    (tableId, name, columnId) => {
      expect(
        findColumnByName(SCHEMA, existing(SCHEMA.tables[tableId]), name),
      ).toStrictEqual(columnId === null ? null : SCHEMA.columns[columnId]);
    },
  );

  it("finds a column case-insensitively when exactly one matches", () => {
    expect(findColumnByName(SCHEMA, USERS_TABLE, "EMAIL")).toStrictEqual(
      SCHEMA.columns.col_user_email,
    );
  });
});

describe("findEnumByName", () => {
  it.each(["order_status", "Order_Status"])(
    "finds an enum named %s",
    (name) => {
      expect(findEnumByName(SCHEMA, name)).toStrictEqual(
        SCHEMA.enums.enum_order_status,
      );
    },
  );

  it("returns null for constructor when no enum has that name", () => {
    expect(findEnumByName(SCHEMA, "constructor")).toBeNull();
  });
});

describe("findIndexByName", () => {
  it.each([
    ["tbl_users", "users_email_key", "idx_users_email_key"],
    ["tbl_orders", "users_email_key", "idx_orders_user"],
    ["tbl_orders", "orders_user", null],
  ] as const)(
    "finds an index only inside the given table (%s.%s)",
    (tableId, name, indexId) => {
      expect(
        findIndexByName(SCHEMA, existing(SCHEMA.tables[tableId]), name),
      ).toStrictEqual(indexId === null ? null : SCHEMA.indexes[indexId]);
    },
  );
});

describe("findRelationsBetween", () => {
  it("finds relations between two tables", () => {
    expect(
      findRelationsBetween(SCHEMA, ORDERS_TABLE, USERS_TABLE, null),
    ).toStrictEqual([
      SCHEMA.relations.rel_orders_user,
      SCHEMA.relations.rel_a_orders_creator,
    ]);
  });

  it("finds no relation in the reverse direction", () => {
    expect(
      findRelationsBetween(SCHEMA, USERS_TABLE, ORDERS_TABLE, null),
    ).toStrictEqual([]);
  });

  it.each<[readonly ColumnId[], readonly RelationId[]]>([
    [["col_order_creator_id"], ["rel_a_orders_creator"]],
    [["col_order_user_id"], ["rel_orders_user"]],
    [["col_order_user_id", "col_order_creator_id"], []],
    [[], []],
  ])("narrows relations by source columns %j", (columnIds, relationIds) => {
    const columns = columnIds.map((id) => existing(SCHEMA.columns[id]));

    expect(
      findRelationsBetween(SCHEMA, ORDERS_TABLE, USERS_TABLE, columns),
    ).toStrictEqual(relationIds.map((id) => SCHEMA.relations[id]));
  });
});
