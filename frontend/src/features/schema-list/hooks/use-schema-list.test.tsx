import { renderHook, waitFor } from "@testing-library/react";
import { Dexie } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import type { SchemaRepository } from "@/lib/storage/schema-repository";

import { useSchemaList } from "./use-schema-list";

const SCHEMA_ID = "00000000-0000-4000-8000-000000000001";

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

    const { result } = renderHook(() => useSchemaList(repository));

    expect(result.current).toBeUndefined();
  });

  it("updates when a schema is added", async () => {
    const repository = createRepository();
    const { result } = renderHook(() => useSchemaList(repository));
    await waitFor(() => {
      expect(result.current).toEqual({ kind: "loaded", entries: [] });
    });

    await repository.createSchema("shop");

    await waitFor(() => {
      expect(result.current).toEqual({
        kind: "loaded",
        entries: [
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
      });
    });
  });

  it("reports a storage error code when the list cannot be read", async () => {
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

    const { result } = renderHook(() => useSchemaList(failingRepository));

    await waitFor(() => {
      expect(result.current).toEqual({
        kind: "failed",
        errorCode: "quota-exceeded",
      });
    });
  });
});
