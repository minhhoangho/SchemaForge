import { screen } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuthChannelMessage } from "@/lib/auth/auth-channel";
import type { BroadcastChannelLike } from "@/lib/auth/auth-channel";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { StorageProvider } from "@/lib/storage/storage-context";
import { createFakeAuthLockManager } from "@/testing/fake-auth-lock-manager";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import {
  AuthProvider,
  useApiClient,
  useAuth,
  useSignOut,
} from "./auth-provider";
import type { AuthProviderDependencies } from "./auth-provider";

// Only the provider without a storage prop builds browser storage; failing it
// here stands in for a browser whose IndexedDB cannot open.
vi.mock("@/lib/storage/create-browser-storage", () => ({
  createBrowserStorage: () => {
    throw new DOMException("IndexedDB is blocked.", "SecurityError");
  },
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EMAIL = "user@example.com";
const HINT_COOKIE = "sf-auth-hint=1";

type FetchStub = ReturnType<typeof vi.fn<typeof fetch>>;
type Handlers = Readonly<Record<string, () => Response>>;

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

function errorResponse(status: number, code: string): Response {
  return jsonResponse({ statusCode: status, code }, status);
}

function noContentResponse(): Response {
  return new Response(null, { status: 204 });
}

// The API client always calls fetch with a URL, so anything else is a bug.
function requestPath(input: RequestInfo | URL): string {
  if (!(input instanceof URL)) {
    throw new Error("Expected the API client to call fetch with a URL.");
  }
  return input.pathname;
}

function createFetchStub(handlers: Handlers): FetchStub {
  return vi.fn<typeof fetch>((input, init) => {
    const handler = handlers[`${init?.method ?? "GET"} ${requestPath(input)}`];
    return Promise.resolve(
      handler === undefined ? errorResponse(404, "not-found") : handler(),
    );
  });
}

// Stand-in for BroadcastChannel: like the real API, a posted message never
// reaches the channel that sent it, so nothing is delivered here.
class FakeBroadcastChannel extends EventTarget {
  constructor(readonly posted: AuthChannelMessage[]) {
    super();
  }

  postMessage(message: AuthChannelMessage): void {
    this.posted.push(message);
  }

  close(): void {
    // Nothing is delivered, so there is nothing to tear down.
  }
}

type Fixture = {
  readonly storage: StorageBundle;
  readonly database: SchemaforgeDatabase;
  readonly cookieJar: { cookie: string };
  readonly posted: readonly AuthChannelMessage[];
  readonly dependencies: AuthProviderDependencies;
  readonly fetchImpl: FetchStub;
};

function createCounter(): () => number {
  let count = 0;
  return () => {
    count += 1;
    return count;
  };
}

function setUp(input: {
  readonly handlers: Handlers;
  readonly cookie?: string;
}): Fixture {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  const nextId = createCounter();
  const posted: AuthChannelMessage[] = [];
  const cookieJar = { cookie: input.cookie ?? "" };
  const fetchImpl = createFetchStub(input.handlers);
  const openChannel = (): BroadcastChannelLike =>
    new FakeBroadcastChannel(posted);
  return {
    database,
    cookieJar,
    posted,
    fetchImpl,
    storage: {
      database,
      lockManager: createSchemaLockManager(createFakeLockRegistry().request),
      repository: createSchemaRepository({
        database,
        clock: createCounter(),
        generateId: () => `id-${String(nextId())}`,
      }),
    },
    dependencies: {
      fetchImpl,
      authLockManager: createFakeAuthLockManager().lockManager,
      openChannel,
      cookieJar,
    },
  };
}

function AuthProbe(): JSX.Element {
  const auth = useAuth((state) => state.auth);
  const api = useApiClient();
  const signOut = useSignOut();
  const [outcome, setOutcome] = useState("none");

  async function handleSignOut(): Promise<void> {
    try {
      const result = await signOut();
      setOutcome(result.isOk ? "outcome:ok" : `outcome:${result.error.kind}`);
    } catch {
      setOutcome("outcome:rejected");
    }
  }

  return (
    <div>
      <p>{`status:${auth.status}`}</p>
      <p>
        {auth.status === "signed-in" ? `email:${auth.user.email}` : "email:-"}
      </p>
      <p>{outcome}</p>
      <button
        type="button"
        onClick={() => {
          void api.schemas.list({});
        }}
      >
        list
      </button>
      <button
        type="button"
        onClick={() => {
          void handleSignOut();
        }}
      >
        sign out
      </button>
    </div>
  );
}

function renderProbe(
  fixture: Fixture,
  hasAuthHint: boolean,
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <StorageProvider storage={fixture.storage}>
      <AuthProvider
        hasAuthHint={hasAuthHint}
        dependencies={fixture.dependencies}
      >
        <AuthProbe />
      </AuthProvider>
    </StorageProvider>,
    { locale: "en" },
  );
}

async function signInProbe(fixture: Fixture): Promise<{
  readonly user: ReturnType<typeof renderProbe>["user"];
}> {
  const { user } = renderProbe(fixture, true);
  await screen.findByText("status:signed-in");
  return { user };
}

describe("AuthProvider", () => {
  const databases = new Set<SchemaforgeDatabase>();

  function track(fixture: Fixture): Fixture {
    databases.add(fixture.database);
    return fixture;
  }

  afterEach(() => {
    databases.forEach((database) => {
      database.close();
    });
    databases.clear();
  });

  it("does not call fetch when there is no hint cookie", async () => {
    const fixture = track(setUp({ handlers: {} }));

    renderProbe(fixture, false);

    expect(await screen.findByText("status:signed-out")).toBeDefined();
    expect(fixture.fetchImpl).not.toHaveBeenCalled();
  });

  it("calls me once when the hint cookie is present", async () => {
    const fixture = track(
      setUp({
        cookie: HINT_COOKIE,
        handlers: { "GET /auth/me": userResponse },
      }),
    );

    renderProbe(fixture, true);

    expect(await screen.findByText(`email:${EMAIL}`)).toBeDefined();
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("marks the session expired when a schema request cannot refresh", async () => {
    const meCall = createCounter();
    const fixture = track(
      setUp({
        cookie: HINT_COOKIE,
        handlers: {
          "GET /auth/me": () =>
            meCall() === 1
              ? userResponse()
              : errorResponse(401, "unauthenticated"),
          "GET /schemas": () => errorResponse(401, "unauthenticated"),
          "POST /auth/refresh": () => errorResponse(401, "session-expired"),
        },
      }),
    );
    const { user } = await signInProbe(fixture);

    await user.click(screen.getByRole("button", { name: "list" }));

    expect(await screen.findByText("status:expired")).toBeDefined();
  });

  it("signs out, clears the hint and becomes signed-out", async () => {
    const fixture = track(
      setUp({
        cookie: HINT_COOKIE,
        handlers: {
          "GET /auth/me": userResponse,
          "POST /auth/logout": noContentResponse,
        },
      }),
    );
    const { user } = await signInProbe(fixture);

    await user.click(screen.getByRole("button", { name: "sign out" }));

    expect(await screen.findByText("outcome:ok")).toBeDefined();
    expect(screen.getByText("status:signed-out")).toBeDefined();
    expect(fixture.cookieJar.cookie).toContain("Max-Age=0");
    expect(fixture.posted).toEqual([{ type: "signed-out" }]);
  });

  it("keeps the signed-in state when logout fails", async () => {
    const fixture = track(
      setUp({
        cookie: HINT_COOKIE,
        handlers: {
          "GET /auth/me": userResponse,
          "POST /auth/logout": () => errorResponse(500, "internal-error"),
        },
      }),
    );
    const { user } = await signInProbe(fixture);

    await user.click(screen.getByRole("button", { name: "sign out" }));

    expect(await screen.findByText("outcome:logout-failed")).toBeDefined();
    expect(screen.getByText("status:signed-in")).toBeDefined();
  });

  it("becomes signed-out when clearing the cache rejects", async () => {
    const fixture = track(
      setUp({
        cookie: HINT_COOKIE,
        handlers: {
          "GET /auth/me": userResponse,
          "POST /auth/logout": noContentResponse,
        },
      }),
    );
    const { user } = await signInProbe(fixture);
    // A closed database makes every later read reject, the way a broken
    // IndexedDB does: signOut then rejects instead of returning a Result.
    fixture.database.close();

    await user.click(screen.getByRole("button", { name: "sign out" }));

    expect(await screen.findByText("outcome:rejected")).toBeDefined();
    expect(screen.getByText("status:signed-out")).toBeDefined();
  });

  it("signs out on the server and clears the hint when storage is unavailable", async () => {
    const fixture = track(
      setUp({
        cookie: HINT_COOKIE,
        handlers: {
          "GET /auth/me": userResponse,
          "POST /auth/logout": noContentResponse,
        },
      }),
    );
    const { user } = renderWithProviders(
      <StorageProvider>
        <AuthProvider hasAuthHint dependencies={fixture.dependencies}>
          <AuthProbe />
        </AuthProvider>
      </StorageProvider>,
      { locale: "en" },
    );
    await screen.findByText("status:signed-in");

    await user.click(screen.getByRole("button", { name: "sign out" }));

    expect(await screen.findByText("outcome:ok")).toBeDefined();
    expect(screen.getByText("status:signed-out")).toBeDefined();
    expect(fixture.cookieJar.cookie).toContain("Max-Age=0");
    expect(fixture.posted).toEqual([{ type: "signed-out" }]);
  });

  it("throws when useAuth is used outside the provider", () => {
    function Outside(): JSX.Element {
      const auth = useAuth((state) => state.auth);

      return <p>{auth.status}</p>;
    }

    expect(() => {
      renderWithProviders(<Outside />);
    }).toThrow(/AuthProvider/);
  });
});
