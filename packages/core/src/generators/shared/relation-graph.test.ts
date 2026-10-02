import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
import type { ColumnId, RelationId } from "../../model/ids.js";
import type {
  ColumnPair,
  ReferentialAction,
  Relation,
} from "../../model/relation.js";
import type { Table } from "../../model/table.js";
import {
  buildSchema,
  makeColumn,
  makeIndex,
  makeRelation,
  makeTable,
} from "../../testing/factories.js";
import {
  buildLoadOrder,
  findCascadeConflicts,
  findReferencedKey,
  orderColumnPairsByReferencedKey,
} from "./relation-graph.js";

// A table named `name` whose primary key is `col_<name>_id`.
function keyedTable(name: string): Table {
  return makeTable({
    id: `tbl_${name}`,
    name,
    primaryKeyColumnIds: [`col_${name}_id`],
  });
}

function idColumn(tableName: string): Column {
  return makeColumn({
    id: `col_${tableName}_id`,
    tableId: `tbl_${tableName}`,
    name: "id",
  });
}

function foreignKeyColumn(
  fromTable: string,
  toTable: string,
  isNullable: boolean,
): Column {
  return makeColumn({
    id: `col_${fromTable}_${toTable}_id`,
    tableId: `tbl_${fromTable}`,
    name: `${toTable}_id`,
    isNullable,
  });
}

// `fromTable.<toTable>_id` references `toTable.id`.
function foreignKey(
  fromTable: string,
  toTable: string,
  action: ReferentialAction = "noAction",
): Relation {
  return makeRelation({
    id: `rel_${fromTable}_${toTable}`,
    fromTableId: `tbl_${fromTable}`,
    toTableId: `tbl_${toTable}`,
    columnPairs: [
      {
        fromColumnId: `col_${fromTable}_${toTable}_id`,
        toColumnId: `col_${toTable}_id`,
      },
    ],
    onDelete: action,
    onUpdate: action,
  });
}

type ForeignKeySpec = {
  readonly fromTable: string;
  readonly toTable: string;
  readonly isNullable?: boolean;
  readonly action?: ReferentialAction;
};

// Builds keyed tables (in the given order) joined by single-column foreign keys.
function graphSchema(
  tableNames: readonly string[],
  foreignKeys: readonly ForeignKeySpec[],
): ReturnType<typeof buildSchema> {
  return buildSchema({
    tables: tableNames.map(keyedTable),
    columns: [
      ...tableNames.map(idColumn),
      ...foreignKeys.map((spec) =>
        foreignKeyColumn(
          spec.fromTable,
          spec.toTable,
          spec.isNullable ?? false,
        ),
      ),
    ],
    relations: foreignKeys.map((spec) =>
      foreignKey(spec.fromTable, spec.toTable, spec.action),
    ),
  });
}

const PAIR_A: ColumnPair = {
  fromColumnId: "col_posts_a",
  toColumnId: "col_users_a",
};
const PAIR_B: ColumnPair = {
  fromColumnId: "col_posts_b",
  toColumnId: "col_users_b",
};

type CompositeKeyParts = {
  readonly primaryKeyColumnIds?: readonly ColumnId[];
  readonly uniqueIndexColumnIds?: readonly ColumnId[];
};

// `posts(a, b)` references `users(a, b)` with pairs stored as (a, b).
function compositeSchema(
  parts: CompositeKeyParts,
): ReturnType<typeof buildSchema> {
  return buildSchema({
    tables: [
      makeTable({ id: "tbl_posts" }),
      makeTable({
        id: "tbl_users",
        primaryKeyColumnIds: parts.primaryKeyColumnIds ?? [],
      }),
    ],
    columns: [
      makeColumn({ id: "col_posts_a", tableId: "tbl_posts" }),
      makeColumn({ id: "col_posts_b", tableId: "tbl_posts" }),
      makeColumn({ id: "col_users_a", tableId: "tbl_users" }),
      makeColumn({ id: "col_users_b", tableId: "tbl_users" }),
    ],
    indexes:
      parts.uniqueIndexColumnIds === undefined
        ? []
        : [
            makeIndex({
              id: "idx_users_ab",
              tableId: "tbl_users",
              columnIds: parts.uniqueIndexColumnIds,
              isUnique: true,
            }),
          ],
    relations: [
      makeRelation({
        id: "rel_posts_users",
        fromTableId: "tbl_posts",
        toTableId: "tbl_users",
        columnPairs: [PAIR_A, PAIR_B],
      }),
    ],
  });
}

