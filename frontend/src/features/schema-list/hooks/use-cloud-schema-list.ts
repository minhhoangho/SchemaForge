"use client";

import { SCHEMA_LIST_MAX_LIMIT } from "@schemaforge/api-contract";
import type { SchemaSummary } from "@schemaforge/api-contract";
import { useCallback, useEffect, useState } from "react";

import type { ApiClient } from "@/lib/api/api-client";
import type { ApiFailure } from "@/lib/api/api-failure";
import type { AuthState } from "@/lib/auth/auth-store";
import { logger } from "@/lib/logger";

export type CloudSchemaListState =
  // Not signed in, or the session expired: no request is made.
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | {
      readonly kind: "loaded";
      readonly items: readonly SchemaSummary[];
      readonly isComplete: boolean;
    }
  | { readonly kind: "failed"; readonly failure: ApiFailure };

const IDLE: CloudSchemaListState = { kind: "idle" };
const LOADING: CloudSchemaListState = { kind: "loading" };

async function loadAllPages(
  apiClient: ApiClient,
  signal: AbortSignal,
): Promise<CloudSchemaListState> {
  const items: SchemaSummary[] = [];
  let cursor: string | null = null;
  do {
    const result = await apiClient.schemas.list(
      cursor === null
        ? { limit: SCHEMA_LIST_MAX_LIMIT }
        : { limit: SCHEMA_LIST_MAX_LIMIT, cursor },
      { signal },
    );
    // A partial list would make missing schemas look deleted, so a failed
    // page drops the pages already read.
    if (!result.isOk) {
      return { kind: "failed", failure: result.error };
    }
    items.push(...result.value.items);
    cursor = result.value.nextCursor;
  } while (cursor !== null);
  return { kind: "loaded", items, isComplete: true };
}

/**
 * Reads every page of the signed-in account's cloud schema list, again when
 * the tab becomes visible, the connection returns, or `reload` is called. A
 * newer load aborts the one in flight and its result is dropped.
 */
export function useCloudSchemaList(input: {
  readonly apiClient: ApiClient;
  readonly authStatus: AuthState["status"];
}): { readonly state: CloudSchemaListState; readonly reload: () => void } {
  const { apiClient, authStatus } = input;
  const isSignedIn = authStatus === "signed-in";
  const [state, setState] = useState<CloudSchemaListState>(IDLE);
  const [loadRequest, setLoadRequest] = useState(0);
  const reload = useCallback(() => {
    setLoadRequest((count) => count + 1);
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }
    const controller = new AbortController();
    setState(LOADING);
    loadAllPages(apiClient, controller.signal).then(
      (next) => {
        if (!controller.signal.aborted) {
          setState(next);
        }
      },
      (cause: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        logger.error("schema-list.cloud-list-failed", {
          errorName: cause instanceof Error ? cause.name : "unknown",
        });
        setState({ kind: "failed", failure: { kind: "network" } });
      },
    );
    return () => {
      controller.abort();
    };
  }, [apiClient, isSignedIn, loadRequest]);

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }
    const reloadWhenVisible = (): void => {
      if (document.visibilityState === "visible") {
        reload();
      }
    };
    document.addEventListener("visibilitychange", reloadWhenVisible);
    window.addEventListener("online", reload);
    return () => {
      document.removeEventListener("visibilitychange", reloadWhenVisible);
      window.removeEventListener("online", reload);
    };
  }, [isSignedIn, reload]);

  return { state: isSignedIn ? state : IDLE, reload };
}
