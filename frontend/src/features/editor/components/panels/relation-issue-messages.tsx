"use client";

import type { Issue } from "@schemaforge/core";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { resolveIssueTarget } from "@/lib/schema/resolve-issue-target";
import { toIssueMessageValues } from "@/lib/schema/issue-message-values";
import { useEditorStore } from "../../state/use-editor-store";

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
            toIssueMessageValues(resolveIssueTarget(schema, issue.path).values),
          )}
        </li>
      ))}
    </ul>
  );
}
