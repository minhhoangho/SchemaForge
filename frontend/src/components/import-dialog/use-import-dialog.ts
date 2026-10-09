"use client";

import type {
  ImportDiagnostic,
  ImportFormat,
  Position,
  SchemaDocument,
  SqlDialect,
} from "@schemaforge/core";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  checkPastedSource,
  type DecodeResult,
  readImportFile,
  type ImportFileFormat,
} from "@/lib/import-export/decode-import-file";
import {
  createImporterClient,
  type ImportOutcome,
  type ImporterClient,
} from "@/lib/import-export/importer-client";
import { IMPORT_LAYOUT_METRICS } from "@/lib/import-export/import-layout";
import type { ImportResponse } from "@/lib/import-export/import-protocol";

export type ImportMergeTarget = {
  readonly document: SchemaDocument;
  readonly origin: Position;
};

export type ImportSuccess = Extract<ImportResponse, { kind: "success" }>;

export type SourceTab = "file" | "paste";
export type ImportModeChoice = "new" | "merge";

export type SourceForm = {
  readonly tab: SourceTab;
  readonly file: File | null;
  readonly text: string;
  readonly format: ImportFileFormat;
  readonly dialect: SqlDialect | null;
  readonly mode: ImportModeChoice;
};

/** Keys under `importExport:import.errors`. */
export type SourceErrorKey =
  | "fileTooLarge"
  | "encodingUnsupported"
  | "emptySource"
  | "dialectRequired"
  | "timeout"
  | "workerFailed";

export type ImportState =
  | { readonly step: "source"; readonly error: SourceErrorKey | null }
  | { readonly step: "analyzing"; readonly format: ImportFileFormat }
  | {
      readonly step: "preview";
      readonly response: ImportSuccess;
      readonly source: string;
      readonly mode: ImportModeChoice;
      // The document the batch was built for; `null` in "new" mode.
      readonly target: SchemaDocument | null;
    }
  | {
      readonly step: "failed";
      readonly diagnostics: readonly ImportDiagnostic[];
      readonly source: string;
    };

export type UseImportDialogOptions = {
  // False while the dialog is closed or blocked: no worker, no run.
  readonly isActive: boolean;
  readonly mergeTarget: ImportMergeTarget | null;
  readonly rememberedSqlDialect: SqlDialect | null;
  readonly onSqlDialectChange: (dialect: SqlDialect) => void;
  // Must be stable between renders: a new function would restart the client.
  readonly createClient?: () => ImporterClient;
};

export type ImportDialogController = {
  readonly state: ImportState;
  readonly form: SourceForm;
  // True once the user has left the first step, so returning to it moves focus.
  readonly hasLeftSource: boolean;
  readonly updateForm: (patch: Partial<SourceForm>) => void;
  readonly selectDialect: (dialect: SqlDialect) => void;
  readonly analyze: () => void;
  readonly cancel: () => void;
  readonly back: () => void;
};

const INITIAL_STATE: ImportState = { step: "source", error: null };
const READ_ERRORS = {
  "too-large": "fileTooLarge",
  "encoding-unsupported": "encodingUnsupported",
  empty: "emptySource",
} as const satisfies Record<string, SourceErrorKey>;

function toImportFormat(form: SourceForm): ImportFormat | null {
  return form.format === "sql" ? form.dialect : form.format;
}

function readSource(
  form: SourceForm,
):
  | DecodeResult<"too-large" | "encoding-unsupported" | "empty">
  | Promise<DecodeResult<"too-large" | "encoding-unsupported">> {
  if (form.tab === "paste") return checkPastedSource(form.text);
  if (form.file === null) return { isOk: false, error: "empty" };
  return readImportFile(form.file);
}

