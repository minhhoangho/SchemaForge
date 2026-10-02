import type { DocumentPath } from "../../document-path.js";
import type {
  ColumnId,
  IndexId,
  RelationId,
  TableId,
} from "../../model/ids.js";
import {
  sortIndexes,
  sortRelations,
  sortTables,
} from "../../model/ordering.js";
import type { ReferentialAction, Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import type { DialectColumnType } from "./dialect-types.js";
import {
  MYSQL_MAX_KEY_BYTES,
  SQLSERVER_MAX_INDEX_KEY_BYTES,
  SQLSERVER_MAX_PRIMARY_KEY_BYTES,
  mysqlKeyPartBytes,
  sqlServerFixedKeyBytes,
} from "./dialect-types.js";
import { createDiagnostic, finalizeDiagnostics } from "./diagnostics.js";
import type { GeneratorDiagnostic, SqlDialect } from "./generator-types.js";

export type DroppedConstraints = {
  readonly primaryKeyTableIds: ReadonlySet<TableId>;
  readonly uniqueColumnIds: ReadonlySet<ColumnId>;
  readonly indexIds: ReadonlySet<IndexId>;
  readonly relationIds: ReadonlySet<RelationId>;
  // MySQL only: auto-increment columns that need a plain fallback index (error 1075).
  readonly autoIncrementIndexColumnIds: ReadonlySet<ColumnId>;
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

type KeyElement =
  | { readonly kind: "primaryKey"; readonly id: TableId }
  | { readonly kind: "uniqueColumn"; readonly id: ColumnId }
  | { readonly kind: "index"; readonly id: IndexId };

export type KeyConstraint = KeyElement & {
  readonly tableId: TableId;
  readonly columnIds: readonly ColumnId[];
  readonly isUnique: boolean;
  readonly path: DocumentPath;
};

export type ColumnTypes = ReadonlyMap<ColumnId, DialectColumnType>;

function tableKeys(schema: SchemaDocument, table: Table): KeyConstraint[] {
  const primaryKey: KeyConstraint[] =
    table.primaryKeyColumnIds.length === 0
      ? []
      : [
          {
            kind: "primaryKey",
            id: table.id,
            tableId: table.id,
            columnIds: table.primaryKeyColumnIds,
            isUnique: true,
            path: ["tables", table.id, "primaryKeyColumnIds"],
          },
        ];
  const uniqueColumns = table.columnIds
    .filter((columnId) => schema.columns[columnId]?.isUnique === true)
    .map((columnId): KeyConstraint => ({
      kind: "uniqueColumn",
      id: columnId,
      tableId: table.id,
      columnIds: [columnId],
      isUnique: true,
      path: ["columns", columnId, "isUnique"],
    }));
  return [...primaryKey, ...uniqueColumns];
}

export function listKeyConstraints(
  schema: SchemaDocument,
): readonly KeyConstraint[] {
  const indexKeys = sortIndexes(schema).map((index): KeyConstraint => ({
    kind: "index",
    id: index.id,
    tableId: index.tableId,
    columnIds: index.columnIds,
    isUnique: index.isUnique,
    path: ["indexes", index.id],
  }));
  return [
    ...sortTables(schema).flatMap((table) => tableKeys(schema, table)),
    ...indexKeys,
  ];
}

function pairColumnIds(relation: Relation): readonly ColumnId[] {
  return relation.columnPairs.flatMap((pair) => [
    pair.fromColumnId,
    pair.toColumnId,
  ]);
}

/** Primary key, `isUnique`, index and relation pair columns: where `key-column-type-narrowed` applies. */
export function collectKeyColumnIds(
  schema: SchemaDocument,
): ReadonlySet<ColumnId> {
  return new Set([
    ...listKeyConstraints(schema).flatMap((key) => key.columnIds),
    ...sortRelations(schema).flatMap(pairColumnIds),
  ]);
}

export function sumBytes(
  columnIds: readonly ColumnId[],
  types: ColumnTypes,
  measure: (type: DialectColumnType) => number,
): number {
  return columnIds.reduce((total, columnId) => {
    const type = types.get(columnId);
    return total + (type === undefined ? 0 : measure(type));
  }, 0);
}

export function sqlServerKeyLimit(key: KeyConstraint): number {
  return key.kind === "primaryKey"
    ? SQLSERVER_MAX_PRIMARY_KEY_BYTES
    : SQLSERVER_MAX_INDEX_KEY_BYTES;
}

function hasUnindexableType(
  columnIds: readonly ColumnId[],
  types: ColumnTypes,
): boolean {
  return columnIds.some((columnId) => {
    const kind = types.get(columnId)?.kind;
    return kind === "json" || kind === "binary";
  });
}

function isKeyUnindexable(
  dialect: SqlDialect,
  key: KeyConstraint,
  types: ColumnTypes,
): boolean {
  if (hasUnindexableType(key.columnIds, types)) {
    return true;
  }
  if (dialect === "mysql") {
    return (
      sumBytes(key.columnIds, types, mysqlKeyPartBytes) > MYSQL_MAX_KEY_BYTES
    );
  }
  return (
    sumBytes(key.columnIds, types, sqlServerFixedKeyBytes) >
    sqlServerKeyLimit(key)
  );
}

function isSameColumnSet(
  first: readonly ColumnId[],
  second: readonly ColumnId[],
): boolean {
  const firstSet = new Set(first);
  const secondSet = new Set(second);
  return (
    firstSet.size === secondSet.size &&
    [...firstSet].every((columnId) => secondSet.has(columnId))
  );
}

function isRelationUnindexable(
  dialect: SqlDialect,
  relation: Relation,
  types: ColumnTypes,
  droppedKeys: readonly KeyConstraint[],
): boolean {
  const fromColumnIds = relation.columnPairs.map((pair) => pair.fromColumnId);
  const toColumnIds = relation.columnPairs.map((pair) => pair.toColumnId);
  const isTooLong =
    dialect === "mysql" &&
    sumBytes(fromColumnIds, types, mysqlKeyPartBytes) > MYSQL_MAX_KEY_BYTES;
  const isReferencingDroppedKey = droppedKeys.some(
    (key) =>
      key.isUnique &&
      key.tableId === relation.toTableId &&
      isSameColumnSet(key.columnIds, toColumnIds),
  );
  return (
    hasUnindexableType(pairColumnIds(relation), types) ||
    isTooLong ||
    isReferencingDroppedKey
  );
}

function findAutoIncrementIndexColumnIds(
  schema: SchemaDocument,
  keptKeys: readonly KeyConstraint[],
): ReadonlySet<ColumnId> {
  const leadingColumnIds = new Set(keptKeys.map((key) => key.columnIds[0]));
  return new Set(
    sortTables(schema).flatMap((table) =>
      table.columnIds.filter(
        (columnId) =>
          schema.columns[columnId]?.isAutoIncrement === true &&
          !leadingColumnIds.has(columnId),
      ),
    ),
  );
}

function droppedKeyIds(
  droppedKeys: readonly KeyConstraint[],
): Pick<
  DroppedConstraints,
  "primaryKeyTableIds" | "uniqueColumnIds" | "indexIds"
> {
  return {
    primaryKeyTableIds: new Set(
      droppedKeys.flatMap((key) => (key.kind === "primaryKey" ? [key.id] : [])),
    ),
    uniqueColumnIds: new Set(
      droppedKeys.flatMap((key) =>
        key.kind === "uniqueColumn" ? [key.id] : [],
      ),
    ),
    indexIds: new Set(
      droppedKeys.flatMap((key) => (key.kind === "index" ? [key.id] : [])),
    ),
  };
}

/** Keys, indexes and relations MySQL or SQL Server cannot index, dropped with a diagnostic each (spec section 4). */
export function findUnindexableConstraints(
  schema: SchemaDocument,
  dialect: SqlDialect,
  types: ColumnTypes,
): DroppedConstraints {
  const isPostgresql = dialect === "postgresql";
  const keys = isPostgresql ? [] : listKeyConstraints(schema);
  const droppedKeys = keys.filter((key) =>
    isKeyUnindexable(dialect, key, types),
  );
  const droppedRelations = isPostgresql
    ? []
    : sortRelations(schema).filter((relation) =>
        isRelationUnindexable(dialect, relation, types, droppedKeys),
      );
  const keptKeys = keys.filter((key) => !droppedKeys.includes(key));
  return {
    ...droppedKeyIds(droppedKeys),
    relationIds: new Set(droppedRelations.map((relation) => relation.id)),
    autoIncrementIndexColumnIds:
      dialect === "mysql"
        ? findAutoIncrementIndexColumnIds(schema, keptKeys)
        : new Set(),
    diagnostics: finalizeDiagnostics(
      [
        ...droppedKeys.map((key) => key.path),
        ...droppedRelations.map((relation) => ["relations", relation.id]),
      ].map((path) => createDiagnostic("key-column-type-not-indexable", path)),
    ),
  };
}

/** MySQL rejects SET DEFAULT (lossy); SQL Server NO ACTION equals RESTRICT. Cascade cycles are Task 11's. */
export function resolveReferentialAction(
  dialect: SqlDialect,
  action: ReferentialAction,
): { readonly action: ReferentialAction; readonly isLossy: boolean } {
  if (dialect === "mysql" && action === "setDefault") {
    return { action: "noAction", isLossy: true };
  }
  if (dialect === "sqlserver" && action === "restrict") {
    return { action: "noAction", isLossy: false };
  }
  return { action, isLossy: false };
}

/** SQL Server unique on nullable columns: filtered index, unless a foreign key needs a real UNIQUE. */
export function resolveSqlServerUnique(
  schema: SchemaDocument,
  tableId: TableId,
  columnIds: readonly ColumnId[],
): {
  readonly mode: "plain" | "filtered";
  readonly isNullsRestricted: boolean;
} {
  const hasNullable = columnIds.some(
    (columnId) => schema.columns[columnId]?.isNullable === true,
  );
  if (!hasNullable) {
    return { mode: "plain", isNullsRestricted: false };
  }
  const isReferenced = sortRelations(schema).some(
    (relation) =>
      relation.toTableId === tableId &&
      isSameColumnSet(
        relation.columnPairs.map((pair) => pair.toColumnId),
        columnIds,
      ),
  );
  return isReferenced
    ? { mode: "plain", isNullsRestricted: true }
    : { mode: "filtered", isNullsRestricted: false };
}
