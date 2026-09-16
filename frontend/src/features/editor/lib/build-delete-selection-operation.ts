import type { Operation } from "@schemaforge/core";

import type { Selection } from "./selection";
import { isSelectionEmpty } from "./selection";

/**
 * Builds the single batch behind deleting the current selection, or `null`
 * when nothing is selected. Relations go first, so a relation attached to a
 * table that is also selected is not removed twice.
 */
export function buildDeleteSelectionOperation(
  selection: Selection,
): Operation | null {
  if (isSelectionEmpty(selection)) {
    return null;
  }

  const removeRelations: readonly Operation[] = selection.relationIds.map(
    (relationId) => ({ type: "removeRelation", relationId }),
  );
  const removeTables: readonly Operation[] = selection.tableIds.map(
    (tableId) => ({ type: "removeTable", tableId }),
  );

  return { type: "batch", operations: [...removeRelations, ...removeTables] };
}
