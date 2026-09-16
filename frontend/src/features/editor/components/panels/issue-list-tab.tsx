"use client";

import type { Issue, SchemaDocument } from "@schemaforge/core";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { ScrollArea } from "@/components/ui/scroll-area";

import { useRevealTable } from "../../hooks/use-reveal-table";
import { getIssueIndex } from "../../lib/issue-index";
import { resolveIssueTarget } from "../../lib/resolve-issue-target";
import {
  useEditorStore,
  useEditorStoreApi,
} from "../../state/use-editor-store";
import { toIssueMessageValues } from "./issue-message-values";

function lookup<Value>(
  elements: Readonly<Record<string, Value>>,
  elementId: string | null,
): Value | undefined {
  return elementId === null ? undefined : elements[elementId];
}

// Two issues never share both code and path, so together they name a row.
function issueKey(issue: Issue): string {
  return `${issue.code}:${JSON.stringify(issue.path)}`;
}

/**
 * Brings the element of an issue into view (spec section 4): a table, or the
 * table of a column or index, is selected and centered; a relation is
 * selected; an enum opens its tab. The field is then asked to take focus.
 */
function useGoToIssue(): (issue: Issue) => void {
  const store = useEditorStoreApi();
  const revealTable = useRevealTable();

  return (issue: Issue): void => {
    const state = store.getState();
    const target = resolveIssueTarget(state.document, issue.path);
    const relation =
      target.kind === "relation"
        ? lookup(state.document.relations, target.elementId)
        : undefined;
    if (relation !== undefined) {
      state.setSelection({ tableIds: [], relationIds: [relation.id] });
    } else if (target.kind === "enum") {
      state.setLeftPanelTab("enums");
    } else if (target.tableId !== null) {
      revealTable(target.tableId);
    }
    state.requestFocus(issue.path);
  };
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
        className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring"
        onClick={() => {
          onSelect(issue);
        }}
      >
        {/* The space keeps the message its own words in the accessible name
            (WCAG 2.5.3). */}
        <span className="sr-only">{t("editor:leftPanel.issues.goTo")}</span>{" "}
        {t(`issues:${issue.code}`, toIssueMessageValues(values))}
      </button>
    </li>
  );
}

/** The issues of the document in the order `validateSchema` returns them. */
export function IssueListTab(): JSX.Element {
  const { t } = useTranslation("editor");
  const schema = useEditorStore((state) => state.document);
  const goToIssue = useGoToIssue();
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