function toNextState(
  outcome: ImportOutcome,
  source: string,
  merge: ImportMergeTarget | null,
): ImportState {
  switch (outcome.kind) {
    case "success":
      return {
        step: "preview",
        response: outcome,
        source,
        mode: merge === null ? "new" : "merge",
        target: merge?.document ?? null,
      };
    case "failure":
      return { step: "failed", diagnostics: outcome.diagnostics, source };
    case "timeout":
      return { step: "source", error: "timeout" };
    case "crashed":
      return { step: "source", error: "workerFailed" };
    case "cancelled":
      return INITIAL_STATE;
    default: {
      const unhandled: never = outcome;
      return unhandled;
    }
  }
}

function createDefaultClient(): ImporterClient {
  return createImporterClient();
}

export function useImportDialog({
  isActive,
  mergeTarget,
  rememberedSqlDialect,
  onSqlDialectChange,
  createClient = createDefaultClient,
}: UseImportDialogOptions): ImportDialogController {
  const { t } = useTranslation("importExport");
  const [state, setState] = useState<ImportState>(INITIAL_STATE);
  const [hasLeftSource, setHasLeftSource] = useState(false);
  const [form, setForm] = useState<SourceForm>({
    tab: "file",
    file: null,
    text: "",
    format: "sql",
    dialect: rememberedSqlDialect,
    mode: "new",
  });
  const clientRef = useRef<ImporterClient | null>(null);
  // A run that is cancelled or superseded must not move the dialog on.
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!isActive) return;
    const client = createClient();
    client.prepare();
    clientRef.current = client;
    return () => {
      runIdRef.current += 1;
      client.dispose();
      clientRef.current = null;
    };
  }, [isActive, createClient]);

  // A changed input makes the last source error stale.
  function clearSourceError(): void {
    setState((current) =>
      current.step === "source" && current.error !== null
        ? INITIAL_STATE
        : current,
    );
  }

  function updateForm(patch: Partial<SourceForm>): void {
    setForm((current) => ({ ...current, ...patch }));
    clearSourceError();
  }

  function selectDialect(dialect: SqlDialect): void {
    setForm((current) => ({ ...current, dialect }));
    clearSourceError();
    onSqlDialectChange(dialect);
  }

  function analyze(): void {
    const client = clientRef.current;
    if (client === null) return;
    const format = toImportFormat(form);
    if (format === null) {
      setState({ step: "source", error: "dialectRequired" });
      return;
    }
    // Checks that need no waiting fail before "Analyzing…" is announced.
    const reading = readSource(form);
    if (!(reading instanceof Promise) && !reading.isOk) {
      setState({ step: "source", error: READ_ERRORS[reading.error] });
      return;
    }
    runIdRef.current += 1;
    const runId = runIdRef.current;
    const merge = form.mode === "merge" ? mergeTarget : null;
    setHasLeftSource(true);
    setState({ step: "analyzing", format: form.format });

    const run = async (): Promise<ImportState | null> => {
      const read = await reading;
      // Closed, blocked or cancelled while the file was read: no run.
      if (runId !== runIdRef.current) return null;
      if (!read.isOk) return { step: "source", error: READ_ERRORS[read.error] };
      if (read.value.trim() === "")
        return { step: "source", error: "emptySource" };
      const outcome = await client.run({
        format,
        source: read.value,
        fallbackSchemaName: t("import.defaultSchemaName"),
        layout: IMPORT_LAYOUT_METRICS,
        mode:
          merge === null
            ? { mode: "new" }
            : { mode: "merge", origin: merge.origin },
        target: merge?.document ?? null,
      });
      return toNextState(outcome, read.value, merge);
    };

    run()
      .then((next) => {
        if (next !== null && runId === runIdRef.current) setState(next);
      })
      .catch(() => {
        // The file could not be read (for example NotReadableError).
        if (runId === runIdRef.current) {
          setState({ step: "source", error: "workerFailed" });
        }
      });
  }

  function cancel(): void {
    runIdRef.current += 1;
    clientRef.current?.cancel();
    setState(INITIAL_STATE);
  }

  function back(): void {
    setState(INITIAL_STATE);
  }

  return {
    state,
    form,
    hasLeftSource,
    updateForm,
    selectDialect,
    analyze,
    cancel,
    back,
  };
}
