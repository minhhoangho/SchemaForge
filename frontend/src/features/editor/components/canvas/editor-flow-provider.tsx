"use client";

import {
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import type { Node } from "@xyflow/react";
import type { JSX, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import type {
  CanvasNodeControls,
  ViewportControls,
} from "../../lib/viewport-controls";
import {
  CanvasNodeControlsProvider,
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

function isMeasured(node: Node): boolean {
  return (
    node.measured?.width !== undefined && node.measured.height !== undefined
  );
}

function useCanvasNodeControlsOfFlow(): CanvasNodeControls {
  const flow = useReactFlow();
  // Flips to false while a new node waits for its size and back once it has
  // one, which re-runs the fit effect below.
  const isEveryNodeMeasured = useNodesInitialized();
  const [pendingFitIds, setPendingFitIds] = useState<readonly string[] | null>(
    null,
  );

  useEffect(() => {
    if (pendingFitIds === null) {
      return;
    }
    const measuredIds = new Set(
      flow
        .getNodes()
        .filter(isMeasured)
        .map((node) => node.id),
    );
    if (!pendingFitIds.every((id) => measuredIds.has(id))) {
      return;
    }
    void flow.fitView({
      nodes: pendingFitIds.map((id) => ({ id })),
      padding: FIT_VIEW_PADDING,
      duration: getTransitionDuration(),
    });
    setPendingFitIds(null);
  }, [flow, pendingFitIds, isEveryNodeMeasured]);

  return useMemo(
    () => ({
      getMeasuredNodes: () => flow.getNodes().filter(isMeasured),
      fitNodes: (ids) => {
        setPendingFitIds(ids);
      },
    }),
    [flow],
  );
}

type FlowViewportControlsProps = { readonly children: ReactNode };

function FlowViewportControls({
  children,
}: FlowViewportControlsProps): JSX.Element {
  const controls = useViewportControlsOfFlow();
  const nodeControls = useCanvasNodeControlsOfFlow();

  return (
    <ViewportControlsProvider controls={controls}>
      <CanvasNodeControlsProvider controls={nodeControls}>
        {children}
      </CanvasNodeControlsProvider>
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
