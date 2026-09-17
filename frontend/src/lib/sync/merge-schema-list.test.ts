import type { SchemaSummary } from "@schemaforge/api-contract";
import { describe, expect, it } from "vitest";

import type { CloudSchemaRecord } from "@/lib/storage/records";
import type { SchemaListEntry } from "@/lib/storage/schema-repository";

import type { ListAuthContext, MergedSchemaRow } from "./merge-schema-list";
import { mergeSchemaList } from "./merge-schema-list";

const SCHEMA_ID = "00000000-0000-4000-8000-000000000001";
const SECOND_SCHEMA_ID = "00000000-0000-4000-8000-000000000002";
const GUEST_SCHEMA_ID = "00000000-0000-4000-8000-000000000003";
const UNREADABLE_SCHEMA_ID = "00000000-0000-4000-8000-000000000004";
const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

const SIGNED_OUT: ListAuthContext = { status: "signed-out" };
const SIGNED_IN: ListAuthContext = { status: "signed-in", userId: USER_ID };
const EXPIRED: ListAuthContext = { status: "expired", lastUserId: USER_ID };

function cloudRecord(
  id: string,
  overrides: Partial<CloudSchemaRecord> = {},
): CloudSchemaRecord {
  return {
    id,
    name: "Billing",
    createdAt: 1,
    updatedAt: 10,
    ownerId: USER_ID,
    cloudRevision: 3,
    syncStatus: "synced",
    ...overrides,
  };
}

function readableEntry(schema: CloudSchemaRecord): SchemaListEntry {
  return { kind: "readable", schema };
}

const GUEST_ENTRY: SchemaListEntry = {
  kind: "readable",
  schema: {
    id: GUEST_SCHEMA_ID,
    name: "Scratchpad",
    createdAt: 1,
    updatedAt: 1,
    ownerId: null,
    cloudRevision: null,
    syncStatus: null,
  },
};

const UNREADABLE_ENTRY: SchemaListEntry = {
  kind: "unreadable",
  schemaId: UNREADABLE_SCHEMA_ID,
};

function cloudSummary(
  id: string,
  overrides: Partial<SchemaSummary> = {},
): SchemaSummary {
  return {
    id,
    name: "Billing",
    revision: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:10.000Z",
    ...overrides,
  };
}

function findRow(
  rows: readonly MergedSchemaRow[],
  id: string,
): MergedSchemaRow | undefined {
  return rows.find((row) => row.id === id);
}

