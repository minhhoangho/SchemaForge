import { describe, expect, it } from "vitest";

import { generatePrisma } from "../../generators/prisma/generate-prisma.js";
import type { ColumnType } from "../../model/column-type.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { createImportTestOptions } from "../../testing/import-test-options.js";
import { createNamingEdgeSchema } from "../../testing/naming-edge-schema.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { createTargetLimitSchema } from "../../testing/target-limit-schema.js";
import { toComparableSchema } from "../../testing/to-comparable-schema.js";
import { unwrapOk } from "../../testing/unwrap-result.js";
import { withoutPrismaLosses } from "./fixtures/db-pull.fixture.js";
import { importPrisma } from "./import-prisma.js";

const FIXTURES: readonly (readonly [string, () => SchemaDocument])[] = [
  ["sample", createSampleSchema],
  ["naming edge", createNamingEdgeSchema],
  ["target limit", createTargetLimitSchema],
];

// The PostgreSQL generator clamps these parameters to the database limits and
// reports type-parameter-out-of-range for each (generator snapshot
// target-limit.postgresql.diagnostics.txt), so the import reads the clamped
// types. Only the target limit schema has columns with these names.
const POSTGRESQL_CLAMPED_TYPES: ReadonlyMap<string, ColumnType> = new Map([
  ["pg_varchar", { kind: "text" }],
  ["pg_decimal", { kind: "decimal", precision: 1000, scale: 2 }],
]);

function withClampedTypes(schema: SchemaDocument): SchemaDocument {
  return {
    ...schema,
    columns: Object.fromEntries(
      Object.entries(schema.columns).map(([id, column]) => [
        id,
        {
          ...column,
          type: POSTGRESQL_CLAMPED_TYPES.get(column.name) ?? column.type,
        },
      ]),
    ),
  };
}

const FIXED_POINT_CASES = (["mysql", "sqlserver"] as const).flatMap(
  (provider) =>
    FIXTURES.map(([name, create]) => [provider, name, create] as const),
);

describe("importPrisma round trip", () => {
  it.each(FIXTURES)(
    "imports the postgresql output of the %s schema back to that schema",
    (_, create) => {
      const schema = create();
      const source = generatePrisma(schema, { provider: "postgresql" }).file
        .content;

      const imported = unwrapOk(
        importPrisma(source, {
          ...createImportTestOptions(),
          fallbackSchemaName: schema.name,
        }),
      );

      expect({
        document: toComparableSchema(imported.document),
        diagnostics: imported.diagnostics,
      }).toStrictEqual({
        document: toComparableSchema(
          withClampedTypes(withoutPrismaLosses(schema, schema.name)),
        ),
        diagnostics: [],
      });
    },
  );

  it.each(FIXED_POINT_CASES)(
    "regenerates the %s output of the %s schema unchanged",
    (provider, _, create) => {
      const source = generatePrisma(create(), { provider }).file.content;

      const imported = unwrapOk(
        importPrisma(source, createImportTestOptions()),
      );

      expect(generatePrisma(imported.document, { provider }).file.content).toBe(
        source,
      );
    },
  );
});
