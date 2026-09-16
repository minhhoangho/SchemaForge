import { renderHook } from "@testing-library/react";
import type { JSX, ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/components/i18n-provider";

import { useNotify } from "./use-notify";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function I18nWrapper({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return <I18nProvider locale="vi">{children}</I18nProvider>;
}

describe("useNotify", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it("shows toast text translated in the provider locale", () => {
    const { result } = renderHook(() => useNotify(), { wrapper: I18nWrapper });

    result.current({ tone: "error", titleKey: "storage:unknown" });

    expect(toast.error).toHaveBeenCalledWith(
      "Không lưu được. Hãy thử lại.",
      {},
    );
  });

  it("shows a toast for a key that takes interpolation values", () => {
    const { result } = renderHook(() => useNotify(), { wrapper: I18nWrapper });

    result.current({
      tone: "error",
      titleKey: "issues:table-name-duplicate",
      values: { table: "users" },
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Bảng “users” trùng tên với một bảng hoặc enum khác.",
      {},
    );
  });

  it("returns the same notify function across rerenders", () => {
    const { result, rerender } = renderHook(() => useNotify(), {
      wrapper: I18nWrapper,
    });
    const firstNotify = result.current;

    rerender();

    expect(result.current).toBe(firstNotify);
  });
});
