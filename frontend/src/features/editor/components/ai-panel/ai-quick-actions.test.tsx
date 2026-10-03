import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { AiQuickActions } from "./ai-quick-actions";

const CASES = [
  {
    locale: "en",
    name: "Improve",
    message: "Suggest improvements to this schema.",
  },
  {
    locale: "en",
    name: "Explain",
    message: "Explain this schema: its tables, columns and relations.",
  },
  {
    locale: "en",
    name: "Find issues",
    message: "Find design issues in this schema.",
  },
  {
    locale: "en",
    name: "Sample data",
    message: "Generate sample data for this schema.",
  },
  {
    locale: "vi",
    name: "Cải thiện",
    message: "Hãy gợi ý cải thiện cho schema này.",
  },
  {
    locale: "vi",
    name: "Giải thích",
    message: "Hãy giải thích schema này: các bảng, cột và quan hệ.",
  },
  {
    locale: "vi",
    name: "Tìm lỗi",
    message: "Hãy tìm lỗi thiết kế trong schema này.",
  },
  {
    locale: "vi",
    name: "Dữ liệu mẫu",
    message: "Hãy sinh dữ liệu mẫu cho schema này.",
  },
] as const;

describe("AiQuickActions", () => {
  it.each(CASES)(
    "sends the prepared message in the interface language ($locale, $name)",
    async ({ locale, name, message }) => {
      const onSend = vi.fn<(text: string) => void>();
      const { user } = renderWithProviders(
        <AiQuickActions isDisabled={false} onSend={onSend} />,
        { locale },
      );

      await user.click(screen.getByRole("button", { name }));

      expect(onSend).toHaveBeenCalledExactlyOnceWith(message);
    },
  );

  it("is a named group reachable and usable with the keyboard only", async () => {
    const onSend = vi.fn<(text: string) => void>();
    const { user } = renderWithProviders(
      <AiQuickActions isDisabled={false} onSend={onSend} />,
      { locale: "en" },
    );

    expect(screen.getByRole("group", { name: "Quick actions" })).toBeTruthy();
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Improve" }),
    );
    await user.tab();
    await user.keyboard("{Enter}");

    expect(onSend).toHaveBeenCalledExactlyOnceWith(
      "Explain this schema: its tables, columns and relations.",
    );
  });

  it("disables every button while disabled", () => {
    renderWithProviders(
      <AiQuickActions isDisabled onSend={vi.fn<(text: string) => void>()} />,
      { locale: "en" },
    );

    for (const button of screen.getAllByRole("button")) {
      expect(button.hasAttribute("disabled")).toBe(true);
    }
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations in the %s theme",
    async (themePreference) => {
      const { container } = renderWithProviders(
        <AiQuickActions
          isDisabled={false}
          onSend={vi.fn<(text: string) => void>()}
        />,
        { locale: "en", themePreference },
      );

      await expectNoAxeViolations(container);
    },
  );
});
