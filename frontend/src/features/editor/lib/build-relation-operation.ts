import {
  buildManyToMany,
  buildRelation,
  createRelationId,
} from "@schemaforge/core";
import type {
  GenerateId,
  Operation,
  OperationError,
  Position,
  Result,
  SchemaDocument,
} from "@schemaforge/core";

import type { RelationDraft } from "./to-relation-draft";

export type RelationDraftError =
  | {
      readonly field: "referencedColumnIds";
      readonly reason: "primary-key-missing" | "duplicate-column";
    }
  | {
      readonly field: "columnPairs";
      readonly reason: "unmatched-column" | "duplicate-column";
    };

const MIDPOINT_DIVISOR = 2;

function midpoint(left: Position, right: Position): Position {
  return {
    x: (left.x + right.x) / MIDPOINT_DIVISOR,
    y: (left.y + right.y) / MIDPOINT_DIVISOR,
  };
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function validateReferencedColumns(
  document: SchemaDocument,
  draft: RelationDraft,
): readonly RelationDraftError[] {
  if (draft.kind === "manyToMany") {
    const isKeyMissing = [draft.fromTableId, draft.toTableId].some(
      (tableId) => document.tables[tableId]?.primaryKeyColumnIds.length === 0,
    );
    return isKeyMissing
      ? [{ field: "referencedColumnIds", reason: "primary-key-missing" }]
      : [];
  }
  return [
    ...(draft.referencedColumnIds.length === 0
      ? [
          {
            field: "referencedColumnIds",
            reason: "primary-key-missing",
          } as const,
        ]
      : []),
    // Both modes: core rejects a referenced column listed twice.
    ...(hasDuplicates(draft.referencedColumnIds)
      ? [{ field: "referencedColumnIds", reason: "duplicate-column" } as const]
      : []),
  ];
}

function validateColumnPairs(
  draft: RelationDraft,
): readonly RelationDraftError[] {
  if (draft.kind === "manyToMany" || draft.foreignKeyMode === "new-columns") {
    return [];
  }
  const pairedIds = new Set(draft.columnPairs.map((pair) => pair.toColumnId));
  const isUnmatched = draft.referencedColumnIds.some(
    (columnId) => !pairedIds.has(columnId),
  );
  const isDuplicate = hasDuplicates(
    draft.columnPairs.map((pair) => pair.fromColumnId),
  );
  return [
    ...(isUnmatched
      ? [{ field: "columnPairs", reason: "unmatched-column" } as const]
      : []),
    ...(isDuplicate
      ? [{ field: "columnPairs", reason: "duplicate-column" } as const]
      : []),
  ];
}

/**
 * The cases the dialog blocks (spec section 3): nothing to reference, a
 * referenced column left unpaired, or a column chosen twice. A type mismatch
 * or a target that is not unique is allowed and shows up as a schema issue.
 */
export function validateRelationDraft(
  document: SchemaDocument,
  draft: RelationDraft,
): readonly RelationDraftError[] {
  return [
    ...validateReferencedColumns(document, draft),
    ...validateColumnPairs(draft),
  ];
}

/**
 * Builds the single operation behind the dialog, so one dispatch is one undo
 * step. "Create new columns" hands the chosen referenced columns to core's
 * `buildRelation`, which adds one foreign key column per referenced column.
 * "Use existing columns" has no columns to add, so it builds a single
 * `addRelation` from the chosen pairs.
 */
export function buildRelationOperation(
  document: SchemaDocument,
  draft: RelationDraft,
  generateId: GenerateId,
): Result<Operation, OperationError> {
  const fromTable = document.tables[draft.fromTableId];
  if (fromTable === undefined) {
    return {
      isOk: false,
      error: { code: "table-not-found", path: ["fromTableId"] },
    };
  }
  const toTable = document.tables[draft.toTableId];
  if (toTable === undefined) {
    return {
      isOk: false,
      error: { code: "table-not-found", path: ["toTableId"] },
    };
  }
  if (draft.kind === "manyToMany") {
    return buildManyToMany(
      document,
      {
        leftTableId: fromTable.id,
        rightTableId: toTable.id,
        junctionTableName: draft.junctionTableName,
        position: midpoint(fromTable.position, toTable.position),
      },
      generateId,
    );
  }
  const input = {
    fromTableId: fromTable.id,
    toTableId: toTable.id,
    kind: draft.kind,
    onDelete: draft.onDelete,
    onUpdate: draft.onUpdate,
  };
  if (draft.foreignKeyMode === "new-columns") {
    return buildRelation(
      document,
      { ...input, referencedColumnIds: draft.referencedColumnIds },
      generateId,
    );
  }
  return {
    isOk: true,
    value: {
      type: "addRelation",
      relation: {
        ...input,
        id: createRelationId(generateId),
        columnPairs: draft.columnPairs,
      },
    },
  };
}
