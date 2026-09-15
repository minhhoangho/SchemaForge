import type { DocumentPath } from "../document-path.js";
import type { ErrorCode, OperationError } from "../error-codes.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Result } from "../result.js";
import { err, ok } from "../result.js";
import type { Operation } from "./operation.js";

export type AppliedOperation = {
  readonly schema: SchemaDocument;
  readonly inverse: Operation;
};

export type ApplyResult = Result<AppliedOperation, OperationError>;

export function acceptOperation(
  schema: SchemaDocument,
  inverse: Operation,
): ApplyResult {
  return ok({ schema, inverse });
}

export function rejectOperation(
  code: ErrorCode,
  path: DocumentPath,
): ApplyResult {
  return err({ code, path });
}
