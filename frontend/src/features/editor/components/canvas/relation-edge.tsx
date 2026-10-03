import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";
import { TriangleAlertIcon } from "lucide-react";
import type { CSSProperties, JSX } from "react";
import { memo } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/class-names";

import type { RelationEdge as RelationFlowEdge } from "../../lib/to-relation-edges";
import { selectDiffMark } from "../../state/create-editor-store";
import { useEditorStore } from "../../state/use-editor-store";
import { getRelationMarkerUrl } from "./relation-markers";
import type { RelationMarkerVariant } from "./relation-markers";

// WCAG 2.5.8 asks for a 24 px target; React Flow's default is 20 px.
const EDGE_INTERACTION_WIDTH = 24;
const SELECTED_STROKE_WIDTH = 2.5;
const EDGE_CORNER_RADIUS = 8;
// Long enough for the crow's foot to sit on a straight segment.
const EDGE_HANDLE_OFFSET = 16;
const ISSUE_DASH_PATTERN = "6 4";
// Shorter dashes than an issue edge, so the two differ by more than color.
const REMOVED_DASH_PATTERN = "2 4";
// A keyboard-focused edge gets a thicker stroke. `!` beats the inline stroke
// width of a selected edge, and a width change stays visible on issue edges,
// whose inline stroke color React Flow's focus color cannot override.
const FOCUSED_PATH_CLASS_NAME = "in-focus-visible:stroke-4!";

function getVariant(
  hasIssue: boolean,
  isSelected: boolean,
): RelationMarkerVariant {
  if (hasIssue) {
    return "issue";
  }
  return isSelected ? "selected" : "default";
}

function getPathStyle(
  hasIssue: boolean,
  isSelected: boolean,
  isRemoved: boolean,
): CSSProperties | undefined {
  const width = isSelected ? SELECTED_STROKE_WIDTH : undefined;
  // A relation an AI proposal removes is still drawn, dashed (AI-R34).
  if (isRemoved) {
    return {
      stroke: "var(--diff-removed)",
      strokeDasharray: REMOVED_DASH_PATTERN,
      strokeWidth: width,
    };
  }
  return hasIssue
    ? {
        stroke: "var(--destructive)",
        strokeDasharray: ISSUE_DASH_PATTERN,
        strokeWidth: width,
      }
    : { strokeWidth: width };
}

/**
 * A relation between two tables: a crow's foot on the foreign key side, a
 * single bar on the referenced side, and a small kind label. Its accessible
 * name is set on the React Flow edge itself (`ariaLabel`).
 */
export const RelationEdge = memo(function RelationEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  selected,
  data,
}: EdgeProps<RelationFlowEdge>): JSX.Element {
  const { t } = useTranslation("canvas");
  const isRemoved = useEditorStore(
    (state) => selectDiffMark(state, id) === "removed",
  );
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: EDGE_CORNER_RADIUS,
    offset: EDGE_HANDLE_OFFSET,
  });
  const hasIssue = data?.hasIssue ?? false;
  const isSelected = selected ?? false;
  const variant = getVariant(hasIssue, isSelected);
  const columnPairCount = data?.columnPairCount ?? 1;
  const startShape = data?.kind === "oneToOne" ? "one" : "many";

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={EDGE_INTERACTION_WIDTH}
        markerStart={getRelationMarkerUrl(startShape, variant)}
        markerEnd={getRelationMarkerUrl("one", variant)}
        style={getPathStyle(hasIssue, isSelected, isRemoved)}
        // The hover rules in globals.css select on these class names; only a
        // default edge reacts to hover.
        className={cn(
          FOCUSED_PATH_CLASS_NAME,
          `relation-edge-start-${startShape}`,
          variant === "default" && "relation-edge-hoverable",
        )}
      />
      <EdgeLabelRenderer>
        {/* Portaled outside the focusable edge, where it would be read as
            loose text; the edge's accessible name already says all of it. */}
        <div
          aria-hidden
          className={cn(
            "nodrag nopan absolute flex items-center gap-1 rounded-full border border-border bg-card px-1.5 text-[0.625rem] font-medium text-muted-foreground shadow-sm",
            isSelected && "border-primary text-foreground",
          )}
          style={{
            transform: `translate(-50%, -50%) translate(${String(labelX)}px, ${String(labelY)}px)`,
          }}
        >
          <span>
            {data?.kind === "oneToOne"
              ? t("edge.oneToOne")
              : t("edge.oneToMany")}
          </span>
          {columnPairCount > 1 ? (
            <span>{t("edge.columnCount", { count: columnPairCount })}</span>
          ) : null}
          {hasIssue ? (
            <span className="flex items-center text-destructive">
              <TriangleAlertIcon aria-hidden className="size-3" />
            </span>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