function onlyRelation(
  schema: ReturnType<typeof buildSchema>,
  relationId: RelationId,
): Relation {
  const relation = schema.relations[relationId];
  if (relation === undefined) {
    throw new Error(`missing relation ${relationId}`);
  }
  return relation;
}

describe("findReferencedKey", () => {
  it("finds the primary key as the referenced key", () => {
    const schema = graphSchema(
      ["posts", "users"],
      [{ fromTable: "posts", toTable: "users" }],
    );

    expect(
      findReferencedKey(schema, onlyRelation(schema, "rel_posts_users")),
    ).toStrictEqual({ kind: "primaryKey", columnIds: ["col_users_id"] });
  });

  it("finds a unique column as the referenced key", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_posts" }), makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({ id: "col_posts_email", tableId: "tbl_posts" }),
        makeColumn({
          id: "col_users_email",
          tableId: "tbl_users",
          isUnique: true,
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_posts_users",
          fromTableId: "tbl_posts",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_posts_email", toColumnId: "col_users_email" },
          ],
        }),
      ],
    });

    expect(
      findReferencedKey(schema, onlyRelation(schema, "rel_posts_users")),
    ).toStrictEqual({ kind: "uniqueColumn", columnIds: ["col_users_email"] });
  });

  it("finds a unique index with the same column set", () => {
    const schema = compositeSchema({
      uniqueIndexColumnIds: ["col_users_b", "col_users_a"],
    });

    expect(
      findReferencedKey(schema, onlyRelation(schema, "rel_posts_users")),
    ).toStrictEqual({
      kind: "uniqueIndex",
      indexId: "idx_users_ab",
      columnIds: ["col_users_b", "col_users_a"],
    });
  });

  it("prefers the primary key over a unique index with the same columns", () => {
    const schema = compositeSchema({
      primaryKeyColumnIds: ["col_users_a", "col_users_b"],
      uniqueIndexColumnIds: ["col_users_b", "col_users_a"],
    });

    expect(
      findReferencedKey(schema, onlyRelation(schema, "rel_posts_users")),
    ).toStrictEqual({
      kind: "primaryKey",
      columnIds: ["col_users_a", "col_users_b"],
    });
  });

  it("returns null when no unique key matches", () => {
    const schema = compositeSchema({ primaryKeyColumnIds: ["col_users_a"] });

    expect(
      findReferencedKey(schema, onlyRelation(schema, "rel_posts_users")),
    ).toBeNull();
  });
});

describe("orderColumnPairsByReferencedKey", () => {
  it("orders column pairs by the referenced key order", () => {
    const schema = compositeSchema({
      primaryKeyColumnIds: ["col_users_b", "col_users_a"],
    });

    expect(
      orderColumnPairsByReferencedKey(
        schema,
        onlyRelation(schema, "rel_posts_users"),
      ),
    ).toStrictEqual([PAIR_B, PAIR_A]);
  });

  it("keeps stored pair order when no key matches", () => {
    const schema = compositeSchema({});

    expect(
      orderColumnPairsByReferencedKey(
        schema,
        onlyRelation(schema, "rel_posts_users"),
      ),
    ).toStrictEqual([PAIR_A, PAIR_B]);
  });
});

describe("findCascadeConflicts", () => {
  it("reports a self-referencing cascade as a conflict", () => {
    const schema = graphSchema(
      ["users"],
      [
        {
          fromTable: "users",
          toTable: "users",
          isNullable: true,
          action: "cascade",
        },
      ],
    );

    expect(findCascadeConflicts(schema)).toStrictEqual(["rel_users_users"]);
  });

  it("reports the relation that closes a cascade cycle", () => {
    const schema = graphSchema(
      ["a", "b"],
      [
        { fromTable: "a", toTable: "b", action: "cascade" },
        { fromTable: "b", toTable: "a", action: "setNull", isNullable: true },
      ],
    );

    expect(findCascadeConflicts(schema)).toStrictEqual(["rel_b_a"]);
  });

  it("reports the relation that adds a second cascade path", () => {
    // Edges root -> mid -> leaf and root -> leaf.
    const schema = graphSchema(
      ["leaf", "mid", "root"],
      [
        { fromTable: "leaf", toTable: "mid", action: "cascade" },
        { fromTable: "leaf", toTable: "root", action: "cascade" },
        { fromTable: "mid", toTable: "root", action: "cascade" },
      ],
    );

    expect(findCascadeConflicts(schema)).toStrictEqual(["rel_mid_root"]);
  });

  it("keeps no-action and restrict relations out of the cascade graph", () => {
    const schema = graphSchema(
      ["a", "b"],
      [
        { fromTable: "a", toTable: "a", isNullable: true, action: "noAction" },
        { fromTable: "a", toTable: "b", action: "cascade" },
        { fromTable: "b", toTable: "a", action: "restrict" },
      ],
    );

    expect(findCascadeConflicts(schema)).toStrictEqual([]);
  });

  it("returns conflicts in relation order regardless of map key order", () => {
    const schema = buildSchema({
      tables: [keyedTable("b"), keyedTable("a")],
      columns: [
        idColumn("b"),
        idColumn("a"),
        foreignKeyColumn("b", "b", true),
        foreignKeyColumn("a", "a", true),
      ],
      relations: [
        { ...foreignKey("b", "b", "cascade"), id: "rel_1" },
        { ...foreignKey("a", "a", "cascade"), id: "rel_2" },
      ],
    });

    expect(findCascadeConflicts(schema)).toStrictEqual(["rel_2", "rel_1"]);
  });
});

