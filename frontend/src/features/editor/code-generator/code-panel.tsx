"use client";

import { TriangleAlertIcon } from "lucide-react";
import type { JSX } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { getIssueIndex } from "../lib/issue-index";
import { useEditorStore } from "../state/use-editor-store";
import { CodeView } from "./code-view";
import { GeneratorDiagnosticList } from "./generator-diagnostic-list";
import { GeneratorOptions } from "./generator-options";
import { toGeneratorRequest } from "./generator-request";
import { GeneratorTargetSelect } from "./generator-target-select";
import { useGeneratedCode } from "./use-generated-code";

export type CodePanelProps = {
  // The skip link's target; the panel takes focus without joining the tab order.
  readonly id: string;
  // Tests only: the worker is the boundary they replace.
  readonly createWorker?: () => Worker;
};

function IssueWarning(): JSX.Element | null {
  const { t } = useTranslation("codeGenerator");
  const document = useEditorStore((state) => state.document);
  const setLeftPanelTab = useEditorStore((state) => state.setLeftPanelTab);
  const { issues } = getIssueIndex(document);

  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-2 text-sm">
      <TriangleAlertIcon
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-destructive"
      />
      <p className="min-w-0 flex-1">
        {t("issueWarning", { count: issues.length })}
      </p>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setLeftPanelTab("issues");
        }}
      >
        {t("openIssues")}
      </Button>
    </div>
  );
}

/**
 * The right column in code mode. Mounted only while the mode is `code`, so the
 * worker runs (and is terminated) with the panel.
 */
export function CodePanel({ id, createWorker }: CodePanelProps): JSX.Element {
  const { t } = useTranslation("codeGenerator");
  const document = useEditorStore((state) => state.document);
  const target = useEditorStore((state) => state.codeTarget);
  const options = useEditorStore((state) => state.codeOptions);
  const setCodeTarget = useEditorStore((state) => state.setCodeTarget);
  const updateCodeOptions = useEditorStore((state) => state.updateCodeOptions);

  // The hook restarts on a new `options` reference, so the request must be
  // stable between renders.
  const request = useMemo(
    () =>
      toGeneratorRequest(
        target,
        options,
        t("markdownLabels", { returnObjects: true }),
      ),
    [target, options, t],
  );
  const generated = useGeneratedCode({
    isEnabled: true,
    document,
    target: request.target,
    options: request.options,
    createWorker,
  });

  const shown =
    generated.status === "ready"
      ? generated.response
      : generated.status === "loading" && generated.previous?.kind === "ok"
        ? generated.previous
        : null;
  const isBusy = generated.status === "loading";

  return (
    <aside
      id={id}
      tabIndex={-1}
      aria-label={t("panelLabel")}
      aria-busy={isBusy}
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto border-l border-border bg-background p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset lg:w-[32rem] lg:flex-none"
    >
      <GeneratorTargetSelect value={target} onChange={setCodeTarget} />
      <GeneratorOptions
        target={target}
        options={options}
        onChange={updateCodeOptions}
      />
      <IssueWarning />
      {generated.status === "failed" && (
        <p role="alert" className="text-sm text-destructive">
          {t("failed")}
        </p>
      )}
      {shown === null ? (
        generated.status === "loading" && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("loading")}
          </p>
        )
      ) : (
        <>
          <CodeView
            response={shown}
            targetLabel={t(`targets.${target}`)}
            isBusy={isBusy}
          />
          <GeneratorDiagnosticList
            diagnostics={shown.diagnostics}
            document={document}
          />
        </>
      )}
    </aside>
  );
}
