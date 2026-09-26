"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";

import type { AuthState } from "@/lib/auth/auth-store";
import { logger } from "@/lib/logger";
import type {
  SchemaListEntry,
  SchemaRepository,
} from "@/lib/storage/schema-repository";
import {
  getStorageErrorName,
  toStorageErrorCode,
} from "@/lib/storage/storage-error";
import type { StorageErrorCode } from "@/lib/storage/storage-error";
import { mergeSchemaList } from "@/lib/sync/merge-schema-list";
import type {
  ListAuthContext,
  MergedSchemaList,
} from "@/lib/sync/merge-schema-list";

import type { CloudSchemaListState } from "./use-cloud-schema-list";

export type SchemaListResult =
  | { readonly kind: "loaded"; readonly list: MergedSchemaList }
  | { readonly kind: "failed"; readonly errorCode: StorageErrorCode };

type CacheReadResult =
  | { readonly kind: "loaded"; readonly entries: readonly SchemaListEntry[] }
  | { readonly kind: "failed"; readonly errorCode: StorageErrorCode };

export function getSchemaListEntryId(entry: SchemaListEntry): string {
  return entry.kind === "readable" ? entry.schema.id : entry.schemaId;
}

async function readSchemaList(
  repository: SchemaRepository,
): Promise<CacheReadResult> {
  try {
    return { kind: "loaded", entries: await repository.listSchemas() };
  } catch (error: unknown) {
    // useLiveQuery rethrows a rejected query during render, and this screen
    // has no error boundary, so a failed read becomes a translated state.
    logger.error("schema-list.read-failed", {
      errorName: getStorageErrorName(error),
    });
    return { kind: "failed", errorCode: toStorageErrorCode(error) };
  }
}

// While auth is unknown nobody's owned cache may show yet, so the merge runs
// as signed-out and the screen renders only the guest part.
function toListAuthContext(auth: AuthState): ListAuthContext {
  switch (auth.status) {
    case "unknown":
    case "signed-out":
      return { status: "signed-out" };
    case "signed-in":
      return { status: "signed-in", userId: auth.user.id };
    case "expired":
      return { status: "expired", lastUserId: auth.lastUser?.id ?? null };
    default: {
      const unhandled: never = auth;
      return unhandled;
    }
  }
}

/**
 * Reads the cache live, so the list follows creates, renames and deletes from
 * this tab and from other tabs, and merges it with the cloud list per account.
 * The cache is never returned unmerged: the merge is what keeps one account's
 * schemas away from another account or a guest. `undefined` means the first
 * read is running.
 */
export function useSchemaList(input: {
  readonly repository: SchemaRepository;
  readonly auth: AuthState;
  readonly cloud: CloudSchemaListState;
}): SchemaListResult | undefined {
  const { repository, auth, cloud } = input;
  const cache = useLiveQuery(() => readSchemaList(repository), [repository]);
  // Memoized so staleCacheIds stays one array while nothing changed, which
  // the screen's cleanup effect depends on. The auth store replaces `auth`
  // only when it changes.
  return useMemo(() => {
    if (cache === undefined || cache.kind === "failed") {
      return cache;
    }
    return {
      kind: "loaded",
      list: mergeSchemaList({
        auth: toListAuthContext(auth),
        cachedEntries: cache.entries,
        cloudItems: cloud.kind === "loaded" ? cloud.items : null,
        isCloudListComplete: cloud.kind === "loaded" && cloud.isComplete,
      }),
    };
  }, [cache, cloud, auth]);
}
