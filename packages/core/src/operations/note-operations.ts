import type { SchemaDocument } from "../model/schema-document.js";
import type { ApplyResult } from "./apply-result.js";
import { acceptOperation, rejectOperation } from "./apply-result.js";
import { withEntry, withoutIds } from "./id-map.js";
import type { NoteOperation, Operation, OperationOfType } from "./operation.js";

function addNote(
  schema: SchemaDocument,
  operation: OperationOfType<"addNote">,
): ApplyResult {
  const added = operation.note;
  if (schema.notes[added.id] !== undefined) {
    return rejectOperation("id-already-exists", ["note", "id"]);
  }
  return acceptOperation(
    { ...schema, notes: withEntry(schema.notes, added.id, added) },
    { type: "removeNote", noteId: added.id },
  );
}

function updateNote(
  schema: SchemaDocument,
  operation: OperationOfType<"updateNote">,
): ApplyResult {
  const current = schema.notes[operation.noteId];
  if (current === undefined) {
    return rejectOperation("note-not-found", ["noteId"]);
  }
  const inverse: Operation = {
    type: "updateNote",
    noteId: current.id,
    changes: { text: current.text },
  };
  const { text } = operation.changes;
  if (text === current.text) {
    return acceptOperation(schema, inverse);
  }
  return acceptOperation(
    {
      ...schema,
      notes: withEntry(schema.notes, current.id, { ...current, text }),
    },
    inverse,
  );
}

function removeNote(
  schema: SchemaDocument,
  operation: OperationOfType<"removeNote">,
): ApplyResult {
  const current = schema.notes[operation.noteId];
  if (current === undefined) {
    return rejectOperation("note-not-found", ["noteId"]);
  }
  return acceptOperation(
    { ...schema, notes: withoutIds(schema.notes, [current.id]) },
    { type: "addNote", note: current },
  );
}

export function applyNoteOperation(
  schema: SchemaDocument,
  operation: NoteOperation,
): ApplyResult {
  switch (operation.type) {
    case "addNote":
      return addNote(schema, operation);
    case "updateNote":
      return updateNote(schema, operation);
    case "removeNote":
      return removeNote(schema, operation);
    default: {
      const unhandled: never = operation;
      throw new Error(`Unhandled note operation: ${JSON.stringify(unhandled)}`);
    }
  }
}
