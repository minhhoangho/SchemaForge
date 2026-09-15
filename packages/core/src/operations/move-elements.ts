import type { ErrorCode, OperationError } from "../error-codes.js";
import { isTableId } from "../model/ids.js";
import type { NoteId, TableId } from "../model/ids.js";
import type { Note } from "../model/note.js";
import type { Position } from "../model/position.js";
import type { IdMap, SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import type { Result } from "../result.js";
import { err, ok } from "../result.js";
import type { ApplyResult } from "./apply-result.js";
import { acceptOperation, rejectOperation } from "./apply-result.js";
import { withEntry } from "./id-map.js";
import { isJsonEqual } from "./json-equal.js";
import type { OperationOfType } from "./operation.js";

type MoveElementsOperation = OperationOfType<"moveElements">;

type ElementMove = MoveElementsOperation["moves"][number];

// A move whose element exists, holding the element as it was before the operation.
type ResolvedMove =
  | {
      readonly kind: "table";
      readonly element: Table;
      readonly position: Position;
    }
  | {
      readonly kind: "note";
      readonly element: Note;
      readonly position: Position;
    };

// The id prefix tells a table from a note, so a missing element gets the
// not-found code of its own kind.
function resolveMove(
  schema: SchemaDocument,
  move: ElementMove,
): ResolvedMove | ErrorCode {
  if (isTableId(move.elementId)) {
    const table = schema.tables[move.elementId];
    return table === undefined
      ? "table-not-found"
      : { kind: "table", element: table, position: move.position };
  }
  const note = schema.notes[move.elementId];
  return note === undefined
    ? "note-not-found"
    : { kind: "note", element: note, position: move.position };
}

function resolveMoves(
  schema: SchemaDocument,
  moves: readonly ElementMove[],
): Result<readonly ResolvedMove[], OperationError> {
  const resolvedMoves: ResolvedMove[] = [];
  for (const [index, move] of moves.entries()) {
    const resolved = resolveMove(schema, move);
    if (typeof resolved === "string") {
      return err({ code: resolved, path: ["moves", index, "elementId"] });
    }
    resolvedMoves.push(resolved);
  }
  return ok(resolvedMoves);
}

// The last move of an element wins. A final position equal to the current one
// changes nothing, so that element keeps its reference.
function findEffectiveMoves(
  moves: readonly ResolvedMove[],
): readonly ResolvedMove[] {
  const lastMoveById = new Map(
    moves.map((move) => [move.element.id, move] as const),
  );
  return [...lastMoveById.values()].filter(
    (move) => !isJsonEqual(move.element.position, move.position),
  );
}

function moveTables(
  tables: IdMap<TableId, Table>,
  moves: readonly ResolvedMove[],
): IdMap<TableId, Table> {
  return moves.reduce(
    (result, move) =>
      move.kind === "table"
        ? withEntry(result, move.element.id, {
            ...move.element,
            position: move.position,
          })
        : result,
    tables,
  );
}

function moveNotes(
  notes: IdMap<NoteId, Note>,
  moves: readonly ResolvedMove[],
): IdMap<NoteId, Note> {
  return moves.reduce(
    (result, move) =>
      move.kind === "note"
        ? withEntry(result, move.element.id, {
            ...move.element,
            position: move.position,
          })
        : result,
    notes,
  );
}

/**
 * Sets the position of tables and notes in order. The inverse lists the same
 * ids in the same order with their positions from before the operation, so it
 * restores every element even when an id appears more than once.
 */
export function applyMoveElements(
  schema: SchemaDocument,
  operation: MoveElementsOperation,
): ApplyResult {
  const resolved = resolveMoves(schema, operation.moves);
  if (!resolved.isOk) {
    return rejectOperation(resolved.error.code, resolved.error.path);
  }
  const inverse: MoveElementsOperation = {
    type: "moveElements",
    moves: resolved.value.map((move) => ({
      elementId: move.element.id,
      position: move.element.position,
    })),
  };
  const effectiveMoves = findEffectiveMoves(resolved.value);
  if (effectiveMoves.length === 0) {
    return acceptOperation(schema, inverse);
  }
  return acceptOperation(
    {
      ...schema,
      tables: moveTables(schema.tables, effectiveMoves),
      notes: moveNotes(schema.notes, effectiveMoves),
    },
    inverse,
  );
}
