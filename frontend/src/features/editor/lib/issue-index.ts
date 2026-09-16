import type { Issue, SchemaDocument, TableId } from "@schemaforge/core";
import { validateSchema } from "@schemaforge/core";

import { resolveIssueTarget } from "./resolve-issue-target";

export type IssueIndex = {
  readonly issues: readonly Issue[];
  readonly schemaIssues: readonly Issue[];
  readonly issuesOfElement: (elementId: string) => readonly Issue[];
  readonly countOfElement: (elementId: string) => number;
  readonly countOfTable: (tableId: TableId) => number;
};

// One shared empty array, so a selector reading an element without issues keeps
// returning the same reference and never re-renders its component.
const NO_ISSUES: readonly Issue[] = [];

/*
 * The single exception to "no module-level mutable state" (plan issue 25).
 * Every component reading issues of the same document must validate it once,
 * and the only key both the canvas and the panels share is the document
 * reference itself. A WeakMap keyed by that reference holds no key alive longer
 * than the document, and each editor store owns its own document, so nothing
 * leaks between two schemas or two requests. The cache is never cleared by
 * hand: replacing the document drops the entry with it.
 */
const indexesByDocument = new WeakMap<SchemaDocument, IssueIndex>();

function addIssue(
  issuesByKey: Map<string, Issue[]>,
  key: string,
  issue: Issue,
): void {
  const existing = issuesByKey.get(key);
  if (existing === undefined) {
    issuesByKey.set(key, [issue]);
    return;
  }
  existing.push(issue);
}

function createIssueIndex(document: SchemaDocument): IssueIndex {
  const issues = validateSchema(document);
  const schemaIssues: Issue[] = [];
  const issuesByElement = new Map<string, Issue[]>();
  const issuesByTable = new Map<string, Issue[]>();

  for (const issue of issues) {
    const target = resolveIssueTarget(document, issue.path);
    if (target.elementId === null) {
      schemaIssues.push(issue);
    } else {
      addIssue(issuesByElement, target.elementId, issue);
    }
    if (target.tableId !== null) {
      addIssue(issuesByTable, target.tableId, issue);
    }
  }

  return {
    issues,
    schemaIssues,
    issuesOfElement: (elementId) => issuesByElement.get(elementId) ?? NO_ISSUES,
    countOfElement: (elementId) => issuesByElement.get(elementId)?.length ?? 0,
    countOfTable: (tableId) => issuesByTable.get(tableId)?.length ?? 0,
  };
}

/** Validates a document once and groups its issues by element and by table. */
export function getIssueIndex(document: SchemaDocument): IssueIndex {
  const cached = indexesByDocument.get(document);
  if (cached !== undefined) {
    return cached;
  }
  const index = createIssueIndex(document);
  indexesByDocument.set(document, index);
  return index;
}
