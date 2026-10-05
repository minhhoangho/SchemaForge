"use client";

import { serializeSchemaDocument } from "@schemaforge/core";
import { useCallback } from "react";

import { downloadBlob } from "@/lib/download/download-blob";
import { toSchemaJsonFileName } from "@/lib/import-export/download-file-names";
import { toDownloadBaseName } from "@/lib/import-export/to-download-base-name";
import { logger } from "@/lib/logger";
import { useStorage } from "@/lib/storage/storage-context";
import { toStorageErrorCode } from "@/lib/storage/storage-error";
import { useNotify } from "@/lib/use-notify";

// Downloads a local schema as `.schemaforge.json` without opening the editor.
export function useDownloadSchemaJson(): (schemaId: string) => Promise<void> {
  const state = useStorage();
  const notify = useNotify();
  const repository = state.kind === "ready" ? state.storage.repository : null;

  return useCallback(
    async (schemaId) => {
      try {
        const opened = await repository?.openSchema(schemaId);
        if (opened?.kind !== "opened") {
          notify({ tone: "error", titleKey: "importExport:download.failed" });
          return;
        }
        const { document } = opened;
        downloadBlob(
          new Blob([serializeSchemaDocument(document)], {
            type: "application/json",
          }),
          toSchemaJsonFileName(toDownloadBaseName(document.name)),
        );
      } catch (error: unknown) {
        notify({
          tone: "error",
          titleKey: `storage:${toStorageErrorCode(error)}`,
        });
        logger.error("schema-list.download-failed", {
          errorName: error instanceof Error ? error.name : "unknown",
        });
      }
    },
    [repository, notify],
  );
}
