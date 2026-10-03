import type { DocumentPath } from "../document-path.js";
import type { ErrorCode } from "../error-codes.js";
import type { SeedIssueCode } from "../generators/seed/seed-dataset.js";
import type { IssueCode } from "../validation/issue-codes.js";

// A missing relation reuses core's `relation-not-found`.
export const AI_EDIT_ERROR_CODES = [
  "table-name-not-found",
  "column-name-not-found",
  "enum-name-not-found",
  "index-name-not-found",
  "relation-ambiguous",
  "relation-columns-mismatch",
  "column-type-invalid",
  "default-value-invalid",
  "tool-call-limit",
  "turn-has-edits",
  "turn-has-sample-data",
  "findings-limit",
  "sample-rows-limit",
] as const;

export type AiEditErrorCode = (typeof AI_EDIT_ERROR_CODES)[number];

export type AiEditError = {
  readonly code: AiEditErrorCode | ErrorCode | IssueCode | SeedIssueCode;
  readonly path: DocumentPath;
  // The path by element names, never ids, filled in from the document that
  // holds the element when the error is created.
  readonly at: string;
};