describe("buildLoadOrder", () => {
  it("orders referenced tables before referencing tables", () => {
    const schema = graphSchema(
      ["posts", "users"],
      [{ fromTable: "posts", toTable: "users" }],
    );

    expect(buildLoadOrder(schema).tableIds).toStrictEqual([
      "tbl_users",
      "tbl_posts",
    ]);
  });

  it("breaks load order ties by table order", () => {
    const schema = graphSchema(
      ["z", "b", "a"],
      [{ fromTable: "a", toTable: "z" }],
    );

    expect(buildLoadOrder(schema).tableIds).toStrictEqual([
      "tbl_b",
      "tbl_z",
      "tbl_a",
    ]);
  });

  it("defers a nullable relation inside a cycle", () => {
    const schema = graphSchema(
      ["a", "b"],
      [
        { fromTable: "a", toTable: "b", isNullable: true },
        { fromTable: "b", toTable: "a" },
      ],
    );

    expect(buildLoadOrder(schema)).toStrictEqual({
      tableIds: ["tbl_a", "tbl_b"],
      deferredRelationIds: ["rel_a_b"],
      skippedTableIds: [],
    });
  });

  it("skips the tables of a cycle of required foreign keys", () => {
    const schema = graphSchema(
      ["a", "b", "c"],
      [
        { fromTable: "a", toTable: "b" },
        { fromTable: "b", toTable: "a" },
      ],
    );

    expect(buildLoadOrder(schema)).toStrictEqual({
      tableIds: ["tbl_c"],
      deferredRelationIds: [],
      skippedTableIds: ["tbl_a", "tbl_b"],
    });
  });

  it("skips a table with a required foreign key to a skipped table", () => {
    const schema = graphSchema(
      ["a", "b", "d"],
      [
        { fromTable: "a", toTable: "b" },
        { fromTable: "b", toTable: "a" },
        { fromTable: "d", toTable: "a" },
      ],
    );

    expect(buildLoadOrder(schema).skippedTableIds).toStrictEqual([
      "tbl_a",
      "tbl_b",
      "tbl_d",
    ]);
  });

  it("keeps a table with a nullable foreign key to a skipped table", () => {
    const schema = graphSchema(
      ["a", "b", "e"],
      [
        { fromTable: "a", toTable: "b" },
        { fromTable: "b", toTable: "a" },
        { fromTable: "e", toTable: "a", isNullable: true },
      ],
    );

    expect(buildLoadOrder(schema)).toStrictEqual({
      tableIds: ["tbl_e"],
      deferredRelationIds: [],
      skippedTableIds: ["tbl_a", "tbl_b"],
    });
  });

  it("drops a deferred relation that touches a skipped table", () => {
    // a <-> b is a required cycle; a -> c is nullable, c -> a is required.
    const schema = graphSchema(
      ["a", "b", "c"],
      [
        { fromTable: "a", toTable: "b" },
        { fromTable: "a", toTable: "c", isNullable: true },
        { fromTable: "b", toTable: "a" },
        { fromTable: "c", toTable: "a" },
      ],
    );

    expect(buildLoadOrder(schema)).toStrictEqual({
      tableIds: [],
      deferredRelationIds: [],
      skippedTableIds: ["tbl_a", "tbl_b", "tbl_c"],
    });
  });

  it("ignores self-references when ordering tables", () => {
    const schema = graphSchema(["a"], [{ fromTable: "a", toTable: "a" }]);

    expect(buildLoadOrder(schema)).toStrictEqual({
      tableIds: ["tbl_a"],
      deferredRelationIds: [],
      skippedTableIds: [],
    });
  });
});
