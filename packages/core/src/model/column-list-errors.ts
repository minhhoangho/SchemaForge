import type { ColumnId, TableId } from "./ids.js";
import type { SchemaDocument } from "./schema-document.js";

export type ColumnListErrorCode =
  "column-not-found" | "column-not-in-table" | "column-listed-twice";

export type ColumnListError = {
  readonly code: ColumnListErrorCode;
  readonly index: number;
};

// Checked in order: existence, then table ownership, then repetition, so a
// position reports at most one code even when several conditions apply.
function findColumnListErrorCode(
  columns: SchemaDocument["columns"],
  tableId: TableId,
  columnId: ColumnId,
  seenColumnIds: ReadonlySet<ColumnId>,
): ColumnListErrorCode | undefined {
  const column = columns[columnId];
  if (column === undefined) {
    return "column-not-found";
  }
  if (column.tableId !== tableId) {
    return "column-not-in-table";
  }
  if (seenColumnIds.has(columnId)) {
    return "column-listed-twice";
  }
  return undefined;
}

export function findColumnListErrors(
  columns: SchemaDocument["columns"],
  tableId: TableId,
  columnIds: readonly ColumnId[],
): readonly ColumnListError[] {
  const errors: ColumnListError[] = [];
  const seenColumnIds = new Set<ColumnId>();
  columnIds.forEach((columnId, index) => {
    const code = findColumnListErrorCode(
      columns,
      tableId,
      columnId,
      seenColumnIds,
    );
    if (code !== undefined) {
      errors.push({ code, index });
    }
    seenColumnIds.add(columnId);
  });
  return errors;
}
