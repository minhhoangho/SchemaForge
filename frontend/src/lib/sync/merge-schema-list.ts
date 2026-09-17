import type { SchemaSummary } from "@schemaforge/api-contract";

import { isCloudSchemaRecord } from "@/lib/storage/records";
import type { CloudSchemaRecord, SyncStatus } from "@/lib/storage/records";
import type { SchemaListEntry } from "@/lib/storage/schema-repository";

import type { OpenAuthContext } from "./decide-open-action";

export type ListAuthContext = OpenAuthContext;

export type SchemaRowLabel =
  "not-downloaded" | "pending" | "conflict" | "deleted-in-cloud" | null;

export type MergedSchemaRow = {
  readonly id: string;
  readonly name: string;
  // Epoch ms; the cloud's ISO 8601 timestamp is converted for sorting.
  readonly updatedAt: number;
  readonly source: "cloud" | "cache";
  readonly label: SchemaRowLabel;
};

export type MergedSchemaList = {
  readonly owned:
    | { readonly kind: "sign-in-invitation" }
    | {
        readonly kind: "rows";
        readonly rows: readonly MergedSchemaRow[];
        readonly isSessionExpired: boolean;
      };
  readonly guest: readonly SchemaListEntry[];
  readonly staleCacheIds: readonly string[];
};

type MergeOutcome = {
  readonly rows: readonly MergedSchemaRow[];
  readonly staleCacheIds: readonly string[];
};

function isGuestEntry(entry: SchemaListEntry): boolean {
  return entry.kind === "unreadable" || !isCloudSchemaRecord(entry.schema);
}

function extractGuestEntries(
  entries: readonly SchemaListEntry[],
): readonly SchemaListEntry[] {
  return entries.filter(isGuestEntry);
}

function extractOwnedCache(
  entries: readonly SchemaListEntry[],
  userId: string | null,
): readonly CloudSchemaRecord[] {
  if (userId === null) {
    return [];
  }
  return entries.flatMap((entry) =>
    entry.kind === "readable" &&
    isCloudSchemaRecord(entry.schema) &&
    entry.schema.ownerId === userId
      ? [entry.schema]
      : [],
  );
}

function cacheRow(
  record: CloudSchemaRecord,
  label: SchemaRowLabel,
): MergedSchemaRow {
  return {
    id: record.id,
    name: record.name,
    updatedAt: record.updatedAt,
    source: "cache",
    label,
  };
}

function cloudRow(item: SchemaSummary, label: SchemaRowLabel): MergedSchemaRow {
  return {
    id: item.id,
    name: item.name,
    updatedAt: Date.parse(item.updatedAt),
    source: "cloud",
    label,
  };
}

function cacheOnlyLabel(status: SyncStatus): SchemaRowLabel {
  switch (status) {
    case "synced":
      return null;
    case "pending":
      return "pending";
    case "conflict":
      return "conflict";
    case "deleted-in-cloud":
      return "deleted-in-cloud";
    default: {
      const unhandled: never = status;
      return unhandled;
    }
  }
}

function cacheOnlyRows(
  ownedCache: readonly CloudSchemaRecord[],
): readonly MergedSchemaRow[] {
  return ownedCache.map((record) =>
    cacheRow(record, cacheOnlyLabel(record.syncStatus)),
  );
}

function mergeSyncedRecord(
  record: CloudSchemaRecord,
  cloudItem: SchemaSummary | undefined,
): MergedSchemaRow | null {
  if (cloudItem === undefined) {
    return null;
  }
  const isCacheCurrent =
    record.cloudRevision !== null && record.cloudRevision >= cloudItem.revision;
  return isCacheCurrent ? cacheRow(record, null) : cloudRow(cloudItem, null);
}

// A schema that was created after the cloud record was deleted still needs
// resolving through the conflict dialog, and a schema that disappeared while
// the cache had unresolved changes is reported as deleted-in-cloud; both
// reuse the labels the corresponding decideOpenAction outcome would show.
function mergeUnsyncedRecord(
  record: CloudSchemaRecord,
  cloudItem: SchemaSummary | undefined,
): MergedSchemaRow {
  if (record.syncStatus === "pending") {
    const isKnownToCloud = record.cloudRevision !== null;
    return cacheRow(
      record,
      cloudItem === undefined && isKnownToCloud
        ? "deleted-in-cloud"
        : "pending",
    );
  }
  return cacheRow(
    record,
    cloudItem === undefined ? "deleted-in-cloud" : "conflict",
  );
}

function mergeRecordWithCloud(
  record: CloudSchemaRecord,
  cloudItem: SchemaSummary | undefined,
): MergedSchemaRow | null {
  return record.syncStatus === "synced"
    ? mergeSyncedRecord(record, cloudItem)
    : mergeUnsyncedRecord(record, cloudItem);
}

function mergeWithCloud(
  ownedCache: readonly CloudSchemaRecord[],
  cloudItems: readonly SchemaSummary[],
): MergeOutcome {
  const cachedIds = new Set(ownedCache.map((record) => record.id));
  const cloudById = new Map(cloudItems.map((item) => [item.id, item] as const));

  const notDownloadedRows = cloudItems
    .filter((item) => !cachedIds.has(item.id))
    .map((item) => cloudRow(item, "not-downloaded"));

  const staleCacheIds: string[] = [];
  const cacheRows: MergedSchemaRow[] = [];
  for (const record of ownedCache) {
    const row = mergeRecordWithCloud(record, cloudById.get(record.id));
    if (row === null) {
      staleCacheIds.push(record.id);
    } else {
      cacheRows.push(row);
    }
  }

  return { rows: [...notDownloadedRows, ...cacheRows], staleCacheIds };
}

function compareIdsDescending(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? 1 : -1;
}

function sortRows(
  rows: readonly MergedSchemaRow[],
): readonly MergedSchemaRow[] {
  return [...rows].sort(
    (left, right) =>
      right.updatedAt - left.updatedAt ||
      compareIdsDescending(left.id, right.id),
  );
}

function resolveOwnedUserId(auth: ListAuthContext): string | null {
  switch (auth.status) {
    case "signed-in":
      return auth.userId;
    case "expired":
      return auth.lastUserId;
    case "signed-out":
      return null;
    default: {
      const unhandled: never = auth;
      return unhandled;
    }
  }
}

/**
 * Merges the account's cloud schema list with its Dexie cache into what the
 * schema list screen renders (spec section 7, "Danh sách schema").
 */
export function mergeSchemaList(input: {
  readonly auth: ListAuthContext;
  readonly cachedEntries: readonly SchemaListEntry[];
  // null: the cloud list has not loaded yet or failed to load.
  readonly cloudItems: readonly SchemaSummary[] | null;
  readonly isCloudListComplete: boolean;
}): MergedSchemaList {
  const { auth, cachedEntries, cloudItems, isCloudListComplete } = input;
  const guest = extractGuestEntries(cachedEntries);

  if (auth.status === "signed-out") {
    return { owned: { kind: "sign-in-invitation" }, guest, staleCacheIds: [] };
  }

  const userId = resolveOwnedUserId(auth);
  const ownedCache = extractOwnedCache(cachedEntries, userId);
  const merged: MergeOutcome =
    userId !== null && cloudItems !== null && isCloudListComplete
      ? mergeWithCloud(ownedCache, cloudItems)
      : { rows: cacheOnlyRows(ownedCache), staleCacheIds: [] };

  return {
    owned: {
      kind: "rows",
      rows: sortRows(merged.rows),
      isSessionExpired: auth.status === "expired",
    },
    guest,
    staleCacheIds: merged.staleCacheIds,
  };
}
