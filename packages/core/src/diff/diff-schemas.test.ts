import { describe, expect, it } from "vitest";

import type { Column } from "../model/column.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import type { SchemaParts } from "../testing/factories.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeNote,
  makeRelation,
  makeSubjectArea,
  makeTable,
} from "../testing/factories.js";
import type { ElementChanges, SchemaDiff } from "./diff-schemas.js";
import { diffSchemas } from "./diff-schemas.js";

const NO_CHANGES = { added: [], removed: [], changed: [] };

const EMPTY_DIFF: SchemaDiff = {
  isRenamed: false,
  tables: NO_CHANGES,
  columns: NO_CHANGES,
  relations: NO_CHANGES,
  indexes: NO_CHANGES,
  enums: NO_CHANGES,
};

const USERS = makeTable({
  id: "tbl_users",
  primaryKeyColumnIds: ["col_user_id"],
});
const ORDERS = makeTable({
  id: "tbl_orders",
  primaryKeyColumnIds: ["col_order_id"],
});

const USER_ID = makeColumn({ id: "col_user_id", tableId: "tbl_users" });
const USER_EMAIL = makeColumn({
  id: "col_user_email",
  tableId: "tbl_users",
  type: { kind: "varchar", length: 255 },
});
const USER_REFERRER_ID = makeColumn({
  id: "col_user_referrer_id",
  tableId: "tbl_users",
  isNullable: true,
});
const ORDER_ID = makeColumn({ id: "col_order_id", tableId: "tbl_orders" });
const ORDER_USER_ID = makeColumn({
  id: "col_order_user_id",
  tableId: "tbl_orders",
});
const ORDER_CREATOR_ID = makeColumn({
  id: "col_order_creator_id",
  tableId: "tbl_orders",
});

const BASE_COLUMNS: readonly Column[] = [
  USER_ID,
  USER_EMAIL,
  USER_REFERRER_ID,
  ORDER_ID,
  ORDER_USER_ID,
  ORDER_CREATOR_ID,
];

const ORDER_USER = makeRelation({
  id: "rel_order_user",
  fromTableId: "tbl_orders",
  toTableId: "tbl_users",
  columnPairs: [
    { fromColumnId: "col_order_user_id", toColumnId: "col_user_id" },
  ],
});
const USER_REFERRER = makeRelation({
  id: "rel_user_referrer",
  fromTableId: "tbl_users",
  toTableId: "tbl_users",
  columnPairs: [
    { fromColumnId: "col_user_referrer_id", toColumnId: "col_user_id" },
  ],
});
const ORDER_CREATOR = makeRelation({
  id: "rel_order_creator",
  fromTableId: "tbl_orders",
  toTableId: "tbl_users",
  columnPairs: [
    { fromColumnId: "col_order_creator_id", toColumnId: "col_user_id" },
  ],
});

const USER_EMAIL_INDEX = makeIndex({
  id: "idx_user_email",
  tableId: "tbl_users",
  columnIds: ["col_user_email"],
});
const ORDER_USER_INDEX = makeIndex({
  id: "idx_order_user",
  tableId: "tbl_orders",
  columnIds: ["col_order_user_id"],
});
const ORDER_CREATOR_INDEX = makeIndex({
  id: "idx_order_creator",
  tableId: "tbl_orders",
  columnIds: ["col_order_creator_id"],
});

const STATUS = makeEnum({ id: "enum_status", values: ["active", "closed"] });
const ROLE = makeEnum({ id: "enum_role", values: ["admin"] });
const PLAN = makeEnum({ id: "enum_plan", values: ["free"] });

const PRODUCTS = makeTable({ id: "tbl_products" });
const PRODUCT_COLUMNS: readonly Column[] = [
  makeColumn({ id: "col_product_id", tableId: "tbl_products" }),
  makeColumn({ id: "col_product_sku", tableId: "tbl_products" }),
];

// users and orders with one relation, one index and one enum; `parts`
// replaces whole arrays.
function buildShop(parts: SchemaParts = {}): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [USERS, ORDERS],
    columns: BASE_COLUMNS,
    relations: [ORDER_USER],
    indexes: [USER_EMAIL_INDEX],
    enums: [STATUS],
    ...parts,
  });
}

function withTable(table: Table): SchemaDocument {
  return buildShop({
    tables: [USERS, ORDERS].map((existing) =>
      existing.id === table.id ? table : existing,
    ),
  });
}

