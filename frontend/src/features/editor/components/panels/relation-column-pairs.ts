import type {
  Column,
  ColumnPair,
  SchemaDocument,
  TableId,
} from "@schemaforge/core";

export type PairSide = keyof ColumnPair;

/** Columns of a table in the table's own column order. */
export function columnsOfTable(
  schema: SchemaDocument,
  tableId: TableId,
): readonly Column[] {
  const table = schema.tables[tableId];
  if (table === undefined) {
    return [];
  }
  return table.columnIds.flatMap((columnId) => {
    const column = schema.columns[columnId];
    return column === undefined ? [] : [column];
  });
}

/**
 * Columns one pair may pick on one side: core rejects a column listed twice on
 * the same side, so columns other pairs already use are left out.
 */
export function selectableColumns(
  columns: readonly Column[],
  columnPairs: readonly ColumnPair[],
  side: PairSide,
  pairIndex: number,
): readonly Column[] {
  const usedColumnIds = new Set(
    columnPairs
      .filter((_, index) => index !== pairIndex)
      .map((pair) => pair[side]),
  );
  return columns.filter((column) => !usedColumnIds.has(column.id));
}

function firstUnusedColumn(
  columns: readonly Column[],
  columnPairs: readonly ColumnPair[],
  side: PairSide,
): Column | undefined {
  return selectableColumns(columns, columnPairs, side, columnPairs.length)[0];
}

/**
 * The pair "Add column pair" appends: the first column not yet paired on each
 * side, or `null` when one side has none left.
 */
export function buildNextColumnPair(
  fromColumns: readonly Column[],
  toColumns: readonly Column[],
  columnPairs: readonly ColumnPair[],
): ColumnPair | null {
  const fromColumn = firstUnusedColumn(
    fromColumns,
    columnPairs,
    "fromColumnId",
  );
  const toColumn = firstUnusedColumn(toColumns, columnPairs, "toColumnId");
  if (fromColumn === undefined || toColumn === undefined) {
    return null;
  }
  return { fromColumnId: fromColumn.id, toColumnId: toColumn.id };
}
