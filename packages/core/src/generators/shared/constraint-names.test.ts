import { describe, expect, it } from "vitest";

import type { ColumnPair, Relation } from "../../model/relation.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeRelation,
  makeTable,
} from "../../testing/factories.js";
import type { SchemaConstraintNames } from "./constraint-names.js";
import {
  allocateConstraintNames,
  buildConstraintName,
  fnv1a32Hex,
} from "./constraint-names.js";

const keepPairOrder = (relation: Relation): readonly ColumnPair[] =>
  relation.columnPairs;

const reversePairOrder = (relation: Relation): readonly ColumnPair[] =>
  relation.columnPairs.toReversed();

const toEntries = (names: SchemaConstraintNames): unknown => ({
  primaryKeys: [...names.primaryKeys],
  uniqueColumns: [...names.uniqueColumns],
  enumChecks: [...names.enumChecks],
  foreignKeys: [...names.foreignKeys],
  autoIncrementIndexes: [...names.autoIncrementIndexes],
});

describe("buildConstraintName", () => {
  it.each([
    { table: "users", columns: ["id"], suffix: "pkey", expected: "users_pkey" },
    {
      table: "users",
      columns: ["email"],
      suffix: "key",
      expected: "users_email_key",
    },
    {
      table: "orders",
      columns: ["tenant_id", "number"],
      suffix: "key",
      expected: "orders_tenant_id_number_key",
    },
    {
      table: "posts",
      columns: ["author_id"],
      suffix: "fkey",
      expected: "posts_author_id_fkey",
    },
    {
      table: "orders",
      columns: ["status"],
      suffix: "check",
      expected: "orders_status_check",
    },
    {
      table: "users",
      columns: ["id"],
      suffix: "idx",
      expected: "users_id_idx",
    },
  ] as const)(
    "builds names by the PostgreSQL convention ($expected)",
    ({ table, columns, suffix, expected }) => {
      expect(buildConstraintName(table, columns, suffix)).toBe(expected);
    },
  );

  it("keeps a name of exactly 63 bytes", () => {
    const tableName = "a".repeat(53);

    expect(buildConstraintName(tableName, ["email"], "key")).toBe(
      `${tableName}_email_key`,
    );
  });

  it("shortens a 64-byte name to 54 bytes, an underscore and an eight-digit hash", () => {
    const tableName = "a".repeat(54);

    expect(buildConstraintName(tableName, ["email"], "key")).toBe(
      `${tableName}_b65485c8`,
    );
  });

  it("cuts at a code point boundary inside accented text", () => {
    const tableName = `${"a".repeat(53)}éé`;

    expect(buildConstraintName(tableName, ["email"], "key")).toBe(
      `${"a".repeat(53)}_652bfff7`,
    );
  });
});

describe("fnv1a32Hex", () => {
  it.each([
    { text: "", expected: "811c9dc5" },
    { text: "a", expected: "e40c292c" },
    { text: "foobar", expected: "bf9cf968" },
  ])("matches the FNV-1a test vectors ($text)", ({ text, expected }) => {
    expect(fnv1a32Hex(text)).toBe(expected);
  });

  // Expected values computed once with Node's Buffer, outside core.
  it.each([
    { text: "người_dùng", expected: "b9f1a9fe" },
    { text: "bảng_😀", expected: "935d1d10" },
    { text: "x\uD800y", expected: "66b4d003" },
  ])(
    "hashes the utf-8 bytes of accented text ($text)",
    ({ text, expected }) => {
      expect(fnv1a32Hex(text)).toBe(expected);
    },
  );
});

