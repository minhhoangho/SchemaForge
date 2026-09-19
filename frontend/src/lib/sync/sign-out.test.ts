import { createSampleSchema } from "@schemaforge/core/testing";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/lib/api/api-client";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import type { SchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import type { FakeLockRegistry } from "@/testing/fake-lock-registry";

import {
  countUnsyncedSchemas,
  SIGN_OUT_LOCK_TIMEOUT_MS,
  signOut,
} from "./sign-out";

const BASE_URL = "https://api.schemaforge.invalid";
const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const OTHER_USER_ID = "6a2d3e4f-5b6c-4d7e-9f80-a1b2c3d4e5f6";
const SYNCED_ID = "00000000-0000-4000-8000-000000000101";
const OTHER_ACCOUNT_ID = "00000000-0000-4000-8000-000000000102";
const LOCK_PREFIX = "schemaforge:schema:";
const NO_CONTENT_STATUS = 204;

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

function logoutResponse(status: number): Response {
  return status === NO_CONTENT_STATUS
    ? new Response(null, { status })
    : new Response(
        JSON.stringify({ statusCode: status, code: "unauthenticated" }),
        { status, headers: { "Content-Type": "application/json" } },
      );
}

function createFetch(status: number): typeof fetch {
  return vi.fn<typeof fetch>(() => Promise.resolve(logoutResponse(status)));
}

