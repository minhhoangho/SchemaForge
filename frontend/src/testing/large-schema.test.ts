import { validateSchema } from "@schemaforge/core";
import { describe, expect, it } from "vitest";

import { makeLargeSchema, STANDARD_LARGE_SCHEMA } from "./large-schema";

describe("makeLargeSchema", () => {
  it("builds a schema with the requested number of tables, columns and relations", () => {
    const document = makeLargeSchema(STANDARD_LARGE_SCHEMA);
    const tables = Object.values(document.tables);

    expect({
      tableCount: tables.length,
      columnCount: Object.keys(document.columns).length,
      relationCount: Object.keys(document.relations).length,
      columnsPerTable: new Set(tables.map((table) => table.columnIds.length)),
    }).toEqual({
      tableCount: 100,
      columnCount: 1500,
      relationCount: 150,
      columnsPerTable: new Set([15]),
    });
  });

  it("gives every table a bigint primary key", () => {
    const document = makeLargeSchema(STANDARD_LARGE_SCHEMA);

    const primaryKeys = Object.values(document.tables).map((table) => {
      const [keyColumnId] = table.primaryKeyColumnIds;
      const keyColumn =
        keyColumnId === undefined ? undefined : document.columns[keyColumnId];
      return {
        keySize: table.primaryKeyColumnIds.length,
        isFirstColumn: keyColumnId === table.columnIds[0],
        name: keyColumn?.name,
        type: keyColumn?.type,
      };
    });

    expect(new Set(primaryKeys.map((key) => JSON.stringify(key)))).toEqual(
      new Set([
        JSON.stringify({
          keySize: 1,
          isFirstColumn: true,
          name: "id",
          type: { kind: "bigint" },
        }),
      ]),
    );
  });

  it("introduces no validation issue", () => {
    expect(validateSchema(makeLargeSchema(STANDARD_LARGE_SCHEMA))).toEqual([]);
  });

  it("returns the same document for the same input", () => {
    expect(makeLargeSchema(STANDARD_LARGE_SCHEMA)).toEqual(
      makeLargeSchema({ tables: 100, columnsPerTable: 15, relations: 150 }),
    );
  });
});
