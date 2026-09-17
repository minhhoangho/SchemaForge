import { describe, expect, it } from "vitest";

import type { OperationError } from "../error-codes.js";
import type { Column } from "../model/column.js";
import type { ColumnId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeRelation,
  makeTable,
} from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import { findIntroducedIssues } from "../validation/find-introduced-issues.js";
import { applyOperation } from "./apply-operation.js";
import { buildRelation } from "./build-relation.js";
import type { RelationInput } from "./build-relation.js";
import type { Operation } from "./operation.js";

const USERS_TABLE = makeTable({
  id: "tbl_users",
  name: "users",
  primaryKeyColumnIds: ["col_users_id"],
});

const USERS_ID_COLUMN = makeColumn({
  id: "col_users_id",
  tableId: "tbl_users",
  name: "id",
});

// The primary key order differs from the column order on purpose.
const REGIONS_TABLE = makeTable({
  id: "tbl_regions",
  name: "regions",
  primaryKeyColumnIds: ["col_regions_country", "col_regions_code"],
});

const REGIONS_CODE_COLUMN = makeColumn({
  id: "col_regions_code",
  tableId: "tbl_regions",
  name: "code",
  type: { kind: "varchar", length: 8 },
});

const REGIONS_COUNTRY_COLUMN = makeColumn({
  id: "col_regions_country",
  tableId: "tbl_regions",
  name: "country",
  type: { kind: "char", length: 2 },
});

const USERS_EMAIL_COLUMN = makeColumn({
  id: "col_users_email",
  tableId: "tbl_users",
  name: "email",
  type: { kind: "varchar", length: 255 },
  isUnique: true,
});

const ORDERS_TABLE = makeTable({
  id: "tbl_orders",
  name: "orders",
  primaryKeyColumnIds: ["col_orders_id"],
});

const ORDERS_ID_COLUMN = makeColumn({
  id: "col_orders_id",
  tableId: "tbl_orders",
  name: "id",
});

const ORDERS_TOTAL_COLUMN = makeColumn({
  id: "col_orders_total",
  tableId: "tbl_orders",
  name: "total",
  type: { kind: "decimal", precision: 10, scale: 2 },
});

const TAGS_TABLE = makeTable({ id: "tbl_tags", name: "tags" });

const ORDERS_TO_USERS: RelationInput = {
  fromTableId: "tbl_orders",
  toTableId: "tbl_users",
  kind: "oneToMany",
  onDelete: "noAction",
  onUpdate: "noAction",
};

const REFERENCED_COLUMN_ERROR_CASES: readonly {
  readonly label: string;
  readonly referencedColumnIds: readonly ColumnId[];
  readonly expected: OperationError;
}[] = [
  {
    label: "invalid-shape for an empty list",
    referencedColumnIds: [],
    expected: { code: "invalid-shape", path: ["referencedColumnIds"] },
  },
  {
    label: "column-not-found for a missing column",
    referencedColumnIds: ["col_users_id", "col_missing"],
    expected: { code: "column-not-found", path: ["referencedColumnIds", 1] },
  },
  {
    label: "column-not-in-table for a column of another table",
    referencedColumnIds: ["col_orders_total"],
    expected: { code: "column-not-in-table", path: ["referencedColumnIds", 0] },
  },
  {
    label: "column-listed-twice for a repeated column",
    referencedColumnIds: ["col_users_email", "col_users_email"],
    expected: { code: "column-listed-twice", path: ["referencedColumnIds", 1] },
  },
];

const NO_ISSUE_CASES: readonly {
  readonly label: string;
  readonly overrides: Partial<RelationInput>;
}[] = [
  { label: "one-to-many", overrides: {} },
  { label: "single-column one-to-one", overrides: { kind: "oneToOne" } },
  {
    label: "composite one-to-one",
    overrides: { kind: "oneToOne", toTableId: "tbl_regions" },
  },
  { label: "onDelete setNull", overrides: { onDelete: "setNull" } },
  { label: "onUpdate setNull", overrides: { onUpdate: "setNull" } },
];

