"use client";

import { parseSchemaDocument } from "@schemaforge/core";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { useApiClient, useAuth } from "@/components/auth-provider";
import { useSignInPrompt } from "@/components/sign-in-prompt";
import type { SignInPrompt } from "@/components/sign-in-prompt";
import type { ApiClient } from "@/lib/api/api-client";
import { toApiErrorMessageKey } from "@/lib/api/api-failure";
import type { ApiFailure } from "@/lib/api/api-failure";
import { logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import {
  getStorageErrorName,
  toStorageErrorCode,
} from "@/lib/storage/storage-error";
import { syncPendingSchemas } from "@/lib/sync/sync-pending-schemas";
import { uploadLocalSchemas } from "@/lib/sync/upload-local-schemas";
import type { UploadReport } from "@/lib/sync/upload-local-schemas";
import { useNotify } from "@/lib/use-notify";

export type SchemaActionTarget = {
  readonly id: string;
  readonly name: string;
  readonly source: "guest" | "cached" | "cloud-only";
};

export type SchemaActions = {
  readonly createSchema: (name: string) => Promise<void>;
  readonly renameSchema: (
    target: SchemaActionTarget,
    name: string,
  ) => Promise<void>;
  // Resolves true only when the schema was deleted, so the screen knows
  // whether the row, and the menu button focus would return to, still exists.
  readonly deleteSchema: (target: SchemaActionTarget) => Promise<boolean>;
  readonly uploadToCloud: (target: SchemaActionTarget) => Promise<void>;
};

type ActionDependencies = {
  readonly storage: StorageBundle;
  readonly notify: Notify;
  readonly navigate: (href: string) => void;
  readonly api: ApiClient;
  // null unless signed in.
  readonly userId: string | null;
  readonly requireSignIn: SignInPrompt["requireSignIn"];
  readonly reload: () => void;
};

function errorName(cause: unknown): string {
  return cause instanceof Error ? cause.name : "unknown";
}

function notifyApiFailure(notify: Notify, failure: ApiFailure): void {
  notify({
    tone: "error",
    titleKey: `apiErrors:${toApiErrorMessageKey(failure)}`,
  });
}

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
// Resolves false when the lock is taken or the action reports false.
async function withSchemaLock(
  { storage, notify }: ActionDependencies,
  schemaId: string,
  action: () => Promise<boolean>,
): Promise<boolean> {
  const lock = await storage.lockManager.tryAcquire(schemaId);
  if (lock === null) {
    notify({ tone: "error", titleKey: "schemaList:openInAnotherTab" });
    return false;
  }
  try {
    return await action();
  } finally {
    lock.release();
  }
}

// Pushes the rename, then refreshes the list. Never rejects: the push is
// retried by the background sync anyway.
function syncThenReload(dependencies: ActionDependencies): void {
  const { api, storage, userId, reload } = dependencies;
  if (userId === null) {
    reload();
    return;
  }
  void syncPendingSchemas({
    api,
    repository: storage.repository,
    lockManager: storage.lockManager,
    userId,
  })
    .catch((cause: unknown) => {
      logger.error("schema-list.sync-failed", { errorName: errorName(cause) });
    })
    .finally(reload);
}

// A cloud-only row has no cache yet, so it is downloaded (as a synced copy)
// before the local rename marks it pending. Resolves false when it failed.
async function downloadCloudCopy(
  { api, storage, notify, userId }: ActionDependencies,
  schemaId: string,
): Promise<boolean> {
  if (userId === null) {
    return false;
  }
  const result = await api.schemas.get(schemaId);
  if (!result.isOk) {
    notifyApiFailure(notify, result.error);
    return false;
  }
  const parsed = parseSchemaDocument(result.value.document);
  if (!parsed.isOk) {
    notifyApiFailure(notify, { kind: "invalid-response" });
    return false;
  }
  await storage.repository.writeCloudCopy({
    id: schemaId,
    ownerId: userId,
    document: parsed.value,
    revision: result.value.revision,
    createdAt: Date.parse(result.value.createdAt),
    updatedAt: Date.parse(result.value.updatedAt),
  });
  return true;
}

async function renameInLock(
  dependencies: ActionDependencies,
  target: SchemaActionTarget,
  name: string,
): Promise<boolean> {
  if (
    target.source === "cloud-only" &&
    !(await downloadCloudCopy(dependencies, target.id))
  ) {
    return false;
  }
  const result = await dependencies.storage.repository.renameSchema(
    target.id,
    name,
  );
  if (result.kind === "unreadable") {
    dependencies.notify({
      tone: "error",
      titleKey: "schemaList:unreadableCannotRename",
    });
  }
  return result.kind === "renamed";
}

// Deleting a cloud schema needs the server first: removing only the cache
// would bring the schema back on the next list.
async function deleteCloudInLock(
  { api, storage, notify }: ActionDependencies,
  schemaId: string,
): Promise<boolean> {
  const result = await api.schemas.remove(schemaId);
  if (
    result.isOk ||
    (result.error.kind === "http" && result.error.status === 404)
  ) {
    await storage.repository.deleteSchema(schemaId);
    return true;
  }
  if (result.error.kind === "network" || result.error.kind === "timeout") {
    notify({ tone: "error", titleKey: "sync:schemaList.deleteNeedsNetwork" });
    return false;
  }
  notifyApiFailure(notify, result.error);
  return false;
}

// Same toasts as the upload dialog after sign-in (Task 28): every id lands in
// exactly one of uploadedIds, skipped or notAttemptedIds.
function notifyUploadReport(notify: Notify, report: UploadReport): void {
  const uploadedCount = report.uploadedIds.length;
  const notUploadedCount =
    report.skipped.length + report.notAttemptedIds.length;
  if (uploadedCount > 0) {
    notify({
      tone: "success",
      titleKey: "sync:uploadDialog.uploaded",
      values: { count: uploadedCount },
    });
  }
  if (notUploadedCount > 0) {
    notify({
      tone: "error",
      titleKey: "sync:uploadDialog.notUploaded",
      values: { count: notUploadedCount },
    });
  }
}

async function uploadToCloud(
  dependencies: ActionDependencies,
  target: SchemaActionTarget,
): Promise<void> {
  const { api, storage, notify, userId, requireSignIn, reload } = dependencies;
  if (!requireSignIn("cloudSave") || userId === null) {
    return;
  }
  try {
    const report = await uploadLocalSchemas({
      api,
      repository: storage.repository,
      lockManager: storage.lockManager,
      userId,
      schemaIds: [target.id],
      generateId: () => crypto.randomUUID(),
    });
    notifyUploadReport(notify, report);
  } catch (cause: unknown) {
    logger.error("schema-list.upload-failed", { errorName: errorName(cause) });
  }
  reload();
}

function createSchemaActions(dependencies: ActionDependencies): SchemaActions {
  const { storage, notify, navigate, userId, reload } = dependencies;
  const { repository } = storage;

  return {
    createSchema: async (name) => {
      await runReportingErrors(notify, async () => {
        // An owned schema starts pending; the editor's pusher creates it in
        // the cloud, so this works offline too.
        const record = await repository.createSchema(
          name,
          userId === null ? undefined : { ownerId: userId },
        );
        navigate(`/schemas/${record.id}`);
        if (userId !== null) {
          reload();
        }
        return true;
      });
    },
    renameSchema: async (target, name) => {
      const isRenamed = await runReportingErrors(notify, () =>
        withSchemaLock(dependencies, target.id, () =>
          renameInLock(dependencies, target, name),
        ),
      );
      if (isRenamed && target.source !== "guest") {
        syncThenReload(dependencies);
      }
    },
    deleteSchema: async (target) => {
      if (target.source === "guest") {
        return runReportingErrors(notify, () =>
          withSchemaLock(dependencies, target.id, async () => {
            await repository.deleteSchema(target.id);
            return true;
          }),
        );
      }
      const isDeleted = await runReportingErrors(notify, () =>
        withSchemaLock(dependencies, target.id, () =>
          deleteCloudInLock(dependencies, target.id),
        ),
      );
      if (isDeleted) {
        reload();
      }
      return isDeleted;
    },
    uploadToCloud: (target) => uploadToCloud(dependencies, target),
  };
}

export function useSchemaActions(
  storage: StorageBundle,
  cloud: { readonly reload: () => void },
): SchemaActions {
  const router = useRouter();
  const notify = useNotify();
  const api = useApiClient();
  const { requireSignIn } = useSignInPrompt();
  const userId = useAuth((state) =>
    state.auth.status === "signed-in" ? state.auth.user.id : null,
  );
  const { reload } = cloud;

  return useMemo(
    () =>
      createSchemaActions({
        storage,
        notify,
        navigate: (href) => {
          router.push(href);
        },
        api,
        userId,
        requireSignIn,
        reload,
      }),
    [storage, notify, router, api, userId, requireSignIn, reload],
  );
}
