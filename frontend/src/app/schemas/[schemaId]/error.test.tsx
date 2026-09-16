import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import EditorError from "./error";

function createCrash(): Error {
  const error = new Error("Cannot read the secret schema name.");
  error.name = "TypeError";
  return error;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EditorError", () => {
  it("shows a translated crash message without the error message", () => {
    vi.spyOn(logger, "error").mockImplementation(() => undefined);

    renderWithProviders(
      <EditorError error={createCrash()} reset={vi.fn<() => void>()} />,
      { locale: "vi" },
    );

    expect({
      title: screen.getByRole("heading", { level: 1 }).textContent,
      hasErrorMessage:
        screen.queryByText(/Cannot read the secret schema name/) !== null,
    }).toEqual({ title: "Đã có lỗi xảy ra", hasErrorMessage: false });
  });

  it("resets the route when reload is pressed", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const reset = vi.fn<() => void>();
    const { user } = renderWithProviders(
      <EditorError error={createCrash()} reset={reset} />,
      { locale: "en" },
    );

    await user.click(screen.getByRole("button", { name: "Reload" }));

    expect(reset).toHaveBeenCalledOnce();
  });

  it("links back to the schema list", () => {
    vi.spyOn(logger, "error").mockImplementation(() => undefined);

    renderWithProviders(
      <EditorError error={createCrash()} reset={vi.fn<() => void>()} />,
      { locale: "en" },
    );

    expect(
      screen
        .getByRole("link", { name: "Back to your schemas" })
        .getAttribute("href"),
    ).toBe("/");
  });

  it("moves focus to the heading when it mounts", () => {
    vi.spyOn(logger, "error").mockImplementation(() => undefined);

    renderWithProviders(
      <EditorError error={createCrash()} reset={vi.fn<() => void>()} />,
      { locale: "en" },
    );

    expect(document.activeElement).toBe(
      screen.getByRole("heading", { level: 1 }),
    );
  });

  it("logs only the name of the error", () => {
    const logError = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined);

    renderWithProviders(
      <EditorError error={createCrash()} reset={vi.fn<() => void>()} />,
      { locale: "en" },
    );

    expect(logError.mock.calls).toEqual([
      ["editor.crashed", { errorName: "TypeError" }],
    ]);
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      vi.spyOn(logger, "error").mockImplementation(() => undefined);
      const { container } = renderWithProviders(
        <EditorError error={createCrash()} reset={vi.fn<() => void>()} />,
        { locale: "en", themePreference },
      );

      await expectNoAxeViolations(container);
    },
  );
});
