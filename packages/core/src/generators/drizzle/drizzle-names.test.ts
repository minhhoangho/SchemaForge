import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeRelation,
  makeTable,
} from "../../testing/factories.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { allocateDrizzleVariableNames } from "./drizzle-names.js";

function tableNamed(name: string): SchemaDocument {
  return buildSchema({ tables: [makeTable({ id: "tbl_t", name })] });
}

// Reverses the key order of every id map; names must not depend on it.
function reverseMapKeys(schema: SchemaDocument): SchemaDocument {
  const reverse = <Value>(
    map: Readonly<Record<string, Value>>,
  ): Readonly<Record<string, Value>> =>
    Object.fromEntries(Object.entries(map).toReversed());
  return {
    ...schema,
    tables: reverse(schema.tables),
    columns: reverse(schema.columns),
    relations: reverse(schema.relations),
    indexes: reverse(schema.indexes),
    enums: reverse(schema.enums),
  };
}

describe("allocateDrizzleVariableNames", () => {
  it("suffixes enum variables with Enum and custom type variables with Type", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_files", name: "files" })],
      columns: [
        makeColumn({
          id: "col_data",
          tableId: "tbl_files",
          type: { kind: "binary" },
        }),
        makeColumn({
          id: "col_shape",
          tableId: "tbl_files",
          type: { kind: "custom", name: "geometry(Point, 4326)" },
        }),
      ],
      enums: [makeEnum({ id: "enum_status", name: "order_status" })],
    });

    const names = allocateDrizzleVariableNames(schema, "postgresql");

    expect({
      enums: names.enumVariables,
      customTypes: names.customTypeVariables,
    }).toStrictEqual({
      enums: new Map([["enum_status", "orderStatusEnum"]]),
      customTypes: new Map([
        ["bytea", "byteaType"],
        ["geometry(Point, 4326)", "geometryPoint4326Type"],
      ]),
    });
  });

  it("allocates enums, custom types, tables, then relations", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_a", name: "status_enum" }),
        makeTable({ id: "tbl_b", name: "longblob_type" }),
        makeTable({ id: "tbl_c", name: "posts_relations" }),
        makeTable({ id: "tbl_d", name: "posts" }),
      ],
      columns: [
        makeColumn({ id: "col_a", tableId: "tbl_a", type: { kind: "binary" } }),
        makeColumn({ id: "col_d", tableId: "tbl_d" }),
        makeColumn({ id: "col_parent", tableId: "tbl_d", isNullable: true }),
      ],
      relations: [
        makeRelation({
          id: "rel_parent",
          fromTableId: "tbl_d",
          toTableId: "tbl_d",
          columnPairs: [{ fromColumnId: "col_parent", toColumnId: "col_d" }],
        }),
      ],
      enums: [makeEnum({ id: "enum_status", name: "status" })],
    });

    const names = allocateDrizzleVariableNames(schema, "mysql");

    expect(names).toStrictEqual({
      enumVariables: new Map(),
      customTypeVariables: new Map([["longblob", "longblobType"]]),
      tableVariables: new Map([
        ["tbl_b", "longblobType2"],
        ["tbl_d", "posts"],
        ["tbl_c", "postsRelations"],
        ["tbl_a", "statusEnum"],
      ]),
      relationsVariables: new Map([["tbl_d", "postsRelations2"]]),
    });
  });

  it("appends an underscore to a JavaScript reserved word", () => {
    const names = allocateDrizzleVariableNames(
      tableNamed("default"),
      "postgresql",
    );

    expect(names.tableVariables.get("tbl_t")).toBe("default_");
  });

  it("appends 2 to a table named like a builder import", () => {
    const names = allocateDrizzleVariableNames(
      tableNamed("index"),
      "postgresql",
    );

    expect(names.tableVariables.get("tbl_t")).toBe("index2");
  });

  it.each([
    ["table", "table2"],
    ["one", "one2"],
    ["many", "many2"],
    ["relations", "relations2"],
    ["sql", "sql2"],
  ])(
    "appends 2 to a table named like a callback parameter or drizzle-orm import (%s)",
    (name, expected) => {
      const names = allocateDrizzleVariableNames(tableNamed(name), "mysql");

      expect(names.tableVariables.get("tbl_t")).toBe(expected);
    },
  );

  it.each([
    ["postgresql", "uuid", "uuid2"],
    ["mysql", "mysql_table", "mysqlTable2"],
  ] as const)(
    "reserves the full import list even when a builder is unused (%s %s)",
    (dialect, name, expected) => {
      const names = allocateDrizzleVariableNames(tableNamed(name), dialect);

      expect(names.tableVariables.get("tbl_t")).toBe(expected);
    },
  );

  it("returns the same names regardless of map key order", () => {
    const schema = createSampleSchema();

    expect(
      allocateDrizzleVariableNames(reverseMapKeys(schema), "postgresql"),
    ).toStrictEqual(allocateDrizzleVariableNames(schema, "postgresql"));
  });
});
