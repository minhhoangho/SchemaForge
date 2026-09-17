import { sortTables } from "@schemaforge/core";
import type {
  ColumnId,
  ColumnPair,
  ReferentialAction,
  SchemaDocument,
  Table,
  TableId,
} from "@schemaforge/core";

import { parseHandleId } from "./handle-ids";
import type { ParsedHandle } from "./handle-ids";
import { suggestJunctionTableName } from "./name-suggestions";

export type RelationDraftKind = "oneToMany" | "oneToOne" | "manyToMany";

export type ForeignKeyMode = "new-columns" | "existing-columns";

export type RelationDraft = {
  readonly fromTableId: TableId;
  readonly toTableId: TableId;
  readonly kind: RelationDraftKind;
  readonly foreignKeyMode: ForeignKeyMode;
  readonly referencedColumnIds: readonly ColumnId[];
  readonly columnPairs: readonly ColumnPair[];
  readonly junctionTableName: string;
  readonly onDelete: ReferentialAction;
  readonly onUpdate: ReferentialAction;
};

export type RelationConnection = {
  readonly source: string | null;
  readonly target: string | null;
  readonly sourceHandle: string | null;
  readonly targetHandle: string | null;
};

const DEFAULT_ACTION = "noAction" satisfies ReferentialAction;

/**
 * Core maps are keyed by template literal ids, so a plain string key (a handle
 * part, a select value) needs this helper instead of a cast (plan issue 27).
 */
export function lookup<Value>(
  elements: Readonly<Record<string, Value>>,
  elementId: string | null,
): Value | undefined {
  return elementId === null ? undefined : elements[elementId];
}

/** The defaults for a pair of tables: new columns against the primary key. */
function createDefaultDraft(
  document: SchemaDocument,
  fromTable: Table,
  toTable: Table,
  kind: RelationDraftKind,
): RelationDraft {
  return {
    fromTableId: fromTable.id,
    toTableId: toTable.id,
    kind,
    foreignKeyMode: "new-columns",
    referencedColumnIds: toTable.primaryKeyColumnIds,
    columnPairs: [],
    junctionTableName: suggestJunctionTableName(document, {
      leftTableName: fromTable.name,
      rightTableName: toTable.name,
    }),
    onDelete: DEFAULT_ACTION,
    onUpdate: DEFAULT_ACTION,
  };
}

/** The column a handle belongs to, or `null` for a table header handle. */
function findHandleColumnId(
  document: SchemaDocument,
  handle: ParsedHandle,
  table: Table,
): ColumnId | null | undefined {
  if (handle.kind === "table") {
    return handle.tableId === table.id ? null : undefined;
  }
  const column = lookup(document.columns, handle.columnId);
  return column?.tableId === table.id ? column.id : undefined;
}

/**
 * Prefills the dialog from a drag between two handles. Dropping on a column
 * references that column, dropping on a header references the primary key;
 * dragging from a column pairs it with the first referenced column.
 */
export function createRelationDraftFromConnection(
  document: SchemaDocument,
  connection: RelationConnection,
): RelationDraft | null {
  const fromTable = lookup(document.tables, connection.source);
  const toTable = lookup(document.tables, connection.target);
  const sourceHandle = parseHandleId(connection.sourceHandle);
  const targetHandle = parseHandleId(connection.targetHandle);
  if (
    fromTable === undefined ||
    toTable === undefined ||
    sourceHandle === null ||
    targetHandle === null
  ) {
    return null;
  }
  const sourceColumnId = findHandleColumnId(document, sourceHandle, fromTable);
  const targetColumnId = findHandleColumnId(document, targetHandle, toTable);
  if (sourceColumnId === undefined || targetColumnId === undefined) {
    return null;
  }
  const draft = createDefaultDraft(document, fromTable, toTable, "oneToMany");
  const referencedColumnIds =
    targetColumnId === null ? draft.referencedColumnIds : [targetColumnId];
  const firstReferencedId = referencedColumnIds[0];
  if (sourceColumnId === null) {
    return { ...draft, referencedColumnIds };
  }
  return {
    ...draft,
    referencedColumnIds,
    foreignKeyMode: "existing-columns",
    columnPairs:
      firstReferencedId === undefined
        ? []
        : [{ fromColumnId: sourceColumnId, toColumnId: firstReferencedId }],
  };
}

/** Prefills the dialog opened by "Add relation" in the table panel. */
export function createRelationDraftFromTable(
  document: SchemaDocument,
  fromTableId: TableId,
): RelationDraft | null {
  const fromTable = document.tables[fromTableId];
  const toTable = sortTables(document).find(
    (table) => table.id !== fromTableId,
  );
  if (fromTable === undefined || toTable === undefined) {
    return null;
  }
  return createDefaultDraft(document, fromTable, toTable, "oneToMany");
}

/** Points the draft at another referenced table, keeping only its kind. */
export function changeTargetTable(
  document: SchemaDocument,
  draft: RelationDraft,
  toTableId: TableId,
): RelationDraft {
  const fromTable = document.tables[draft.fromTableId];
  const toTable = document.tables[toTableId];
  if (fromTable === undefined || toTable === undefined) {
    return draft;
  }
  return createDefaultDraft(document, fromTable, toTable, draft.kind);
}

/** Swaps both tables and rebuilds the defaults for the new direction. */
export function swapRelationDraft(
  document: SchemaDocument,
  draft: RelationDraft,
): RelationDraft {
  return changeTargetTable(
    document,
    { ...draft, fromTableId: draft.toTableId },
    draft.fromTableId,
  );
}

/** Replaces one referenced column; a pair pointing at it follows along. */
export function changeReferencedColumn(
  draft: RelationDraft,
  index: number,
  columnId: ColumnId,
): RelationDraft {
  const previousId = draft.referencedColumnIds[index];
  return {
    ...draft,
    referencedColumnIds: draft.referencedColumnIds.map((current, position) =>
      position === index ? columnId : current,
    ),
    columnPairs: draft.columnPairs.map((pair) =>
      pair.toColumnId === previousId ? { ...pair, toColumnId: columnId } : pair,
    ),
  };
}

/** Pairs a foreign key column with a referenced column, in referenced order. */
export function changePairedColumn(
  draft: RelationDraft,
  referencedColumnId: ColumnId,
  fromColumnId: ColumnId,
): RelationDraft {
  const otherPairs = draft.columnPairs.filter(
    (pair) => pair.toColumnId !== referencedColumnId,
  );
  const columnPairs = [
    ...otherPairs,
    { fromColumnId, toColumnId: referencedColumnId },
  ].toSorted(
    (left, right) =>
      draft.referencedColumnIds.indexOf(left.toColumnId) -
      draft.referencedColumnIds.indexOf(right.toColumnId),
  );
  return { ...draft, columnPairs };
}
