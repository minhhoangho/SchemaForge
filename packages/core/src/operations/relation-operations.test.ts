import { describe, expect, it } from "vitest";

import type { ColumnPair, Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeRelation,
  makeTable,
} from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import type { Operation, RelationOperation } from "./operation.js";
import { applyRelationOperation } from "./relation-operations.js";

// Orders reference users through up to two columns, and employees reference
// themselves, so every test builds its relations from the same tables.
function buildShopSchema(relations: readonly Relation[] = []): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({ id: "tbl_users" }),
      makeTable({ id: "tbl_orders" }),
      makeTable({ id: "tbl_employees" }),
    ],
    columns: [
      makeColumn({ id: "col_users_id", tableId: "tbl_users" }),
      makeColumn({ id: "col_users_tenant", tableId: "tbl_users" }),
      makeColumn({ id: "col_orders_user", tableId: "tbl_orders" }),
      makeColumn({ id: "col_orders_tenant", tableId: "tbl_orders" }),
      makeColumn({ id: "col_employees_id", tableId: "tbl_employees" }),
      makeColumn({ id: "col_employees_manager", tableId: "tbl_employees" }),
    ],
    relations,
  });
}

function makeOrdersRelation(overrides: Partial<Relation> = {}): Relation {
  return makeRelation({
    id: "rel_orders_users",
    fromTableId: "tbl_orders",
    toTableId: "tbl_users",
    columnPairs: [
      { fromColumnId: "col_orders_user", toColumnId: "col_users_id" },
    ],
    ...overrides,
  });
}

function makeManagerRelation(): Relation {
  return makeRelation({
    id: "rel_employees_manager",
    fromTableId: "tbl_employees",
    toTableId: "tbl_employees",
    columnPairs: [
      {
        fromColumnId: "col_employees_manager",
        toColumnId: "col_employees_id",
      },
    ],
  });
}

const TWO_COLUMN_PAIRS: readonly ColumnPair[] = [
  { fromColumnId: "col_orders_user", toColumnId: "col_users_id" },
  { fromColumnId: "col_orders_tenant", toColumnId: "col_users_tenant" },
];

// Inverses are typed as any Operation; the handler only accepts its own group.
function toRelationOperation(operation: Operation): RelationOperation {
  if (
    operation.type === "addRelation" ||
    operation.type === "updateRelation" ||
    operation.type === "removeRelation"
  ) {
    return operation;
  }
  throw new Error(`Expected a relation operation, got ${operation.type}`);
}

