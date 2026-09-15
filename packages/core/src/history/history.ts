import type { SchemaDocument } from "../model/schema-document.js";
import { applyOperation } from "../operations/apply-operation.js";
import type { AppliedOperation } from "../operations/apply-result.js";
import type { Operation } from "../operations/operation.js";

export type HistoryEntry = {
  readonly operation: Operation;
  readonly inverse: Operation;
};

/**
 * `past` and `future` are stacks whose most recent entry is last:
 * `past.at(-1)` is the next undo and `future.at(-1)` the next redo.
 */
export type History = {
  readonly past: readonly HistoryEntry[];
  readonly future: readonly HistoryEntry[];
};

export type HistoryStep = {
  readonly history: History;
  readonly schema: SchemaDocument;
};

export function createEmptyHistory(): History {
  return { past: [], future: [] };
}

/**
 * Appends `entry` to `past`, keeps only the `limit` newest entries, and
 * clears `future`. Throws when `limit` is not an integer of at least 1.
 */
export function recordEntry(
  history: History,
  entry: HistoryEntry,
  limit: number,
): History {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(
      `recordEntry: limit must be an integer of at least 1, got ${String(limit)}`,
    );
  }
  return { past: [...history.past, entry].slice(-limit), future: [] };
}

// Every schema change goes through the history, so an entry that no longer
// applies means the history and the schema are out of sync: a programmer error.
function applyHistoryOperation(
  schema: SchemaDocument,
  operation: Operation,
  action: "undo" | "redo",
): AppliedOperation {
  const result = applyOperation(schema, operation);
  if (!result.isOk) {
    const { code, path } = result.error;
    throw new Error(
      `${action}: failed to apply the history operation: ${code} at ${JSON.stringify(path)}`,
    );
  }
  return result.value;
}

/**
 * Applies the inverse of the last `past` entry and moves that entry to the end
 * of `future`. Returns `null` when there is nothing to undo.
 */
export function undo(
  history: History,
  schema: SchemaDocument,
): HistoryStep | null {
  const entry = history.past.at(-1);
  if (entry === undefined) {
    return null;
  }
  const applied = applyHistoryOperation(schema, entry.inverse, "undo");
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, entry],
    },
    schema: applied.schema,
  };
}

/**
 * Reapplies the operation of the last `future` entry and pushes it onto `past`
 * with the inverse computed now. Returns `null` when there is nothing to redo.
 */
export function redo(
  history: History,
  schema: SchemaDocument,
): HistoryStep | null {
  const entry = history.future.at(-1);
  if (entry === undefined) {
    return null;
  }
  const applied = applyHistoryOperation(schema, entry.operation, "redo");
  return {
    history: {
      past: [
        ...history.past,
        { operation: entry.operation, inverse: applied.inverse },
      ],
      future: history.future.slice(0, -1),
    },
    schema: applied.schema,
  };
}