describe("allocateConstraintNames", () => {
  const statusEnum = makeEnum({ id: "enum_status" });
  const usersTable = makeTable({
    id: "tbl_users",
    name: "users",
    primaryKeyColumnIds: ["col_users_id"],
  });
  const postsTable = makeTable({
    id: "tbl_posts",
    name: "posts",
    primaryKeyColumnIds: ["col_posts_id"],
  });
  const usersColumns = [
    makeColumn({
      id: "col_users_id",
      tableId: "tbl_users",
      name: "id",
      isAutoIncrement: true,
    }),
    makeColumn({
      id: "col_users_email",
      tableId: "tbl_users",
      name: "email",
      type: { kind: "varchar", length: 255 },
      isUnique: true,
    }),
    makeColumn({
      id: "col_users_status",
      tableId: "tbl_users",
      name: "status",
      type: { kind: "enum", enumId: "enum_status" },
    }),
  ];
  const postsColumns = [
    makeColumn({ id: "col_posts_id", tableId: "tbl_posts", name: "id" }),
    makeColumn({
      id: "col_posts_author_id",
      tableId: "tbl_posts",
      name: "author_id",
    }),
  ];
  const authorRelation = makeRelation({
    id: "rel_author",
    fromTableId: "tbl_posts",
    toTableId: "tbl_users",
    columnPairs: [
      { fromColumnId: "col_posts_author_id", toColumnId: "col_users_id" },
    ],
  });

  it("allocates primary key, unique, check, auto-increment index and foreign key names for a schema", () => {
    const schema = buildSchema({
      tables: [usersTable, postsTable],
      columns: [...usersColumns, ...postsColumns],
      relations: [authorRelation],
      enums: [statusEnum],
    });

    expect(allocateConstraintNames(schema, keepPairOrder)).toStrictEqual({
      primaryKeys: new Map([
        ["tbl_posts", "posts_pkey"],
        ["tbl_users", "users_pkey"],
      ]),
      uniqueColumns: new Map([["col_users_email", "users_email_key"]]),
      enumChecks: new Map([["col_users_status", "users_status_check"]]),
      foreignKeys: new Map([["rel_author", "posts_author_id_fkey"]]),
      autoIncrementIndexes: new Map([["col_users_id", "users_id_idx"]]),
    });
  });

  it("adds _2 when a generated name equals a table name", () => {
    const schema = buildSchema({
      tables: [usersTable, makeTable({ id: "tbl_clash", name: "users_pkey" })],
      columns: [makeColumn({ id: "col_users_id", tableId: "tbl_users" })],
    });

    expect(
      allocateConstraintNames(schema, keepPairOrder).primaryKeys.get(
        "tbl_users",
      ),
    ).toBe("users_pkey_2");
  });

  it("adds _2 when a generated name equals a user index name that differs only in case", () => {
    const schema = buildSchema({
      tables: [usersTable],
      columns: usersColumns,
      indexes: [
        makeIndex({
          id: "idx_email",
          tableId: "tbl_users",
          name: "USERS_EMAIL_KEY",
          columnIds: ["col_users_email"],
        }),
      ],
      enums: [statusEnum],
    });

    expect(
      allocateConstraintNames(schema, keepPairOrder).uniqueColumns.get(
        "col_users_email",
      ),
    ).toBe("users_email_key_2");
  });

  // MySQL 8.4 compares constraint names accent-sensitively (Task 8 probe).
  it("keeps both generated names when they differ only by an accent", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_t", name: "t" })],
      columns: [
        makeColumn({
          id: "col_ma",
          tableId: "tbl_t",
          name: "ma",
          isUnique: true,
        }),
        makeColumn({
          id: "col_ma_acute",
          tableId: "tbl_t",
          name: "má",
          isUnique: true,
        }),
      ],
    });

    expect(
      allocateConstraintNames(schema, keepPairOrder).uniqueColumns,
    ).toStrictEqual(
      new Map([
        ["col_ma", "t_ma_key"],
        ["col_ma_acute", "t_má_key"],
      ]),
    );
  });

  it("never renames a user index, even one on a table allocated later", () => {
    const schema = buildSchema({
      tables: [usersTable, makeTable({ id: "tbl_zeta", name: "zeta" })],
      columns: [
        ...usersColumns,
        makeColumn({ id: "col_zeta_id", tableId: "tbl_zeta", name: "id" }),
      ],
      indexes: [
        makeIndex({
          id: "idx_clash",
          tableId: "tbl_zeta",
          name: "users_email_key",
          columnIds: ["col_zeta_id"],
        }),
      ],
      enums: [statusEnum],
    });

    expect(
      allocateConstraintNames(schema, keepPairOrder).uniqueColumns.get(
        "col_users_email",
      ),
    ).toBe("users_email_key_2");
  });

  it("orders foreign key column names with the injected pair order", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_tenants",
          name: "tenants",
          primaryKeyColumnIds: ["col_tenant_a", "col_tenant_b"],
        }),
        makeTable({ id: "tbl_orders", name: "orders" }),
      ],
      columns: [
        makeColumn({ id: "col_tenant_a", tableId: "tbl_tenants", name: "a" }),
        makeColumn({ id: "col_tenant_b", tableId: "tbl_tenants", name: "b" }),
        makeColumn({
          id: "col_order_a",
          tableId: "tbl_orders",
          name: "tenant_a",
        }),
        makeColumn({
          id: "col_order_b",
          tableId: "tbl_orders",
          name: "tenant_b",
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_tenant",
          fromTableId: "tbl_orders",
          toTableId: "tbl_tenants",
          columnPairs: [
            { fromColumnId: "col_order_a", toColumnId: "col_tenant_a" },
            { fromColumnId: "col_order_b", toColumnId: "col_tenant_b" },
          ],
        }),
      ],
    });

    expect(
      allocateConstraintNames(schema, reversePairOrder).foreignKeys.get(
        "rel_tenant",
      ),
    ).toBe("orders_tenant_b_tenant_a_fkey");
  });

  it("returns the same names regardless of map key order", () => {
    const forward = buildSchema({
      tables: [usersTable, postsTable],
      columns: [...usersColumns, ...postsColumns],
      relations: [authorRelation],
      enums: [statusEnum],
    });
    const backward = buildSchema({
      tables: [postsTable, usersTable],
      columns: [...postsColumns, ...usersColumns],
      relations: [authorRelation],
      enums: [statusEnum],
    });

    expect(
      toEntries(allocateConstraintNames(backward, keepPairOrder)),
    ).toStrictEqual(toEntries(allocateConstraintNames(forward, keepPairOrder)));
  });
});
