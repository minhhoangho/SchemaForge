import type { ColumnId, EnumId, TableId } from "../../model/ids.js";
import {
  sortEnums,
  sortIndexes,
  sortRelations,
  sortTables,
} from "../../model/ordering.js";
import type { Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Index } from "../../model/table-index.js";
import type { Table } from "../../model/table.js";
import { createDiagnostic } from "../shared/diagnostics.js";
import type { SqlDialect } from "../shared/generator-types.js";
import { toCamelCaseIdentifier } from "../shared/identifiers.js";
import { createNameAllocator } from "../shared/name-allocator.js";
import type { RelationFieldNames } from "../shared/relation-field-names.js";
import {
  allocateModelNames,
  buildRelationFieldNames,
} from "../shared/relation-field-names.js";
import type {
  Diagnosed,
  SqlDdlContext,
} from "../shared/sql-ddl-model-context.js";
import { createSqlDdlContext } from "../shared/sql-ddl-model-context.js";

// Prisma scalar type names and the generated client class (spec section 5).
export const PRISMA_RESERVED_WORDS: readonly string[] = [
  "String",
  "Boolean",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "DateTime",
  "Json",
  "Bytes",
  "Unsupported",
  "PrismaClient",
];

const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const ENUM_VALUE_FALLBACK = "value";

/** Everything the Prisma blocks read, computed once per call. */
export type PrismaContext = {
  readonly schema: SchemaDocument;
  readonly provider: SqlDialect;
  // Types, dropped constraints, constraint names, MySQL renames and SQL Server
  // cascade conflicts, shared with the SQL generator of the same dialect.
  readonly sql: SqlDdlContext;
  readonly enumNames: ReadonlyMap<EnumId, string>;
  readonly modelNames: ReadonlyMap<TableId, string>;
  readonly fields: RelationFieldNames;
  readonly enumValueNames: ReadonlyMap<EnumId, readonly string[]>;
  // Relations written as fields: every relation that was not dropped.
  readonly relations: readonly Relation[];
  readonly indexesByTable: ReadonlyMap<TableId, readonly Index[]>;
  readonly ignoredTableIds: ReadonlySet<TableId>;
};

/** Prisma names for enum values: identifiers stay, others become camelCase. */
export function allocateEnumValueNames(
  values: readonly string[],
): readonly string[] {
  const allocator = createNameAllocator({
    reserved: [],
    comparison: "exact",
    separator: "",
    maxBytes: null,
  });
  return values.map((value) =>
    allocator.allocate(
      IDENTIFIER_PATTERN.test(value)
        ? value
        : toCamelCaseIdentifier(value, ENUM_VALUE_FALLBACK),
    ),
  );
}

function groupIndexesByTable(
  schema: SchemaDocument,
): ReadonlyMap<TableId, readonly Index[]> {
  const groups = new Map<TableId, Index[]>();
  for (const index of sortIndexes(schema)) {
    groups.set(index.tableId, [...(groups.get(index.tableId) ?? []), index]);
  }
  return groups;
}

// A key identifies a row for Prisma only when every column is required and
// not Unsupported (spec section 4, `table-without-identifier`).
function hasIdentifier(
  sql: SqlDdlContext,
  table: Table,
  indexes: readonly Index[],
): boolean {
  const { schema, dropped } = sql;
  const isIdentifying = (columnIds: readonly ColumnId[]): boolean =>
    columnIds.length > 0 &&
    columnIds.every((columnId) => {
      const column = schema.columns[columnId];
      return (
        column !== undefined &&
        !column.isNullable &&
        column.type.kind !== "custom"
      );
    });
  const keys: readonly (readonly ColumnId[])[] = [
    dropped.primaryKeyTableIds.has(table.id) ? [] : table.primaryKeyColumnIds,
    ...table.columnIds
      .filter(
        (columnId) =>
          schema.columns[columnId]?.isUnique === true &&
          !dropped.uniqueColumnIds.has(columnId),
      )
      .map((columnId) => [columnId]),
    ...indexes
      .filter((index) => index.isUnique && !dropped.indexIds.has(index.id))
      .map((index) => index.columnIds),
  ];
  return keys.some(isIdentifying);
}

export function createPrismaContext(
  schema: SchemaDocument,
  provider: SqlDialect,
): Diagnosed<PrismaContext> {
  const sql = createSqlDdlContext(schema, provider);
  const { enumNames, tableNames } = allocateModelNames(
    schema,
    PRISMA_RESERVED_WORDS,
  );
  const indexesByTable = groupIndexesByTable(schema);
  const ignoredTables = sortTables(schema).filter(
    (table) =>
      !hasIdentifier(sql.value, table, indexesByTable.get(table.id) ?? []),
  );
  return {
    value: {
      schema,
      provider,
      sql: sql.value,
      enumNames,
      modelNames: tableNames,
      fields: buildRelationFieldNames(schema, tableNames),
      enumValueNames: new Map(
        sortEnums(schema).map((element) => [
          element.id,
          allocateEnumValueNames(element.values),
        ]),
      ),
      relations: sortRelations(schema).filter(
        (relation) => !sql.value.dropped.relationIds.has(relation.id),
      ),
      indexesByTable,
      ignoredTableIds: new Set(ignoredTables.map((table) => table.id)),
    },
    diagnostics: [
      ...sql.diagnostics,
      ...ignoredTables.map((table) =>
        createDiagnostic("table-without-identifier", ["tables", table.id]),
      ),
    ],
  };
}
