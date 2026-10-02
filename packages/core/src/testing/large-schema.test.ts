import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../model/schema-document.js";
import { validateSchema } from "../validation/validate-schema.js";
import { createLargeSchema } from "./large-schema.js";

const BENCHMARK_TABLE_COUNT = 200;
const VALIDATION_TIMEOUT_MS = 30_000;

function tableName(schema: SchemaDocument, tableId: string): string {
  return (
    Object.values(schema.tables).find((table) => table.id === tableId)?.name ??
    tableId
  );
}

// "from -> to onDelete (column pair count)" for every relation.
function describeRelations(schema: SchemaDocument): readonly string[] {
  return Object.values(schema.relations).map(
    (relation) =>
      `${tableName(schema, relation.fromTableId)} -> ${tableName(schema, relation.toTableId)} ${relation.onDelete} (${String(relation.columnPairs.length)})`,
  );
}

describe("createLargeSchema", () => {
  it("creates 200 tables with 20 columns each, 300 relations, 200 indexes and 20 enums", () => {
    const schema = createLargeSchema({ tableCount: BENCHMARK_TABLE_COUNT });

    expect({
      tables: Object.keys(schema.tables).length,
      columnCounts: new Set(
        Object.values(schema.tables).map((table) => table.columnIds.length),
      ),
      columns: Object.keys(schema.columns).length,
      relations: Object.keys(schema.relations).length,
      indexes: Object.keys(schema.indexes).length,
      enums: Object.keys(schema.enums).length,
    }).toStrictEqual({
      tables: 200,
      columnCounts: new Set([20]),
      columns: 4000,
      relations: 300,
      indexes: 200,
      enums: 20,
    });
  });

  it(
    "has no semantic issues at 200 tables",
    () => {
      expect(
        validateSchema(
          createLargeSchema({ tableCount: BENCHMARK_TABLE_COUNT }),
        ),
      ).toStrictEqual([]);
    },
    VALIDATION_TIMEOUT_MS,
  );

  it("contains a composite foreign key and a relation cycle", () => {
    expect(
      describeRelations(createLargeSchema({ tableCount: 3 })).toSorted(),
    ).toStrictEqual([
      "table_000 -> table_001 cascade (1)",
      "table_000 -> table_001 noAction (1)",
      "table_001 -> table_002 cascade (1)",
      "table_002 -> table_000 cascade (2)",
    ]);
  });

  // A ring of required keys would leave the seed benchmark no table to load.
  it("makes the foreign key columns of the cascade ring nullable", () => {
    const schema = createLargeSchema({ tableCount: 3 });
    const ringColumnNullability = Object.values(schema.relations)
      .filter((relation) => relation.onDelete === "cascade")
      .flatMap((relation) => relation.columnPairs)
      .map((pair) => schema.columns[pair.fromColumnId]?.isNullable);

    expect(ringColumnNullability).toStrictEqual([true, true, true, true]);
  });

  it("references the table seven ahead from every even table", () => {
    expect(describeRelations(createLargeSchema({ tableCount: 10 }))).toEqual(
      expect.arrayContaining([
        "table_000 -> table_007 noAction (1)",
        "table_004 -> table_001 noAction (1)",
        "table_008 -> table_005 noAction (1)",
      ]),
    );
  });

  it("marks every fourth index as unique", () => {
    const indexes = Object.values(
      createLargeSchema({ tableCount: 8 }).indexes,
    ).map((index) => `${index.name} ${String(index.isUnique)}`);

    expect(indexes.toSorted()).toStrictEqual([
      "index_000 false",
      "index_001 false",
      "index_002 false",
      "index_003 true",
      "index_004 false",
      "index_005 false",
      "index_006 false",
      "index_007 true",
    ]);
  });

  it("returns structurally equal schemas on every call", () => {
    expect(createLargeSchema({ tableCount: 12 })).toStrictEqual(
      createLargeSchema({ tableCount: 12 }),
    );
  });

  it.each([1, 0, -4, 2.5, Number.NaN])(
    "throws RangeError for a table count below 2 or not an integer (%s)",
    (tableCount) => {
      expect(() => createLargeSchema({ tableCount })).toThrow(RangeError);
    },
  );
});
