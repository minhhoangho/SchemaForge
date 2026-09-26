import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Locale } from "@/lib/i18n/supported-locales";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import type { CloudStatusView } from "../../lib/to-cloud-status-view";
import { CloudStatusBadge } from "./cloud-status-badge";
import type { CloudStatusBadgeProps } from "./cloud-status-badge";

type Handlers = {
  readonly onRetry: ReturnType<typeof vi.fn<CloudStatusBadgeProps["onRetry"]>>;
  readonly onSaveToCloud: ReturnType<
    typeof vi.fn<CloudStatusBadgeProps["onSaveToCloud"]>
  >;
  readonly onOpenCloudDialog: ReturnType<
    typeof vi.fn<CloudStatusBadgeProps["onOpenCloudDialog"]>
  >;
};

type RenderOptions = {
  readonly locale?: Locale;
  readonly themePreference?: ThemePreference;
};

function renderBadge(
  status: CloudStatusView,
  options: RenderOptions = {},
): ReturnType<typeof renderWithProviders> & Handlers {
  const handlers: Handlers = {
    onRetry: vi.fn<CloudStatusBadgeProps["onRetry"]>(),
    onSaveToCloud: vi.fn<CloudStatusBadgeProps["onSaveToCloud"]>(),
    onOpenCloudDialog: vi.fn<CloudStatusBadgeProps["onOpenCloudDialog"]>(),
  };
  const result = renderWithProviders(
    <CloudStatusBadge status={status} {...handlers} />,
    {
      locale: options.locale ?? "en",
      themePreference: options.themePreference ?? "light",
    },
  );
  return { ...result, ...handlers };
}

describe("CloudStatusBadge", () => {
  it.each<readonly [Locale, CloudStatusView, string]>([
    ["en", { kind: "local-only" }, "Only saved on this browser"],
    ["en", { kind: "synced" }, "Saved to the cloud"],
    ["en", { kind: "syncing" }, "Syncing…"],
    [
      "en",
      { kind: "unsynced", reason: "offline" },
      "Not synced, no network connection",
    ],
    [
      "en",
      { kind: "unsynced", reason: "server-unreachable" },
      "Not synced, the server is not responding",
    ],
    ["en", { kind: "unsynced-session-expired" }, "Not synced, sign in again"],
    ["en", { kind: "conflict" }, "Conflict"],
    ["en", { kind: "deleted-in-cloud" }, "Deleted in the cloud"],
    [
      "en",
      { kind: "failed", failure: "payload-too-large" },
      "This schema is too large to save to the cloud.",
    ],
    [
      "en",
      { kind: "failed", failure: "version-unsupported" },
      "The server does not support this data version yet",
    ],
    ["vi", { kind: "local-only" }, "Chỉ lưu trên trình duyệt này"],
    ["vi", { kind: "synced" }, "Đã lưu lên cloud"],
    ["vi", { kind: "syncing" }, "Đang đồng bộ…"],
    [
      "vi",
      { kind: "unsynced", reason: "offline" },
      "Chưa đồng bộ, mất kết nối mạng",
    ],
    [
      "vi",
      { kind: "unsynced", reason: "server-unreachable" },
      "Chưa đồng bộ, máy chủ không phản hồi",
    ],
    [
      "vi",
      { kind: "unsynced-session-expired" },
      "Chưa đồng bộ, hãy đăng nhập lại",
    ],
    ["vi", { kind: "conflict" }, "Xung đột"],
    ["vi", { kind: "deleted-in-cloud" }, "Đã bị xóa trên cloud"],
    [
      "vi",
      { kind: "failed", failure: "schema-limit-reached" },
      "Bạn đã đạt giới hạn số schema trên cloud.",
    ],
  ])(
    "shows a translated label for every cloud status (%s, %o)",
    (locale, status, text) => {
      renderBadge(status, { locale });

      expect(screen.getByText(text, { ignore: "[role=status]" })).toBeDefined();
    },
  );

  it("labels a failure with the failed heading", () => {
    renderBadge({ kind: "failed", failure: "document-invalid" });

    expect(
      screen.getByText("Could not sync", { ignore: "[role=status]" }),
    ).toBeDefined();
  });

  it("announces a conflict in the status region", () => {
    renderBadge({ kind: "conflict" });

    expect(screen.getByRole("status").textContent).toBe("Conflict");
  });

  it("announces a failure with its reason", () => {
    renderBadge({ kind: "failed", failure: "payload-too-large" });

    expect(screen.getByRole("status").textContent).toBe(
      "Could not sync This schema is too large to save to the cloud.",
    );
  });

  it.each<CloudStatusView>([{ kind: "syncing" }, { kind: "synced" }])(
    "does not announce syncing or synced (%o)",
    (status) => {
      renderBadge(status);

      expect(screen.getByRole("status").textContent).toBe("");
    },
  );

  it("calls onSaveToCloud from Save to cloud", async () => {
    const { user, onSaveToCloud } = renderBadge({ kind: "local-only" });

    await user.click(screen.getByRole("button", { name: "Save to cloud" }));

    expect(onSaveToCloud).toHaveBeenCalledOnce();
  });

  it("calls onOpenCloudDialog with conflict from Resolve", async () => {
    const { user, onOpenCloudDialog } = renderBadge({ kind: "conflict" });
    const button = screen.getByRole("button", { name: "Resolve" });

    await user.click(button);

    expect(onOpenCloudDialog).toHaveBeenCalledExactlyOnceWith(
      "conflict",
      button,
    );
  });

  it("calls onOpenCloudDialog with deleted-in-cloud from View options", async () => {
    const { user, onOpenCloudDialog } = renderBadge({
      kind: "deleted-in-cloud",
    });
    const button = screen.getByRole("button", { name: "View options" });

    await user.click(button);

    expect(onOpenCloudDialog).toHaveBeenCalledExactlyOnceWith(
      "deleted-in-cloud",
      button,
    );
  });

  it("calls onRetry from the failed state", async () => {
    const { user, onRetry } = renderBadge({
      kind: "failed",
      failure: "schema-limit-reached",
    });

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it.each<readonly [ThemePreference, CloudStatusView]>([
    ["light", { kind: "local-only" }],
    ["dark", { kind: "local-only" }],
    ["light", { kind: "failed", failure: "document-invalid" }],
    ["dark", { kind: "failed", failure: "document-invalid" }],
    ["light", { kind: "conflict" }],
    ["dark", { kind: "conflict" }],
  ])(
    "has no axe violations in the light and dark themes (%s, %o)",
    async (themePreference, status) => {
      const { container } = renderBadge(status, { themePreference });

      await expectNoAxeViolations(container);
    },
  );
});
