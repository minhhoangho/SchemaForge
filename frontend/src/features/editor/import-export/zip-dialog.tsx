"use client";

import { TriangleAlertIcon } from "lucide-react";
import type { JSX, RefObject } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadBlob } from "@/lib/download/download-blob";
import {
  DOWNLOAD_MIME_TYPES,
  toZipFileName,
} from "@/lib/import-export/download-file-names";
import { useNotify } from "@/lib/use-notify";

import {
  BuildCancelledError,
  useBuildZip,
} from "../code-generator/use-build-zip";
import { getIssueIndex } from "../lib/issue-index";
import { useEditorStore } from "../state/use-editor-store";
import {
  clearZip,
  countZipFiles,
  selectAllZip,
  type ZipSelection,
} from "./zip-selection";
import { ZipSelectionFields } from "./zip-selection-fields";

export type ZipDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  // The menu item that opened the dialog is gone by the time it closes, so
  // focus goes back to the menu's trigger instead.
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  // Tests only: the worker is the boundary they replace.
  readonly createWorker?: () => Worker;
};

function IssueWarning(): JSX.Element | null {
  const { t } = useTranslation("importExport");
  const document = useEditorStore((state) => state.document);
  const { issues } = getIssueIndex(document);
  if (issues.length === 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-2 text-sm">
      <TriangleAlertIcon
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-destructive"
      />
      <p>{t("zip.issueWarning", { count: issues.length })}</p>
    </div>
  );
}

export function ZipDialog({
  open,
  onOpenChange,
  returnFocusRef,
  createWorker,
}: ZipDialogProps): JSX.Element {
  const { t } = useTranslation(["importExport", "common"]);
  const notify = useNotify();
  const selection = useEditorStore((state) => state.zipSelection);
  const codeOptions = useEditorStore((state) => state.codeOptions);
  const setZipSelection = useEditorStore((state) => state.setZipSelection);
  const { isBuilding, build, cancel } = useBuildZip({ createWorker });
  // Tied to the selection it was built for, so a changed selection never
  // shows the new file count next to an old diagnostic count.
  const [lastBuild, setLastBuild] = useState<{
    readonly selection: ZipSelection;
    readonly diagnosticCount: number;
  } | null>(null);
  const diagnosticCount =
    lastBuild?.selection === selection ? lastBuild.diagnosticCount : null;
  const fileCount = countZipFiles(selection);

  const handleOpenChange = (isOpen: boolean): void => {
    if (!isOpen) {
      // A build the user closed the dialog on must not download afterwards.
      if (isBuilding) cancel();
      setLastBuild(null);
    }
    onOpenChange(isOpen);
  };

  const download = (): void => {
    if (isBuilding) return;
    build().then(
      ({ bytes, diagnosticCount: count, baseName }) => {
        setLastBuild({ selection, diagnosticCount: count });
        downloadBlob(
          new Blob([bytes.slice()], { type: DOWNLOAD_MIME_TYPES.zip }),
          toZipFileName(baseName),
        );
      },
      (error: unknown) => {
        // The hook logs failures; a cancel is the user's own doing.
        if (error instanceof BuildCancelledError) return;
        notify({ tone: "error", titleKey: "importExport:export.failed" });
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        closeLabel={t("common:actions.close")}
        onCloseAutoFocus={(event) => {
          const trigger = returnFocusRef?.current;
          if (trigger !== undefined && trigger !== null) {
            event.preventDefault();
            trigger.focus();
          }
        }}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{t("importExport:zip.title")}</DialogTitle>
          <DialogDescription>
            {t("importExport:zip.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setZipSelection(selectAllZip(codeOptions));
            }}
          >
            {t("importExport:zip.selectAll")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setZipSelection(clearZip());
            }}
          >
            {t("importExport:zip.clearAll")}
          </Button>
        </div>
        <IssueWarning />
        <ZipSelectionFields selection={selection} onChange={setZipSelection} />
        <p role="status" className="text-sm text-muted-foreground">
          {isBuilding
            ? t("importExport:zip.generating")
            : diagnosticCount === null
              ? t("importExport:zip.filesOnly", { count: fileCount })
              : t("importExport:zip.summary", {
                  files: t("importExport:zip.filesOnly", { count: fileCount }),
                  notes: t("importExport:zip.notes", {
                    count: diagnosticCount,
                  }),
                })}
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              handleOpenChange(false);
            }}
          >
            {t("common:actions.cancel")}
          </Button>
          {/* aria-disabled, not disabled, while building: focus stays here, and
              only the status line above announces the progress. */}
          <Button
            disabled={fileCount === 0}
            aria-disabled={isBuilding || undefined}
            className="aria-disabled:opacity-50"
            onClick={download}
          >
            {isBuilding
              ? t("importExport:zip.generating")
              : t("importExport:zip.download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
