import type { DocumentPath } from "../document-path.js";
import type { OperationError } from "../error-codes.js";
import { findColumnListErrors } from "../model/column-list-errors.js";
import type { ColumnId, TableId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";

/**
 * Checks a column list against `tableId`, returning the first error of
 * `findColumnListErrors` with its path extended by the index, or `null` when
 * every column is valid.
 */
export function checkColumnList(
  schema: SchemaDocument,
  tableId: TableId,
  columnIds: readonly ColumnId[],
  path: DocumentPath,
): OperationError | null {
  const firstError = findColumnListErrors(
    schema.columns,
    tableId,
    columnIds,
  )[0];
  if (firstError === undefined) {
    return null;
  }
  return { code: firstError.code, path: [...path, firstError.index] };
}
