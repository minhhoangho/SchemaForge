"use client";

import type { GeneratorDiagnostic, SchemaDocument } from "@schemaforge/core";
import { InfoIcon } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { useGoToIssue } from "../hooks/use-go-to-issue";
import { resolveIssueTarget } from "../lib/resolve-issue-target";
import { toIssueMessageValues } from "../components/panels/issue-message-values";

type DiagnosticRowProps = {
  readonly diagnostic: GeneratorDiagnostic;
  readonly document: SchemaDocument;
  readonly onSelect: (diagnostic: GeneratorDiagnostic) => void;
};

function DiagnosticRow({
  diagnostic,
  document,
  onSelect,
}: DiagnosticRowProps): JSX.Element {
  const { t } = useTranslation(["codeGenerator", "generatorDiagnostics"]);
  const { values } = resolveIssueTarget(document, diagnostic.path);

  return (
    <li>
      <button
        type="button"
        className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-1 focus-visible:outline-ring"
        onClick={() => {
          onSelect(diagnostic);
        }}
      >
        <InfoIcon
          aria-hidden
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0">
          {/* The space keeps the message its own words in the accessible name
              (WCAG 2.5.3). */}
          <span className="sr-only">{t("codeGenerator:diagnostics.goTo")}</span>{" "}
          {t(
            `generatorDiagnostics:${diagnostic.code}`,
            toIssueMessageValues(values),
          )}
        </span>
      </button>
    </li>
  );
}

export type GeneratorDiagnosticListProps = {
  readonly diagnostics: readonly GeneratorDiagnostic[];
  readonly document: SchemaDocument;
};

/**
 * What the generator changed or left out, one row per diagnostic. A click
 * selects the element and keeps the code panel open: the panel replaces the
 * properties panel, so there is no field to focus.
 */
export function GeneratorDiagnosticList({
  diagnostics,
  document,
}: GeneratorDiagnosticListProps): JSX.Element | null {
  const { t } = useTranslation("codeGenerator");
  const goToElement = useGoToIssue({ shouldRequestFocus: false });

  if (diagnostics.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-1">
      <h3 className="text-sm font-medium">
        {t("diagnostics.heading", { count: diagnostics.length })}
      </h3>
      <ul className="grid max-h-48 gap-0.5 overflow-y-auto">
        {diagnostics.map((diagnostic, index) => (
          <DiagnosticRow
            key={`${diagnostic.code}:${JSON.stringify(diagnostic.path)}:${String(index)}`}
            diagnostic={diagnostic}
            document={document}
            onSelect={goToElement}
          />
        ))}
      </ul>
    </section>
  );
}
