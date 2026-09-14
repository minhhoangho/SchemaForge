import type { DocumentPath } from "./document-path.js";

export const STRUCTURAL_ERROR_CODES = [
  "invalid-shape",
  "version-unsupported",
  "id-mismatch",
  "table-not-found",
  "column-not-found",
  "relation-not-found",
  "index-not-found",
  "enum-not-found",
  "subject-area-not-found",
  "note-not-found",
  "column-not-in-table",
  "column-listed-twice",
  "column-ownership-mismatch",
] as const;

// Codes that only operations and builder functions return, never parsing.
export const OPERATION_ERROR_CODES = [
  "id-already-exists",
  "enum-in-use",
  "insert-position-out-of-range",
  "primary-key-missing",
] as const;

export const ERROR_CODES = [
  ...STRUCTURAL_ERROR_CODES,
  ...OPERATION_ERROR_CODES,
] as const;

export type StructuralErrorCode = (typeof STRUCTURAL_ERROR_CODES)[number];

export type OperationErrorCode = (typeof OPERATION_ERROR_CODES)[number];

export type ErrorCode = (typeof ERROR_CODES)[number];

export type StructuralError = {
  readonly code: StructuralErrorCode;
  readonly path: DocumentPath;
};

export type OperationError = {
  readonly code: ErrorCode;
  readonly path: DocumentPath;
};
