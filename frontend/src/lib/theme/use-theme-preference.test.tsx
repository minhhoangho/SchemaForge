import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useThemePreference } from "./use-theme-preference";

describe("useThemePreference", () => {
  it("throws when used outside ThemeProvider", () => {
    // React logs the render error itself; silence it so the run stays readable.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // The error is asserted below, so it does not need to be printed.
    });

    expect(() => renderHook(() => useThemePreference())).toThrow(
      /ThemeProvider/,
    );

    errorSpy.mockRestore();
  });
});
