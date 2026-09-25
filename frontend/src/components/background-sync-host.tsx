"use client";

import { useEffect } from "react";

import { useApiClient, useAuth } from "@/components/auth-provider";
import { logger } from "@/lib/logger";
import { useStorage } from "@/lib/storage/storage-context";
import { syncPendingSchemas } from "@/lib/sync/sync-pending-schemas";

/**
 * Pushes pending schemas when auth becomes signed-in and whenever the
 * connection comes back while signed in. Results land only in IndexedDB; a
 * run already in flight when auth leaves signed-in stops on its own.
 */
export function BackgroundSyncHost(): null {
  const userId = useAuth((state) =>
    state.auth.status === "signed-in" ? state.auth.user.id : null,
  );
  const storage = useStorage();
  const api = useApiClient();

  useEffect(() => {
    if (userId === null || storage.kind !== "ready") {
      return;
    }
    const { repository, lockManager } = storage.storage;
    const runSync = (): void => {
      syncPendingSchemas({ api, repository, lockManager, userId }).catch(
        (cause: unknown) => {
          logger.error("sync.background-failed", {
            name: cause instanceof Error ? cause.name : "unknown",
          });
        },
      );
    };
    runSync();
    window.addEventListener("online", runSync);
    return () => {
      window.removeEventListener("online", runSync);
    };
  }, [userId, storage, api]);

  return null;
}
