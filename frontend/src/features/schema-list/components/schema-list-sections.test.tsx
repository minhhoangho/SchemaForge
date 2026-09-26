import type { SchemaSummary } from "@schemaforge/api-contract";
import { screen, waitFor, within } from "@testing-library/react";
import { Dexie } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import type { SyncStatus } from "@/lib/storage/records";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import type { FakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import { SchemaListScreen } from "./schema-list-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
  }),
  usePathname: () => "/",
}));

const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const EMAIL = "user@example.com";
const HINT_COOKIE = "sf-auth-hint=1";
const CLOUD_ONLY_ID = "00000000-0000-4000-8000-000000000099";
const TIMESTAMP = "2026-09-18T00:00:00.000Z";
const ID_PREFIX = "00000000-0000-4000-8000-";

type Handler = () => Promise<Response>;
type Handlers = Readonly<Record<string, Handler>>;
type AuthKind = "signed-out" | "signed-in" | "expired";

type Fixture = {
  readonly storage: StorageBundle;
  readonly registry: FakeLockRegistry;
};

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function errorResponse(status: number, code: string): Promise<Response> {
  return jsonResponse({ statusCode: status, code }, status);
}

function listResponse(items: readonly SchemaSummary[]): Handler {
  return () => jsonResponse({ items, nextCursor: null });
}

function cloudSummary(id: string, name: string): SchemaSummary {
  return { id, name, revision: 1, createdAt: TIMESTAMP, updatedAt: TIMESTAMP };
}

function requestKey(input: RequestInfo | URL, init?: RequestInit): string {
  if (!(input instanceof URL)) {
    throw new Error("Expected the API client to call fetch with a URL.");
  }
  return `${init?.method ?? "GET"} ${input.pathname}`;
}

const AUTH_HANDLERS: Readonly<Record<AuthKind, Handlers>> = {
  "signed-out": {},
  "signed-in": {
    "GET /auth/me": () =>
      jsonResponse({
        user: { id: USER_ID, email: EMAIL, createdAt: TIMESTAMP },
      }),
  },
  expired: {
    "GET /auth/me": () => errorResponse(401, "unauthenticated"),
    "POST /auth/refresh": () => errorResponse(401, "session-expired"),
  },
};

const databases = new Set<SchemaforgeDatabase>();

beforeAll(() => {
  // liveQuery skips every query while Dexie finds no global IndexedDB.
  Dexie.dependencies.indexedDB = new IDBFactory();
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
});

afterEach(() => {
  databases.forEach((database) => {
    database.close();
  });
  databases.clear();
  vi.restoreAllMocks();
});

function setUp(): Fixture {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  databases.add(database);
  const registry = createFakeLockRegistry();
  let count = 0;
  return {
    registry,
    storage: {
      database,
      lockManager: createSchemaLockManager(registry.request),
      repository: createSchemaRepository({
        database,
        clock: () => 1_000 + count,
        generateId: () => {
          count += 1;
          return `${ID_PREFIX}${String(count).padStart(12, "0")}`;
        },
      }),
    },
  };
}

async function createOwnedSchema(
  storage: StorageBundle,
  name: string,
  syncStatus: SyncStatus = "synced",
): Promise<string> {
  const { id } = await storage.repository.createSchema(name, {
    ownerId: USER_ID,
  });
  await storage.repository.setSyncState(id, {
    cloudRevision: syncStatus === "pending" ? null : 1,
    syncStatus,
  });
  return id;
}

function renderScreen(
  storage: StorageBundle,
  auth: AuthKind,
  options: {
    readonly handlers?: Handlers;
    readonly themePreference?: ThemePreference;
  } = {},
): ReturnType<typeof renderWithProviders> {
  const handlers: Handlers = {
    "GET /schemas": listResponse([]),
    ...AUTH_HANDLERS[auth],
    ...options.handlers,
  };
  const fetchImpl = vi.fn<typeof fetch>((input, init) => {
    const handler = handlers[requestKey(input, init)];
    return handler === undefined ? errorResponse(404, "not-found") : handler();
  });
  return renderWithProviders(<SchemaListScreen />, {
    locale: "en",
    themePreference: options.themePreference ?? "light",
    auth: {
      storage,
      hasAuthHint: auth !== "signed-out",
      dependencies: {
        fetchImpl,
        cookieJar: { cookie: auth === "signed-out" ? "" : HINT_COOKIE },
      },
    },
  });
}

