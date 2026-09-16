import type { Issue, SchemaDocument } from "@schemaforge/core";
import { useTranslation } from "react-i18next";

import { getIssueIndex } from "../../../lib/issue-index";
import { resolveIssueTarget } from "../../../lib/resolve-issue-target";
import { toIssueMessageValues } from "../issue-message-values";

// An issue path is `[collection, elementId, ...field]`, for example
// `["columns", id, "type", "scale"]`.
const FIELD_PATH_START = 2;
const FIELD_PATH_SEPARATOR = ".";
const MESSAGE_SEPARATOR = " ";

/**
 * Returns the translated issues of one field of an element, joined into one
 * message, or `undefined` when the field has none. `field` is the path after
 * the element id joined with dots: `"name"`, `"type.scale"`, `"defaultValue"`.
 */
export type FieldErrorMessageOf = (
  elementId: string,
  field: string,
) => string | undefined;

function fieldOf(issue: Issue): string {
  return issue.path.slice(FIELD_PATH_START).join(FIELD_PATH_SEPARATOR);
}

/**
 * Whether an element has an issue on any field under one of `fieldRoots`, such
 * as `"type"` for `["columns", id, "type", "scale"]`.
 */
export function hasIssueUnder(
  schema: SchemaDocument,
  elementId: string,
  fieldRoots: readonly string[],
): boolean {
  return getIssueIndex(schema)
    .issuesOfElement(elementId)
    .some((issue) => {
      const root = issue.path[FIELD_PATH_START];
      return typeof root === "string" && fieldRoots.includes(root);
    });
}

export function useFieldErrorMessage(
  schema: SchemaDocument,
): FieldErrorMessageOf {
  const { t } = useTranslation("issues");
  const issueIndex = getIssueIndex(schema);

  return (elementId, field) => {
    const messages = issueIndex
      .issuesOfElement(elementId)
      .filter((issue) => fieldOf(issue) === field)
      .map((issue) =>
        t(
          issue.code,
          toIssueMessageValues(resolveIssueTarget(schema, issue.path).values),
        ),
      );
    return messages.length === 0 ? undefined : messages.join(MESSAGE_SEPARATOR);
  };
}
