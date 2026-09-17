import { describe, expect, it } from "vitest";

import {
  isCloudSchemaRecord,
  parseSchemaRecord,
  parseSessionRecord,
  parseViewportRecord,
} from "./records";
import type {
  CloudSchemaRecord,
  LocalSchemaRecord,
  SessionRecord,
  ViewportRecord,
} from "./records";

const SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";
const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

function createSchemaRecord(
  overrides: Partial<LocalSchemaRecord> = {},
): LocalSchemaRecord {
  return {
    id: SCHEMA_ID,
    name: "Shop",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_500_000,
    ownerId: null,
    cloudRevision: null,
    syncStatus: null,
    ...overrides,
  };
}

function createCloudSchemaRecord(
  overrides: Partial<CloudSchemaRecord> = {},
): CloudSchemaRecord {
  return {
    ...createSchemaRecord(),
    ownerId: USER_ID,
    cloudRevision: 3,
    syncStatus: "synced",
    ...overrides,
  };
}

function createViewportRecord(
  overrides: Partial<ViewportRecord> = {},
): ViewportRecord {
  return { schemaId: SCHEMA_ID, x: -120.5, y: 40, zoom: 0.75, ...overrides };
}

function createSessionRecord(): SessionRecord {
  return { key: "current", userId: USER_ID, email: "ada@example.com" };
}

describe("parseSchemaRecord", () => {
  it("parses a local record with null sync fields", () => {
    const record = createSchemaRecord();

    expect(parseSchemaRecord(record)).toEqual(record);
  });

  it("parses a cloud record with a pending status and no cloud revision", () => {
    const record = createCloudSchemaRecord({
      cloudRevision: null,
      syncStatus: "pending",
    });

    expect(parseSchemaRecord(record)).toEqual(record);
  });

  it.each<[string, unknown]>([
    [
      "a missing name",
      {
        id: SCHEMA_ID,
        createdAt: 1_700_000_000_000,
        updatedAt: 1,
        ownerId: null,
        cloudRevision: null,
        syncStatus: null,
      },
    ],
    ["an id that is not a UUID", createSchemaRecord({ id: "schema-1" })],
    ["a negative updatedAt", createSchemaRecord({ updatedAt: -1 })],
    [
      "a createdAt that is not a number",
      { ...createSchemaRecord(), createdAt: "today" },
    ],
    ["a fractional updatedAt", createSchemaRecord({ updatedAt: 1.5 })],
    [
      "missing sync fields",
      { id: SCHEMA_ID, name: "Shop", createdAt: 1, updatedAt: 1 },
    ],
    [
      "an owner that is not a UUID",
      createCloudSchemaRecord({ ownerId: "user-1" }),
    ],
    [
      "an unknown sync status",
      { ...createCloudSchemaRecord(), syncStatus: "uploading" },
    ],
    [
      "a local record with a sync status",
      { ...createSchemaRecord(), syncStatus: "pending" },
    ],
  ])("returns null for a schema record with %s", (_description, value) => {
    expect(parseSchemaRecord(value)).toBeNull();
  });

  it("rejects a record with an owner but a null sync status", () => {
    expect(
      parseSchemaRecord({ ...createCloudSchemaRecord(), syncStatus: null }),
    ).toBeNull();
  });

  it("rejects a cloud revision of zero", () => {
    expect(
      parseSchemaRecord(createCloudSchemaRecord({ cloudRevision: 0 })),
    ).toBeNull();
  });

  it("returns null for a value that is not an object", () => {
    expect(parseSchemaRecord("Shop")).toBeNull();
  });
});

describe("isCloudSchemaRecord", () => {
  it("returns true for a record with an owner", () => {
    expect(isCloudSchemaRecord(createCloudSchemaRecord())).toBe(true);
  });

  it("returns false for a local record", () => {
    expect(isCloudSchemaRecord(createSchemaRecord())).toBe(false);
  });
});

describe("parseViewportRecord", () => {
  it("parses a valid viewport record", () => {
    const record = createViewportRecord();

    expect(parseViewportRecord(record)).toEqual(record);
  });

  it.each<[string, unknown]>([
    ["a zoom of 0", createViewportRecord({ zoom: 0 })],
    ["an x of NaN", createViewportRecord({ x: Number.NaN })],
    ["an infinite y", createViewportRecord({ y: Number.POSITIVE_INFINITY })],
    ["a missing schemaId", { x: 0, y: 0, zoom: 1 }],
  ])("returns null for a viewport record with %s", (_description, value) => {
    expect(parseViewportRecord(value)).toBeNull();
  });
});

describe("parseSessionRecord", () => {
  it("parses a session record", () => {
    const record = createSessionRecord();

    expect(parseSessionRecord(record)).toEqual(record);
  });

  it("rejects a session record with another key", () => {
    expect(
      parseSessionRecord({ ...createSessionRecord(), key: "previous" }),
    ).toBeNull();
  });

  it("rejects a session record whose user id is not a UUID", () => {
    expect(
      parseSessionRecord({ ...createSessionRecord(), userId: "user-1" }),
    ).toBeNull();
  });
});

describe("record parsing", () => {
  it("strips unknown keys from a parsed record", () => {
    const record = createCloudSchemaRecord();

    expect(parseSchemaRecord({ ...record, document: {} })).toStrictEqual(
      record,
    );
  });
});
