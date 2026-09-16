import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";
import { TriangleAlertIcon } from "lucide-react";
import type { CSSProperties, JSX } from "react";
import { memo } from "react";
import { useTranslation } from "react-i18next";

import type { RelationEdge as RelationFlowEdge } from "../../lib/to-relation-edges";
import { getRelationMarkerUrl } from "./relation-markers";
import type { RelationMarkerVariant } from "./relation-markers";

// WCAG 2.5.8 asks for a 24 px target; React Flow's default is 20 px.
const EDGE_INTERACTION_WIDTH = 24;
const SELECTED_STROKE_WIDTH = 2;
const ISSUE_DASH_PATTERN = "6 4";
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
): CSSProperties | undefined {
  const width = isSelected ? SELECTED_STROKE_WIDTH : undefined;
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
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const hasIssue = data?.hasIssue ?? false;
  const isSelected = selected ?? false;
  const variant = getVariant(hasIssue, isSelected);
  const columnPairCount = data?.columnPairCount ?? 1;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={EDGE_INTERACTION_WIDTH}
        markerStart={getRelationMarkerUrl(
          data?.kind === "oneToOne" ? "one" : "many",
          variant,
        )}
        markerEnd={getRelationMarkerUrl("one", variant)}
        style={getPathStyle(hasIssue, isSelected)}
        className={FOCUSED_PATH_CLASS_NAME}
      />
      <EdgeLabelRenderer>
        {/* Portaled outside the focusable edge, where it would be read as
            loose text; the edge's accessible name already says all of it. */}
        <div
          aria-hidden
          className="nodrag nopan absolute flex items-center gap-1 rounded-sm border border-border bg-card px-1 text-[0.625rem] text-card-foreground"
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
