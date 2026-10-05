"use client";

import type { Issue, SchemaDocument } from "@schemaforge/core";
import { TriangleAlertIcon } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { ScrollArea } from "@/components/ui/scroll-area";

import { useGoToIssue } from "../../hooks/use-go-to-issue";
import { getIssueIndex } from "../../lib/issue-index";
import { resolveIssueTarget } from "@/lib/schema/resolve-issue-target";
import { useEditorStore } from "../../state/use-editor-store";
import { toIssueMessageValues } from "@/lib/schema/issue-message-values";

// Two issues never share both code and path, so together they name a row.
function issueKey(issue: Issue): string {
  return `${issue.code}:${JSON.stringify(issue.path)}`;
}

type IssueRowProps = {
  readonly issue: Issue;
  readonly schema: SchemaDocument;
  readonly onSelect: (issue: Issue) => void;
};

function IssueRow({ issue, schema, onSelect }: IssueRowProps): JSX.Element {
  const { t } = useTranslation(["editor", "issues"]);
  const { values } = resolveIssueTarget(schema, issue.path);

  return (
    <li>
      <button
        type="button"
        className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-1 focus-visible:outline-ring"
        onClick={() => {
          onSelect(issue);
        }}
      >
        <TriangleAlertIcon
          aria-hidden
          className="mt-0.5 size-3.5 shrink-0 text-destructive"
        />
        <span className="min-w-0">
          {/* The space keeps the message its own words in the accessible name
              (WCAG 2.5.3). */}
          <span className="sr-only">{t("editor:leftPanel.issues.goTo")}</span>{" "}
          {t(`issues:${issue.code}`, toIssueMessageValues(values))}
        </span>
      </button>
    </li>
  );
}

/** The issues of the document in the order `validateSchema` returns them. */
export function IssueListTab(): JSX.Element {
  const { t } = useTranslation("editor");
  const schema = useEditorStore((state) => state.document);
  const goToIssue = useGoToIssue({ shouldRequestFocus: true });
  const { issues } = getIssueIndex(schema);

  return (
    <ScrollArea className="h-full">
      {issues.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">
          {t("leftPanel.issues.none")}
        </p>
      ) : (
        <ul className="grid gap-0.5 p-2">
          {issues.map((issue) => (
            <IssueRow
              key={issueKey(issue)}
              issue={issue}
              schema={schema}
              onSelect={goToIssue}
            />
          ))}
        </ul>
      )}
    </ScrollArea>
  );
}
