import { diffSchemas } from "@schemaforge/core";
import type { Relation, SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { buildProposalDisplay, countProposalChanges } from "./proposal-display";

const USERS = makeTable({ id: "tbl_users", name: "users" });
const ORDERS = makeTable({
  id: "tbl_orders",
  name: "orders",
  position: { x: 400, y: 120 },
});
const ITEMS = makeTable({ id: "tbl_items", name: "items" });

const USER_ID = makeColumn({ id: "col_id", tableId: "tbl_users", name: "id" });
const USER_EMAIL = makeColumn({
  id: "col_email",
  tableId: "tbl_users",
  name: "email",
  type: { kind: "varchar", length: 255 },
});
const USER_NAME = makeColumn({
  id: "col_name",
  tableId: "tbl_users",
  name: "name",
});
const ORDER_ID = makeColumn({
  id: "col_order_id",
  tableId: "tbl_orders",
  name: "id",
});
const ORDER_USER_ID = makeColumn({
  id: "col_user_id",
  tableId: "tbl_orders",
  name: "user_id",
});
const ITEM_ID = makeColumn({ id: "col_item_id", tableId: "tbl_items" });

const ORDERS_USERS = makeRelation({
  id: "rel_orders_users",
  fromTableId: "tbl_orders",
  toTableId: "tbl_users",
  columnPairs: [{ fromColumnId: "col_user_id", toColumnId: "col_id" }],
});

const BASE_COLUMNS = [USER_ID, USER_EMAIL, USER_NAME, ORDER_ID, ORDER_USER_ID];

function createBase(): SchemaDocument {
  return buildSchema({
    tables: [USERS, ORDERS],
    columns: BASE_COLUMNS,
    relations: [ORDERS_USERS],
  });
}

function toProposal(base: SchemaDocument, preview: SchemaDocument) {
  const diff = diffSchemas(base, preview);
  const { display } = buildProposalDisplay(base, preview, diff);
  return { base, preview, display, diff };
}

function withRelation(relation: Relation): SchemaDocument {
  return buildSchema({
    tables: [USERS, ORDERS],
    columns: BASE_COLUMNS,
    relations: [relation],
  });
}

describe("buildProposalDisplay", () => {
  it("keeps a removed table at its base position", () => {
    const base = createBase();
    const preview = buildSchema({
      tables: [USERS],
      columns: [USER_ID, USER_EMAIL, USER_NAME],
    });

    const { display } = buildProposalDisplay(
      base,
      preview,
      diffSchemas(base, preview),
    );

    expect(display.tables.tbl_orders).toStrictEqual(base.tables.tbl_orders);
    expect(display.columns.col_user_id).toStrictEqual(ORDER_USER_ID);
  });

  it("keeps a removed column at its old index", () => {
    const base = createBase();
    const preview = buildSchema({
      tables: [USERS, ORDERS],
      columns: [USER_ID, USER_NAME, ORDER_ID, ORDER_USER_ID],
      relations: [ORDERS_USERS],
    });

    const { display } = buildProposalDisplay(
      base,
      preview,
      diffSchemas(base, preview),
    );

    expect(display.tables.tbl_users?.columnIds).toStrictEqual([
      "col_id",
      "col_email",
      "col_name",
    ]);
    expect(display.columns.col_email).toStrictEqual(USER_EMAIL);
  });

  it("keeps a removed relation when both tables are drawn", () => {
    const base = createBase();
    const preview = buildSchema({
      tables: [USERS, ORDERS],
      columns: BASE_COLUMNS,
    });

    const { display } = buildProposalDisplay(
      base,
      preview,
      diffSchemas(base, preview),
    );

    expect(display.relations.rel_orders_users).toStrictEqual(ORDERS_USERS);
  });

  it("marks added, changed and removed tables, columns and relations", () => {
    const base = createBase();
    const preview = buildSchema({
      tables: [{ ...USERS, name: "members" }, ITEMS],
      columns: [USER_ID, { ...USER_EMAIL, name: "mail" }, ITEM_ID],
    });

    const { marks } = buildProposalDisplay(
      base,
      preview,
      diffSchemas(base, preview),
    );

    expect(Object.fromEntries(marks)).toStrictEqual({
      tbl_items: "added",
      tbl_users: "changed",
      tbl_orders: "removed",
      col_item_id: "added",
      col_email: "changed",
      col_name: "removed",
      col_order_id: "removed",
      col_user_id: "removed",
      rel_orders_users: "removed",
    });
  });
});

describe("countProposalChanges", () => {
  it("counts the columns of added and removed tables", () => {
    const preview = buildSchema({
      tables: [USERS, ITEMS],
      columns: [USER_ID, USER_EMAIL, USER_NAME, ITEM_ID],
    });

    const counts = countProposalChanges(toProposal(createBase(), preview));

    expect(counts).toStrictEqual({
      addedTables: 1,
      addedColumns: 1,
      changedTables: 0,
      changedColumns: 0,
      removedTables: 1,
      removedColumns: 2,
      cascadeRelations: 0,
      retypedColumns: 0,
    });
  });

  it.each(["onDelete", "onUpdate"] as const)(
    "counts relations added or changed to cascade (%s)",
    (field) => {
      const preview = buildSchema({
        tables: [USERS, ORDERS],
        columns: BASE_COLUMNS,
        relations: [
          { ...ORDERS_USERS, [field]: "cascade" },
          makeRelation({
            id: "rel_orders_users_again",
            fromTableId: "tbl_orders",
            toTableId: "tbl_users",
            columnPairs: [
              { fromColumnId: "col_order_id", toColumnId: "col_id" },
            ],
            [field]: "cascade",
          }),
        ],
      });

      const counts = countProposalChanges(toProposal(createBase(), preview));

      expect(counts.cascadeRelations).toBe(2);
    },
  );

  it("does not count a relation that was already cascade", () => {
    const base = withRelation({ ...ORDERS_USERS, onDelete: "cascade" });
    const preview = withRelation({
      ...ORDERS_USERS,
      onDelete: "cascade",
      onUpdate: "restrict",
    });

    const counts = countProposalChanges(toProposal(base, preview));

    expect(counts.cascadeRelations).toBe(0);
  });

  it("counts a retyped column but not a column whose enum was renamed", () => {
    const state = makeColumn({
      id: "col_state",
      tableId: "tbl_users",
      name: "state",
      type: { kind: "enum", enumId: "enum_status" },
    });
    const base = buildSchema({
      tables: [USERS],
      columns: [USER_EMAIL, state],
      enums: [makeEnum({ id: "enum_status", name: "status" })],
    });
    const preview = buildSchema({
      tables: [USERS],
      columns: [
        { ...USER_EMAIL, type: { kind: "text" } },
        { ...state, name: "status" },
      ],
      enums: [makeEnum({ id: "enum_status", name: "order_status" })],
    });

    const counts = countProposalChanges(toProposal(base, preview));

    expect(counts).toMatchObject({ changedColumns: 2, retypedColumns: 1 });
  });
});
