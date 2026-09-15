import { describe, expect, it } from "vitest";

import {
  buildSchema,
  makeColumn,
  makeIndex,
  makeTable,
} from "../../testing/factories.js";

import { validateColumns } from "./columns.js";

describe("validateColumns", () => {
  it("returns no issues for a valid auto-increment primary key column", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_id"] })],
      columns: [
        makeColumn({
          id: "col_id",
          tableId: "tbl_users",
          type: { kind: "integer" },
          isAutoIncrement: true,
        }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([]);
  });

  it("reports column-primary-key-nullable for a nullable primary key column", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_id"] })],
      columns: [
        makeColumn({ id: "col_id", tableId: "tbl_users", isNullable: true }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([
      {
        code: "column-primary-key-nullable",
        path: ["columns", "col_id", "isNullable"],
      },
    ]);
  });

  it("does not report a nullable column outside the primary key", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_bio",
          tableId: "tbl_users",
          type: { kind: "text" },
          isNullable: true,
        }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([]);
  });

  it("reports column-auto-increment-invalid-type on a varchar column", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_id"] })],
      columns: [
        makeColumn({
          id: "col_id",
          tableId: "tbl_users",
          type: { kind: "varchar", length: 10 },
          isAutoIncrement: true,
        }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([
      {
        code: "column-auto-increment-invalid-type",
        path: ["columns", "col_id", "isAutoIncrement"],
      },
    ]);
  });

  it.each([
    { kind: "smallint" as const },
    { kind: "integer" as const },
    { kind: "bigint" as const },
  ])("accepts auto-increment on $kind", (type) => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_id"] })],
      columns: [
        makeColumn({
          id: "col_id",
          tableId: "tbl_users",
          type,
          isAutoIncrement: true,
        }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([]);
  });

  it("reports column-auto-increment-nullable", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_id",
          tableId: "tbl_users",
          type: { kind: "integer" },
          isAutoIncrement: true,
          isNullable: true,
          isUnique: true,
        }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([
      {
        code: "column-auto-increment-nullable",
        path: ["columns", "col_id", "isAutoIncrement"],
      },
    ]);
  });

  it("reports column-auto-increment-with-default", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_id",
          tableId: "tbl_users",
          type: { kind: "integer" },
          isAutoIncrement: true,
          isUnique: true,
          defaultValue: { kind: "literal", value: "1" },
        }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([
      {
        code: "column-auto-increment-with-default",
        path: ["columns", "col_id", "isAutoIncrement"],
      },
    ]);
  });

  it("reports column-auto-increment-not-key when the column is neither key nor unique", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_id",
          tableId: "tbl_users",
          type: { kind: "integer" },
          isAutoIncrement: true,
        }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([
      {
        code: "column-auto-increment-not-key",
        path: ["columns", "col_id", "isAutoIncrement"],
      },
    ]);
  });

  it("accepts auto-increment on the second column of a composite primary key", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_users",
          primaryKeyColumnIds: ["col_tenant", "col_id"],
        }),
      ],
      columns: [
        makeColumn({
          id: "col_tenant",
          tableId: "tbl_users",
          type: { kind: "integer" },
        }),
        makeColumn({
          id: "col_id",
          tableId: "tbl_users",
          type: { kind: "integer" },
          isAutoIncrement: true,
        }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([]);
  });

  it("accepts auto-increment on a column marked unique", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_id",
          tableId: "tbl_users",
          type: { kind: "integer" },
          isAutoIncrement: true,
          isUnique: true,
        }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([]);
  });

  it("accepts auto-increment on the only column of a unique index", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_id",
          tableId: "tbl_users",
          type: { kind: "integer" },
          isAutoIncrement: true,
        }),
      ],
      indexes: [
        makeIndex({
          id: "idx_users_id",
          tableId: "tbl_users",
          columnIds: ["col_id"],
          isUnique: true,
        }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([]);
  });

  it("reports several auto-increment issues on one column at once", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_id",
          tableId: "tbl_users",
          type: { kind: "varchar", length: 10 },
          isAutoIncrement: true,
          isNullable: true,
          defaultValue: { kind: "literal", value: "x" },
        }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([
      {
        code: "column-auto-increment-invalid-type",
        path: ["columns", "col_id", "isAutoIncrement"],
      },
      {
        code: "column-auto-increment-not-key",
        path: ["columns", "col_id", "isAutoIncrement"],
      },
      {
        code: "column-auto-increment-nullable",
        path: ["columns", "col_id", "isAutoIncrement"],
      },
      {
        code: "column-auto-increment-with-default",
        path: ["columns", "col_id", "isAutoIncrement"],
      },
    ]);
  });

  it("reports table-multiple-auto-increment for two auto-increment columns in one table", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_a",
          tableId: "tbl_users",
          type: { kind: "integer" },
          isAutoIncrement: true,
          isUnique: true,
        }),
        makeColumn({
          id: "col_b",
          tableId: "tbl_users",
          type: { kind: "integer" },
          isAutoIncrement: true,
          isUnique: true,
        }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([
      {
        code: "table-multiple-auto-increment",
        path: ["tables", "tbl_users", "columnIds"],
      },
    ]);
  });

  it("reports column-type-invalid-scale when scale exceeds precision", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_products" })],
      columns: [
        makeColumn({
          id: "col_price",
          tableId: "tbl_products",
          type: { kind: "decimal", precision: 5, scale: 6 },
        }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([
      {
        code: "column-type-invalid-scale",
        path: ["columns", "col_price", "type", "scale"],
      },
    ]);
  });

  it("accepts scale equal to precision", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_products" })],
      columns: [
        makeColumn({
          id: "col_price",
          tableId: "tbl_products",
          type: { kind: "decimal", precision: 5, scale: 5 },
        }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([]);
  });

  it.each(["inet", "geometry(Point, 4326)", "text[]", "double precision"])(
    "accepts custom types such as %s",
    (name) => {
      const schema = buildSchema({
        tables: [makeTable({ id: "tbl_x" })],
        columns: [
          makeColumn({
            id: "col_x",
            tableId: "tbl_x",
            type: { kind: "custom", name },
          }),
        ],
      });

      expect(validateColumns(schema)).toStrictEqual([]);
    },
  );

  it("reports column-custom-type-invalid for a name starting with a digit", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_x" })],
      columns: [
        makeColumn({
          id: "col_x",
          tableId: "tbl_x",
          type: { kind: "custom", name: "1inet" },
        }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([
      {
        code: "column-custom-type-invalid",
        path: ["columns", "col_x", "type", "name"],
      },
    ]);
  });

  it.each(["in'et", "inet;", "geo-metry", "a/b"])(
    "reports column-custom-type-invalid for a name containing %s",
    (name) => {
      const schema = buildSchema({
        tables: [makeTable({ id: "tbl_x" })],
        columns: [
          makeColumn({
            id: "col_x",
            tableId: "tbl_x",
            type: { kind: "custom", name },
          }),
        ],
      });

      expect(validateColumns(schema)).toStrictEqual([
        {
          code: "column-custom-type-invalid",
          path: ["columns", "col_x", "type", "name"],
        },
      ]);
    },
  );

  it("reports column-custom-type-invalid for a 64-byte name", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_x" })],
      columns: [
        makeColumn({
          id: "col_x",
          tableId: "tbl_x",
          type: { kind: "custom", name: "a".repeat(64) },
        }),
      ],
    });

    expect(validateColumns(schema)).toStrictEqual([
      {
        code: "column-custom-type-invalid",
        path: ["columns", "col_x", "type", "name"],
      },
    ]);
  });

  it("ED-02 reports an invalid attribute combination such as auto-increment on a non-numeric column", () => {
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

    expect(validateColumns(schema)).toStrictEqual([
      {
        code: "column-auto-increment-invalid-type",
        path: ["columns", "col_id", "isAutoIncrement"],
      },
    ]);
  });
});
