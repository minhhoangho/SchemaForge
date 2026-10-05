"use client";

import type { Node } from "@xyflow/react";
import type { JSX, ReactNode } from "react";
import { createContext, useContext } from "react";

/**
 * The viewport commands the toolbar and panels need. The canvas builds them
 * from `useReactFlow`; consumers depend only on this shape, so they neither
 * load React Flow nor need a `ReactFlowProvider` in tests.
 */
export type ViewportControls = {
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly fitView: () => void;
  readonly setCenter: (
    x: number,
    y: number,
    options: { readonly zoom: number; readonly duration: number },
  ) => void;
  readonly getZoom: () => number;
};

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2;
export const FIT_VIEW_PADDING = 0.2;
export const VIEWPORT_TRANSITION_MS = 200;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// Spec section 10: viewport transitions take no time under reduced motion.
export function getViewportTransitionDuration(): number {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
    ? 0
    : VIEWPORT_TRANSITION_MS;
}

export type ViewportControlsProviderProps = {
  readonly controls: ViewportControls;
  readonly children: ReactNode;
};

const ViewportControlsContext = createContext<ViewportControls | null>(null);

export function ViewportControlsProvider({
  controls,
  children,
}: ViewportControlsProviderProps): JSX.Element {
  return (
    <ViewportControlsContext value={controls}>
      {children}
    </ViewportControlsContext>
  );
}

export function useViewportControls(): ViewportControls {
  const controls = useContext(ViewportControlsContext);

  if (controls === null) {
    throw new Error(
      "useViewportControls must be used inside a ViewportControlsProvider.",
    );
  }

  return controls;
}

/**
 * Node queries and fitting for the toolbar and import/export, built from the
 * React Flow instance by `EditorFlowProvider`. A separate context from
 * `ViewportControls`, so tests that fake those controls need not change.
 */
export type CanvasNodeControls = {
  // Only nodes React Flow has measured (`measured.width` and `.height`).
  readonly getMeasuredNodes: () => readonly Node[];
  // Fits the view around these nodes once all of them are measured, so it
  // can be called right after the dispatch that adds them.
  readonly fitNodes: (ids: readonly string[]) => void;
};

export type CanvasNodeControlsProviderProps = {
  readonly controls: CanvasNodeControls;
  readonly children: ReactNode;
};

const CanvasNodeControlsContext = createContext<CanvasNodeControls | null>(
  null,
);

export function CanvasNodeControlsProvider({
  controls,
  children,
}: CanvasNodeControlsProviderProps): JSX.Element {
  return (
    <CanvasNodeControlsContext value={controls}>
      {children}
    </CanvasNodeControlsContext>
  );
}

export function useCanvasNodeControls(): CanvasNodeControls {
  const controls = useContext(CanvasNodeControlsContext);

  if (controls === null) {
    throw new Error(
      "useCanvasNodeControls must be used inside a CanvasNodeControlsProvider.",
    );
  }

  return controls;
}
