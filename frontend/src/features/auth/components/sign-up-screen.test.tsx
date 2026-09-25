import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/components/auth-provider";
import type { AuthProviderDependencies } from "@/components/auth-provider";
import type { BroadcastChannelLike } from "@/lib/auth/auth-channel";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { StorageProvider } from "@/lib/storage/storage-context";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { createFakeAuthLockManager } from "@/testing/fake-auth-lock-manager";
import { renderWithProviders } from "@/testing/render-with-providers";

import { SignUpScreen } from "./sign-up-screen";

const { replace } = vi.hoisted(() => ({
  replace: vi.fn<(href: string) => void>(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

// No IndexedDB in jsdom: a guest needs no session record here.
vi.mock("@/lib/storage/create-browser-storage", () => ({
  createBrowserStorage: () => {
    throw new DOMException("IndexedDB is blocked.", "SecurityError");
  },
}));

class SilentBroadcastChannel extends EventTarget {
  postMessage(): void {
    // No other tab listens in these tests.
  }

  close(): void {
    // Nothing was opened.
  }
}

const DEPENDENCIES: AuthProviderDependencies = {
  fetchImpl: vi.fn<typeof fetch>(() =>
    Promise.reject(new TypeError("A guest makes no request here.")),
  ),
  authLockManager: createFakeAuthLockManager().lockManager,
  openChannel: (): BroadcastChannelLike => new SilentBroadcastChannel(),
  cookieJar: { cookie: "" },
};

// A hinted session whose me request succeeds, so auth becomes signed-in
// before the user submits anything.
const SIGNED_IN_DEPENDENCIES: AuthProviderDependencies = {
  ...DEPENDENCIES,
  fetchImpl: vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          user: {
            id: "11111111-1111-4111-8111-111111111111",
            email: "user@example.com",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  ),
  cookieJar: { cookie: "sf-auth-hint=1" },
};

function renderScreen(
  themePreference: ThemePreference = "light",
  dependencies: AuthProviderDependencies = DEPENDENCIES,
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <StorageProvider>
      <AuthProvider
        hasAuthHint={dependencies.cookieJar.cookie !== ""}
        dependencies={dependencies}
      >
        <SignUpScreen returnTo="/schemas/abc" />
      </AuthProvider>
    </StorageProvider>,
    { locale: "en", themePreference },
  );
}

describe("SignUpScreen", () => {
  afterEach(() => {
    replace.mockClear();
  });

  it("redirects a signed-in user to the list on mount", async () => {
    renderScreen("light", SIGNED_IN_DEPENDENCIES);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledExactlyOnceWith("/");
    });
  });

  it("states that no email verification is needed", () => {
    renderScreen();

    expect(
      screen.getByText(
        "Your account works right away, no email verification needed.",
      ),
    ).toBeDefined();
  });

  it("links to sign-in keeping returnTo", () => {
    renderScreen();

    expect(
      screen
        .getByRole("link", { name: "Already have an account? Sign in" })
        .getAttribute("href"),
    ).toBe("/sign-in?returnTo=%2Fschemas%2Fabc");
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations in light and dark themes (%s)",
    async (themePreference) => {
      const { container } = renderScreen(themePreference);
      await screen.findByRole("heading", {
        level: 1,
        name: "Create an account",
      });

      await expectNoAxeViolations(container);
    },
  );
});
