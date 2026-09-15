import type { ColumnId, TableId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";

function toColumnIdSet(columnIds: readonly ColumnId[]): ReadonlySet<ColumnId> {
  return new Set(columnIds);
}

function areColumnSetsEqual(
  first: ReadonlySet<ColumnId>,
  second: ReadonlySet<ColumnId>,
): boolean {
  if (first.size !== second.size) {
    return false;
  }
  return Array.from(first).every((columnId) => second.has(columnId));
}

function isPrimaryKeyMatch(
  schema: SchemaDocument,
  tableId: TableId,
  columnIdSet: ReadonlySet<ColumnId>,
): boolean {
  const table = schema.tables[tableId];
  if (table === undefined || table.primaryKeyColumnIds.length === 0) {
    return false;
  }
  return areColumnSetsEqual(
    toColumnIdSet(table.primaryKeyColumnIds),
    columnIdSet,
  );
}

function isSingleUniqueColumnMatch(
  schema: SchemaDocument,
  tableId: TableId,
  columnIdSet: ReadonlySet<ColumnId>,
): boolean {
  if (columnIdSet.size !== 1) {
    return false;
  }
  const [columnId] = Array.from(columnIdSet);
  if (columnId === undefined) {
    return false;
  }
  const column = schema.columns[columnId];
  return column?.tableId === tableId && column.isUnique;
}

function isUniqueIndexMatch(
  schema: SchemaDocument,
  tableId: TableId,
  columnIdSet: ReadonlySet<ColumnId>,
): boolean {
  return Object.values(schema.indexes).some(
    (index) =>
      index.tableId === tableId &&
      index.isUnique &&
      areColumnSetsEqual(toColumnIdSet(index.columnIds), columnIdSet),
  );
}

/**
 * Returns whether `columnIds` (compared as a set) is unique on `tableId`:
 * it equals the table's primary key column set, is a single column marked
 * `isUnique`, or equals the column set of a unique index on the table.
 */
export function isUniqueColumnSet(
  schema: SchemaDocument,
  tableId: TableId,
  columnIds: readonly ColumnId[],
): boolean {
  if (columnIds.length === 0) {
    return false;
  }
  const columnIdSet = toColumnIdSet(columnIds);
  return (
    isPrimaryKeyMatch(schema, tableId, columnIdSet) ||
    isSingleUniqueColumnMatch(schema, tableId, columnIdSet) ||
    isUniqueIndexMatch(schema, tableId, columnIdSet)
  );
}
