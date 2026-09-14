import type { DocumentPath } from "../document-path.js";

export const ISSUE_CODES = [
  "name-empty",
  "name-invalid",
  "name-too-long",
  "table-name-duplicate",
  "enum-name-duplicate",
  "column-name-duplicate",
  "index-name-duplicate",
  "subject-area-name-duplicate",
  "enum-values-empty",
  "enum-value-duplicate",
  "column-type-invalid-scale",
  "column-custom-type-invalid",
  "column-default-invalid",
  "column-default-incompatible",
  "column-primary-key-nullable",
  "column-auto-increment-invalid-type",
  "column-auto-increment-nullable",
  "column-auto-increment-with-default",
  "column-auto-increment-not-key",
  "table-multiple-auto-increment",
  "relation-column-type-mismatch",
  "relation-target-not-unique",
  "relation-one-to-one-not-unique",
  "relation-set-null-not-nullable",
  "relation-set-default-without-default",
] as const;

export type IssueCode = (typeof ISSUE_CODES)[number];

export type Issue = { readonly code: IssueCode; readonly path: DocumentPath };
