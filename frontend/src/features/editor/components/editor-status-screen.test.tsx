import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
