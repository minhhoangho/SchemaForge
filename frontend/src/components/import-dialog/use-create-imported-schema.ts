"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { useAuth } from "@/components/auth-provider";
import { usePendingImport } from "@/components/pending-import-provider";
import { logger } from "@/lib/logger";
import { useStorage } from "@/lib/storage/storage-context";
import {
  getStorageErrorName,
  toStorageErrorCode,
} from "@/lib/storage/storage-error";
import { useNotify } from "@/lib/use-notify";

import type { ImportConfirmation } from "./import-dialog";

type NewImport = Extract<ImportConfirmation, { mode: "new" }>;

/**
 * Creates the record for a "new schema" import (the same path as "Create
 * schema": owned when signed in), hands the operation to the editor through
 * the pending import, and opens the editor. Never rejects.
 */
export function useCreateImportedSchema(): (
  confirmation: NewImport,
) => Promise<void> {
  const storage = useStorage();
  const router = useRouter();
  const notify = useNotify();
  const { setPendingImport } = usePendingImport();
  const userId = useAuth((state) =>
    state.auth.status === "signed-in" ? state.auth.user.id : null,
  );

  return useCallback(
    async ({ schemaName, operation }) => {
      if (storage.kind !== "ready") {
        return;
      }
      try {
        const record = await storage.storage.repository.createSchema(
          schemaName,
          userId === null ? undefined : { ownerId: userId },
        );
        setPendingImport({ schemaId: record.id, operation });
        router.push(`/schemas/${record.id}`);
      } catch (error: unknown) {
        notify({
          tone: "error",
          titleKey: `storage:${toStorageErrorCode(error)}`,
        });
        // The schema name is user content and stays out of the log.
        logger.error("schema-list.import-failed", {
          errorName: getStorageErrorName(error),
        });
      }
    },
    [storage, router, notify, setPendingImport, userId],
  );
}
