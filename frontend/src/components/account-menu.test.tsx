import { createSampleSchema } from "@schemaforge/core/testing";
import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/i18n-provider";
import type { BroadcastChannelLike } from "@/lib/auth/auth-channel";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { StorageProvider } from "@/lib/storage/storage-context";
import { createFakeAuthLockManager } from "@/testing/fake-auth-lock-manager";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import { AccountMenu } from "./account-menu";
import { AuthProvider } from "./auth-provider";
import type { AuthProviderDependencies } from "./auth-provider";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EMAIL = "user@example.com";
const HINT_COOKIE = "sf-auth-hint=1";

const { pathname } = vi.hoisted(() => ({ pathname: { value: "/" } }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

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

// A posted message never reaches its own channel, like BroadcastChannel.
class FakeBroadcastChannel extends EventTarget {
  postMessage(): void {
    // Nothing listens in this file.
  }

  close(): void {
    // Nothing is delivered, so there is nothing to tear down.
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
  readonly storage: StorageBundle;
  readonly database: SchemaforgeDatabase;
  readonly dependencies: AuthProviderDependencies;
};

function setUp(input: {
  readonly handlers: Handlers;
  readonly cookie?: string;
}): Fixture {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  const nextId = createCounter();
  const openChannel = (): BroadcastChannelLike => new FakeBroadcastChannel();
  return {
    database,
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
      fetchImpl: createFetchStub(input.handlers),
      authLockManager: createFakeAuthLockManager().lockManager,
      openChannel,
      cookieJar: { cookie: input.cookie ?? "" },
    },
  };
}

function MenuTree({
  fixture,
  hasAuthHint,
}: {
  readonly fixture: Fixture;
  readonly hasAuthHint: boolean;
}): JSX.Element {
  return (
    <StorageProvider storage={fixture.storage}>
      <AuthProvider
        hasAuthHint={hasAuthHint}
        dependencies={fixture.dependencies}
      >
        <AccountMenu />
      </AuthProvider>
    </StorageProvider>
  );
}

function renderMenu(
  fixture: Fixture,
  hasAuthHint: boolean,
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <MenuTree fixture={fixture} hasAuthHint={hasAuthHint} />,
    { locale: "en" },
  );
}

describe("AccountMenu", () => {
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
    pathname.value = "/";
  });

  it("shows a sign-in link at once for a guest while auth is unknown", () => {
    const fixture = track(setUp({ handlers: {} }));

    // Server rendering runs no effect, so auth stays unknown exactly as it
    // does in the HTML the root layout sends.
    const html = renderToString(
      <I18nProvider locale="en">
        <MenuTree fixture={fixture} hasAuthHint={false} />
      </I18nProvider>,
    );

    expect(html).toContain("Sign in");
    expect(html).toContain("/sign-in?returnTo=%2F");
  });

  it("shows a sized placeholder without text while a hinted session loads", () => {
    const fixture = track(setUp({ handlers: {}, cookie: HINT_COOKIE }));
    // The hinted session request never settles, so auth stays unknown.
    vi.mocked(fixture.dependencies.fetchImpl).mockImplementation(
      () => new Promise(() => undefined),
    );

    const { container } = renderMenu(fixture, true);

    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it("shows the email and a sign-out item when signed in", async () => {
    const fixture = track(
      setUp({
        cookie: HINT_COOKIE,
        handlers: { "GET /auth/me": userResponse },
      }),
    );
    const { user } = renderMenu(fixture, true);

    await user.click(
      await screen.findByRole("button", { name: `Account ${EMAIL}` }),
    );

    expect(
      await screen.findByRole("menuitem", { name: "Sign out" }),
    ).toBeDefined();
  });

  it("shows a sign-in-again link with the return path when the session expired", async () => {
    pathname.value = "/schemas/abc";
    const fixture = track(
      setUp({
        cookie: HINT_COOKIE,
        handlers: {
          "GET /auth/me": () => errorResponse(401, "unauthenticated"),
          "POST /auth/refresh": () => errorResponse(401, "session-expired"),
        },
      }),
    );

    renderMenu(fixture, true);

    const link = await screen.findByRole("link", { name: "Sign in again" });
    expect(link.getAttribute("href")).toBe(
      "/sign-in?returnTo=%2Fschemas%2Fabc",
    );
  });

  it("shows an error toast when signing out fails", async () => {
    const fixture = track(
      setUp({
        cookie: HINT_COOKIE,
        handlers: {
          "GET /auth/me": userResponse,
          "POST /auth/logout": () => errorResponse(500, "internal-error"),
        },
      }),
    );
    const { user } = renderMenu(fixture, true);
    await user.click(
      await screen.findByRole("button", { name: `Account ${EMAIL}` }),
    );

    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    expect(
      await screen.findByText("Could not sign out, check your connection"),
    ).toBeDefined();
  });
  // The id has to be a real schema id: listOwnedSchemas skips a row it cannot
  // parse, and the unsynced count would then be zero.
  async function seedPending(fixture: Fixture): Promise<void> {
    const schemaId = "00000000-0000-4000-8000-000000000001";
    // Storage caches a schema only for the account the session row names.
    await fixture.storage.repository.writeSession({
      userId: USER_ID,
      email: EMAIL,
    });
    await fixture.storage.repository.writeCloudCopy({
      id: schemaId,
      ownerId: USER_ID,
      document: createSampleSchema(),
      revision: 1,
      createdAt: 1,
      updatedAt: 1,
    });
    await fixture.storage.repository.setSyncState(schemaId, {
      cloudRevision: 1,
      syncStatus: "pending",
    });
  }

  async function openSignOut(fixture: Fixture): Promise<UserEvent> {
    const { user } = renderMenu(fixture, true);
    await user.click(
      await screen.findByRole("button", { name: `Account ${EMAIL}` }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    return user;
  }

  it("starts the sign out flow from the menu", async () => {
    const fixture = track(
      setUp({
        cookie: HINT_COOKIE,
        handlers: { "GET /auth/me": userResponse },
      }),
    );
    await seedPending(fixture);

    await openSignOut(fixture);

    expect(
      await screen.findByRole("alertdialog", { name: "Sign out?" }),
    ).toBeDefined();
  });

  it("returns focus to the menu button after cancelling", async () => {
    const fixture = track(
      setUp({
        cookie: HINT_COOKIE,
        handlers: { "GET /auth/me": userResponse },
      }),
    );
    await seedPending(fixture);
    const user = await openSignOut(fixture);

    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: `Account ${EMAIL}` })).toBe(
      document.activeElement,
    );
  });

  it("shows the sign-in link after signing out", async () => {
    const fixture = track(
      setUp({
        cookie: HINT_COOKIE,
        handlers: {
          "GET /auth/me": userResponse,
          "POST /auth/logout": () => new Response(null, { status: 204 }),
        },
      }),
    );

    await openSignOut(fixture);

    const link = await screen.findByRole("link", { name: "Sign in" });
    expect(link).toBe(document.activeElement);
  });
});
