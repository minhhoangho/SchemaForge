import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import {
  AiConsent,
  aiConsentKey,
  GEMINI_API_TERMS_URL,
  readAiConsent,
} from "./ai-consent";

const ACCEPT = "Agree and continue";

function renderConsent(
  userId = "user-1",
  themePreference: "light" | "dark" = "light",
): {
  readonly onAccepted: ReturnType<typeof vi.fn<() => void>>;
} & ReturnType<typeof renderWithProviders> {
  const onAccepted = vi.fn<() => void>();
  const rendered = renderWithProviders(
    <AiConsent userId={userId} onAccepted={onAccepted} />,
    { locale: "en", themePreference },
  );
  return { onAccepted, ...rendered };
}

describe("AiConsent", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("remembers consent per user id", async () => {
    const { user, onAccepted } = renderConsent("user-1");

    expect(readAiConsent("user-1")).toBe(false);
    await user.click(screen.getByRole("button", { name: ACCEPT }));

    expect(onAccepted).toHaveBeenCalledOnce();
    expect(localStorage.getItem("schemaforge:ai-consent:user-1")).toBe("1");
    expect(aiConsentKey("user-1")).toBe("schemaforge:ai-consent:user-1");
    expect(readAiConsent("user-1")).toBe(true);
    expect(localStorage).toHaveLength(1);
  });

  it("asks again for another account", async () => {
    const { user } = renderConsent("user-1");
    await user.click(screen.getByRole("button", { name: ACCEPT }));

    expect(readAiConsent("user-2")).toBe(false);
  });

  it("asks again when localStorage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { user, onAccepted } = renderConsent();

    expect(readAiConsent("user-1")).toBe(false);
    await user.click(screen.getByRole("button", { name: ACCEPT }));

    expect(onAccepted).toHaveBeenCalledOnce();
  });

  it("links to the Gemini API terms in a new tab", () => {
    renderConsent();

    const link = screen.getByRole("link", { name: /Gemini API data terms/ });

    expect(link.getAttribute("href")).toBe(GEMINI_API_TERMS_URL);
    expect(GEMINI_API_TERMS_URL).toBe("https://ai.google.dev/gemini-api/terms");
    expect(link.textContent).toContain("(opens in a new tab)");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations in the %s theme",
    async (theme) => {
      const { container } = renderConsent("user-1", theme);

      await expectNoAxeViolations(container);
    },
  );
});