function buildShopSchema(
  extraTables: readonly Table[] = [],
  extraColumns: readonly Column[] = [],
): SchemaDocument {
  return buildSchema({
    tables: [
      USERS_TABLE,
      REGIONS_TABLE,
      ORDERS_TABLE,
      TAGS_TABLE,
      ...extraTables,
    ],
    columns: [
      USERS_ID_COLUMN,
      USERS_EMAIL_COLUMN,
      REGIONS_CODE_COLUMN,
      REGIONS_COUNTRY_COLUMN,
      ORDERS_ID_COLUMN,
      ORDERS_TOTAL_COLUMN,
      ...extraColumns,
    ],
  });
}

function makeOrdersColumn(id: Column["id"], name: string): Column {
  return makeColumn({ id, tableId: "tbl_orders", name });
}

function buildFromOrders(
  schema: SchemaDocument,
  overrides: Partial<RelationInput>,
): Operation {
  return unwrapOk(
    buildRelation(
      schema,
      { ...ORDERS_TO_USERS, ...overrides },
      createCounterIdGenerator(),
    ),
  );
}

function applyFromOrders(
  schema: SchemaDocument,
  overrides: Partial<RelationInput>,
): SchemaDocument {
  return unwrapOk(applyOperation(schema, buildFromOrders(schema, overrides)))
    .schema;
}

