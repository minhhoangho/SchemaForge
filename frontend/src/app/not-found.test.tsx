import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import NotFound from "./not-found";

describe("NotFound", () => {
  it.each([
    { locale: "vi", title: "Không tìm thấy trang" },
    { locale: "en", title: "Page not found" },
  ] as const)(
    "shows a translated not found message in $locale",
    ({ locale, title }) => {
      renderWithProviders(<NotFound />, { locale });

      expect(
        screen.getByRole("heading", { level: 1, name: title }),
      ).toBeDefined();
    },
  );

  it("links back to the schema list", () => {
    renderWithProviders(<NotFound />, { locale: "en" });

    expect(
      screen
        .getByRole("link", { name: "Back to your schemas" })
        .getAttribute("href"),
    ).toBe("/");
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const { container } = renderWithProviders(<NotFound />, {
        themePreference,
      });

      await expectNoAxeViolations(container);
    },
  );
});
