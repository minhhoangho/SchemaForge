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
const OTHER_USER_ID = "6a2d3e4f-5b6c-4d7e-9f80-a1b2c3d4e5f6";
const SYNCED_ID = "00000000-0000-4000-8000-000000000101";
const OTHER_SYNCED_ID = "00000000-0000-4000-8000-000000000102";
const BROKEN_ID = "00000000-0000-4000-8000-000000000103";
const BROKEN_OTHER_ID = "00000000-0000-4000-8000-000000000104";
const BROKEN_GUEST_ID = "00000000-0000-4000-8000-000000000105";
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

// The copy was cached while the previous account was signed in here, which the
// session row records: writeCloudCopy writes nothing without it.
async function writeSyncedCopy(
  repository: SchemaRepository,
  id: string,
): Promise<void> {
  await repository.writeSession({
    userId: PREVIOUS_USER_ID,
    email: "user@example.com",
  });
  await repository.writeCloudCopy({
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

// A row an older or newer release could have written: it carries an ownerId but
// matches neither record shape, so parseSchemaRecord rejects it and it never
// reaches listOwnedSchemas.
async function seedUnparsableRow(
  database: SchemaforgeDatabase,
  id: string,
  ownerId: string | null,
): Promise<void> {
  await database.table<unknown>("schemas").put({
    id,
    name: "Broken",
    createdAt: 1,
    updatedAt: 1,
    ownerId,
    cloudRevision: null,
    syncStatus: "unknown",
  });
  await database.documents.put({ schemaId: id, document: { broken: true } });
  await database.viewports.put({ schemaId: id, x: 1, y: 2, zoom: 1 });
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

  it("deletes a row of the previous account that does not parse", async () => {
    const fixture = setUp();
    await seedUnparsableRow(fixture.database, BROKEN_ID, PREVIOUS_USER_ID);

    const result = await runForget(fixture);

    expect(result).toEqual({ removedIds: [], keptIds: [] });
    await expect(
      fixture.database.schemas.get(BROKEN_ID),
    ).resolves.toBeUndefined();
  });

  it("deletes the document and the viewport of an unreadable row", async () => {
    const fixture = setUp();
    await seedUnparsableRow(fixture.database, BROKEN_ID, PREVIOUS_USER_ID);

    await runForget(fixture);

    await expect(
      Promise.all([
        fixture.database.documents.get(BROKEN_ID),
        fixture.database.viewports.get(BROKEN_ID),
      ]),
    ).resolves.toEqual([undefined, undefined]);
  });

  it("keeps an unreadable row that belongs to another account", async () => {
    const fixture = setUp();
    await seedUnparsableRow(fixture.database, BROKEN_OTHER_ID, OTHER_USER_ID);

    await runForget(fixture);

    await expect(
      Promise.all([
        fixture.database.schemas.get(BROKEN_OTHER_ID),
        fixture.database.documents.get(BROKEN_OTHER_ID),
        fixture.database.viewports.get(BROKEN_OTHER_ID),
      ]),
    ).resolves.not.toContain(undefined);
  });

  it("keeps an unreadable guest row", async () => {
    const fixture = setUp();
    await seedUnparsableRow(fixture.database, BROKEN_GUEST_ID, null);

    await runForget(fixture);

    await expect(
      Promise.all([
        fixture.database.schemas.get(BROKEN_GUEST_ID),
        fixture.database.documents.get(BROKEN_GUEST_ID),
        fixture.database.viewports.get(BROKEN_GUEST_ID),
      ]),
    ).resolves.not.toContain(undefined);
  });

  it("keeps a pending record of the previous account while deleting its unreadable rows", async () => {
    const fixture = setUp();
    const pendingId = await createOwnedWithStatus(
      fixture.repository,
      "pending",
    );
    await seedUnparsableRow(fixture.database, BROKEN_ID, PREVIOUS_USER_ID);

    const result = await runForget(fixture);

    expect(result).toEqual({ removedIds: [], keptIds: [pendingId] });
    await expect(
      fixture.repository.readSchemaRecord(pendingId),
    ).resolves.not.toBeNull();
    await expect(
      fixture.database.schemas.get(BROKEN_ID),
    ).resolves.toBeUndefined();
  });

  it("keeps a synced record whose lock is held while deleting unreadable rows", async () => {
    const fixture = setUp();
    await writeSyncedCopy(fixture.repository, SYNCED_ID);
    await seedUnparsableRow(fixture.database, BROKEN_ID, PREVIOUS_USER_ID);
    const editorTab = createSchemaLockManager(fixture.registry.request);
    await editorTab.tryAcquire(SYNCED_ID);

    const result = await runForget(fixture);

    expect(result).toEqual({ removedIds: [], keptIds: [SYNCED_ID] });
    await expect(
      fixture.repository.readSchemaRecord(SYNCED_ID),
    ).resolves.not.toBeNull();
    await expect(
      fixture.database.schemas.get(BROKEN_ID),
    ).resolves.toBeUndefined();
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
