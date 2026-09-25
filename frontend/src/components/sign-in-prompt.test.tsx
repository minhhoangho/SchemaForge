import { screen, waitFor } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BroadcastChannelLike } from "@/lib/auth/auth-channel";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { StorageProvider } from "@/lib/storage/storage-context";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { createFakeAuthLockManager } from "@/testing/fake-auth-lock-manager";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import { AuthProvider, useAuth } from "./auth-provider";
import type { AuthProviderDependencies } from "./auth-provider";
import { SignInPromptProvider, useSignInPrompt } from "./sign-in-prompt";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EMAIL = "user@example.com";
const HINT_COOKIE = "sf-auth-hint=1";
const TRIGGER_NAME = "Save to cloud";

type FetchStub = ReturnType<typeof vi.fn<typeof fetch>>;

function userResponse(): Response {
  return new Response(
    JSON.stringify({
      user: {
        id: USER_ID,
        email: EMAIL,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

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
  readonly fetchImpl: FetchStub;
};

function setUp(isSignedIn: boolean): Fixture {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  const nextId = createCounter();
  const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(userResponse()));
  const openChannel = (): BroadcastChannelLike => new FakeBroadcastChannel();
  return {
    database,
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
      cookieJar: { cookie: isSignedIn ? HINT_COOKIE : "" },
    },
  };
}

function PromptProbe(): JSX.Element {
  const { requireSignIn } = useSignInPrompt();
  const status = useAuth((state) => state.auth.status);
  const [outcome, setOutcome] = useState("none");

  return (
    <div>
      <p>{`status:${status}`}</p>
      <button
        type="button"
        onClick={() => {
          setOutcome(requireSignIn("cloudSave") ? "allowed" : "blocked");
        }}
      >
        {TRIGGER_NAME}
      </button>
      <p>{outcome}</p>
    </div>
  );
}

function renderPrompt(
  fixture: Fixture,
  isSignedIn: boolean,
  themePreference: ThemePreference = "light",
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <StorageProvider storage={fixture.storage}>
      <AuthProvider
        hasAuthHint={isSignedIn}
        dependencies={fixture.dependencies}
      >
        <SignInPromptProvider>
          <PromptProbe />
        </SignInPromptProvider>
      </AuthProvider>
    </StorageProvider>,
    { locale: "en", themePreference },
  );
}

describe("SignInPrompt", () => {
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
    window.history.replaceState({}, "", "/");
  });

  it("opens the dialog and returns false when signed out", async () => {
    const fixture = track(setUp(false));
    const { user } = renderPrompt(fixture, false);

    await user.click(screen.getByRole("button", { name: TRIGGER_NAME }));

    expect(
      await screen.findByRole("dialog", {
        name: "This feature needs an account",
      }),
    ).toBeDefined();
    expect(screen.getByText("blocked")).toBeDefined();
  });

  it("links sign-in and sign-up with the current path as returnTo", async () => {
    window.history.replaceState({}, "", "/schemas/abc?tab=sql");
    const fixture = track(setUp(false));
    const { user } = renderPrompt(fixture, false);

    await user.click(screen.getByRole("button", { name: TRIGGER_NAME }));

    const expected = "returnTo=%2Fschemas%2Fabc%3Ftab%3Dsql";
    expect(
      (await screen.findByRole("link", { name: "Sign in" })).getAttribute(
        "href",
      ),
    ).toBe(`/sign-in?${expected}`);
    expect(
      screen.getByRole("link", { name: "Create account" }).getAttribute("href"),
    ).toBe(`/sign-up?${expected}`);
  });

  it("returns true without opening when signed in", async () => {
    const fixture = track(setUp(true));
    const { user } = renderPrompt(fixture, true);
    await screen.findByText("status:signed-in");

    await user.click(screen.getByRole("button", { name: TRIGGER_NAME }));

    expect(await screen.findByText("allowed")).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Later without calling fetch", async () => {
    const fixture = track(setUp(false));
    const { user } = renderPrompt(fixture, false);
    await user.click(screen.getByRole("button", { name: TRIGGER_NAME }));
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Later" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(fixture.fetchImpl).not.toHaveBeenCalled();
  });

  it("returns focus to the trigger after closing", async () => {
    const fixture = track(setUp(false));
    const { user } = renderPrompt(fixture, false);
    const trigger = screen.getByRole("button", { name: TRIGGER_NAME });
    await user.click(trigger);
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Later" }));

    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("has no axe violations in light and dark themes", async () => {
    const light = track(setUp(false));
    const lightRender = renderPrompt(light, false, "light");
    await lightRender.user.click(
      screen.getByRole("button", { name: TRIGGER_NAME }),
    );
    await screen.findByRole("dialog");

    await expectNoAxeViolations(document.body);

    lightRender.unmount();
    const dark = track(setUp(false));
    const darkRender = renderPrompt(dark, false, "dark");
    await darkRender.user.click(
      screen.getByRole("button", { name: TRIGGER_NAME }),
    );
    await screen.findByRole("dialog");

    await expectNoAxeViolations(document.body);
  });
});