describe("schema list sections", () => {
  it("shows the sign-in invitation and the guest schemas while signed out", async () => {
    const { storage } = setUp();
    await storage.repository.createSchema("scratch");

    renderScreen(storage, "signed-out");

    const invitation = await screen.findByRole("link", {
      name: "Sign in to save schemas to the cloud",
    });
    expect({
      href: invitation.getAttribute("href"),
      guest: screen.getByRole("link", { name: "scratch" }).tagName,
      owned: screen.queryByRole("heading", { name: "Your schemas", level: 2 }),
    }).toEqual({ href: "/sign-in?returnTo=%2F", guest: "A", owned: null });
  });

  it("shows your schemas and this browser only sections while signed in", async () => {
    const { storage } = setUp();
    await createOwnedSchema(storage, "billing");
    await storage.repository.createSchema("scratch");

    renderScreen(storage, "signed-in", {
      handlers: {
        "GET /schemas": listResponse([
          { ...cloudSummary(`${ID_PREFIX}000000000001`, "billing") },
        ]),
      },
    });

    const owned = await screen.findByRole("region", { name: "Your schemas" });
    const guest = screen.getByRole("region", { name: "Only on this browser" });
    await within(owned).findByRole("link", { name: "billing" });

    expect({
      guest: within(guest).getByRole("link", { name: "scratch" }).tagName,
      guestInOwned: within(owned).queryByRole("link", { name: "scratch" }),
    }).toEqual({ guest: "A", guestInOwned: null });
  });

  it("shows the session expired banner with the cached schemas of the last user", async () => {
    const { storage } = setUp();
    await storage.repository.writeSession({ userId: USER_ID, email: EMAIL });
    await createOwnedSchema(storage, "billing");

    renderScreen(storage, "expired");

    // The region waits for both the cache read and the expired state, so
    // the list skeleton, also a status, is gone by then.
    const owned = await screen.findByRole("region", { name: "Your schemas" });
    const banner = screen.getByRole("status");
    expect({
      text: within(banner).getByText("Your sign-in session has expired")
        .tagName,
      href: within(banner)
        .getByRole("link", { name: "Sign in again" })
        .getAttribute("href"),
      row: (await within(owned).findByRole("link", { name: "billing" }))
        .tagName,
    }).toEqual({ text: "P", href: "/sign-in?returnTo=%2F", row: "A" });
  });

  it("shows a skeleton in your schemas while the cloud list loads", async () => {
    const { storage } = setUp();
    await createOwnedSchema(storage, "billing");

    renderScreen(storage, "signed-in", {
      handlers: {
        "GET /schemas": () => new Promise<Response>(() => undefined),
      },
    });

    const owned = await screen.findByRole("region", { name: "Your schemas" });
    expect(
      await within(owned).findByRole("link", { name: "billing" }),
    ).toBeDefined();
    expect(within(owned).getByRole("status").textContent).toBe(
      "Loading schemas from the cloud…",
    );
  });

  it("shows the cached schemas and a retry banner when the cloud list fails", async () => {
    const { storage } = setUp();
    await createOwnedSchema(storage, "billing");

    renderScreen(storage, "signed-in", {
      handlers: { "GET /schemas": () => errorResponse(500, "internal-error") },
    });

    const banner = await screen.findByRole("alert");
    const owned = screen.getByRole("region", { name: "Your schemas" });
    expect({
      title: within(banner).getByText("Could not load the list from the cloud")
        .tagName,
      reason: within(banner).getByText(
        "Something went wrong on the server. Try again later.",
      ).tagName,
      row: within(owned).getByRole("link", { name: "billing" }).tagName,
    }).toEqual({ title: "P", reason: "P", row: "A" });
  });

  it("retries the cloud list from the banner", async () => {
    const { storage } = setUp();
    const list = vi
      .fn<Handler>()
      .mockImplementationOnce(() => errorResponse(500, "internal-error"))
      .mockImplementation(
        listResponse([cloudSummary(CLOUD_ONLY_ID, "from-cloud")]),
      );
    const { user } = renderScreen(storage, "signed-in", {
      handlers: { "GET /schemas": list },
    });
    const banner = await screen.findByRole("alert");

    await user.click(within(banner).getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("link", { name: "from-cloud" }),
    ).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    { label: "Not downloaded to this browser", cached: null, isInCloud: true },
    { label: "Not synced", cached: "pending", isInCloud: false },
    { label: "Conflict", cached: "conflict", isInCloud: true },
    {
      label: "Deleted in the cloud",
      cached: "deleted-in-cloud",
      isInCloud: false,
    },
  ] as const)(
    "shows the status label of each row: $label",
    async ({ label, cached, isInCloud }) => {
      const { storage, registry } = setUp();
      const cachedId =
        cached === null
          ? CLOUD_ONLY_ID
          : await createOwnedSchema(storage, "billing", cached);
      // Holding the lock keeps the background sync away from the record.
      await createSchemaLockManager(registry.request).tryAcquire(cachedId);

      renderScreen(storage, "signed-in", {
        handlers: {
          "GET /schemas": listResponse(
            isInCloud ? [cloudSummary(cachedId, "billing")] : [],
          ),
        },
      });

      const owned = await screen.findByRole("region", { name: "Your schemas" });
      const row = (
        await within(owned).findByRole("link", { name: "billing" })
      ).closest("li");
      await waitFor(() => {
        expect(row?.textContent).toContain(label);
      });
    },
  );

  it.each(["light", "dark"] as const)(
    "has no axe violations in the light and dark themes: %s",
    async (themePreference) => {
      const { storage } = setUp();
      await createOwnedSchema(storage, "billing", "conflict");
      await storage.repository.createSchema("scratch");
      const { container } = renderScreen(storage, "signed-in", {
        themePreference,
        handlers: {
          "GET /schemas": listResponse([
            cloudSummary(`${ID_PREFIX}000000000001`, "billing"),
            cloudSummary(CLOUD_ONLY_ID, "from-cloud"),
          ]),
        },
      });
      await screen.findByRole("link", { name: "from-cloud" });

      await expectNoAxeViolations(container);
    },
  );
});
