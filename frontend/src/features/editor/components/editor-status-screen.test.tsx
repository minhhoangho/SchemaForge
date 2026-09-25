import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { EditorStatusScreen } from "./editor-status-screen";

describe("EditorStatusScreen", () => {
  it.each([
    [
      "not-found",
      "Schema not found",
      "This schema does not exist in this browser. It may have been deleted.",
    ],
    [
      "locked",
      "This schema is open in another tab",
      "It opens here automatically once the other tab closes it or leaves it.",
    ],
    [
      "unsupported-version",
      "This schema needs a newer version of SchemaForge",
      "The schema was saved by a newer version of SchemaForge. Reload the page.",
    ],
    [
      "unreadable",
      "The schema data is damaged",
      "The saved schema could not be read. It was left untouched in storage.",
    ],
    [
      "storage-unavailable",
      "Storage is unavailable",
      "The schema could not be read from browser storage. Reload the page.",
    ],
  ] as const)("shows the %s message", (variant, title, description) => {
    renderWithProviders(<EditorStatusScreen variant={variant} />, {
      locale: "en",
    });

    expect({
      title: screen.getByRole("heading", { level: 1 }).textContent,
      hasDescription: screen.queryByText(description) !== null,
    }).toEqual({ title, hasDescription: true });
  });

  it("links back to the schema list", () => {
    renderWithProviders(<EditorStatusScreen variant="not-found" />, {
      locale: "vi",
    });

    expect(
      screen
        .getByRole("link", { name: "Quay lại danh sách schema" })
        .getAttribute("href"),
    ).toBe("/");
  });

  it("shows the translated storage message for an unavailable storage", () => {
    renderWithProviders(
      <EditorStatusScreen
        variant="storage-unavailable"
        storageErrorCode="quota-exceeded"
      />,
      { locale: "en" },
    );

    expect(
      screen.getByText(
        "Browser storage is full. Delete some schemas and try again.",
      ),
    ).toBeDefined();
  });

  it("describes an unknown storage error as a failed read", () => {
    renderWithProviders(
      <EditorStatusScreen
        variant="storage-unavailable"
        storageErrorCode="unknown"
      />,
      { locale: "vi" },
    );

    expect({
      hasReadMessage:
        screen.queryByText(
          "Không đọc được schema từ bộ nhớ trình duyệt. Hãy tải lại trang.",
        ) !== null,
      hasSaveMessage: screen.queryByText(/Không lưu được/) !== null,
    }).toEqual({ hasReadMessage: true, hasSaveMessage: false });
  });

  it("moves focus to the heading when it mounts", () => {
    renderWithProviders(<EditorStatusScreen variant="locked" />, {
      locale: "en",
    });

    expect(document.activeElement).toBe(
      screen.getByRole("heading", { level: 1 }),
    );
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const { container } = renderWithProviders(
        <EditorStatusScreen variant="locked" />,
        { locale: "en", themePreference },
      );

      await expectNoAxeViolations(container);
    },
  );

  it("shows a retry button for needs-network and calls onRetry", async () => {
    const handleRetry = vi.fn<() => void>();
    const { user } = renderWithProviders(
      <EditorStatusScreen variant="needs-network" onRetry={handleRetry} />,
      { locale: "en" },
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect({
      title: screen.getByRole("heading", { level: 1 }).textContent,
      retryCount: handleRetry.mock.calls.length,
    }).toEqual({
      title: "You need a network connection to open this schema",
      retryCount: 1,
    });
  });

  it("shows the deleted elsewhere title", () => {
    renderWithProviders(<EditorStatusScreen variant="deleted-elsewhere" />, {
      locale: "vi",
    });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Schema đã bị xóa ở thiết bị khác",
    );
  });

  it("shows a sign-in link with returnTo on not-found when offered", () => {
    renderWithProviders(
      <EditorStatusScreen
        variant="not-found"
        signInHref="/sign-in?returnTo=%2Fschemas%2Fabc"
      />,
      { locale: "en" },
    );

    expect(
      screen
        .getByRole("link", {
          name: "Sign in to see this schema if it is stored in the cloud",
        })
        .getAttribute("href"),
    ).toBe("/sign-in?returnTo=%2Fschemas%2Fabc");
  });

  it.each([
    ["needs-network", "light"],
    ["needs-network", "dark"],
    ["deleted-elsewhere", "light"],
    ["deleted-elsewhere", "dark"],
    ["not-found", "light"],
    ["not-found", "dark"],
  ] as const)(
    "has no axe violations for the %s variant in the %s theme",
    async (variant, themePreference) => {
      const { container } = renderWithProviders(
        <EditorStatusScreen
          variant={variant}
          onRetry={vi.fn<() => void>()}
          signInHref="/sign-in?returnTo=%2F"
        />,
        { locale: "en", themePreference },
      );

      await expectNoAxeViolations(container);
    },
  );
});
