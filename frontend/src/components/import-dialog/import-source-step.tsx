"use client";

import type { SqlDialect } from "@schemaforge/core";
import type { JSX } from "react";
import { useId, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { FileSourceField } from "./file-source-field";
import { FormatFields } from "./format-fields";
import { ImportModeField } from "./import-mode-field";
import { PasteSourceField } from "./paste-source-field";
import { pickChoice } from "./pick-choice";
import { useSourceStepFocus } from "./use-source-step-focus";
import type {
  SourceErrorKey,
  SourceForm,
  SourceTab,
} from "./use-import-dialog";

const BYTES_PER_MEGABYTE = 1_048_576;
const TABS = ["file", "paste"] as const satisfies readonly SourceTab[];

export type ImportSourceStepProps = {
  readonly form: SourceForm;
  readonly error: SourceErrorKey | null;
  readonly canMerge: boolean;
  readonly maxFileBytes: number;
  // Set when the user comes back to this step, so focus goes to the problem
  // (or to "Analyze") instead of staying on a control that is gone.
  readonly shouldMoveFocus: boolean;
  readonly onChange: (patch: Partial<SourceForm>) => void;
  readonly onDialectChange: (dialect: SqlDialect) => void;
  readonly onAnalyze: () => void;
};

export function ImportSourceStep({
  form,
  error,
  canMerge,
  maxFileBytes,
  shouldMoveFocus,
  onChange,
  onDialectChange,
  onAnalyze,
}: ImportSourceStepProps): JSX.Element {
  const { t } = useTranslation("importExport");
  const errorId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const analyzeRef = useRef<HTMLButtonElement>(null);
  const dialectRef = useRef<HTMLButtonElement>(null);
  const isDialectInvalid = error === "dialectRequired";
  useSourceStepFocus({
    shouldMoveFocus,
    error,
    refs: { fileRef, textRef, analyzeRef, dialectRef },
  });
  // The error belongs to the field it is about.
  const isSourceInvalid = error !== null && !isDialectInvalid;
  const sourceDescribedBy = isSourceInvalid ? errorId : undefined;

  return (
    <div className="grid gap-4">
      <Tabs
        value={form.tab}
        onValueChange={(tab) => {
          const next = pickChoice(TABS, tab);
          if (next !== undefined) onChange({ tab: next });
        }}
      >
        <TabsList aria-label={t("import.source.pasteLabel")}>
          <TabsTrigger value="file">{t("import.source.fileTab")}</TabsTrigger>
          <TabsTrigger value="paste">{t("import.source.pasteTab")}</TabsTrigger>
        </TabsList>
        <TabsContent value="file" className="grid gap-2 pt-2">
          <FileSourceField
            form={form}
            inputRef={fileRef}
            isInvalid={isSourceInvalid}
            describedBy={sourceDescribedBy}
            onChange={onChange}
          />
        </TabsContent>
        <TabsContent value="paste" className="grid gap-2 pt-2">
          <PasteSourceField
            textRef={textRef}
            value={form.text}
            isInvalid={isSourceInvalid}
            describedBy={sourceDescribedBy}
            onChange={(text) => {
              onChange({ text });
            }}
          />
        </TabsContent>
      </Tabs>
      {error !== null && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {t(`import.errors.${error}`, {
            maxMegabytes: maxFileBytes / BYTES_PER_MEGABYTE,
          })}
        </p>
      )}
      <FormatFields
        format={form.format}
        dialect={form.dialect}
        dialectTriggerRef={dialectRef}
        isDialectInvalid={isDialectInvalid}
        describedBy={errorId}
        onFormatChange={(format) => {
          onChange({ format });
        }}
        onDialectChange={onDialectChange}
      />
      {canMerge && (
        <ImportModeField
          value={form.mode}
          onChange={(mode) => {
            onChange({ mode });
          }}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a
          href="/third-party-notices.txt"
          target="_blank"
          rel="noreferrer"
          className="rounded-sm text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("import.licenses")}{" "}
          <span className="sr-only">{t("import.opensInNewTab")}</span>
        </a>
        <Button ref={analyzeRef} onClick={onAnalyze}>
          {t("import.source.analyze")}
        </Button>
      </div>
    </div>
  );
}
