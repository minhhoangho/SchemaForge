import type { SchemaDetail } from "@schemaforge/api-contract";
import { createSampleSchema } from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import type {
  CloudSchemaRecord,
  LocalSchemaRecord,
  SchemaRecord,
} from "@/lib/storage/records";

import type {
  CloudFetchResult,
  OpenAction,
  OpenAuthContext,
} from "./decide-open-action";
import { decideOpenAction, shouldFetchCloud } from "./decide-open-action";

const SCHEMA_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const OTHER_USER_ID = "6a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const SAMPLE_DOCUMENT = createSampleSchema();

const SIGNED_OUT: OpenAuthContext = { status: "signed-out" };
const SIGNED_IN: OpenAuthContext = { status: "signed-in", userId: USER_ID };
const EXPIRED: OpenAuthContext = {
  status: "expired",
  lastUserId: USER_ID,
};

function localRecord(overrides: Partial<LocalSchemaRecord> = {}): SchemaRecord {
  return {
    id: SCHEMA_ID,
    name: "Billing",
    createdAt: 1,
    updatedAt: 1,
    ownerId: null,
    cloudRevision: null,
    syncStatus: null,
    ...overrides,
  };
}

function cloudRecord(
  overrides: Partial<CloudSchemaRecord> = {},
): CloudSchemaRecord {
  return {
    id: SCHEMA_ID,
    name: "Billing",
    createdAt: 1,
    updatedAt: 1,
    ownerId: USER_ID,
    cloudRevision: 3,
    syncStatus: "synced",
    ...overrides,
  };
}

function cloudDetail(overrides: Partial<SchemaDetail> = {}): SchemaDetail {
  return {
    id: SCHEMA_ID,
    name: "Billing",
    revision: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    document: SAMPLE_DOCUMENT,
    ...overrides,
  };
}

const FOUND: (revision: number) => CloudFetchResult = (revision) => ({
  kind: "found",
  detail: cloudDetail({ revision }),
});
const NOT_FOUND: CloudFetchResult = { kind: "not-found" };
const UNAVAILABLE: CloudFetchResult = { kind: "unavailable" };

describe("shouldFetchCloud", () => {
  it.each<[string, OpenAuthContext, SchemaRecord | null, boolean]>([
    ["signed out, no cache", SIGNED_OUT, null, false],
    ["signed out, owned cache", SIGNED_OUT, cloudRecord(), false],
    ["expired, no cache", EXPIRED, null, false],
    ["expired, owned cache", EXPIRED, cloudRecord(), false],
    ["signed in, no cache", SIGNED_IN, null, true],
    ["signed in, guest cache", SIGNED_IN, localRecord(), false],
    [
      "signed in, cache of another account",
      SIGNED_IN,
      cloudRecord({ ownerId: OTHER_USER_ID }),
      false,
    ],
    [
      "signed in, owned cache synced",
      SIGNED_IN,
      cloudRecord({ syncStatus: "synced" }),
      true,
    ],
    [
      "signed in, owned cache pending with no cloud revision",
      SIGNED_IN,
      cloudRecord({ syncStatus: "pending", cloudRevision: null }),
      false,
    ],
    [
      "signed in, owned cache pending with a cloud revision",
      SIGNED_IN,
      cloudRecord({ syncStatus: "pending" }),
      true,
    ],
    [
      "signed in, owned cache in conflict",
      SIGNED_IN,
      cloudRecord({ syncStatus: "conflict" }),
      true,
    ],
    [
      "signed in, owned cache deleted in cloud",
      SIGNED_IN,
      cloudRecord({ syncStatus: "deleted-in-cloud" }),
      true,
    ],
  ])("%s", (_name, auth, cached, isExpected) => {
    expect(shouldFetchCloud({ auth, cached })).toBe(isExpected);
  });
});

