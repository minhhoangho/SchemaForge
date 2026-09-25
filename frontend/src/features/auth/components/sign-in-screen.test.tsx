import { screen, waitFor } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/components/auth-provider";
import type { AuthProviderDependencies } from "@/components/auth-provider";
import type { BroadcastChannelLike } from "@/lib/auth/auth-channel";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { StorageProvider } from "@/lib/storage/storage-context";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { createFakeAuthLockManager } from "@/testing/fake-auth-lock-manager";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import { SignInScreen } from "./sign-in-screen";

const { replace } = vi.hoisted(() => ({
  replace: vi.fn<(href: string) => void>(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EMAIL = "user@example.com";
const PASSWORD = "stapler-42";
const HINT_COOKIE = "sf-auth-hint=1";
const RETURN_TO = "/schemas/abc";

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

function requestPath(input: RequestInfo | URL): string {
  if (!(input instanceof URL)) {
    throw new Error("Expected the API client to call fetch with a URL.");
  }
  return input.pathname;
}

class SilentBroadcastChannel extends EventTarget {
  postMessage(): void {
    // No other tab listens in these tests.
  }

  close(): void {
    // Nothing was opened.
  }
}

type Fixture = {
  readonly storage: StorageBundle;
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
  return {
    storage: {
      database,
      lockManager: createSchemaLockManager(createFakeLockRegistry().request),
      repository: createSchemaRepository({
        database,
        clock: () => 1,
        generateId: () => "00000000-0000-4000-8000-000000000001",
      }),
    },
    dependencies: {
      fetchImpl: vi.fn<typeof fetch>((request, init) => {
        const handler =
          input.handlers[`${init?.method ?? "GET"} ${requestPath(request)}`];
        return Promise.resolve(
          handler === undefined ? errorResponse(404, "not-found") : handler(),
        );
      }),
      authLockManager: createFakeAuthLockManager().lockManager,
      openChannel: (): BroadcastChannelLike => new SilentBroadcastChannel(),
      cookieJar: { cookie: input.cookie ?? "" },
    },
  };
}

function renderScreen(
  fixture: Fixture,
  options: { readonly themePreference?: ThemePreference } = {},
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <StorageProvider storage={fixture.storage}>
      <AuthProvider
        hasAuthHint={fixture.dependencies.cookieJar.cookie !== ""}
        dependencies={fixture.dependencies}
      >
        <SignInScreen returnTo={RETURN_TO} />
      </AuthProvider>
    </StorageProvider>,
    { locale: "en", ...options },
  );
}

describe("SignInScreen", () => {
  const fixtures = new Set<Fixture>();

  function track(fixture: Fixture): Fixture {
    fixtures.add(fixture);
    return fixture;
  }

  afterEach(() => {
    fixtures.forEach((fixture) => {
      fixture.storage.database.close();
    });
    fixtures.clear();
    replace.mockClear();
  });

  it("prefills the email of the expired session", async () => {
    const fixture = track(
      setUp({
        cookie: HINT_COOKIE,
        handlers: {
          "GET /auth/me": () => errorResponse(401, "unauthenticated"),
          "POST /auth/refresh": () => errorResponse(401, "session-expired"),
        },
      }),
    );
    await fixture.storage.repository.writeSession({
      userId: USER_ID,
      email: EMAIL,
    });

    renderScreen(fixture);

    await waitFor(() => {
      expect(screen.getByLabelText("Email")).toHaveProperty("value", EMAIL);
    });
  });

  it("redirects a signed-in user to the list on mount", async () => {
    const fixture = track(
      setUp({
        cookie: HINT_COOKIE,
        handlers: { "GET /auth/me": userResponse },
      }),
    );

    renderScreen(fixture);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledExactlyOnceWith("/");
    });
  });

  it("navigates to the sanitized returnTo after signing in", async () => {
    const fixture = track(
      setUp({ handlers: { "POST /auth/login": userResponse } }),
    );
    const { user } = renderScreen(fixture);
    await user.type(screen.getByLabelText("Email"), EMAIL);
    await user.type(
      screen.getByLabelText("Password", { selector: "input" }),
      PASSWORD,
    );

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledExactlyOnceWith(RETURN_TO);
    });
  });

  it("states that password recovery is not available", () => {
    renderScreen(track(setUp({ handlers: {} })));

    expect(
      screen.getByText("There is no password recovery yet."),
    ).toBeDefined();
  });

  it("links to sign-up keeping returnTo", () => {
    renderScreen(track(setUp({ handlers: {} })));

    expect(
      screen
        .getByRole("link", { name: "Don't have an account? Create one" })
        .getAttribute("href"),
    ).toBe("/sign-up?returnTo=%2Fschemas%2Fabc");
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations in light and dark themes (%s)",
    async (themePreference) => {
      const { container } = renderScreen(track(setUp({ handlers: {} })), {
        themePreference,
      });
      await screen.findByRole("heading", { level: 1, name: "Sign in" });

      await expectNoAxeViolations(container);
    },
  );
});
