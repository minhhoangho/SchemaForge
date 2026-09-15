import { describe, expect, it } from "vitest";

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

import { validateSchema } from "./validate-schema.js";

describe("validateSchema", () => {
  it("returns no issues for a schema built from factory defaults", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_id"] }),
        makeTable({ id: "tbl_orders", subjectAreaId: "area_sales" }),
      ],
      columns: [
        makeColumn({ id: "col_id", tableId: "tbl_users" }),
        makeColumn({ id: "col_user_id", tableId: "tbl_orders" }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [{ fromColumnId: "col_user_id", toColumnId: "col_id" }],
        }),
      ],
      indexes: [
        makeIndex({
          id: "idx_orders_user_id",
          tableId: "tbl_orders",
          columnIds: ["col_user_id"],
        }),
      ],
      enums: [makeEnum({ id: "enum_status" })],
      subjectAreas: [makeSubjectArea({ id: "area_sales" })],
      notes: [makeNote({ id: "note_1" })],
    });

    expect(validateSchema(schema)).toStrictEqual([]);
  });

  it("combines issues from every rule", () => {
    const schema = buildSchema({
      name: "",
      tables: [
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_id"] }),
        makeTable({ id: "tbl_orders" }),
      ],
      columns: [
        makeColumn({ id: "col_id", tableId: "tbl_users" }),
        makeColumn({
          id: "col_code",
          tableId: "tbl_users",
          type: { kind: "text" },
          isUnique: true,
          isAutoIncrement: true,
        }),
        makeColumn({
          id: "col_age",
          tableId: "tbl_users",
          defaultValue: { kind: "literal", value: "abc" },
        }),
        makeColumn({
          id: "col_customer_id",
          tableId: "tbl_orders",
          type: { kind: "uuid" },
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_users",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_customer_id", toColumnId: "col_id" },
          ],
        }),
      ],
      enums: [makeEnum({ id: "enum_status", values: [] })],
    });

    expect(validateSchema(schema)).toStrictEqual([
      {
        code: "column-default-invalid",
        path: ["columns", "col_age", "defaultValue"],
      },
      {
        code: "column-auto-increment-invalid-type",
        path: ["columns", "col_code", "isAutoIncrement"],
      },
      { code: "enum-values-empty", path: ["enums", "enum_status", "values"] },
      { code: "name-empty", path: ["name"] },
      {
        code: "relation-column-type-mismatch",
        path: ["relations", "rel_orders_users", "columnPairs", 0],
      },
    ]);
  });

  it("sorts issues by path, then by code", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_code",
          tableId: "tbl_users",
          type: { kind: "text" },
          isUnique: true,
          isAutoIncrement: true,
        }),
      ],
      enums: [makeEnum({ id: "enum_status", values: [" active", " active"] })],
    });

    expect(validateSchema(schema)).toStrictEqual([
      {
        code: "column-auto-increment-invalid-type",
        path: ["columns", "col_code", "isAutoIncrement"],
      },
      {
        code: "enum-value-duplicate",
        path: ["enums", "enum_status", "values", 0],
      },
      { code: "name-invalid", path: ["enums", "enum_status", "values", 0] },
      {
        code: "enum-value-duplicate",
        path: ["enums", "enum_status", "values", 1],
      },
      { code: "name-invalid", path: ["enums", "enum_status", "values", 1] },
    ]);
  });

  it("returns the same issues when map keys are inserted in a different order", () => {
    const tables = [
      makeTable({ id: "tbl_a", name: "users" }),
      makeTable({ id: "tbl_b", name: "Users" }),
    ];
    const columns = [
      makeColumn({ id: "col_a_id", tableId: "tbl_a", name: "" }),
      makeColumn({ id: "col_b_id", tableId: "tbl_b", name: "" }),
    ];
    const enums = [
      makeEnum({ id: "enum_a", values: [] }),
      makeEnum({ id: "enum_b", values: [] }),
    ];
    const forward = buildSchema({ tables, columns, enums });
    const reversed = buildSchema({
      tables: tables.toReversed(),
      columns: columns.toReversed(),
      enums: enums.toReversed(),
    });

    expect(validateSchema(reversed)).toStrictEqual([
      { code: "name-empty", path: ["columns", "col_a_id", "name"] },
      { code: "name-empty", path: ["columns", "col_b_id", "name"] },
      { code: "enum-values-empty", path: ["enums", "enum_a", "values"] },
      { code: "enum-values-empty", path: ["enums", "enum_b", "values"] },
      { code: "table-name-duplicate", path: ["tables", "tbl_a", "name"] },
      { code: "table-name-duplicate", path: ["tables", "tbl_b", "name"] },
    ]);
    expect(validateSchema(reversed)).toStrictEqual(validateSchema(forward));
  });

  it("ED-01 reports two tables with the same name", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_customers", name: "users" }),
        makeTable({ id: "tbl_users", name: "users" }),
      ],
    });

    expect(validateSchema(schema)).toStrictEqual([
      {
        code: "table-name-duplicate",
        path: ["tables", "tbl_customers", "name"],
      },
      { code: "table-name-duplicate", path: ["tables", "tbl_users", "name"] },
    ]);
  });

  it("ED-02 reports two columns with the same name in one table", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({ id: "col_email", tableId: "tbl_users", name: "email" }),
        makeColumn({ id: "col_mail", tableId: "tbl_users", name: "Email" }),
      ],
    });

    expect(validateSchema(schema)).toStrictEqual([
      { code: "column-name-duplicate", path: ["columns", "col_email", "name"] },
      { code: "column-name-duplicate", path: ["columns", "col_mail", "name"] },
    ]);
  });

  it("ED-02 reports an invalid attribute combination", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_id"] })],
      columns: [
        makeColumn({
          id: "col_id",
          tableId: "tbl_users",
          type: { kind: "text" },
          isAutoIncrement: true,
        }),
      ],
    });

    expect(validateSchema(schema)).toStrictEqual([
      {
        code: "column-auto-increment-invalid-type",
        path: ["columns", "col_id", "isAutoIncrement"],
      },
    ]);
  });

  it("ED-03 reports a foreign key column whose type differs from the referenced column", () => {
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

    expect(validateSchema(schema)).toStrictEqual([
      {
        code: "relation-column-type-mismatch",
        path: ["relations", "rel_orders_users", "columnPairs", 0],
      },
    ]);
  });

  it("ED-05 reports an enum without values", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_status", values: [] })],
    });

    expect(validateSchema(schema)).toStrictEqual([
      { code: "enum-values-empty", path: ["enums", "enum_status", "values"] },
    ]);
  });

  it("ED-05 reports an enum with duplicate values", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_status", values: ["active", "Active"] })],
    });

    expect(validateSchema(schema)).toStrictEqual([
      {
        code: "enum-value-duplicate",
        path: ["enums", "enum_status", "values", 0],
      },
      {
        code: "enum-value-duplicate",
        path: ["enums", "enum_status", "values", 1],
      },
    ]);
  });
});
