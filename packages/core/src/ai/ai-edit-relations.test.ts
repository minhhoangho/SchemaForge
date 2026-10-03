import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../model/schema-document.js";
import { applyOperation } from "../operations/apply-operation.js";
import { buildManyToMany } from "../operations/build-many-to-many.js";
import { buildRelation } from "../operations/build-relation.js";
import type { Operation } from "../operations/operation.js";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeRelation,
  makeTable,
} from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import type { AiEdit } from "./ai-edit-tools.js";
import { applyAiEdit } from "./apply-ai-edit.js";
import type { AiTablePlacement } from "./place-ai-table.js";
import { createAiTablePlacement } from "./place-ai-table.js";

const USERS = makeTable({
  id: "tbl_users",
  primaryKeyColumnIds: ["col_users_id"],
});
const ORDERS = makeTable({
  id: "tbl_orders",
  position: { x: 400, y: 0 },
  primaryKeyColumnIds: ["col_orders_id"],
});
const PRODUCTS = makeTable({
  id: "tbl_products",
  position: { x: 800, y: 0 },
  primaryKeyColumnIds: ["col_products_id"],
});
const NOTES = makeTable({ id: "tbl_notes" });

const SCHEMA = buildSchema({
  name: "shop",
  tables: [USERS, ORDERS, PRODUCTS, NOTES],
  columns: [
    makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
    makeColumn({
      id: "col_users_number",
      tableId: "tbl_users",
      name: "number",
      isUnique: true,
    }),
    makeColumn({ id: "col_orders_id", tableId: "tbl_orders", name: "id" }),
    makeColumn({
      id: "col_orders_user_id",
      tableId: "tbl_orders",
      name: "user_id",
    }),
    makeColumn({
      id: "col_orders_reviewer_id",
      tableId: "tbl_orders",
      name: "reviewer_id",
    }),
    makeColumn({ id: "col_products_id", tableId: "tbl_products", name: "id" }),
    makeColumn({ id: "col_notes_body", tableId: "tbl_notes", name: "body" }),
  ],
});

const ORDER_USER = makeRelation({
  id: "rel_orders_user",
  fromTableId: "tbl_orders",
  toTableId: "tbl_users",
  columnPairs: [
    { fromColumnId: "col_orders_user_id", toColumnId: "col_users_id" },
  ],
});
const ORDER_REVIEWER = makeRelation({
  id: "rel_orders_reviewer",
  fromTableId: "tbl_orders",
  toTableId: "tbl_users",
  columnPairs: [
    { fromColumnId: "col_orders_reviewer_id", toColumnId: "col_users_id" },
  ],
});

const RELATED: SchemaDocument = {
  ...SCHEMA,
  relations: { [ORDER_USER.id]: ORDER_USER },
};
const AMBIGUOUS: SchemaDocument = {
  ...SCHEMA,
  relations: {
    [ORDER_USER.id]: ORDER_USER,
    [ORDER_REVIEWER.id]: ORDER_REVIEWER,
  },
};

// The original schema's rightmost table is at x 800, so the grid starts at 1200.
const GRID_ORIGIN_X = 1200;

function apply(
  edit: AiEdit,
  schema: SchemaDocument = SCHEMA,
  placement: AiTablePlacement = createAiTablePlacement(SCHEMA),
): ReturnType<typeof applyAiEdit> {
  return applyAiEdit(schema, edit, {
    generateId: createCounterIdGenerator(),
    placement,
  });
}

function childTypes(operation: Operation): readonly string[] {
  return operation.type === "batch"
    ? operation.operations.map((child) => child.type)
    : [];
}

