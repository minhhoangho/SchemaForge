"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { Context } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/components/auth-provider";
import type { ApiClient } from "@/lib/api/api-client";
import { logger } from "@/lib/logger";
import type { SyncStatus } from "@/lib/storage/records";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import { getStorageErrorName } from "@/lib/storage/storage-error";
import { createCloudPusher } from "@/lib/sync/cloud-pusher";
import type { CloudPusher, CloudPushState } from "@/lib/sync/cloud-pusher";
import { createBrowserRetryScheduler } from "@/lib/sync/retry-scheduler";
import type { RetryScheduler } from "@/lib/sync/retry-scheduler";

import { toCloudStatusView } from "../lib/to-cloud-status-view";
import type { CloudStatusView } from "../lib/to-cloud-status-view";
import type { EditorStore } from "../state/create-editor-store";

export type UseCloudPusherInput = {
  readonly store: EditorStore;
  readonly repository: SchemaRepository;
  readonly apiClient: ApiClient;
  readonly schemaId: string;
  readonly ownerId: string | null;
  readonly scheduler?: RetryScheduler;
};

export type CloudPusherControls = {
  readonly status: CloudStatusView;
  readonly retry: () => void;
  readonly resume: () => void;
};

// Cloud journeys (Task 35) provide a scheduler they advance by hand.
export const RetrySchedulerContext: Context<RetryScheduler> =
  createContext<RetryScheduler>(createBrowserRetryScheduler());

const IDLE: CloudPushState = { kind: "idle" };

// The pusher subscribes and unsubscribes itself.
const ONLINE_EVENTS = {
  subscribe: (listener: () => void): (() => void) => {
    window.addEventListener("online", listener);
    return () => {
      window.removeEventListener("online", listener);
    };
  },
};

function isBrowserOnline(): boolean {
  return navigator.onLine;
}

// useLiveQuery rethrows a rejected query during render, so a failed read
// only drops the cache's status; the pusher's own state still shows.
async function readSyncStatus(
  repository: SchemaRepository,
  schemaId: string,
): Promise<SyncStatus | null> {
  try {
    const record = await repository.readSchemaRecord(schemaId);
    return record?.syncStatus ?? null;
  } catch (error: unknown) {
    logger.error("editor.sync-status-read-failed", {
      errorName: getStorageErrorName(error),
    });
    return null;
  }
}

/**
 * Pushes an owned schema to the cloud after every successful local save
 * (spec section 7). Nothing is sent for a guest schema, after unmount (the
 * schema lock is released then, as in useAutosave) or once auth turns
 * signed-out.
 */
export function useCloudPusher({
  store,
  repository,
  apiClient,
  schemaId,
  ownerId,
  scheduler,
}: UseCloudPusherInput): CloudPusherControls {
  const contextScheduler = useContext(RetrySchedulerContext);
  const activeScheduler = scheduler ?? contextScheduler;
  const authStatus = useAuth((state) => state.auth.status);
  const isSignedOut = authStatus === "signed-out";
  const pusherRef = useRef<CloudPusher | null>(null);
  const previousAuthStatusRef = useRef(authStatus);
  const [pushState, setPushState] = useState<CloudPushState>(IDLE);
  const syncStatus =
    useLiveQuery(
      () => readSyncStatus(repository, schemaId),
      [repository, schemaId],
    ) ?? null;

  useEffect(() => {
    if (ownerId === null || isSignedOut) {
      return;
    }
    const pusher = createCloudPusher({
      api: apiClient,
      repository,
      schemaId,
      userId: ownerId,
      scheduler: activeScheduler,
      onlineEvents: ONLINE_EVENTS,
      isOnline: isBrowserOnline,
    });
    pusherRef.current = pusher;
    const unsubscribeState = pusher.subscribe(setPushState);
    const unsubscribeStore = store.subscribe((state, previousState) => {
      if (
        state.saveStatus.kind === "saved" &&
        previousState.saveStatus.kind !== "saved"
      ) {
        pusher.requestPush();
      }
    });
    // A schema left pending by an earlier visit (edited offline, or opened
    // with a push follow-up) goes out once; a synced one sends nothing.
    pusher.requestPush();
    return () => {
      unsubscribeStore();
      unsubscribeState();
      pusher.dispose();
      if (pusherRef.current === pusher) {
        pusherRef.current = null;
      }
    };
  }, [
    store,
    repository,
    apiClient,
    schemaId,
    ownerId,
    activeScheduler,
    isSignedOut,
  ]);

  // A pusher stopped on an expired session ignores requestPush until resumed.
  useEffect(() => {
    const previousStatus = previousAuthStatusRef.current;
    previousAuthStatusRef.current = authStatus;
    if (authStatus === "signed-in" && previousStatus !== "signed-in") {
      pusherRef.current?.resume();
    }
  }, [authStatus]);

  const retry = useCallback(() => {
    pusherRef.current?.requestPush();
  }, []);
  const resume = useCallback(() => {
    pusherRef.current?.resume();
  }, []);

  return {
    status: toCloudStatusView({
      ownerId,
      syncStatus,
      pusher: pushState,
      authStatus,
    }),
    retry,
    resume,
  };
}
