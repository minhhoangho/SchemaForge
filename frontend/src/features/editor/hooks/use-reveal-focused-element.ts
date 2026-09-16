import { useStoreApi } from "@xyflow/react";
import { useEffect } from "react";

import { isFocusTargetObscured } from "../lib/is-focus-target-obscured";
import {
  useViewportControls,
  VIEWPORT_TRANSITION_MS,
} from "../lib/viewport-controls";

const FOCUS_TARGET_SELECTOR = ".react-flow__node, .react-flow__edge";
const KEYBOARD_FOCUS_SELECTOR = ":focus-visible";
const MINIMAP_SELECTOR = ".react-flow__minimap";
const TOAST_AREA_SELECTOR = "[data-sonner-toaster]";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const HALF = 2;

function measureOverlays(canvasElement: HTMLElement): readonly DOMRect[] {
  // Toasts are portalled to the body, so they are looked up in the document.
  const overlays = [
    ...canvasElement.querySelectorAll(MINIMAP_SELECTOR),
    ...canvasElement.ownerDocument.querySelectorAll(TOAST_AREA_SELECTOR),
  ];
  return overlays.map((overlay) => overlay.getBoundingClientRect());
}

function isKeyboardFocusTarget(target: EventTarget | null): target is Element {
  return (
    target instanceof Element &&
    target.matches(FOCUS_TARGET_SELECTOR) &&
    target.matches(KEYBOARD_FOCUS_SELECTOR)
  );
}

/**
 * Pans the canvas to a node or edge that received keyboard focus while
 * entirely hidden by the minimap, the toast area or the canvas edge
 * (WCAG 2.4.11). React Flow's own `autoPanOnNodeFocus` is off because it
 * ignores overlays and edges.
 */
export function useRevealFocusedElement(
  canvasElement: HTMLElement | null,
): void {
  const controls = useViewportControls();
  const flowStore = useStoreApi();

  useEffect(() => {
    if (canvasElement === null) {
      return undefined;
    }

    function handleFocusIn(event: FocusEvent): void {
      if (canvasElement === null || !isKeyboardFocusTarget(event.target)) {
        return;
      }
      const target = event.target.getBoundingClientRect();
      const canvas = canvasElement.getBoundingClientRect();
      const overlays = measureOverlays(canvasElement);
      if (!isFocusTargetObscured({ target, canvas, overlays })) {
        return;
      }
      const [translateX, translateY] = flowStore.getState().transform;
      const zoom = controls.getZoom();
      const centerX = target.left + target.width / HALF - canvas.left;
      const centerY = target.top + target.height / HALF - canvas.top;
      const isReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
      controls.setCenter(
        (centerX - translateX) / zoom,
        (centerY - translateY) / zoom,
        { zoom, duration: isReducedMotion ? 0 : VIEWPORT_TRANSITION_MS },
      );
    }

    canvasElement.addEventListener("focusin", handleFocusIn);
    return () => {
      canvasElement.removeEventListener("focusin", handleFocusIn);
    };
  }, [canvasElement, controls, flowStore]);
}
