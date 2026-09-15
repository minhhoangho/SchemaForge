import { describe, expect, it } from "vitest";

import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeRelation,
  makeTable,
} from "../../testing/factories.js";

import { validateRelations } from "./relations.js";

describe("validateRelations", () => {
  it("returns no issues for a relation to a primary key with matching types", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders", primaryKeyColumnIds: [] }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      ],
      columns: [
        makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
        makeColumn({ id: "col_customer_id", tableId: "tbl_orders" }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([]);
  });

  it("accepts a self-referencing relation", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_employees", primaryKeyColumnIds: ["col_id"] }),
      ],
      columns: [
        makeColumn({ id: "col_id", tableId: "tbl_employees" }),
        makeColumn({
          id: "col_manager_id",
          tableId: "tbl_employees",
          isNullable: true,
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_manager",
          fromTableId: "tbl_employees",
          toTableId: "tbl_employees",
          columnPairs: [
            { fromColumnId: "col_manager_id", toColumnId: "col_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([]);
  });

  it("reports relation-column-type-mismatch at the index of the mismatched pair", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders" }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      ],
      columns: [
        makeColumn({
          id: "col_user_id",
          tableId: "tbl_users",
          type: { kind: "integer" },
        }),
        makeColumn({
          id: "col_customer_id",
          tableId: "tbl_orders",
          type: { kind: "bigint" },
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([
      {
        code: "relation-column-type-mismatch",
        path: ["relations", "rel_orders_users", "columnPairs", 0],
      },
    ]);
  });

  it("reports a mismatch for varchar columns with different lengths", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders" }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      ],
      columns: [
        makeColumn({
          id: "col_user_id",
          tableId: "tbl_users",
          type: { kind: "varchar", length: 10 },
        }),
        makeColumn({
          id: "col_customer_id",
          tableId: "tbl_orders",
          type: { kind: "varchar", length: 20 },
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([
      {
        code: "relation-column-type-mismatch",
        path: ["relations", "rel_orders_users", "columnPairs", 0],
      },
    ]);
  });

  it("reports a mismatch for decimal columns with different scale", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders" }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      ],
      columns: [
        makeColumn({
          id: "col_user_id",
          tableId: "tbl_users",
          type: { kind: "decimal", precision: 10, scale: 2 },
        }),
        makeColumn({
          id: "col_customer_id",
          tableId: "tbl_orders",
          type: { kind: "decimal", precision: 10, scale: 4 },
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([
      {
        code: "relation-column-type-mismatch",
        path: ["relations", "rel_orders_users", "columnPairs", 0],
      },
    ]);
  });

  it("reports a mismatch for enum columns using different enums", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders" }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      ],
      columns: [
        makeColumn({
          id: "col_user_id",
          tableId: "tbl_users",
          type: { kind: "enum", enumId: "enum_a" },
        }),
        makeColumn({
          id: "col_customer_id",
          tableId: "tbl_orders",
          type: { kind: "enum", enumId: "enum_b" },
        }),
      ],
      enums: [
        makeEnum({ id: "enum_a", values: ["x"] }),
        makeEnum({ id: "enum_b", values: ["y"] }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([
      {
        code: "relation-column-type-mismatch",
        path: ["relations", "rel_orders_users", "columnPairs", 0],
      },
    ]);
  });

  it("reports a mismatch for custom types with different names", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders" }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      ],
      columns: [
        makeColumn({
          id: "col_user_id",
          tableId: "tbl_users",
          type: { kind: "custom", name: "citext" },
        }),
        makeColumn({
          id: "col_customer_id",
          tableId: "tbl_orders",
          type: { kind: "custom", name: "ltree" },
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([
      {
        code: "relation-column-type-mismatch",
        path: ["relations", "rel_orders_users", "columnPairs", 0],
      },
    ]);
  });

  it("accepts identical custom types", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders" }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      ],
      columns: [
        makeColumn({
          id: "col_user_id",
          tableId: "tbl_users",
          type: { kind: "custom", name: "citext" },
        }),
        makeColumn({
          id: "col_customer_id",
          tableId: "tbl_orders",
          type: { kind: "custom", name: "citext" },
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([]);
  });

  it("reports relation-target-not-unique when the target columns are not a key", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_orders" }), makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
        makeColumn({ id: "col_customer_id", tableId: "tbl_orders" }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([
      {
        code: "relation-target-not-unique",
        path: ["relations", "rel_orders_users", "columnPairs"],
      },
    ]);
  });

  it("accepts a target that is a single unique column", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_orders" }), makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({ id: "col_user_id", tableId: "tbl_users", isUnique: true }),
        makeColumn({ id: "col_customer_id", tableId: "tbl_orders" }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([]);
  });

  it("accepts a target that matches a unique index in another column order", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_orders" }), makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({ id: "col_first", tableId: "tbl_users" }),
        makeColumn({ id: "col_last", tableId: "tbl_users" }),
        makeColumn({ id: "col_customer_first", tableId: "tbl_orders" }),
        makeColumn({ id: "col_customer_last", tableId: "tbl_orders" }),
      ],
      indexes: [
        makeIndex({
          id: "idx_users_name",
          tableId: "tbl_users",
          columnIds: ["col_last", "col_first"],
          isUnique: true,
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [
            {
              fromColumnId: "col_customer_first",
              toColumnId: "col_first",
            },
            { fromColumnId: "col_customer_last", toColumnId: "col_last" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([]);
  });

  it("reports relation-target-not-unique for part of a composite primary key", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders" }),
        makeTable({
          id: "tbl_users",
          primaryKeyColumnIds: ["col_tenant_id", "col_user_id"],
        }),
      ],
      columns: [
        makeColumn({ id: "col_tenant_id", tableId: "tbl_users" }),
        makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
        makeColumn({ id: "col_customer_id", tableId: "tbl_orders" }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([
      {
        code: "relation-target-not-unique",
        path: ["relations", "rel_orders_users", "columnPairs"],
      },
    ]);
  });

  it("reports relation-one-to-one-not-unique when foreign key columns are not unique", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_profiles" }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      ],
      columns: [
        makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
        makeColumn({ id: "col_owner_id", tableId: "tbl_profiles" }),
      ],
      relations: [
        makeRelation({
          id: "rel_profiles_users",
          kind: "oneToOne",
          fromTableId: "tbl_profiles",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_owner_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([
      {
        code: "relation-one-to-one-not-unique",
        path: ["relations", "rel_profiles_users", "kind"],
      },
    ]);
  });

  it("accepts a one-to-one relation whose foreign key is the primary key", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_profiles",
          primaryKeyColumnIds: ["col_owner_id"],
        }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      ],
      columns: [
        makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
        makeColumn({ id: "col_owner_id", tableId: "tbl_profiles" }),
      ],
      relations: [
        makeRelation({
          id: "rel_profiles_users",
          kind: "oneToOne",
          fromTableId: "tbl_profiles",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_owner_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([]);
  });

  it("does not require unique foreign keys for one-to-many", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders" }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      ],
      columns: [
        makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
        makeColumn({ id: "col_customer_id", tableId: "tbl_orders" }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          kind: "oneToMany",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([]);
  });

  it("reports relation-set-null-not-nullable at onDelete", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders" }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      ],
      columns: [
        makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
        makeColumn({
          id: "col_customer_id",
          tableId: "tbl_orders",
          isNullable: false,
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          onDelete: "setNull",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([
      {
        code: "relation-set-null-not-nullable",
        path: ["relations", "rel_orders_users", "onDelete"],
      },
    ]);
  });

  it("reports relation-set-null-not-nullable at both onDelete and onUpdate when both are setNull", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders" }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      ],
      columns: [
        makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
        makeColumn({
          id: "col_customer_id",
          tableId: "tbl_orders",
          isNullable: false,
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          onDelete: "setNull",
          onUpdate: "setNull",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([
      {
        code: "relation-set-null-not-nullable",
        path: ["relations", "rel_orders_users", "onDelete"],
      },
      {
        code: "relation-set-null-not-nullable",
        path: ["relations", "rel_orders_users", "onUpdate"],
      },
    ]);
  });

  it("accepts setNull when every foreign key column is nullable", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders" }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      ],
      columns: [
        makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
        makeColumn({
          id: "col_customer_id",
          tableId: "tbl_orders",
          isNullable: true,
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          onDelete: "setNull",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([]);
  });

  it("reports relation-set-default-without-default at onUpdate", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders" }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      ],
      columns: [
        makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
        makeColumn({
          id: "col_customer_id",
          tableId: "tbl_orders",
          defaultValue: null,
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          onUpdate: "setDefault",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([
      {
        code: "relation-set-default-without-default",
        path: ["relations", "rel_orders_users", "onUpdate"],
      },
    ]);
  });

  it("accepts setDefault when every foreign key column has a default", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders" }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      ],
      columns: [
        makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
        makeColumn({
          id: "col_customer_id",
          tableId: "tbl_orders",
          defaultValue: { kind: "literal", value: "1" },
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          onUpdate: "setDefault",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([]);
  });

  it("ED-03 reports when a foreign key column and the referenced column have different types", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders" }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      ],
      columns: [
        makeColumn({
          id: "col_user_id",
          tableId: "tbl_users",
          type: { kind: "uuid" },
        }),
        makeColumn({
          id: "col_customer_id",
          tableId: "tbl_orders",
          type: { kind: "integer" },
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(validateRelations(schema)).toStrictEqual([
      {
        code: "relation-column-type-mismatch",
        path: ["relations", "rel_orders_users", "columnPairs", 0],
      },
    ]);
  });
});
