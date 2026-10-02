import {
  applyOperation,
  createEmptySchema,
  sortTables,
} from "@schemaforge/core";
import type {
  Column,
  Operation,
  SchemaDocument,
  SqlDialect,
} from "@schemaforge/core";
import {
  createNamingEdgeSchema,
  createSampleSchema,
  createTargetLimitSchema,
} from "@schemaforge/core/testing";

export type ConformanceFixtureName =
  "sample" | "naming-edge" | "target-limit" | "empty";

export type ConformanceFixture = {
  readonly name: ConformanceFixtureName;
  readonly schema: SchemaDocument;
};

export function listConformanceFixtures(): readonly ConformanceFixture[] {
  return [
    { name: "sample", schema: createSampleSchema() },
    { name: "naming-edge", schema: createNamingEdgeSchema() },
    { name: "target-limit", schema: createTargetLimitSchema() },
    { name: "empty", schema: createEmptySchema("Empty") },
  ];
}

// Fixture custom types (geometry, tsvector, ...) need extensions or do not
// exist on every database, so CG-01 and seed SQL swap in a real type of the
// dialect that the safe custom type syntax accepts (plan Issue 3).
export const DIALECT_CUSTOM_TYPES: Readonly<
  Record<
    SqlDialect,
    { readonly typeName: string; readonly defaultLiteral: string }
  >
> = {
  postgresql: { typeName: "inet", defaultLiteral: "127.0.0.1" },
  mysql: { typeName: "YEAR", defaultLiteral: "2024" },
  sqlserver: { typeName: "money", defaultLiteral: "12.50" },
};

function toDialectCustomType(column: Column, dialect: SqlDialect): Operation {
  const { typeName, defaultLiteral } = DIALECT_CUSTOM_TYPES[dialect];
  return {
    type: "updateColumn",
    columnId: column.id,
    changes: {
      type: { kind: "custom", name: typeName },
      ...(column.defaultValue?.kind === "literal"
        ? { defaultValue: { kind: "literal", value: defaultLiteral } }
        : {}),
    },
  };
}

export function withDialectCustomTypes(
  schema: SchemaDocument,
  dialect: SqlDialect,
): SchemaDocument {
  const operations = sortTables(schema).flatMap((table) =>
    table.columnIds.flatMap((columnId) => {
      const column = schema.columns[columnId];
      return column?.type.kind === "custom"
        ? [toDialectCustomType(column, dialect)]
        : [];
    }),
  );
  const result = applyOperation(schema, { type: "batch", operations });
  if (!result.isOk) {
    throw new Error(
      `Cannot apply dialect custom types: ${result.error.code} at ${JSON.stringify(result.error.path)}`,
    );
  }
  return result.value.schema;
}
