"use client";

import type { JSX } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { ImportSummary } from "@/lib/import-export/import-protocol";

import { ImportDiagnosticList } from "./import-diagnostic-list";
import { IntroducedIssueList } from "./introduced-issue-list";
import { SchemaNameField } from "./schema-name-field";
import type { ImportModeChoice, ImportSuccess } from "./use-import-dialog";

const SUMMARY_KEYS = [
  "tables",
  "columns",
  "relations",
  "indexes",
  "enums",
  "subjectAreas",
  "notes",
] as const satisfies readonly (keyof ImportSummary)[];

export type ImportPreviewStepProps = {
  readonly response: ImportSuccess;
  readonly source: string;
  readonly mode: ImportModeChoice;
  readonly onBack: () => void;
  readonly onConfirm: (schemaName: string) => void;
};

export function ImportPreviewStep({
  response,
  source,
  mode,
  onBack,
  onConfirm,
}: ImportPreviewStepProps): JSX.Element {
  const { t } = useTranslation("importExport");
  const countsId = useId();
  const differencesId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState(response.resultDocument.name);
  const [isNameMissing, setIsNameMissing] = useState(false);
  const { resultDocument, summary, diagnostics, introducedIssues } = response;

  // The step that held focus is gone: go to the first thing to act on.
  useEffect(() => {
    (mode === "new" ? nameRef.current : confirmRef.current)?.focus();
  }, [mode]);

  const confirm = (): void => {
    const trimmed = name.trim();
    if (mode === "new" && trimmed === "") {
      setIsNameMissing(true);
      nameRef.current?.focus();
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <div className="grid gap-4">
      {mode === "new" && (
        <SchemaNameField
          inputRef={nameRef}
          value={name}
          isMissing={isNameMissing}
          onChange={(value) => {
            setName(value);
            setIsNameMissing(false);
          }}
        />
      )}
      <section className="grid gap-2">
        <h3 id={countsId} className="text-sm font-medium">
          {t("import.preview.countsHeading")}
        </h3>
        <ul
          aria-labelledby={countsId}
          className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
        >
          {SUMMARY_KEYS.map((key) => (
            <li key={key}>
              {t(`import.preview.counts.${key}`, { count: summary[key] })}
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-2">
        <h3 id={differencesId} className="text-sm font-medium">
          {t("import.preview.differencesHeading", {
            count: diagnostics.length,
          })}
        </h3>
        {diagnostics.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("import.preview.noDifferences")}
          </p>
        ) : (
          <ImportDiagnosticList
            diagnostics={diagnostics}
            source={source}
            document={resultDocument}
            labelledBy={differencesId}
          />
        )}
      </section>
      <IntroducedIssueList
        issues={introducedIssues}
        document={resultDocument}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onBack}>
          {t("import.preview.back")}
        </Button>
        <Button ref={confirmRef} onClick={confirm}>
          {t("import.preview.confirm")}
        </Button>
      </div>
    </div>
  );
}
