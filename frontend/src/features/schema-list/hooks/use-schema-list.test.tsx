import { renderHook, waitFor } from "@testing-library/react";
import { Dexie } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { AuthState } from "@/lib/auth/auth-store";
import { logger } from "@/lib/logger";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import { mergeSchemaList } from "@/lib/sync/merge-schema-list";

import type { CloudSchemaListState } from "./use-cloud-schema-list";
import { useSchemaList } from "./use-schema-list";

const SCHEMA_ID = "00000000-0000-4000-8000-000000000001";
const CLOUD_SCHEMA_ID = "00000000-0000-4000-8000-000000000009";
const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const SIGNED_OUT: AuthState = { status: "signed-out" };
const SIGNED_IN: AuthState = {
  status: "signed-in",
  user: { id: USER_ID, email: "user@example.com" },
};
const IDLE: CloudSchemaListState = { kind: "idle" };

describe("useSchemaList", () => {
  const databases = new Set<SchemaforgeDatabase>();

  beforeAll(() => {
    // liveQuery skips every query while Dexie finds no global IndexedDB, and
    // jsdom has none; each database below still gets its own factory.
    Dexie.dependencies.indexedDB = new IDBFactory();
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  });

  function createRepository(): SchemaRepository {
    const database = new SchemaforgeDatabase({
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    databases.add(database);
    return createSchemaRepository({
      database,
      clock: () => 1,
      generateId: () => SCHEMA_ID,
    });
  }

  afterEach(() => {
    databases.forEach((database) => {
      database.close();
    });
    databases.clear();
    vi.restoreAllMocks();
  });

  it("returns undefined while the query is loading", () => {
    const repository = createRepository();

    const { result } = renderHook(() =>
      useSchemaList({ repository, auth: SIGNED_OUT, cloud: IDLE }),
    );

    expect(result.current).toBeUndefined();
  });

  it("updates when a schema is added", async () => {
    const repository = createRepository();
    const { result } = renderHook(() =>
      useSchemaList({ repository, auth: SIGNED_OUT, cloud: IDLE }),
    );
    await waitFor(() => {
      expect(result.current).toMatchObject({
        kind: "loaded",
        list: { guest: [] },
      });
    });

    await repository.createSchema("shop");

    await waitFor(() => {
      expect(result.current).toMatchObject({
        kind: "loaded",
        list: {
          guest: [
            {
              kind: "readable",
              schema: {
                id: SCHEMA_ID,
                name: "shop",
                createdAt: 1,
                updatedAt: 1,
                ownerId: null,
                cloudRevision: null,
                syncStatus: null,
              },
            },
          ],
        },
      });
    });
  });

  it("passes the cached records and cloud items to mergeSchemaList", async () => {
    const repository = createRepository();
    await repository.createSchema("shop", { ownerId: USER_ID });
    const cloudItem = {
      id: CLOUD_SCHEMA_ID,
      name: "blog",
      revision: 1,
      createdAt: "2026-09-18T00:00:00.000Z",
      updatedAt: "2026-09-18T00:00:00.000Z",
    };
    const cloud: CloudSchemaListState = {
      kind: "loaded",
      items: [cloudItem],
      isComplete: true,
    };

    const { result } = renderHook(() =>
      useSchemaList({ repository, auth: SIGNED_IN, cloud }),
    );

    const expected = mergeSchemaList({
      auth: { status: "signed-in", userId: USER_ID },
      cachedEntries: await repository.listSchemas(),
      cloudItems: [cloudItem],
      isCloudListComplete: true,
    });
    await waitFor(() => {
      expect(result.current).toEqual({ kind: "loaded", list: expected });
    });
  });

  it("keeps reporting a storage read failure", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const repository = createRepository();
    const quotaError = new Error("The quota was exceeded.");
    quotaError.name = "QuotaExceededError";
    const failingRepository: SchemaRepository = {
      ...repository,
      listSchemas: vi
        .fn<SchemaRepository["listSchemas"]>()
        .mockRejectedValue(quotaError),
    };

    const { result } = renderHook(() =>
      useSchemaList({
        repository: failingRepository,
        auth: SIGNED_IN,
        cloud: IDLE,
      }),
    );

    await waitFor(() => {
      expect(result.current).toEqual({
        kind: "failed",
        errorCode: "quota-exceeded",
      });
    });
  });
});
