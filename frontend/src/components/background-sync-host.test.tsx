import { act, screen, waitFor } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BroadcastChannelLike } from "@/lib/auth/auth-channel";
import { logger } from "@/lib/logger";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import {
  createSchemaLockManager,
  getSchemaLockName,
} from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { StorageProvider } from "@/lib/storage/storage-context";
import { createFakeAuthLockManager } from "@/testing/fake-auth-lock-manager";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import type { FakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import { AuthProvider, useAuth } from "./auth-provider";
import type { AuthProviderDependencies } from "./auth-provider";
import { BackgroundSyncHost } from "./background-sync-host";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const HINT_COOKIE = "sf-auth-hint=1";
const ID_PREFIX = "00000000-0000-4000-8000-";
const TIMESTAMP = "2026-09-18T00:00:00.000Z";

type FetchStub = ReturnType<typeof vi.fn<typeof fetch>>;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function userResponse(): Response {
  return jsonResponse(
    { user: { id: USER_ID, email: "user@example.com", createdAt: TIMESTAMP } },
    200,
  );
}

function unavailableResponse(): Response {
  return jsonResponse({ statusCode: 503, code: "service-unavailable" }, 503);
}

function requestPath(input: RequestInfo | URL): string {
  if (!(input instanceof URL)) {
    throw new Error("Expected the API client to call fetch with a URL.");
  }
  return input.pathname;
}

// The backend stays unavailable, so a pending schema stays pending and every
// run pushes it again.
function createFetchStub(): FetchStub {
  return vi.fn<typeof fetch>((input) =>
    Promise.resolve(
      requestPath(input) === "/auth/me"
        ? userResponse()
        : unavailableResponse(),
    ),
  );
}

class FakeBroadcastChannel extends EventTarget {
  postMessage(): void {
    // A tab never receives its own messages.
  }

  close(): void {
    // Nothing to tear down.
  }
}

function createCounter(): () => number {
  let count = 0;
  return () => {
    count += 1;
    return count;
  };
}

type Fixture = {
  readonly database: SchemaforgeDatabase;
  readonly storage: StorageBundle;
  readonly fetchImpl: FetchStub;
  readonly channel: FakeBroadcastChannel;
  readonly lockRegistry: FakeLockRegistry;
  readonly dependencies: AuthProviderDependencies;
};

const databases = new Set<SchemaforgeDatabase>();

afterEach(() => {
  databases.forEach((database) => {
    database.close();
  });
  databases.clear();
  vi.restoreAllMocks();
});

function setUp(cookie: string): Fixture {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  databases.add(database);
  const nextId = createCounter();
  const channel = new FakeBroadcastChannel();
  const fetchImpl = createFetchStub();
  const lockRegistry = createFakeLockRegistry();
  return {
    database,
    fetchImpl,
    channel,
    lockRegistry,
    storage: {
      database,
      lockManager: createSchemaLockManager(lockRegistry.request),
      repository: createSchemaRepository({
        database,
        clock: createCounter(),
        generateId: () => `${ID_PREFIX}${String(nextId()).padStart(12, "0")}`,
      }),
    },
    dependencies: {
      fetchImpl,
      authLockManager: createFakeAuthLockManager().lockManager,
      openChannel: (): BroadcastChannelLike => channel,
      cookieJar: { cookie },
    },
  };
}

function StatusProbe(): JSX.Element {
  const status = useAuth((state) => state.auth.status);

  return <p>{`status:${status}`}</p>;
}

function renderHost(fixture: Fixture): void {
  renderWithProviders(
    <StorageProvider storage={fixture.storage}>
      <AuthProvider hasAuthHint={false} dependencies={fixture.dependencies}>
        <StatusProbe />
        <BackgroundSyncHost />
      </AuthProvider>
    </StorageProvider>,
    { locale: "en" },
  );
}

function countPushes(fetchImpl: FetchStub): number {
  return fetchImpl.mock.calls.filter(
    ([input]) => requestPath(input) === "/schemas",
  ).length;
}

async function seedPendingSchema(fixture: Fixture): Promise<string> {
  const record = await fixture.storage.repository.createSchema("Shop", {
    ownerId: USER_ID,
  });
  return record.id;
}

function goOnline(): void {
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
}

// Waits until the first run has pushed and released the schema lock, so the
// next run starts fresh instead of joining the one in flight.
async function signInAndSyncOnce(fixture: Fixture): Promise<void> {
  const schemaId = await seedPendingSchema(fixture);
  renderHost(fixture);
  await waitFor(() => {
    expect([
      countPushes(fixture.fetchImpl),
      fixture.lockRegistry.isHeld(getSchemaLockName(schemaId)),
    ]).toEqual([1, false]);
  });
}

describe("BackgroundSyncHost", () => {
  it("syncs pending schemas when auth becomes signed-in", async () => {
    const fixture = setUp(HINT_COOKIE);

    await signInAndSyncOnce(fixture);

    expect(screen.getByText("status:signed-in")).toBeDefined();
  });

  it("syncs again on the online event while signed in", async () => {
    const fixture = setUp(HINT_COOKIE);
    await signInAndSyncOnce(fixture);

    goOnline();

    await waitFor(() => {
      expect(countPushes(fixture.fetchImpl)).toBe(2);
    });
  });

  it("does not sync while signed out", async () => {
    const fixture = setUp("");
    await seedPendingSchema(fixture);
    // A run starts by listing the owned schemas, synchronously on the event.
    const listOwned = vi.spyOn(fixture.storage.repository, "listOwnedSchemas");
    renderHost(fixture);
    await screen.findByText("status:signed-out");

    goOnline();

    expect(listOwned).not.toHaveBeenCalled();
  });

  it("removes the online listener after signing out", async () => {
    const fixture = setUp(HINT_COOKIE);
    await signInAndSyncOnce(fixture);
    act(() => {
      fixture.channel.dispatchEvent(
        new MessageEvent("message", { data: { type: "signed-out" } }),
      );
    });
    await screen.findByText("status:signed-out");
    const listOwned = vi.spyOn(fixture.storage.repository, "listOwnedSchemas");

    goOnline();

    expect(listOwned).not.toHaveBeenCalled();
  });

  it("logs an unexpected failure by error name only", async () => {
    const fixture = setUp(HINT_COOKIE);
    const logError = vi.spyOn(logger, "error").mockReturnValue(undefined);
    vi.spyOn(fixture.storage.repository, "listOwnedSchemas").mockRejectedValue(
      new TypeError("The cache could not be read."),
    );

    renderHost(fixture);

    await waitFor(() => {
      expect(logError).toHaveBeenCalledWith("sync.background-failed", {
        name: "TypeError",
      });
    });
  });
});
