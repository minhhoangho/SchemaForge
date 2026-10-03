import { describe, expect, it } from "vitest";

import { createEmptySchema } from "../model/create-empty-schema.js";
import { applyOperation } from "../operations/apply-operation.js";
import { buildRelation } from "../operations/build-relation.js";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeEnum,
  makeIndex,
  makeRelation,
  makeTable,
} from "../testing/factories.js";
import { createSampleSchema } from "../testing/sample-schema.js";
import { unwrapOk } from "../testing/unwrap-result.js";
import { describeAiChanges } from "./describe-ai-changes.js";

const USERS = makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_id"] });
const USER_ID = makeColumn({ id: "col_id", tableId: "tbl_users" });
const ORDERS = makeTable({ id: "tbl_orders", name: "order items" });
const ORDER_ID = makeColumn({ id: "col_order_id", tableId: "tbl_orders" });
const ORDER_USER = makeColumn({
  id: "col_order_user",
  tableId: "tbl_orders",
  name: "user_id",
});

const BASE = buildSchema({
  name: "shop",
  tables: [USERS],
  columns: [USER_ID],
});

describe("describeAiChanges", () => {
  it("describes an added table and its columns", () => {
    const after = buildSchema({
      name: "shop",
      tables: [USERS, ORDERS],
      columns: [USER_ID, ORDER_ID, ORDER_USER],
    });

    expect(describeAiChanges(BASE, after)).toStrictEqual([
      'added table "order items"',
      'added column "order items".order_id',
      'added column "order items".user_id',
    ]);
  });

  it("describes the foreign key column a relation added", () => {
    const before = buildSchema({
      name: "shop",
      tables: [USERS, ORDERS],
      columns: [USER_ID, ORDER_ID],
    });
    const operation = unwrapOk(
      buildRelation(
        before,
        {
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          kind: "oneToMany",
          onDelete: "noAction",
          onUpdate: "noAction",
        },
        createCounterIdGenerator(),
      ),
    );
    const after = unwrapOk(applyOperation(before, operation)).schema;

    expect(describeAiChanges(before, after)).toStrictEqual([
      'added column "order items".users_id',
      'added relation "order items"(users_id) -> users(id)',
    ]);
  });

  it("describes removed elements by their old names", () => {
    const before = buildSchema({
      name: "shop",
      tables: [USERS, ORDERS],
      columns: [USER_ID, ORDER_ID, ORDER_USER],
      relations: [
        makeRelation({
          id: "rel_1",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_order_user", toColumnId: "col_id" },
          ],
        }),
      ],
      indexes: [
        makeIndex({
          id: "idx_by_user",
          tableId: "tbl_orders",
          columnIds: ["col_order_user"],
        }),
      ],
      enums: [makeEnum({ id: "enum_status" })],
    });

    expect(describeAiChanges(before, BASE)).toStrictEqual([
      'removed table "order items"',
      'removed column "order items".order_id',
      'removed column "order items".user_id',
      'removed relation "order items"(user_id) -> users(id)',
      'removed index by_user on "order items"',
      "removed enum status",
    ]);
  });

  it("describes changed elements by their new names", () => {
    const before = buildSchema({
      name: "shop",
      tables: [USERS],
      columns: [USER_ID],
      indexes: [
        makeIndex({ id: "idx_a", tableId: "tbl_users", columnIds: ["col_id"] }),
      ],
      enums: [makeEnum({ id: "enum_status" })],
    });
    const after = buildSchema({
      name: "shop",
      tables: [{ ...USERS, name: "people" }],
      columns: [{ ...USER_ID, name: "key" }],
      indexes: [
        makeIndex({
          id: "idx_a",
          tableId: "tbl_users",
          columnIds: ["col_id"],
          isUnique: true,
        }),
      ],
      enums: [makeEnum({ id: "enum_status", name: "state" })],
    });

    expect(describeAiChanges(before, after)).toStrictEqual([
      "changed table people",
      "changed column people.key",
      "changed index a on people",
      "changed enum state",
    ]);
  });

  it("describes a changed relation", () => {
    const relation = makeRelation({
      id: "rel_1",
      fromTableId: "tbl_orders",
      toTableId: "tbl_users",
      columnPairs: [{ fromColumnId: "col_order_user", toColumnId: "col_id" }],
    });
    const parts = {
      tables: [USERS, ORDERS],
      columns: [USER_ID, ORDER_USER],
    };
    const before = buildSchema({ ...parts, relations: [relation] });
    const after = buildSchema({
      ...parts,
      relations: [{ ...relation, onDelete: "cascade" }],
    });

    expect(describeAiChanges(before, after)).toStrictEqual([
      'changed relation "order items"(user_id) -> users(id)',
    ]);
  });

  it("reports a schema rename first", () => {
    const after = buildSchema({
      name: "my shop",
      tables: [USERS, ORDERS],
      columns: [USER_ID],
    });

    expect(describeAiChanges(BASE, after)).toStrictEqual([
      'renamed schema to "my shop"',
      'added table "order items"',
    ]);
  });

  it("returns no changes for identical documents", () => {
    expect(describeAiChanges(BASE, BASE)).toStrictEqual([]);
  });

  it("never includes an id", () => {
    const sample = createSampleSchema();
    const allIds = [
      ...Object.keys(sample.tables),
      ...Object.keys(sample.columns),
      ...Object.keys(sample.relations),
      ...Object.keys(sample.indexes),
      ...Object.keys(sample.enums),
    ];

    const text = describeAiChanges(createEmptySchema("x"), sample).join("\n");

    expect(allIds.filter((id) => text.includes(id))).toStrictEqual([]);
  });
});