describe("applyAiEdit addRelation many-to-many", () => {
  it("adds a many-to-many relation with a junction table on the grid", () => {
    const placement = { originX: GRID_ORIGIN_X, placedCount: 5 };

    const success = unwrapOk(
      apply(
        {
          tool: "addRelation",
          input: {
            fromTable: "orders",
            toTable: "products",
            kind: "manyToMany",
            junctionTable: "order_items",
          },
        },
        SCHEMA,
        placement,
      ),
    );

    const expected = buildManyToMany(
      SCHEMA,
      {
        leftTableId: "tbl_orders",
        rightTableId: "tbl_products",
        junctionTableName: "order_items",
        position: { x: GRID_ORIGIN_X + 400, y: 400 },
      },
      createCounterIdGenerator(),
    );
    expect(success.operation).toStrictEqual(unwrapOk(expected));
    expect(success.placedTables).toBe(1);
  });

  it("names the junction table from both tables when junctionTable is omitted", () => {
    const success = unwrapOk(
      apply({
        tool: "addRelation",
        input: { fromTable: "orders", toTable: "products", kind: "manyToMany" },
      }),
    );

    expect(success.schema.tables.tbl_1?.name).toBe("orders_products");
  });

  it("returns primary-key-missing at the table without a primary key", () => {
    const errors = unwrapError(
      apply({
        tool: "addRelation",
        input: { fromTable: "notes", toTable: "users", kind: "manyToMany" },
      }),
    );

    expect(errors).toStrictEqual([
      {
        code: "primary-key-missing",
        path: ["leftTableId"],
        at: "tables.notes",
      },
    ]);
  });
});

describe("applyAiEdit addRelation with fromColumns", () => {
  it("adds a relation on the given source columns referencing the target primary key", () => {
    const success = unwrapOk(
      apply({
        tool: "addRelation",
        input: {
          fromTable: "orders",
          toTable: "users",
          kind: "oneToMany",
          fromColumns: ["user_id"],
        },
      }),
    );

    expect(success.operation).toStrictEqual({
      type: "addRelation",
      relation: {
        id: "rel_1",
        kind: "oneToMany",
        fromTableId: "tbl_orders",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_orders_user_id", toColumnId: "col_users_id" },
        ],
        onDelete: "noAction",
        onUpdate: "noAction",
      },
    });
    expect(success.placedTables).toBe(0);
  });

  it("adds a relation pairing fromColumns with toColumns", () => {
    const success = unwrapOk(
      apply({
        tool: "addRelation",
        input: {
          fromTable: "orders",
          toTable: "users",
          kind: "oneToMany",
          fromColumns: ["user_id"],
          toColumns: ["number"],
          onDelete: "cascade",
          onUpdate: "restrict",
        },
      }),
    );

    expect(success.schema.relations.rel_1).toStrictEqual({
      id: "rel_1",
      kind: "oneToMany",
      fromTableId: "tbl_orders",
      toTableId: "tbl_users",
      columnPairs: [
        { fromColumnId: "col_orders_user_id", toColumnId: "col_users_number" },
      ],
      onDelete: "cascade",
      onUpdate: "restrict",
    });
  });

  it.each([
    { toColumns: ["id"], case: "toColumns" },
    { toColumns: undefined, case: "the target primary key" },
  ])(
    "returns relation-columns-mismatch when the column lists differ in length ($case)",
    ({ toColumns }) => {
      const errors = unwrapError(
        apply({
          tool: "addRelation",
          input: {
            fromTable: "orders",
            toTable: "users",
            kind: "oneToMany",
            fromColumns: ["user_id", "reviewer_id"],
            ...(toColumns === undefined ? {} : { toColumns }),
          },
        }),
      );

      expect(errors).toStrictEqual([
        {
          code: "relation-columns-mismatch",
          path: ["fromColumns"],
          at: "relations.orders(user_id,reviewer_id)->users",
        },
      ]);
    },
  );

  it("returns primary-key-missing when the target has no primary key and no toColumns", () => {
    const errors = unwrapError(
      apply({
        tool: "addRelation",
        input: {
          fromTable: "orders",
          toTable: "notes",
          kind: "oneToMany",
          fromColumns: ["user_id"],
        },
      }),
    );

    expect(errors).toStrictEqual([
      { code: "primary-key-missing", path: ["toTable"], at: "tables.notes" },
    ]);
  });

  it("returns column-name-not-found for every unknown source and target column", () => {
    const errors = unwrapError(
      apply({
        tool: "addRelation",
        input: {
          fromTable: "orders",
          toTable: "users",
          kind: "oneToMany",
          fromColumns: ["user_id", "buyer_id"],
          toColumns: ["id", "uuid"],
        },
      }),
    );

    expect(errors).toStrictEqual([
      {
        code: "column-name-not-found",
        path: ["fromColumns", 1],
        at: "tables.orders.columns.buyer_id",
      },
      {
        code: "column-name-not-found",
        path: ["toColumns", 1],
        at: "tables.users.columns.uuid",
      },
    ]);
  });

  it("rejects a relation that introduces an issue and keeps the input unchanged", () => {
    const before = JSON.stringify(SCHEMA);

    const errors = unwrapError(
      apply({
        tool: "addRelation",
        input: {
          fromTable: "orders",
          toTable: "users",
          kind: "oneToMany",
          fromColumns: ["user_id"],
          onDelete: "setNull",
        },
      }),
    );

    expect(errors).toStrictEqual([
      {
        code: "relation-set-null-not-nullable",
        path: ["relations", "rel_1", "onDelete"],
        at: "relations.orders(user_id).onDelete",
      },
    ]);
    expect(JSON.stringify(SCHEMA)).toBe(before);
  });
});

