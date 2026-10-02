import { sortByPathThenCode } from "../../document-path.js";
import type { Column } from "../../model/column.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Issue, IssueCode } from "../issue-codes.js";

import { findDefaultValueProblem } from "./default-literals.js";
import type { DefaultValueProblem } from "./default-literals.js";

const PROBLEM_ISSUE_CODES = {
  invalid: "column-default-invalid",
  incompatible: "column-default-incompatible",
} as const satisfies Record<DefaultValueProblem, IssueCode>;

function checkColumnDefault(
  schema: SchemaDocument,
  column: Column,
): readonly Issue[] {
  if (column.defaultValue === null) {
    return [];
  }
  const problem = findDefaultValueProblem(
    column.type,
    column.defaultValue,
    schema.enums,
  );
  if (problem === null) {
    return [];
  }
  return [
    {
      code: PROBLEM_ISSUE_CODES[problem],
      path: ["columns", column.id, "defaultValue"],
    },
  ];
}

/** Validates every column's default value against its column type (spec section 3). */
export function validateColumnDefaults(
  schema: SchemaDocument,
): readonly Issue[] {
  const issues = Object.values(schema.columns).flatMap((column) =>
    checkColumnDefault(schema, column),
  );
  return sortByPathThenCode(issues);
}
