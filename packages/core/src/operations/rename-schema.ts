import type { SchemaDocument } from "../model/schema-document.js";
import type { ApplyResult } from "./apply-result.js";
import { acceptOperation } from "./apply-result.js";
import type { OperationOfType } from "./operation.js";

/**
 * Renames the schema. Any name is accepted: an empty or too long name is a
 * semantic issue, not an operation error.
 */
export function applyRenameSchema(
  schema: SchemaDocument,
  operation: OperationOfType<"renameSchema">,
): ApplyResult {
  const inverse: OperationOfType<"renameSchema"> = {
    type: "renameSchema",
    name: schema.name,
  };
  if (operation.name === schema.name) {
    return acceptOperation(schema, inverse);
  }
  return acceptOperation({ ...schema, name: operation.name }, inverse);
}
