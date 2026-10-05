"use client";

import { serializeSchemaDocument } from "@schemaforge/core";
import { useCallback, useState } from "react";

import { downloadBlob } from "@/lib/download/download-blob";
import {
  DOWNLOAD_MIME_TYPES,
  toImageFileName,
  toSchemaJsonFileName,
} from "@/lib/import-export/download-file-names";
import { toDownloadBaseName } from "@/lib/import-export/to-download-base-name";
import { logger } from "@/lib/logger";
import { useNotify } from "@/lib/use-notify";

import { useCanvasNodeControls } from "../lib/viewport-controls";
import { useEditorStore } from "../state/use-editor-store";
import { captureCanvasImage } from "./capture-canvas-image";
import { hasSelfRelation, type ImageFormat } from "./compute-image-frame";

export type ExportActions = {
  readonly isGeneratingImage: boolean;
  readonly exportJson: () => void;
  readonly exportImage: (format: ImageFormat) => Promise<void>;
};

const EXPORT_ROOT_SELECTOR = "[data-export-root]";

export function useExportActions(): ExportActions {
  const schema = useEditorStore((state) => state.document);
  const { getMeasuredNodes } = useCanvasNodeControls();
  const notify = useNotify();
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const exportJson = useCallback(() => {
    downloadBlob(
      new Blob([serializeSchemaDocument(schema)], {
        type: DOWNLOAD_MIME_TYPES.json,
      }),
      toSchemaJsonFileName(toDownloadBaseName(schema.name)),
    );
  }, [schema]);

  const exportImage = useCallback(
    async (format: ImageFormat) => {
      if (isGeneratingImage) {
        return;
      }
      setIsGeneratingImage(true);
      // The menu closes on select, so its busy item is never seen; the toast
      // is the polite announcement that the capture started.
      notify({
        tone: "info",
        titleKey: "importExport:export.generatingImage",
      });
      try {
        const root = document.querySelector<HTMLElement>(EXPORT_ROOT_SELECTOR);
        if (root === null) {
          throw new Error("The canvas is not mounted.");
        }
        const { blob, isScaledDown } = await captureCanvasImage({
          root,
          nodes: getMeasuredNodes(),
          hasSelfRelation: hasSelfRelation(schema),
          format,
        });
        downloadBlob(
          blob,
          toImageFileName(toDownloadBaseName(schema.name), format),
        );
        if (isScaledDown) {
          notify({
            tone: "info",
            titleKey: "importExport:export.imageScaledDown",
          });
        }
      } catch (error) {
        // Only the error name: the message may quote schema content.
        logger.error("export.image-failed", {
          errorName: error instanceof Error ? error.name : "unknown",
        });
        notify({ tone: "error", titleKey: "importExport:export.failed" });
      } finally {
        setIsGeneratingImage(false);
      }
    },
    [getMeasuredNodes, isGeneratingImage, notify, schema],
  );

  return { isGeneratingImage, exportJson, exportImage };
}