describe("addRelation", () => {
  it("adds a relation with a multi-column foreign key", () => {
    const schema = buildShopSchema();
    const relation = makeOrdersRelation({ columnPairs: TWO_COLUMN_PAIRS });

    const result = unwrapOk(
      applyRelationOperation(schema, { type: "addRelation", relation }),
    );

    expect(result.schema).toStrictEqual(buildShopSchema([relation]));
  });

  it("adds a self-referencing relation", () => {
    const schema = buildShopSchema();
    const relation = makeManagerRelation();

    const result = unwrapOk(
      applyRelationOperation(schema, { type: "addRelation", relation }),
    );

    expect(result.schema).toStrictEqual(buildShopSchema([relation]));
  });

  it("returns removeRelation as the inverse of addRelation", () => {
    const schema = buildShopSchema();

    const result = unwrapOk(
      applyRelationOperation(schema, {
        type: "addRelation",
        relation: makeOrdersRelation(),
      }),
    );

    expect(result.inverse).toStrictEqual({
      type: "removeRelation",
      relationId: "rel_orders_users",
    });
  });

  it("keeps the other maps and relations by reference when a relation is added", () => {
    const schema = buildShopSchema([makeManagerRelation()]);

    const result = unwrapOk(
      applyRelationOperation(schema, {
        type: "addRelation",
        relation: makeOrdersRelation(),
      }),
    );

    expect(result.schema.tables).toBe(schema.tables);
    expect(result.schema.columns).toBe(schema.columns);
    expect(result.schema.indexes).toBe(schema.indexes);
    expect(result.schema.relations.rel_employees_manager).toBe(
      schema.relations.rel_employees_manager,
    );
  });

  it("rejects addRelation with id-already-exists", () => {
    const schema = buildShopSchema([makeOrdersRelation()]);

    const error = unwrapError(
      applyRelationOperation(schema, {
        type: "addRelation",
        relation: makeOrdersRelation({ columnPairs: TWO_COLUMN_PAIRS }),
      }),
    );

    expect(error).toStrictEqual({
      code: "id-already-exists",
      path: ["relation", "id"],
    });
  });

  it("rejects addRelation with table-not-found at relation.fromTableId before relation.toTableId", () => {
    const schema = buildShopSchema();

    const error = unwrapError(
      applyRelationOperation(schema, {
        type: "addRelation",
        relation: makeOrdersRelation({
          fromTableId: "tbl_missing_from",
          toTableId: "tbl_missing_to",
        }),
      }),
    );

    expect(error).toStrictEqual({
      code: "table-not-found",
      path: ["relation", "fromTableId"],
    });
  });

  it("rejects addRelation with table-not-found at relation.toTableId", () => {
    const schema = buildShopSchema();

    const error = unwrapError(
      applyRelationOperation(schema, {
        type: "addRelation",
        relation: makeOrdersRelation({ toTableId: "tbl_missing" }),
      }),
    );

    expect(error).toStrictEqual({
      code: "table-not-found",
      path: ["relation", "toTableId"],
    });
  });

  it("rejects addRelation with column-not-in-table at the fromColumnId of the pair", () => {
    const schema = buildShopSchema();
    const columnPairs: readonly ColumnPair[] = [
      { fromColumnId: "col_orders_user", toColumnId: "col_users_id" },
      { fromColumnId: "col_users_tenant", toColumnId: "col_users_tenant" },
    ];

    const error = unwrapError(
      applyRelationOperation(schema, {
        type: "addRelation",
        relation: makeOrdersRelation({ columnPairs }),
      }),
    );

    expect(error).toStrictEqual({
      code: "column-not-in-table",
      path: ["relation", "columnPairs", 1, "fromColumnId"],
    });
  });

  it("rejects addRelation with column-listed-twice on the to side", () => {
    const schema = buildShopSchema();
    const columnPairs: readonly ColumnPair[] = [
      { fromColumnId: "col_orders_user", toColumnId: "col_users_id" },
      { fromColumnId: "col_orders_tenant", toColumnId: "col_users_id" },
    ];

    const error = unwrapError(
      applyRelationOperation(schema, {
        type: "addRelation",
        relation: makeOrdersRelation({ columnPairs }),
      }),
    );

    expect(error).toStrictEqual({
      code: "column-listed-twice",
      path: ["relation", "columnPairs", 1, "toColumnId"],
    });
  });

  it.each([
    {
      situation: "an earlier pair on the to side",
      columnPairs: [
        { fromColumnId: "col_orders_user", toColumnId: "col_orders_tenant" },
        { fromColumnId: "col_missing", toColumnId: "col_users_tenant" },
      ],
      expected: {
        code: "column-not-in-table",
        path: ["relation", "columnPairs", 0, "toColumnId"],
      },
    },
    {
      situation: "both sides of the same pair",
      columnPairs: [
        { fromColumnId: "col_missing", toColumnId: "col_orders_tenant" },
      ],
      expected: {
        code: "column-not-found",
        path: ["relation", "columnPairs", 0, "fromColumnId"],
      },
    },
  ] as const)(
    "rejects addRelation with the column error that has the smallest path ($situation)",
    ({ columnPairs, expected }) => {
      const schema = buildShopSchema();

      const error = unwrapError(
        applyRelationOperation(schema, {
          type: "addRelation",
          relation: makeOrdersRelation({ columnPairs }),
        }),
      );

      expect(error).toStrictEqual(expected);
    },
  );

  it("does not reject a relation whose column types differ because that is a semantic issue", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" }), makeTable({ id: "tbl_orders" })],
      columns: [
        makeColumn({
          id: "col_users_id",
          tableId: "tbl_users",
          type: { kind: "uuid" },
        }),
        makeColumn({
          id: "col_orders_user",
          tableId: "tbl_orders",
          type: { kind: "integer" },
        }),
      ],
    });
    const relation = makeOrdersRelation();

    const result = unwrapOk(
      applyRelationOperation(schema, { type: "addRelation", relation }),
    );

    expect(result.schema.relations).toStrictEqual({
      rel_orders_users: relation,
    });
  });

  it("restores the schema when the addRelation inverse is applied", () => {
    const schema = buildShopSchema([makeManagerRelation()]);

    const applied = unwrapOk(
      applyRelationOperation(schema, {
        type: "addRelation",
        relation: makeOrdersRelation(),
      }),
    );
    const restored = unwrapOk(
      applyRelationOperation(
        applied.schema,
        toRelationOperation(applied.inverse),
      ),
    );

    expect(restored.schema).toStrictEqual(schema);
  });
});

