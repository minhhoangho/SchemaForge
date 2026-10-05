import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { CodeView } from "./code-view";
import type { CodeViewProps } from "./code-view";

const SQL_RESPONSE: CodeViewProps["response"] = {
  requestId: 1,
  kind: "ok",
  file: {
    fileName: "schema.sql",
    language: "sql",
    content: "CREATE TABLE users;\n",
  },
  diagnostics: [],
  tokens: [
    [
      { content: "CREATE", color: "var(--code-token-keyword)" },
      { content: " TABLE users;", color: null },
    ],
  ],
};

const DBML_RESPONSE: CodeViewProps["response"] = {
  ...SQL_RESPONSE,
  file: {
    fileName: "schema.dbml",
    language: "dbml",
    content: "Table users {}\n",
  },
  tokens: null,
};

const downloadBlob = vi.fn<(blob: Blob, fileName: string) => void>();
vi.mock("@/lib/download/download-blob", () => ({
  downloadBlob: (blob: Blob, fileName: string): void => {
    downloadBlob(blob, fileName);
  },
}));

afterEach(() => {
  downloadBlob.mockClear();
  toast.dismiss();
  vi.restoreAllMocks();
});

function renderView(
  response: CodeViewProps["response"],
  themePreference: "light" | "dark" = "light",
  isBusy = false,
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <CodeView
      response={response}
      targetLabel="SQL DDL"
      isBusy={isBusy}
      schemaName="Quản lý"
      request={{ target: "postgresql", options: {} }}
    />,
    { locale: "en", themePreference },
  );
}

describe("CodeView", () => {
  it("renders tokens as spans without html strings", () => {
    renderView(SQL_RESPONSE);

    const keyword = screen.getByText("CREATE");

    expect(keyword.tagName).toBe("SPAN");
    expect(keyword.style.color).toBe("var(--code-token-keyword)");
  });

  it("shows markup in the code as text", () => {
    renderView({
      ...SQL_RESPONSE,
      tokens: [[{ content: "<img src=x onerror=alert(1)>", color: null }]],
    });

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeDefined();
  });

  it("renders plain text when there are no tokens", () => {
    renderView(DBML_RESPONSE);

    expect(
      screen.getByRole("region", { name: "SQL DDL code" }).textContent,
    ).toBe("Table users {}\n");
  });

  it("copies the code and shows a toast", async () => {
    const { user } = renderView(SQL_RESPONSE);

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(await navigator.clipboard.readText()).toBe("CREATE TABLE users;\n");
    expect(await screen.findByText("Code copied")).toBeDefined();
  });

  it("shows an error toast when the clipboard is denied", async () => {
    const { user } = renderView(SQL_RESPONSE);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new DOMException("denied", "NotAllowedError"),
    );

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(await screen.findByText("Could not copy the code")).toBeDefined();
  });

  it("downloads the shown output with its file name", async () => {
    const { user } = renderView(SQL_RESPONSE);

    await user.click(screen.getByRole("button", { name: "Download file" }));

    const [blob, name] = downloadBlob.mock.calls[0] ?? [];
    expect(name).toBe("quan-ly.postgresql.sql");
    expect(await blob?.text()).toBe("CREATE TABLE users;\n");
    expect(blob?.type).toBe("text/plain;charset=utf-8");
  });

  it("disables the download button while busy", () => {
    renderView(SQL_RESPONSE, "light", true);

    expect(
      screen
        .getByRole("button", { name: "Download file" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("exposes a focusable code region with a label", async () => {
    const { user } = renderView(SQL_RESPONSE);

    await user.tab();
    await user.tab();
    await user.tab();

    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "SQL DDL code" }),
    );
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const { container } = renderView(SQL_RESPONSE, themePreference);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Copy" })).toBeDefined();
      });
      await expectNoAxeViolations(container);
    },
  );
});
