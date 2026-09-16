import type { RelationId, SchemaDocument, TableId } from "@schemaforge/core";

export type Selection = {
  readonly tableIds: readonly TableId[];
  readonly relationIds: readonly RelationId[];
};

export const EMPTY_SELECTION: Selection = { tableIds: [], relationIds: [] };

export function countSelection(selection: Selection): number {
  return selection.tableIds.length + selection.relationIds.length;
}

export function isSelectionEmpty(selection: Selection): boolean {
  return countSelection(selection) === 0;
}

/**
 * Drops ids of elements the document no longer holds. Returns the given
 * selection itself when nothing was dropped, so a Zustand selector comparing
 * by reference does not re-render.
 */
export function filterSelection(
  selection: Selection,
  document: SchemaDocument,
): Selection {
  const tableIds = selection.tableIds.filter(
    (tableId) => document.tables[tableId] !== undefined,
  );
  const relationIds = selection.relationIds.filter(
    (relationId) => document.relations[relationId] !== undefined,
  );

  const hasSameSize =
    tableIds.length === selection.tableIds.length &&
    relationIds.length === selection.relationIds.length;
  return hasSameSize ? selection : { tableIds, relationIds };
}
