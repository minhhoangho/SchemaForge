import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider } from "@xyflow/react";
import type { JSX } from "react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ViewportControls } from "../lib/viewport-controls";
import {
  VIEWPORT_TRANSITION_MS,
  ViewportControlsProvider,
} from "../lib/viewport-controls";
import { useRevealFocusedElement } from "./use-reveal-focused-element";

const FOCUS_VISIBLE_SELECTOR = ":focus-visible";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const CANVAS_RECT = new DOMRect(0, 0, 1000, 800);
const MINIMAP_RECT = new DOMRect(780, 630, 200, 150);
const HIDDEN_NODE_RECT = new DOMRect(800, 650, 100, 60);
const VISIBLE_NODE_RECT = new DOMRect(100, 100, 200, 100);
// Entirely to the right of the canvas rect (canvas right edge is x=1000).
const OUTSIDE_VIEWPORT_NODE_RECT = new DOMRect(1200, 0, 200, 100);
const TOAST_RECT = new DOMRect(300, 700, 400, 100);
// Entirely inside the canvas rect, and entirely inside TOAST_RECT.
const NODE_UNDER_TOAST_RECT = new DOMRect(400, 720, 100, 60);
const ZOOM = 2;

function createControls(): ViewportControls {
  return {
    zoomIn: vi.fn<ViewportControls["zoomIn"]>(),
    zoomOut: vi.fn<ViewportControls["zoomOut"]>(),
    fitView: vi.fn<ViewportControls["fitView"]>(),
    setCenter: vi.fn<ViewportControls["setCenter"]>(),
    getZoom: vi.fn<ViewportControls["getZoom"]>(() => ZOOM),
  };
}

// Stands in for the React Flow canvas: jsdom has no layout, so every box the
// hook measures is given explicitly.
function FakeCanvas(): JSX.Element {
  const [canvasElement, setCanvasElement] = useState<HTMLElement | null>(null);
  useRevealFocusedElement(canvasElement);

  return (
    <div ref={setCanvasElement} data-testid="canvas">
      <button type="button">Before canvas</button>
      <button type="button" className="react-flow__node">
        users
      </button>
      <div className="react-flow__minimap" data-testid="minimap" />
      <div data-sonner-toaster data-testid="toast-area" />
    </div>
  );
}

type RenderCanvasOptions = {
  readonly nodeRect: DOMRect;
  // jsdom never matches :focus-visible when user-event moves focus, so each
  // test gives the browser's answer: true after Tab, false after a click.
  readonly isFocusVisible: boolean;
  // Left unset when a test does not need the toast area to cover anything;
  // jsdom's default zero-size rect then never obscures the node.
  readonly toastRect?: DOMRect;
};

function renderCanvas(
  controls: ViewportControls,
  { nodeRect, isFocusVisible, toastRect }: RenderCanvasOptions,
): void {
  render(
    <ReactFlowProvider>
      <ViewportControlsProvider controls={controls}>
        <FakeCanvas />
      </ViewportControlsProvider>
    </ReactFlowProvider>,
  );
  vi.spyOn(
    screen.getByTestId("canvas"),
    "getBoundingClientRect",
  ).mockReturnValue(CANVAS_RECT);
  vi.spyOn(
    screen.getByTestId("minimap"),
    "getBoundingClientRect",
  ).mockReturnValue(MINIMAP_RECT);
  if (toastRect !== undefined) {
    vi.spyOn(
      screen.getByTestId("toast-area"),
      "getBoundingClientRect",
    ).mockReturnValue(toastRect);
  }
  const node = screen.getByRole("button", { name: "users" });
  vi.spyOn(node, "getBoundingClientRect").mockReturnValue(nodeRect);
  vi.spyOn(node, "matches").mockImplementation((selectors) =>
    selectors === FOCUS_VISIBLE_SELECTOR
      ? isFocusVisible
      : Element.prototype.matches.call(node, selectors),
  );
}

function stubReducedMotion(): void {
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: media === REDUCED_MOTION_QUERY,
    media,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useRevealFocusedElement", () => {
  it("centers the viewport on a focused node hidden behind the minimap", async () => {
    const user = userEvent.setup();
    const controls = createControls();
    renderCanvas(controls, {
      nodeRect: HIDDEN_NODE_RECT,
      isFocusVisible: true,
    });

    await user.tab();
    await user.tab();

    expect(controls.setCenter).toHaveBeenCalledWith(425, 340, {
      zoom: ZOOM,
      duration: VIEWPORT_TRANSITION_MS,
    });
  });

  it("does nothing when the focused node is visible", async () => {
    const user = userEvent.setup();
    const controls = createControls();
    renderCanvas(controls, {
      nodeRect: VISIBLE_NODE_RECT,
      isFocusVisible: true,
    });

    await user.tab();
    await user.tab();

    expect(controls.setCenter).not.toHaveBeenCalled();
  });

  it("uses no transition when reduced motion is requested", async () => {
    stubReducedMotion();
    const user = userEvent.setup();
    const controls = createControls();
    renderCanvas(controls, {
      nodeRect: HIDDEN_NODE_RECT,
      isFocusVisible: true,
    });

    await user.tab();
    await user.tab();

    expect(controls.setCenter).toHaveBeenCalledWith(425, 340, {
      zoom: ZOOM,
      duration: 0,
    });
  });

  it("centers the viewport on a focused node entirely outside the canvas rect", async () => {
    const user = userEvent.setup();
    const controls = createControls();
    renderCanvas(controls, {
      nodeRect: OUTSIDE_VIEWPORT_NODE_RECT,
      isFocusVisible: true,
    });

    await user.tab();
    await user.tab();

    expect(controls.setCenter).toHaveBeenCalledWith(650, 25, {
      zoom: ZOOM,
      duration: VIEWPORT_TRANSITION_MS,
    });
  });

  it("centers the viewport on a focused node hidden behind the toast area", async () => {
    const user = userEvent.setup();
    const controls = createControls();
    renderCanvas(controls, {
      nodeRect: NODE_UNDER_TOAST_RECT,
      isFocusVisible: true,
      toastRect: TOAST_RECT,
    });

    await user.tab();
    await user.tab();

    expect(controls.setCenter).toHaveBeenCalledWith(225, 375, {
      zoom: ZOOM,
      duration: VIEWPORT_TRANSITION_MS,
    });
  });

  it("ignores a node focused by a pointer", async () => {
    const user = userEvent.setup();
    const controls = createControls();
    renderCanvas(controls, {
      nodeRect: HIDDEN_NODE_RECT,
      isFocusVisible: false,
    });

    await user.click(screen.getByRole("button", { name: "users" }));

    expect(controls.setCenter).not.toHaveBeenCalled();
  });
});
