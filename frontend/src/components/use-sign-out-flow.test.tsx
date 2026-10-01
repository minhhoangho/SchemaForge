import { createSampleSchema } from "@schemaforge/core/testing";
import { act, screen } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/components/auth-provider";
import type { AuthProviderDependencies } from "@/components/auth-provider";
import type { BroadcastChannelLike } from "@/lib/auth/auth-channel";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { createFakeAuthLockManager } from "@/testing/fake-auth-lock-manager";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import { useSignOutFlow } from "./use-sign-out-flow";
import type { SignOutFlow } from "./use-sign-out-flow";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EMAIL = "user@example.com";
const HINT_COOKIE = "sf-auth-hint=1";
const TIMESTAMP = "2026-09-18T00:00:00.000Z";
const SAMPLE_DOCUMENT = createSampleSchema();
const NO_CONTENT_STATUS = 204;

type Route = () => Response | Promise<Response>;
type Routes = Record<string, Route>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function userResponse(): Response {
  return jsonResponse({
    user: { id: USER_ID, email: EMAIL, createdAt: "2026-01-01T00:00:00.000Z" },
  });
}

function summaryResponse(id: string): Response {
  return jsonResponse(
    {
      id,
      name: SAMPLE_DOCUMENT.name,
      revision: 1,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    },
    201,
  );
}

function requestPath(input: RequestInfo | URL): string {
  if (!(input instanceof URL)) {
    throw new Error("Expected the API client to call fetch with a URL.");
  }
  return input.pathname;
}

// Nothing is delivered between fake tabs in this file.
class FakeBroadcastChannel extends EventTarget {
  postMessage(): void {
    // No other tab listens.
  }

