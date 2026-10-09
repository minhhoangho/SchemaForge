"use client";

import type { SchemaDocument, Issue } from "@schemaforge/core";
import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { toIssueMessageValues } from "@/lib/schema/issue-message-values";
import { resolveIssueTarget } from "@/lib/schema/resolve-issue-target";

import {
  MAX_LISTED_ROWS,
  OverflowList,
  toElementName,
} from "./import-diagnostic-list";

export type IntroducedIssueListProps = {
  readonly issues: readonly Issue[];
  readonly document: SchemaDocument;
};

export function IntroducedIssueList({
  issues,
  document,
}: IntroducedIssueListProps): JSX.Element {
  const { t } = useTranslation(["importExport", "issues"]);
  const headingId = useId();
  return (
    <section className="grid gap-2">
      <h3 id={headingId} className="text-sm font-medium">
        {t("importExport:import.preview.issuesHeading", {
          count: issues.length,
        })}
      </h3>
      {issues.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("importExport:import.preview.noIssues")}
        </p>
      ) : (
        <OverflowList labelledBy={headingId} total={issues.length}>
          {issues.slice(0, MAX_LISTED_ROWS).map((issue, index) => {
            const { values } = resolveIssueTarget(document, issue.path);
            const elementName = toElementName(values);
            return (
              // The list never reorders, and two issues can match in every field.
              <li
                key={index}
                className="grid gap-1 rounded-md border border-border p-2 text-sm"
              >
                <p>{t(`issues:${issue.code}`, toIssueMessageValues(values))}</p>
                {elementName !== "" && (
                  <p className="font-mono text-xs text-muted-foreground">
                    {elementName}
                  </p>
                )}
              </li>
            );
          })}
        </OverflowList>
      )}
    </section>
  );
}
