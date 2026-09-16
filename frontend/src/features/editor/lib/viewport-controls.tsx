"use client";

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
