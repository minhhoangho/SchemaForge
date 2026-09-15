import type { SchemaDocument } from "../model/schema-document.js";
import { parseOperation } from "../parse/parse-operation.js";
import type { ApplyResult } from "./apply-result.js";
import { rejectOperation } from "./apply-result.js";
import { applyBatch } from "./batch.js";
import { applyColumnOperation } from "./column-operations.js";
import { applyEnumOperation } from "./enum-operations.js";
import { applyIndexOperation } from "./index-operations.js";
import { applyMoveElements } from "./move-elements.js";
import { applyNoteOperation } from "./note-operations.js";
import type { Operation } from "./operation.js";
import { applyRelationOperation } from "./relation-operations.js";
import { applyRenameSchema } from "./rename-schema.js";
import { applySubjectAreaOperation } from "./subject-area-operations.js";
import { applyTableOperation } from "./table-operations.js";

// The operation's shape is already checked, so nested batch steps are
// dispatched directly instead of being parsed again at every level.
function applyParsedOperation(
  schema: SchemaDocument,
  operation: Operation,
): ApplyResult {
  switch (operation.type) {
    case "renameSchema":
      return applyRenameSchema(schema, operation);
    case "addTable":
    case "updateTable":
    case "setPrimaryKey":
    case "removeTable":
      return applyTableOperation(schema, operation);
    case "addColumn":
    case "updateColumn":
    case "moveColumn":
    case "removeColumn":
      return applyColumnOperation(schema, operation);
    case "addRelation":
    case "updateRelation":
    case "removeRelation":
      return applyRelationOperation(schema, operation);
    case "addIndex":
    case "updateIndex":
    case "removeIndex":
      return applyIndexOperation(schema, operation);
    case "addEnum":
    case "updateEnum":
    case "removeEnum":
      return applyEnumOperation(schema, operation);
    case "addSubjectArea":
    case "updateSubjectArea":
    case "removeSubjectArea":
      return applySubjectAreaOperation(schema, operation);
    case "addNote":
    case "updateNote":
    case "removeNote":
      return applyNoteOperation(schema, operation);
    case "moveElements":
      return applyMoveElements(schema, operation);
    case "batch":
      return applyBatch(schema, operation, applyParsedOperation);
    default: {
      const unhandled: never = operation;
      throw new Error(`Unhandled operation: ${JSON.stringify(unhandled)}`);
    }
  }
}

/**
 * The single entry point for changing a schema. Checks the operation's shape
 * (including batch depth), then applies it. On success returns the new schema
 * and an inverse operation that restores `schema`; when nothing changes the
 * returned schema is `schema` itself. The input schema is never mutated.
 */
export function applyOperation(
  schema: SchemaDocument,
  operation: Operation,
): ApplyResult {
  const parsed = parseOperation(operation);
  if (!parsed.isOk) {
    // parseOperation sorts its errors by path, so the first is the earliest.
    const firstError = parsed.error[0];
    if (firstError === undefined) {
      throw new Error("parseOperation failed without reporting an error");
    }
    return rejectOperation(firstError.code, firstError.path);
  }
  return applyParsedOperation(schema, parsed.value);
}