describe("applyAiEdit addRelation without fromColumns", () => {
  it("builds a relation with a new foreign key column when fromColumns is omitted", () => {
    const success = unwrapOk(
      apply({
        tool: "addRelation",
        input: { fromTable: "products", toTable: "users", kind: "oneToMany" },
      }),
    );

    const expected = buildRelation(
      SCHEMA,
      {
        fromTableId: "tbl_products",
        toTableId: "tbl_users",
        kind: "oneToMany",
        onDelete: "noAction",
        onUpdate: "noAction",
      },
      createCounterIdGenerator(),
    );
    expect(success.operation).toStrictEqual(unwrapOk(expected));
    expect(success.placedTables).toBe(0);
  });

  it("references toColumns when fromColumns is omitted", () => {
    const success = unwrapOk(
      apply({
        tool: "addRelation",
        input: {
          fromTable: "products",
          toTable: "users",
          kind: "oneToMany",
          toColumns: ["number"],
        },
      }),
    );

    const expected = buildRelation(
      SCHEMA,
      {
        fromTableId: "tbl_products",
        toTableId: "tbl_users",
        kind: "oneToMany",
        onDelete: "noAction",
        onUpdate: "noAction",
        referencedColumnIds: ["col_users_number"],
      },
      createCounterIdGenerator(),
    );
    expect(success.operation).toStrictEqual(unwrapOk(expected));
  });

  it("defaults referential actions to noAction", () => {
    const success = unwrapOk(
      apply({
        tool: "addRelation",
        input: { fromTable: "products", toTable: "users", kind: "oneToOne" },
      }),
    );

    expect(success.schema.relations.rel_2).toMatchObject({
      kind: "oneToOne",
      onDelete: "noAction",
      onUpdate: "noAction",
    });
  });

  it("returns primary-key-missing at the target table without a primary key", () => {
    const errors = unwrapError(
      apply({
        tool: "addRelation",
        input: { fromTable: "orders", toTable: "notes", kind: "oneToMany" },
      }),
    );

    expect(errors).toStrictEqual([
      { code: "primary-key-missing", path: ["toTableId"], at: "tables.notes" },
    ]);
  });

  it("returns a builder error inside the target columns at the relation", () => {
    const errors = unwrapError(
      apply({
        tool: "addRelation",
        input: {
          fromTable: "orders",
          toTable: "users",
          kind: "oneToMany",
          toColumns: ["id", "id"],
        },
      }),
    );

    expect(errors).toStrictEqual([
      {
        code: "column-listed-twice",
        path: ["referencedColumnIds", 1],
        at: "relations.orders->users",
      },
    ]);
  });

  it.each([
    { fromTable: "ghost", toTable: "users", path: "fromTable" },
    { fromTable: "orders", toTable: "ghost", path: "toTable" },
  ])(
    "returns table-name-not-found for an unknown $path",
    ({ fromTable, toTable, path }) => {
      const errors = unwrapError(
        apply({
          tool: "addRelation",
          input: { fromTable, toTable, kind: "oneToMany" },
        }),
      );

      expect(errors).toStrictEqual([
        { code: "table-name-not-found", path: [path], at: "tables.ghost" },
      ]);
    },
  );

  it("adds a relation between tables named __proto__ and constructor", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_proto",
          name: "__proto__",
          primaryKeyColumnIds: ["col_proto_id"],
        }),
        makeTable({ id: "tbl_ctor", name: "constructor" }),
      ],
      columns: [
        makeColumn({ id: "col_proto_id", tableId: "tbl_proto", name: "id" }),
        makeColumn({
          id: "col_ctor_proto",
          tableId: "tbl_ctor",
          name: "__proto__",
        }),
      ],
    });

    const success = unwrapOk(
      apply(
        {
          tool: "addRelation",
          input: {
            fromTable: "constructor",
            toTable: "__proto__",
            kind: "oneToMany",
            fromColumns: ["__proto__"],
          },
        },
        schema,
      ),
    );

    expect(success.schema.relations.rel_1).toMatchObject({
      fromTableId: "tbl_ctor",
      toTableId: "tbl_proto",
      columnPairs: [
        { fromColumnId: "col_ctor_proto", toColumnId: "col_proto_id" },
      ],
    });
  });

  it("keeps the batch depth of a turn at 2", () => {
    const context = {
      generateId: createCounterIdGenerator(),
      placement: createAiTablePlacement(SCHEMA),
    };
    const created = unwrapOk(
      applyAiEdit(
        SCHEMA,
        {
          tool: "createTable",
          input: {
            name: "reviews",
            columns: [
              { name: "id", type: { kind: "integer" }, isNullable: false },
            ],
            primaryKey: ["id"],
          },
        },
        context,
      ),
    );
    const related = unwrapOk(
      applyAiEdit(
        created.schema,
        {
          tool: "addRelation",
          input: { fromTable: "reviews", toTable: "users", kind: "oneToMany" },
        },
        context,
      ),
    );

    const turn: Operation = {
      type: "batch",
      operations: [created.operation, related.operation],
    };

    expect(childTypes(created.operation)).not.toContain("batch");
    expect(childTypes(related.operation)).not.toContain("batch");
    expect(applyOperation(SCHEMA, turn).isOk).toBe(true);
  });
});