function createUnparsableFetch(): typeof fetch {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(JSON.stringify({ unexpected: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

function createFailingFetch(): typeof fetch {
  return vi.fn<typeof fetch>(() =>
    Promise.reject(new TypeError("Failed to fetch")),
  );
}

function createClient(fetchImpl: typeof fetch) {
  return createApiClient({
    baseUrl: BASE_URL,
    fetchImpl,
    sessionRefresher: {
      refresh: () => Promise.resolve({ isOk: true, value: undefined }),
    },
    onSessionExpired: vi.fn(),
  });
}

function writeCloudCopy(
  repository: SchemaRepository,
  id: string,
  ownerId: string,
): Promise<void> {
  return repository.writeCloudCopy({
    id,
    ownerId,
    document: createSampleSchema(),
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
  });
}

// A macrotask runs only after every queued microtask and the fake IndexedDB
// callbacks that were already scheduled.
function flushPendingWork(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("sign-out", () => {
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

  function runSignOut(
    fixture: Fixture,
    overrides?: {
      readonly fetchImpl?: typeof fetch;
      readonly clearAuthHint?: () => void;
      readonly broadcastSignedOut?: () => void;
      readonly createTimeoutSignal?: (ms: number) => AbortSignal;
      readonly lockManager?: SchemaLockManager;
    },
  ) {
    return signOut({
      api: createClient(overrides?.fetchImpl ?? createFetch(NO_CONTENT_STATUS)),
      repository: fixture.repository,
      lockManager: overrides?.lockManager ?? fixture.lockManager,
      userId: USER_ID,
      clearAuthHint: overrides?.clearAuthHint ?? vi.fn(),
      broadcastSignedOut: overrides?.broadcastSignedOut ?? vi.fn(),
      createTimeoutSignal:
        overrides?.createTimeoutSignal ?? (() => new AbortController().signal),
    });
  }

  afterEach(() => {
    databases.forEach((database) => {
      database.close();
    });
    databases.clear();
  });

  it("counts owned records that are not synced", async () => {
    const { repository } = setUp();
    await writeCloudCopy(repository, SYNCED_ID, USER_ID);
    const conflict = await repository.createSchema("Orders", {
      ownerId: USER_ID,
    });
    await repository.setSyncState(conflict.id, {
      cloudRevision: 2,
      syncStatus: "conflict",
    });
    await repository.createSchema("Billing", { ownerId: USER_ID });
    await repository.createSchema("Other", { ownerId: OTHER_USER_ID });
    await repository.createSchema("Guest");

    await expect(
      countUnsyncedSchemas({ repository, userId: USER_ID }),
    ).resolves.toBe(2);
  });

  it("does not delete anything when logout fails with a network error", async () => {
    const fixture = setUp();
    await writeCloudCopy(fixture.repository, SYNCED_ID, USER_ID);
    const session = { userId: USER_ID, email: "user@example.com" };
    await fixture.repository.writeSession(session);

    const result = await runSignOut(fixture, {
      fetchImpl: createFailingFetch(),
    });

    expect(result).toEqual({
      isOk: false,
      error: { kind: "logout-failed", failure: { kind: "network" } },
    });
    await expect(
      fixture.repository.listOwnedSchemas(USER_ID),
    ).resolves.toHaveLength(1);
    await expect(fixture.repository.readSession()).resolves.toEqual({
      key: "current",
      ...session,
    });
  });

  it("does not clear the hint or broadcast when logout fails", async () => {
    const fixture = setUp();
    const clearAuthHint = vi.fn();
    const broadcastSignedOut = vi.fn();

    await runSignOut(fixture, {
      fetchImpl: createFailingFetch(),
      clearAuthHint,
      broadcastSignedOut,
    });

    expect(clearAuthHint).not.toHaveBeenCalled();
    expect(broadcastSignedOut).not.toHaveBeenCalled();
  });

  it("continues when logout returns 401", async () => {
    const fixture = setUp();
    await writeCloudCopy(fixture.repository, SYNCED_ID, USER_ID);

    const result = await runSignOut(fixture, { fetchImpl: createFetch(401) });

    expect(result).toEqual({ isOk: true, value: undefined });
    await expect(fixture.repository.listOwnedSchemas(USER_ID)).resolves.toEqual(
      [],
    );
  });

  it("deletes only the records of the account from all three tables", async () => {
    const fixture = setUp();
    const { database, repository } = fixture;
    await writeCloudCopy(repository, SYNCED_ID, USER_ID);
    await repository.saveViewport({ schemaId: SYNCED_ID, x: 1, y: 2, zoom: 1 });

    await runSignOut(fixture);

    await expect(
      Promise.all([
        database.schemas.get(SYNCED_ID),
        database.documents.get(SYNCED_ID),
        database.viewports.get(SYNCED_ID),
      ]),
    ).resolves.toEqual([undefined, undefined, undefined]);
  });

  it("keeps guest schemas and schemas of other accounts", async () => {
    const fixture = setUp();
    const { repository } = fixture;
    const guest = await repository.createSchema("Guest");
    await writeCloudCopy(repository, OTHER_ACCOUNT_ID, OTHER_USER_ID);
    await repository.createSchema("Pending", { ownerId: USER_ID });

    await runSignOut(fixture);

    await expect(repository.readSchemaRecord(guest.id)).resolves.toEqual(guest);
    await expect(
      repository.listOwnedSchemas(OTHER_USER_ID),
    ).resolves.toHaveLength(1);
    await expect(repository.listOwnedSchemas(USER_ID)).resolves.toEqual([]);
  });

  it("deletes the session record and clears the hint after a successful logout", async () => {
    const fixture = setUp();
    await fixture.repository.writeSession({
      userId: USER_ID,
      email: "user@example.com",
    });
    const clearAuthHint = vi.fn();

    const result = await runSignOut(fixture, { clearAuthHint });

    expect(result).toEqual({ isOk: true, value: undefined });
    await expect(fixture.repository.readSession()).resolves.toBeNull();
    expect(clearAuthHint).toHaveBeenCalledOnce();
  });

  it("broadcasts signed-out before reading the records to delete", async () => {
    const fixture = setUp();
    await writeCloudCopy(fixture.repository, SYNCED_ID, USER_ID);
    const listOwnedSchemas = vi.spyOn(fixture.repository, "listOwnedSchemas");
    const broadcastSignedOut = vi.fn();

    await runSignOut(fixture, { broadcastSignedOut });

    // The records are listed after the broadcast so a tab that just released
    // its lock and saved cannot leave a record behind.
    expect(broadcastSignedOut.mock.invocationCallOrder[0]).toBeLessThan(
      listOwnedSchemas.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("waits for a held schema lock before deleting the record", async () => {
    const fixture = setUp();
    await writeCloudCopy(fixture.repository, SYNCED_ID, USER_ID);
    const editorTab = createSchemaLockManager(fixture.registry.request);
    const editorLock = await editorTab.tryAcquire(SYNCED_ID);

    const pendingSignOut = runSignOut(fixture);
    await flushPendingWork();
    const recordWhileHeld =
      await fixture.repository.readSchemaRecord(SYNCED_ID);
    expect(fixture.registry.countWaiting(`${LOCK_PREFIX}${SYNCED_ID}`)).toBe(1);
    editorLock?.release();
    await pendingSignOut;

    expect(recordWhileHeld).not.toBeNull();
    await expect(
      fixture.repository.readSchemaRecord(SYNCED_ID),
    ).resolves.toBeNull();
    expect(fixture.registry.isHeld(`${LOCK_PREFIX}${SYNCED_ID}`)).toBe(false);
  });

  it("does not swallow a lock error that is not the timeout", async () => {
    const fixture = setUp();
    await writeCloudCopy(fixture.repository, SYNCED_ID, USER_ID);
    const lockManager: SchemaLockManager = {
      tryAcquire: () => Promise.resolve(null),
      acquire: () => Promise.reject(new Error("The lock name is invalid.")),
    };

    await expect(runSignOut(fixture, { lockManager })).rejects.toThrow(
      "Deleting the account cache failed during sign-out.",
    );
    await expect(
      fixture.repository.readSchemaRecord(SYNCED_ID),
    ).resolves.not.toBeNull();
  });

  it("deletes the record anyway when the lock wait times out", async () => {
    const fixture = setUp();
    await writeCloudCopy(fixture.repository, SYNCED_ID, USER_ID);
    const editorTab = createSchemaLockManager(fixture.registry.request);
    await editorTab.tryAcquire(SYNCED_ID);
    const timeout = new AbortController();
    const createTimeoutSignal = vi.fn(() => timeout.signal);

    const pendingSignOut = runSignOut(fixture, { createTimeoutSignal });
    await flushPendingWork();
    timeout.abort(new DOMException("The wait timed out.", "TimeoutError"));
    const result = await pendingSignOut;

    expect(result).toEqual({ isOk: true, value: undefined });
    expect(createTimeoutSignal).toHaveBeenCalledWith(SIGN_OUT_LOCK_TIMEOUT_MS);
    await expect(
      fixture.repository.readSchemaRecord(SYNCED_ID),
    ).resolves.toBeNull();
  });

  it.each([500, 429])(
    "does not delete anything when logout fails with status %i",
    async (status) => {
      const fixture = setUp();
      await writeCloudCopy(fixture.repository, SYNCED_ID, USER_ID);

      const result = await runSignOut(fixture, {
        fetchImpl: createFetch(status),
      });

      expect(result.isOk).toBe(false);
      await expect(
        fixture.repository.readSchemaRecord(SYNCED_ID),
      ).resolves.not.toBeNull();
    },
  );

  it("does not delete anything when logout answers with an unreadable body", async () => {
    const fixture = setUp();
    await writeCloudCopy(fixture.repository, SYNCED_ID, USER_ID);

    const result = await runSignOut(fixture, {
      fetchImpl: createUnparsableFetch(),
    });

    expect(result).toEqual({
      isOk: false,
      error: { kind: "logout-failed", failure: { kind: "invalid-response" } },
    });
    await expect(
      fixture.repository.readSchemaRecord(SYNCED_ID),
    ).resolves.not.toBeNull();
  });

  it("clears the session and the hint before reporting a failed deletion", async () => {
    const fixture = setUp();
    await writeCloudCopy(fixture.repository, SYNCED_ID, USER_ID);
    await fixture.repository.writeSession({
      userId: USER_ID,
      email: "user@example.com",
    });
    vi.spyOn(fixture.repository, "deleteSchema").mockRejectedValue(
      new Error("Disk full"),
    );
    const clearAuthHint = vi.fn();

    await expect(runSignOut(fixture, { clearAuthHint })).rejects.toThrow(
      "Deleting the account cache failed during sign-out.",
    );
    expect(clearAuthHint).toHaveBeenCalledOnce();
    await expect(fixture.repository.readSession()).resolves.toBeNull();
  });
});