  close(): void {
    // Nothing to release.
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
  readonly routes: Routes;
  readonly fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>;
  readonly dependencies: AuthProviderDependencies;
};

const databases = new Set<SchemaforgeDatabase>();

afterEach(() => {
  databases.forEach((database) => {
    database.close();
  });
  databases.clear();
});

function setUp(): Fixture {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  databases.add(database);
  const nextId = createCounter();
  const routes: Routes = { "GET /auth/me": userResponse };
  const fetchImpl = vi.fn<typeof fetch>((input, init) => {
    const route = routes[`${init?.method ?? "GET"} ${requestPath(input)}`];
    return route === undefined
      ? Promise.resolve(
          jsonResponse({ statusCode: 404, code: "not-found" }, 404),
        )
      : Promise.resolve(route());
  });
  return {
    database,
    routes,
    fetchImpl,
    storage: {
      database,
      lockManager: createSchemaLockManager(createFakeLockRegistry().request),
      repository: createSchemaRepository({
        database,
        clock: createCounter(),
        generateId: () =>
          `00000000-0000-4000-8000-${String(nextId()).padStart(12, "0")}`,
      }),
    },
    dependencies: {
      fetchImpl,
      authLockManager: createFakeAuthLockManager().lockManager,
      openChannel: (): BroadcastChannelLike => new FakeBroadcastChannel(),
      cookieJar: { cookie: HINT_COOKIE },
    },
  };
}

type FlowRef = { current: SignOutFlow | null };

function Harness({ flowRef }: { readonly flowRef: FlowRef }): JSX.Element {
  const flow = useSignOutFlow();
  const status = useAuth((state) => state.auth.status);
  flowRef.current = flow;

  return <p>{status}</p>;
}

async function mountFlow(fixture: Fixture): Promise<FlowRef> {
  const flowRef: FlowRef = { current: null };
  renderWithProviders(<Harness flowRef={flowRef} />, {
    locale: "en",
    auth: {
      storage: fixture.storage,
      hasAuthHint: true,
      dependencies: fixture.dependencies,
    },
  });
  await screen.findByText("signed-in");
  return flowRef;
}

function flowOf(flowRef: FlowRef): SignOutFlow {
  const flow = flowRef.current;
  if (flow === null) {
    throw new Error("The harness did not render the flow.");
  }
  return flow;
}

async function seedPending(fixture: Fixture): Promise<string> {
  const record = await fixture.storage.repository.createSchema("Billing", {
    ownerId: USER_ID,
  });
  await fixture.storage.repository.saveDocument(record.id, SAMPLE_DOCUMENT);
  return record.id;
}

// Storage caches a schema only for the account the session row names.
async function seedSession(fixture: Fixture): Promise<void> {
  await fixture.storage.repository.writeSession({
    userId: USER_ID,
    email: "user@example.com",
  });
}

async function seedSynced(fixture: Fixture): Promise<string> {
  const id = "00000000-0000-4000-8000-0000000000ff";
  await seedSession(fixture);
  await fixture.storage.repository.writeCloudCopy({
    id,
    ownerId: USER_ID,
    document: SAMPLE_DOCUMENT,
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
  });
  return id;
}

async function seedConflict(fixture: Fixture): Promise<string> {
  const id = "00000000-0000-4000-8000-0000000000fe";
  await seedSession(fixture);
  await fixture.storage.repository.writeCloudCopy({
    id,
    ownerId: USER_ID,
    document: SAMPLE_DOCUMENT,
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
  });
  await fixture.storage.repository.setSyncState(id, {
    cloudRevision: 1,
    syncStatus: "conflict",
  });
  return id;
}

describe("useSignOutFlow", () => {
  it("signs out without a dialog when every schema is synced", async () => {
    const fixture = setUp();
    await seedSynced(fixture);
    fixture.routes["POST /auth/logout"] = () =>
      new Response(null, { status: NO_CONTENT_STATUS });
    const flowRef = await mountFlow(fixture);

    await act(async () => {
      await flowOf(flowRef).start();
    });

    expect(flowOf(flowRef).state).toEqual({ kind: "idle" });
    expect(await screen.findByText("signed-out")).toBeDefined();
  });

  it("asks for confirmation when unsynced schemas remain", async () => {
    const fixture = setUp();
    await seedPending(fixture);
    const flowRef = await mountFlow(fixture);

    await act(async () => {
      await flowOf(flowRef).start();
    });

    expect(flowOf(flowRef).state).toEqual({
      kind: "confirming",
      unsyncedCount: 1,
    });
  });

  it("counts again after trying to sync", async () => {
    const fixture = setUp();
    const pendingId = await seedPending(fixture);
    // A conflict is unsynced but never pushed, so it survives the sync run.
    await seedConflict(fixture);
    const flowRef = await mountFlow(fixture);
    await act(async () => {
      await flowOf(flowRef).start();
    });
    fixture.routes["POST /schemas"] = () => summaryResponse(pendingId);

    await act(async () => {
      await flowOf(flowRef).trySync();
    });

    expect(flowOf(flowRef).state).toEqual({
      kind: "confirming",
      unsyncedCount: 1,
    });
  });

  it("offers a plain sign out when trying to sync leaves nothing unsynced", async () => {
    const fixture = setUp();
    const schemaId = await seedPending(fixture);
    const flowRef = await mountFlow(fixture);
    await act(async () => {
      await flowOf(flowRef).start();
    });
    fixture.routes["POST /schemas"] = () => summaryResponse(schemaId);

    await act(async () => {
      await flowOf(flowRef).trySync();
    });

    expect(flowOf(flowRef).state).toEqual({
      kind: "confirming",
      unsyncedCount: 0,
    });
  });

  it("keeps the user signed in and the cache intact when logout fails with a network error", async () => {
    const fixture = setUp();
    const schemaId = await seedPending(fixture);
    fixture.routes["POST /auth/logout"] = () => {
      throw new TypeError("Failed to fetch");
    };
    const flowRef = await mountFlow(fixture);
    await act(async () => {
      await flowOf(flowRef).start();
    });

    await act(async () => {
      await flowOf(flowRef).confirm();
    });

    expect(
      await screen.findByText("Could not sign out, check your connection"),
    ).toBeDefined();
    expect(screen.getByText("signed-in")).toBeDefined();
    expect(flowOf(flowRef).state).toEqual({ kind: "idle" });
    await expect(
      fixture.storage.repository.readSchemaRecord(schemaId),
    ).resolves.not.toBeNull();
  });

  it("signs out and removes only the account cache after confirming", async () => {
    const fixture = setUp();
    const ownedId = await seedPending(fixture);
    const guest = await fixture.storage.repository.createSchema("Guest");
    fixture.routes["POST /auth/logout"] = () =>
      new Response(null, { status: NO_CONTENT_STATUS });
    const flowRef = await mountFlow(fixture);
    await act(async () => {
      await flowOf(flowRef).start();
    });

    await act(async () => {
      await flowOf(flowRef).confirm();
    });

    expect(await screen.findByText("signed-out")).toBeDefined();
    await expect(
      fixture.storage.repository.readSchemaRecord(ownedId),
    ).resolves.toBeNull();
    await expect(
      fixture.storage.repository.readSchemaRecord(guest.id),
    ).resolves.not.toBeNull();
  });

  it("shows an error toast and ends up signed out when clearing the cache rejects", async () => {
    const fixture = setUp();
    await seedPending(fixture);
    fixture.routes["POST /auth/logout"] = () =>
      new Response(null, { status: NO_CONTENT_STATUS });
    const flowRef = await mountFlow(fixture);
    await act(async () => {
      await flowOf(flowRef).start();
    });
    // A closed database makes every cache read and write reject, which is the
    // path where signOut rejects after the session is already revoked.
    fixture.database.close();

    await act(async () => {
      await flowOf(flowRef).confirm();
    });

    expect(
      await screen.findByText(
        "Signed out, but some data could not be removed from this browser",
      ),
    ).toBeDefined();
    expect(await screen.findByText("signed-out")).toBeDefined();
    expect(flowOf(flowRef).state).toEqual({ kind: "idle" });
  });

  it("does nothing on cancel", async () => {
    const fixture = setUp();
    await seedPending(fixture);
    const flowRef = await mountFlow(fixture);
    await act(async () => {
      await flowOf(flowRef).start();
    });

    act(() => {
      flowOf(flowRef).cancel();
    });

    expect(flowOf(flowRef).state).toEqual({ kind: "idle" });
    expect(screen.getByText("signed-in")).toBeDefined();
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("ignores a second start while signing out", async () => {
    const fixture = setUp();
    await seedSynced(fixture);
    let logoutCount = 0;
    fixture.routes["POST /auth/logout"] = () => {
      logoutCount += 1;
      // Never settles, so the flow stays in signing-out.
      return new Promise<Response>(() => undefined);
    };
    const flowRef = await mountFlow(fixture);
    const firstStart = flowOf(flowRef).start();
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await flowOf(flowRef).start();
    });

    expect(flowOf(flowRef).state).toEqual({ kind: "signing-out" });
    expect(logoutCount).toBe(1);
    expect(firstStart).toBeInstanceOf(Promise);
  });
});