describe("updateRelation", () => {
  it("updates kind and referential actions", () => {
    const schema = buildShopSchema([makeOrdersRelation()]);

    const result = unwrapOk(
      applyRelationOperation(schema, {
        type: "updateRelation",
        relationId: "rel_orders_users",
        changes: {
          kind: "oneToOne",
          onDelete: "cascade",
          onUpdate: "restrict",
        },
      }),
    );

    expect(result.schema).toStrictEqual(
      buildShopSchema([
        makeOrdersRelation({
          kind: "oneToOne",
          onDelete: "cascade",
          onUpdate: "restrict",
        }),
      ]),
    );
  });

  it("replaces the column pairs of a relation", () => {
    const schema = buildShopSchema([makeOrdersRelation()]);

    const result = unwrapOk(
      applyRelationOperation(schema, {
        type: "updateRelation",
        relationId: "rel_orders_users",
        changes: { columnPairs: TWO_COLUMN_PAIRS },
      }),
    );

    expect(result.schema).toStrictEqual(
      buildShopSchema([makeOrdersRelation({ columnPairs: TWO_COLUMN_PAIRS })]),
    );
  });

  it("ignores a change whose value is undefined", () => {
    const schema = buildShopSchema([makeOrdersRelation()]);

    const result = unwrapOk(
      applyRelationOperation(schema, {
        type: "updateRelation",
        relationId: "rel_orders_users",
        changes: { kind: "oneToOne", onDelete: undefined },
      }),
    );

    expect(result).toStrictEqual({
      schema: buildShopSchema([makeOrdersRelation({ kind: "oneToOne" })]),
      inverse: {
        type: "updateRelation",
        relationId: "rel_orders_users",
        changes: { kind: "oneToMany" },
      },
    });
  });

  it("rejects updateRelation with column-not-found at changes.columnPairs", () => {
    const schema = buildShopSchema([makeOrdersRelation()]);

    const error = unwrapError(
      applyRelationOperation(schema, {
        type: "updateRelation",
        relationId: "rel_orders_users",
        changes: {
          columnPairs: [
            { fromColumnId: "col_orders_user", toColumnId: "col_missing" },
          ],
        },
      }),
    );

    expect(error).toStrictEqual({
      code: "column-not-found",
      path: ["changes", "columnPairs", 0, "toColumnId"],
    });
  });

  it("checks changes.columnPairs against the tables of the relation", () => {
    const schema = buildShopSchema([makeOrdersRelation()]);

    const error = unwrapError(
      applyRelationOperation(schema, {
        type: "updateRelation",
        relationId: "rel_orders_users",
        changes: {
          columnPairs: [
            { fromColumnId: "col_users_id", toColumnId: "col_users_id" },
          ],
        },
      }),
    );

    expect(error).toStrictEqual({
      code: "column-not-in-table",
      path: ["changes", "columnPairs", 0, "fromColumnId"],
    });
  });

  it("returns updateRelation with previous values as the inverse", () => {
    const schema = buildShopSchema([makeOrdersRelation()]);

    const result = unwrapOk(
      applyRelationOperation(schema, {
        type: "updateRelation",
        relationId: "rel_orders_users",
        changes: { kind: "oneToOne", columnPairs: TWO_COLUMN_PAIRS },
      }),
    );

    expect(result.inverse).toStrictEqual({
      type: "updateRelation",
      relationId: "rel_orders_users",
      changes: {
        kind: "oneToMany",
        columnPairs: [
          { fromColumnId: "col_orders_user", toColumnId: "col_users_id" },
        ],
      },
    });
  });

  it("restores the relation when the updateRelation inverse is applied", () => {
    const schema = buildShopSchema([makeOrdersRelation()]);

    const applied = unwrapOk(
      applyRelationOperation(schema, {
        type: "updateRelation",
        relationId: "rel_orders_users",
        changes: {
          kind: "oneToOne",
          columnPairs: TWO_COLUMN_PAIRS,
          onDelete: "setNull",
          onUpdate: "cascade",
        },
      }),
    );
    const restored = unwrapOk(
      applyRelationOperation(
        applied.schema,
        toRelationOperation(applied.inverse),
      ),
    );

    expect(restored.schema).toStrictEqual(schema);
  });

  it("rejects updateRelation with relation-not-found", () => {
    const schema = buildShopSchema();

    const error = unwrapError(
      applyRelationOperation(schema, {
        type: "updateRelation",
        relationId: "rel_missing",
        changes: { kind: "oneToOne" },
      }),
    );

    expect(error).toStrictEqual({
      code: "relation-not-found",
      path: ["relationId"],
    });
  });

  it("keeps the other relations by reference when a relation is updated", () => {
    const schema = buildShopSchema([
      makeOrdersRelation(),
      makeManagerRelation(),
    ]);

    const result = unwrapOk(
      applyRelationOperation(schema, {
        type: "updateRelation",
        relationId: "rel_orders_users",
        changes: { onDelete: "cascade" },
      }),
    );

    expect(result.schema.relations.rel_employees_manager).toBe(
      schema.relations.rel_employees_manager,
    );
    expect(result.schema.tables).toBe(schema.tables);
  });

  it("returns the same schema reference when updateRelation changes nothing", () => {
    const schema = buildShopSchema([makeOrdersRelation()]);

    const result = unwrapOk(
      applyRelationOperation(schema, {
        type: "updateRelation",
        relationId: "rel_orders_users",
        changes: {
          kind: "oneToMany",
          columnPairs: [
            { fromColumnId: "col_orders_user", toColumnId: "col_users_id" },
          ],
          onDelete: "noAction",
        },
      }),
    );

    expect(result.schema).toBe(schema);
  });
});