describe("buildRelation", () => {
  it("creates one foreign key column and a one-to-many relation for a single-column primary key", () => {
    const operation = buildFromOrders(buildShopSchema(), {});

    expect(operation).toStrictEqual({
      type: "batch",
      operations: [
        {
          type: "addColumn",
          column: makeOrdersColumn("col_1", "users_id"),
          insertAt: 2,
        },
        {
          type: "addRelation",
          relation: makeRelation({
            id: "rel_2",
            fromTableId: "tbl_orders",
            toTableId: "tbl_users",
            columnPairs: [
              { fromColumnId: "col_1", toColumnId: "col_users_id" },
            ],
          }),
        },
      ],
    });
  });

  it("creates one foreign key column per column of a composite primary key in primary key order", () => {
    const operation = buildFromOrders(buildShopSchema(), {
      toTableId: "tbl_regions",
    });

    expect(operation).toStrictEqual({
      type: "batch",
      operations: [
        {
          type: "addColumn",
          column: makeColumn({
            id: "col_1",
            tableId: "tbl_orders",
            name: "regions_country",
            type: { kind: "char", length: 2 },
          }),
          insertAt: 2,
        },
        {
          type: "addColumn",
          column: makeColumn({
            id: "col_2",
            tableId: "tbl_orders",
            name: "regions_code",
            type: { kind: "varchar", length: 8 },
          }),
          insertAt: 3,
        },
        {
          type: "addRelation",
          relation: makeRelation({
            id: "rel_3",
            fromTableId: "tbl_orders",
            toTableId: "tbl_regions",
            columnPairs: [
              { fromColumnId: "col_1", toColumnId: "col_regions_country" },
              { fromColumnId: "col_2", toColumnId: "col_regions_code" },
            ],
          }),
        },
      ],
    });
  });

  it("copies the referenced column types", () => {
    const after = applyFromOrders(buildShopSchema(), {
      toTableId: "tbl_regions",
    });

    expect([
      after.columns.col_1?.type,
      after.columns.col_2?.type,
    ]).toStrictEqual([
      { kind: "char", length: 2 },
      { kind: "varchar", length: 8 },
    ]);
  });

  it("appends the new columns after the existing columns", () => {
    const after = applyFromOrders(buildShopSchema(), {
      toTableId: "tbl_regions",
    });

    expect(after.tables.tbl_orders?.columnIds).toStrictEqual([
      "col_orders_id",
      "col_orders_total",
      "col_1",
      "col_2",
    ]);
  });

  it("makes foreign key columns nullable when onDelete is setNull", () => {
    const after = applyFromOrders(buildShopSchema(), { onDelete: "setNull" });

    expect(after.columns.col_1?.isNullable).toBe(true);
  });

  it("makes foreign key columns nullable when onUpdate is setNull", () => {
    const after = applyFromOrders(buildShopSchema(), { onUpdate: "setNull" });

    expect(after.columns.col_1?.isNullable).toBe(true);
  });

  it("marks the single foreign key column unique for a one-to-one relation", () => {
    const after = applyFromOrders(buildShopSchema(), { kind: "oneToOne" });

    expect(after.columns.col_1?.isUnique).toBe(true);
  });

  it("adds a unique index over the foreign key columns for a composite one-to-one relation", () => {
    const operation = buildFromOrders(buildShopSchema(), {
      kind: "oneToOne",
      toTableId: "tbl_regions",
    });

    expect(operation).toStrictEqual({
      type: "batch",
      operations: [
        {
          type: "addColumn",
          column: makeColumn({
            id: "col_1",
            tableId: "tbl_orders",
            name: "regions_country",
            type: { kind: "char", length: 2 },
          }),
          insertAt: 2,
        },
        {
          type: "addColumn",
          column: makeColumn({
            id: "col_2",
            tableId: "tbl_orders",
            name: "regions_code",
            type: { kind: "varchar", length: 8 },
          }),
          insertAt: 3,
        },
        {
          type: "addRelation",
          relation: makeRelation({
            id: "rel_3",
            kind: "oneToOne",
            fromTableId: "tbl_orders",
            toTableId: "tbl_regions",
            columnPairs: [
              { fromColumnId: "col_1", toColumnId: "col_regions_country" },
              { fromColumnId: "col_2", toColumnId: "col_regions_code" },
            ],
          }),
        },
        {
          type: "addIndex",
          index: {
            id: "idx_4",
            tableId: "tbl_orders",
            name: "orders_regions_country_regions_code_key",
            columnIds: ["col_1", "col_2"],
            isUnique: true,
          },
        },
      ],
    });
  });

  it("suffixes a foreign key column name that already exists in the from table", () => {
    const schema = buildShopSchema(
      [],
      [makeOrdersColumn("col_orders_user", "USERS_ID")],
    );

    const after = applyFromOrders(schema, {});

    expect(after.columns.col_1?.name).toBe("users_id_2");
  });

  it("uses the smallest unused number as the suffix", () => {
    const schema = buildShopSchema(
      [],
      [
        makeOrdersColumn("col_orders_user", "users_id"),
        makeOrdersColumn("col_orders_user_2", "users_id_2"),
      ],
    );

    const after = applyFromOrders(schema, {});

    expect(after.columns.col_1?.name).toBe("users_id_3");
  });

  it("suffixes a name that collides with a name generated earlier", () => {
    const versionsTable = makeTable({
      id: "tbl_versions",
      name: "versions",
      primaryKeyColumnIds: ["col_versions_id", "col_versions_id_2"],
    });
    const schema = buildShopSchema(
      [versionsTable],
      [
        makeColumn({
          id: "col_versions_id",
          tableId: "tbl_versions",
          name: "id",
        }),
        makeColumn({
          id: "col_versions_id_2",
          tableId: "tbl_versions",
          name: "id_2",
        }),
        makeOrdersColumn("col_orders_version", "versions_id"),
      ],
    );

    const after = applyFromOrders(schema, { toTableId: "tbl_versions" });

    expect([
      after.columns.col_1?.name,
      after.columns.col_2?.name,
    ]).toStrictEqual(["versions_id_2", "versions_id_2_2"]);
  });

  it("supports a self-referencing relation", () => {
    const after = applyFromOrders(buildShopSchema(), {
      toTableId: "tbl_orders",
    });

    expect(after.relations.rel_2).toStrictEqual(
      makeRelation({
        id: "rel_2",
        fromTableId: "tbl_orders",
        toTableId: "tbl_orders",
        columnPairs: [{ fromColumnId: "col_1", toColumnId: "col_orders_id" }],
      }),
    );
    expect(after.columns.col_1?.name).toBe("orders_id");
  });

  it("creates a foreign key column for a referenced non-primary-key column", () => {
    const operation = buildFromOrders(buildShopSchema(), {
      referencedColumnIds: ["col_users_email"],
    });

    expect(operation).toStrictEqual({
      type: "batch",
      operations: [
        {
          type: "addColumn",
          column: makeColumn({
            id: "col_1",
            tableId: "tbl_orders",
            name: "users_email",
            type: { kind: "varchar", length: 255 },
          }),
          insertAt: 2,
        },
        {
          type: "addRelation",
          relation: makeRelation({
            id: "rel_2",
            fromTableId: "tbl_orders",
            toTableId: "tbl_users",
            columnPairs: [
              { fromColumnId: "col_1", toColumnId: "col_users_email" },
            ],
          }),
        },
      ],
    });
  });

  it("creates foreign key columns in the order of the referenced column ids", () => {
    const after = applyFromOrders(buildShopSchema(), {
      toTableId: "tbl_regions",
      referencedColumnIds: ["col_regions_code", "col_regions_country"],
    });

    expect({
      columnPairs: after.relations.rel_3?.columnPairs,
      names: [after.columns.col_1?.name, after.columns.col_2?.name],
    }).toStrictEqual({
      columnPairs: [
        { fromColumnId: "col_1", toColumnId: "col_regions_code" },
        { fromColumnId: "col_2", toColumnId: "col_regions_country" },
      ],
      names: ["regions_code", "regions_country"],
    });
  });

  it("marks the single foreign key column unique for a one-to-one relation to a referenced column", () => {
    const after = applyFromOrders(buildShopSchema(), {
      kind: "oneToOne",
      referencedColumnIds: ["col_users_email"],
    });

    expect(after.columns.col_1?.isUnique).toBe(true);
  });

  it("adds a unique index for a one-to-one relation to several referenced columns", () => {
    const after = applyFromOrders(buildShopSchema(), {
      kind: "oneToOne",
      referencedColumnIds: ["col_users_id", "col_users_email"],
    });

    expect([
      after.columns.col_1?.isUnique,
      after.columns.col_2?.isUnique,
      after.indexes.idx_4,
    ]).toStrictEqual([
      false,
      false,
      {
        id: "idx_4",
        tableId: "tbl_orders",
        name: "orders_users_id_users_email_key",
        columnIds: ["col_1", "col_2"],
        isUnique: true,
      },
    ]);
  });

  it("references the target primary key in primary key order when referencedColumnIds is omitted", () => {
    const schema = buildShopSchema();

    const operation = buildFromOrders(schema, { toTableId: "tbl_regions" });

    expect(operation).toStrictEqual(
      buildFromOrders(schema, {
        toTableId: "tbl_regions",
        referencedColumnIds: ["col_regions_country", "col_regions_code"],
      }),
    );
  });

  it("references a column of a target table without a primary key", () => {
    const tagsLabelColumn = makeColumn({
      id: "col_tags_label",
      tableId: "tbl_tags",
      name: "label",
      isUnique: true,
    });
    const schema = buildShopSchema([], [tagsLabelColumn]);

    const after = applyFromOrders(schema, {
      toTableId: "tbl_tags",
      referencedColumnIds: ["col_tags_label"],
    });

    expect(after.relations.rel_2?.columnPairs).toStrictEqual([
      { fromColumnId: "col_1", toColumnId: "col_tags_label" },
    ]);
  });

  it("suffixes the name of a foreign key column for a referenced column when it already exists", () => {
    const schema = buildShopSchema(
      [],
      [makeOrdersColumn("col_orders_email", "users_email")],
    );

    const after = applyFromOrders(schema, {
      referencedColumnIds: ["col_users_email"],
    });

    expect(after.columns.col_1?.name).toBe("users_email_2");
  });

  it.each(REFERENCED_COLUMN_ERROR_CASES)(
    "returns $label in referencedColumnIds",
    ({ referencedColumnIds, expected }) => {
      const result = buildRelation(
        buildShopSchema(),
        { ...ORDERS_TO_USERS, referencedColumnIds },
        createCounterIdGenerator(),
      );

      expect(unwrapError(result)).toStrictEqual(expected);
    },
  );

  it("reports a missing target table before invalid referenced columns", () => {
    const result = buildRelation(
      buildShopSchema(),
      {
        ...ORDERS_TO_USERS,
        toTableId: "tbl_missing",
        referencedColumnIds: [],
      },
      createCounterIdGenerator(),
    );

    expect(unwrapError(result)).toStrictEqual({
      code: "table-not-found",
      path: ["toTableId"],
    });
  });

  it("returns table-not-found at fromTableId for a missing source table", () => {
    const result = buildRelation(
      buildShopSchema(),
      { ...ORDERS_TO_USERS, fromTableId: "tbl_missing" },
      createCounterIdGenerator(),
    );

    expect(unwrapError(result)).toStrictEqual({
      code: "table-not-found",
      path: ["fromTableId"],
    });
  });

  it("reports the missing source table before the missing target table", () => {
    const result = buildRelation(
      buildShopSchema(),
      {
        ...ORDERS_TO_USERS,
        fromTableId: "tbl_missing",
        toTableId: "tbl_absent",
      },
      createCounterIdGenerator(),
    );

    expect(unwrapError(result)).toStrictEqual({
      code: "table-not-found",
      path: ["fromTableId"],
    });
  });

  it("returns table-not-found at toTableId for a missing target table", () => {
    const result = buildRelation(
      buildShopSchema(),
      { ...ORDERS_TO_USERS, toTableId: "tbl_missing" },
      createCounterIdGenerator(),
    );

    expect(unwrapError(result)).toStrictEqual({
      code: "table-not-found",
      path: ["toTableId"],
    });
  });

  it("returns primary-key-missing when the target table has no primary key", () => {
    const result = buildRelation(
      buildShopSchema(),
      { ...ORDERS_TO_USERS, toTableId: "tbl_tags" },
      createCounterIdGenerator(),
    );

    expect(unwrapError(result)).toStrictEqual({
      code: "primary-key-missing",
      path: ["toTableId"],
    });
  });

  it.each(NO_ISSUE_CASES)(
    "introduces no semantic issues for one-to-many, one-to-one and setNull relations ($label)",
    ({ overrides }) => {
      const schema = buildShopSchema();

      const after = applyFromOrders(schema, overrides);

      expect(findIntroducedIssues(schema, after)).toStrictEqual([]);
    },
  );

  it("leaves relation-set-default-without-default for a setDefault relation", () => {
    const schema = buildShopSchema();

    const after = applyFromOrders(schema, { onDelete: "setDefault" });

    expect(findIntroducedIssues(schema, after)).toStrictEqual([
      {
        code: "relation-set-default-without-default",
        path: ["relations", "rel_2", "onDelete"],
      },
    ]);
  });

  it("restores the original schema when the inverse of the applied batch is applied", () => {
    const schema = buildShopSchema();
    const operation = buildFromOrders(schema, {
      kind: "oneToOne",
      toTableId: "tbl_regions",
    });

    const applied = unwrapOk(applyOperation(schema, operation));
    const restored = unwrapOk(applyOperation(applied.schema, applied.inverse));

    expect(restored.schema).toStrictEqual(schema);
  });
});
