import type { ColumnId, RelationId } from "../../model/ids.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Index } from "../../model/table-index.js";
import type { SchemaConstraintNames } from "./constraint-names.js";
import { allocateConstraintNames } from "./constraint-names.js";
import { resolveSchemaColumnTypes } from "./dialect-column-types.js";
import type { DroppedConstraints } from "./dialect-constraints.js";
import { findUnindexableConstraints } from "./dialect-constraints.js";
import type { DialectColumnType } from "./dialect-types.js";
import type { GeneratorDiagnostic, SqlDialect } from "./generator-types.js";
import { allocateMysqlNames } from "./mysql-identifiers.js";
import {
  findCascadeConflicts,
  orderColumnPairsByReferencedKey,
} from "./relation-graph.js";

export type Diagnosed<Value> = {
  readonly value: Value;
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

/** What every part of the SQL DDL model reads, computed once per call. */
export type SqlDdlContext = {
  readonly schema: SchemaDocument;
  readonly dialect: SqlDialect;
  readonly types: ReadonlyMap<ColumnId, DialectColumnType>;
  readonly dropped: DroppedConstraints;
  readonly names: SchemaConstraintNames;
  // The single lookup for written column names: renamed on MySQL, else the original.
  readonly columnName: (columnId: ColumnId) => string | undefined;
  readonly indexName: (index: Index) => string;
  // SQL Server only: relations written with NO ACTION for both events.
  readonly cascadeConflicts: ReadonlySet<RelationId>;
};

export function columnNamesOf(
  context: SqlDdlContext,
  columnIds: readonly ColumnId[],
): readonly string[] {
  return columnIds.flatMap((columnId) => context.columnName(columnId) ?? []);
}

export function createSqlDdlContext(
  schema: SchemaDocument,
  dialect: SqlDialect,
): Diagnosed<SqlDdlContext> {
  const types = resolveSchemaColumnTypes(schema, dialect);
  const dropped = findUnindexableConstraints(schema, dialect, types.types);
  const names = allocateConstraintNames(schema, (relation) =>
    orderColumnPairsByReferencedKey(schema, relation),
  );
  const mysqlNames = dialect === "mysql" ? allocateMysqlNames(schema) : null;
  return {
    value: {
      schema,
      dialect,
      types: types.types,
      dropped,
      names,
      columnName: (columnId) =>
        mysqlNames?.columnNames.get(columnId) ?? schema.columns[columnId]?.name,
      indexName: (index) => mysqlNames?.indexNames.get(index.id) ?? index.name,
      cascadeConflicts: new Set(
        dialect === "sqlserver" ? findCascadeConflicts(schema) : [],
      ),
    },
    diagnostics: [
      ...types.diagnostics,
      ...dropped.diagnostics,
      ...(mysqlNames?.diagnostics ?? []),
    ],
  };
}