describe("removeRelation", () => {
  it("removes a relation and returns addRelation as the inverse", () => {
    const relation = makeOrdersRelation({ columnPairs: TWO_COLUMN_PAIRS });
    const schema = buildShopSchema([relation]);

    const result = unwrapOk(
      applyRelationOperation(schema, {
        type: "removeRelation",
        relationId: "rel_orders_users",
      }),
    );

    expect(result).toStrictEqual({
      schema: buildShopSchema(),
      inverse: { type: "addRelation", relation },
    });
  });

  it("restores the schema when the removeRelation inverse is applied", () => {
    const schema = buildShopSchema([
      makeOrdersRelation(),
      makeManagerRelation(),
    ]);

    const applied = unwrapOk(
      applyRelationOperation(schema, {
        type: "removeRelation",
        relationId: "rel_orders_users",
      }),
    );
    const restored = unwrapOk(
      applyRelationOperation(
        applied.schema,
        toRelationOperation(applied.inverse),
      ),
    );

    expect(restored.schema).toStrictEqual(schema);
  });

  it("rejects removeRelation with relation-not-found", () => {
    const schema = buildShopSchema();

    const error = unwrapError(
      applyRelationOperation(schema, {
        type: "removeRelation",
        relationId: "rel_missing",
      }),
    );

    expect(error).toStrictEqual({
      code: "relation-not-found",
      path: ["relationId"],
    });
  });
});
