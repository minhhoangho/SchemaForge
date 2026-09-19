import { createSampleSchema } from "@schemaforge/core/testing";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";

import { SchemaforgeDatabase } from "@/lib/storage/database";
import type { SyncStatus } from "@/lib/storage/records";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import type { SchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import type { FakeLockRegistry } from "@/testing/fake-lock-registry";

import { forgetPreviousAccount } from "./forget-previous-account";

const PREVIOUS_USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const SYNCED_ID = "00000000-0000-4000-8000-000000000101";
const OTHER_SYNCED_ID = "00000000-0000-4000-8000-000000000102";
const LOCK_PREFIX = "schemaforge:schema:";

type Fixture = {
  readonly database: SchemaforgeDatabase;
  readonly repository: SchemaRepository;
  readonly registry: FakeLockRegistry;
  readonly lockManager: SchemaLockManager;
};

function createIdGenerator(): () => string {
  let count = 0;
  return () => {
    count += 1;
    return `00000000-0000-4000-8000-${String(count).padStart(12, "0")}`;
  };
}

function writeSyncedCopy(
  repository: SchemaRepository,
  id: string,
): Promise<void> {
  return repository.writeCloudCopy({
    id,
    ownerId: PREVIOUS_USER_ID,
    document: createSampleSchema(),
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
  });
}

async function createOwnedWithStatus(
  repository: SchemaRepository,
  syncStatus: SyncStatus,
): Promise<string> {
  const record = await repository.createSchema(syncStatus, {
    ownerId: PREVIOUS_USER_ID,
  });
  await repository.setSyncState(record.id, { cloudRevision: 1, syncStatus });
  return record.id;
}

describe("forgetPreviousAccount", () => {
  const databases = new Set<SchemaforgeDatabase>();

  function setUp(): Fixture {
    const database = new SchemaforgeDatabase({
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    databases.add(database);
    const registry = createFakeLockRegistry();
    return {
      database,
      repository: createSchemaRepository({
        database,
        clock: () => 1,
        generateId: createIdGenerator(),
      }),
      registry,
      lockManager: createSchemaLockManager(registry.request),
    };
  }

  function runForget(fixture: Fixture) {
    return forgetPreviousAccount({
      repository: fixture.repository,
      lockManager: fixture.lockManager,
      previousUserId: PREVIOUS_USER_ID,
    });
  }

  afterEach(() => {
    databases.forEach((database) => {
      database.close();
    });
    databases.clear();
  });

  it("removes synced records of the previous account", async () => {
    const fixture = setUp();
    const { database, repository } = fixture;
    await writeSyncedCopy(repository, SYNCED_ID);
    await repository.saveViewport({ schemaId: SYNCED_ID, x: 1, y: 2, zoom: 1 });

    const result = await runForget(fixture);

    expect(result).toEqual({ removedIds: [SYNCED_ID], keptIds: [] });
    await expect(
      Promise.all([
        database.schemas.get(SYNCED_ID),
        database.documents.get(SYNCED_ID),
        database.viewports.get(SYNCED_ID),
      ]),
    ).resolves.toEqual([undefined, undefined, undefined]);
    expect(fixture.registry.isHeld(`${LOCK_PREFIX}${SYNCED_ID}`)).toBe(false);
  });

  it("keeps pending, conflict and deleted-in-cloud records", async () => {
    const fixture = setUp();
    const { repository } = fixture;
    const keptIds = [
      await createOwnedWithStatus(repository, "pending"),
      await createOwnedWithStatus(repository, "conflict"),
      await createOwnedWithStatus(repository, "deleted-in-cloud"),
    ];

    const result = await runForget(fixture);

    expect(result.removedIds).toEqual([]);
    expect([...result.keptIds].sort()).toEqual([...keptIds].sort());
    await expect(
      repository.listOwnedSchemas(PREVIOUS_USER_ID),
    ).resolves.toHaveLength(3);
  });

  it("keeps a synced record whose lock is held", async () => {
    const fixture = setUp();
    await writeSyncedCopy(fixture.repository, SYNCED_ID);
    await writeSyncedCopy(fixture.repository, OTHER_SYNCED_ID);
    const editorTab = createSchemaLockManager(fixture.registry.request);
    await editorTab.tryAcquire(SYNCED_ID);

    const result = await runForget(fixture);

    expect(result).toEqual({
      removedIds: [OTHER_SYNCED_ID],
      keptIds: [SYNCED_ID],
    });
    await expect(
      fixture.repository.readSchemaRecord(SYNCED_ID),
    ).resolves.not.toBeNull();
  });

  it("keeps a record that stopped being synced before its lock was taken", async () => {
    const fixture = setUp();
    await writeSyncedCopy(fixture.repository, SYNCED_ID);
    const repository: SchemaRepository = {
      ...fixture.repository,
      // Another tab saves the schema between the listing and the lock.
      listOwnedSchemas: async (ownerId) => {
        const records = await fixture.repository.listOwnedSchemas(ownerId);
        await fixture.repository.saveDocument(SYNCED_ID, createSampleSchema());
        return records;
      },
    };

    const result = await forgetPreviousAccount({
      repository,
      lockManager: fixture.lockManager,
      previousUserId: PREVIOUS_USER_ID,
    });

    expect(result).toEqual({ removedIds: [], keptIds: [SYNCED_ID] });
    await expect(
      fixture.repository.readSchemaRecord(SYNCED_ID),
    ).resolves.toMatchObject({ syncStatus: "pending" });
  });

  it("leaves guest records untouched", async () => {
    const fixture = setUp();
    const guest = await fixture.repository.createSchema("Guest");
    await writeSyncedCopy(fixture.repository, SYNCED_ID);

    await runForget(fixture);

    await expect(
      fixture.repository.readSchemaRecord(guest.id),
    ).resolves.toEqual(guest);
    await expect(
      fixture.repository.openSchema(guest.id),
    ).resolves.toMatchObject({ kind: "opened", document: { name: "Guest" } });
  });

  it("leaves the session record in place", async () => {
    const fixture = setUp();
    const session = { userId: PREVIOUS_USER_ID, email: "user@example.com" };
    await fixture.repository.writeSession(session);

    await runForget(fixture);

    await expect(fixture.repository.readSession()).resolves.toEqual({
      key: "current",
      ...session,
    });
  });
});
