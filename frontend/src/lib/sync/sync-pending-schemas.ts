import type { ApiClient } from "@/lib/api/api-client";
import type { SchemaLockManager } from "@/lib/storage/schema-lock-manager";
import type { SchemaRepository } from "@/lib/storage/schema-repository";

import { pushSchemaOnce } from "./push-schema-once";

export type SyncPendingReport = {
  readonly syncedIds: readonly string[];
  readonly lockedIds: readonly string[];
  readonly conflictIds: readonly string[];
  readonly deletedInCloudIds: readonly string[];
  readonly stoppedBy: "session-expired" | null;
};

export type SyncPendingSchemasInput = {
  readonly api: ApiClient;
  readonly repository: SchemaRepository;
  readonly lockManager: SchemaLockManager;
  readonly userId: string;
};

// One run per user id runs at a time within this module; a second call for
// the same user while one is in flight shares its result.
const runsInFlight = new Map<string, Promise<SyncPendingReport>>();

async function pushOneRecord(
  input: SyncPendingSchemasInput,
  schemaId: string,
  report: {
    readonly syncedIds: string[];
    readonly conflictIds: string[];
    readonly deletedInCloudIds: string[];
  },
): Promise<"session-expired" | null> {
  const outcome = await pushSchemaOnce({
    api: input.api,
    repository: input.repository,
    schemaId,
    userId: input.userId,
  });
  switch (outcome.kind) {
    // A save landing while the request is in flight cannot happen here: the
    // caller holds the schema's lock for the whole push.
    case "synced":
    case "changed-while-sending":
      report.syncedIds.push(schemaId);
      return null;
    case "conflict":
      report.conflictIds.push(schemaId);
      return null;
    case "deleted-in-cloud":
      report.deletedInCloudIds.push(schemaId);
      return null;
    case "session-expired":
      return "session-expired";
    case "retryable":
    case "failed":
    case "not-pushable":
      return null;
    default: {
      const unhandledOutcome: never = outcome;
      return unhandledOutcome;
    }
  }
}

async function runSyncPendingSchemas(
  input: SyncPendingSchemasInput,
): Promise<SyncPendingReport> {
  const owned = await input.repository.listOwnedSchemas(input.userId);
  const pendingIds = owned
    .filter((record) => record.syncStatus === "pending")
    .map((record) => record.id);

  const syncedIds: string[] = [];
  const lockedIds: string[] = [];
  const conflictIds: string[] = [];
  const deletedInCloudIds: string[] = [];
  let stoppedBy: "session-expired" | null = null;

  for (const schemaId of pendingIds) {
    const lock = await input.lockManager.tryAcquire(schemaId);
    if (lock === null) {
      // The tab holding the lock pushes it on its own.
      lockedIds.push(schemaId);
      continue;
    }
    try {
      stoppedBy = await pushOneRecord(input, schemaId, {
        syncedIds,
        conflictIds,
        deletedInCloudIds,
      });
    } finally {
      lock.release();
    }
    if (stoppedBy !== null) {
      break;
    }
  }

  return { syncedIds, lockedIds, conflictIds, deletedInCloudIds, stoppedBy };
}

/**
 * Pushes every pending, owned schema of the signed-in user once, without
 * opening any dialog. There is no background timer: the caller decides when
 * to run this (on sign-in, when the connection returns, when the schema list
 * mounts). Concurrent calls for the same user share one run.
 */
export function syncPendingSchemas(
  input: SyncPendingSchemasInput,
): Promise<SyncPendingReport> {
  const existing = runsInFlight.get(input.userId);
  if (existing !== undefined) {
    return existing;
  }
  const run = runSyncPendingSchemas(input).finally(() => {
    runsInFlight.delete(input.userId);
  });
  runsInFlight.set(input.userId, run);
  return run;
}
