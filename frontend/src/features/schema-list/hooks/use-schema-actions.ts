"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import {
  getStorageErrorName,
  toStorageErrorCode,
} from "@/lib/storage/storage-error";
import { useNotify } from "@/lib/use-notify";

export type SchemaActions = {
  readonly createSchema: (name: string) => Promise<void>;
  readonly renameSchema: (schemaId: string, name: string) => Promise<void>;
  // Resolves true only when the schema was deleted, so the screen knows
  // whether the row, and the menu button focus would return to, still exists.
  readonly deleteSchema: (schemaId: string) => Promise<boolean>;
};

type ActionDependencies = {
  readonly storage: StorageBundle;
  readonly notify: Notify;
  readonly navigate: (href: string) => void;
};

// Resolves to whether the action ran to completion.
async function runReportingErrors(
  notify: Notify,
  action: () => Promise<boolean>,
): Promise<boolean> {
  try {
    return await action();
  } catch (error: unknown) {
    notify({
      tone: "error",
      titleKey: `storage:${toStorageErrorCode(error)}`,
    });
    logger.error("schema-list.action-failed", {
      errorName: getStorageErrorName(error),
    });
    return false;
  }
}

// Another tab may have the schema open in its editor, and its next autosave
// would bring back what this tab renamed or deleted, so both take the lock.
// Resolves false when the lock is taken.
async function withSchemaLock(
  { storage, notify }: ActionDependencies,
  schemaId: string,
  action: () => Promise<void>,
): Promise<boolean> {
  const lock = await storage.lockManager.tryAcquire(schemaId);
  if (lock === null) {
    notify({ tone: "error", titleKey: "schemaList:openInAnotherTab" });
    return false;
  }
  try {
    await action();
    return true;
  } finally {
    lock.release();
  }
}

function createSchemaActions(dependencies: ActionDependencies): SchemaActions {
  const { storage, notify, navigate } = dependencies;
  const { repository } = storage;

  return {
    createSchema: async (name) => {
      await runReportingErrors(notify, async () => {
        const record = await repository.createSchema(name);
        navigate(`/schemas/${record.id}`);
        return true;
      });
    },
    renameSchema: async (schemaId, name) => {
      await runReportingErrors(notify, () =>
        withSchemaLock(dependencies, schemaId, async () => {
          const result = await repository.renameSchema(schemaId, name);
          if (result.kind === "unreadable") {
            notify({
              tone: "error",
              titleKey: "schemaList:unreadableCannotRename",
            });
          }
        }),
      );
    },
    deleteSchema: (schemaId) =>
      runReportingErrors(notify, () =>
        withSchemaLock(dependencies, schemaId, () =>
          repository.deleteSchema(schemaId),
        ),
      ),
  };
}

export function useSchemaActions(storage: StorageBundle): SchemaActions {
  const router = useRouter();
  const notify = useNotify();

  return useMemo(
    () =>
      createSchemaActions({
        storage,
        notify,
        navigate: (href) => {
          router.push(href);
        },
      }),
    [storage, notify, router],
  );
}
