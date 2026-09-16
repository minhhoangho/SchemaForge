"use client";

import { useEffect, useState } from "react";

import { logger } from "@/lib/logger";
import type {
  SchemaLock,
  SchemaLockManager,
} from "@/lib/storage/schema-lock-manager";
import { getStorageErrorName } from "@/lib/storage/storage-error";

export type SchemaLockState =
  | { readonly kind: "acquiring" }
  | { readonly kind: "blocked" }
  | { readonly kind: "held"; readonly grantId: number };

export type UseSchemaLockInput = {
  readonly schemaId: string;
  readonly lockManager: SchemaLockManager;
};

const ACQUIRING: SchemaLockState = { kind: "acquiring" };
const ABORT_ERROR_NAME = "AbortError";
// A lock taken after waiting gets a different grant id than a free one, so a
// caller keyed on grantId reads the document again once the other tab left.
const FREE_LOCK_GRANT_ID = 1;
const WAITED_LOCK_GRANT_ID = 2;

// The state remembers which request it answers, so a new schema id or lock
// manager reads as acquiring until its own request settles.
type KeyedLockState = {
  readonly schemaId: string;
  readonly lockManager: SchemaLockManager;
  readonly lockState: SchemaLockState;
};

type LockRun = {
  readonly schemaId: string;
  readonly lockManager: SchemaLockManager;
  readonly signal: AbortSignal;
  readonly isActive: () => boolean;
  readonly onBlocked: () => void;
  readonly onGranted: (lock: SchemaLock, grantId: number) => void;
};

async function takeLock(run: LockRun): Promise<void> {
  const { schemaId, lockManager } = run;
  const freeLock = await lockManager.tryAcquire(schemaId);
  if (freeLock !== null) {
    run.onGranted(freeLock, FREE_LOCK_GRANT_ID);
    return;
  }
  if (!run.isActive()) {
    return;
  }
  run.onBlocked();
  const waitedLock = await lockManager.acquire(schemaId, run.signal);
  run.onGranted(waitedLock, WAITED_LOCK_GRANT_ID);
}

/**
 * Holds the exclusive lock of one schema for as long as the editor is
 * mounted. When another tab holds it, reports blocked and waits in line.
 * `grantId` tells a free lock (1) from one granted after waiting (2), so the
 * caller knows to read the document again before allowing edits.
 */
export function useSchemaLock({
  schemaId,
  lockManager,
}: UseSchemaLockInput): SchemaLockState {
  const [keyedState, setKeyedState] = useState<KeyedLockState | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const held: { lock: SchemaLock | null; isActive: boolean } = {
      lock: null,
      isActive: true,
    };
    const setLockState = (lockState: SchemaLockState): void => {
      setKeyedState({ schemaId, lockManager, lockState });
    };

    // Fire and forget: the outcome arrives through the callbacks, and every
    // rejection is handled by the catch below.
    void takeLock({
      schemaId,
      lockManager,
      signal: controller.signal,
      isActive: () => held.isActive,
      onBlocked: () => {
        setLockState({ kind: "blocked" });
      },
      onGranted: (lock, grantId) => {
        // A grant that lands after unmount is handed straight back.
        if (!held.isActive) {
          lock.release();
          return;
        }
        held.lock = lock;
        setLockState({ kind: "held", grantId });
      },
    }).catch((error: unknown) => {
      const errorName = getStorageErrorName(error);
      // Cleanup aborts the waiting request on purpose, which rejects it with
      // an AbortError; that is not a failure worth logging.
      if (errorName === ABORT_ERROR_NAME && !held.isActive) {
        return;
      }
      logger.warn("editor.lock-failed", { errorName });
    });

    return () => {
      held.isActive = false;
      controller.abort();
      held.lock?.release();
    };
  }, [schemaId, lockManager]);

  const isCurrent =
    keyedState !== null &&
    keyedState.schemaId === schemaId &&
    keyedState.lockManager === lockManager;
  return isCurrent ? keyedState.lockState : ACQUIRING;
}
