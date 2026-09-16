import type { IssueValues } from "../../lib/resolve-issue-target";

/**
 * Fills every interpolation variable of the `issues` namespace. The typed
 * `t` of i18next requires all of them for a key chosen at run time, while
 * `resolveIssueTarget` only knows the ones its element has; an unknown one
 * renders as empty text instead of a raw `{{placeholder}}`.
 */
export function toIssueMessageValues(
  values: IssueValues,
): Required<IssueValues> {
  return {
    table: values.table ?? "",
    column: values.column ?? "",
    index: values.index ?? "",
    enum: values.enum ?? "",
    value: values.value ?? "",
  };
}
