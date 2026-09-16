"use client";

import type { Issue } from "@schemaforge/core";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { resolveIssueTarget } from "../../lib/resolve-issue-target";
import type { IssueValues } from "../../lib/resolve-issue-target";
import { useEditorStore } from "../../state/use-editor-store";

// `t` over the union of every issue code asks for every variable any of them
// uses, so variables the resolved target does not provide are filled with "".
function toInterpolation(values: IssueValues): Required<IssueValues> {
  return {
    table: values.table ?? "",
    column: values.column ?? "",
    index: values.index ?? "",
    enum: values.enum ?? "",
    value: values.value ?? "",
  };
}

type RelationIssueMessagesProps = {
  readonly id: string;
  readonly issues: readonly Issue[];
};

/**
 * Lists translated issues under a field. The caller links `id` to the field
 * with `aria-describedby`; the list is not a live region, so editing a field
 * does not announce every issue that comes and goes.
 */
export function RelationIssueMessages({
  id,
  issues,
}: RelationIssueMessagesProps): JSX.Element {
  const { t } = useTranslation("issues");
  const schema = useEditorStore((state) => state.document);

  return (
    <ul id={id} className="grid gap-1 text-xs text-destructive">
      {issues.map((issue) => (
        <li key={`${issue.code}:${issue.path.join("/")}`}>
          {t(
            issue.code,
            toInterpolation(resolveIssueTarget(schema, issue.path).values),
          )}
        </li>
      ))}
    </ul>
  );
}