describe("applyAiEdit updateRelation and removeRelation", () => {
  it("updates a relation found by its two tables", () => {
    const success = unwrapOk(
      apply(
        {
          tool: "updateRelation",
          input: { fromTable: "orders", toTable: "users", onDelete: "cascade" },
        },
        RELATED,
      ),
    );

    expect(success.operation).toStrictEqual({
      type: "updateRelation",
      relationId: "rel_orders_user",
      changes: { onDelete: "cascade" },
    });
  });

  it("returns relation-ambiguous when two relations join the same tables", () => {
    const errors = unwrapError(
      apply(
        {
          tool: "updateRelation",
          input: { fromTable: "orders", toTable: "users", kind: "oneToOne" },
        },
        AMBIGUOUS,
      ),
    );

    expect(errors).toStrictEqual([
      { code: "relation-ambiguous", path: [], at: "relations.orders->users" },
    ]);
  });

  it("narrows an ambiguous relation by fromColumns", () => {
    const success = unwrapOk(
      apply(
        {
          tool: "removeRelation",
          input: {
            fromTable: "orders",
            toTable: "users",
            fromColumns: ["reviewer_id"],
          },
        },
        AMBIGUOUS,
      ),
    );

    expect(success.operation).toStrictEqual({
      type: "removeRelation",
      relationId: "rel_orders_reviewer",
    });
  });

  it("returns relation-not-found for tables without a relation", () => {
    const errors = unwrapError(
      apply({
        tool: "removeRelation",
        input: { fromTable: "users", toTable: "orders" },
      }),
    );

    expect(errors).toStrictEqual([
      { code: "relation-not-found", path: [], at: "relations.users->orders" },
    ]);
  });

  it("returns column-name-not-found for an unknown fromColumns name", () => {
    const errors = unwrapError(
      apply(
        {
          tool: "updateRelation",
          input: { fromTable: "orders", toTable: "users", fromColumns: ["x"] },
        },
        RELATED,
      ),
    );

    expect(errors).toStrictEqual([
      {
        code: "column-name-not-found",
        path: ["fromColumns", 0],
        at: "tables.orders.columns.x",
      },
    ]);
  });

  it("removes a relation", () => {
    const success = unwrapOk(
      apply(
        {
          tool: "removeRelation",
          input: { fromTable: "orders", toTable: "users" },
        },
        RELATED,
      ),
    );

    expect(success.schema).toStrictEqual(SCHEMA);
  });
});
