"use client";

import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import type { JSX, ReactNode } from "react";
import { useMemo } from "react";

import type { ViewportControls } from "../../lib/viewport-controls";
import {
  FIT_VIEW_PADDING,
  VIEWPORT_TRANSITION_MS,
  ViewportControlsProvider,
} from "../../lib/viewport-controls";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function getTransitionDuration(): number {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
    ? 0
    : VIEWPORT_TRANSITION_MS;
}

function useViewportControlsOfFlow(): ViewportControls {
  const flow = useReactFlow();
  // Each command resolves once its transition ends; nothing waits for that.
  return useMemo(
    () => ({
      zoomIn: () => {
        void flow.zoomIn({ duration: getTransitionDuration() });
      },
      zoomOut: () => {
        void flow.zoomOut({ duration: getTransitionDuration() });
      },
      fitView: () => {
        void flow.fitView({
          padding: FIT_VIEW_PADDING,
          duration: getTransitionDuration(),
        });
      },
      setCenter: (x, y, options) => {
        void flow.setCenter(x, y, options);
      },
      getZoom: () => flow.getZoom(),
    }),
    [flow],
  );
}

type FlowViewportControlsProps = { readonly children: ReactNode };

function FlowViewportControls({
  children,
}: FlowViewportControlsProps): JSX.Element {
  const controls = useViewportControlsOfFlow();

  return (
    <ViewportControlsProvider controls={controls}>
      {children}
    </ViewportControlsProvider>
  );
}

export type EditorFlowProviderProps = { readonly children: ReactNode };

/**
 * Holds the React Flow instance and the viewport commands built from it, so
 * the toolbar and the panels rendered beside the canvas (not inside it) can
 * zoom and move the viewport. `EditorCanvas` must be rendered inside it.
 */
export function EditorFlowProvider({
  children,
}: EditorFlowProviderProps): JSX.Element {
  return (
    <ReactFlowProvider>
      <FlowViewportControls>{children}</FlowViewportControls>
    </ReactFlowProvider>
  );
}
