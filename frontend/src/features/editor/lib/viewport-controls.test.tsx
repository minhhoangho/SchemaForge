import { renderHook } from "@testing-library/react";
import type { JSX, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ViewportControls } from "./viewport-controls";
import {
  useViewportControls,
  ViewportControlsProvider,
} from "./viewport-controls";

function createControls(): ViewportControls {
  return {
    zoomIn: vi.fn<() => void>(),
    zoomOut: vi.fn<() => void>(),
    fitView: vi.fn<() => void>(),
    setCenter:
      vi.fn<
        (
          x: number,
          y: number,
          options: { readonly zoom: number; readonly duration: number },
        ) => void
      >(),
    getZoom: vi.fn<() => number>(() => 1),
  };
}

describe("useViewportControls", () => {
  it("exposes the controls to consumers", () => {
    const controls = createControls();
    function Wrapper({
      children,
    }: {
      readonly children: ReactNode;
    }): JSX.Element {
      return (
        <ViewportControlsProvider controls={controls}>
          {children}
        </ViewportControlsProvider>
      );
    }

    const { result } = renderHook(() => useViewportControls(), {
      wrapper: Wrapper,
    });

    expect(result.current).toBe(controls);
  });

  it("throws when used outside the provider", () => {
    expect(() => renderHook(() => useViewportControls())).toThrow(
      "useViewportControls must be used inside a ViewportControlsProvider.",
    );
  });
});
