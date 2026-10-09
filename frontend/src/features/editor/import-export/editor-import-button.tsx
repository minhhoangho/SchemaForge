"use client";

import { UploadIcon } from "lucide-react";
import type { JSX } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ImportDialog } from "@/components/import-dialog/import-dialog";
import type { ImportConfirmation } from "@/components/import-dialog/import-dialog";
import { useCreateImportedSchema } from "@/components/import-dialog/use-create-imported-schema";
import type { ImportMergeTarget } from "@/components/import-dialog/use-import-dialog";
import { usePendingImport } from "@/components/pending-import-provider";
import { Button } from "@/components/ui/button";
import { IMPORT_LAYOUT_METRICS } from "@/lib/import-export/import-layout";
import { useNotify } from "@/lib/use-notify";

import { useCanvasNodeControls } from "../lib/viewport-controls";
import { selectIsPreviewing } from "../state/create-editor-store";
import { useEditorStore, useEditorStoreApi } from "../state/use-editor-store";
import { computeMergeOrigin } from "./compute-merge-origin";
import { useMergeImport } from "./use-merge-import";

/**
 * The toolbar's Import button (spec section 12, "Điểm vào"). The merge target
 * is captured when the dialog opens, so the preview and the confirmed batch
 * refer to the same document and origin. During an AI proposal preview the
 * button is `aria-disabled` rather than `disabled`: it stays focusable, so the
 * dialog the preview closes can still return focus to it.
 */
export function EditorImportButton(): JSX.Element {
  const { t } = useTranslation("importExport");
  const store = useEditorStoreApi();
  const isPreviewing = useEditorStore(selectIsPreviewing);
  const { getMeasuredNodes } = useCanvasNodeControls();
  const mergeImport = useMergeImport();
  const createImportedSchema = useCreateImportedSchema();
  const { lastSqlDialect, setLastSqlDialect } = usePendingImport();
  const notify = useNotify();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<ImportMergeTarget | null>(
    null,
  );

  function open(): void {
    if (isPreviewing) {
      notify({
        tone: "error",
        titleKey: "importExport:import.errors.previewing",
      });
      return;
    }
    const nodes = getMeasuredNodes().map((node) => ({
      position: node.position,
      width: node.measured?.width ?? 0,
      height: node.measured?.height ?? 0,
    }));
    setMergeTarget({
      document: store.getState().document,
      origin: computeMergeOrigin(nodes, IMPORT_LAYOUT_METRICS.gap),
    });
    setIsOpen(true);
  }

  function confirm(confirmation: ImportConfirmation): void {
    if (confirmation.mode === "merge") {
      mergeImport(confirmation);
      return;
    }
    // The hook reports its own errors and never rejects.
    void createImportedSchema(confirmation);
  }

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        aria-disabled={isPreviewing}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent aria-disabled:hover:text-inherit"
        onClick={open}
      >
        <UploadIcon aria-hidden />
        {t("import.open")}
      </Button>
      <ImportDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        mergeTarget={mergeTarget}
        onConfirm={confirm}
        onReturnFocus={() => {
          buttonRef.current?.focus();
        }}
        rememberedSqlDialect={lastSqlDialect}
        onSqlDialectChange={setLastSqlDialect}
        isBlocked={isPreviewing}
      />
    </>
  );
}
