import type { SchemaDocument } from "../model/schema-document.js";

import type { Issue } from "./issue-codes.js";
import { validateSchema } from "./validate-schema.js";

// Issue codes never contain "[", and a path of strings and numbers serializes
// unambiguously, so the concatenation identifies an issue across two runs.
function toIssueKey(issue: Issue): string {
  return `${issue.code}${JSON.stringify(issue.path)}`;
}

/**
 * Returns the issues of `after` that `before` does not have, compared by code
 * and path, in the order of `after`. Strict mode for AI edits (spec section 8).
 */
export function findIntroducedIssues(
  before: SchemaDocument,
  after: SchemaDocument,
): readonly Issue[] {
  const existingIssueKeys = new Set(validateSchema(before).map(toIssueKey));
  return validateSchema(after).filter(
    (issue) => !existingIssueKeys.has(toIssueKey(issue)),
  );
}
