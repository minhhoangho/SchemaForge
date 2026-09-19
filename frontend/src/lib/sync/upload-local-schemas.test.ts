import { MAX_REQUEST_BODY_BYTES } from "@schemaforge/api-contract";
import type { SchemaDocument } from "@schemaforge/core";
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
import type { FakeLockRegistry } from "@/testing/fake-lock-registry";

import type { UploadReport } from "./upload-local-schemas";
import { uploadLocalSchemas } from "./upload-local-schemas";

const BASE_URL = "https://api.schemaforge.invalid";
const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const TIMESTAMP = "2026-09-18T00:00:00.000Z";
const ID_PREFIX = "00000000-0000-4000-8000-";
const NEW_ID_PREFIX = "00000000-0000-4000-9000-";
const SAMPLE_DOCUMENT = createSampleSchema();
const CHANGED_DOCUMENT: SchemaDocument = {
  ...SAMPLE_DOCUMENT,
  name: "Changed",
};

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

function newSchemaIdAt(count: number): string {
  return `${NEW_ID_PREFIX}${String(count).padStart(12, "0")}`;
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

function detailResponse(
  id: string,
  revision: number,
  document: unknown,
): Response {
  return jsonResponse(
    {
      id,
      name: SAMPLE_DOCUMENT.name,
      revision,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
      document,
    },
    200,
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
  readonly database: SchemaforgeDatabase;
  readonly repository: SchemaRepository;
  readonly fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>;
  readonly lockRegistry: FakeLockRegistry;
  readonly upload: (
    schemaIds: readonly string[],
    heldLockSchemaId?: string,
  ) => Promise<UploadReport>;
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
  const lockRegistry = createFakeLockRegistry();
  const lockManager = createSchemaLockManager(lockRegistry.request);
  let newIdCount = 0;
  return {
    database,
    repository,
    fetchImpl,
    lockRegistry,
    upload: (schemaIds, heldLockSchemaId) =>
      uploadLocalSchemas({
        api,
        repository,
        lockManager,
        userId: USER_ID,
        schemaIds,
        heldLockSchemaId,
        generateId: () => {
          newIdCount += 1;
          return newSchemaIdAt(newIdCount);
        },
      }),
  };
}

async function seedGuestSchema(
  repository: SchemaRepository,
  document: SchemaDocument = SAMPLE_DOCUMENT,
): Promise<string> {
  const record = await repository.createSchema("Billing");
  await repository.saveDocument(record.id, document);
  return record.id;
}

describe("uploadLocalSchemas", () => {
  it("uploads a guest schema and makes it owned and synced after 201", async () => {
    const { repository, fetchImpl, upload } = setUp();
    const schemaId = await seedGuestSchema(repository);
    fetchImpl.mockResolvedValueOnce(summaryResponse(schemaId, 1));

    const report = await upload([schemaId]);

    expect(report.uploadedIds).toEqual([schemaId]);
    expect(report.skipped).toEqual([]);
    expect(report.stoppedBy).toBeNull();
    await expect(repository.readSchemaRecord(schemaId)).resolves.toMatchObject({
      ownerId: USER_ID,
      cloudRevision: 1,
      syncStatus: "synced",
    });
  });

  it("treats 409 with an equal cloud document as already uploaded", async () => {
    const { repository, fetchImpl, upload } = setUp();
    const schemaId = await seedGuestSchema(repository);
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "schema-id-unavailable" }),
      )
      .mockResolvedValueOnce(detailResponse(schemaId, 2, SAMPLE_DOCUMENT));

    const report = await upload([schemaId]);

    expect(report.uploadedIds).toEqual([schemaId]);
    await expect(repository.readSchemaRecord(schemaId)).resolves.toMatchObject({
      ownerId: USER_ID,
      cloudRevision: 2,
      syncStatus: "synced",
    });
  });

  it("marks conflict for 409 with a different cloud document", async () => {
    const { repository, fetchImpl, upload } = setUp();
    const schemaId = await seedGuestSchema(repository);
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "schema-id-unavailable" }),
      )
      .mockResolvedValueOnce(detailResponse(schemaId, 2, CHANGED_DOCUMENT));

    const report = await upload([schemaId]);

    expect(report.uploadedIds).toEqual([schemaId]);
    await expect(repository.readSchemaRecord(schemaId)).resolves.toMatchObject({
      ownerId: USER_ID,
      cloudRevision: 2,
      syncStatus: "conflict",
    });
  });

  it("moves the schema to a new id and creates it again after 409 then 404", async () => {
    const { repository, fetchImpl, upload } = setUp();
    const schemaId = await seedGuestSchema(repository);
    const newId = newSchemaIdAt(1);
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "schema-id-unavailable" }),
      )
      .mockResolvedValueOnce(errorResponse(404, { code: "not-found" }))
      .mockResolvedValueOnce(summaryResponse(newId, 1));

    const report = await upload([schemaId]);

    expect(report.uploadedIds).toEqual([newId]);
    await expect(repository.readSchemaRecord(schemaId)).resolves.toBeNull();
    await expect(repository.readSchemaRecord(newId)).resolves.toMatchObject({
      ownerId: USER_ID,
      cloudRevision: 1,
      syncStatus: "synced",
    });
  });

  it("reports the old and new id in movedIds when a schema is moved to a new id", async () => {
    const { repository, fetchImpl, upload } = setUp();
    const schemaId = await seedGuestSchema(repository);
    const newId = newSchemaIdAt(1);
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "schema-id-unavailable" }),
      )
      .mockResolvedValueOnce(errorResponse(404, { code: "not-found" }))
      .mockResolvedValueOnce(summaryResponse(newId, 1));

    const report = await upload([schemaId]);

    expect(report.movedIds).toEqual(new Map([[schemaId, newId]]));
  });

  it("leaves movedIds empty when no schema is moved", async () => {
    const { repository, fetchImpl, upload } = setUp();
    const schemaId = await seedGuestSchema(repository);
    fetchImpl.mockResolvedValueOnce(summaryResponse(schemaId, 1));

    const report = await upload([schemaId]);

    expect(report.movedIds.size).toBe(0);
  });

  it("keeps the moved id in movedIds when the retry after moving fails on the network", async () => {
    // changeSchemaId already committed the move in storage, so movedIds must
    // still report it even though the run stops with no cloud upload.
    const { repository, fetchImpl, upload } = setUp();
    const schemaId = await seedGuestSchema(repository);
    const newId = newSchemaIdAt(1);
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "schema-id-unavailable" }),
      )
      .mockResolvedValueOnce(errorResponse(404, { code: "not-found" }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const report = await upload([schemaId]);

    expect(report.stoppedBy).toBe("unavailable");
    expect(report.uploadedIds).toEqual([]);
    expect(report.movedIds).toEqual(new Map([[schemaId, newId]]));
    await expect(repository.readSchemaRecord(schemaId)).resolves.toBeNull();
    await expect(repository.readSchemaRecord(newId)).resolves.toMatchObject({
      ownerId: null,
    });
  });

  it("keeps the moved id in movedIds when the retry after moving is rejected again", async () => {
    const { repository, fetchImpl, upload } = setUp();
    const schemaId = await seedGuestSchema(repository);
    const newId = newSchemaIdAt(1);
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "schema-id-unavailable" }),
      )
      .mockResolvedValueOnce(errorResponse(404, { code: "not-found" }))
      .mockResolvedValueOnce(
        errorResponse(409, { code: "schema-id-unavailable" }),
      );

    const report = await upload([schemaId]);

    expect(report.skipped).toEqual([{ schemaId, reason: "rejected" }]);
    expect(report.movedIds).toEqual(new Map([[schemaId, newId]]));
  });

  it("stops with unavailable when loading the cloud version after 409 fails for a reason other than not-found", async () => {
    const { fetchImpl, upload, repository } = setUp();
    const schemaId = await seedGuestSchema(repository);
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "schema-id-unavailable" }),
      )
      .mockResolvedValueOnce(errorResponse(503, { code: "internal-error" }));

    const report = await upload([schemaId]);

    expect(report.stoppedBy).toBe("unavailable");
    expect(report.movedIds.size).toBe(0);
  });

  it("skips a schema whose new id is already taken locally after moving", async () => {
    const { database, repository, fetchImpl, upload } = setUp();
    const schemaId = await seedGuestSchema(repository);
    const newId = newSchemaIdAt(1);
    await database.schemas.put({
      id: newId,
      name: "Taken",
      createdAt: 1,
      updatedAt: 1,
      ownerId: null,
      cloudRevision: null,
      syncStatus: null,
    });
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "schema-id-unavailable" }),
      )
      .mockResolvedValueOnce(errorResponse(404, { code: "not-found" }));

    const report = await upload([schemaId]);

    expect(report.skipped).toEqual([{ schemaId, reason: "rejected" }]);
    expect(report.movedIds.size).toBe(0);
  });

  it("skips a schema whose record disappeared before the move could apply", async () => {
    const { repository, fetchImpl, upload } = setUp();
    const schemaId = await seedGuestSchema(repository);
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "schema-id-unavailable" }),
      )
      .mockImplementationOnce(async () => {
        await repository.deleteSchema(schemaId);
        return errorResponse(404, { code: "not-found" });
      });

    const report = await upload([schemaId]);

    expect(report.skipped).toEqual([{ schemaId, reason: "rejected" }]);
    expect(report.movedIds.size).toBe(0);
  });

  it("stops the whole run on schema-limit-reached and leaves remaining schemas unchanged", async () => {
    const { repository, fetchImpl, upload } = setUp();
    const firstId = await seedGuestSchema(repository);
    const secondId = await seedGuestSchema(repository);
    fetchImpl.mockResolvedValueOnce(
      errorResponse(403, { code: "schema-limit-reached" }),
    );

    const report = await upload([firstId, secondId]);

    expect(report.stoppedBy).toBe("schema-limit-reached");
    expect(report.notAttemptedIds).toEqual([firstId, secondId]);
    expect(report.uploadedIds).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await expect(repository.readSchemaRecord(secondId)).resolves.toMatchObject({
      ownerId: null,
    });
  });

  it("stops the whole run on a network failure", async () => {
    const { repository, fetchImpl, upload } = setUp();
    const firstId = await seedGuestSchema(repository);
    const secondId = await seedGuestSchema(repository);
    fetchImpl.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const report = await upload([firstId, secondId]);

    expect(report.stoppedBy).toBe("unavailable");
    expect(report.notAttemptedIds).toEqual([firstId, secondId]);
    await expect(repository.readSchemaRecord(secondId)).resolves.toMatchObject({
      ownerId: null,
    });
  });

  it.each([
    ["payload-too-large" as const, 413, {}],
    ["document-invalid" as const, 422, { documentErrors: [] }],
  ])(
    "skips a schema rejected with %s and continues",
    async (code, status, extraBody) => {
      const { repository, fetchImpl, upload } = setUp();
      const firstId = await seedGuestSchema(repository);
      const secondId = await seedGuestSchema(repository);
      fetchImpl
        .mockResolvedValueOnce(errorResponse(status, { code, ...extraBody }))
        .mockResolvedValueOnce(summaryResponse(secondId, 1));

      const report = await upload([firstId, secondId]);

      expect(report.skipped).toEqual([
        { schemaId: firstId, reason: "rejected" },
      ]);
      expect(report.uploadedIds).toEqual([secondId]);
    },
  );

  it("skips a schema rejected with validation-failed and continues", async () => {
    const { repository, fetchImpl, upload } = setUp();
    const firstId = await seedGuestSchema(repository);
    const secondId = await seedGuestSchema(repository);
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(400, { code: "validation-failed", fields: [] }),
      )
      .mockResolvedValueOnce(summaryResponse(secondId, 1));

    const report = await upload([firstId, secondId]);

    expect(report.skipped).toEqual([{ schemaId: firstId, reason: "rejected" }]);
    expect(report.uploadedIds).toEqual([secondId]);
  });

  it("stops the whole run on origin-not-allowed", async () => {
    const { repository, fetchImpl, upload } = setUp();
    const firstId = await seedGuestSchema(repository);
    const secondId = await seedGuestSchema(repository);
    fetchImpl.mockResolvedValueOnce(
      errorResponse(403, { code: "origin-not-allowed" }),
    );

    const report = await upload([firstId, secondId]);

    expect(report.stoppedBy).toBe("unavailable");
    expect(report.notAttemptedIds).toEqual([firstId, secondId]);
  });

  it("does not report a schema whose record no longer exists", async () => {
    const { fetchImpl, upload } = setUp();
    const missingId = schemaIdAt(1);

    const report = await upload([missingId]);

    expect(report.uploadedIds).toEqual([]);
    expect(report.skipped).toEqual([]);
    expect(report.stoppedBy).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not report a schema already owned by the user", async () => {
    const { repository, fetchImpl, upload } = setUp();
    const record = await repository.createSchema("Billing", {
      ownerId: USER_ID,
    });
    await repository.saveDocument(record.id, SAMPLE_DOCUMENT);

    const report = await upload([record.id]);

    expect(report.uploadedIds).toEqual([]);
    expect(report.skipped).toEqual([]);
    expect(report.stoppedBy).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips a schema whose lock is held by another tab", async () => {
    const { repository, fetchImpl, lockRegistry, upload } = setUp();
    const schemaId = await seedGuestSchema(repository);
    const busyManager = createSchemaLockManager(lockRegistry.request);
    await busyManager.tryAcquire(schemaId);

    const report = await upload([schemaId]);

    expect(report.skipped).toEqual([{ schemaId, reason: "locked" }]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses the lock already held by the editor", async () => {
    const { repository, lockRegistry, fetchImpl, upload } = setUp();
    const schemaId = await seedGuestSchema(repository);
    const editorLockManager = createSchemaLockManager(lockRegistry.request);
    const editorLock = await editorLockManager.tryAcquire(schemaId);
    fetchImpl.mockResolvedValueOnce(summaryResponse(schemaId, 1));

    const report = await upload([schemaId], schemaId);

    expect(report.uploadedIds).toEqual([schemaId]);
    expect(lockRegistry.isHeld(`schemaforge:schema:${schemaId}`)).toBe(true);
    editorLock?.release();
  });

  it("skips an unreadable document", async () => {
    const { database, repository, fetchImpl, upload } = setUp();
    const record = await repository.createSchema("Billing");
    await database.documents.put({
      schemaId: record.id,
      document: { invalid: true },
    });

    const report = await upload([record.id]);

    expect(report.skipped).toEqual([
      { schemaId: record.id, reason: "unreadable" },
    ]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips a document over the size limit without calling the API", async () => {
    const { repository, fetchImpl, upload } = setUp();
    const schemaId = await seedGuestSchema(repository, {
      ...SAMPLE_DOCUMENT,
      name: "x".repeat(MAX_REQUEST_BODY_BYTES),
    });

    const report = await upload([schemaId]);

    expect(report.skipped).toEqual([{ schemaId, reason: "too-large" }]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("keeps the record as a guest schema when the request fails midway", async () => {
    const { repository, fetchImpl, upload } = setUp();
    const schemaId = await seedGuestSchema(repository);
    fetchImpl.mockResolvedValueOnce(
      errorResponse(403, { code: "schema-limit-reached" }),
    );

    await upload([schemaId]);

    await expect(repository.readSchemaRecord(schemaId)).resolves.toMatchObject({
      ownerId: null,
      cloudRevision: null,
      syncStatus: null,
    });
  });

  it("releases every lock it acquired", async () => {
    const { repository, fetchImpl, lockRegistry, upload } = setUp();
    const firstId = await seedGuestSchema(repository);
    const secondId = await seedGuestSchema(repository);
    fetchImpl
      .mockResolvedValueOnce(summaryResponse(firstId, 1))
      .mockResolvedValueOnce(summaryResponse(secondId, 1));

    await upload([firstId, secondId]);

    expect(lockRegistry.isHeld(`schemaforge:schema:${firstId}`)).toBe(false);
    expect(lockRegistry.isHeld(`schemaforge:schema:${secondId}`)).toBe(false);
  });
});
