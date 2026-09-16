"use client";

import { useLiveQuery } from "dexie-react-hooks";

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

export type SchemaListResult =
  | { readonly kind: "loaded"; readonly entries: readonly SchemaListEntry[] }
  | { readonly kind: "failed"; readonly errorCode: StorageErrorCode };

export function getSchemaListEntryId(entry: SchemaListEntry): string {
  return entry.kind === "readable" ? entry.schema.id : entry.schemaId;
}

async function readSchemaList(
  repository: SchemaRepository,
): Promise<SchemaListResult> {
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

/**
 * Reads the schema list live, so it follows creates, renames and deletes from
 * this tab and from other tabs. `undefined` means the first read is running.
 */
export function useSchemaList(
  repository: SchemaRepository,
): SchemaListResult | undefined {
  return useLiveQuery(() => readSchemaList(repository), [repository]);
}
