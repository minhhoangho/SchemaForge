"use client";

import { useRef, useState } from "react";

import { useApiClient, useAuth, useSignOut } from "@/components/auth-provider";
import { logger } from "@/lib/logger";
import type { SchemaLockManager } from "@/lib/storage/schema-lock-manager";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import { useStorage } from "@/lib/storage/storage-context";
import { countUnsyncedSchemas } from "@/lib/sync/sign-out";
import { syncPendingSchemas } from "@/lib/sync/sync-pending-schemas";
import { useNotify } from "@/lib/use-notify";

export type SignOutFlowState =
  | { readonly kind: "idle" }
  | { readonly kind: "counting" }
  | { readonly kind: "confirming"; readonly unsyncedCount: number }
  | { readonly kind: "syncing"; readonly unsyncedCount: number }
  | { readonly kind: "signing-out" };

export type SignOutFlow = {
  readonly state: SignOutFlowState;
  readonly start: () => Promise<void>;
  readonly trySync: () => Promise<void>;
  readonly confirm: () => Promise<void>;
  readonly cancel: () => void;
};

type AccountCache = {
  readonly repository: SchemaRepository;
  readonly lockManager: SchemaLockManager;
  readonly userId: string;
};

const IDLE: SignOutFlowState = { kind: "idle" };

function errorName(cause: unknown): string {
  return cause instanceof Error ? cause.name : "unknown";
}

/**
 * Drives the sign-out steps of spec section 7: count what is not on the cloud
 * yet, warn about it, offer one more sync attempt, then revoke the session and
 * clear the account's cache.
 */
export function useSignOutFlow(): SignOutFlow {
  const [state, setState] = useState<SignOutFlowState>(IDLE);
  const isConfirmingRef = useRef(false);
  const storage = useStorage();
  const api = useApiClient();
  const userId = useAuth((store) =>
    store.auth.status === "signed-in" ? store.auth.user.id : null,
  );
  const requestSignOut = useSignOut();
  const notify = useNotify();

  // Without a ready cache or a signed-in user there is nothing to count, but
  // the server session still has to be revoked.
  const cache: AccountCache | null =
    storage.kind === "ready" && userId !== null
      ? {
          repository: storage.storage.repository,
          lockManager: storage.storage.lockManager,
          userId,
        }
      : null;

  async function runSignOut(): Promise<void> {
    setState({ kind: "signing-out" });
    try {
      const result = await requestSignOut();
      if (!result.isOk) {
        notify({ tone: "error", titleKey: "sync:signOutDialog.signOutFailed" });
      }
    } catch (cause: unknown) {
      // signOut only rejects after the session and the hint cookie are gone,
      // so the user is signed out and just part of the local cache is left.
      logger.error("auth.sign-out-cleanup-failed", { name: errorName(cause) });
      notify({
        tone: "error",
        titleKey: "sync:signOutDialog.cacheCleanupFailed",
      });
    }
    setState(IDLE);
  }

  async function countOrSignOut(cacheToRead: AccountCache): Promise<void> {
    try {
      const unsyncedCount = await countUnsyncedSchemas(cacheToRead);
      if (unsyncedCount === 0) {
        await runSignOut();
        return;
      }
      setState({ kind: "confirming", unsyncedCount });
    } catch (cause: unknown) {
      // The warning is a courtesy; an unreadable cache must not trap the user
      // in a session they asked to leave.
      logger.error("auth.sign-out-count-failed", { name: errorName(cause) });
      await runSignOut();
    }
  }

  async function start(): Promise<void> {
    if (state.kind !== "idle") {
      return;
    }
    if (cache === null) {
      await runSignOut();
      return;
    }
    setState({ kind: "counting" });
    await countOrSignOut(cache);
  }

  async function trySync(): Promise<void> {
    if (state.kind !== "confirming" || cache === null) {
      return;
    }
    const previousCount = state.unsyncedCount;
    setState({ kind: "syncing", unsyncedCount: previousCount });
    try {
      await syncPendingSchemas({ api, ...cache });
      setState({
        kind: "confirming",
        unsyncedCount: await countUnsyncedSchemas(cache),
      });
    } catch (cause: unknown) {
      logger.error("auth.sign-out-sync-failed", { name: errorName(cause) });
      setState({ kind: "confirming", unsyncedCount: previousCount });
    }
  }

  async function confirm(): Promise<void> {
    // Two clicks inside one React batch both read the confirming state, so
    // the latch, not the state, is what keeps logout to a single request.
    if (state.kind !== "confirming" || isConfirmingRef.current) {
      return;
    }
    isConfirmingRef.current = true;
    try {
      await runSignOut();
    } finally {
      isConfirmingRef.current = false;
    }
  }

  function cancel(): void {
    setState(IDLE);
  }

  return { state, start, trySync, confirm, cancel };
}