describe("decideOpenAction", () => {
  it.each<
    [
      string,
      OpenAuthContext,
      SchemaRecord | null,
      CloudFetchResult | null,
      OpenAction,
    ]
  >([
    [
      "guest cache, not called",
      SIGNED_IN,
      localRecord(),
      null,
      { kind: "open-cached", followUp: "none" },
    ],
    [
      "cache of another account, not called",
      SIGNED_IN,
      cloudRecord({ ownerId: OTHER_USER_ID }),
      null,
      { kind: "not-found", shouldOfferSignIn: false },
    ],
    [
      "no cache, signed out, not called",
      SIGNED_OUT,
      null,
      null,
      { kind: "not-found", shouldOfferSignIn: true },
    ],
    [
      "no cache, GET /schemas/:id found",
      SIGNED_IN,
      null,
      FOUND(1),
      { kind: "store-cloud-and-open", document: SAMPLE_DOCUMENT, revision: 1 },
    ],
    [
      "no cache, GET /schemas/:id 404",
      SIGNED_IN,
      null,
      NOT_FOUND,
      { kind: "not-found", shouldOfferSignIn: false },
    ],
    [
      "no cache, GET /schemas/:id unavailable",
      SIGNED_IN,
      null,
      UNAVAILABLE,
      { kind: "needs-network" },
    ],
    [
      "pending with no cloud revision, not called",
      SIGNED_IN,
      cloudRecord({ syncStatus: "pending", cloudRevision: null }),
      null,
      { kind: "open-cached", followUp: "push-create" },
    ],
    [
      "synced, GET /schemas/:id 200 same revision",
      SIGNED_IN,
      cloudRecord({ syncStatus: "synced", cloudRevision: 3 }),
      FOUND(3),
      { kind: "open-cached", followUp: "none" },
    ],
    [
      "synced, GET /schemas/:id 200 different revision",
      SIGNED_IN,
      cloudRecord({ syncStatus: "synced", cloudRevision: 3 }),
      FOUND(4),
      { kind: "store-cloud-and-open", document: SAMPLE_DOCUMENT, revision: 4 },
    ],
    [
      "synced, GET /schemas/:id 404",
      SIGNED_IN,
      cloudRecord({ syncStatus: "synced" }),
      NOT_FOUND,
      { kind: "delete-cache-deleted-elsewhere" },
    ],
    [
      "pending, GET /schemas/:id 200 same revision",
      SIGNED_IN,
      cloudRecord({ syncStatus: "pending", cloudRevision: 3 }),
      FOUND(3),
      { kind: "open-cached", followUp: "push-update" },
    ],
    [
      "pending, GET /schemas/:id 200 different revision",
      SIGNED_IN,
      cloudRecord({ syncStatus: "pending", cloudRevision: 3 }),
      FOUND(4),
      {
        kind: "open-cached-with-conflict",
        cloud: cloudDetail({ revision: 4 }),
      },
    ],
    [
      "conflict, GET /schemas/:id 200 different revision",
      SIGNED_IN,
      cloudRecord({ syncStatus: "conflict", cloudRevision: 3 }),
      FOUND(4),
      {
        kind: "open-cached-with-conflict",
        cloud: cloudDetail({ revision: 4 }),
      },
    ],
    [
      "pending, GET /schemas/:id 404",
      SIGNED_IN,
      cloudRecord({ syncStatus: "pending" }),
      NOT_FOUND,
      { kind: "open-cached-deleted-in-cloud" },
    ],
    [
      "conflict, GET /schemas/:id 404",
      SIGNED_IN,
      cloudRecord({ syncStatus: "conflict" }),
      NOT_FOUND,
      { kind: "open-cached-deleted-in-cloud" },
    ],
    [
      "deleted in cloud, GET /schemas/:id 404",
      SIGNED_IN,
      cloudRecord({ syncStatus: "deleted-in-cloud" }),
      NOT_FOUND,
      { kind: "open-cached-deleted-in-cloud" },
    ],
    [
      "owned cache, GET /schemas/:id unavailable",
      SIGNED_IN,
      cloudRecord({ syncStatus: "pending" }),
      UNAVAILABLE,
      { kind: "open-cached", followUp: "retry-when-online" },
    ],
    [
      "owned cache, session expired",
      EXPIRED,
      cloudRecord({ syncStatus: "pending" }),
      null,
      { kind: "open-cached", followUp: "wait-for-sign-in" },
    ],
  ])("%s", (_name, auth, cached, cloud, expected) => {
    expect(decideOpenAction({ auth, cached, cloud })).toEqual(expected);
  });

  it("returns cloud-version-unsupported without replacing the cache for a newer cloud document", () => {
    const versionUnsupported: CloudFetchResult = {
      kind: "found",
      detail: cloudDetail({
        revision: 4,
        document: { ...SAMPLE_DOCUMENT, version: 999 },
      }),
    };

    const action = decideOpenAction({
      auth: SIGNED_IN,
      cached: cloudRecord({ syncStatus: "synced", cloudRevision: 3 }),
      cloud: versionUnsupported,
    });

    expect(action).toEqual({ kind: "cloud-version-unsupported" });
  });

  it("reopens the conflict dialog when a conflicted cache matches the cloud revision", () => {
    const action = decideOpenAction({
      auth: SIGNED_IN,
      cached: cloudRecord({ syncStatus: "conflict", cloudRevision: 3 }),
      cloud: FOUND(3),
    });

    expect(action).toEqual({
      kind: "open-cached-with-conflict",
      cloud: cloudDetail({ revision: 3 }),
    });
  });

  it("treats a re-created cloud document as a conflict when the cache is deleted-in-cloud", () => {
    const action = decideOpenAction({
      auth: SIGNED_IN,
      cached: cloudRecord({ syncStatus: "deleted-in-cloud", cloudRevision: 3 }),
      cloud: FOUND(5),
    });

    expect(action).toEqual({
      kind: "open-cached-with-conflict",
      cloud: cloudDetail({ revision: 5 }),
    });
  });

  it("offers sign-in for an owned cache when signed out", () => {
    const action = decideOpenAction({
      auth: SIGNED_OUT,
      cached: cloudRecord(),
      cloud: null,
    });

    expect(action).toEqual({ kind: "not-found", shouldOfferSignIn: true });
  });

  it("falls back to retry-when-online when the cloud document has a non-version structural error", () => {
    const invalidShape: CloudFetchResult = {
      kind: "found",
      detail: cloudDetail({
        revision: 4,
        document: { ...SAMPLE_DOCUMENT, tables: null },
      }),
    };

    const action = decideOpenAction({
      auth: SIGNED_IN,
      cached: cloudRecord({ syncStatus: "synced", cloudRevision: 3 }),
      cloud: invalidShape,
    });

    expect(action).toEqual({
      kind: "open-cached",
      followUp: "retry-when-online",
    });
  });

  it("returns needs-network when there is no cache and the cloud document has a non-version structural error", () => {
    const invalidShape: CloudFetchResult = {
      kind: "found",
      detail: cloudDetail({
        revision: 1,
        document: { ...SAMPLE_DOCUMENT, tables: null },
      }),
    };

    const action = decideOpenAction({
      auth: SIGNED_IN,
      cached: null,
      cloud: invalidShape,
    });

    expect(action).toEqual({ kind: "needs-network" });
  });
});
