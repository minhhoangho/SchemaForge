"use client";

import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  ReactFlow,
} from "@xyflow/react";
import type {
  Connection,
  EdgeChange,
  EdgeTypes,
  NodeChange,
  NodeTypes,
  OnSelectionChangeParams,
  Viewport,
} from "@xyflow/react";
import type { JSX, RefObject } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useThemePreference } from "@/lib/theme/use-theme-preference";

import { useCanvasElements } from "../../hooks/use-canvas-elements";
import { useRevealFocusedElement } from "../../hooks/use-reveal-focused-element";
import {
  applyDragStop,
  applyEdgeChanges,
  applyNodeChanges,
  applySelectionChange,
} from "../../lib/apply-canvas-changes";
import type { MeasuredSize } from "../../lib/apply-canvas-changes";
import { buildAriaLabelConfig } from "../../lib/aria-label-config";
import { RELATION_EDGE_TYPE } from "../../lib/to-relation-edges";
import type { RelationEdge as RelationFlowEdge } from "../../lib/to-relation-edges";
import { TABLE_NODE_TYPE } from "../../lib/to-table-nodes";
import type { TableNode as TableFlowNode } from "../../lib/to-table-nodes";
import {
  FIT_VIEW_PADDING,
  MAX_ZOOM,
  MIN_ZOOM,
} from "../../lib/viewport-controls";
import { useEditorStoreApi } from "../../state/use-editor-store";
import { CanvasEmptyState } from "./canvas-empty-state";
import { RelationEdge } from "./relation-edge";
import { RelationMarkers } from "./relation-markers";
import { TableNode } from "./table-node";

export type EditorCanvasProps = {
  readonly defaultViewport: Viewport | null;
  readonly onMoveEnd: (viewport: Viewport) => void;
  readonly onAddTable: () => void;
  readonly onConnect: (connection: Connection) => void;
};

type CanvasHandlers = {
  readonly onNodesChange: (changes: NodeChange<TableFlowNode>[]) => void;
  readonly onEdgesChange: (changes: EdgeChange<RelationFlowEdge>[]) => void;
  readonly onSelectionChange: (
    params: OnSelectionChangeParams<TableFlowNode, RelationFlowEdge>,
  ) => void;
  readonly onNodeDragStop: (
    event: unknown,
    node: TableFlowNode,
    draggedNodes: TableFlowNode[],
  ) => void;
};

const NODE_TYPES = { [TABLE_NODE_TYPE]: TableNode } satisfies NodeTypes;
const EDGE_TYPES = { [RELATION_EDGE_TYPE]: RelationEdge } satisfies EdgeTypes;
const FIT_VIEW_OPTIONS = { padding: FIT_VIEW_PADDING };

// Every delete goes through the store's dispatch (spec section 3), never
// through React Flow.
function refuseDelete(): Promise<boolean> {
  return Promise.resolve(false);
}

function useCanvasHandlers(
  measuredSizes: RefObject<Map<string, MeasuredSize>>,
): CanvasHandlers {
  const store = useEditorStoreApi();
  return useMemo(
    () => ({
      onNodesChange: (changes) => {
        applyNodeChanges(store, changes, measuredSizes.current);
      },
      onEdgesChange: (changes) => {
        applyEdgeChanges(store, changes);
      },
      onSelectionChange: (params) => {
        applySelectionChange(store, params);
      },
      onNodeDragStop: (_event, _node, draggedNodes) => {
        applyDragStop(store, draggedNodes);
      },
    }),
    [store, measuredSizes],
  );
}

/**
 * The schema canvas. Only the editor store's dispatch changes the schema.
 * Must be rendered inside `EditorFlowProvider`, which also gives the toolbar
 * and panels beside the canvas their viewport controls.
 */
export function EditorCanvas({
  defaultViewport,
  onMoveEnd,
  onAddTable,
  onConnect,
}: EditorCanvasProps): JSX.Element {
  const { t } = useTranslation("canvas");
  const { preference } = useThemePreference();
  const [canvasElement, setCanvasElement] = useState<HTMLDivElement | null>(
    null,
  );
  // Written by change handlers and read while deriving nodes; never rendered
  // by itself, so it lives in a ref rather than in state.
  const measuredSizes = useRef(new Map<string, MeasuredSize>());
  const { nodes, edges } = useCanvasElements(t, measuredSizes);
  const handlers = useCanvasHandlers(measuredSizes);
  const ariaLabelConfig = useMemo(() => buildAriaLabelConfig(t), [t]);
  useRevealFocusedElement(canvasElement);

  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => {
      onMoveEnd(viewport);
    },
    [onMoveEnd],
  );

  return (
    <div ref={setCanvasElement} className="relative size-full">
      <RelationMarkers />
      <ReactFlow<TableFlowNode, RelationFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        {...handlers}
        onMoveEnd={handleMoveEnd}
        onConnect={onConnect}
        onBeforeDelete={refuseDelete}
        deleteKeyCode={null}
        connectionMode={ConnectionMode.Loose}
        nodesFocusable
        edgesFocusable
        autoPanOnNodeFocus={false}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        colorMode={preference}
        ariaLabelConfig={ariaLabelConfig}
        defaultViewport={defaultViewport ?? undefined}
        fitView={defaultViewport === null}
        fitViewOptions={FIT_VIEW_OPTIONS}
      >
        <MiniMap pannable zoomable />
        <Background variant={BackgroundVariant.Dots} />
      </ReactFlow>
      {nodes.length === 0 ? <CanvasEmptyState onAddTable={onAddTable} /> : null}
    </div>
  );
}
