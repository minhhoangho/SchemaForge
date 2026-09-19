import { createSampleSchema } from "@schemaforge/core/testing";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/lib/api/api-client";
import type { SessionRefresher } from "@/lib/api/session-refresher";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";

import { syncPendingSchemas } from "./sync-pending-schemas";

const BASE_URL = "https://api.schemaforge.invalid";
const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const OTHER_USER_ID = "6a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const TIMESTAMP = "2026-09-18T00:00:00.000Z";
const ID_PREFIX = "00000000-0000-4000-8000-";
const SAMPLE_DOCUMENT = createSampleSchema();

const databases = new Set<SchemaforgeDatabase>();

afterEach(() => {
  databases.forEach((database) => {
    database.close();
  });
  databases.clear();
  vi.restoreAllMocks();
});

function schemaIdAt(count: number): string {
  return `${ID_PREFIX}${String(count).padStart(12, "0")}`;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function summaryResponse(id: string, revision: number, status = 201): Response {
  return jsonResponse(
    {
      id,
      name: SAMPLE_DOCUMENT.name,
      revision,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    },
    status,
  );
}

function errorResponse(
  status: number,
  body: Record<string, unknown>,
): Response {
  return jsonResponse({ statusCode: status, ...body }, status);
}

const expiredSessionRefresher: SessionRefresher = {
  refresh: () =>
    Promise.resolve({
      isOk: false,
      error: {
        kind: "http",
        status: 401,
        body: { statusCode: 401, code: "session-expired" },
        retryAfterSeconds: null,
      },
    }),
};

type Fixture = {
  readonly repository: SchemaRepository;
  readonly fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>;
  readonly run: () => ReturnType<typeof syncPendingSchemas>;
};

function setUp(): Fixture {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  databases.add(database);
  let idCount = 0;
  let clockValue = 0;
  const repository = createSchemaRepository({
    database,
    clock: () => {
      clockValue += 1;
      return clockValue;
    },
    generateId: () => {
      idCount += 1;
      return schemaIdAt(idCount);
    },
  });
  const fetchImpl = vi.fn<typeof fetch>();
  const api = createApiClient({
    baseUrl: BASE_URL,
    fetchImpl,
    sessionRefresher: expiredSessionRefresher,
    onSessionExpired: vi.fn(),
  });
  const lockManager = createSchemaLockManager(createFakeLockRegistry().request);
  return {
    repository,
    fetchImpl,
    run: () =>
      syncPendingSchemas({ api, repository, lockManager, userId: USER_ID }),
  };
}

async function seedPending(
  repository: SchemaRepository,
  ownerId: string | null,
): Promise<string> {
  const record = await repository.createSchema(
    "Billing",
    ownerId === null ? undefined : { ownerId },
  );
  await repository.saveDocument(record.id, SAMPLE_DOCUMENT);
  return record.id;
}

describe("syncPendingSchemas", () => {
  it("pushes only pending records of the signed-in user", async () => {
    const { repository, fetchImpl, run } = setUp();
    const firstId = await seedPending(repository, USER_ID);
    const secondId = await seedPending(repository, USER_ID);
    fetchImpl
      .mockResolvedValueOnce(summaryResponse(firstId, 1))
      .mockResolvedValueOnce(summaryResponse(secondId, 1));

    const report = await run();

    expect([...report.syncedIds].sort()).toEqual([firstId, secondId].sort());
    expect(report.stoppedBy).toBeNull();
  });

  it("ignores guest records and records of other accounts", async () => {
    const { repository, fetchImpl, run } = setUp();
    await seedPending(repository, null);
    await seedPending(repository, OTHER_USER_ID);
    const ownedId = await seedPending(repository, USER_ID);
    fetchImpl.mockResolvedValueOnce(summaryResponse(ownedId, 1));

    const report = await run();

    expect(report.syncedIds).toEqual([ownedId]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("skips a record whose lock is busy", async () => {
    const registry = createFakeLockRegistry();
    const busyManager = createSchemaLockManager(registry.request);
    const database = new SchemaforgeDatabase({
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    databases.add(database);
    const repository = createSchemaRepository({
      database,
      clock: () => 1,
      generateId: () => schemaIdAt(1),
    });
    const schemaId = await seedPending(repository, USER_ID);
    await busyManager.tryAcquire(schemaId);
    const fetchImpl = vi.fn<typeof fetch>();
    const api = createApiClient({
      baseUrl: BASE_URL,
      fetchImpl,
      sessionRefresher: expiredSessionRefresher,
      onSessionExpired: vi.fn(),
    });
    const lockManager = createSchemaLockManager(registry.request);

    const report = await syncPendingSchemas({
      api,
      repository,
      lockManager,
      userId: USER_ID,
    });

    expect(report.lockedIds).toEqual([schemaId]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("marks conflict on revision-conflict without opening a dialog", async () => {
    const { repository, fetchImpl, run } = setUp();
    const schemaId = await seedPending(repository, USER_ID);
    await repository.setSyncState(schemaId, {
      cloudRevision: 3,
      syncStatus: "pending",
    });
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "revision-conflict", currentRevision: 5 }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            id: schemaId,
            name: SAMPLE_DOCUMENT.name,
            revision: 5,
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
            document: SAMPLE_DOCUMENT,
          },
          200,
        ),
      );

    const report = await run();

    expect(report.conflictIds).toEqual([schemaId]);
    expect(report.syncedIds).toEqual([]);
  });

  it("records deleted-in-cloud on 404", async () => {
    const { repository, fetchImpl, run } = setUp();
    const schemaId = await seedPending(repository, USER_ID);
    await repository.setSyncState(schemaId, {
      cloudRevision: 3,
      syncStatus: "pending",
    });
    fetchImpl.mockResolvedValueOnce(errorResponse(404, { code: "not-found" }));

    const report = await run();

    expect(report.deletedInCloudIds).toEqual([schemaId]);
  });

  it("stops after the session expires", async () => {
    const { repository, fetchImpl, run } = setUp();
    const unattemptedId = await seedPending(repository, USER_ID);
    const attemptedId = await seedPending(repository, USER_ID);
    fetchImpl.mockResolvedValueOnce(
      errorResponse(401, { code: "unauthenticated" }),
    );

    const report = await run();

    expect(report.stoppedBy).toBe("session-expired");
    expect(report.syncedIds).toEqual([]);
    expect(report.conflictIds).toEqual([]);
    expect(report.deletedInCloudIds).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await expect(
      repository.readSchemaRecord(unattemptedId),
    ).resolves.toMatchObject({ syncStatus: "pending" });
    await expect(
      repository.readSchemaRecord(attemptedId),
    ).resolves.toMatchObject({ syncStatus: "pending" });
  });

  it("continues after a retryable failure", async () => {
    const { repository, fetchImpl, run } = setUp();
    const earlierId = await seedPending(repository, USER_ID);
    const laterId = await seedPending(repository, USER_ID);
    // listOwnedSchemas orders by updatedAt descending, so laterId is pushed
    // first and fails; earlierId is pushed next and succeeds.
    fetchImpl
      .mockResolvedValueOnce(errorResponse(503, { code: "internal-error" }))
      .mockResolvedValueOnce(summaryResponse(earlierId, 1));

    const report = await run();

    expect(report.syncedIds).toEqual([earlierId]);
    expect(report.stoppedBy).toBeNull();
    await expect(repository.readSchemaRecord(laterId)).resolves.toMatchObject({
      syncStatus: "pending",
    });
  });

  it("shares one run between concurrent calls", async () => {
    const { repository, fetchImpl, run } = setUp();
    const schemaId = await seedPending(repository, USER_ID);
    fetchImpl.mockResolvedValueOnce(summaryResponse(schemaId, 1));

    const [first, second] = [run(), run()];

    expect(first).toBe(second);
    const report = await first;
    expect(report.syncedIds).toEqual([schemaId]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