describe("mergeSchemaList", () => {
  it("shows a sign-in invitation instead of the owned section when signed out", () => {
    const result = mergeSchemaList({
      auth: SIGNED_OUT,
      cachedEntries: [GUEST_ENTRY],
      cloudItems: null,
      isCloudListComplete: false,
    });

    expect(result.owned).toEqual({ kind: "sign-in-invitation" });
  });

  it.each<[string, ListAuthContext]>([
    ["signed out", SIGNED_OUT],
    ["signed in", SIGNED_IN],
    ["expired", EXPIRED],
  ])("keeps guest entries in the guest section when %s", (_name, auth) => {
    const result = mergeSchemaList({
      auth,
      cachedEntries: [
        GUEST_ENTRY,
        UNREADABLE_ENTRY,
        readableEntry(cloudRecord(SCHEMA_ID)),
      ],
      cloudItems: null,
      isCloudListComplete: false,
    });

    expect(result.guest).toEqual([GUEST_ENTRY, UNREADABLE_ENTRY]);
  });

  it("shows the cache of the last user with the expired flag", () => {
    const result = mergeSchemaList({
      auth: EXPIRED,
      cachedEntries: [
        readableEntry(cloudRecord(SCHEMA_ID, { syncStatus: "pending" })),
      ],
      cloudItems: null,
      isCloudListComplete: false,
    });

    expect(result.owned).toMatchObject({
      kind: "rows",
      isSessionExpired: true,
    });
    expect(
      result.owned.kind === "rows"
        ? findRow(result.owned.rows, SCHEMA_ID)
        : undefined,
    ).toMatchObject({ source: "cache", label: "pending" });
  });

  it.each<
    [
      string,
      SchemaSummary | null,
      CloudSchemaRecord | null,
      MergedSchemaRow | null,
      boolean,
    ]
  >([
    [
      "cloud has the id, cache does not",
      cloudSummary(SCHEMA_ID),
      null,
      {
        id: SCHEMA_ID,
        name: "Billing",
        updatedAt: Date.parse("2026-01-01T00:00:10.000Z"),
        source: "cloud",
        label: "not-downloaded",
      },
      false,
    ],
    [
      "cloud has the id, cache is synced at least as new",
      cloudSummary(SCHEMA_ID, { revision: 2 }),
      cloudRecord(SCHEMA_ID, {
        syncStatus: "synced",
        cloudRevision: 3,
        name: "Cache name",
        updatedAt: 20,
      }),
      {
        id: SCHEMA_ID,
        name: "Cache name",
        updatedAt: 20,
        source: "cache",
        label: null,
      },
      false,
    ],
    [
      "cloud has the id, cloud revision is newer than the synced cache",
      cloudSummary(SCHEMA_ID, {
        revision: 5,
        name: "Cloud name",
        updatedAt: "2026-02-01T00:00:00.000Z",
      }),
      cloudRecord(SCHEMA_ID, { syncStatus: "synced", cloudRevision: 3 }),
      {
        id: SCHEMA_ID,
        name: "Cloud name",
        updatedAt: Date.parse("2026-02-01T00:00:00.000Z"),
        source: "cloud",
        label: null,
      },
      false,
    ],
    [
      "cache is pending while the cloud has the id",
      cloudSummary(SCHEMA_ID),
      cloudRecord(SCHEMA_ID, {
        syncStatus: "pending",
        name: "Local edit",
        updatedAt: 30,
      }),
      {
        id: SCHEMA_ID,
        name: "Local edit",
        updatedAt: 30,
        source: "cache",
        label: "pending",
      },
      false,
    ],
    [
      "cache is in conflict while the cloud has the id",
      cloudSummary(SCHEMA_ID),
      cloudRecord(SCHEMA_ID, { syncStatus: "conflict", updatedAt: 40 }),
      {
        id: SCHEMA_ID,
        name: "Billing",
        updatedAt: 40,
        source: "cache",
        label: "conflict",
      },
      false,
    ],
    [
      "cloud no longer has the id and the cache is synced",
      null,
      cloudRecord(SCHEMA_ID, { syncStatus: "synced" }),
      null,
      true,
    ],
    [
      "cloud no longer has the id and the cache is pending with a cloud revision",
      null,
      cloudRecord(SCHEMA_ID, {
        syncStatus: "pending",
        cloudRevision: 3,
        updatedAt: 50,
      }),
      {
        id: SCHEMA_ID,
        name: "Billing",
        updatedAt: 50,
        source: "cache",
        label: "deleted-in-cloud",
      },
      false,
    ],
  ])("%s", (_name, cloudItem, cacheRecord, expectedRow, isExpectedStale) => {
    const result = mergeSchemaList({
      auth: SIGNED_IN,
      cachedEntries: cacheRecord === null ? [] : [readableEntry(cacheRecord)],
      cloudItems: cloudItem === null ? [] : [cloudItem],
      isCloudListComplete: true,
    });

    const row =
      result.owned.kind === "rows"
        ? findRow(result.owned.rows, SCHEMA_ID)
        : undefined;
    expect(row).toEqual(expectedRow ?? undefined);
    expect(result.staleCacheIds.includes(SCHEMA_ID)).toBe(isExpectedStale);
  });

  it("labels a recreated cloud document as conflict when the cache is deleted-in-cloud", () => {
    const result = mergeSchemaList({
      auth: SIGNED_IN,
      cachedEntries: [
        readableEntry(
          cloudRecord(SCHEMA_ID, { syncStatus: "deleted-in-cloud" }),
        ),
      ],
      cloudItems: [cloudSummary(SCHEMA_ID)],
      isCloudListComplete: true,
    });

    const row =
      result.owned.kind === "rows"
        ? findRow(result.owned.rows, SCHEMA_ID)
        : undefined;
    expect(row).toMatchObject({ source: "cache", label: "conflict" });
  });

  it("labels a conflicted cache as deleted-in-cloud once the cloud copy is gone", () => {
    const result = mergeSchemaList({
      auth: SIGNED_IN,
      cachedEntries: [
        readableEntry(cloudRecord(SCHEMA_ID, { syncStatus: "conflict" })),
      ],
      cloudItems: [],
      isCloudListComplete: true,
    });

    const row =
      result.owned.kind === "rows"
        ? findRow(result.owned.rows, SCHEMA_ID)
        : undefined;
    expect(row).toMatchObject({ source: "cache", label: "deleted-in-cloud" });
  });

  it("does not report stale ids while the cloud list is incomplete", () => {
    const result = mergeSchemaList({
      auth: SIGNED_IN,
      cachedEntries: [
        readableEntry(cloudRecord(SCHEMA_ID, { syncStatus: "synced" })),
      ],
      cloudItems: [],
      isCloudListComplete: false,
    });

    expect(result.staleCacheIds).toEqual([]);
    const row =
      result.owned.kind === "rows"
        ? findRow(result.owned.rows, SCHEMA_ID)
        : undefined;
    expect(row).toMatchObject({ source: "cache", label: null });
  });

  it("shows owned cache rows when the cloud list failed to load", () => {
    const result = mergeSchemaList({
      auth: SIGNED_IN,
      cachedEntries: [
        readableEntry(cloudRecord(SCHEMA_ID, { syncStatus: "synced" })),
      ],
      cloudItems: null,
      isCloudListComplete: false,
    });

    const row =
      result.owned.kind === "rows"
        ? findRow(result.owned.rows, SCHEMA_ID)
        : undefined;
    expect(row).toMatchObject({ source: "cache", label: null });
  });

  it("sorts each section by updatedAt descending", () => {
    const older = cloudRecord(SCHEMA_ID, { updatedAt: 10, name: "Older" });
    const newer = cloudRecord(SECOND_SCHEMA_ID, {
      updatedAt: 20,
      name: "Newer",
    });
    const tieOlderId = cloudRecord("00000000-0000-4000-8000-000000000005", {
      updatedAt: 30,
      name: "Tie A",
    });
    const tieNewerId = cloudRecord("00000000-0000-4000-8000-000000000006", {
      updatedAt: 30,
      name: "Tie B",
    });

    const result = mergeSchemaList({
      auth: SIGNED_IN,
      cachedEntries: [older, newer, tieOlderId, tieNewerId].map(readableEntry),
      cloudItems: null,
      isCloudListComplete: false,
    });

    expect(
      result.owned.kind === "rows"
        ? result.owned.rows.map((row) => row.id)
        : [],
    ).toEqual([tieNewerId.id, tieOlderId.id, newer.id, older.id]);
  });
});
