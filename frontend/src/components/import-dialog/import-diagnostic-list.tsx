"use client";

import {
  IMPORT_DIAGNOSTIC_CODES,
  type ImportDiagnostic,
  type ImportDiagnosticCode,
  type SchemaDocument,
} from "@schemaforge/core";
import type { JSX, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import {
  resolveIssueTarget,
  type IssueValues,
} from "@/lib/schema/resolve-issue-target";

import { SourceExcerpt } from "./source-excerpt";

/** Each list shows this many rows and counts the rest. */
export const MAX_LISTED_ROWS = 200;

function isImportCode(
  code: ImportDiagnostic["code"],
): code is ImportDiagnosticCode {
  return IMPORT_DIAGNOSTIC_CODES.some((candidate) => candidate === code);
}

export function toElementName(values: IssueValues): string {
  return [
    values.table,
    values.column ?? values.index,
    values.enum,
    values.value,
  ]
    .filter((part) => part !== undefined)
    .join(".");
}

export type OverflowListProps = {
  readonly labelledBy: string;
  readonly total: number;
  readonly children: ReactNode;
};

/** A list of at most 200 rows and the "and N more items" line. */
export function OverflowList({
  labelledBy,
  total,
  children,
}: OverflowListProps): JSX.Element {
  const { t } = useTranslation("importExport");
  return (
    <>
      <ul aria-labelledby={labelledBy} className="grid gap-2">
        {children}
      </ul>
      {total > MAX_LISTED_ROWS && (
        <p className="text-sm text-muted-foreground">
          {t("import.preview.more", { count: total - MAX_LISTED_ROWS })}
        </p>
      )}
    </>
  );
}

type DiagnosticRowProps = {
  readonly diagnostic: ImportDiagnostic;
  readonly source: string;
  readonly document: SchemaDocument | null;
  readonly shouldFocus: boolean;
};

function DiagnosticRow({
  diagnostic,
  source,
  document,
  shouldFocus,
}: DiagnosticRowProps): JSX.Element {
  const { t } = useTranslation(["importExport", "importDiagnostics", "errors"]);
  const { code } = diagnostic;
  const message = isImportCode(code)
    ? t(`importDiagnostics:${code}`)
    : t(`errors:codes.${code}`);
  const elementName =
    document === null || diagnostic.path === null
      ? ""
      : toElementName(resolveIssueTarget(document, diagnostic.path).values);
  const { location } = diagnostic;
  const rowRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (shouldFocus) rowRef.current?.focus();
  }, [shouldFocus]);

  return (
    <li
      ref={rowRef}
      tabIndex={-1}
      className="grid gap-1 rounded-md border border-border p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p>{message}</p>
      {elementName !== "" && (
        <p className="font-mono text-xs text-muted-foreground">{elementName}</p>
      )}
      {location !== null && (
        <>
          <p className="text-xs text-muted-foreground">
            {t("importExport:location", {
              line: location.line,
              column: location.column,
            })}
          </p>
          <SourceExcerpt source={source} location={location} />
        </>
      )}
    </li>
  );
}

export type ImportDiagnosticListProps = {
  readonly diagnostics: readonly ImportDiagnostic[];
  readonly source: string;
  // The imported document, to name the element of each diagnostic; `null`
  // when the source could not be read.
  readonly document: SchemaDocument | null;
  readonly labelledBy: string;
  readonly shouldFocusFirst?: boolean;
};

export function ImportDiagnosticList({
  diagnostics,
  source,
  document,
  labelledBy,
  shouldFocusFirst = false,
}: ImportDiagnosticListProps): JSX.Element {
  return (
    <OverflowList labelledBy={labelledBy} total={diagnostics.length}>
      {diagnostics.slice(0, MAX_LISTED_ROWS).map((diagnostic, index) => (
        <DiagnosticRow
          // The list never reorders, and two rows can match in every field.
          key={index}
          diagnostic={diagnostic}
          source={source}
          document={document}
          shouldFocus={shouldFocusFirst && index === 0}
        />
      ))}
    </OverflowList>
  );
}