describe("diffSchemas", () => {
  it("returns an empty diff for identical documents", () => {
    expect(diffSchemas(buildShop(), buildShop())).toStrictEqual(EMPTY_DIFF);
  });

  it("lists an added table and its columns", () => {
    const after = buildShop({
      tables: [USERS, ORDERS, PRODUCTS],
      columns: [...BASE_COLUMNS, ...PRODUCT_COLUMNS],
    });

    expect(diffSchemas(buildShop(), after)).toStrictEqual({
      ...EMPTY_DIFF,
      tables: { ...NO_CHANGES, added: ["tbl_products"] },
      columns: {
        ...NO_CHANGES,
        added: ["col_product_id", "col_product_sku"],
      },
    });
  });

  it("lists a removed table and its columns", () => {
    const before = buildShop({
      tables: [USERS, ORDERS, PRODUCTS],
      columns: [...BASE_COLUMNS, ...PRODUCT_COLUMNS],
    });

    expect(diffSchemas(before, buildShop())).toStrictEqual({
      ...EMPTY_DIFF,
      tables: { ...NO_CHANGES, removed: ["tbl_products"] },
      columns: {
        ...NO_CHANGES,
        removed: ["col_product_id", "col_product_sku"],
      },
    });
  });

  it.each([{ name: "customers" }, { comment: "people who buy" }])(
    "marks a table changed when its name or comment changes (%o)",
    (change) => {
      const after = withTable({ ...USERS, ...change });

      expect(diffSchemas(buildShop(), after)).toStrictEqual({
        ...EMPTY_DIFF,
        tables: { ...NO_CHANGES, changed: ["tbl_users"] },
      });
    },
  );

  it("ignores a table position change", () => {
    const after = withTable({ ...USERS, position: { x: 400, y: 120 } });

    expect(diffSchemas(buildShop(), after)).toStrictEqual(EMPTY_DIFF);
  });

  it("ignores added and removed column ids on a table", () => {
    const userName = makeColumn({ id: "col_user_name", tableId: "tbl_users" });
    const after = buildShop({
      columns: BASE_COLUMNS.flatMap((column) => {
        if (column.id === "col_user_id") {
          return [column, userName];
        }
        return column.id === "col_order_creator_id" ? [] : [column];
      }),
    });

    expect(diffSchemas(buildShop(), after)).toStrictEqual({
      ...EMPTY_DIFF,
      columns: {
        ...NO_CHANGES,
        added: ["col_user_name"],
        removed: ["col_order_creator_id"],
      },
    });
  });

  it("marks a table changed when the order of its kept columns changes", () => {
    const after = buildShop({
      columns: [
        USER_EMAIL,
        USER_ID,
        USER_REFERRER_ID,
        ORDER_ID,
        ORDER_USER_ID,
        ORDER_CREATOR_ID,
      ],
    });

    expect(diffSchemas(buildShop(), after)).toStrictEqual({
      ...EMPTY_DIFF,
      tables: { ...NO_CHANGES, changed: ["tbl_users"] },
    });
  });

  it("marks a column changed when its type changes", () => {
    const after = buildShop({
      columns: BASE_COLUMNS.map((column): Column =>
        column.id === "col_user_email"
          ? { ...column, type: { kind: "text" } }
          : column,
      ),
    });

    expect(diffSchemas(buildShop(), after)).toStrictEqual({
      ...EMPTY_DIFF,
      columns: { ...NO_CHANGES, changed: ["col_user_email"] },
    });
  });

  it.each<{
    readonly kind: "relations" | "indexes" | "enums";
    readonly before: SchemaParts;
    readonly after: SchemaParts;
    readonly expected: ElementChanges<string>;
  }>([
    {
      kind: "relations",
      before: { relations: [ORDER_USER, USER_REFERRER] },
      after: {
        relations: [{ ...ORDER_USER, onDelete: "cascade" }, ORDER_CREATOR],
      },
      expected: {
        added: ["rel_order_creator"],
        removed: ["rel_user_referrer"],
        changed: ["rel_order_user"],
      },
    },
    {
      kind: "indexes",
      before: { indexes: [USER_EMAIL_INDEX, ORDER_USER_INDEX] },
      after: {
        indexes: [{ ...USER_EMAIL_INDEX, isUnique: true }, ORDER_CREATOR_INDEX],
      },
      expected: {
        added: ["idx_order_creator"],
        removed: ["idx_order_user"],
        changed: ["idx_user_email"],
      },
    },
    {
      kind: "enums",
      before: { enums: [STATUS, ROLE] },
      after: {
        enums: [{ ...STATUS, values: ["active", "closed", "banned"] }, PLAN],
      },
      expected: {
        added: ["enum_plan"],
        removed: ["enum_role"],
        changed: ["enum_status"],
      },
    },
  ])(
    "lists added, removed and changed $kind",
    ({ kind, before, after, expected }) => {
      expect(diffSchemas(buildShop(before), buildShop(after))).toStrictEqual({
        ...EMPTY_DIFF,
        [kind]: expected,
      });
    },
  );

  it("reports a schema rename", () => {
    expect(
      diffSchemas(buildShop(), buildShop({ name: "store" })),
    ).toStrictEqual({ ...EMPTY_DIFF, isRenamed: true });
  });

  it("ignores subject area and note changes", () => {
    const after = buildShop({
      subjectAreas: [makeSubjectArea({ id: "area_sales" })],
      notes: [makeNote({ id: "note_todo" })],
    });

    expect(diffSchemas(buildShop(), after)).toStrictEqual(EMPTY_DIFF);
  });

  it("orders added tables by sortTables", () => {
    const after = buildShop({
      tables: [
        USERS,
        ORDERS,
        makeTable({ id: "tbl_1", name: "beta" }),
        makeTable({ id: "tbl_2", name: "Alpha" }),
      ],
    });

    expect(diffSchemas(buildShop(), after).tables.added).toStrictEqual([
      "tbl_2",
      "tbl_1",
    ]);
  });

  it("orders columns by table order, then by position in the table", () => {
    const before = buildShop({
      tables: [],
      columns: [],
      relations: [],
      indexes: [],
    });

    expect(diffSchemas(before, buildShop()).columns.added).toStrictEqual([
      "col_order_id",
      "col_order_user_id",
      "col_order_creator_id",
      "col_user_id",
      "col_user_email",
      "col_user_referrer_id",
    ]);
  });

  it("orders removed elements by the before document", () => {
    const after = buildShop({
      tables: [],
      columns: [],
      relations: [],
      indexes: [],
    });

    expect(diffSchemas(buildShop(), after).tables.removed).toStrictEqual([
      "tbl_orders",
      "tbl_users",
    ]);
  });
});
