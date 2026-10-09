"use client";

import type {
  BatchOperation,
  SchemaDocument,
  SqlDialect,
} from "@schemaforge/core";
import { LoaderCircleIcon } from "lucide-react";
import type { JSX } from "react";
import type { TFunction } from "i18next";
import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MAX_IMPORT_FILE_BYTES,
  type ImportFileFormat,
} from "@/lib/import-export/decode-import-file";
import type { ImporterClient } from "@/lib/import-export/importer-client";
import type { ImportSummary } from "@/lib/import-export/import-protocol";

import { ImportDiagnosticList } from "./import-diagnostic-list";
import { ImportPreviewStep } from "./import-preview-step";
import { ImportSourceStep } from "./import-source-step";
import {
  useImportDialog,
  type ImportDialogController,
  type ImportState,
  type ImportMergeTarget,
} from "./use-import-dialog";

export type ImportConfirmation =
  | {
      readonly mode: "new";
      readonly schemaName: string;
      readonly operation: BatchOperation;
    }
  | {
      readonly mode: "merge";
      readonly operation: BatchOperation;
      readonly target: SchemaDocument;
      readonly summary: ImportSummary;
    };

export type ImportDialogProps = {
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  // `null`: only "new schema" is offered (the schema list has no open schema).
  readonly mergeTarget: ImportMergeTarget | null;
  readonly onConfirm: (confirmation: ImportConfirmation) => void;
  readonly rememberedSqlDialect: SqlDialect | null;
  readonly onSqlDialectChange: (dialect: SqlDialect) => void;
  // True while the editor previews an AI proposal: the dialog closes and
  // nothing can be imported.
  readonly isBlocked?: boolean;
  // Radix restores focus only to a `DialogTrigger`; the owner names the
  // element that opened the dialog (as the schema-list dialogs do).
  readonly onReturnFocus: () => void;
  // Tests only: the worker is the boundary they replace. Keep it stable.
  readonly createClient?: () => ImporterClient;
};

// The SQL and DBML importers share the large parser chunk.
const PARSER_FORMATS: readonly ImportFileFormat[] = ["sql", "dbml"];

type AnalyzingStepProps = {
  readonly hasParserHint: boolean;
  readonly onCancel: () => void;
};

function AnalyzingStep({
  hasParserHint,
  onCancel,
}: AnalyzingStepProps): JSX.Element {
  const { t } = useTranslation("importExport");
  const cancelRef = useRef<HTMLButtonElement>(null);
  // The button that started the run is gone; keep focus inside the dialog.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  return (
    <div aria-busy className="grid gap-4">
      <p aria-hidden className="flex items-center gap-2 text-sm">
        <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
        {t("import.analyzing")}
      </p>
      {hasParserHint && (
        <p aria-hidden className="text-sm text-muted-foreground">
          {t("import.loadingParser")}
        </p>
      )}
      <div className="flex justify-end">
        <Button ref={cancelRef} variant="outline" onClick={onCancel}>
          {t("import.cancel")}
        </Button>
      </div>
    </div>
  );
}

type FailedStepProps = {
  readonly controller: ImportDialogController;
};

function FailedStep({ controller }: FailedStepProps): JSX.Element | null {
  const { t } = useTranslation("importExport");
  const headingId = useId();
  const { state } = controller;
  if (state.step !== "failed") return null;
  return (
    <section className="grid gap-3">
      <h3 id={headingId} className="text-sm font-medium">
        {t("import.preview.failedHeading")}
      </h3>
      <ImportDiagnosticList
        diagnostics={state.diagnostics}
        source={state.source}
        document={null}
        labelledBy={headingId}
        shouldFocusFirst
      />
      <div className="flex justify-end">
        <Button variant="outline" onClick={controller.back}>
          {t("import.preview.back")}
        </Button>
      </div>
    </section>
  );
}

function toAnnouncement(
  state: ImportState,
  hasParserHint: boolean,
  t: TFunction<"importExport">,
): string {
  switch (state.step) {
    case "analyzing":
      return hasParserHint
        ? `${t("import.analyzing")} ${t("import.loadingParser")}`
        : t("import.analyzing");
    case "preview":
      return t("import.preview.announceSuccess", {
        tables: t("import.preview.counts.tables", {
          count: state.response.summary.tables,
        }),
        differences: t("import.preview.differencesHeading", {
          count: state.response.diagnostics.length,
        }),
        issues: t("import.preview.issuesHeading", {
          count: state.response.introducedIssues.length,
        }),
      });
    case "failed":
      return t("import.preview.announceFailure", {
        count: state.diagnostics.length,
      });
    case "source":
      return "";
    default: {
      const unhandled: never = state;
      return unhandled;
    }
  }
}

type ImportDialogBodyProps = Omit<
  ImportDialogProps,
  "isOpen" | "isBlocked" | "onReturnFocus"
> & {
  readonly isActive: boolean;
};

function ImportDialogBody({
  isActive,
  mergeTarget,
  onOpenChange,
  onConfirm,
  rememberedSqlDialect,
  onSqlDialectChange,
  createClient,
}: ImportDialogBodyProps): JSX.Element {
  const { t } = useTranslation("importExport");
  const controller = useImportDialog({
    isActive,
    mergeTarget,
    rememberedSqlDialect,
    onSqlDialectChange,
    createClient,
  });
  const { state, form } = controller;

  const hasParserHint =
    state.step === "analyzing" && PARSER_FORMATS.includes(state.format);
  const announcement = toAnnouncement(state, hasParserHint, t);

  return (
    <>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {state.step === "source" && (
        <ImportSourceStep
          form={form}
          error={state.error}
          canMerge={mergeTarget !== null}
          maxFileBytes={MAX_IMPORT_FILE_BYTES}
          shouldMoveFocus={controller.hasLeftSource}
          onChange={controller.updateForm}
          onDialectChange={controller.selectDialect}
          onAnalyze={controller.analyze}
        />
      )}
      {state.step === "analyzing" && (
        <AnalyzingStep
          hasParserHint={hasParserHint}
          onCancel={controller.cancel}
        />
      )}
      {state.step === "failed" && <FailedStep controller={controller} />}
      {state.step === "preview" && (
        <ImportPreviewStep
          response={state.response}
          source={state.source}
          mode={state.mode}
          onBack={controller.back}
          onConfirm={(schemaName) => {
            const { response, target } = state;
            onConfirm(
              target === null
                ? { mode: "new", schemaName, operation: response.operation }
                : {
                    mode: "merge",
                    operation: response.operation,
                    target,
                    summary: response.summary,
                  },
            );
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}

export function ImportDialog({
  isOpen,
  onOpenChange,
  isBlocked = false,
  onReturnFocus,
  ...bodyProps
}: ImportDialogProps): JSX.Element {
  const { t } = useTranslation(["importExport", "common"]);
  const isActive = isOpen && !isBlocked;

  useEffect(() => {
    // Tell the owner, or the dialog would open again when the block ends.
    if (isOpen && isBlocked) onOpenChange(false);
  }, [isOpen, isBlocked, onOpenChange]);

  return (
    <Dialog open={isActive} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("common:actions.close")}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>{t("importExport:import.title")}</DialogTitle>
          <DialogDescription>
            {t("importExport:import.description")}
          </DialogDescription>
        </DialogHeader>
        <ImportDialogBody
          {...bodyProps}
          isActive={isActive}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}
