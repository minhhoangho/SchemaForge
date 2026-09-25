import { screen } from "@testing-library/react";
import type { JSX } from "react";
import { describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/components/auth-provider";
import type { AuthProviderDependencies } from "@/components/auth-provider";
import type { BroadcastChannelLike } from "@/lib/auth/auth-channel";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { StorageProvider } from "@/lib/storage/storage-context";
import { createFakeAuthLockManager } from "@/testing/fake-auth-lock-manager";
import { renderWithProviders } from "@/testing/render-with-providers";

import SignInPage, { generateMetadata } from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn<(href: string) => void>() }),
}));

// next/headers only works inside a request, so the locale the request would
// negotiate is supplied here.
vi.mock("@/lib/i18n/request-locale", () => ({
  getRequestLocale: vi.fn<() => Promise<"en" | "vi">>(),
}));

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

async function renderPage(
  returnTo: string | readonly string[] | undefined,
): Promise<void> {
  const page: JSX.Element = await SignInPage({
    searchParams: Promise.resolve(returnTo === undefined ? {} : { returnTo }),
  });
  renderWithProviders(
    <StorageProvider>
      <AuthProvider hasAuthHint={false} dependencies={DEPENDENCIES}>
        {page}
      </AuthProvider>
    </StorageProvider>,
    { locale: "en" },
  );
}

function signUpHref(): string | null {
  return screen
    .getByRole("link", { name: "Don't have an account? Create one" })
    .getAttribute("href");
}

describe("SignInPage", () => {
  it("passes a sanitized returnTo to the screen", async () => {
    await renderPage("//evil.com");

    expect(signUpHref()).toBe("/sign-up?returnTo=%2F");
  });

  it("uses the first returnTo when the parameter repeats", async () => {
    await renderPage(["/schemas/a", "/schemas/b"]);

    expect(signUpHref()).toBe("/sign-up?returnTo=%2Fschemas%2Fa");
  });

  it("falls back to the list without a returnTo", async () => {
    await renderPage(undefined);

    expect(signUpHref()).toBe("/sign-up?returnTo=%2F");
  });

  it.each([
    ["en", "Sign in – SchemaForge"],
    ["vi", "Đăng nhập – SchemaForge"],
  ] as const)("translates the page title in %s", async (locale, title) => {
    vi.mocked(getRequestLocale).mockResolvedValue(locale);

    const metadata = await generateMetadata();

    expect(metadata.title).toBe(title);
  });
});
