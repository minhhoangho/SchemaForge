import type { ColumnType } from "../../model/column-type.js";
import type { EnumId, TableId } from "../../model/ids.js";
import { sortEnums, sortRelations, sortTables } from "../../model/ordering.js";
import type { Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { resolveSchemaColumnTypes } from "../shared/dialect-column-types.js";
import { findUnindexableConstraints } from "../shared/dialect-constraints.js";
import type { GeneratorOptions } from "../shared/generator-types.js";
import {
  toCamelCaseIdentifier,
  withReservedWordSuffix,
} from "../shared/identifiers.js";
import { JAVASCRIPT_RESERVED_WORDS } from "../shared/javascript-reserved-words.js";
import { createNameAllocator } from "../shared/name-allocator.js";
import type { RelationFieldNames } from "../shared/relation-field-names.js";
import { buildRelationFieldNames } from "../shared/relation-field-names.js";

export type DrizzleDialect = GeneratorOptions["drizzle"]["dialect"];

// Every name the output may import from the dialect's core module, sorted with
// `<`; the whole list is reserved so variable names do not change with the
// schema (plan Task 18). The type name is the table config callback's
// annotation (R21).
export const DRIZZLE_IMPORT_NAMES: Readonly<
  Record<DrizzleDialect, readonly string[]>
> = {
  postgresql: [
    "PgTableExtraConfigValue",
    "bigint",
    "boolean",
    "char",
    "customType",
    "date",
    "doublePrecision",
    "foreignKey",
    "index",
    "integer",
    "jsonb",
    "numeric",
    "pgEnum",
    "pgTable",
    "primaryKey",
    "real",
    "smallint",
    "text",
    "time",
    "timestamp",
    "unique",
    "uniqueIndex",
    "uuid",
    "varchar",
  ],
  mysql: [
    "MySqlTableExtraConfigValue",
    "bigint",
    "boolean",
    "char",
    "customType",
    "date",
    "datetime",
    "decimal",
    "double",
    "float",
    "foreignKey",
    "index",
    "int",
    "json",
    "longtext",
    "mysqlEnum",
    "mysqlTable",
    "primaryKey",
    "smallint",
    "time",
    "timestamp",
    "unique",
    "uniqueIndex",
    "varchar",
  ],
};

// Imports from "drizzle-orm", and callback parameters that would shadow a
// module variable of the same name.
const OUTPUT_NAMES: readonly string[] = [
  "relations",
  "sql",
  "table",
  "one",
  "many",
];

// The `dataType` of the customType that stands for a binary column.
export const BINARY_DATA_TYPES: Readonly<Record<DrizzleDialect, string>> = {
  postgresql: "bytea",
  mysql: "longblob",
};

export type DrizzleVariableNames = {
  // PostgreSQL only.
  readonly enumVariables: ReadonlyMap<EnumId, string>;
  // Keyed by `dataType`: "bytea", "longblob" or the custom type name.
  readonly customTypeVariables: ReadonlyMap<string, string>;
  readonly tableVariables: ReadonlyMap<TableId, string>;
  readonly relationsVariables: ReadonlyMap<TableId, string>;
};

/** The `dataType` of the customType a column needs, or null for a builder. */
export function customDataType(
  dialect: DrizzleDialect,
  type: ColumnType,
): string | null {
  if (type.kind === "binary") {
    return BINARY_DATA_TYPES[dialect];
  }
  return type.kind === "custom" ? type.name : null;
}

/**
 * Relations written in `relations()` blocks: every relation whose foreign key
 * is kept, so both its sides are written.
 */
export function listWrittenRelations(
  schema: SchemaDocument,
  dialect: DrizzleDialect,
): readonly Relation[] {
  const types = resolveSchemaColumnTypes(schema, dialect).types;
  const dropped = findUnindexableConstraints(schema, dialect, types);
  return sortRelations(schema).filter(
    (relation) => !dropped.relationIds.has(relation.id),
  );
}

// `one` cannot take `relationName` without `fields` in drizzle-orm 0.45, so
// the inverse side of a named one-to-one relation is left out (Vấn đề 18).
export function hasInverseField(
  fields: RelationFieldNames,
  relation: Relation,
): boolean {
  return (
    relation.kind === "oneToMany" || !fields.relationNames.has(relation.id)
  );
}

function tablesWithRelationFields(
  relations: readonly Relation[],
  fields: RelationFieldNames,
): ReadonlySet<TableId> {
  return new Set(
    relations.flatMap((relation) => [
      relation.fromTableId,
      ...(hasInverseField(fields, relation) ? [relation.toTableId] : []),
    ]),
  );
}

function listCustomDataTypes(
  schema: SchemaDocument,
  dialect: DrizzleDialect,
): readonly string[] {
  const dataTypes = sortTables(schema).flatMap((table) =>
    table.columnIds.flatMap((columnId) => {
      const column = schema.columns[columnId];
      return column === undefined
        ? []
        : (customDataType(dialect, column.type) ?? []);
    }),
  );
  return [...new Set(dataTypes)];
}

/** Exported variable names, in one case-sensitive namespace (spec section 5). */
export function allocateDrizzleVariableNames(
  schema: SchemaDocument,
  dialect: DrizzleDialect,
): DrizzleVariableNames {
  const allocator = createNameAllocator({
    reserved: [
      ...JAVASCRIPT_RESERVED_WORDS,
      ...DRIZZLE_IMPORT_NAMES[dialect],
      ...OUTPUT_NAMES,
    ],
    comparison: "exact",
    separator: "",
    maxBytes: null,
  });
  const allocate = (candidate: string): string =>
    allocator.allocate(
      withReservedWordSuffix(candidate, JAVASCRIPT_RESERVED_WORDS),
    );
  const enumVariables = new Map(
    (dialect === "postgresql" ? sortEnums(schema) : []).map((element) => [
      element.id,
      allocate(`${toCamelCaseIdentifier(element.name, "enum")}Enum`),
    ]),
  );
  const customTypeVariables = new Map(
    listCustomDataTypes(schema, dialect).map((dataType) => [
      dataType,
      allocate(`${toCamelCaseIdentifier(dataType, "custom")}Type`),
    ]),
  );
  const tables = sortTables(schema);
  const tableVariables = new Map(
    tables.map((table) => [
      table.id,
      allocate(toCamelCaseIdentifier(table.name, "table")),
    ]),
  );
  const withFields = tablesWithRelationFields(
    listWrittenRelations(schema, dialect),
    buildRelationFieldNames(schema, tableVariables),
  );
  const relationsVariables = new Map(
    tables
      .filter((table) => withFields.has(table.id))
      .map((table) => [
        table.id,
        allocate(`${tableVariables.get(table.id) ?? ""}Relations`),
      ]),
  );
  return {
    enumVariables,
    customTypeVariables,
    tableVariables,
    relationsVariables,
  };
}
